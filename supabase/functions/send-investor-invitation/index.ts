const DATA_SCHEMA = 'prj_X-ZoVQv6LKXT';
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
// send-investor-invitation v25.0 - Add get_my_leads + staff tracking on leads
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const SUPPORT_EMAIL = 'success@accessyourplace.com';
const BASE_URL = 'https://accessyourplace.com';
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 200;

function getDbHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey };
}

async function dbQuery(table: string, params: string = ''): Promise<any> {
  const url = supabaseUrl + '/rest/v1/' + table + '?' + params;
  const response = await fetch(url, { method: 'GET', headers: getDbHeaders() });
  const text = await response.text();
  try { const data = JSON.parse(text); if (data && data.code && data.message) return []; return data; } catch { return []; }
}

async function dbInsert(table: string, data: any): Promise<any> {
  const url = supabaseUrl + '/rest/v1/' + table;
  const hdrs = getDbHeaders(); hdrs['Prefer'] = 'return=representation';
  const response = await fetch(url, { method: 'POST', headers: hdrs, body: JSON.stringify(data) });
  const text = await response.text();
  console.log(`[v25.0] dbInsert ${table} status=${response.status} body=${text.substring(0, 200)}`);
  try { return JSON.parse(text); } catch { return null; }
}

async function dbUpdate(table: string, filter: string, data: any): Promise<any> {
  const url = supabaseUrl + '/rest/v1/' + table + '?' + filter;
  const hdrs = getDbHeaders(); hdrs['Prefer'] = 'return=representation';
  const response = await fetch(url, { method: 'PATCH', headers: hdrs, body: JSON.stringify(data) });
  const text = await response.text();
  try { return JSON.parse(text); } catch { return null; }
}

async function dbDelete(table: string, filter: string): Promise<any> {
  const url = supabaseUrl + '/rest/v1/' + table + '?' + filter;
  const hdrs = getDbHeaders(); hdrs['Prefer'] = 'return=representation';
  const response = await fetch(url, { method: 'DELETE', headers: hdrs });
  const text = await response.text();
  try { return JSON.parse(text); } catch { return null; }
}

function generateInviteCode(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return (timestamp + randomPart).toUpperCase();
}

function buildSignupUrl(inviteCode: string, includeTab: boolean = true): string {
  if (includeTab) return BASE_URL + '/investor/login?tab=register&ref=' + inviteCode;
  return BASE_URL + '/investor/login?ref=' + inviteCode;
}

async function sendTwilioSMS(to: string, message: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
  if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) return { success: false, error: 'SMS not configured' };
  try {
    const twilioUrl = 'https://api.twilio.com/2010-04-01/Accounts/' + twilioAccountSid + '/Messages.json';
    const auth = btoa(twilioAccountSid + ':' + twilioAuthToken);
    const formBody = 'To=' + encodeURIComponent(to) + '&From=' + encodeURIComponent(twilioPhoneNumber) + '&Body=' + encodeURIComponent(message);
    const response = await fetch(twilioUrl, { method: 'POST', headers: { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' }, body: formBody });
    const result = await response.json();
    if (response.ok && result.sid) return { success: true, sid: result.sid };
    return { success: false, error: result.message || 'SMS failed' };
  } catch (e: any) { return { success: false, error: e.message || 'SMS error' }; }
}

async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; id?: string; error?: string }> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) return { success: false, error: 'Email not configured' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Access Your Place <invitations@accessyourplace.com>', to: [to], subject, html })
    });
    const result = await res.json();
    if (!res.ok) {
      console.log(`[v25.0] sendEmail FAILED to=${to} status=${res.status} error=${JSON.stringify(result)}`);
      return { success: false, error: result.message || 'Email failed' };
    }
    console.log(`[v25.0] sendEmail SUCCESS to=${to} id=${result.id}`);
    dbInsert('email_logs', { template_type: 'investor_invitation', recipient_email: to, subject, status: 'sent', resend_id: result.id }).catch(() => {});
    return { success: true, id: result.id };
  } catch (err: any) { return { success: false, error: err.message }; }
}

function buildInvitationEmailHtml(firstName: string, signupLink: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f8fafc;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;"><tr><td align="center" style="padding:40px 20px;"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;"><tr><td style="background:linear-gradient(135deg,#1e3a5f,#2d5a87);padding:40px;text-align:center;border-radius:12px 12px 0 0;"><div style="background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:12px;width:70px;height:70px;margin:0 auto;line-height:70px;"><span style="color:#fff;font-size:24px;font-weight:bold;">AYP</span></div><h1 style="color:#f59e0b;margin:20px 0 0;font-size:28px;">Access Your Place</h1></td></tr><tr><td style="padding:40px;background:#fff;border:1px solid #e2e8f0;"><h2 style="color:#1e3a5f;">Hi ${firstName}!</h2><p style="color:#475569;line-height:1.8;">You've been invited to join <strong>Access Your Place</strong>.</p><table width="100%"><tr><td align="center" style="padding:20px 0;"><a href="${signupLink}" style="background:#f59e0b;border-radius:8px;color:#fff;display:inline-block;font-size:16px;font-weight:bold;line-height:54px;text-align:center;text-decoration:none;width:280px;">Create Your Free Account</a></td></tr></table></td></tr><tr><td style="background:#f1f5f9;padding:20px;text-align:center;border-radius:0 0 12px 12px;"><p style="color:#64748b;font-size:12px;">&copy; ${new Date().getFullYear()} Access Your Place</p></td></tr></table></td></tr></table></body></html>`;
}

