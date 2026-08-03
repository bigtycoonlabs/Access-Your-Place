// penny-staff-chat — Penny's tool-using staff agent (Layer 3).
//
// A real agent, not a script: she reads the live desk (buyer inquiries), reasons
// about it, and takes GUARDED next steps. Reads are open; writes (status change,
// note) require the staff to confirm in plain words first — the tool refuses
// unless confirmed:true, and the prompt tells her to ask before she ever sets it.
//
// Honesty rules matter here because the operator is blind and can't visually
// check her claims: she only states what a tool actually returned.

// TRUTH SPINE (v11 Phase 0): the shared honesty guard. Her final reply is checked against
// the tools that actually COMPLETED this turn, so a real action she took stands and any
// unbacked completion claim gets an honest correction — the blind operator hears the truth.
import { guardReply, buildCorrection } from "./penny_truth.ts";

const APP_SCHEMA = 'prj_X-ZoVQv6LKXT';

// Persona sign-up / login links, verified against the live app routes. Penny uses the CREATE
// link when onboarding someone new and the LOGIN link for someone who already has an account.
// Kept here in code (not in the model) so a link is always correct and never guessed.
const ACCOUNT_LINKS = {
  investor: {
    label: 'client / investor / third-party seller',
    create: 'https://accessyourplace.com/investor/login?tab=register',
    login: 'https://accessyourplace.com/investor/login',
  },
  landlord: {
    label: 'landlord / apartment community',
    create: 'https://accessyourplace.com/landlord-partnership#landlord-inquiry',
    login: 'https://accessyourplace.com/landlord/login',
  },
} as const;


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// ---- RPC helper (service role -> public SECURITY DEFINER accessors) --------
async function rpc(
  url: string, key: string, fn: string, args: Record<string, unknown> = {},
): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

// ---- call another edge function (service role) -----------------------------
async function callFn(
  url: string, key: string, name: string, payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

// ---- tools (data via public SECURITY DEFINER accessors, service-role only) --
async function listOpportunities(url: string, key: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_open_inquiries');
  if (!ok) {
    console.error('penny-staff-chat rpc_open_inquiries', status, JSON.stringify(data).slice(0, 200));
    return { count: 0, opportunities: [], error: `read_failed_${status}` };
  }
  const rows = Array.isArray(data) ? data : [];
  return {
    count: rows.length,
    opportunities: rows.map((r: any) => ({
      inquiry_id: r.id,
      who: r.investor_name,
      email: r.investor_email,
      phone: r.investor_phone || null,
      interested_in: r.property_label || 'a live deal',
      investment_type: r.investment_type || null,
      message: r.message || '',
      inquired_at: r.created_at,
    })),
  };
}

async function getOpportunity(url: string, key: string, inquiryId: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_inquiry', { p_id: inquiryId });
  if (!ok) {
    console.error('penny-staff-chat rpc_inquiry', status, JSON.stringify(data).slice(0, 200));
    return { error: `read_failed_${status}`, inquiry_id: inquiryId };
  }
  if (!data || typeof data !== 'object') return { error: 'not_found', inquiry_id: inquiryId };
  return {
    inquiry_id: data.id,
    who: data.investor_name,
    email: data.investor_email,
    phone: data.investor_phone || null,
    interested_in: data.property_label || 'a live deal',
    investment_type: data.investment_type || null,
    message: data.message || '',
    status: data.status || 'new',
    inquired_at: data.created_at,
    contacted_at: data.contacted_at || null,
    staff_notes: data.staff_notes || null,
    notes: Array.isArray(data.notes) ? data.notes : [],
  };
}

async function updateStatus(url: string, key: string, inquiryId: string, status: string) {
  const { ok, status: code, data } = await rpc(url, key, 'penny_set_inquiry_status', { p_id: inquiryId, p_status: status });
  if (!ok) {
    console.error('penny-staff-chat rpc_set_status', code, JSON.stringify(data).slice(0, 200));
    return { error: 'update_failed', http: code };
  }
  if (data && data.ok === false) return { error: data.error || 'update_failed', inquiry_id: inquiryId };
  return { ok: true, inquiry_id: inquiryId, new_status: data?.status || status };
}

async function addNote(url: string, key: string, inquiryId: string, note: string, staffId: string) {
  const { ok, status: code, data } = await rpc(url, key, 'penny_add_inquiry_note', { p_id: inquiryId, p_note: note, p_by: staffId || null });
  if (!ok) {
    console.error('penny-staff-chat rpc_add_note', code, JSON.stringify(data).slice(0, 200));
    return { error: 'note_failed', http: code };
  }
  if (data && data.ok === false) return { error: data.error || 'note_failed', inquiry_id: inquiryId };
  return { ok: true, inquiry_id: inquiryId, saved_note: data?.note || note };
}

async function listPendingEmails(url: string, key: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_pending_emails');
  if (!ok) {
    console.error('penny-staff-chat rpc_pending_emails', status, JSON.stringify(data).slice(0, 200));
    return { error: 'load_failed', http: status };
  }
  const rows = Array.isArray(data) ? data : [];
  return { count: rows.length, emails: rows };
}

async function getClientEmail(url: string, key: string, id: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_email', { p_id: id });
  if (!ok) {
    console.error('penny-staff-chat rpc_email', status, JSON.stringify(data).slice(0, 200));
    return { error: 'load_failed', http: status };
  }
  if (!data) return { error: 'not_found', email_id: id };
  return data;
}

async function composeClientEmail(url: string, key: string, a: any, staffId: string, staffName: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_compose_client_email', {
    p_to_email: a.to_email, p_to_name: a.to_name || null, p_subject: a.subject, p_body: a.body,
    p_context: a.context || null, p_by: staffId || null, p_by_name: staffName || null,
  });
  if (!ok) {
    console.error('penny-staff-chat rpc_compose_email', status, JSON.stringify(data).slice(0, 200));
    return { error: 'compose_failed', http: status };
  }
  if (data && data.ok === false) return { error: data.error || 'compose_failed' };
  return { ok: true, email_id: data?.id, status: 'draft' };
}

