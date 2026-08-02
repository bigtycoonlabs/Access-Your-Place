import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Accept-Profile': 'public',
      'Content-Profile': 'public',
    }

    const body = await req.json().catch(() => ({}))

    // SECURITY: this endpoint was previously UNAUTHENTICATED and returned up to 100 lead
    // records (name/email/phone PII) to any caller. Require an active staff user before
    // returning anything. (The HR/commission/time-tracker actions the admin UI calls -
    // get_staff_list, get_active_timer, get_time_stats, etc. - are not implemented in this
    // legacy stub and still need a proper rebuild; this change only closes the data leak.)
    const staffId = String(body.staff_id || body.staffId || '')
    if (!staffId) return json({ success: false, error: 'Staff identity required' }, 401)
    const staffRes = await fetch(
      `${supabaseUrl}/rest/v1/staff_users?id=eq.${encodeURIComponent(staffId)}&is_active=eq.true&select=id&limit=1`,
      { headers },
    )
    const staffRows = await staffRes.json()
    if (!Array.isArray(staffRows) || !staffRows[0]) {
      return json({ success: false, error: 'Staff access required' }, 403)
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/leads?order=created_at.desc&limit=100`,
      { headers },
    )
    const leads = await response.json()
    return json({ leads: Array.isArray(leads) ? leads : [] })
  } catch (error) {
    return json({ leads: [], error: error instanceof Error ? error.message : 'error' }, 500)
  }
})