function buildAMWelcomeEmailHtml(amName: string, mentorName: string, loginUrl: string): string {
  const deadlineDate = new Date(); deadlineDate.setMonth(deadlineDate.getMonth() + 4);
  const deadlineStr = deadlineDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0f172a;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;"><tr><td align="center" style="padding:40px 20px;"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:700px;"><tr><td style="background:linear-gradient(135deg,#1e3a5f 0%,#0f172a 100%);padding:50px 40px;text-align:center;border-radius:16px 16px 0 0;border:1px solid #334155;"><div style="background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:16px;width:80px;height:80px;margin:0 auto;line-height:80px;"><span style="color:#fff;font-size:28px;font-weight:bold;">AYP</span></div><h1 style="color:#f59e0b;margin:24px 0 8px;font-size:32px;">Welcome to the Command Center</h1></td></tr><tr><td style="padding:40px;background:#1e293b;border:1px solid #334155;"><h2 style="color:#e2e8f0;">Dear ${amName},</h2><p style="color:#94a3b8;line-height:1.8;">Welcome to <strong style="color:#f59e0b;">Access Your Place</strong>.</p><p style="color:#94a3b8;">Mentorship: Shadow <strong style="color:#f59e0b;">${mentorName}</strong>. Commission: 50/50 split. Deadline: <strong style="color:#ef4444;">${deadlineStr}</strong></p><table width="100%"><tr><td align="center" style="padding:24px 0;"><a href="${loginUrl}" style="background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:10px;color:#fff;display:inline-block;font-size:18px;font-weight:bold;line-height:60px;text-align:center;text-decoration:none;width:320px;">Login to Staff Dashboard</a></td></tr></table></td></tr><tr><td style="background:#0f172a;padding:20px;text-align:center;border-radius:0 0 16px 16px;border:1px solid #334155;"><p style="color:#64748b;font-size:12px;">&copy; ${new Date().getFullYear()} Access Your Place</p></td></tr></table></td></tr></table></body></html>`;
}

function buildAMAgreementEmailHtml(amFirstName: string, amLastName: string, amEmail: string, agreementDate: string, agreementId?: string): string {
  const fullName = `${amFirstName} ${amLastName}`;
  const now = new Date();
  const day = now.getDate();
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const month = monthNames[now.getMonth()];
  const year = now.getFullYear();
  const signUrl = agreementId ? `${BASE_URL}/am-agreement/${agreementId}` : `${BASE_URL}/staff/login`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;font-family:'Georgia',serif;background:#f8fafc;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;"><tr><td align="center" style="padding:40px 20px;"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:750px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="background:#1e3a5f;padding:30px 40px;text-align:center;"><h1 style="color:#fff;margin:0;font-size:22px;">ACQUISITION MANAGER SERVICE AGREEMENT</h1></td></tr><tr><td style="padding:40px;line-height:1.8;color:#334155;font-size:14px;"><p>THIS AGREEMENT is made on <strong>${day}</strong> ${month}, ${year}, between Set Up Your Place LLC and <strong>${fullName}</strong> (${amEmail}).</p><div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:20px;margin:24px 0;text-align:center;"><p style="color:#92400e;font-weight:bold;font-size:16px;margin:0 0 12px;">DIGITAL SIGNATURE REQUIRED</p><a href="${signUrl}" style="background:#f59e0b;border-radius:8px;color:#fff;display:inline-block;font-size:16px;font-weight:bold;line-height:50px;text-align:center;text-decoration:none;width:260px;">Review &amp; Sign Agreement</a></div></td></tr><tr><td style="background:#f1f5f9;padding:20px;text-align:center;"><p style="color:#64748b;font-size:12px;">&copy; ${year} Set Up Your Place LLC</p></td></tr></table></td></tr></table></body></html>`;
}

function buildSignatureConfirmationHtml(amName: string, signedAt: string, signatureHash: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f8fafc;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;"><tr><td align="center" style="padding:40px 20px;"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;"><tr><td style="background:#1e3a5f;padding:30px;text-align:center;border-radius:12px 12px 0 0;"><h1 style="color:#10b981;margin:0;font-size:24px;">Agreement Signed Successfully</h1></td></tr><tr><td style="padding:30px;background:#fff;border:1px solid #e2e8f0;"><p style="color:#334155;">Dear ${amName},</p><p style="color:#334155;">Your AM Service Agreement has been digitally signed.</p><div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin:16px 0;"><p style="margin:4px 0;color:#166534;"><strong>Signed:</strong> ${signedAt}</p><p style="margin:4px 0;color:#166534;"><strong>Hash:</strong> ${signatureHash.substring(0, 16)}...</p></div></td></tr><tr><td style="background:#f1f5f9;padding:20px;text-align:center;border-radius:0 0 12px 12px;"><p style="color:#64748b;font-size:12px;">&copy; ${new Date().getFullYear()} Access Your Place</p></td></tr></table></td></tr></table></body></html>`;
}