const SUCCESS_INBOX = 'success@accessyourplace.com';

// Send a composed draft to the client now, from Penny. Reply-to and a bcc copy
// go to the success team (penny@ is send-only), then we mark the draft sent.
async function sendClientEmail(url: string, key: string, id: string, staffId: string, staffName: string) {
  const email = await getClientEmail(url, key, id);
  if (!email || (email as any).error) return { error: (email as any)?.error || 'load_failed', email_id: id };
  const e = email as any;
  if (e.status === 'sent') return { already_sent: true, email_id: id, to: e.to_email };
  const to = e.to_email;
  const subject = e.subject || '(no subject)';
  const body = String(e.body || '');
  if (!to) return { error: 'no_recipient', email_id: id };
  const rkey = Deno.env.get('RESEND_API_KEY');
  if (!rkey) return { error: 'no_resend_key' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rkey}` },
    body: JSON.stringify({
      from: 'Penny <penny@accessyourplace.com>',
      to: [to], reply_to: [SUCCESS_INBOX], bcc: [SUCCESS_INBOX],
      subject, text: body,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('penny-staff-chat resend_send_failed', res.status, JSON.stringify(data).slice(0, 200));
    return { error: 'send_failed', http: res.status };
  }
  const providerId = (data as any)?.id || null;
  await rpc(url, key, 'penny_mark_email_sent', {
    p_id: id, p_by: staffId || null, p_by_name: staffName || 'Penny', p_provider_id: providerId,
  });
  return { sent: true, email_id: id, to, subject, provider_message_id: providerId };
}

// A plain activity report: website traffic + new client accounts, last N days.
async function activityReport(url: string, key: string, days: number) {
  const { ok, status, data } = await rpc(url, key, 'penny_activity_report', { p_days: days });
  if (!ok) {
    console.error('penny-staff-chat rpc_activity_report', status, JSON.stringify(data).slice(0, 200));
    return { error: 'report_failed', http: status };
  }
  return data;
}

// Find a client (investor) by name, email, or company — for lookup / disambiguation.
async function findClient(url: string, key: string, query: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_find_client', { p_query: query });
  if (!ok) {
    console.error('penny-staff-chat rpc_find_client', status, JSON.stringify(data).slice(0, 200));
    return { error: 'lookup_failed', http: status };
  }
  const rows = Array.isArray(data) ? data : [];
  return { count: rows.length, clients: rows };
}

// "What is this client up to?" — signup, logins, sessions, messages, Penny chats,
// pages/deals browsed, activity feed, and inquiries. Read-only. Self-resolves the
// person from a name or email; returns matches when the name is ambiguous.
async function clientActivity(url: string, key: string, query: string | null, investorId: string | null) {
  const { ok, status, data } = await rpc(url, key, 'penny_client_activity', {
    p_query: query, p_investor_id: investorId, p_limit: 8,
  });
  if (!ok) {
    console.error('penny-staff-chat rpc_client_activity', status, JSON.stringify(data).slice(0, 200));
    return { error: 'activity_failed', http: status };
  }
  return data;
}

// Is this person already in the system, and of which kind? Read-only. Returns the real
// matches (investors and landlords) plus the correct create/login links per persona, so
// Penny can tell staff plainly whether they're new or already here — and never guess a URL.
async function checkAccount(url: string, key: string, query: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_check_account', { p_query: query });
  if (!ok) {
    console.error('penny-staff-chat rpc_check_account', status, JSON.stringify(data).slice(0, 200));
    return { error: 'check_failed', http: status };
  }
  const r: any = data || {};
  return {
    found: !!r.found,
    invited_pending: !!r.invited_pending,
    investor_matches: Array.isArray(r.investor_matches) ? r.investor_matches : [],
    landlord_matches: Array.isArray(r.landlord_matches) ? r.landlord_matches : [],
    links: ACCOUNT_LINKS, // correct create/login links, straight from code — use verbatim.
  };
}

// Send the official platform onboarding to someone NEW so they can create their account.
// Client / third-party seller -> a tracked investor invitation (secure signup link + invite
// code, staff-attributed). Landlord / apartment community -> their landlord record + a welcome.
// Idempotent and truthful: won't re-email someone already onboarded, and reports what really
// happened. Wraps the deployed, proven penny-onboard-contact function.
async function onboardPerson(
  url: string, key: string,
  persona: string, name: string, email: string,
  phone: string | null, company: string | null,
  staffId: string, staffName: string,
) {
  const isLandlord = persona === 'landlord' || persona === 'community';
  const payload = isLandlord
    ? { action: 'onboard_landlord', landlord_name: name || null, landlord_email: email, landlord_phone: phone || null, company_name: company || null, staff_id: staffId || null }
    : { action: 'onboard_seller', seller_name: name || null, seller_email: email, staff_id: staffId || null, staff_name: staffName || null };
  const { ok, status, data } = await callFn(url, key, 'penny-onboard-contact', payload);
  if (!ok) {
    console.error('penny-staff-chat onboard_person', status, JSON.stringify(data).slice(0, 200));
    return { error: 'onboard_failed', http: status, detail: data };
  }
  const d: any = data || {};
  return {
    ok: true,
    persona: isLandlord ? 'landlord' : 'investor',
    email,
    email_sent: !!d.email_sent,
    already_onboarded: !!d.already_onboarded,
    message: d.message || null,
  };
}

// Record a completed deal (closing) into the company ledger + P&L by calling the HR function's
// admin-gated submit_deal_record. The caller's staffId is passed through, so manage-hr-commissions
// enforces its own admin/owner check - a non-admin staffer gets an honest not_authorized back,
// never a silent success. Penny reads every number back and gets a yes before this ever runs.
async function recordClosing(url: string, key: string, a: any, staffId: string, staffName: string) {
  const payload: Record<string, unknown> = {
    action: 'submit_deal_record',
    staff_id: staffId,
    client_name: String(a.client_name || '').trim(),
    property_address: a.property_address != null ? String(a.property_address) : '',
    deal_type: String(a.deal_type || 'acquisition').toLowerCase(),
    deal_status: a.deal_status != null ? String(a.deal_status) : 'closed',
    payment_type: a.payment_type != null ? String(a.payment_type) : 'cash',
    acquisition_fee_total: a.acquisition_fee_total ?? '',
    funded_payment: a.funded_payment ?? '',
    commission_paid: a.commission_paid ?? '',
    acquisition_cost: a.acquisition_cost ?? '',
    setup_fee: a.setup_fee ?? '',
    logistics_reserve: a.logistics_reserve ?? '',
    assigned_staff_name: a.assigned_staff_name != null ? String(a.assigned_staff_name) : (staffName || ''),
    assigned_staff_id: a.assigned_staff_id != null ? String(a.assigned_staff_id) : '',
    notes: a.notes != null ? String(a.notes) : '',
    submitted_by: staffName || staffId || 'Penny',
  };
  const { ok, status, data } = await callFn(url, key, 'manage-hr-commissions', payload);
  if (!ok) {
    console.error('penny-staff-chat record_closing', status, JSON.stringify(data).slice(0, 200));
    if (status === 403) return { error: 'not_authorized', detail: 'Recording a closing needs an admin or owner account; this staff account is not permitted to record deals.' };
    return { error: 'record_failed', http: status };
  }
  const d: any = data || {};
  if (d.success === false) return { error: d.error || 'record_failed' };
  const deal: any = d.deal || {};
  return {
    success: true,
    deal_id: deal.id || null,
    deal_type: deal.deal_type || payload.deal_type,
    client_name: deal.client_name || payload.client_name,
    net_after_commission: deal.net_after_commission ?? null,
  };
}

type Ctx = { url: string; key: string; staffId: string; staffName: string; docText?: string; docName?: string };

async function execTool(name: string, args: any, ctx: Ctx): Promise<unknown> {
  const { url, key, staffId, staffName } = ctx;
  try {
    if (name === 'find_client') {
      if (!args?.query) return { error: 'query required' };
      return await findClient(url, key, String(args.query));
    }
    if (name === 'get_client_activity') {
      const q = args?.client ? String(args.client) : (args?.query ? String(args.query) : null);
      const iid = args?.investor_id ? String(args.investor_id) : null;
      if (!q && !iid) return { error: 'client name, email, or investor_id required' };
      return await clientActivity(url, key, q, iid);
    }
    if (name === 'check_account') {
      const q = args?.person ? String(args.person) : (args?.email ? String(args.email) : (args?.query ? String(args.query) : ''));
      if (!q) return { error: 'a name or email is required' };
      return await checkAccount(url, key, q);
    }
    if (name === 'send_account_invite') {
      const persona = String(args?.persona || '').toLowerCase();
      const email = args?.email ? String(args.email).trim() : '';
      if (!persona || !email) return { error: 'persona and email are required' };
      if (!['client', 'investor', 'seller', 'landlord', 'community'].includes(persona)) {
        return { error: `unknown persona "${persona}"`, valid: ['client', 'seller', 'landlord', 'community'] };
      }
      if (args.confirmed !== true) {
        const isLL = persona === 'landlord' || persona === 'community';
        return { needs_confirmation: true, action: `send the official ${isLL ? 'landlord' : 'client/seller'} onboarding invite to ${email}`, instruction: 'Tell the staff member plainly who this will email and that it invites them to create their account, and get a clear yes. Then call again with confirmed:true.' };
      }
      return await onboardPerson(url, key, persona, String(args?.name || ''), email, args?.phone ? String(args.phone) : null, args?.company ? String(args.company) : null, staffId, staffName);
    }
    if (name === 'list_pending_emails') return await listPendingEmails(url, key);
    if (name === 'get_client_email') {
      if (!args?.email_id) return { error: 'email_id required' };
      return await getClientEmail(url, key, String(args.email_id));
    }
    if (name === 'compose_client_email') {
      if (!args?.to_email || !args?.subject || !args?.body) return { error: 'to_email, subject and body required' };
      if (args.confirmed !== true) {
        return { needs_confirmation: true, action: `save a draft email to ${args.to_email}`, instruction: 'Read the subject and full body back to the staff member and get a clear yes before calling again with confirmed:true. Make sure the body invites the client to respond in their dashboard.' };
      }
      return await composeClientEmail(url, key, args, staffId, staffName);
    }
    if (name === 'send_client_email') {
      if (!args?.email_id) return { error: 'email_id required' };
      if (args.confirmed !== true) {
        return { needs_confirmation: true, action: 'send this email to the client now', instruction: 'Read the recipient, the subject, and the full body back to the staff member and get a clear spoken yes. Sending is immediate and cannot be undone. Only then call again with confirmed:true.' };
      }
      return await sendClientEmail(url, key, String(args.email_id), staffId, staffName);
    }
    if (name === 'get_activity_report') {
      const d = Number.isFinite(Number(args?.days)) ? Math.min(Math.max(Number(args.days), 1), 90) : 7;
      return await activityReport(url, key, d);
    }
    if (name === 'record_closing') {
      const client_name = args?.client_name ? String(args.client_name).trim() : '';
      if (!client_name) return { error: 'client_name is required' };
      const deal_type = String(args?.deal_type || 'acquisition').toLowerCase();
      if (!['acquisition', 'third_party', 'setup'].includes(deal_type)) {
        return { error: `unknown deal_type "${deal_type}"`, valid: ['acquisition', 'third_party', 'setup'] };
      }
      if (args.confirmed !== true) {
        return { needs_confirmation: true, action: `record a ${deal_type} closing for ${client_name}`, instruction: 'Read back every number you are about to record - the client, the property, the deal type, and each dollar figure that applies (acquisition fee, funded payment, commission, acquisition cost, setup fee, logistics reserve) - and the net profit it implies. Ask about anything missing or unclear FIRST; never invent a figure. Only after a clear yes, call again with confirmed:true.' };
      }
      return await recordClosing(url, key, args, staffId, staffName);
    }
    if (name === 'list_opportunities') return await listOpportunities(url, key);
    if (name === 'get_opportunity') {
      if (!args?.inquiry_id) return { error: 'inquiry_id required' };
      return await getOpportunity(url, key, String(args.inquiry_id));
    }
    if (name === 'update_opportunity_status') {
      if (!args?.inquiry_id || !args?.status) return { error: 'inquiry_id and status required' };
      if (args.confirmed !== true) {
        return { needs_confirmation: true, action: `set this inquiry to "${args.status}"`, instruction: 'Ask the staff member to confirm in plain words, then call again with confirmed:true.' };
      }
      return await updateStatus(url, key, String(args.inquiry_id), String(args.status));
    }
    if (name === 'add_opportunity_note') {
      if (!args?.inquiry_id || !args?.note) return { error: 'inquiry_id and note required' };
      if (args.confirmed !== true) {
        return { needs_confirmation: true, action: 'save this note', instruction: 'Read the note back to the staff member, get a yes, then call again with confirmed:true.' };
      }
      return await addNote(url, key, String(args.inquiry_id), String(args.note), staffId);
    }
    return { error: `unknown_tool_${name}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'tool_error' };
  }
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_client_activity',
      description: "See what a specific client has been up to. Returns the real picture: when they signed up, their logins and last login, whether they have an active session right now, messages they've sent us, their chats with Penny, the pages and deals they've been browsing, their activity feed, and any deal inquiries — plus their status, assigned managers, and credit balance. Use this ANY time the staff member asks what a client is doing, has been up to, is looking at, whether they've logged in, or their recent activity. Pass the client's name or email in `client` — even just a first name is fine, the tool resolves it. If more than one person matches, it returns the matches so you can ask which one they mean.",
      parameters: {
        type: 'object',
        properties: {
          client: { type: 'string', description: "The client's name or email address (a first name alone is fine)." },
          investor_id: { type: 'string', description: 'Optional exact investor id, if you already have it (e.g. from find_client).' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_client',
      description: 'Look up a client (investor) by name, email, or company. Returns matching accounts with their id, name, email, company, signup date, status, and last login. Use this to find who someone is, or to pick between people with similar names before pulling their activity.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'A name, email, or company to search for.' } },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_account',
      description: "Check whether a person already has an account, and of which kind. Searches clients/investors AND landlords/apartment communities, and notes a pending invitation. Use this FIRST whenever staff want to reach out to, onboard, or bring someone onto the platform: it tells you if they're new or already in the system, and returns the correct create-account and login links for each persona so you never guess a URL. Pass a name or email in `person`.",
      parameters: {
        type: 'object',
        properties: { person: { type: 'string', description: "The person's name or email address." } },
        required: ['person'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_account_invite',
      description: "Send the platform's OFFICIAL onboarding to someone NEW so they can create their account. Client or third-party seller -> a tracked invitation with a secure signup link and invite code. Landlord or apartment community -> sets up their landlord record and sends a welcome. Idempotent (won't re-email someone already onboarded). This is a WRITE that sends a real email — only call with confirmed:true after telling the staff member who it will email and getting a clear yes. For a personal, situation-specific message instead, co-write one with compose_client_email / send_client_email.",
      parameters: {
        type: 'object',
        properties: {
          persona: { type: 'string', enum: ['client', 'seller', 'landlord', 'community'], description: 'client or seller = investor account; landlord or community = landlord account.' },
          name: { type: 'string', description: "The person's name." },
          email: { type: 'string', description: "The person's email address." },
          phone: { type: 'string', description: 'Optional phone (landlord / community).' },
          company: { type: 'string', description: 'Optional company or community name (landlord / community).' },
          confirmed: { type: 'boolean', description: 'Set true ONLY after telling staff who it emails and getting a clear yes.' },
        },
        required: ['persona', 'email'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_opportunities',
      description: 'List the open buyer inquiries on live deals (people who marked interest). Use this whenever the staff member asks about opportunities, interest, or inquiries.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_opportunity',
      description: 'Get the full detail and any prior notes for one buyer inquiry, by its inquiry_id (from list_opportunities).',
      parameters: {
        type: 'object',
        properties: { inquiry_id: { type: 'string', description: 'The inquiry_id from list_opportunities.' } },
        required: ['inquiry_id'], additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_opportunity_status',
      description: "Change an inquiry's status. This is a WRITE — only call with confirmed:true after the staff member has clearly said yes to this exact change.",
      parameters: {
        type: 'object',
        properties: {
          inquiry_id: { type: 'string' },
          status: { type: 'string', enum: ['reviewing', 'contacted', 'closed', 'new'], description: 'reviewing = looking at it; contacted = reached out to them; closed = done or declined; new = untouched.' },
          confirmed: { type: 'boolean', description: 'Set true ONLY after explicit staff confirmation.' },
        },
        required: ['inquiry_id', 'status'], additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_opportunity_note',
      description: 'Add an internal note to an inquiry. This is a WRITE — only call with confirmed:true after the staff member has approved the note text.',
      parameters: {
        type: 'object',
        properties: {
          inquiry_id: { type: 'string' },
          note: { type: 'string' },
          confirmed: { type: 'boolean', description: 'Set true ONLY after explicit staff confirmation.' },
        },
        required: ['inquiry_id', 'note'], additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_pending_emails',
      description: 'List client emails composed with Penny that are saved as drafts, waiting to be sent. Use this whenever the staff member asks about pending emails, drafts, or anything waiting to go out.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_client_email',
      description: 'Get the full subject, body, and situation notes for one saved client email by its email_id (from list_pending_emails).',
      parameters: {
        type: 'object',
        properties: { email_id: { type: 'string', description: 'The email_id from list_pending_emails.' } },
        required: ['email_id'], additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compose_client_email',
      description: "Save a client email you've written together with the staff member as a draft, so it waits in the dashboard to be sent. This is a WRITE — only call with confirmed:true after you've read the full draft back and the staff member has clearly approved it. Always write the body in Penny's warm voice and always include a line telling the client they can respond right in their Access Your Place dashboard (log in at https://accessyourplace.com/investor/login).",
      parameters: {
        type: 'object',
        properties: {
          to_email: { type: 'string', description: "The client's email address." },
          to_name: { type: 'string', description: "The client's name." },
          subject: { type: 'string' },
          body: { type: 'string', description: "The full email body in Penny's voice, including the line inviting the client to respond in their dashboard." },
          context: { type: 'string', description: 'A short note on the situation, so Penny remembers the backstory later.' },
          confirmed: { type: 'boolean', description: 'Set true ONLY after reading the draft back and getting explicit staff approval.' },
        },
        required: ['to_email', 'subject', 'body'], additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_client_email',
      description: "Send a previously-composed draft to the client NOW, from Penny. This is a WRITE and it is IRREVERSIBLE — the email goes out immediately. Only call with confirmed:true after you've read the recipient, subject and full body back to the staff member and they've clearly said to send it. The client's reply, and a copy, go to the success team. Use the email_id returned by compose_client_email or shown by list_pending_emails / get_client_email.",
      parameters: {
        type: 'object',
        properties: {
          email_id: { type: 'string', description: 'The id of the draft to send.' },
          confirmed: { type: 'boolean', description: 'Set true ONLY after reading the email back and getting explicit staff approval to send it now.' },
        },
        required: ['email_id'], additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_activity_report',
      description: 'Get a plain activity report for the platform over the last N days: website traffic (page views, sessions, top pages) and the new client accounts that signed up, with their names. Use this whenever the staff member asks how the site is doing, about traffic, visitors, or who has newly joined.',
      parameters: {
        type: 'object',
        properties: { days: { type: 'number', description: 'How many days back to report on. Defaults to 7.' } },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'record_closing',
      description: "Record a completed deal (a closing) into the company ledger and P&L, from details the staff member gives you or from an acquisition agreement / document they shared. This is a WRITE that changes the live P&L - only call with confirmed:true after you have read every number back and the staff member has clearly approved. Pick deal_type: 'acquisition' (first-party: acquisition fee plus funded payment, minus commission), 'third_party' (company takes 20% of the acquisition cost ONLY - deposits, application, and other community fees are NOT in the 20% base - and commission still comes out of that 20%), or 'setup' (a setup service: the client is billed setup_fee, logistics_reserve covers logistics, the on-the-ground pro, travel, and the setup manager's pay, and profit is setup_fee minus logistics_reserve). Setup can also ride on an acquisition - include setup_fee and logistics_reserve alongside the acquisition numbers. Only include the fields that apply. If a needed number is missing or unclear, ASK before recording - never invent a figure.",
      parameters: {
        type: 'object',
        properties: {
          client_name: { type: 'string', description: "The client's name." },
          property_address: { type: 'string', description: 'The property address, if known.' },
          deal_type: { type: 'string', enum: ['acquisition', 'third_party', 'setup'], description: 'acquisition = first-party; third_party = seller (company takes 20% of acquisition cost only); setup = setup service.' },
          deal_status: { type: 'string', enum: ['closed', 'completed', 'pending'], description: 'Defaults to closed.' },
          payment_type: { type: 'string', enum: ['cash', 'credit'], description: 'How the client paid. Defaults to cash.' },
          acquisition_fee_total: { type: 'number', description: 'First-party acquisition: the acquisition fee charged to the client.' },
          funded_payment: { type: 'number', description: 'First-party acquisition: any funded payment.' },
          commission_paid: { type: 'number', description: 'Team commission on this deal (comes out of acquisition income, including the third-party 20%).' },
          acquisition_cost: { type: 'number', description: 'Third-party seller: the acquisition cost. The company takes 20% of THIS only (exclude deposits, application, and other community fees).' },
          setup_fee: { type: 'number', description: 'Setup service: the setup/logistics package billed to the client (e.g. 5150).' },
          logistics_reserve: { type: 'number', description: 'Setup service: reserved for logistics, on-the-ground pro, travel, and the setup manager (e.g. 3350). Setup profit = setup_fee - logistics_reserve.' },
          assigned_staff_name: { type: 'string', description: 'The acquisition manager credited with the deal, if named.' },
          notes: { type: 'string', description: 'Any notes about the deal.' },
          confirmed: { type: 'boolean', description: 'Set true ONLY after reading every number back and getting explicit staff approval.' },
        },
        required: ['client_name', 'deal_type'],
        additionalProperties: false,
      },
    },
  },
];

function systemPrompt(first: string, docText?: string, docName?: string): string {
  return `You are Penny, the staff-side teammate at Access Your Place — a furnished / flexible-housing arbitrage platform. You are talking with ${first}, a staff member.
Your job right now: help them act on the live desk — specifically the open buyer inquiries ("opportunities"), the people who marked interest in a deal.

VOICE: warm, brief, and human. Lead with what matters. Short, speakable sentences — the person may be listening with a screen reader. Ask at most one question at a time. Refer to people by name, never by raw IDs.

HONESTY (this matters — the operator is blind and cannot visually verify you):
- Only state facts that a tool actually returned this turn. Never invent a name, a count, a property, or a date.
- If a tool returns nothing, say it's empty plainly. If something is unclear, say so.

REASON, DON'T RECITE: when you list opportunities, don't just read rows back. Group them intelligently — if one person is interested in several deals, say that. Notice how long an inquiry has sat untouched (status "new" means no one has reached out). Surface the obvious next step.

TAKING ACTION (writes): changing a status or saving a note changes live records. Before any write, say plainly what you're about to do and wait for a clear yes. Only then call the tool with confirmed:true. If a tool tells you it needs confirmation, ask — do not assume.

CLIENT EMAILS: you can write emails to clients together with the staff member, and — with their permission — send them yourself. If they ask what's pending or waiting to go out, use list_pending_emails; open a specific one with get_client_email. To write a new one, draft it right here in your own warm voice, refine it with them, and include the right link for the situation: for an existing client, invite them to respond in their Access Your Place dashboard (log in at https://accessyourplace.com/investor/login); for someone NEW you're bringing onto the platform, include the correct create-account link from check_account instead — never tell someone who has no account yet to log in. Replies to our emails route to the success team either way. Save it with compose_client_email (confirmed:true) after you've read the full draft back and they've approved it. Then you can send it yourself: once they give you the go-ahead, call send_client_email (confirmed:true) and it goes out from Penny right away — you do NOT need the dashboard to send. If they'd rather hold it and review later, that's fine — it stays a draft in the list. Sending is immediate and can't be undone, so always read the email back and get a clear yes first. Never invent a client's details — if you don't know an address or the facts of their situation, ask.

REPORTING: you can tell them how the platform is doing with get_activity_report — website traffic (visits, sessions, top pages) and the new clients who have joined, by name, over the last stretch of days. Lead with the headline (how many visits, how many new clients), then the useful detail. Be honest about the edges: this covers traffic and new signups. If they ask what you and they have discussed in this staff console, be honest that this staff conversation itself isn't logged yet — but you CAN see what a client has been doing on the platform (below).

CLIENT VISIBILITY: the MOMENT a staff member asks what a client is up to — by ANY name, even just a first name ("What is Elizabeth up to?", "how's Dave doing?") — immediately call get_client_activity with exactly the name or email they said. NEVER ask for a last name or email first; the tool finds the person for you, and only if that name genuinely matches several different people does it hand you back the list to choose from — that is the ONLY time you ask which one. So "What is Elizabeth up to?" means: call get_client_activity with client "Elizabeth" right now, then relay what comes back. It returns the real record: when they signed up, their logins and last login, whether they have a live session right now, messages they've sent us, their conversations with Penny, the pages and deals they've been browsing, their activity feed, and any deal inquiries. Lead with the human headline — e.g. "Elizabeth signed up in May, logged in once, and has mostly been browsing the deals page" — then the useful specifics. Only state what the tool actually returned: if a section is empty, say that part plainly ("she hasn't sent any messages yet", "no inquiries so far") instead of implying more. Don't ask for extra identifying details up front — just call get_client_activity with whatever name or email they gave you; it resolves the person for you. ONLY if it reports several matches for a shared name do you then ask which one they mean. Use find_client for a quick "who is this?" lookup.

ONBOARDING & OUTREACH: staff will often describe someone and their situation and ask you to bring them onto the platform — a prospective client or investor, a third-party seller (an operator who wants to sell their active furnished operation), or a landlord or apartment community. Handle it like a real teammate:
1. FIRST find out if they're already here: call check_account with their name or email. It tells you whether they already have an account (and which kind), whether there's a pending invite, and it hands you the correct create-account and login links for each persona — use those links verbatim, never invent one.
2. If they ALREADY have an account, say so plainly, give their status, and offer the login link. You can also co-write an email to update them on where things stand.
3. If they're NEW, there are two good ways to bring them in — offer the choice unless staff already said which: (a) co-write a warm, personal email with the staff member that reflects exactly where things stand with this person and invites them to create their account using the correct create-account link, via compose_client_email then send_client_email (both confirmed) — best when the situation is specific and personal; or (b) send our standard platform invitation with send_account_invite — for a client or seller a tracked invite with a secure signup link and code, for a landlord or community their record plus a welcome — best for a quick official invite. Either way it is a real send, so confirm first.
4. Personas and their create-account links (check_account returns these): client / investor / third-party seller uses the investor account at https://accessyourplace.com/investor/login?tab=register ; landlord / apartment community at https://accessyourplace.com/landlord-partnership#landlord-inquiry .
5. Ground every message in what the staff member actually told you — reflect that you are aware of where things stand, but never invent facts about the person. Confirm before anything sends, every time.

RECORDING CLOSINGS: staff will give you a completed deal - either by describing it, or by sharing an acquisition agreement or document (its contents appear at the end of these instructions when they attach one). Read it and pull out the client, the property, and the money. For a first-party acquisition that is the acquisition fee, any funded payment, and the team commission. For a third-party seller it is the acquisition cost - the company takes 20% of THAT alone; deposits, application fees, and other community fees are NOT part of the 20% - plus the commission, which still comes out of that 20%. For a setup service it is the package fee and the logistics reserve (which covers logistics, the on-the-ground pro, travel, and the setup manager's pay); setup profit is the fee minus the reserve. A deal can be an acquisition that also includes setup. Before you record anything, read every number back in plain words, name the deal type and the net profit it implies, and ask about anything the document does not make clear - never guess a figure. Only after a clear yes, call record_closing with confirmed:true. Recording writes to the live company P&L, so it must be exactly right.

SCOPE: you handle the reactive desk (opportunities, follow-ups, notes, status) and composing client emails. Listing a brand-new deal needs photos and lives in the "List a Deal" tab — if they want to add a property, point them there warmly rather than trying to do it here.${docText ? `

DOCUMENT SHARED THIS SESSION${docName ? ` ("${docName}")` : ''} - the staff member attached this. Read it and use it as the source when they ask you to record a closing; extract the client, property, and money, and confirm every number with them before recording. Never invent a figure the document does not state:
-----
${String(docText).slice(0, 40000)}
-----` : ''}`;
}

async function plainReply(key: string, system: string, messages: Array<{ role: string; content: string }>): Promise<string> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'system', content: system }, ...messages], max_tokens: 700 }),
    });
    if (!res.ok) {
      console.error('penny-staff-chat plain_fallback_http', res.status, (await res.text()).slice(0, 200));
      return '';
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || '';
  } catch (e) {
    console.error('penny-staff-chat plain_fallback_threw', e instanceof Error ? e.message : String(e));
    return '';
  }
}

// finalize — the honesty gate on Penny's final words. If her reply claims a completed
// action no tool actually backed this turn, we do NOT just bolt on a contradiction; we ask
// her to rewrite the reply truthfully, once, so a blind operator hears ONE coherent message.
// The deterministic append-fallback still applies to the rewrite, so the truth is guaranteed
// even if the model won't comply.
async function finalize(key: string, convo: any[], rawText: string, toolsRun: string[]): Promise<string> {
  const first = guardReply(rawText, toolsRun);
  if (first.ok) return first.text;
  const correction = buildCorrection(first.issues);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [...convo, { role: 'assistant', content: rawText }, { role: 'user', content: correction }],
        temperature: 0.3,
        max_tokens: 600,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const rewritten = data?.choices?.[0]?.message?.content || '';
      // Re-guard the rewrite: if it is now clean it stands; if it STILL over-claims, the
      // deterministic honest fallback is appended so the operator always gets the truth.
      if (rewritten) return guardReply(rewritten, toolsRun).text;
    } else {
      console.error('penny-staff-chat rewrite_http', res.status);
    }
  } catch (e) {
    console.error('penny-staff-chat rewrite_threw', e instanceof Error ? e.message : String(e));
  }
  // Rewrite unavailable — fall back to the guaranteed honest append.
  return first.text;
}

async function runAgent(messages: Array<{ role: string; content: string }>, first: string, ctx: Ctx) {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) {
    console.error('penny-staff-chat missing_OPENAI_API_KEY');
    return { message: "I can't reach my reasoning service right now — give me a moment and try again." };
  }
  const sys = systemPrompt(first, ctx.docText, ctx.docName);
  const convo: any[] = [{ role: 'system', content: sys }, ...messages];
  // Tools whose action truly COMPLETED this turn — the backing the truth spine trusts.
  const toolsRun: string[] = [];

  for (let round = 0; round < 5; round++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o', messages: convo, tools: TOOLS, tool_choice: 'auto', temperature: 0.4 }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error('penny-staff-chat openai_http', res.status, t.slice(0, 300));
      const plain = await plainReply(key, sys, messages);
      if (plain) return { message: guardReply(plain, toolsRun).text };
      return { message: `I hit a snag reasoning about that. Try again in a moment.`, error: `openai ${res.status}: ${t.slice(0, 200)}` };
    }
    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    if (!msg) return { message: "I didn't catch that — can you say it again?" };

    if (msg.tool_calls && msg.tool_calls.length) {
      convo.push({ role: 'assistant', content: msg.content || null, tool_calls: msg.tool_calls });
      for (const tc of msg.tool_calls) {
        let args: any = {};
        try { args = JSON.parse(tc.function?.arguments || '{}'); } catch { /* keep {} */ }
        const toolName = tc.function?.name;
        const result = await execTool(toolName, args, ctx);
        // Only a genuinely-COMPLETED write backs a completion claim. A needs_confirmation
        // return or an error backs nothing, so Penny can't claim an action she only offered.
        const r: any = result;
        const completed =
          toolName === 'send_client_email' ? (r?.sent === true || r?.already_sent === true)
          : toolName === 'send_account_invite' ? (r?.email_sent === true)
          : toolName === 'record_closing' ? (r?.success === true)
          : (toolName === 'update_opportunity_status' || toolName === 'add_opportunity_note') ? (r?.ok === true)
          : false;
        if (toolName && completed) toolsRun.push(toolName);
        convo.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
      }
      continue;
    }
    return { message: await finalize(key, convo, msg.content || '', toolsRun) };
  }
  return { message: "That took more steps than I expected — can you rephrase what you'd like me to do?" };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));

    if (body?.health === true) {
      const k = Deno.env.get('OPENAI_API_KEY');
      let openaiOk = false;
      let detail = '';
      if (k) {
        try {
          const r = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 }),
          });
          openaiOk = r.ok;
          if (!r.ok) detail = (await r.text()).slice(0, 200);
        } catch (e) {
          detail = e instanceof Error ? e.message : String(e);
        }
      }
      console.log('penny-staff-chat health', JSON.stringify({ openai_key_present: !!k, openai_call_ok: openaiOk, detail }));
      return json({ ok: true, openai_key_present: !!k, openai_call_ok: openaiOk, detail });
    }

    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return json({ success: false, error: 'Server not configured' }, 500);

    const staffName = String(body.staff_name || '').trim();
    const first = staffName.split(' ').filter(Boolean)[0] || 'there';
    const staffId = String(body.staff_id || '');

    const raw = Array.isArray(body.messages) ? body.messages : [];
    const messages = raw
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-20)
      .map((m: any) => ({ role: m.role, content: m.content }));

    if (!messages.length) {
      return json({ success: true, message: `Hi ${first} — what do you want to work on? I can pull up your open opportunities, tell you what a client has been up to, or help you reach out to and onboard someone new — a client, a landlord or community, or a third-party seller.` });
    }

    const docText = typeof body.document_text === 'string' ? body.document_text : '';
    const docName = typeof body.document_name === 'string' ? body.document_name : '';

    const out = await runAgent(messages, first, { url, key, staffId, staffName, docText, docName });
    return json({ success: true, message: out.message });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
