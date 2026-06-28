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
