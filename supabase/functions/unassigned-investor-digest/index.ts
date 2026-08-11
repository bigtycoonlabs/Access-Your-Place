// PostgREST on this project exposes ONLY the public schema, so forcing
// Accept-Profile: prj_X-ZoVQv6LKXT made every REST call in this function return
// 406 PGRST106 'Invalid schema'. Every prj_ table has a matching public view.
const DATA_SCHEMA = 'public';
const originalFetch = globalThis.fetch;
globalThis.fetch = (input: any, init: any = {}) => {
  const url = typeof input === 'string'
    ? input
    : input?.url?.toString?.() || input?.toString?.() || '';

  if (url.includes('/rest/v1/')) {
    const headers = new Headers(init.headers || {});
    headers.set('Accept-Profile', DATA_SCHEMA);
    headers.set('Content-Profile', DATA_SCHEMA);
    init = { ...init, headers };
  }

  return originalFetch(input, init);
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const resendKey = Deno.env.get('RESEND_API_KEY');

  const getHeaders = { 'Accept': 'application/json', 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };

  const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // Get unassigned investors with wait times
    const invRes = await fetch(`${supabaseUrl}/rest/v1/investors?select=id,full_name,email,phone,created_at,onboarding_completed,account_funded&assigned_acquisition_manager_id=is.null&order=created_at.asc`, { headers: getHeaders });
    const unassigned = await invRes.json();
    const investors = Array.isArray(unassigned) ? unassigned : [];

    const now = new Date();
    const enriched = investors.map((inv: any) => {
      const created = new Date(inv.created_at);
      const waitHours = Math.round((now.getTime() - created.getTime()) / (1000 * 60 * 60));
      return { ...inv, wait_hours: waitHours, is_escalated: waitHours > 48 };
    });

    const escalated = enriched.filter((i: any) => i.is_escalated);
    const normal = enriched.filter((i: any) => !i.is_escalated);

    if (action === 'get_summary') {
      return json({
        success: true,
        total_unassigned: enriched.length,
        escalated_count: escalated.length,
        normal_count: normal.length,
        investors: enriched,
        escalated_investors: escalated
      });
    }

    // Send daily digest email
    if (action === 'send_digest' || !action) {
      if (!resendKey) return json({ success: false, error: 'Email not configured' });
      if (enriched.length === 0) return json({ success: true, message: 'No unassigned investors, no digest needed', sent: 0 });

      // Get success team members
      const staffRes = await fetch(`${supabaseUrl}/rest/v1/staff_users?select=id,email,first_name,last_name,department,roles&is_active=eq.true`, { headers: getHeaders });
      const allStaff = await staffRes.json();
      const successTeam = (Array.isArray(allStaff) ? allStaff : []).filter((s: any) =>
        s.department === 'success_managers' || (s.roles && s.roles.includes('success_managers'))
      );

      if (successTeam.length === 0) return json({ success: true, message: 'No success team members found', sent: 0 });

      // Build email HTML
      const escalatedRows = escalated.map((inv: any) => `
        <tr style="background-color: #fef2f2;">
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #dc2626;">${inv.full_name || 'Unknown'}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${inv.email}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${inv.phone || '-'}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #dc2626; font-weight: 600;">${inv.wait_hours}h</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${inv.account_funded ? 'Yes' : 'No'}</td>
        </tr>
      `).join('');

      const normalRows = normal.map((inv: any) => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${inv.full_name || 'Unknown'}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${inv.email}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${inv.phone || '-'}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${inv.wait_hours}h</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${inv.account_funded ? 'Yes' : 'No'}</td>
        </tr>
      `).join('');

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1a365d, #2d4a7c); padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">Unassigned Investors Daily Digest</h1>
            <p style="color: #d4a574; margin: 8px 0 0; font-size: 14px;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          
          <div style="padding: 24px; background: white; border: 1px solid #e5e7eb;">
            <div style="display: flex; gap: 16px; margin-bottom: 24px;">
              <div style="flex: 1; background: #fef2f2; padding: 16px; border-radius: 8px; text-align: center;">
                <p style="font-size: 28px; font-weight: 700; color: #dc2626; margin: 0;">${escalated.length}</p>
                <p style="font-size: 12px; color: #991b1b; margin: 4px 0 0;">ESCALATED (48h+)</p>
              </div>
              <div style="flex: 1; background: #fffbeb; padding: 16px; border-radius: 8px; text-align: center;">
                <p style="font-size: 28px; font-weight: 700; color: #d97706; margin: 0;">${enriched.length}</p>
                <p style="font-size: 12px; color: #92400e; margin: 4px 0 0;">TOTAL UNASSIGNED</p>
              </div>
            </div>

            ${escalated.length > 0 ? `
              <div style="margin-bottom: 24px;">
                <h3 style="color: #dc2626; font-size: 16px; margin-bottom: 8px;">ESCALATED - Waiting 48+ Hours</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                  <thead>
                    <tr style="background: #fef2f2;">
                      <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #fca5a5;">Name</th>
                      <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #fca5a5;">Email</th>
                      <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #fca5a5;">Phone</th>
                      <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #fca5a5;">Wait Time</th>
                      <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #fca5a5;">Funded</th>
                    </tr>
                  </thead>
                  <tbody>${escalatedRows}</tbody>
                </table>
              </div>
            ` : ''}

            ${normal.length > 0 ? `
              <div>
                <h3 style="color: #d97706; font-size: 16px; margin-bottom: 8px;">Waiting for Assignment</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                  <thead>
                    <tr style="background: #f9fafb;">
                      <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Name</th>
                      <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Email</th>
                      <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Phone</th>
                      <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Wait Time</th>
                      <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Funded</th>
                    </tr>
                  </thead>
                  <tbody>${normalRows}</tbody>
                </table>
              </div>
            ` : ''}

            <div style="margin-top: 24px; padding: 16px; background: #f0fdf4; border-radius: 8px; text-align: center;">
              <a href="https://accessyourplace.com/staff" style="display: inline-block; background: #1a365d; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Open Staff Dashboard</a>
            </div>
          </div>
          
          <div style="padding: 16px; text-align: center; font-size: 12px; color: #9ca3af;">
            <p>Access Your Place - Staff Dashboard</p>
          </div>
        </div>
      `;

      // Send to each success team member
      let sent = 0;
      for (const staff of successTeam) {
        try {
          const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'AYP Staff <notifications@accessyourplace.com>',
              to: [staff.email],
              subject: `${escalated.length > 0 ? '[ESCALATED] ' : ''}${enriched.length} Unassigned Investors - Daily Digest`,
              html: emailHtml
            })
          });
          if (emailRes.ok) sent++;
        } catch (e) {
          console.error(`Failed to send to ${staff.email}:`, e);
        }
      }

      return json({ success: true, sent, total_recipients: successTeam.length, unassigned_count: enriched.length, escalated_count: escalated.length });
    }

    // Send reminder for specific investor
    if (action === 'send_escalation_alert') {
      const { investor_id } = body;
      if (!investor_id || !resendKey) return json({ success: false, error: 'Missing data' });

      const invRes2 = await fetch(`${supabaseUrl}/rest/v1/investors?select=*&id=eq.${investor_id}`, { headers: getHeaders });
      const invData = await invRes2.json();
      const inv = Array.isArray(invData) ? invData[0] : null;
      if (!inv) return json({ success: false, error: 'Investor not found' });

      const waitHours = Math.round((now.getTime() - new Date(inv.created_at).getTime()) / (1000 * 60 * 60));

      // Get success team
      const staffRes2 = await fetch(`${supabaseUrl}/rest/v1/staff_users?select=email,first_name&department=eq.success_managers&is_active=eq.true`, { headers: getHeaders });
      const team = await staffRes2.json();
      const emails = (Array.isArray(team) ? team : []).map((s: any) => s.email).filter(Boolean);

      if (emails.length === 0) return json({ success: false, error: 'No success team emails' });

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'AYP Alerts <notifications@accessyourplace.com>',
          to: emails,
          subject: `[URGENT] Investor ${inv.full_name || inv.email} waiting ${waitHours}h for AM assignment`,
          html: `<p><strong>${inv.full_name || 'Unknown'}</strong> (${inv.email}) has been waiting <strong>${waitHours} hours</strong> for an Acquisition Manager assignment.</p><p>Please assign an AM immediately.</p><p><a href="https://accessyourplace.com/staff">Open Dashboard</a></p>`
        })
      });

      return json({ success: true, message: `Escalation alert sent for ${inv.full_name || inv.email}` });
    }

    return json({ success: false, error: 'Unknown action' });
  } catch (error: any) {
    console.error('[unassigned-investor-digest] Error:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
