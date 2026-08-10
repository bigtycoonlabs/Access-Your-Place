import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json()
    const { action, investor_id, referral_code, new_investor_id, reward_id, reward_type } = body
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!, supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' }

    const J = (b: unknown, st = 200) => new Response(JSON.stringify(b),
      { status: st, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // ---- ADDED 9 Aug 2026 ----
    //
    // Six actions the referral screens called and none existed. Referrals are a paid
    // channel — $300 when a client's referral closes — so a dead payout screen means
    // somebody is owed money the system cannot see.

    if (action === 'invite_referral') {
      const { invitee_email, invitee_name } = body
      if (!investor_id) return J({ success: false, error: 'investor_id is required.' }, 400)
      if (!invitee_email || !String(invitee_email).includes('@')) {
        return J({ success: false, error: 'A real email address is needed to send an invitation.' }, 400)
      }
      // Do not invite somebody who is already here. It reads as spam to them and it can
      // never pay out, because they were never referred.
      const existing = await fetch(`${supabaseUrl}/rest/v1/investors?email=eq.${encodeURIComponent(String(invitee_email).toLowerCase())}&select=id`, { headers })
      const found = await existing.json().catch(() => [])
      if (Array.isArray(found) && found.length) {
        return J({ success: false, error: 'They already have an account, so a referral would not apply.' }, 409)
      }
      const dup = await fetch(`${supabaseUrl}/rest/v1/referral_invitations?referrer_id=eq.${investor_id}&invitee_email=eq.${encodeURIComponent(String(invitee_email).toLowerCase())}&select=id`, { headers })
      const dupRows = await dup.json().catch(() => [])
      if (Array.isArray(dupRows) && dupRows.length) {
        return J({ success: false, error: 'You have already invited them. Nothing was sent again.' }, 409)
      }
      const ins = await fetch(`${supabaseUrl}/rest/v1/referral_invitations`, {
        method: 'POST', headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({ referrer_id: investor_id,
          invitee_email: String(invitee_email).toLowerCase(),
          invitee_name: invitee_name || null, status: 'sent' }),
      })
      if (!ins.ok) {
        console.error('manage-referrals invite_referral failed', ins.status)
        return J({ success: false, error: 'Could not record the invitation. Nothing was sent.' }, 502)
      }
      const rows = await ins.json()
      return J({ success: true, invitation: rows?.[0] ?? null })
    }

    if (action === 'get_payout_preferences') {
      if (!investor_id) return J({ success: false, error: 'investor_id is required.' }, 400)
      const res = await fetch(`${supabaseUrl}/rest/v1/referral_payout_preferences?investor_id=eq.${investor_id}&select=id,payout_method,account_details,updated_at&limit=1`, { headers })
      const rows = await res.json().catch(() => [])
      const p = Array.isArray(rows) ? rows[0] : null
      if (!p) return J({ success: true, preferences: null, note: 'No payout details on file, so a referral reward cannot be paid yet.' })
      // THE DESTINATION IS NEVER RETURNED IN FULL. Same rule as staff payouts: enough to
      // recognise your own entry, never enough to reconstruct it or copy it wrongly.
      const d = String(p.account_details || '')
      const masked = d.includes('@')
        ? `${d.slice(0, 2)}***@${d.split('@')[1] || ''}`
        : (d.length > 4 ? `••••${d.slice(-4)}` : '••••')
      return J({ success: true, preferences: { id: p.id, payout_method: p.payout_method, looks_like: masked, updated_at: p.updated_at } })
    }

    if (action === 'update_payout_preferences') {
      const { payout_method, account_details } = body
      if (!investor_id) return J({ success: false, error: 'investor_id is required.' }, 400)
      if (!payout_method || !String(account_details || '').trim()) {
        return J({ success: false, error: 'Both a method and where it should go are required.' }, 400)
      }
      const existing = await fetch(`${supabaseUrl}/rest/v1/referral_payout_preferences?investor_id=eq.${investor_id}&select=id&limit=1`, { headers })
      const rows = await existing.json().catch(() => [])
      const payload = { investor_id, payout_method, account_details: String(account_details).trim(), updated_at: new Date().toISOString() }
      const res = (Array.isArray(rows) && rows.length)
        ? await fetch(`${supabaseUrl}/rest/v1/referral_payout_preferences?id=eq.${rows[0].id}`, { method: 'PATCH', headers, body: JSON.stringify(payload) })
        : await fetch(`${supabaseUrl}/rest/v1/referral_payout_preferences`, { method: 'POST', headers, body: JSON.stringify(payload) })
      if (!res.ok) {
        console.error('manage-referrals update_payout_preferences failed', res.status)
        return J({ success: false, error: 'Could not save your payout details. Nothing was changed.' }, 502)
      }
      // Deliberately does not echo the destination back.
      return J({ success: true, note: 'Saved. We will not read your details back — check them against your own record, and save again if anything looks wrong.' })
    }

    if (action === 'get_analytics') {
      const [refRes, rewRes, payRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/investor_referrals?select=id,status`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/referral_rewards?select=id,amount,status`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/referral_payouts?select=id,amount,status`, { headers }),
      ])
      const refs = refRes.ok ? await refRes.json() : []
      const rewards = rewRes.ok ? await rewRes.json() : []
      const payouts = payRes.ok ? await payRes.json() : []
      const sum = (rows: any[], f: (r: any) => boolean) =>
        rows.filter(f).reduce((t, r) => t + Number(r.amount || 0), 0)
      const owed = sum(rewards, (r) => r.status !== 'paid')
      return J({
        success: true,
        analytics: {
          referrals_total: refs.length,
          referrals_converted: refs.filter((r: any) => r.status === 'converted' || r.status === 'closed').length,
          rewards_total: rewards.length,
          amount_owed: owed,
          amount_paid: sum(payouts, (p: any) => p.status === 'paid'),
          payouts_pending: payouts.filter((p: any) => p.status !== 'paid').length,
        },
        note: owed > 0 ? `${owed} is owed to referrers and not yet paid.` : 'Nothing is currently owed.',
      })
    }

    if (action === 'process_payout') {
      const { payout_id, staff_id } = body
      if (!payout_id || !staff_id) return J({ success: false, error: 'payout_id and staff_id are required.' }, 400)
      // Filtering on unpaid means a second click updates nothing, and that is REPORTED
      // rather than returned as success. Paying somebody twice is not recoverable by an
      // apology.
      const res = await fetch(`${supabaseUrl}/rest/v1/referral_payouts?id=eq.${payout_id}&status=neq.paid`, {
        method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({ status: 'paid', paid_at: new Date().toISOString() }),
      })
      if (!res.ok) {
        console.error('manage-referrals process_payout failed', res.status)
        return J({ success: false, error: 'Could not record the payout. Nothing was marked paid.' }, 502)
      }
      const rows = await res.json()
      if (!rows?.length) {
        return J({ success: false, error: 'That payout is already marked paid. Nothing changed — check before sending money again.' }, 409)
      }
      return J({ success: true, payout: rows[0],
        note: 'Marked as paid. This records the payment; it does not send money.' })
    }

    if (action === 'process_scheduled_payouts') {
      // Returns what is DUE. It does not pay anything — a function that quietly pays a
      // batch is the last place you want a surprise.
      const res = await fetch(`${supabaseUrl}/rest/v1/referral_payouts?status=neq.paid&scheduled_for=lte.${new Date().toISOString()}&select=*`, { headers })
      if (!res.ok) return J({ success: false, error: 'Could not read the schedule.' }, 502)
      const due = await res.json()
      return J({ success: true, due_count: due.length, due,
        note: due.length
          ? `${due.length} payout(s) are due. Nothing has been paid — mark each one once the money has actually gone.`
          : 'Nothing is due right now.' })
    }

    if (action === 'get_referral_code') {
      const res = await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}&select=referral_code`, { headers })
      const data = await res.json()
      return new Response(JSON.stringify({ referral_code: data[0]?.referral_code || '' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'get_referrals') {
      const res = await fetch(`${supabaseUrl}/rest/v1/referrals?referrer_id=eq.${investor_id}&select=*,referred:referred_id(full_name,email)`, { headers })
      const referrals = await res.json()
      return new Response(JSON.stringify({ referrals: referrals || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'get_rewards') {
      const res = await fetch(`${supabaseUrl}/rest/v1/referral_rewards?investor_id=eq.${investor_id}&select=*`, { headers })
      const rewards = await res.json()
      const total = rewards?.filter((r: any) => r.reward_type === 'credit' && r.status === 'applied').reduce((s: number, r: any) => s + parseFloat(r.amount || 0), 0) || 0
      return new Response(JSON.stringify({ rewards: rewards || [], total_credits: total }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'track_signup') {
      // Find referrer by code
      const refRes = await fetch(`${supabaseUrl}/rest/v1/investors?referral_code=eq.${referral_code}&select=id`, { headers })
      const referrers = await refRes.json()
      if (referrers?.length) {
        await fetch(`${supabaseUrl}/rest/v1/referrals`, { method: 'POST', headers, body: JSON.stringify({ referrer_id: referrers[0].id, referred_id: new_investor_id, status: 'signed_up' }) })
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'claim_reward') {
      await fetch(`${supabaseUrl}/rest/v1/referral_rewards?id=eq.${reward_id}`, { method: 'PATCH', headers, body: JSON.stringify({ reward_type, status: reward_type === 'credit' ? 'applied' : 'processing' }) })
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) { return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
})