function computeTraineeProgress(trainee: any): { completion_percentage: number; days_since_start: number | null; days_until_deadline: number | null } {
  const now = new Date();
  let days_since_start: number | null = null;
  if (trainee.trainee_start_date) { days_since_start = Math.floor((now.getTime() - new Date(trainee.trainee_start_date).getTime()) / (1000 * 60 * 60 * 24)); }
  let days_until_deadline: number | null = null;
  if (trainee.certification_deadline) { days_until_deadline = Math.floor((new Date(trainee.certification_deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)); }
  const p1 = Math.min(((trainee.pillar_1_deals_approved || 0) / 3) * 100, 100);
  const p2 = Math.min(Math.min((trainee.pillar_2_leads_generated || 0) / 3, 1) * 60 + Math.min((trainee.pillar_2_leads_closed || 0) / 2, 1) * 40, 100);
  const p3 = Math.min(((trainee.pillar_3_full_cycles || 0) / 3) * 100, 100);
  let p4 = 0;
  if (trainee.pillar_4_exam_passed) p4 = 100;
  else if (trainee.pillar_4_exam_score) p4 = Math.min((trainee.pillar_4_exam_score / 90) * 100, 100);
  return { completion_percentage: Math.round((p1 + p2 + p3 + p4) / 4), days_since_start, days_until_deadline };
}

async function getContactTags(invitationIds: string[] = []): Promise<Map<string, any[]>> {
  const tagMap = new Map<string, any[]>();
  if (invitationIds.length === 0) return tagMap;
  const idList = invitationIds.map(id => `"${id}"`).join(',');
  const assignments = await dbQuery('investor_tag_assignments', `invitation_id=in.(${idList})&select=invitation_id,tag_id`);
  if (Array.isArray(assignments) && assignments.length > 0) {
    const tagIds = [...new Set(assignments.map((a: any) => a.tag_id))];
    const tags = await dbQuery('investor_tags', `id=in.(${tagIds.map(id => `"${id}"`).join(',')})&select=*`);
    const tagLookup = new Map(tags.map((t: any) => [t.id, t]));
    for (const a of assignments) { const key = 'inv_' + a.invitation_id; if (!tagMap.has(key)) tagMap.set(key, []); const tag = tagLookup.get(a.tag_id); if (tag) tagMap.get(key)!.push(tag); }
  }
  return tagMap;
}

async function sendSingleInvitation(contact: any, channel: string): Promise<{ sent: boolean; smsSent?: boolean; emailSent?: boolean; error?: string }> {
  const firstName = String(contact.name || '').split(' ')[0] || 'there';
  const inviteCode = generateInviteCode();
  let smsSent = false; let emailSent = false; let lastError = '';
  if (contact.phone && (channel === 'sms' || channel === 'both')) {
    const signupLink = buildSignupUrl(inviteCode, false);
    const smsResult = await sendTwilioSMS(contact.phone, 'Hi ' + firstName + '! You are invited to join Access Your Place. Create your free account: ' + signupLink + ' - The AYP Team');
    if (smsResult.success) { dbUpdate('investor_invitations', `id=eq.${contact.id}`, { invite_code: inviteCode, channel: 'sms', status: 'sent', delivery_status: 'queued', twilio_sid: smsResult.sid, sent_at: new Date().toISOString() }).catch(() => {}); smsSent = true; }
    else { lastError = smsResult.error || 'SMS failed'; }
  }
  if (contact.email && (channel === 'email' || channel === 'both')) {
    const eic = smsSent ? generateInviteCode() : inviteCode;
    const emailResult = await sendEmail(contact.email, "You're Invited to Access Your Place!", buildInvitationEmailHtml(firstName, buildSignupUrl(eic, true)));
    if (emailResult.success) { if (!smsSent) dbUpdate('investor_invitations', `id=eq.${contact.id}`, { invite_code: eic, channel: 'email', status: 'sent', delivery_status: 'delivered', resend_id: emailResult.id, sent_at: new Date().toISOString(), delivered_at: new Date().toISOString() }).catch(() => {}); emailSent = true; }
    else { lastError = emailResult.error || 'Email failed'; }
  }
  const sent = smsSent || emailSent;
  if (!sent && lastError) dbUpdate('investor_invitations', `id=eq.${contact.id}`, { status: 'failed', delivery_status: 'failed', error_message: lastError }).catch(() => {});
  return { sent, smsSent, emailSent, error: sent ? undefined : lastError };
}

async function sendInvitationsInBatches(contacts: any[], channel: string): Promise<{ sent: number; failed: number; results: any[] }> {
  let sentCount = 0; let failedCount = 0; const results: any[] = [];
  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(async (contact) => {
      try { const result = await sendSingleInvitation(contact, channel); if (result.sent) { sentCount++; return { name: contact.name, status: 'sent', smsSent: result.smsSent, emailSent: result.emailSent }; } else { failedCount++; return { name: contact.name, status: 'failed', error: result.error }; } }
      catch (err: any) { failedCount++; return { name: contact.name, status: 'failed', error: err.message }; }
    }));
    results.push(...batchResults);
    if (i + BATCH_SIZE < contacts.length) await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
  }
  return { sent: sentCount, failed: failedCount, results };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'send';

    // ==================== v25.0: GET MY LEADS (for AM dashboard) ====================
    if (action === 'get_my_leads') {
      const { staff_id } = body;
      if (!staff_id) return new Response(JSON.stringify({ success: false, error: 'staff_id required' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      
      // Get all leads added by this staff member
      const leads = await dbQuery('investor_invitations', `added_by_staff_id=eq.${staff_id}&select=*&order=created_at.desc&limit=200`);
      const leadList = Array.isArray(leads) ? leads : [];
      
      // Calculate stats
      const stats = {
        total: leadList.length,
        pending: leadList.filter((l: any) => l.status === 'pending').length,
        sent: leadList.filter((l: any) => l.status === 'sent' || l.delivery_status === 'queued' || l.delivery_status === 'delivered').length,
        signed_up: leadList.filter((l: any) => l.signed_up_at || l.investor_id).length,
        failed: leadList.filter((l: any) => l.status === 'failed' || l.delivery_status === 'failed').length
      };
      
      console.log(`[v25.0] get_my_leads: staff_id=${staff_id} found=${leadList.length} pending=${stats.pending} sent=${stats.sent} signed_up=${stats.signed_up}`);
      return new Response(JSON.stringify({ success: true, leads: leadList, stats }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // ==================== GET AGREEMENT FOR SIGNING ====================
    if (action === 'get_agreement_for_signing') {
      const { agreement_id } = body;
      if (!agreement_id) return new Response(JSON.stringify({ success: false, error: 'agreement_id required' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      const agreements = await dbQuery('am_agreements', `id=eq.${agreement_id}&select=*`);
      const agreement = Array.isArray(agreements) && agreements.length > 0 ? agreements[0] : null;
      if (!agreement) return new Response(JSON.stringify({ success: false, error: 'Agreement not found.' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      if (agreement.status === 'sent') { await dbUpdate('am_agreements', `id=eq.${agreement_id}`, { status: 'viewed', viewed_at: new Date().toISOString() }); agreement.status = 'viewed'; }
      return new Response(JSON.stringify({ success: true, agreement }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // ==================== SIGN AGREEMENT ====================
    if (action === 'sign_agreement') {
      const { agreement_id, signature_text, signature_ip, user_agent } = body;
      if (!agreement_id || !signature_text) return new Response(JSON.stringify({ success: false, error: 'agreement_id and signature_text required' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      const agreements = await dbQuery('am_agreements', `id=eq.${agreement_id}&select=*`);
      const agreement = Array.isArray(agreements) && agreements.length > 0 ? agreements[0] : null;
      if (!agreement) return new Response(JSON.stringify({ success: false, error: 'Agreement not found' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      if (agreement.status === 'signed') return new Response(JSON.stringify({ success: false, error: 'Already signed' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      if (agreement.status === 'voided' || agreement.status === 'expired') return new Response(JSON.stringify({ success: false, error: 'Agreement is ' + agreement.status }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      const signedAt = new Date().toISOString();
      const hashData = new TextEncoder().encode(`${agreement_id}:${signature_text}:${signedAt}:${signature_ip || 'unknown'}`);
      const hashBuffer = await crypto.subtle.digest('SHA-256', hashData);
      const signatureHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      await dbUpdate('am_agreements', `id=eq.${agreement_id}`, { status: 'signed', signed_at: signedAt, signature_text, signature_ip: signature_ip || 'unknown', signer_user_agent: user_agent || 'unknown', signature_hash: signatureHash, agreement_version: '1.0' });
      sendEmail(agreement.am_email, 'AM Service Agreement - Signed Successfully', buildSignatureConfirmationHtml(agreement.am_name, new Date(signedAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' }), signatureHash)).catch(() => {});
      const smList = await dbQuery('staff_users', `department=eq.success_managers&is_active=eq.true&select=email`);
      if (Array.isArray(smList)) { for (const sm of smList) { if (sm.email) sendEmail(sm.email, `AM Agreement Signed: ${agreement.am_name}`, `<p><strong>${agreement.am_name}</strong> signed their AM Service Agreement at ${new Date(signedAt).toLocaleString()}. Hash: ${signatureHash.substring(0, 16)}...</p>`).catch(() => {}); } }
      return new Response(JSON.stringify({ success: true, signed_at: signedAt, signature_hash: signatureHash }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // ==================== SEND AM WELCOME EMAIL ====================
    if (action === 'send_am_welcome_email') {
      const { staff_id, am_name, am_email, mentor_name, mentor_id } = body;
      console.log(`[v25.0] send_am_welcome_email: staff_id=${staff_id} am_name=${am_name} am_email=${am_email}`);
      if (!am_email || !am_name) return new Response(JSON.stringify({ success: false, error: 'am_email and am_name required' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      const finalMentorName = mentor_name || 'Your Assigned Mentor (TBD)';
      const emailResult = await sendEmail(am_email, 'Welcome to the Command Center: Your Path to YP Certification', buildAMWelcomeEmailHtml(am_name, finalMentorName, BASE_URL + '/staff/login'));
      dbInsert('email_logs', { template_type: 'am_welcome', recipient_email: am_email, subject: 'Welcome to the Command Center', status: emailResult.success ? 'sent' : 'failed' }).catch(() => {});
      let agreementCreated = false; let agreementId: string | null = null;
      if (staff_id) {
        const traineeStartDate = new Date().toISOString();
        const certDeadline = new Date(); certDeadline.setMonth(certDeadline.getMonth() + 4);
        await dbUpdate('staff_users', `id=eq.${staff_id}`, { trainee_status: 'active', trainee_start_date: traineeStartDate, certification_deadline: certDeadline.toISOString(), assigned_mentor_id: mentor_id || null, assigned_mentor_name: finalMentorName, commission_split: 50, welcome_email_sent: true, pillar_1_deals_approved: 0, pillar_2_leads_generated: 0, pillar_2_leads_closed: 0, pillar_3_full_cycles: 0, pillar_4_exam_score: null, pillar_4_exam_passed: false });
        try {
          const agreementResult = await dbInsert('am_agreements', { staff_id, am_name, am_email, mentor_id: mentor_id || null, mentor_name: finalMentorName, status: 'sent', sent_at: traineeStartDate });
          if (Array.isArray(agreementResult) && agreementResult[0]?.id) { agreementId = agreementResult[0].id; agreementCreated = true; }
          else if (agreementResult?.id) { agreementId = agreementResult.id; agreementCreated = true; }
        } catch (e: any) { console.error(`[v25.0] Agreement insert error: ${e.message}`); }
        const nameParts = am_name.split(' ');
        await sendEmail(am_email, 'Your AM Service Agreement - Access Your Place', buildAMAgreementEmailHtml(nameParts[0] || am_name, nameParts.slice(1).join(' ') || '', am_email, traineeStartDate, agreementId || undefined));
        dbUpdate('staff_users', `id=eq.${staff_id}`, { agreement_email_sent: true }).catch(() => {});
        const tasks = [
          { pillar_number: 1, pillar_name: 'Market Mastery', task_description: 'Submit qualified deal #1', task_type: 'deal_submission' },
          { pillar_number: 1, pillar_name: 'Market Mastery', task_description: 'Submit qualified deal #2', task_type: 'deal_submission' },
          { pillar_number: 1, pillar_name: 'Market Mastery', task_description: 'Submit qualified deal #3', task_type: 'deal_submission' },
          { pillar_number: 2, pillar_name: 'Rainmaker', task_description: 'Generate investor lead #1', task_type: 'lead_generation' },
          { pillar_number: 2, pillar_name: 'Rainmaker', task_description: 'Generate investor lead #2', task_type: 'lead_generation' },
          { pillar_number: 2, pillar_name: 'Rainmaker', task_description: 'Generate investor lead #3', task_type: 'lead_generation' },
          { pillar_number: 2, pillar_name: 'Rainmaker', task_description: 'Close investor lead #1', task_type: 'lead_close' },
          { pillar_number: 2, pillar_name: 'Rainmaker', task_description: 'Close investor lead #2', task_type: 'lead_close' },
          { pillar_number: 3, pillar_name: 'Consultant', task_description: 'Complete full-cycle transaction #1', task_type: 'full_cycle' },
          { pillar_number: 3, pillar_name: 'Consultant', task_description: 'Complete full-cycle transaction #2', task_type: 'full_cycle' },
          { pillar_number: 3, pillar_name: 'Consultant', task_description: 'Complete full-cycle transaction #3', task_type: 'full_cycle' },
          { pillar_number: 4, pillar_name: 'Technical Proficiency', task_description: 'Pass Final Certification Exam (90%+)', task_type: 'exam' }
        ];
        for (const task of tasks) { dbInsert('certification_progress', { staff_id, ...task }).catch(() => {}); }
      }
      return new Response(JSON.stringify({ success: emailResult.success, email_sent: emailResult.success, agreement_created: agreementCreated, agreement_id: agreementId }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // ==================== GET AM AGREEMENTS ====================
    if (action === 'get_am_agreements') {
      const agreements = await dbQuery('am_agreements', 'select=*&order=sent_at.desc');
      return new Response(JSON.stringify({ success: true, agreements: Array.isArray(agreements) ? agreements : [] }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (action === 'void_agreement') { const { agreement_id, voided_by } = body; if (!agreement_id) return new Response(JSON.stringify({ success: false, error: 'agreement_id required' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); await dbUpdate('am_agreements', `id=eq.${agreement_id}`, { status: 'voided', voided_at: new Date().toISOString(), voided_by: voided_by || null }); return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'resend_agreement') { const { agreement_id } = body; if (!agreement_id) return new Response(JSON.stringify({ success: false, error: 'agreement_id required' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); const agreements = await dbQuery('am_agreements', `id=eq.${agreement_id}&select=*`); const agreement = Array.isArray(agreements) && agreements.length > 0 ? agreements[0] : null; if (!agreement) return new Response(JSON.stringify({ success: false, error: 'Not found' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); const nameParts = (agreement.am_name || '').split(' '); const emailResult = await sendEmail(agreement.am_email, 'Your AM Service Agreement (Resent)', buildAMAgreementEmailHtml(nameParts[0], nameParts.slice(1).join(' '), agreement.am_email, new Date().toISOString(), agreement_id)); if (emailResult.success) await dbUpdate('am_agreements', `id=eq.${agreement_id}`, { status: 'sent', sent_at: new Date().toISOString(), resend_count: (agreement.resend_count || 0) + 1 }); return new Response(JSON.stringify({ success: emailResult.success }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'update_agreement_status') { const { agreement_id, status } = body; if (!agreement_id || !status) return new Response(JSON.stringify({ success: false, error: 'agreement_id and status required' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); const updateData: any = { status }; if (status === 'viewed') updateData.viewed_at = new Date().toISOString(); if (status === 'signed') updateData.signed_at = new Date().toISOString(); await dbUpdate('am_agreements', `id=eq.${agreement_id}`, updateData); return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }

    // ==================== TRAINEE PROGRESS ====================
    if (action === 'get_trainee_progress') { const { staff_id } = body; if (!staff_id) return new Response(JSON.stringify({ success: false, error: 'staff_id required' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); const staffData = await dbQuery('staff_users', `id=eq.${staff_id}&select=*`); const tasks = await dbQuery('certification_progress', `staff_id=eq.${staff_id}&select=*&order=pillar_number,created_at`); return new Response(JSON.stringify({ success: true, progress: Array.isArray(staffData) ? staffData[0] : null, tasks: Array.isArray(tasks) ? tasks : [] }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'update_trainee_progress') { const { staff_id, updates, task_id } = body; if (!staff_id) return new Response(JSON.stringify({ success: false, error: 'staff_id required' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); if (task_id) await dbUpdate('certification_progress', `id=eq.${task_id}`, { completed: true, completed_at: new Date().toISOString(), verified_by: body.verified_by || null, verified_by_name: body.verified_by_name || null, notes: body.notes || null }); if (updates) { const allowedFields = ['pillar_1_deals_approved','pillar_2_leads_generated','pillar_2_leads_closed','pillar_3_full_cycles','pillar_4_exam_score','pillar_4_exam_passed','trainee_status','yp_certified','commission_split','assigned_mentor_id','assigned_mentor_name']; const safeUpdates: any = {}; for (const key of allowedFields) { if (updates[key] !== undefined) safeUpdates[key] = updates[key]; } const currentData = await dbQuery('staff_users', `id=eq.${staff_id}&select=pillar_1_deals_approved,pillar_2_leads_generated,pillar_2_leads_closed,pillar_3_full_cycles,pillar_4_exam_passed`); const merged = { ...(Array.isArray(currentData) ? currentData[0] : {}), ...safeUpdates }; if (merged.pillar_1_deals_approved >= 3 && merged.pillar_2_leads_generated >= 3 && merged.pillar_2_leads_closed >= 2 && merged.pillar_3_full_cycles >= 3 && merged.pillar_4_exam_passed === true) { safeUpdates.trainee_status = 'certified'; safeUpdates.yp_certified = true; safeUpdates.commission_split = 100; safeUpdates.certification_date = new Date().toISOString(); } await dbUpdate('staff_users', `id=eq.${staff_id}`, safeUpdates); } return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'mentor_verify_task') { const { task_id, mentor_id, mentor_name, trainee_id, notes, exam_score } = body; if (!task_id || !mentor_id) return new Response(JSON.stringify({ success: false, error: 'task_id and mentor_id required' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); if (trainee_id) { const traineeData = await dbQuery('staff_users', `id=eq.${trainee_id}&select=assigned_mentor_id`); const trainee = Array.isArray(traineeData) ? traineeData[0] : null; if (trainee && trainee.assigned_mentor_id && trainee.assigned_mentor_id !== mentor_id) return new Response(JSON.stringify({ success: false, error: 'Not assigned mentor' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); } await dbUpdate('certification_progress', `id=eq.${task_id}`, { completed: true, completed_at: new Date().toISOString(), verified_by: mentor_id, verified_by_name: mentor_name || 'Mentor', notes: notes || null }); const taskData = await dbQuery('certification_progress', `id=eq.${task_id}&select=*`); const task = Array.isArray(taskData) ? taskData[0] : null; if (task && trainee_id) { const pillarTasks = await dbQuery('certification_progress', `staff_id=eq.${trainee_id}&pillar_number=eq.${task.pillar_number}&completed=eq.true&select=id,task_type`); const completedTasks = Array.isArray(pillarTasks) ? pillarTasks : []; const progressUpdate: any = {}; if (task.pillar_number === 1) progressUpdate.pillar_1_deals_approved = completedTasks.length; else if (task.pillar_number === 2) { progressUpdate.pillar_2_leads_generated = completedTasks.filter((t: any) => t.task_type === 'lead_generation').length; progressUpdate.pillar_2_leads_closed = completedTasks.filter((t: any) => t.task_type === 'lead_close').length; } else if (task.pillar_number === 3) progressUpdate.pillar_3_full_cycles = completedTasks.length; else if (task.pillar_number === 4) { progressUpdate.pillar_4_exam_score = exam_score !== undefined ? exam_score : 90; progressUpdate.pillar_4_exam_passed = (exam_score !== undefined ? exam_score : 90) >= 90; } if (Object.keys(progressUpdate).length > 0) { await dbUpdate('staff_users', `id=eq.${trainee_id}`, progressUpdate); const currentData = await dbQuery('staff_users', `id=eq.${trainee_id}&select=pillar_1_deals_approved,pillar_2_leads_generated,pillar_2_leads_closed,pillar_3_full_cycles,pillar_4_exam_passed`); const merged = { ...(Array.isArray(currentData) ? currentData[0] : {}), ...progressUpdate }; if (merged.pillar_1_deals_approved >= 3 && merged.pillar_2_leads_generated >= 3 && merged.pillar_2_leads_closed >= 2 && merged.pillar_3_full_cycles >= 3 && merged.pillar_4_exam_passed === true) { await dbUpdate('staff_users', `id=eq.${trainee_id}`, { trainee_status: 'certified', yp_certified: true, commission_split: 100, certification_date: new Date().toISOString() }); } } } if (notes && trainee_id) dbInsert('mentor_communication_log', { mentor_id, mentor_name: mentor_name || 'Mentor', trainee_id, task_id, message_type: 'task_verification', message: notes }).catch(() => {}); return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'add_mentor_note') { const { mentor_id, mentor_name, trainee_id, message, message_type } = body; if (!mentor_id || !trainee_id || !message) return new Response(JSON.stringify({ success: false, error: 'mentor_id, trainee_id, message required' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); const result = await dbInsert('mentor_communication_log', { mentor_id, mentor_name: mentor_name || 'Mentor', trainee_id, message_type: message_type || 'note', message }); return new Response(JSON.stringify({ success: true, log_entry: Array.isArray(result) ? result[0] : result }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'update_trainee_notes') { const { trainee_id, trainee_notes, mentor_id } = body; if (!trainee_id) return new Response(JSON.stringify({ success: false, error: 'trainee_id required' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); if (mentor_id) { const traineeData = await dbQuery('staff_users', `id=eq.${trainee_id}&select=assigned_mentor_id`); const trainee = Array.isArray(traineeData) ? traineeData[0] : null; if (trainee && trainee.assigned_mentor_id && trainee.assigned_mentor_id !== mentor_id) { const callerData = await dbQuery('staff_users', `id=eq.${mentor_id}&select=department`); const caller = Array.isArray(callerData) ? callerData[0] : null; if (!caller || caller.department !== 'success_managers') return new Response(JSON.stringify({ success: false, error: 'Not authorized' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); } } await dbUpdate('staff_users', `id=eq.${trainee_id}`, { trainee_notes: trainee_notes || null }); return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'get_mentor_trainees') { const { mentor_id } = body; if (!mentor_id) return new Response(JSON.stringify({ success: false, error: 'mentor_id required' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); const trainees = await dbQuery('staff_users', `assigned_mentor_id=eq.${mentor_id}&select=id,first_name,last_name,email,trainee_status,trainee_start_date,certification_deadline,commission_split,pillar_1_deals_approved,pillar_2_leads_generated,pillar_2_leads_closed,pillar_3_full_cycles,pillar_4_exam_score,pillar_4_exam_passed,welcome_email_sent,agreement_email_sent,account_completed,is_active,trainee_notes&order=trainee_start_date.desc.nullsfirst`); const traineeList = Array.isArray(trainees) ? trainees : []; const enrichedTrainees = []; for (const trainee of traineeList) { const tasks = await dbQuery('certification_progress', `staff_id=eq.${trainee.id}&select=*&order=pillar_number,created_at`); const metrics = computeTraineeProgress(trainee); enrichedTrainees.push({ ...trainee, tasks: Array.isArray(tasks) ? tasks : [], ...metrics }); } const logs = await dbQuery('mentor_communication_log', `mentor_id=eq.${mentor_id}&select=*&order=created_at.desc&limit=100`); return new Response(JSON.stringify({ success: true, trainees: enrichedTrainees, communication_log: Array.isArray(logs) ? logs : [] }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'get_unassigned_trainees') { const { requester_id } = body; if (requester_id) { const requesterData = await dbQuery('staff_users', `id=eq.${requester_id}&select=yp_certified,department`); const requester = Array.isArray(requesterData) ? requesterData[0] : null; if (!requester || !requester.yp_certified) { return new Response(JSON.stringify({ success: false, error: 'Only certified AMs can view unassigned trainees' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); } } const unassigned = await dbQuery('staff_users', `department=eq.acquisition_managers&yp_certified=eq.false&assigned_mentor_id=is.null&select=id,first_name,last_name,email,trainee_status,trainee_start_date,certification_deadline,account_completed,is_active,created_at&order=created_at.desc`); const list = Array.isArray(unassigned) ? unassigned.filter((t: any) => t.is_active !== false) : []; return new Response(JSON.stringify({ success: true, trainees: list }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'self_assign_mentor') { const { mentor_id, trainee_id } = body; if (!mentor_id || !trainee_id) return new Response(JSON.stringify({ success: false, error: 'mentor_id and trainee_id required' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); const mentorData = await dbQuery('staff_users', `id=eq.${mentor_id}&select=id,first_name,last_name,yp_certified,department`); const mentor = Array.isArray(mentorData) ? mentorData[0] : null; if (!mentor || !mentor.yp_certified) return new Response(JSON.stringify({ success: false, error: 'Only YP Certified AMs can be mentors' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); const traineeData = await dbQuery('staff_users', `id=eq.${trainee_id}&select=id,first_name,last_name,assigned_mentor_id,assigned_mentor_name`); const trainee = Array.isArray(traineeData) ? traineeData[0] : null; if (!trainee) return new Response(JSON.stringify({ success: false, error: 'Trainee not found' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); if (trainee.assigned_mentor_id && trainee.assigned_mentor_id !== mentor_id) return new Response(JSON.stringify({ success: false, error: `Already assigned to ${trainee.assigned_mentor_name || 'another mentor'}` }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); const mentorName = `${mentor.first_name || ''} ${mentor.last_name || ''}`.trim(); await dbUpdate('staff_users', `id=eq.${trainee_id}`, { assigned_mentor_id: mentor_id, assigned_mentor_name: mentorName }); const smList = await dbQuery('staff_users', `department=eq.success_managers&is_active=eq.true&select=email`); if (Array.isArray(smList)) { for (const sm of smList) { if (sm.email) sendEmail(sm.email, `Mentor Self-Assignment: ${mentorName}`, `<p><strong>${mentorName}</strong> has volunteered to mentor <strong>${trainee.first_name} ${trainee.last_name}</strong>.</p>`).catch(() => {}); } } return new Response(JSON.stringify({ success: true, message: `You are now mentoring ${trainee.first_name} ${trainee.last_name}` }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'assign_mentor') { const { staff_id, mentor_id, mentor_name } = body; if (!staff_id || !mentor_id) return new Response(JSON.stringify({ success: false, error: 'staff_id and mentor_id required' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); await dbUpdate('staff_users', `id=eq.${staff_id}`, { assigned_mentor_id: mentor_id, assigned_mentor_name: mentor_name || 'Certified AM' }); return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'get_certified_ams') { const certifiedAMs = await dbQuery('staff_users', `yp_certified=eq.true&is_active=eq.true&select=id,first_name,last_name,email,department,roles`); const amList = Array.isArray(certifiedAMs) ? certifiedAMs.filter((s: any) => s.department === 'acquisition_managers' || s.roles?.includes?.('acquisition_managers')) : []; return new Response(JSON.stringify({ success: true, certified_ams: amList }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'get_trainee_ams') { const activeTrainees = await dbQuery('staff_users', `trainee_status=eq.active&select=id,first_name,last_name,email,trainee_start_date,certification_deadline,assigned_mentor_id,assigned_mentor_name,commission_split,pillar_1_deals_approved,pillar_2_leads_generated,pillar_2_leads_closed,pillar_3_full_cycles,pillar_4_exam_score,pillar_4_exam_passed,welcome_email_sent,agreement_email_sent,account_completed,is_active,trainee_notes&order=trainee_start_date.desc.nullsfirst`); const pendingTrainees = await dbQuery('staff_users', `department=eq.acquisition_managers&assigned_mentor_id=not.is.null&trainee_status=is.null&select=id,first_name,last_name,email,trainee_start_date,certification_deadline,assigned_mentor_id,assigned_mentor_name,commission_split,pillar_1_deals_approved,pillar_2_leads_generated,pillar_2_leads_closed,pillar_3_full_cycles,pillar_4_exam_score,pillar_4_exam_passed,welcome_email_sent,agreement_email_sent,account_completed,is_active,trainee_notes&order=created_at.desc`); const activeList = Array.isArray(activeTrainees) ? activeTrainees : []; const pendingList = Array.isArray(pendingTrainees) ? pendingTrainees : []; const allIds = new Set(activeList.map((t: any) => t.id)); const combined = [...activeList]; for (const t of pendingList) { if (!allIds.has(t.id)) { combined.push(t); allIds.add(t.id); } } const enriched = combined.map((t: any) => ({ ...t, ...computeTraineeProgress(t) })); return new Response(JSON.stringify({ success: true, trainees: enriched }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'get_mentor_log') { const { mentor_id, trainee_id } = body; let query = 'select=*&order=created_at.desc&limit=50'; if (mentor_id && trainee_id) query = `mentor_id=eq.${mentor_id}&trainee_id=eq.${trainee_id}&` + query; else if (mentor_id) query = `mentor_id=eq.${mentor_id}&` + query; else if (trainee_id) query = `trainee_id=eq.${trainee_id}&` + query; const logs = await dbQuery('mentor_communication_log', query); return new Response(JSON.stringify({ success: true, logs: Array.isArray(logs) ? logs : [] }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }

    // ==================== TAG MANAGEMENT ====================
    if (action === 'get_tags') { const tags = await dbQuery('investor_tags', `${body.category ? 'category=eq.' + body.category + '&' : ''}select=*&order=category,name`); return new Response(JSON.stringify({ success: true, tags: Array.isArray(tags) ? tags : [] }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'create_tag') { const { name, category, color, description } = body; if (!name || !category) return new Response(JSON.stringify({ success: false, error: 'Name and category required' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); const result = await dbInsert('investor_tags', { name: name.trim(), category, color: color || '#6B7280', description: description || null }); return new Response(JSON.stringify({ success: true, tag: Array.isArray(result) ? result[0] : result }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'delete_tag') { const { tag_id } = body; if (!tag_id) return new Response(JSON.stringify({ success: false, error: 'Tag ID required' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); await dbDelete('investor_tag_assignments', `tag_id=eq.${tag_id}`); await dbDelete('investor_tags', `id=eq.${tag_id}`); return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'assign_tags') { const { tag_ids, invitation_ids, assigned_by } = body; if (!tag_ids?.length || !invitation_ids?.length) return new Response(JSON.stringify({ success: false, error: 'IDs required' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); let c = 0; for (const invId of invitation_ids) { for (const tagId of tag_ids) { const existing = await dbQuery('investor_tag_assignments', `invitation_id=eq.${invId}&tag_id=eq.${tagId}&select=id`); if (!existing?.length) { await dbInsert('investor_tag_assignments', { invitation_id: invId, tag_id: tagId, assigned_by }); c++; } } } return new Response(JSON.stringify({ success: true, assigned: c }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'remove_tags') { const { tag_ids, invitation_ids } = body; if (tag_ids?.length && invitation_ids?.length) { await dbDelete('investor_tag_assignments', `invitation_id=in.(${invitation_ids.map((id: string) => `"${id}"`).join(',')})&tag_id=in.(${tag_ids.map((id: string) => `"${id}"`).join(',')})`); } return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }

    // ==================== CONTACT MANAGEMENT (v25.0: added_by_staff_id support) ====================
    if (action === 'add_pending') {
      const contacts = body.contacts;
      const staffId = body.staff_id || body.added_by_staff_id || null;
      const staffName = body.staff_name || body.added_by_staff_name || null;
      if (!contacts?.length) return new Response(JSON.stringify({ success: false, error: 'No contacts' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      let added = 0; const results: any[] = [];
      for (const c of contacts) {
        const name = String(c.name || '').trim();
        if (!name) { results.push({ name, status: 'skipped' }); continue; }
        let phone = String(c.phone || '').replace(/\D/g, '');
        if (phone.length === 10) phone = '+1' + phone;
        else if (phone.length === 11 && phone[0] === '1') phone = '+' + phone;
        else if (phone && !phone.startsWith('+')) phone = '+' + phone;
        const ins = await dbInsert('investor_invitations', {
          name, phone: phone || null, email: c.email?.toLowerCase() || null,
          company: c.company || null, notes: c.notes || null, status: 'pending',
          added_by_staff_id: staffId, added_by_staff_name: staffName
        });
        if (ins && Array.isArray(ins) && ins[0]) { results.push({ name, status: 'added', id: ins[0].id }); added++; }
        else { results.push({ name, status: 'failed' }); }
      }
      return new Response(JSON.stringify({ success: true, added, total: contacts.length, results }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    if (action === 'get_pending') { const page = parseInt(body.page) || 1; const perPage = parseInt(body.per_page) || 100; const offset = (page - 1) * perPage; let list = await dbQuery('investor_invitations', `status=eq.pending&select=*&order=created_at.desc&offset=${offset}&limit=${perPage}`); list = Array.isArray(list) ? list : []; if (body.search) { const s = body.search.toLowerCase(); list = list.filter((c: any) => c.name?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s) || c.phone?.includes(body.search)); } const invIds = list.map((c: any) => c.id); const tagMap = await getContactTags(invIds); const enriched = list.map((c: any) => ({ ...c, tags: tagMap.get('inv_' + c.id) || [] })); return new Response(JSON.stringify({ success: true, contacts: enriched, total: enriched.length, page, per_page: perPage }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'delete_pending') { const { contact_id } = body; if (!contact_id) return new Response(JSON.stringify({ success: false, error: 'ID required' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); await dbDelete('investor_tag_assignments', `invitation_id=eq.${contact_id}`); await dbDelete('investor_invitations', `id=eq.${contact_id}&status=eq.pending`); return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'delete_pending_bulk') { const ids = body.contact_ids; if (!ids?.length) return new Response(JSON.stringify({ success: false, error: 'IDs required' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); const idList = ids.map((id: string) => `"${id}"`).join(','); await dbDelete('investor_tag_assignments', `invitation_id=in.(${idList})`); await dbDelete('investor_invitations', `id=in.(${idList})&status=eq.pending`); return new Response(JSON.stringify({ success: true, deleted: ids.length }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'update_pending') { const { contact_id, name, phone, email, company, notes } = body; if (!contact_id) return new Response(JSON.stringify({ success: false, error: 'ID required' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); const u: any = {}; if (name !== undefined) u.name = name; if (phone !== undefined) { let fp = phone.replace(/\D/g, ''); if (fp.length === 10) fp = '+1' + fp; u.phone = fp || null; } if (email !== undefined) u.email = email.toLowerCase() || null; if (company !== undefined) u.company = company || null; if (notes !== undefined) u.notes = notes || null; await dbUpdate('investor_invitations', `id=eq.${contact_id}&status=eq.pending`, u); return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'get_stats') { const stats = await dbQuery('investor_invitations', 'select=status,delivery_status,channel'); const sl = Array.isArray(stats) ? stats : []; const sc = { total: sl.length, pending: 0, sent: 0, delivered: 0, failed: 0, signed_up: 0, sms_sent: 0, email_sent: 0 }; for (const s of sl) { if (s.status === 'pending') { sc.pending++; continue; } const es = s.delivery_status || s.status; if (['sent','queued','sending'].includes(es)) sc.sent++; else if (es === 'delivered') sc.delivered++; else if (['failed','undelivered'].includes(es)) sc.failed++; else if (es === 'signed_up') sc.signed_up++; if (s.channel === 'sms') sc.sms_sent++; if (s.channel === 'email') sc.email_sent++; } return new Response(JSON.stringify({ success: true, stats: sc }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'get_history') { const page = parseInt(body.page) || 1; const pp = parseInt(body.per_page) || 50; const q = 'status=neq.pending&select=*&order=sent_at.desc.nullsfirst&offset=' + ((page-1)*pp) + '&limit=' + pp; const invitations = await dbQuery('investor_invitations', q); return new Response(JSON.stringify({ success: true, invitations: Array.isArray(invitations) ? invitations : [], total: 0, page, per_page: pp }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'send_all_pending') { const channel = body.channel || 'both'; const contacts = await dbQuery('investor_invitations', `status=eq.pending&select=*&order=created_at.asc&limit=500`); if (!contacts?.length) return new Response(JSON.stringify({ success: false, error: 'No pending contacts' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); const result = await sendInvitationsInBatches(contacts, channel); return new Response(JSON.stringify({ success: true, ...result }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'send_pending') { let ids = body.contact_ids || []; const channel = body.channel || 'both'; if (ids.length === 0) return new Response(JSON.stringify({ success: false, error: 'No contacts selected' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); const contacts = await dbQuery('investor_invitations', `id=in.(${ids.map((id: string) => `"${id}"`).join(',')})&status=eq.pending&select=*`); if (!contacts?.length) return new Response(JSON.stringify({ success: false, error: 'No pending contacts found' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); const result = await sendInvitationsInBatches(contacts, channel); return new Response(JSON.stringify({ success: true, ...result }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
    if (action === 'resend') { const invId = body.invitation_id; if (!invId) return new Response(JSON.stringify({ success: false, error: 'ID required' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); const invitations = await dbQuery('investor_invitations', `id=eq.${invId}&select=*`); if (!invitations?.length) return new Response(JSON.stringify({ success: false, error: 'Not found' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); const inv = invitations[0]; const ic = inv.invite_code || generateInviteCode(); const firstName = String(inv.name || '').split(' ')[0] || 'there'; if (inv.email) { const er = await sendEmail(inv.email, "You're Invited to Access Your Place!", buildInvitationEmailHtml(firstName, buildSignupUrl(ic, true))); if (er.success) { await dbUpdate('investor_invitations', `id=eq.${invId}`, { status: 'sent', delivery_status: 'delivered', invite_code: ic, sent_at: new Date().toISOString(), resend_count: (parseInt(inv.resend_count) || 0) + 1 }); return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } }); } } return new Response(JSON.stringify({ success: false, error: 'Failed to resend' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }

    // DEFAULT: SEND NEW INVITATIONS (v25.0: store staff_id)
    const contacts = body.contacts; const channel = body.channel || 'both';
    const staffId = body.staff_id || body.added_by_staff_id || null;
    const staffName = body.staff_name || body.added_by_staff_name || null;
    if (!contacts?.length) return new Response(JSON.stringify({ success: false, error: 'No contacts provided' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    let sentCount = 0, failedCount = 0; const results: any[] = [];
    for (const contact of contacts) {
      const name = String(contact.name || '').trim(); const phone = String(contact.phone || '').trim(); const email = String(contact.email || '').trim().toLowerCase();
      if (!name || (!phone && !email)) { results.push({ name, status: 'failed', error: 'Missing info' }); failedCount++; continue; }
      const firstName = name.split(' ')[0]; const ic = generateInviteCode();
      if (phone && (channel === 'sms' || channel === 'both')) { let fp = phone.replace(/\D/g, ''); if (fp.length === 10) fp = '+1' + fp; else if (fp.length === 11 && fp[0] === '1') fp = '+' + fp; else if (!fp.startsWith('+')) fp = '+' + fp; if (fp.length >= 11) { const sr = await sendTwilioSMS(fp, 'Hi ' + firstName + '! Join Access Your Place: ' + buildSignupUrl(ic, false) + ' - AYP Team'); if (sr.success) { dbInsert('investor_invitations', { name, phone: fp, email: email || null, invite_code: ic, channel: 'sms', status: 'sent', delivery_status: 'queued', twilio_sid: sr.sid, sent_at: new Date().toISOString(), added_by_staff_id: staffId, added_by_staff_name: staffName }).catch(() => {}); results.push({ name, status: 'sent' }); sentCount++; } else { results.push({ name, status: 'failed', error: sr.error }); failedCount++; } } }
      if (email && (channel === 'email' || channel === 'both')) { const eic = channel === 'both' ? generateInviteCode() : ic; const er = await sendEmail(email, "You're Invited to Access Your Place!", buildInvitationEmailHtml(firstName, buildSignupUrl(eic, true))); if (er.success) { dbInsert('investor_invitations', { name, email, invite_code: eic, channel: 'email', status: 'sent', delivery_status: 'delivered', sent_at: new Date().toISOString(), added_by_staff_id: staffId, added_by_staff_name: staffName }).catch(() => {}); results.push({ name, status: 'sent' }); sentCount++; } else { results.push({ name, status: 'failed', error: er.error }); failedCount++; } }
    }
    return new Response(JSON.stringify({ success: true, sent: sentCount, failed: failedCount, total: contacts.length, results }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (error: any) {
    console.error('[v25.0] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Unknown error' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
