import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json()
    const { action, investor_id, referral_code, new_investor_id, reward_id, reward_type } = body
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!, supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' }

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
