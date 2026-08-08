import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, ...params } = await req.json()

    switch (action) {
      case 'get_marketplace_data': {
        const { investor_id } = params

        // Get investor's listings
        const { data: myListings } = await supabase
          .from('deal_listings')
          .select(`
            *,
            property:investor_portfolio(*)
          `)
          .eq('seller_id', investor_id)
          .order('created_at', { ascending: false })

        // Get private deals sent to this investor
        const { data: receivedOffers } = await supabase
          .from('private_deal_offers')
          .select(`
            *,
            listing:deal_listings(
              *,
              property:investor_portfolio(*)
            ),
            seller:investors!seller_id(full_name, email)
          `)
          .eq('buyer_id', investor_id)
          .order('sent_at', { ascending: false })

        // Get investor's portfolio for creating listings
        const { data: portfolio } = await supabase
          .from('investor_portfolio')
          .select('*')
          .eq('investor_id', investor_id)
          .eq('property_status', 'active')

        const receivedDeals = receivedOffers?.map(offer => ({
          id: offer.id,
          listing: offer.listing,
          seller_name: offer.seller?.full_name,
          seller_email: offer.seller?.email,
          sent_at: offer.sent_at,
          status: offer.status
        }))

        return new Response(
          JSON.stringify({
            my_listings: myListings || [],
            received_deals: receivedDeals || [],
            portfolio: portfolio || []
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'search_investors': {
        const { search_query, exclude_investor_id } = params

        const { data: investors } = await supabase
          .from('investors')
          .select('id, full_name, email, phone, is_verified_operator')
          .or(`full_name.ilike.%${search_query}%,email.ilike.%${search_query}%,phone.ilike.%${search_query}%`)
          .neq('id', exclude_investor_id)
          .limit(10)

        return new Response(
          JSON.stringify({ investors: investors || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'create_listing': {
        const {
          investor_id,
          property_id,
          listing_type,
          buyer_investor_id,
          asking_price,
          description,
          monthly_revenue,
          monthly_expenses,
          lease_months_remaining
        } = params

        // Get buyer info if private deal
        let buyerInfo = null
        if (listing_type === 'private' && buyer_investor_id) {
          const { data: buyer } = await supabase
            .from('investors')
            .select('full_name, email')
            .eq('id', buyer_investor_id)
            .single()
          buyerInfo = buyer
        }

        // Create the listing
        const { data: listing, error } = await supabase
          .from('deal_listings')
          .insert({
            property_id,
            seller_id: investor_id,
            listing_type,
            asking_price,
            description,
            monthly_revenue,
            monthly_expenses,
            lease_months_remaining,
            buyer_investor_id: listing_type === 'private' ? buyer_investor_id : null,
            buyer_investor_name: buyerInfo?.full_name,
            buyer_investor_email: buyerInfo?.email,
            status: listing_type === 'public' ? 'pending_approval' : 'active'
          })
          .select()
          .single()

        if (error) throw error

        // If private deal, create the offer record
        if (listing_type === 'private' && buyer_investor_id) {
          await supabase
            .from('private_deal_offers')
            .insert({
              listing_id: listing.id,
              seller_id: investor_id,
              buyer_id: buyer_investor_id,
              status: 'pending'
            })

          // Send notification to buyer
          await supabase
            .from('investor_notifications')
            .insert({
              investor_id: buyer_investor_id,
              type: 'private_deal_received',
              title: 'New Private Deal Offer',
              message: `You've received a private deal offer for $${asking_price.toLocaleString()}`,
              data: { listing_id: listing.id }
            })
        }

        return new Response(
          JSON.stringify({ success: true, listing_id: listing.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'cancel_listing': {
        const { listing_id, investor_id } = params

        const { error } = await supabase
          .from('deal_listings')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', listing_id)
          .eq('seller_id', investor_id)

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'request_verification': {
        const { listing_id, investor_id } = params

        // Create verification record
        const { data: verification, error } = await supabase
          .from('deal_verifications')
          .insert({
            listing_id,
            requested_by: investor_id,
            status: 'pending',
            verification_fee_amount: 100
          })
          .select()
          .single()

        if (error) throw error

        // Update listing status
        await supabase
          .from('deal_listings')
          .update({
            status: 'verification_requested',
            verification_status: 'pending',
            verification_requested_at: new Date().toISOString()
          })
          .eq('id', listing_id)

        // Update private deal offer status
        await supabase
          .from('private_deal_offers')
          .update({ status: 'verification_requested' })
          .eq('listing_id', listing_id)
          .eq('buyer_id', investor_id)

        // Notify staff
        await supabase
          .from('staff_notifications')
          .insert({
            type: 'verification_requested',
            title: 'New Deal Verification Request',
            message: 'A buyer has requested verification for a private deal',
            data: { listing_id, verification_id: verification.id }
          })

        return new Response(
          JSON.stringify({
            success: true,
            verification_id: verification.id,
            payment_required: true,
            amount: 100
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'release_report': {
        const { listing_id, investor_id } = params

        // Get verification
        const { data: verification } = await supabase
          .from('deal_verifications')
          .select('*')
          .eq('listing_id', listing_id)
          .single()

        if (!verification) {
          throw new Error('Verification not found')
        }

        // Update verification with report release
        await supabase
          .from('deal_verifications')
          .update({
            report_fee_paid: true,
            report_fee_paid_at: new Date().toISOString()
          })
          .eq('id', verification.id)

        // Update listing
        await supabase
          .from('deal_listings')
          .update({
            report_released: true,
            report_released_at: new Date().toISOString()
          })
          .eq('id', listing_id)

        // Record payment
        await supabase
          .from('marketplace_payments')
          .insert({
            listing_id,
            verification_id: verification.id,
            payer_id: investor_id,
            payment_type: 'report_release_fee',
            amount: 99,
            status: 'completed',
            paid_at: new Date().toISOString()
          })

        return new Response(
          JSON.stringify({
            success: true,
            report: {
              summary: verification.report_summary,
              details: verification.report_details,
              landlord_name: verification.landlord_name,
              landlord_phone: verification.landlord_phone,
              landlord_email: verification.landlord_email,
              license_requirements: verification.license_requirements
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'opt_full_transaction': {
        const { listing_id, investor_id } = params

        // Get listing details
        const { data: listing } = await supabase
          .from('deal_listings')
          .select('*, verification:deal_verifications(*)')
          .eq('id', listing_id)
          .single()

        if (!listing) throw new Error('Listing not found')

        const feeAmount = listing.asking_price * 0.20

        // Create transaction record
        const { data: transaction, error } = await supabase
          .from('deal_transactions')
          .insert({
            listing_id,
            verification_id: listing.verification?.[0]?.id,
            seller_id: listing.seller_id,
            buyer_id: investor_id,
            acquisition_cost: listing.asking_price,
            ayp_fee_percentage: 20,
            ayp_fee_amount: feeAmount,
            status: 'pending'
          })
          .select()
          .single()

        if (error) throw error

        // Update listing
        await supabase
          .from('deal_listings')
          .update({
            transaction_managed_by_ayp: true,
            transaction_fee_amount: feeAmount
          })
          .eq('id', listing_id)

        // Notify staff
        await supabase
          .from('staff_notifications')
          .insert({
            type: 'full_transaction_requested',
            title: 'Full Transaction Management Requested',
            message: `A buyer has opted for full transaction management. Fee: $${feeAmount.toLocaleString()}`,
            data: { listing_id, transaction_id: transaction.id }
          })

        return new Response(
          JSON.stringify({
            success: true,
            transaction_id: transaction.id,
            fee_amount: feeAmount
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'decline_deal': {
        const { listing_id, investor_id } = params

        await supabase
          .from('private_deal_offers')
          .update({
            status: 'declined',
            responded_at: new Date().toISOString()
          })
          .eq('listing_id', listing_id)
          .eq('buyer_id', investor_id)

        // Notify seller
        const { data: listing } = await supabase
          .from('deal_listings')
          .select('seller_id')
          .eq('id', listing_id)
          .single()

        if (listing) {
          await supabase
            .from('investor_notifications')
            .insert({
              investor_id: listing.seller_id,
              type: 'deal_declined',
              title: 'Deal Offer Declined',
              message: 'The investor has declined your private deal offer',
              data: { listing_id }
            })
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }


      // ---- ADDED 6 Aug 2026 ----
      //
      // The UI has offered these for months and every one threw "Unknown action". A seller
      // could create a listing and cancel it; the entire rest of the third-party sale flow
      // — the 80/20 product — was dead. The schema was always there. Only the handlers
      // were missing.
      //
      // Written against the ACTUAL columns of deal_listings, private_deal_offers,
      // deal_verifications and deal_transactions, read from information_schema rather than
      // guessed at.

      case 'get_public_listings': {
        const { data, error } = await supabase
          .from('deal_listings')
          .select('*, property:investor_portfolio(*)')
          .eq('listing_type', 'public')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
        if (error) throw error
        return new Response(JSON.stringify({ listings: data || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'get_my_seller_listings': {
        const { investor_id } = params
        const { data, error } = await supabase
          .from('deal_listings')
          .select('*, property:investor_portfolio(*)')
          .eq('seller_id', investor_id)
          .order('created_at', { ascending: false })
        if (error) throw error
        return new Response(JSON.stringify({ listings: data || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'get_pending_listings': {
        const { data, error } = await supabase
          .from('deal_listings')
          .select('*, seller:investors!seller_id(full_name, email)')
          .eq('status', 'pending_approval')
          .order('created_at', { ascending: true })
        if (error) throw error
        return new Response(JSON.stringify({ listings: data || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'approve_listing': {
        const { listing_id, staff_id, staff_name } = params
        if (!staff_id) throw new Error('A staff id is required to approve a listing.')
        const { data, error } = await supabase
          .from('deal_listings')
          .update({
            status: 'active', approved_at: new Date().toISOString(),
            last_updated_by_staff_id: staff_id, last_updated_by_staff_name: staff_name || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', listing_id).select().single()
        if (error) throw error
        await supabase.from('investor_notifications').insert({
          investor_id: data.seller_id, type: 'listing_approved',
          title: 'Your listing is live',
          message: 'Your operation is now visible on the deal marketplace.',
          data: { listing_id },
        })
        return new Response(JSON.stringify({ success: true, listing: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'reject_listing':
      case 'request_listing_changes': {
        const { listing_id, reason, staff_id, staff_name } = params
        if (!staff_id) throw new Error('A staff id is required.')
        if (!reason) throw new Error('A reason is required — a seller cannot act on a rejection with no reason.')
        const rejecting = action === 'reject_listing'
        const { data, error } = await supabase
          .from('deal_listings')
          .update({
            status: rejecting ? 'rejected' : 'changes_requested',
            rejection_reason: rejecting ? reason : null,
            changes_requested: rejecting ? null : reason,
            rejected_at: rejecting ? new Date().toISOString() : null,
            last_updated_by_staff_id: staff_id, last_updated_by_staff_name: staff_name || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', listing_id).select().single()
        if (error) throw error
        await supabase.from('investor_notifications').insert({
          investor_id: data.seller_id,
          type: rejecting ? 'listing_rejected' : 'listing_changes_requested',
          title: rejecting ? 'Your listing was not approved' : 'Changes needed on your listing',
          message: reason,
          data: { listing_id },
        })
        return new Response(JSON.stringify({ success: true, listing: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'resubmit_listing': {
        const { listing_id, investor_id } = params
        const { data: current } = await supabase
          .from('deal_listings').select('resubmit_count, seller_id').eq('id', listing_id).single()
        if (!current || current.seller_id !== investor_id) throw new Error('That is not your listing.')
        const { data, error } = await supabase
          .from('deal_listings')
          .update({
            status: 'pending_approval', changes_requested: null, rejection_reason: null,
            resubmitted_at: new Date().toISOString(),
            resubmit_count: (current.resubmit_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', listing_id).select().single()
        if (error) throw error
        return new Response(JSON.stringify({ success: true, listing: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'submit_offer': {
        const { listing_id, buyer_id } = params
        const { data: listing } = await supabase
          .from('deal_listings').select('id, seller_id, status, asking_price').eq('id', listing_id).single()
        if (!listing) throw new Error('That listing no longer exists.')
        if (listing.status !== 'active') throw new Error('That listing is not open for offers.')
        if (listing.seller_id === buyer_id) throw new Error('You cannot make an offer on your own listing.')
        const { data, error } = await supabase
          .from('private_deal_offers')
          .insert({ listing_id, seller_id: listing.seller_id, buyer_id, status: 'pending',
                    sent_at: new Date().toISOString() })
          .select().single()
        if (error) throw error
        await supabase.from('investor_notifications').insert({
          investor_id: listing.seller_id, type: 'offer_received',
          title: 'You have an offer', message: 'Someone has made an offer on your listing.',
          data: { listing_id, offer_id: data.id },
        })
        return new Response(JSON.stringify({ success: true, offer_id: data.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'get_listing_offers':
      case 'get_seller_offers': {
        const { listing_id, investor_id } = params
        let q = supabase.from('private_deal_offers')
          .select('*, buyer:investors!buyer_id(full_name, email), listing:deal_listings(*)')
        if (listing_id) q = q.eq('listing_id', listing_id)
        if (investor_id) q = q.eq('seller_id', investor_id)
        const { data, error } = await q.order('sent_at', { ascending: false })
        if (error) throw error
        return new Response(JSON.stringify({ offers: data || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'accept_offer':
      case 'reject_offer': {
        const { offer_id, investor_id } = params
        const accepting = action === 'accept_offer'
        const { data: offer } = await supabase
          .from('private_deal_offers').select('*').eq('id', offer_id).single()
        if (!offer) throw new Error('That offer no longer exists.')
        if (offer.seller_id !== investor_id) throw new Error('That is not your offer to answer.')
        if (offer.status !== 'pending') throw new Error(`That offer is already ${offer.status}.`)

        const { error } = await supabase.from('private_deal_offers')
          .update({ status: accepting ? 'accepted' : 'declined', responded_at: new Date().toISOString() })
          .eq('id', offer_id)
        if (error) throw error

        // Accepting one offer declines the others on the same listing. Leaving them
        // pending would have two buyers believing they were still in play.
        if (accepting) {
          await supabase.from('private_deal_offers')
            .update({ status: 'declined', responded_at: new Date().toISOString() })
            .eq('listing_id', offer.listing_id).eq('status', 'pending').neq('id', offer_id)
        }

        await supabase.from('investor_notifications').insert({
          investor_id: offer.buyer_id,
          type: accepting ? 'offer_accepted' : 'offer_declined',
          title: accepting ? 'Your offer was accepted' : 'Your offer was declined',
          message: accepting
            ? 'The seller accepted your offer. Our team will be in touch about next steps.'
            : 'The seller declined your offer.',
          data: { listing_id: offer.listing_id, offer_id },
        })
        return new Response(JSON.stringify({ success: true, status: accepting ? 'accepted' : 'declined' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'mark_as_sold': {
        const { listing_id, sold_price, offer_id, staff_id } = params
        if (!staff_id) throw new Error('A staff id is required to close a sale.')
        const { data, error } = await supabase
          .from('deal_listings')
          .update({ status: 'sold', sold_at: new Date().toISOString(),
                    sold_price: sold_price ?? null, sold_offer_id: offer_id ?? null,
                    last_updated_by_staff_id: staff_id, updated_at: new Date().toISOString() })
          .eq('id', listing_id).select().single()
        if (error) throw error
        return new Response(JSON.stringify({ success: true, listing: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'get_verification_queue':
      case 'get_pending_verifications': {
        const { data, error } = await supabase
          .from('deal_verifications')
          .select('*, listing:deal_listings(*)')
          .neq('status', 'completed')
          .order('created_at', { ascending: true })
        if (error) throw error
        return new Response(JSON.stringify({ verifications: data || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'save_verification_checklist': {
        const { verification_id, checklist, notes, staff_id } = params
        if (!staff_id) throw new Error('A staff id is required.')
        const { error } = await supabase.from('deal_verifications')
          .update({
            seller_call_completed: checklist?.seller_call_completed ?? null,
            landlord_vetted: checklist?.landlord_vetted ?? null,
            property_standards_met: checklist?.property_standards_met ?? null,
            license_requirements_checked: checklist?.license_requirements_checked ?? null,
            revenue_verified: checklist?.revenue_verified ?? null,
            notes: notes ?? null, assigned_to: staff_id,
          })
          .eq('id', verification_id)
        if (error) throw error
        return new Response(JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'complete_verification': {
        const { verification_id, staff_id } = params
        if (!staff_id) throw new Error('A staff id is required.')
        const { data: v } = await supabase.from('deal_verifications').select('*').eq('id', verification_id).single()
        if (!v) throw new Error('No such verification.')
        // Every check must actually be done. A verification that can be completed with
        // unfinished checks is a rubber stamp, and this platform sells verification.
        const missing = ['seller_call_completed','landlord_vetted','property_standards_met',
                         'license_requirements_checked','revenue_verified'].filter((k) => v[k] !== true)
        if (missing.length) {
          throw new Error(`Cannot complete: still outstanding — ${missing.join(', ')}.`)
        }
        await supabase.from('deal_verifications')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', verification_id)
        await supabase.from('deal_listings')
          .update({ verification_status: 'verified', verification_completed_at: new Date().toISOString(),
                    verification_completed_by: staff_id, staff_verified: true,
                    staff_verified_at: new Date().toISOString(), staff_verified_by: staff_id })
          .eq('id', v.listing_id)
        return new Response(JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'get_transactions':
      case 'get_closed_deals': {
        const { data, error } = await supabase
          .from('deal_transactions')
          .select('*, listing:deal_listings(*)')
          .order('created_at', { ascending: false })
        if (error) throw error
        return new Response(JSON.stringify({ transactions: data || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'update_transaction_status': {
        const { transaction_id, status, staff_id } = params
        if (!staff_id) throw new Error('A staff id is required.')
        const stamps: Record<string, string> = {
          payment_received: 'payment_received_at', documents_pending: 'documents_pending_at',
          documents_signed: 'documents_signed_at', access_transferred: 'access_transferred_at',
          completed: 'completed_at',
        }
        const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
        if (stamps[status]) patch[stamps[status]] = new Date().toISOString()
        const { error } = await supabase.from('deal_transactions').update(patch).eq('id', transaction_id)
        if (error) throw error
        return new Response(JSON.stringify({ success: true, status }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'assign_success_manager': {
        const { transaction_id, success_manager_id, staff_id } = params
        if (!staff_id) throw new Error('A staff id is required.')
        const { error } = await supabase.from('deal_transactions')
          .update({ success_manager_id, success_manager_assigned_at: new Date().toISOString(),
                    updated_at: new Date().toISOString() })
          .eq('id', transaction_id)
        if (error) throw error
        return new Response(JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'release_funds': {
        const { transaction_id, staff_id } = params
        if (!staff_id) throw new Error('A staff id is required to release funds.')
        const { data: t } = await supabase.from('deal_transactions').select('*').eq('id', transaction_id).single()
        if (!t) throw new Error('No such transaction.')
        // Half the seller payout is held until the lease is signed with the new operator.
        // Releasing before that is releasing money against work not yet done.
        if (!t.documents_signed_at) {
          throw new Error('Documents are not signed yet, so funds cannot be released. That hold is the point of it.')
        }
        const { error } = await supabase.from('deal_transactions')
          .update({ funds_released_at: new Date().toISOString(), status: 'funds_released',
                    updated_at: new Date().toISOString() })
          .eq('id', transaction_id)
        if (error) throw error
        return new Response(JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'add_staff_note_to_offer': {
        const { listing_id, note, staff_id, staff_name } = params
        if (!staff_id || !note) throw new Error('A staff id and a note are required.')
        const { data: cur } = await supabase.from('deal_listings').select('verification_notes').eq('id', listing_id).single()
        const stamped = `${new Date().toISOString().slice(0,10)} — ${staff_name || 'staff'}: ${note}`
        const { error } = await supabase.from('deal_listings')
          .update({ verification_notes: cur?.verification_notes ? `${cur.verification_notes}\n${stamped}` : stamped,
                    last_updated_by_staff_id: staff_id, updated_at: new Date().toISOString() })
          .eq('id', listing_id)
        if (error) throw error
        return new Response(JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'get_all_negotiations': {
        const { data, error } = await supabase
          .from('private_deal_offers')
          .select('*, listing:deal_listings(*), buyer:investors!buyer_id(full_name,email), seller:investors!seller_id(full_name,email)')
          .order('sent_at', { ascending: false })
        if (error) throw error
        return new Response(JSON.stringify({ negotiations: data || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'counter_offer': {
        // Deliberately NOT implemented as a silent no-op. private_deal_offers has no
        // amount or counter column, so a counter cannot be recorded without a schema
        // change, and pretending otherwise would lose a real negotiation.
        throw new Error('Counter offers are not supported yet — there is nowhere to record the counter amount. Use a note and contact the buyer directly.')
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
