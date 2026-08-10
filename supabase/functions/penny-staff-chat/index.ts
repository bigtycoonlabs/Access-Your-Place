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

// SHARED SPINE (Phase 2): identity-level doctrine now comes from _shared/penny/ rather
// than being restated inline here. Before this, the owner posture existed TWICE — a live
// untested copy in this file and a tested copy in compose.ts — which is drift by
// construction. The tested one is now the only one.
//
// PENNY_PAYMENT_DOCTRINE and containsPaymentDestination were previously imported by ZERO
// live functions: the guard written to stop Penny reciting a Bitcoin address or a Zelle
// tag was protecting nothing, and this file contained no payment guidance at all. Staff
// are the people most likely to be asked "where do I send it", so she would have
// improvised. She no longer can.
import { PENNY_PAYMENT_DOCTRINE, containsPaymentDestination, destinationRefusal, PENNY_OWNERSHIP, PENNY_REASONING, PENNY_PERSONALITY, PENNY_INDUSTRY_SENSE, PENNY_COVENANT, PENNY_TEAM, PENNY_ROUTING } from "../_shared/penny/doctrine.ts";
import { PENNY_OWNER_POSTURE } from "../_shared/penny/compose.ts";

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

// ---- the third-party sale flow and the landlord portal ----
//
// Both were half-built: the UI offered them and the handlers did not exist. Now that they
// work, Penny needs to see them. Read-only — approving a listing, completing a
// verification and releasing funds are staff decisions with money attached.

async function sellerFlow(url: string, key: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_seller_flow');
  if (!ok) {
    console.error('penny-staff-chat rpc_seller_flow', status, JSON.stringify(data).slice(0, 200));
    return { error: `read_failed_${status}` };
  }
  return data;
}

async function landlordPortal(url: string, key: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_landlord_portal');
  if (!ok) {
    console.error('penny-staff-chat rpc_landlord_portal', status, JSON.stringify(data).slice(0, 200));
    return { error: `read_failed_${status}` };
  }
  return data;
}

// ---- company client files ----
//
// 475 relationships that lived in a spreadsheet. 461 of them have NO platform account, and
// they are not strangers — every one has been spoken to and many took a property. The
// distinction Penny must never blur: a client FILE is what we know about someone; an
// ACCOUNT is something they can sign into.

async function mySop(url: string, key: string, staffId: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_my_sop', { p_staff_id: staffId });
  if (!ok) return { error: `read_failed_${status}` };
  return data;
}

async function listThirdPartyDeal(url: string, key: string, a: any, staffId: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_list_third_party_deal', {
    p_seller_name: String(a.seller_name), p_seller_email: String(a.seller_email),
    p_asking_price: a.asking_price ?? null, p_by_staff_id: staffId || null,
    p_seller_phone: a.seller_phone ? String(a.seller_phone) : null,
    p_notes: a.notes ? String(a.notes) : null,
  });
  if (!ok) return { error: 'list_failed', http: status };
  return data;
}

async function payoutStatus(url: string, key: string, staffId: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_staff_payout_status', { p_staff_id: staffId });
  if (!ok) return { error: `read_failed_${status}` };
  return data;
}

async function savePayout(url: string, key: string, a: any, staffId: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_save_staff_payout', {
    p_staff_id: staffId, p_method: String(a.method), p_destination: String(a.destination),
    p_account_name: a.account_name ? String(a.account_name) : null,
    p_bank_name: a.bank_name ? String(a.bank_name) : null,
    p_make_default: a.make_default !== false,
  });
  if (!ok) {
    console.error('penny-staff-chat rpc_save_payout', status);
    return { error: 'save_failed', http: status };
  }
  return data;
}

async function myAgreements(url: string, key: string, staffId: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_my_agreements', { p_staff_id: staffId });
  if (!ok) return { error: `read_failed_${status}` };
  return data;
}

async function sendAgreement(url: string, key: string, a: any, staffId: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_send_agreement', {
    p_title: String(a.title), p_body: a.body ? String(a.body) : null,
    p_to_staff_id: a.to_staff_id ? String(a.to_staff_id) : null,
    p_by: staffId, p_due: a.due_by ? String(a.due_by) : null,
    p_url: a.document_url ? String(a.document_url) : null,
  });
  if (!ok) return { error: 'send_failed', http: status };
  return data;
}

async function signAgreement(url: string, key: string, a: any, staffId: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_sign_agreement', {
    p_agreement_id: String(a.agreement_id), p_staff_id: staffId,
    p_typed_name: String(a.typed_name || ''),
  });
  if (!ok) return { error: 'sign_failed', http: status };
  return data;
}

async function myAlerts(url: string, key: string, staffId: string) {
  // Refresh derived join alerts first, so someone who signed up minutes ago is already
  // there. A notification system that only updates on a schedule is one people learn to
  // distrust.
  await rpc(url, key, 'ayp_sync_join_alerts').catch(() => null);
  const { ok, status, data } = await rpc(url, key, 'penny_my_alerts', { p_staff_id: staffId });
  if (!ok) {
    console.error('penny-staff-chat rpc_my_alerts', status, JSON.stringify(data).slice(0, 200));
    return { error: `read_failed_${status}` };
  }
  return data;
}

async function assignManager(url: string, key: string, a: any, staffId: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_assign_manager', {
    p_file_id: String(a.file_id), p_staff_id: String(a.staff_id || staffId),
    p_role: String(a.role), p_by: staffId || null,
  });
  if (!ok) {
    console.error('penny-staff-chat rpc_assign_manager', status, JSON.stringify(data).slice(0, 200));
    return { error: 'assign_failed', http: status };
  }
  return data;
}

async function presentDeal(url: string, key: string, a: any, staffId: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_present_deal', {
    p_property_id: String(a.property_id), p_client_file_id: String(a.client_file_id),
    p_by_staff_id: staffId || null, p_why: a.why ? String(a.why) : null,
  });
  if (!ok) {
    console.error('penny-staff-chat rpc_present_deal', status, JSON.stringify(data).slice(0, 200));
    return { error: 'present_failed', http: status };
  }
  return data;
}

async function assignClientFile(url: string, key: string, fileId: string, toStaffId: string, byStaffId: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_assign_client_file', {
    p_file_id: fileId, p_to_staff_id: toStaffId, p_by_staff_id: byStaffId || null,
  });
  if (!ok) {
    console.error('penny-staff-chat rpc_assign_file', status, JSON.stringify(data).slice(0, 200));
    return { error: 'assign_failed', http: status };
  }
  return data;
}

async function logTouch(url: string, key: string, a: any, staffId: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_log_touch', {
    p_file_id: String(a.file_id), p_note: String(a.note || ''), p_staff_id: staffId || null,
    p_next_step: a.next_step ? String(a.next_step) : null,
    p_next_step_due: a.next_step_due ? String(a.next_step_due) : null,
  });
  if (!ok) {
    console.error('penny-staff-chat rpc_log_touch', status, JSON.stringify(data).slice(0, 200));
    return { error: 'log_failed', http: status };
  }
  return data;
}

async function myBook(url: string, key: string, staffId: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_my_book', { p_staff_id: staffId });
  if (!ok) {
    console.error('penny-staff-chat rpc_my_book', status, JSON.stringify(data).slice(0, 200));
    return { error: `read_failed_${status}` };
  }
  return data;
}

async function whoToContact(url: string, key: string, staffId: string, limit?: number) {
  const { ok, status, data } = await rpc(url, key, 'penny_who_to_contact', {
    p_staff_id: staffId || null, p_limit: limit ?? 12,
  });
  if (!ok) {
    console.error('penny-staff-chat rpc_who_to_contact', status, JSON.stringify(data).slice(0, 200));
    return { error: `read_failed_${status}` };
  }
  const rows = Array.isArray(data) ? data : [];
  return { count: rows.length, people: rows };
}

async function claimAlert(url: string, key: string, alertId: string, staffId: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_claim_alert', {
    p_alert_id: alertId, p_staff_id: staffId,
  });
  if (!ok) return { error: 'claim_failed', http: status };
  return data;
}

async function teamReadiness(url: string, key: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_team_readiness');
  if (!ok) return { error: `read_failed_${status}` };
  return data;
}

async function clientBook(url: string, key: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_client_book');
  if (!ok) {
    console.error('penny-staff-chat rpc_client_book', status, JSON.stringify(data).slice(0, 200));
    return { error: `read_failed_${status}` };
  }
  return data;
}

async function findClientFile(url: string, key: string, q: string, limit?: number) {
  const { ok, status, data } = await rpc(url, key, 'penny_find_client_file', {
    p_query: q || '', p_limit: limit ?? 10,
  });
  if (!ok) {
    console.error('penny-staff-chat rpc_find_file', status, JSON.stringify(data).slice(0, 200));
    return { error: `read_failed_${status}` };
  }
  const rows = Array.isArray(data) ? data : [];
  return {
    count: rows.length,
    on_platform: rows.filter((r: any) => r.on_platform).length,
    files: rows.map((r: any) => ({
      ...r,
      standing: r.on_platform
        ? (r.platform_last_login ? 'has an account and uses it' : 'has an account but has NEVER signed in')
        : 'in our records only — no platform account',
    })),
  };
}

async function clientFileOverview(url: string, key: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_client_file_overview');
  if (!ok) {
    console.error('penny-staff-chat rpc_file_overview', status, JSON.stringify(data).slice(0, 200));
    return { error: `read_failed_${status}` };
  }
  return data;
}

async function updateClientFile(url: string, key: string, a: any, staffId: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_update_client_file', {
    p_file_id: String(a.file_id), p_field: String(a.field), p_value: String(a.value ?? ''),
    p_staff_id: staffId || null,
  });
  if (!ok) {
    console.error('penny-staff-chat rpc_update_file', status, JSON.stringify(data).slice(0, 200));
    return { error: 'update_failed', http: status };
  }
  return data;
}

// ---- the knowledge library ----
//
// The library shipped invented permit fees. So Penny can DRAFT and she can ROUTE, but she
// cannot publish: penny-write-article always lands a draft as needs_review, and only
// penny_decide_article publishes, which requires a staff id.

async function articlesNeedingWork(url: string, key: string, limit?: number) {
  const { ok, status, data } = await rpc(url, key, 'penny_articles_needing_work', { p_limit: limit ?? 10 });
  if (!ok) {
    console.error('penny-staff-chat rpc_articles_work', status, JSON.stringify(data).slice(0, 200));
    return { error: `read_failed_${status}` };
  }
  const rows = Array.isArray(data) ? data : [];
  return { count: rows.length, articles: rows };
}

async function articlesAwaitingReview(url: string, key: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_articles_awaiting_review');
  if (!ok) {
    console.error('penny-staff-chat rpc_articles_review', status, JSON.stringify(data).slice(0, 200));
    return { error: `read_failed_${status}` };
  }
  const rows = Array.isArray(data) ? data : [];
  return {
    count: rows.length,
    // Surfaced first because it is the thing a reviewer must not skim past.
    with_unsourced_claims: rows.filter((r: any) => (r.unsourced_claim_count || 0) > 0).length,
    articles: rows,
  };
}

async function decideArticle(url: string, key: string, id: string, approve: boolean, staffId: string, notes?: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_decide_article', {
    p_article_id: id, p_approve: approve, p_staff_id: staffId || null, p_notes: notes || null,
  });
  if (!ok) {
    console.error('penny-staff-chat rpc_decide_article', status, JSON.stringify(data).slice(0, 200));
    return { error: 'decision_failed', http: status };
  }
  return data;
}

async function republishArticle(url: string, key: string, draftId: string, staffId: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_republish_article', {
    p_draft_id: draftId, p_staff_id: staffId || null, p_force: false,
  });
  if (!ok) {
    console.error('penny-staff-chat rpc_republish', status, JSON.stringify(data).slice(0, 200));
    return { error: 'republish_failed', http: status };
  }
  // The RPC refuses when the rewrite carries unsourced claims and names them. Pass that
  // straight through — it is the whole point of the guard.
  return data;
}

async function writeArticle(url: string, key: string, a: any, staffId: string) {
  const res = await fetch(`${url}/functions/v1/penny-write-article`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      mode: a.article_id ? 'rewrite' : 'new',
      article_id: a.article_id || null,
      topic: a.topic || null, city: a.city || null, state: a.state || null,
      staff_id: staffId || null,
    }),
  });
  const out = await res.json().catch(() => null);
  if (!out) return { error: `The writer returned ${res.status} with no readable body. Nothing was saved.` };
  // A rate limit is not a retry. It means the writer was called in a burst, and calling it
  // again immediately makes it worse. Passed through so Penny stops rather than hammering.
  if (out.rate_limited) {
    return { ...out, stop_batching: true,
      note: 'Rate limited. Do NOT call this again this turn — tell them what you finished and offer to continue in a moment.' };
  }
  return out;
}

// ---- what she notices without being asked ----
//
// She had knowledge, memory, tools and judgement, and still walked in blind — every
// conversation opened with her asking what was needed. That is the gap between a
// competent assistant and a colleague. A colleague already knows, and leads with the
// thing that is wrong.
async function loadAttention(url: string, key: string) {
  const { ok, data } = await rpc(url, key, 'penny_attention');
  if (!ok) return null;
  return data;
}

// ---- memory ----
//
// She had none. Every conversation started cold, which quietly contradicts the claim that
// she is the colleague who has been here since the beginning.
//
// Memory can be about the STAFF MEMBER or about a CLIENT. The client kind is the valuable
// one: "this landlord went quiet once already" belongs to the file, not to whoever
// happened to hear it, so it surfaces for whoever picks it up next.

async function recallMemory(url: string, key: string, staffId: string, subjectId?: string) {
  if (!staffId) return [];
  const { ok, data } = await rpc(url, key, 'penny_recall', {
    p_staff_id: staffId, p_subject_id: subjectId || null,
  });
  if (!ok) return [];
  return Array.isArray(data) ? data : [];
}

async function rememberFact(url: string, key: string, staffId: string, a: any) {
  const { ok, status, data } = await rpc(url, key, 'penny_remember', {
    p_staff_id: staffId,
    p_key: String(a.key || ''),
    p_value: String(a.value || ''),
    p_subject_type: String(a.about_type || 'staff'),
    p_subject_id: a.about_id ? String(a.about_id) : null,
    p_subject_label: a.about_name ? String(a.about_name) : null,
    p_source: a.source ? String(a.source) : null,
  });
  if (!ok) {
    console.error('penny-staff-chat rpc_remember', status, JSON.stringify(data).slice(0, 200));
    return { error: 'remember_failed' };
  }
  return data;
}

async function forgetFact(url: string, key: string, staffId: string, a: any) {
  const { ok, status, data } = await rpc(url, key, 'penny_forget', {
    p_staff_id: staffId, p_key: String(a.key || ''),
    p_subject_id: a.about_id ? String(a.about_id) : null,
    p_subject_type: String(a.about_type || 'staff'),
  });
  if (!ok) {
    console.error('penny-staff-chat rpc_forget', status, JSON.stringify(data).slice(0, 200));
    return { error: 'forget_failed' };
  }
  return data;
}

// ---- money: quote a deal, check forge status, create a payment link ----
//
// Penny never does money maths in her head and never recites a destination. She calls
// these, reads back what they return, and hands over a link.

async function dealQuote(url: string, key: string, propertyId: string, investorId: string) {
  const { ok, status, data } = await rpc(url, key, 'ayp_acquisition_quote', {
    p_property_id: propertyId, p_investor_id: investorId,
  });
  if (!ok) {
    console.error('penny-staff-chat rpc_quote', status, JSON.stringify(data).slice(0, 200));
    return { error: `quote_failed_${status}` };
  }
  return data;
}

async function forgeStatus(url: string, key: string, investorId: string) {
  const { ok, status, data } = await rpc(url, key, 'ayp_forge_status', { p_investor_id: investorId });
  if (!ok) {
    console.error('penny-staff-chat rpc_forge_status', status, JSON.stringify(data).slice(0, 200));
    return { error: `read_failed_${status}` };
  }
  return data;
}

async function releaseProperty(url: string, key: string, investorId: string, propertyId: string, staffId: string) {
  const { ok, status, data } = await rpc(url, key, 'ayp_release_property', {
    p_investor_id: investorId, p_property_id: propertyId, p_staff_id: staffId || null, p_idempotency_key: null,
  });
  if (!ok) {
    console.error('penny-staff-chat rpc_release', status, JSON.stringify(data).slice(0, 200));
    return { error: `release_failed_${status}` };
  }
  return data;
}

async function paymentLink(url: string, key: string, investorId: string, purpose: string, propertyId: string | null, staffId: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_create_payment_request', {
    p_investor_id: investorId, p_purpose: purpose, p_property_id: propertyId, p_staff_id: staffId || null,
  });
  if (!ok) {
    console.error('penny-staff-chat rpc_payment_request', status, JSON.stringify(data).slice(0, 200));
    return { error: `payment_link_failed_${status}` };
  }
  return data;
}

// ---- leads, moderation, portfolio ----
//
// The leads gap was the urgent one. /start and /list-your-property write to `leads`, and
// NO tool read them, so an inbound client or landlord could sit unseen indefinitely. A
// real one was found sitting there when these were built.

async function listLeads(url: string, key: string, limit?: number) {
  const { ok, status, data } = await rpc(url, key, 'penny_open_leads', { p_limit: limit ?? 25 });
  if (!ok) {
    console.error('penny-staff-chat rpc_open_leads', status, JSON.stringify(data).slice(0, 200));
    return { count: 0, leads: [], error: `read_failed_${status}` };
  }
  const rows = Array.isArray(data) ? data : [];
  const KIND: Record<string, string> = {
    need_property: 'wants a property',
    have_property: 'landlord with a property',
    live_operation_help: 'LIVE OPERATION — needs help now',
    sell_operation: 'wants to sell an operation',
    verify_scan: 'wants a scan verified',
  };
  return {
    count: rows.length,
    urgent_count: rows.filter((r: any) => r.urgent).length,
    leads: rows.map((r: any) => ({
      lead_id: r.id,
      who: r.name,
      email: r.email,
      phone: r.phone || null,
      wants: KIND[r.form_type] || r.form_type,
      urgent: r.urgent === true,
      city: r.city || null,
      property: r.property_address || null,
      said: r.message || null,
      status: r.status,
      came_from: r.source || null,
      arrived: r.created_at,
    })),
  };
}

async function setLeadStatus(url: string, key: string, leadId: string, status: string, staffId: string) {
  const { ok, status: code, data } = await rpc(url, key, 'penny_set_lead_status', {
    p_lead_id: leadId, p_status: status, p_staff_id: staffId || null,
  });
  if (!ok) {
    console.error('penny-staff-chat rpc_set_lead_status', code, JSON.stringify(data).slice(0, 200));
    return { error: 'update_failed', http: code };
  }
  return data;
}

async function setClientActive(url: string, key: string, investorId: string, active: boolean, reason: string, staffId: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_set_investor_active', {
    p_investor_id: investorId, p_active: active, p_reason: reason || null, p_staff_id: staffId || null,
  });
  if (!ok) {
    console.error('penny-staff-chat rpc_set_investor_active', status, JSON.stringify(data).slice(0, 200));
    return { error: 'update_failed', http: status };
  }
  return data;
}

async function clientPortfolio(url: string, key: string, investorId: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_client_portfolio', { p_investor_id: investorId });
  if (!ok) {
    console.error('penny-staff-chat rpc_client_portfolio', status, JSON.stringify(data).slice(0, 200));
    return { error: `read_failed_${status}` };
  }
  const rows = Array.isArray(data) ? data : [];
  return {
    count: rows.length,
    total_monthly_earnings: rows.reduce((n: number, r: any) => n + Number(r.monthly_earnings || 0), 0),
    units: rows.map((r: any) => ({
      address: r.address, where: [r.city, r.state].filter(Boolean).join(', '),
      status: r.status, monthly_rent: r.monthly_rent, monthly_earnings: r.monthly_earnings,
    })),
  };
}

// ---- marketplace ----
//
// Penny had NO reach into properties at all. Her "opportunities" are deal INQUIRIES, so
// she could discuss interest in a listing while being unable to see, add or remove one.
// The owner needed exactly those two things to start operating, so these exist.
//
// Everything goes through an RPC, as with every other tool here, so the rules live in the
// database rather than in her prompt where a rewording could lose them.

async function listMarketplace(url: string, key: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_marketplace_listings');
  if (!ok) {
    console.error('penny-staff-chat rpc_marketplace', status, JSON.stringify(data).slice(0, 200));
    return { count: 0, listings: [], error: `read_failed_${status}` };
  }
  const rows = Array.isArray(data) ? data : [];
  return {
    count: rows.length,
    listings: rows.map((r: any) => ({
      property_id: r.id,
      address: r.address,
      where: [r.city, r.state].filter(Boolean).join(', '),
      title: r.listing_title || null,
      status: r.status,
      live: r.is_published === true,
      monthly_rent: r.monthly_rent,
      bedrooms: r.bedrooms,
      verification_tier: r.verification_tier || 'penny_scan',
    })),
  };
}

async function unpublishProperty(url: string, key: string, propertyId: string, reason: string, staffId: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_unpublish_property', {
    p_property_id: propertyId, p_reason: reason || null, p_staff_id: staffId || null,
  });
  if (!ok) {
    console.error('penny-staff-chat rpc_unpublish', status, JSON.stringify(data).slice(0, 200));
    return { error: 'unpublish_failed', http: status };
  }
  // The RPC reports its own refusals - already down, no such property - and they are
  // passed straight through rather than being flattened into a generic failure.
  return data;
}

async function addProperty(url: string, key: string, a: any, staffId: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_add_property', {
    p_address: String(a.address || ''),
    p_city: String(a.city || ''),
    p_state: String(a.state || ''),
    p_monthly_rent: a.monthly_rent != null ? Number(a.monthly_rent) : null,
    p_bedrooms: a.bedrooms != null ? Number(a.bedrooms) : null,
    p_landlord_name: a.landlord_name ? String(a.landlord_name) : null,
    p_landlord_phone: a.landlord_phone ? String(a.landlord_phone) : null,
    p_notes: a.notes ? String(a.notes) : null,
    p_staff_id: staffId || null,
  });
  if (!ok) {
    console.error('penny-staff-chat rpc_add_property', status, JSON.stringify(data).slice(0, 200));
    return { error: 'add_failed', http: status };
  }
  return data;
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
// ONE INTENT, ONE CONFIRMATION.
//
// Sending an email used to take TWO confirmations: compose asked, the staff member said
// yes, then send asked essentially the same question again. If the email_id was lost
// between turns she started over — which is exactly what happened when an owner confirmed
// three times and no email was ever sent. The last draft in the table predated the
// attempt by a week, so compose never even ran.
//
// "Send Elizabeth an email saying X", confirmed once, IS the confirmation. This composes
// and sends in one step and reports what actually happened at each stage.
async function emailClientNow(url: string, key: string, a: any, staffId: string, staffName: string) {
  const composed: any = await composeClientEmail(url, key, a, staffId, staffName);
  if (!composed?.ok || !composed.email_id) {
    return { error: composed?.error || 'compose_failed', sent: false,
             note: 'The draft could not be saved, so nothing was sent.' };
  }
  const sent: any = await sendClientEmail(url, key, String(composed.email_id), staffId, staffName);
  if (sent?.error) {
    // The draft survives so it can be retried rather than rewritten.
    return { ...sent, sent: false, email_id: composed.email_id,
             note: 'The draft was saved but the send failed. It is kept and can be retried.' };
  }
  return { ...sent, email_id: composed.email_id };
}

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

// ---- community / property status (staff keep Penny current; client-facing Penny reads it) ----
async function listCommunities(url: string, key: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_list_communities');
  if (!ok) {
    console.error('penny-staff-chat rpc_list_communities', status, JSON.stringify(data).slice(0, 200));
    return { error: 'read_failed', http: status };
  }
  return data;
}

async function getCommunity(url: string, key: string, query: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_get_community', { p_query: query });
  if (!ok) {
    console.error('penny-staff-chat rpc_get_community', status, JSON.stringify(data).slice(0, 200));
    return { error: 'read_failed', http: status };
  }
  return data;
}

async function upsertCommunity(url: string, key: string, a: any, staffId: string, staffName: string) {
  const { ok, status, data } = await rpc(url, key, 'penny_upsert_community_update', {
    p_community: String(a.community_name),
    p_location: a.location != null ? String(a.location) : null,
    p_is_listed: typeof a.is_listed === 'boolean' ? a.is_listed : null,
    p_status: a.status_summary != null ? String(a.status_summary) : null,
    p_update: a.update_text != null ? String(a.update_text) : null,
    p_client_notes: a.client_facing_notes != null ? String(a.client_facing_notes) : null,
    p_by: staffId || null,
    p_by_name: staffName || null,
  });
  if (!ok) {
    console.error('penny-staff-chat rpc_upsert_community', status, JSON.stringify(data).slice(0, 200));
    return { error: 'save_failed', http: status };
  }
  if (data && data.ok === false) return { error: data.error || 'save_failed' };
  return data; // { ok:true, community_name, status_summary, client_facing_notes, created, ... }
}

// ---- staff invites (OWNERS ONLY: Vission & Rel) ----------------------------
// Owner gate. Reads the requesting staff member's is_owner flag straight from the
// staff_users table (DATA_SCHEMA), so only a real owner account can invite staff — the
// client can't forge this by passing a flag; we look it up server-side by their id.
async function staffIsOwner(url: string, key: string, staffId: string): Promise<{ owner: boolean; name: string | null }> {
  if (!staffId) return { owner: false, name: null };
  try {
    // NO Accept-Profile HEADER, deliberately.
    //
    // This read failed on every request Penny ever served, which is why she could never
    // identify anyone. The reason, confirmed from pg_db_role_setting:
    //
    //     authenticator: pgrst.db_schemas = public
    //
    // PostgREST exposes ONLY the public schema. Asking for Accept-Profile:
    // prj_X-ZoVQv6LKXT names a schema it will not serve, so the request is rejected,
    // res.ok is false, and staffIsOwner returns { owner: false, name: null } — which the
    // caller correctly reads as "I don't know who this is".
    //
    // Everything about the request was right except the schema it asked for: correct
    // staff id, correct columns, correct service key, a row that exists. That is why it
    // survived four rounds of debugging — nothing looked wrong.
    //
    // public.staff_users is a VIEW over the same base table and now exposes is_owner (see
    // migration expose_is_owner_on_public_staff_users_view), so dropping the header reads
    // the same rows through the schema PostgREST actually serves.
    //
    // The alternative was adding prj_X-ZoVQv6LKXT to pgrst.db_schemas. That would fix
    // every function carrying this header at once, but it would also publish 281 tables
    // to the REST API where only curated public views are reachable today. Owner chose
    // the contained fix; this is it.
    const res = await fetch(`${url}/rest/v1/staff_users?id=eq.${encodeURIComponent(staffId)}&select=is_owner,is_active,name,first_name,last_name`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) { console.error('penny-staff-chat staff_is_owner_http', res.status); return { owner: false, name: null }; }
    const rows = await res.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return { owner: false, name: null };
        // Fall back through the name columns so a row with a null `name` still identifies
    // the person, rather than making Penny claim she cannot tell who they are.
    const resolvedName = row.name
      || [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
      || null;
    return { owner: row.is_owner === true && row.is_active !== false, name: resolvedName };
  } catch (e) {
    console.error('penny-staff-chat staff_is_owner_threw', e instanceof Error ? e.message : String(e));
    return { owner: false, name: null };
  }
}

// Create a NEW staff member and send them their setup email (temporary password + a link
// to /staff/login, where they set their own password on first sign-in). Wraps the deployed,
// admin-UI-proven manage-staff add_staff. Owner-gated in execTool; this only runs after the
// owner has confirmed. Truthful: reports whether the email actually sent, and says plainly
// when the person already has an account instead of implying a fresh invite went out.
const STAFF_DEPARTMENTS = ['success_managers', 'acquisition_managers', 'setup_managers', 'content_team', 'support_team'];
async function inviteStaff(url: string, key: string, a: any) {
  const payload = {
    action: 'add_staff',
    first_name: String(a.first_name || '').trim(),
    last_name: String(a.last_name || '').trim(),
    email: String(a.email || '').trim(),
    department: String(a.department || '').trim(),
    phone: a.phone != null ? String(a.phone) : null,
  };
  const { ok, status, data } = await callFn(url, key, 'manage-staff', payload);
  const d: any = data || {};
  const errText = typeof d.error === 'string' ? d.error : (typeof data === 'string' ? data : '');
  if (!ok || d.success === false) {
    if (errText && /already exists/i.test(errText)) {
      return { already_exists: true, email: payload.email, message: `A staff member with the email ${payload.email} already exists — no new invite was sent.` };
    }
    console.error('penny-staff-chat invite_staff', status, JSON.stringify(data).slice(0, 200));
    return { error: d.error || 'invite_failed', http: status };
  }
  return {
    ok: true,
    staff_id: d.staff_id || d.id || null,
    email: payload.email,
    department: payload.department,
    email_sent: d.email_sent === true,
    email_error: d.email_error || null,
    message: d.message || `Staff account created for ${payload.email}.`,
  };
}

// ---- escalations (urgent client situations Penny flagged for a human) --------
// Read the still-open escalations straight from public.penny_escalations (service-role
// REST; public schema, so no Accept-Profile). Read-only.
async function listEscalations(url: string, key: string) {
  try {
    const res = await fetch(`${url}/rest/v1/penny_escalations?status=eq.open&select=id,user_name,user_type,summary,details,investor_id,created_at&order=created_at.asc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) { console.error('penny-staff-chat list_escalations_http', res.status); return { error: 'read_failed', http: res.status }; }
    const rows = await res.json().catch(() => []);
    const list = Array.isArray(rows) ? rows : [];
    return {
      count: list.length,
      escalations: list.map((r: any) => ({
        escalation_id: r.id,
        who: r.user_name || '(no name on record)',
        user_type: r.user_type || null,
        investor_id: r.investor_id || null,
        summary: r.summary,
        details: r.details || null,
        raised_at: r.created_at,
      })),
    };
  } catch (e) {
    console.error('penny-staff-chat list_escalations_threw', e instanceof Error ? e.message : String(e));
    return { error: 'read_failed' };
  }
}

// Mark ONE open escalation resolved, with a note. Honest by construction: returns not_found
// if the id doesn't exist and already_resolved if it was closed before, instead of implying a
// fresh resolve. There is no resolved_by column, so the resolver's name is stamped into the
// note for the audit trail. Direct service-role REST on public.penny_escalations.
async function resolveEscalation(url: string, key: string, id: string, notes: string, staffName: string) {
  try {
    const look = await fetch(`${url}/rest/v1/penny_escalations?id=eq.${encodeURIComponent(id)}&select=id,status,user_name,summary`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!look.ok) { console.error('penny-staff-chat resolve_look_http', look.status); return { error: 'read_failed', http: look.status }; }
    const rows = await look.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return { error: 'not_found', escalation_id: id };
    if (String(row.status) !== 'open') {
      return { already_resolved: true, escalation_id: id, who: row.user_name || null, status: row.status, message: `That escalation was already ${row.status} - nothing to change.` };
    }
    const by = staffName ? String(staffName).trim() : '';
    const stamped = (notes ? String(notes).trim() : '') + (by ? ` (resolved by ${by})` : '');
    const patch = await fetch(`${url}/rest/v1/penny_escalations?id=eq.${encodeURIComponent(id)}&status=eq.open`, {
      method: 'PATCH',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'resolved', resolved_at: new Date().toISOString(), resolution_notes: stamped }),
    });
    if (!patch.ok) { console.error('penny-staff-chat resolve_patch_http', patch.status); return { error: 'resolve_failed', http: patch.status }; }
    const out = await patch.json().catch(() => []);
    const saved = Array.isArray(out) ? out[0] : null;
    if (!saved) return { error: 'resolve_failed', escalation_id: id };
    return { ok: true, escalation_id: id, who: saved.user_name || row.user_name || null, resolution_notes: saved.resolution_notes || stamped, resolved_at: saved.resolved_at || null };
  } catch (e) {
    console.error('penny-staff-chat resolve_escalation_threw', e instanceof Error ? e.message : String(e));
    return { error: 'resolve_failed' };
  }
}

type Ctx = { url: string; key: string; staffId: string; staffName: string; isOwner?: boolean; identified?: boolean; fullName?: string; docText?: string; docName?: string };

async function execTool(name: string, args: any, ctx: Ctx): Promise<unknown> {
  const { url, key, staffId, staffName } = ctx;
  try {
    // find_client was retired into find_client_file, which searches the WHOLE book rather
    // than accounts only. Aliased rather than removed: if the model reaches for the old
    // name it gets the better answer instead of an error.
    if (name === 'find_client' || name === 'find_client_file') {
      if (!args?.query) return { error: 'query required' };
      return await findClientFile(url, key, String(args.query), args?.limit ? Number(args.limit) : undefined);
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
    if (name === 'email_client') {
      if (!args?.to_email || !args?.subject || !args?.body) {
        return { error: 'to_email, subject and body are all required' };
      }
      if (args.confirmed !== true) {
        return {
          needs_confirmation: true,
          action: `send this email to ${args.to_email} now`,
          instruction: 'Read the recipient, the subject and the FULL body back, then ask once. When they say yes, call this again with confirmed true — do not ask a second time.',
        };
      }
      return await emailClientNow(url, key, args, staffId, staffName);
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
    if (name === 'republish_article') {
      if (!args?.draft_id) return { error: 'draft_id required' };
      if (args.confirmed !== true) {
        return {
          needs_confirmation: true,
          action: 'replace the live article with the rewrite',
          instruction: 'Say which article, that it keeps the same web address, and that the old text is archived and can be restored. Get a yes, then call again with confirmed true.',
        };
      }
      return await republishArticle(url, key, String(args.draft_id), staffId);
    }
    if (name === 'seller_flow') return await sellerFlow(url, key);
    if (name === 'landlord_portal') return await landlordPortal(url, key);
    if (name === 'my_alerts') return await myAlerts(url, key, staffId);
    if (name === 'my_sop') return await mySop(url, key, staffId);
    if (name === 'list_third_party_deal') {
      if (!args?.seller_name || !args?.seller_email) {
        return { error: 'seller_name and seller_email are required' };
      }
      if (args.confirmed !== true) {
        return { needs_confirmation: true,
          action: `create a draft listing for ${args.seller_name}`,
          instruction: 'Say the seller, the asking price, and that it starts as a draft. Get a yes, then call again with confirmed true.' };
      }
      return await listThirdPartyDeal(url, key, args, staffId);
    }
    if (name === 'payout_status') return await payoutStatus(url, key, staffId);
    if (name === 'save_payout') {
      if (!args?.method || !args?.destination) return { error: 'method and destination required' };
      return await savePayout(url, key, args, staffId);
    }
    if (name === 'my_agreements') return await myAgreements(url, key, staffId);
    if (name === 'send_agreement') {
      if (!args?.title) return { error: 'title required' };
      if (args.confirmed !== true) {
        return { needs_confirmation: true,
          action: args.to_staff_id ? 'send this agreement for signature' : 'send this agreement to the WHOLE Success Team',
          instruction: 'Say the title and who it goes to. Get a yes, then call again with confirmed true.' };
      }
      return await sendAgreement(url, key, args, staffId);
    }
    if (name === 'sign_agreement') {
      if (!args?.agreement_id || !args?.typed_name) return { error: 'agreement_id and typed_name required' };
      return await signAgreement(url, key, args, staffId);
    }
    if (name === 'assign_manager') {
      if (!args?.file_id || !args?.role) return { error: 'file_id and role required' };
      return await assignManager(url, key, args, staffId);
    }
    if (name === 'present_deal') {
      if (!args?.property_id || !args?.client_file_id) return { error: 'property_id and client_file_id required' };
      if (args.confirmed !== true) {
        return { needs_confirmation: true,
          action: 'send this deal to the client with the address withheld',
          instruction: 'Say which property, which client, the rent and the acquisition cost. Get a yes, then call again with confirmed true.' };
      }
      return await presentDeal(url, key, args, staffId);
    }
    if (name === 'my_book') return await myBook(url, key, staffId);
    // assign_client_file set a generic owner; assign_manager sets one BY ROLE, which is
    // what the business actually needs since a client can have both an acquisition and a
    // setup manager. Old name routed to the role-aware one, defaulting to acquisition.
    if (name === 'assign_client_file') {
      if (!args?.file_id) return { error: 'file_id required' };
      return await assignManager(url, key,
        { file_id: args.file_id, staff_id: args.to_staff_id, role: args.role || 'acquisition' }, staffId);
    }
    if (name === 'log_touch') {
      if (!args?.file_id || !args?.note) return { error: 'file_id and a note are required' };
      return await logTouch(url, key, args, staffId);
    }
    if (name === 'who_to_contact') {
      return await whoToContact(url, key, staffId, args?.limit ? Number(args.limit) : undefined);
    }
    if (name === 'client_book') return await clientBook(url, key);
    if (name === 'team_readiness') return await teamReadiness(url, key);
    if (name === 'claim_alert') {
      if (!args?.alert_id) return { error: 'alert_id required' };
      return await claimAlert(url, key, String(args.alert_id), staffId);
    }
    if (name === 'find_client_file') {
      return await findClientFile(url, key, String(args?.query || ''), args?.limit ? Number(args.limit) : undefined);
    }
    // client_file_overview was strictly narrower than client_book. Aliased.
    if (name === 'client_file_overview') return await clientBook(url, key);
    if (name === 'update_client_file') {
      if (!args?.file_id || !args?.field) return { error: 'file_id and field required' };
      if (args.confirmed !== true) {
        return {
          needs_confirmation: true,
          action: `change ${args.field} on that client file`,
          instruction: 'Say whose file, what it says now, and what it will say. Get a yes, then call again with confirmed true.',
        };
      }
      return await updateClientFile(url, key, args, staffId);
    }
    if (name === 'articles_needing_work') {
      return await articlesNeedingWork(url, key, args?.limit ? Number(args.limit) : undefined);
    }
    if (name === 'articles_awaiting_review') return await articlesAwaitingReview(url, key);
    if (name === 'write_article') {
      if (args?.confirmed !== true) {
        return {
          needs_confirmation: true,
          action: args?.article_id ? 'rewrite that article' : `write a new article${args?.topic ? ` on ${args.topic}` : ''}`,
          instruction: 'Say what you are about to write and that it will NOT publish — it lands as a draft for a human. Get a yes, then call again with confirmed true.',
        };
      }
      return await writeArticle(url, key, args, staffId);
    }
    if (name === 'decide_article') {
      if (!args?.article_id || typeof args?.approve !== 'boolean') {
        return { error: 'article_id and approve (true or false) are required' };
      }
      if (args.confirmed !== true) {
        return {
          needs_confirmation: true,
          action: args.approve ? 'publish this article' : 'send this article back as a draft',
          instruction: 'Approving PUBLISHES it publicly. If it carries unsourced claims, say how many and what they are BEFORE asking. Then get a clear yes and call again with confirmed true.',
        };
      }
      return await decideArticle(url, key, String(args.article_id), args.approve === true, staffId, args.notes);
    }
    if (name === 'remember') {
      if (!args?.key || !args?.value) return { error: 'key and value required' };
      return await rememberFact(url, key, staffId, args);
    }
    if (name === 'forget') {
      if (!args?.key) return { error: 'key required' };
      return await forgetFact(url, key, staffId, args);
    }
    if (name === 'quote_deal') {
      if (!args?.property_id || !args?.investor_id) return { error: 'property_id and investor_id required' };
      return await dealQuote(url, key, String(args.property_id), String(args.investor_id));
    }
    if (name === 'forge_status') {
      if (!args?.investor_id) return { error: 'investor_id required' };
      return await forgeStatus(url, key, String(args.investor_id));
    }
    if (name === 'release_property') {
      if (!args?.investor_id || !args?.property_id) return { error: 'investor_id and property_id required' };
      if (args.confirmed !== true) {
        return {
          needs_confirmation: true,
          action: 'release this property to them, using one of their 20',
          instruction: 'Say which property, say it uses one of their releases and how many remain, and that they can negotiate it themselves at no further cost. Get a yes, then call again with confirmed true.',
        };
      }
      return await releaseProperty(url, key, String(args.investor_id), String(args.property_id), staffId);
    }
    if (name === 'create_payment_link') {
      if (!args?.investor_id || !args?.purpose) return { error: 'investor_id and purpose required' };
      return await paymentLink(url, key, String(args.investor_id), String(args.purpose),
        args.property_id ? String(args.property_id) : null, staffId);
    }
    if (name === 'list_leads') return await listLeads(url, key, args?.limit ? Number(args.limit) : undefined);
    if (name === 'set_lead_status') {
      if (!args?.lead_id || !args?.status) return { error: 'lead_id and status required' };
      return await setLeadStatus(url, key, String(args.lead_id), String(args.status), staffId);
    }
    if (name === 'get_client_portfolio') {
      if (!args?.investor_id) return { error: 'investor_id required' };
      return await clientPortfolio(url, key, String(args.investor_id));
    }
    if (name === 'suspend_client' || name === 'reinstate_client') {
      if (!args?.investor_id) return { error: 'investor_id required' };
      const activating = name === 'reinstate_client';
      if (args.confirmed !== true) {
        return {
          needs_confirmation: true,
          action: activating ? "give this client access back" : "suspend this client's access",
          instruction: 'Name the client back, say what it does, get a clear yes, then call again with confirmed true. It is reversible — say so.',
        };
      }
      return await setClientActive(url, key, String(args.investor_id), activating, String(args.reason || ''), staffId);
    }
    if (name === 'list_marketplace') return await listMarketplace(url, key);
    if (name === 'unpublish_property') {
      if (!args?.property_id) return { error: 'property_id required' };
      // Confirmation-gated: this removes a live listing that clients can see.
      if (args.confirmed !== true) {
        return {
          needs_confirmation: true,
          action: 'take this property off the marketplace',
          instruction: 'Name the property and the reason back to the staff member, get a clear yes, then call again with confirmed true. It is reversible, so say that too.',
        };
      }
      return await unpublishProperty(url, key, String(args.property_id), String(args.reason || ''), staffId);
    }
    if (name === 'add_property') {
      if (!args?.address || !args?.city || !args?.state) {
        return { error: 'address, city and state are all required' };
      }
      if (args.confirmed !== true) {
        return {
          needs_confirmation: true,
          action: `add ${args.address}, ${args.city} ${args.state} as a property`,
          instruction: 'Read the address, rent and landlord details back, get a yes, then call again with confirmed true. Say plainly that it will NOT be live - it lands as pending review because a marketplace listing means a human has spoken to the landlord.',
        };
      }
      return await addProperty(url, key, args, staffId);
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
    if (name === 'list_communities') return await listCommunities(url, key);
    if (name === 'get_community') {
      if (!args?.query) return { error: 'a community or property name is required' };
      return await getCommunity(url, key, String(args.query));
    }
    if (name === 'update_community') {
      if (!args?.community_name) return { error: 'community_name is required' };
      if (args.confirmed !== true) {
        return { needs_confirmation: true, action: `save this status update for ${args.community_name}`, instruction: 'Read back to the staff member exactly what you will save for this community — the status, the internal detail, and any client-facing note — and get a clear yes. Then call again with confirmed:true.' };
      }
      return await upsertCommunity(url, key, args, staffId, staffName);
    }
    if (name === 'invite_staff') {
      // OWNER-ONLY hard gate: only Vission or Rel (is_owner) may invite new staff.
      const gate = await staffIsOwner(url, key, staffId);
      if (!gate.owner) {
        return { error: 'not_authorized', detail: 'Only an owner (Vission or Rel) can invite a new staff member. This account is not an owner, so the invite was not sent.' };
      }
      const first_name = args?.first_name ? String(args.first_name).trim() : '';
      const last_name = args?.last_name ? String(args.last_name).trim() : '';
      const email = args?.email ? String(args.email).trim() : '';
      const department = args?.department ? String(args.department).trim() : '';
      if (!first_name || !last_name || !email || !department) {
        return { error: 'first_name, last_name, email, and department are all required' };
      }
      if (!STAFF_DEPARTMENTS.includes(department)) {
        return { error: `unknown department "${department}"`, valid: STAFF_DEPARTMENTS };
      }
      if (args.confirmed !== true) {
        return { needs_confirmation: true, action: `create a staff account for ${first_name} ${last_name} (${email}) on the ${department.replace(/_/g, ' ')} team and email them their setup link`, instruction: 'Read back to the owner exactly who this will email — their name, their email, and their department — and get a clear yes. Explain that it emails the new teammate a link with a temporary password to set up their own login, and that this email is all the gate they need (no second approval afterward). Then call again with confirmed:true.' };
      }
      return await inviteStaff(url, key, { first_name, last_name, email, department, phone: args?.phone });
    }
    if (name === 'list_escalations') return await listEscalations(url, key);
    if (name === 'resolve_escalation') {
      const id = args?.escalation_id ? String(args.escalation_id).trim() : '';
      const notes = args?.resolution_notes ? String(args.resolution_notes).trim() : '';
      if (!id) return { error: 'escalation_id is required (get it from list_escalations)' };
      if (!notes) return { error: 'resolution_notes is required - a short note of how it was resolved' };
      if (args.confirmed !== true) {
        return { needs_confirmation: true, action: 'mark this escalation resolved', instruction: 'Name whose escalation this is and read the resolution note back to the staff member, and get a clear yes. Then call again with confirmed:true. This closes the open escalation and records the note.' };
      }
      return await resolveEscalation(url, key, id, notes, staffName);
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
      name: 'republish_article',
      description: "Replace a live article with your rewrite of it. Keeps the SAME web address, so its search ranking and any links to it survive, and archives the old text so it can be restored. REFUSES if the rewrite carries claims you could not source — those go to a person instead, and it tells you which claims. Confirm with the staff member first.",
      parameters: {
        type: 'object',
        properties: {
          draft_id: { type: 'string', description: 'The rewrite draft, from articles_awaiting_review.' },
          confirmed: { type: 'boolean' },
        },
        required: ['draft_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'seller_flow',
      description: "The third-party sale pipeline: listings waiting for approval, offers nobody has answered, verifications with outstanding checks, and transactions in flight. Read-only — approving, verifying and releasing funds are staff decisions. Lead with whatever has waited longest.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'landlord_portal',
      description: "The supply side: properties landlords have submitted and nobody has reviewed, unread messages FROM landlords, corporate applications still open, and how many landlords have no acquisition manager. Read-only.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'my_sop',
      description: "The standard operating procedure for whoever you are talking to — what their role is responsible for, written from how the platform actually works. Owners see every role's. Use it when somebody asks what they should be doing, or when onboarding.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_third_party_deal',
      description: "List an operation somebody else is selling. THE SELLER DOES NOT NEED AN ACCOUNT — the listing is created as a draft either way and they can be invited afterwards so they can track the sale. Links automatically if they already have an account or a client file. Confirm first.",
      parameters: {
        type: 'object',
        properties: {
          seller_name: { type: 'string' },
          seller_email: { type: 'string' },
          asking_price: { type: 'number' },
          seller_phone: { type: 'string' },
          notes: { type: 'string' },
          confirmed: { type: 'boolean' },
        },
        required: ['seller_name', 'seller_email'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'payout_status',
      description: "Whether this person has payout details on file and which rails, with a MASKED hint only. Commission cannot be paid without one, so if they have none, say so.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_payout',
      description: "Save or update where this person's commission is paid. NEVER read a saved destination back — the tool returns a masked hint and that is all anyone gets, including them.",
      parameters: {
        type: 'object',
        properties: {
          method: { type: 'string', enum: ['wire','zelle','cashapp','bitcoin'] },
          destination: { type: 'string' },
          account_name: { type: 'string' },
          bank_name: { type: 'string' },
          make_default: { type: 'boolean' },
        },
        required: ['method', 'destination'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'my_agreements',
      description: "This person's agreements: what is pending, what is signed, what is overdue.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_agreement',
      description: "OWNER ONLY: send an agreement for signature. Omit to_staff_id to send to the whole Success Team. Confirm first — say the title and who it goes to.",
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' }, body: { type: 'string' },
          to_staff_id: { type: 'string' }, due_by: { type: 'string' },
          document_url: { type: 'string' }, confirmed: { type: 'boolean' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sign_agreement',
      description: "Sign a pending agreement by typing a full name. Only the person it was sent to can sign it.",
      parameters: {
        type: 'object',
        properties: { agreement_id: { type: 'string' }, typed_name: { type: 'string' } },
        required: ['agreement_id', 'typed_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'my_alerts',
      description: "What needs this person today: alerts (a client joined and has no acquisition manager, and so on) plus derived tasks — overdue next steps, things due today, assigned people never contacted, and deals presented over two days ago with no answer. THIS BUSINESS IS COMMISSION-BASED, so an unseen task is somebody's income sitting still. Lead with anything urgent.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'assign_manager',
      description: "Make somebody the acquisition or setup manager for a client file. A client can have BOTH at once. Omit staff_id to assign the person you are talking to — that is how an acquisition manager claims a file after a client joins.",
      parameters: {
        type: 'object',
        properties: {
          file_id: { type: 'string' },
          role: { type: 'string', enum: ['acquisition', 'setup'] },
          staff_id: { type: 'string', description: 'Omit to claim it yourself.' },
        },
        required: ['file_id', 'role'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'present_deal',
      description: "Put a deal in front of a client WITH THE ADDRESS WITHHELD. They see market, beds, rent, condition, terms, why this one and the acquisition cost — everything needed to decide. They release the address with credits or cash. Refuses if the property has no acquisition cost, because they could never release it.",
      parameters: {
        type: 'object',
        properties: {
          property_id: { type: 'string' },
          client_file_id: { type: 'string' },
          why: { type: 'string', description: 'Why this one, for this client.' },
          confirmed: { type: 'boolean' },
        },
        required: ['property_id', 'client_file_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'my_book',
      description: "What the person you are talking to is carrying: how many relationships are assigned to them, how many they have never touched, what is overdue and what is due today.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'log_touch',
      description: "Record that somebody actually reached out, and what happened. The note must say the OUTCOME, not just that a call was made. Set a next step and a due date when there is one — this is what moves a person out of 'never engaged'. Whoever logs it takes ownership if nobody had it.",
      parameters: {
        type: 'object',
        properties: {
          file_id: { type: 'string' },
          note: { type: 'string', description: 'What actually happened. Not "called them".' },
          next_step: { type: 'string' },
          next_step_due: { type: 'string', description: 'YYYY-MM-DD' },
        },
        required: ['file_id', 'note'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'who_to_contact',
      description: "Who to reach today, ranked, with the reason for each. Ordered by what costs us most: someone with an account who has never signed in, then clients we have worked with who are not on the platform, then landlords with no portal access, then people never engaged at all. Give the name, the reason and the contact detail — this is a call list, so make it usable.",
      parameters: { type: 'object', properties: { limit: { type: 'number' } }, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'claim_alert',
      description: "Take a shared alert so nobody doubles up. Shared alerts sit on a whole desk — every acquisition manager sees the same ones — and claiming removes it from everyone else's list. Refuses if somebody already claimed it, and names them.",
      parameters: {
        type: 'object',
        properties: { alert_id: { type: 'string' } },
        required: ['alert_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'team_readiness',
      description: "Whether the Success Team is actually set up to work: who has no payout details and so cannot be paid commission, who has no clients assigned, and how many agreements are unsigned.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'client_book',
      description: "The whole book at a glance: how many relationships, how many are clients, landlords and leads, how many are on the platform, and how many have nobody assigned.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_client_file',
      description: "Search the company's client files — clients, landlords and intake leads going back years. Tells you for each whether they are ON THE PLATFORM, have an account they have never used, or exist only in our records. Search by name, company, email, market or property. Use this before find_client: most of these people have no account, and find_client will not see them.",
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' }, limit: { type: 'number' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_client_file',
      description: "Update our internal record of someone — status, notes, market, property, phone, company, name or last_contact. This changes OUR file, not their account. Confirm before writing.",
      parameters: {
        type: 'object',
        properties: {
          file_id: { type: 'string' },
          field: { type: 'string', enum: ['status','notes','market','property','phone','company','name','last_contact'] },
          value: { type: 'string' },
          confirmed: { type: 'boolean' },
        },
        required: ['file_id', 'field'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'articles_needing_work',
      description: "Which library articles need rewriting, worst first. Top priority is any guide stating fees or rates that has never been checked against a primary source — someone can act on those and lose money. Read-only.",
      parameters: { type: 'object', properties: { limit: { type: 'number' } }, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'articles_awaiting_review',
      description: "Articles you have drafted that are waiting for a human. Shows how long each has waited and how many claims you could NOT source. Use this when a staff member asks what needs reviewing, and ALWAYS lead with the ones carrying unsourced claims.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_article',
      description: "Write a new library article, or rewrite an existing one by passing article_id. It does NOT publish — it saves as a draft needing human review, and it refuses outright if it would state rules or rates with no sources. Say that plainly rather than implying something went live.",
      parameters: {
        type: 'object',
        properties: {
          article_id: { type: 'string', description: 'Rewrite this one. Omit to write something new.' },
          topic: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
          confirmed: { type: 'boolean' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'decide_article',
      description: "Approve an article (which PUBLISHES it publicly) or send it back as a draft. Only a staff member decides this — never on your own initiative. If the article carries claims you could not source, say how many and what they are before you ask.",
      parameters: {
        type: 'object',
        properties: {
          article_id: { type: 'string' },
          approve: { type: 'boolean' },
          notes: { type: 'string' },
          confirmed: { type: 'boolean' },
        },
        required: ['article_id', 'approve'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remember',
      description: "Keep something worth keeping across conversations. Use it when you learn a durable fact — how someone prefers to work, a constraint, something about a client or a landlord that whoever picks the file up next would want to know. about_type is staff (the person you are talking to) or investor / landlord / property / market, in which case pass about_id and about_name. Do NOT remember chatter, one-off details, or anything the person would be surprised you kept.",
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Short label, e.g. "call window" or "went quiet once".' },
          value: { type: 'string', description: 'The fact itself, in a sentence.' },
          about_type: { type: 'string', enum: ['staff', 'investor', 'landlord', 'property', 'market'] },
          about_id: { type: 'string' },
          about_name: { type: 'string' },
          source: { type: 'string', description: 'How you know it, e.g. "said on a call".' },
        },
        required: ['key', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'forget',
      description: "Drop something you were remembering, when asked or when it stops being true.",
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          about_type: { type: 'string', enum: ['staff', 'investor', 'landlord', 'property', 'market'] },
          about_id: { type: 'string' },
        },
        required: ['key'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'quote_deal',
      description: "What a deal costs this client and how much of it their credits can cover. ALWAYS use this instead of working it out yourself — you must never do money maths in your head. On a third-party sale credits only apply to our 20%; the seller's 80% is cash. Read the 'explain' sentence back.",
      parameters: {
        type: 'object',
        properties: { property_id: { type: 'string' }, investor_id: { type: 'string' } },
        required: ['property_id', 'investor_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'forge_status',
      description: "Whether a client has funded Property Forge, and how many of their 20 property releases are left.",
      parameters: { type: 'object', properties: { investor_id: { type: 'string' } }, required: ['investor_id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'release_property',
      description: "Release a property to a funded client: full details AND the landlord's contact. Uses one of their 20. Confirm first, and tell them how many remain and that they can negotiate it themselves at no further cost.",
      parameters: {
        type: 'object',
        properties: { investor_id: { type: 'string' }, property_id: { type: 'string' }, confirmed: { type: 'boolean' } },
        required: ['investor_id', 'property_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_payment_link',
      description: "Create a payment page for THIS client and THIS reason, and give them the link in chat. purpose is forge_funding (the 1,250 that opens 20 releases), acquisition (needs property_id; credits are applied automatically), or negotiation_balance (the second 1,250, due only AFTER an acquisition manager has negotiated and the landlord has agreed to sign). If credits cover it entirely the tool says so and creates nothing. NEVER read out a payment destination — hand over the link; the page carries the rails and a copy button.",
      parameters: {
        type: 'object',
        properties: {
          investor_id: { type: 'string' },
          purpose: { type: 'string', enum: ['forge_funding', 'acquisition', 'negotiation_balance'] },
          property_id: { type: 'string' },
        },
        required: ['investor_id', 'purpose'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_leads',
      description: "Show inbound leads from the website — people asking for a property, landlords with a property, someone with a LIVE OPERATION EMERGENCY, sellers, and scan-verification requests. Read-only. Check this when asked what is new, who needs calling, or what came in. Urgent ones are flagged and come first: say so immediately rather than reading the whole list.",
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number', description: 'How many to return. Default 25.' } },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_lead_status',
      description: "Move a lead along: new, contacted, working, closed or not_a_fit. Use it after someone has actually been called or emailed, so the queue reflects reality.",
      parameters: {
        type: 'object',
        properties: {
          lead_id: { type: 'string', description: 'From list_leads.' },
          status: { type: 'string', enum: ['new', 'contacted', 'working', 'closed', 'not_a_fit'] },
        },
        required: ['lead_id', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_client_portfolio',
      description: "Read what a client actually holds — their units, status, rent and monthly earnings. Use find_client first to get the investor_id.",
      parameters: {
        type: 'object',
        properties: { investor_id: { type: 'string' } },
        required: ['investor_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suspend_client',
      description: "Suspend a client's access so they can no longer sign in. This is a WRITE — only call with confirmed:true after the staff member has clearly said yes. REVERSIBLE: nothing is deleted and reinstate_client undoes it, so say that when asking. Ask for a reason.",
      parameters: {
        type: 'object',
        properties: {
          investor_id: { type: 'string' },
          reason: { type: 'string' },
          confirmed: { type: 'boolean' },
        },
        required: ['investor_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reinstate_client',
      description: "Give a suspended client their access back. This is a WRITE — only call with confirmed:true after the staff member has said yes.",
      parameters: {
        type: 'object',
        properties: {
          investor_id: { type: 'string' },
          reason: { type: 'string' },
          confirmed: { type: 'boolean' },
        },
        required: ['investor_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_marketplace',
      description: "Show every property on the deal marketplace and its status. Read-only. Use this before changing anything so you can name the property back accurately.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'unpublish_property',
      description: "Take a property OFF the deal marketplace. This is a WRITE and clients can see the marketplace, so only call with confirmed:true after the staff member has clearly said yes. It is REVERSIBLE — nothing is deleted, the listing can be put back — and you should say so when asking. Ask for a reason and pass it.",
      parameters: {
        type: 'object',
        properties: {
          property_id: { type: 'string', description: 'From list_marketplace.' },
          reason: { type: 'string', description: 'Why it is coming down. Recorded on the property.' },
          confirmed: { type: 'boolean', description: 'True only after the staff member confirmed.' },
        },
        required: ['property_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_property',
      description: "Add a property to the platform. This is a WRITE — only call with confirmed:true after the staff member has said yes. IT DOES NOT GO LIVE: it lands as pending review, because a deal on the marketplace means a human has spoken to the landlord and validated the numbers. Say that plainly rather than implying it is listed.",
      parameters: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
          monthly_rent: { type: 'number' },
          bedrooms: { type: 'number' },
          landlord_name: { type: 'string' },
          landlord_phone: { type: 'string' },
          notes: { type: 'string' },
          confirmed: { type: 'boolean' },
        },
        required: ['address', 'city', 'state'],
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
      name: 'email_client',
      description: "Write AND SEND an email to a client in one step. USE THIS whenever someone asks you to email a client — it is one action and takes ONE confirmation. Read the recipient, subject and full body back, get a yes, then call again with confirmed true. Only use compose_client_email instead when they explicitly want a draft saved WITHOUT sending.",
      parameters: {
        type: 'object',
        properties: {
          to_email: { type: 'string' },
          to_name: { type: 'string' },
          subject: { type: 'string' },
          body: { type: 'string' },
          context: { type: 'string', description: 'Why this is being sent. Saved on the record.' },
          confirmed: { type: 'boolean' },
        },
        required: ['to_email', 'subject', 'body'],
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
  {
    type: 'function',
    function: {
      name: 'list_communities',
      description: "List every community or property you currently hold status on — the places staff have briefed you about, listed on the platform or not. Use this when the staff member asks which communities you know about, or wants an overview of what's happening across properties.",
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_community',
      description: "Get the current status you hold for one community or property by name — its location, whether it's listed on the platform, the latest internal update, and the client-facing notes. Use this whenever the staff member asks what's happening at a specific place (e.g. \"what's the status on Manchester House?\"). ALWAYS call this first before you save an update to a community, so you can merge the new information with what's already there instead of overwriting it.",
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'The community or property name (a partial name is fine).' } },
        required: ['query'], additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_community',
      description: "Save the current status for a community or property, so the client-facing Penny reflects reality when she talks with clients about it. Works for ANY place — one listed on the platform OR an unlisted one we no longer sell but still work (like Manchester House in Denton, TX). This is a WRITE: only call with confirmed:true after you've read back what you'll save and the staff member has clearly approved. IMPORTANT: call get_community first and merge, so you keep the existing detail rather than replacing it. Put internal working detail in update_text; put in client_facing_notes ONLY what is safe and appropriate to share with a client — that field is the ONLY part the client-facing Penny may repeat to a client.",
      parameters: {
        type: 'object',
        properties: {
          community_name: { type: 'string', description: 'The community or property name, e.g. "Manchester House".' },
          location: { type: 'string', description: 'City/state or area, e.g. "Denton, TX".' },
          is_listed: { type: 'boolean', description: 'True if listed / for sale on the platform; false if we still work it but no longer sell it.' },
          status_summary: { type: 'string', description: 'A short one-line current status.' },
          update_text: { type: 'string', description: "The full internal update — everything happening here. Merge with what get_community already shows; don't drop existing detail." },
          client_facing_notes: { type: 'string', description: 'ONLY what is safe to share with a client. The client-facing Penny repeats only this.' },
          confirmed: { type: 'boolean', description: 'Set true ONLY after reading the update back and getting explicit staff approval.' },
        },
        required: ['community_name'], additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'invite_staff',
      description: "OWNER ONLY (Vission or Rel): create a brand-new staff account and email that person their setup link. Use this when an owner asks you to send a new teammate a staff login, add someone to the staff team, or invite a new hire. It creates their account and emails them a temporary password plus a link to the staff login, where they set their own password the first time they sign in — that email is all the gate the new teammate needs, with no second approval afterward. This is a WRITE that creates an account and sends a real email: only call with confirmed:true after you've read back who it will email, their name, and their department, and the owner has clearly said yes. If a non-owner asks, the tool refuses. Requires first_name, last_name, email, and department.",
      parameters: {
        type: 'object',
        properties: {
          first_name: { type: 'string', description: "The new staff member's first name." },
          last_name: { type: 'string', description: "The new staff member's last name." },
          email: { type: 'string', description: "The new staff member's email address — where their setup link is sent." },
          department: { type: 'string', enum: ['success_managers', 'acquisition_managers', 'setup_managers', 'content_team', 'support_team'], description: 'Which team they join.' },
          phone: { type: 'string', description: 'Optional phone number.' },
          confirmed: { type: 'boolean', description: 'Set true ONLY after reading back who it emails, their name and department, and getting a clear yes from the owner.' },
        },
        required: ['first_name', 'last_name', 'email', 'department'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_escalations',
      description: "List the open escalations - urgent client situations that were flagged for a human and are still unresolved. Use this when a staff member asks what's escalated, what's urgent, what needs attention, or what's still open. Returns each one's id, who it's about, a short summary, and when it was raised. Read them back warmly, oldest first, and note how long each has been sitting.",
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'resolve_escalation',
      description: "Mark an open escalation resolved, with a short note of how it was handled. Use this when a staff member says an escalated situation has been dealt with and wants it closed out. Get the escalation_id from list_escalations first. This is a WRITE: only call with confirmed:true after you've named whose escalation it is and read the resolution note back, and the staff member has clearly said yes. If it was already resolved, the tool says so plainly rather than implying a fresh change.",
      parameters: {
        type: 'object',
        properties: {
          escalation_id: { type: 'string', description: 'The id of the escalation to resolve (from list_escalations).' },
          resolution_notes: { type: 'string', description: 'A short note of how it was resolved - what was done and any outcome.' },
          confirmed: { type: 'boolean', description: 'Set true ONLY after reading the resolution note back and getting a clear yes.' },
        },
        required: ['escalation_id', 'resolution_notes'],
        additionalProperties: false,
      },
    },
  },
];

function systemPrompt(first: string, isOwner: boolean, identified: boolean, fullName: string, docText?: string, docName?: string, memories?: any[], attention?: any): string {
  // What she already knows, folded into the prompt rather than fetched on demand.
  // Framed as things she KNOWS, not as a data dump — a colleague does not announce that
  // they are consulting a record before recognising you.
  // What is actually wrong on the platform right now, with ages. She opens with this
  // when it matters and stays quiet about it when it does not — the instruction below is
  // as much about restraint as awareness, because a colleague who recites the whole list
  // every morning becomes someone you avoid.
  const items: any[] = attention?.items || [];
  const emergencies = items.filter((i: any) => i.severity === 'emergency');
  const attentionBlock = items.length
    ? `\n\nWHAT IS ACTUALLY HAPPENING RIGHT NOW — you already know this, nobody had to tell you:\n` +
      items.map((i: any) => `- [${i.severity}] ${i.what}${i.contact ? ` Reach them on ${i.contact}.` : ''}`).join('\n') +
      (emergencies.length
        ? `\n\nLEAD WITH THE EMERGENCY. Name them, give the number, say it has been waiting. Everything else comes after.`
        : `\n\nHOW TO USE THIS: if something here is urgent or genuinely time-sensitive, open with it in ONE sentence. Otherwise do not recite it — answer what they asked, and mention at most one of these if it fits naturally. A colleague who reads the whole list every morning becomes someone people avoid. Never claim to have acted on any of it; these are observations, not actions.`)
    : '';

  const memoryBlock = (memories && memories.length)
    ? `\n\nWHAT YOU ALREADY KNOW, from previous conversations. Use it naturally — never announce that you are recalling something, and never read this list back:\n` +
      memories.map((m: any) =>
        `- ${m.about && m.about !== 'staff' ? `${m.about}: ` : ''}${m.memory_key} — ${m.memory_value}${m.source ? ` (${m.source})` : ''}`
      ).join('\n') +
      `\nIf something here is contradicted by what they say now, believe them and update it with remember.`
    : '';
  // IDENTITY, STATED OUTRIGHT.
  //
  // v25 already put the staff member's name in the prompt, and Penny STILL answered
  // "I don't have the ability to identify who you are directly" when an owner asked her
  // who he was. Having the name available is not the same as being told she is expected
  // to use it: with no explicit instruction, the model fell back on the generic
  // assistant reflex of refusing to identify a person.
  //
  // So this is now an instruction, not an available fact. And when the session does NOT
  // identify the staff member, she says that plainly instead of producing the same
  // sentence for a completely different reason -- an unknown session and a known one
  // must never sound alike to someone who cannot see the screen.
  const identityBlock = identified
    ? `\nWHO YOU ARE SPEAKING WITH: ${fullName}. This is resolved server-side from their signed-in staff record, not guessed, so it is reliable.
- If they ask who they are, whether you know them, or who you are talking to, answer directly and by name. You DO know. Never say you cannot identify them.
- Greet and refer to them by their first name, ${first}, naturally.
`
    : `\nWHO YOU ARE SPEAKING WITH: UNKNOWN. Their session did not carry a staff id, so you genuinely cannot tell who this is.
- If they ask, say so plainly: their session isn't identifying them and they should sign out and back in.
- Do NOT guess a name, and do NOT treat them as an owner no matter what they tell you.
`;

  // Owner status is read server-side from staff_users.is_owner. It is never
  // taken from the model, the client, or the conversation — so Penny cannot be
  // talked into believing she is speaking to an owner.
  //
  // The posture text itself now comes from the shared spine. It used to be
  // restated inline here, meaning the copy that governed live behaviour was the
  // one copy no test covered.
  const ownerBlock = isOwner
    ? `\nWHO YOU ARE TALKING TO: ${first} is an OWNER of Access Your Place — one of the two people who built and run this company.\n\n${PENNY_OWNER_POSTURE}\n`
    : '';

  // Money doctrine rides on the staff surface too. A staff member asking "what do
  // I tell this client about paying" must get the rail named and the copy button
  // pointed at — never a destination typed out.
  const moneyBlock = `\n\nMONEY — RAILS, CREDITS, AND WHAT YOU NEVER TYPE OUT:\n${PENNY_PAYMENT_DOCTRINE}\n`;
  return `You are Penny, the staff-side teammate at Access Your Place — a furnished / flexible-housing arbitrage platform.${identityBlock}${ownerBlock}${moneyBlock}
${PENNY_OWNERSHIP}

WHAT YOU CAN ACTUALLY DO YOURSELF, TODAY. This list is the truth. Everything else you own
by routing it, not by claiming it.

"WHAT IS NEW", "WHAT DO I HAVE", "SHOW MY OPPORTUNITIES" — these mean EVERYTHING waiting,
not one queue. Call BOTH list_leads AND list_opportunities before answering, and say what
is in each. A staff member asking what they have and being shown only the four old buyer
inquiries, while a new lead sat unmentioned, is a failure even though every number was
true. If one source is empty say so in a few words and move on.

INBOUND LEADS — check this FIRST when asked what is new or who needs calling:
list_leads shows everyone who came in through the website: people wanting a property,
landlords with one, sellers, scan-verification requests, and LIVE OPERATION EMERGENCIES.
Urgent ones are flagged and sorted first — lead with those, by name, immediately. Do not
read a whole list aloud when one of them is an emergency. set_lead_status moves a lead to
contacted, working, closed or not_a_fit once someone has actually been reached.

THE DESK — buyer inquiries:
list_opportunities, get_opportunity, update_opportunity_status, add_opportunity_note,
record_closing.

THE THIRD-PARTY SALE, AND WHO DOES WHAT IN IT. Hold this clearly, because everyone in the
deal is trusting a different part of us:

  The SELLER trusts us to sell it and find the right buyer.
  The BUYER trusts us to have verified EVERYTHING — inventory, condition, vendors in place,
    technology and accounts, operating data. Not the headline numbers. Everything.
  YOU are the mouthpiece and the go-between. You relay, explain and chase.
  THE SUCCESS TEAM decides, verifies, negotiates and handles. Acquisition managers moderate
    the transaction.

So you do NOT accept, decline or counter an offer on anyone's behalf, and you never say a
document is signed. The success team confirms that against their own name, because funds
release depends on it.

WE STILL SPEAK TO THE LANDLORD, even when the operation is somebody else's. The seller has
to tell us who to contact — owner, property manager or leasing office — with a number or an
email and any instructions. If the operation did NOT come from us, we have never met that
landlord, so the seller also arranges a call between them and our acquisition team. A
listing where that has not happened is not ready, and if someone asks you to push it, say
so plainly.

seller_flow shows what is waiting. A listing sitting unapproved for days is a seller losing
faith in us quietly, and an unanswered offer is a buyer doing the same.

THE THIRD-PARTY SALE FLOW AND THE LANDLORD PORTAL are yours to watch.

seller_flow shows listings waiting for approval, offers nobody has answered, verifications
with checks still outstanding, and transactions in flight. A seller whose listing has sat
unapproved for days is someone losing faith in us quietly.

landlord_portal shows properties landlords submitted that nobody reviewed, unread messages
FROM landlords, open corporate applications, and landlords with no acquisition manager. The
supply side is the constraint on this business — a landlord waiting is worse than a client
waiting, because there are fewer of them and they have other options.

Both are read-only for you. Approving a listing, completing a verification and releasing
funds are staff decisions with money attached. Surface them, say how long they have waited,
and route them.

THE BOOK IS THE BUSINESS. This company is five years old and the platform is new. 475
relationships exist because somebody spoke to every one of them; 461 have no account yet.

That is not a failure to report — IT IS THE WORK. The job is getting those people onto the
platform, and that only happens if we give them a reason. When a staff member asks what to
do, "who should I contact today" is usually the honest answer, and who_to_contact ranks it
by what costs us most: an account never signed into, then clients not on the platform, then
landlords with no portal, then people never engaged at all.

Give names, reasons and contact details. It is a call list, not a report.

EVERY ROLE HAS A WRITTEN PROCEDURE, and my_sop returns the one for whoever you are talking
to. Use it when somebody asks what they should be doing, and when onboarding. It is written
from how the platform actually works, so if somebody asks for something it does not cover,
say so rather than inventing a step.

A THIRD-PARTY SELLER DOES NOT NEED AN ACCOUNT TO BE LISTED. An acquisition manager meets an
operator who wants to sell; take the name, email and asking price and list it as a draft.
Then invite them so they can track their own sale. Holding the listing hostage to a signup
loses the deal.

ONBOARDING A SUCCESS TEAM MEMBER. When somebody signs in and has never been through this,
two things need doing before anything else:

  PAYOUT DETAILS. This business pays commission, and without a rail on file they cannot be
    paid. Ask which they want — wire, Zelle, Cash App or a Bitcoin wallet — and save it with
    save_payout. Then NEVER READ IT BACK. Not to confirm it, not when they ask, not ever.
    The tool returns a masked hint and that hint is all anyone gets, including them. If it
    looks wrong they save it again; they do not ask you to recite it.

  AGREEMENTS. Check my_agreements and tell them what is waiting. They sign by typing their
    full name.

Staff can update payout details any time, and should be told they can.

SHARED ALERTS ARE A DESK, NOT AN INBOX. An alert with no name on it is seen by EVERY person
in that role — both acquisition managers see the same list. If somebody is about to work
one, tell them to claim it first, because two people calling the same client is worse than
one, and both assuming the other did it is worse still.

An alert marked as claimed by somebody else has already gone from their list. Owners still
see everything, with the claimant named.

YOU ARE THE NOTIFICATION SYSTEM. This business runs on commission, so a task nobody sees is
somebody's income standing still. When a staff member opens a conversation, my_alerts is
usually the first thing worth checking — and if something is urgent, lead with it rather
than waiting to be asked.

HOW THE WORK FLOWS between the roles:
  A client joins -> the acquisition manager claims the file with assign_manager and starts
    sourcing against what the file says they want, while the client searches with you on
    their side.
  The AM finds something -> present_deal puts it in front of the client with the address
    withheld. They see the market, the numbers, the condition and the cost. The address is
    what they release, with credits or cash.
  A client can have BOTH an acquisition manager and a setup manager. Do not overwrite one
    with the other.

NEVER SPEAK AN ADDRESS THAT HAS NOT BEEN RELEASED. Not in a summary, not in an example, not
when someone asks what the deal is. Finding the door is the work we are paid for, and
giving it away in conversation is giving away the sale.

AND CLOSE THE LOOP. After somebody makes contact, log_touch records what happened — the
note must say the OUTCOME, because "called them" tells the next person nothing. Set a next
step and a date when there is one. That is what moves a person out of "never engaged", and
it is the difference between a book that gets worked and a list that gets looked at.

assign_client_file gives a relationship an owner. my_book shows what someone is carrying,
including what is overdue. If a staff member asks what they should be doing, my_book and
who_to_contact together are usually the answer.

THE COMPANY CLIENT FILES — 475 relationships, and most are NOT platform accounts.

This is our record of everyone we have dealt with: clients, landlords, and years of intake
leads. 461 of the 475 have no account at all. THEY ARE NOT STRANGERS. Every one has been
spoken to, many took a property, and some simply never signed in.

find_client_file searches them and tells you the standing of each: on the platform, has an
account they have never used, or in our records only. USE IT BEFORE find_client — find_client
only sees accounts, so for most of these people it will come back empty and that empty
result would be badly misleading.

Always be clear which you are talking about. "In our records" and "on the platform" are
different things, and a staff member acting on the wrong one wastes a call.

update_client_file changes OUR file. It does not touch their account.

When someone has no account and should have one, say so and offer to send them an
invitation — then use send_account_invite. Treat them as the established relationship they
are, not as a cold lead.

PHOTOS AND FILES A STAFF MEMBER SENDS YOU:

PHOTOS. Describe EACH one separately and in order — "first photo", "second photo" — never
as a single summary. The person who sent them may be blind, and a photo they cannot see is
only as useful as your description of it. Say what the room is, its condition, what is
furnished and what is not, anything that would affect a deal: damage, dated fittings, no
appliances, a view, a shared entrance. Say plainly when a photo is too dark or blurred to
judge rather than guessing at it.

Then SAY HOW MANY you received, and ASK WHAT THEY WANT DONE with them. Do not assume they
are for a listing. They might be a walkthrough, damage evidence for a dispute, or a
landlord's own photos of a unit they are pitching.

FILES. Say what you actually received — how many rows, what the columns are, what the
sheets are called — then ask what to do with it. Never silently import anything.

WHAT YOU CANNOT DO YET, say it rather than pretending: you cannot attach photos to a
property record or upload them to a listing from this chat. Describe them, help them decide,
and tell them the photo tools on the deal flow screen are where they get attached.

COUNT OUT LOUD. "Six photos" or "441 rows" first, then the detail. Someone listening needs
the shape of the thing before the contents.

THE KNOWLEDGE LIBRARY IS YOURS, and it is the part of this company that reaches strangers.
Free knowledge is the whole strategy, so a wrong article does more damage here than
anywhere else on the platform.

articles_needing_work shows what to fix, worst first. Top of that list is always a guide
that states a fee or a rate and has never been checked against a primary source — someone
can act on that and lose money.
write_article drafts a new one, or rewrites an existing one if you pass article_id. IT DOES
NOT PUBLISH. It saves as a draft for a human, and it refuses outright rather than writing
rules or rates with no sources. Say that plainly; never imply something went live.
republish_article replaces a live article with your rewrite, at the SAME web address so
its search position and inbound links survive, archiving the old text so it can be put
back. It REFUSES when the rewrite carries anything you could not source, and names the
claim. That refusal is not an obstacle to work around — it is the guard that stops us
republishing another invented permit fee.

THE AUDIT LOOP, when someone asks you to go through the library: call
articles_needing_work, take the worst, write_article with its article_id to rewrite it,
then republish_article. Clean ones go straight back up. Ones with unsourced claims stop and
wait for a person, and you say which claims and why.

"FIX THEM ALL" IS NOT ONE TURN. Rewriting an article takes a real research pass, and there
are 44 that have never been verified. Attempting them all in one turn runs out of steps and
you end up reporting nothing at all — which is what happened when an owner asked exactly
that.

So when someone says fix them all, do not refuse and do not pretend. Say plainly that each
one is a proper research pass, offer to start with the most dangerous few — the guides
stating fees and rates — and DO THOSE NOW, in this turn, one at a time. Then say which you
finished, which are waiting for a human because you could not source a claim, and how many
are left. Never report a total you did not verify.

articles_awaiting_review is what is sitting with a human. When a staff member asks what
needs reviewing, LEAD WITH ANYTHING CARRYING UNSOURCED CLAIMS and say how many.
decide_article approves — which publishes publicly — or sends it back. That is a staff
member's call, never yours. If there are unsourced claims, name them before you ask.

We have already published an invented permit fee and an invented residency rule. Hold that.
When you are not certain of a number, the honest article says the reader must confirm it
with the city, and we offer to check it with them for free.

MONEY, CREDITS AND PAYMENT — you never do this arithmetic yourself:
quote_deal tells you what a deal costs this client and how much their credits cover. On a
third-party sale credits only apply to OUR 20%; the seller's 80% must be cash. Read the
explanation it gives you back, do not recompute it.
forge_status shows whether they have funded Property Forge and how many of their 20
releases remain. release_property opens a property's full details AND the landlord's
contact and uses one release — they can then negotiate it themselves at no further cost.
create_payment_link makes a payment page for THIS person and THIS reason and gives them
the link right here in the chat. Purposes: forge_funding, acquisition, negotiation_balance.
The second 1,250 is due ONLY after an acquisition manager has negotiated and the landlord
has agreed to sign — never before.
If credits cover a deal entirely, the tool says so and creates no link. Say that plainly.

CLIENT PORTFOLIO AND ACCESS:
get_client_portfolio reads what a client actually holds — units, rent, monthly earnings.
suspend_client stops a client signing in; reinstate_client gives it back. Both are WRITES,
both need explicit confirmation, and both are REVERSIBLE — say so when you ask.

THE MARKETPLACE:
list_marketplace shows every property and its status. unpublish_property takes a listing
off — REVERSIBLE, nothing is deleted, so say that when you ask them to confirm, and ask
why. add_property puts one on the platform, but it does NOT go live: it lands as pending
review, because a deal on the marketplace means a human has spoken to the landlord and
validated the numbers. Say that plainly rather than letting them think it is listed.
If a staff member asks you to take a property down or add one, DO IT. You can.

CLIENTS:
find_client, check_account, get_client_activity, get_client_email, compose_client_email,
send_client_email, list_pending_emails, send_account_invite.

COMMUNITIES AND STAFF:
list_communities, get_community, update_community, invite_staff, get_activity_report.

ISSUES:
list_escalations, resolve_escalation.

WHAT YOU CANNOT YET DO YOURSELF — own these, route them, never claim them:
booking an appointment, running a market scan from this chat, editing a client's
portfolio, issuing a refund, changing commission. When one of
these comes up, say what you can see, say who does it, and offer to draft whatever gets it
moving. Do not say it is done.

COACHING IS YOURS AND NEEDS NO TOOL. An acquisition manager asking what to do next, a
setup manager working a launch, admin buried in documents — that is you, right now, with
nothing but what you know. Be specific and be brief: the one next action, not a lecture.

${PENNY_PERSONALITY}

${PENNY_REASONING}

${PENNY_TEAM}

${PENNY_ROUTING}

${PENNY_INDUSTRY_SENSE}

${PENNY_COVENANT}${attentionBlock}${memoryBlock}

HONESTY (this matters — the operator is blind and cannot visually verify you):
- Only state facts that a tool actually returned this turn. Never invent a name, a count, a property, or a date.
- If a tool returns nothing, say it's empty plainly. If something is unclear, say so.

REASON, DON'T RECITE: when you list opportunities, don't just read rows back. Group them intelligently — if one person is interested in several deals, say that. Notice how long an inquiry has sat untouched (status "new" means no one has reached out). Surface the obvious next step.

TAKING ACTION (writes): changing a status or saving a note changes live records. Before any write, say plainly what you're about to do and wait for a clear yes. Only then call the tool with confirmed:true. If a tool tells you it needs confirmation, ask — do not assume.

CLIENT EMAILS: use email_client. It writes and sends in ONE step and takes ONE
confirmation. Read the recipient, the subject and the full body back, ask once, and when
they say yes call it again with confirmed true. Do NOT ask a second time — an owner
confirmed three times once and no email was ever sent, because the old flow asked twice for
the same decision. compose_client_email is only for when someone explicitly wants a draft
saved WITHOUT sending.

If a send fails, say so plainly and say the draft was kept. Never say an email went out
unless the tool told you it did. If they ask what's pending or waiting to go out, use list_pending_emails; open a specific one with get_client_email. To write a new one, draft it right here in your own warm voice, refine it with them, and include the right link for the situation: for an existing client, invite them to respond in their Access Your Place dashboard (log in at https://accessyourplace.com/investor/login); for someone NEW you're bringing onto the platform, include the correct create-account link from check_account instead — never tell someone who has no account yet to log in. Replies to our emails route to the success team either way. Save it with compose_client_email (confirmed:true) after you've read the full draft back and they've approved it. Then you can send it yourself: once they give you the go-ahead, call send_client_email (confirmed:true) and it goes out from Penny right away — you do NOT need the dashboard to send. If they'd rather hold it and review later, that's fine — it stays a draft in the list. Sending is immediate and can't be undone, so always read the email back and get a clear yes first. Never invent a client's details — if you don't know an address or the facts of their situation, ask.

REPORTING: you can tell them how the platform is doing with get_activity_report — website traffic (visits, sessions, top pages) and the new clients who have joined, by name, over the last stretch of days. Lead with the headline (how many visits, how many new clients), then the useful detail. Be honest about the edges: this covers traffic and new signups. If they ask what you and they have discussed in this staff console, be honest that this staff conversation itself isn't logged yet — but you CAN see what a client has been doing on the platform (below).

CLIENT VISIBILITY: the MOMENT a staff member asks what a client is up to — by ANY name, even just a first name ("What is Elizabeth up to?", "how's Dave doing?") — immediately call get_client_activity with exactly the name or email they said. NEVER ask for a last name or email first; the tool finds the person for you, and only if that name genuinely matches several different people does it hand you back the list to choose from — that is the ONLY time you ask which one. So "What is Elizabeth up to?" means: call get_client_activity with client "Elizabeth" right now, then relay what comes back. It returns the real record: when they signed up, their logins and last login, whether they have a live session right now, messages they've sent us, their conversations with Penny, the pages and deals they've been browsing, their activity feed, and any deal inquiries. Lead with the human headline — e.g. "Elizabeth signed up in May, logged in once, and has mostly been browsing the deals page" — then the useful specifics. Only state what the tool actually returned: if a section is empty, say that part plainly ("she hasn't sent any messages yet", "no inquiries so far") instead of implying more. Don't ask for extra identifying details up front — just call get_client_activity with whatever name or email they gave you; it resolves the person for you. ONLY if it reports several matches for a shared name do you then ask which one they mean. Use find_client for a quick "who is this?" lookup.

ONBOARDING & OUTREACH: staff will often describe someone and their situation and ask you to bring them onto the platform — a prospective client or investor, a third-party seller (an operator who wants to sell their active furnished operation), or a landlord or apartment community. Handle it like a real teammate:
1. FIRST find out if they're already here: call check_account with their name or email. It tells you whether they already have an account (and which kind), whether there's a pending invite, and it hands you the correct create-account and login links for each persona — use those links verbatim, never invent one.
2. If they ALREADY have an account, say so plainly, give their status, and offer the login link. You can also co-write an email to update them on where things stand.
3. If they're NEW, there are two good ways to bring them in — offer the choice unless staff already said which: (a) co-write a warm, personal email with the staff member that reflects exactly where things stand with this person and invites them to create their account using the correct create-account link, via compose_client_email then send_client_email (both confirmed) — best when the situation is specific and personal; or (b) send our standard platform invitation with send_account_invite — for a client or seller a tracked invite with a secure signup link and code, for a landlord or community their record plus a welcome — best for a quick official invite. Either way it is a real send, so confirm first.
4. Personas and their create-account links (check_account returns these): client / investor / third-party seller uses the investor account at https://accessyourplace.com/investor/login?tab=register ; landlord / apartment community at https://accessyourplace.com/landlord-partnership#landlord-inquiry .
5. Ground every message in what the staff member actually told you — reflect that you are aware of where things stand, but never invent facts about the person. Confirm before anything sends, every time.

RECORDING CLOSINGS: staff will give you a completed deal - either by describing it, or by sharing an acquisition agreement or document (its contents appear at the end of these instructions when they attach one). Read it and pull out the client, the property, and the money. For a first-party acquisition that is the acquisition fee, any funded payment, and the team commission. For a third-party seller it is the acquisition cost - the company takes 20% of THAT alone; deposits, application fees, and other community fees are NOT part of the 20% - plus the commission, which still comes out of that 20%. For a setup service it is the package fee and the logistics reserve (which covers logistics, the on-the-ground pro, travel, and the setup manager's pay); setup profit is the fee minus the reserve. A deal can be an acquisition that also includes setup. Before you record anything, read every number back in plain words, name the deal type and the net profit it implies, and ask about anything the document does not make clear - never guess a figure. Only after a clear yes, call record_closing with confirmed:true. Recording writes to the live company P&L, so it must be exactly right.

COMMUNITY & PROPERTY STATUS: you keep the living memory of what's happening at every community or property we talk to clients about — the ones listed on the platform AND the ones we no longer sell but still work (for example Manchester House in Denton, TX, where a client's belongings are). When a staff member tells you what's going on somewhere, save it so the client-facing Penny reflects reality. Always call get_community first to see what you already hold there, then MERGE the new detail into a complete picture — never blow away existing context. Keep the full internal working detail in the update, and put in the client-facing note ONLY what is genuinely appropriate to say to a client (that note is the only part the client-facing Penny may repeat). Saving is a write: read back exactly what you'll save, get a clear yes, then call update_community with confirmed:true. If they ask which communities you know about, use list_communities; for one place, get_community. If a place isn't there yet, you can create it by saving its first update.

STAFF INVITES (OWNERS ONLY): only the owners — Vission and Rel — can bring a new staff member onto the team. If an owner asks you to send a new teammate a staff login, add someone to the team, or invite a new hire, gather their first name, last name, email, and which department they'll join (Success Managers, Acquisition Managers, Setup Managers, Content Team, or Support Team). Then read it ALL back — who you'll email, their name, and their department — and get a clear yes before you do anything. Only after that clear yes, call invite_staff with confirmed:true. It creates their account and emails them a temporary password with a link to the staff login, where they set their own password the first time they sign in — that email is all the gate the new teammate needs, so there is nothing more for the owner to approve afterward. If someone who is NOT an owner asks you to invite staff, tell them warmly that only an owner can do that (the tool refuses regardless). If the person already has a staff account, say so plainly instead of implying a new invite went out.

ESCALATIONS: some client situations are flagged as escalations - urgent things a human needs to handle. When a staff member asks what's escalated, what's urgent, or what still needs attention, call list_escalations and read them back warmly, oldest first, noting how long each has been open. When they tell you an escalation has been handled and want it closed out, resolve it: find the right one with list_escalations, then read back whose it is and the resolution note you'll record, get a clear yes, and only then call resolve_escalation with confirmed:true. If it was already resolved, say so plainly. Never tell a staff member you resolved an escalation unless the tool actually did it this turn.

SCOPE: you handle the reactive desk (opportunities, follow-ups, notes, status), resolving escalations, keeping community/property status current, composing client emails, and — for owners — inviting new staff. Listing a brand-new deal needs photos and lives in the "List a Deal" tab — if they want to add a property, point them there warmly rather than trying to do it here.${docText ? `

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
  // DESTINATION GUARD runs FIRST and is absolute. If the reply contains anything shaped
  // like a payment destination — a wallet address, a routing/account number, a cashtag, a
  // Zelle handle — the text is REPLACED, not appended to. Appending would leave the wrong
  // characters on screen, and a screen reader would still read them aloud. The dangerous
  // case is not a correctly reproduced destination (which is merely against policy) but a
  // corrupted one, which sends money somewhere unrecoverable and cannot be caught by
  // glancing at the screen.
  const leak = containsPaymentDestination(rawText);
  if (leak.leaked) {
    console.error('penny-staff-chat destination_leak_blocked', JSON.stringify(leak.kinds));
    return destinationRefusal();
  }

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
      // The rewrite is a fresh generation, so it gets the destination guard too.
      if (rewritten) {
        const reLeak = containsPaymentDestination(rewritten);
        if (reLeak.leaked) {
          console.error('penny-staff-chat destination_leak_blocked_rewrite', JSON.stringify(reLeak.kinds));
          return destinationRefusal();
        }
        return guardReply(rewritten, toolsRun).text;
      }
    } else {
      console.error('penny-staff-chat rewrite_http', res.status);
    }
  } catch (e) {
    console.error('penny-staff-chat rewrite_threw', e instanceof Error ? e.message : String(e));
  }
  // Rewrite unavailable — fall back to the guaranteed honest append.
  return first.text;
}

// emit is optional. When present, runAgent reports what it is ACTUALLY doing as it does
// it. Every event corresponds to something that happened — a tool that really started,
// really finished, or really failed. A progress signal that cannot say no is worth
// nothing, so failures are emitted as failures rather than being swallowed to keep the
// stream looking healthy.
type Emit = (ev: Record<string, unknown>) => void;

// Spoken labels. A screen reader announcing "list_marketplace" is noise; "Checking the
// marketplace" is information.
const TOOL_LABELS: Record<string, string> = {
  list_leads: 'Checking new leads',
  set_lead_status: 'Updating that lead',
  list_marketplace: 'Checking the marketplace',
  unpublish_property: 'Taking that property off the marketplace',
  add_property: 'Adding that property',
  list_opportunities: 'Pulling up the open inquiries',
  get_opportunity: 'Opening that inquiry',
  update_opportunity_status: 'Updating that inquiry',
  add_opportunity_note: 'Saving that note',
  record_closing: 'Recording the closing',
  find_client: 'Finding that client',
  check_account: 'Checking their account',
  get_client_activity: 'Reading their activity',
  get_client_portfolio: 'Reading their portfolio',
  get_client_email: 'Looking up their email',
  compose_client_email: 'Drafting the email',
  send_client_email: 'Sending the email',
  list_pending_emails: 'Checking drafts waiting to send',
  send_account_invite: 'Sending the invite',
  suspend_client: 'Suspending that account',
  reinstate_client: 'Restoring that account',
  list_communities: 'Checking communities',
  get_community: 'Opening that community',
  update_community: 'Updating that community',
  invite_staff: 'Inviting them to the team',
  get_activity_report: 'Pulling the activity report',
  list_escalations: 'Checking escalations',
  resolve_escalation: 'Resolving that escalation',
};
const toolLabel = (n?: string) => (n && TOOL_LABELS[n]) || 'Working on that';


// Roughly how long each tool takes, from watching them run. Only the genuinely slow ones
// are listed; everything else is a few seconds. These are estimates and are described to
// the person as estimates — a countdown that lies is worse than no countdown.
const SLOW_TOOLS: Record<string, number> = {
  write_article: 45,
  republish_article: 20,
  articles_needing_work: 8,
  research_market: 40,
  present_deal: 8,
  email_client: 10,
  send_agreement: 8,
  who_to_contact: 6,
  seller_flow: 6,
};

// ---- TOOL GATING ----
//
// Penny carries 53 tools. Their schemas are ~9,800 tokens, and with her doctrine that is
// ~14,000 tokens on EVERY call against an organisation limit of 30,000 tokens per minute.
// Two messages in a minute exhausted it, which is what produced the 429 an owner hit —
// and, before the error messages were fixed, the mysterious "I hit a snag".
//
// Sending every tool on every turn was never necessary. A core set is always available;
// the rest are matched to what the person actually asked for. She keeps full AWARENESS of
// everything through her prompt, so she can still say "I can do that" and then do it on
// the next turn when the group loads.
const CORE_TOOLS = new Set([
  'my_alerts', 'claim_alert', 'my_book', 'who_to_contact', 'client_book', 'find_client_file',
  'find_client', 'log_touch', 'attention', 'remember', 'forget',
]);

const TOOL_GROUPS: Record<string, { words: RegExp; tools: string[] }> = {
  deals: {
    words: /deal|propert|listing|marketplace|unpublish|publish|address|release|quote|forge|price|rent|market/i,
    tools: ['list_marketplace','unpublish_property','add_property','quote_deal','forge_status',
            'release_property','present_deal','property_detail','search_properties'],
  },
  clients: {
    words: /client|investor|portfolio|credit|account|suspend|reinstate|assign|manager|book|contact/i,
    tools: ['get_client_portfolio','suspend_client','reinstate_client','assign_manager',
            'assign_client_file','update_client_file','check_account','client_activity'],
  },
  leads: {
    words: /lead|inquir|interest|new person|came in|signed up|joined/i,
    tools: ['list_leads','set_lead_status','list_inquiries','set_inquiry_status','add_inquiry_note'],
  },
  email: {
    words: /email|write|send|message|reach out|follow up|invite|notify/i,
    tools: ['email_client','compose_client_email','send_client_email','send_account_invite','notify_staff'],
  },
  content: {
    words: /article|library|content|write|blog|publish|review|verif/i,
    tools: ['articles_needing_work','write_article','articles_awaiting_review','decide_article',
            'republish_article'],
  },
  seller: {
    words: /seller|sale|offer|counter|buyer|verification|transaction|resale/i,
    tools: ['seller_flow','landlord_portal','list_third_party_deal','send_account_invite'],
  },
  staff: {
    words: /staff|team|success team|hire|onboard|commission|escalat|dispute|legal|complaint/i,
    tools: ['list_staff','invite_staff','list_escalations','resolve_escalation','raise_alert'],
  },
  payments: {
    words: /payment|pay|invoice|wire|zelle|cash ?app|bitcoin|deposit|balance|commission|payout/i,
    tools: ['get_payment_methods','create_payment_link','list_payment_requests',
            'payout_status','save_payout'],
  },
  agreements: {
    words: /agreement|contract|sign|document|paperwork|onboard/i,
    tools: ['my_agreements','send_agreement','sign_agreement','list_staff','invite_staff','my_sop','team_readiness'],
  },
  procedure: {
    words: /sop|procedure|responsib|what should i|my role|my job|how do i/i,
    tools: ['my_sop','my_book','my_alerts'],
  },
};

// Everything the model may call this turn. Core always, plus any group whose words appear
// in what was actually said. Nothing is hidden permanently — a group loads the moment the
// subject comes up.
function toolsForTurn(userText: string) {
  const wanted = new Set(CORE_TOOLS);
  for (const g of Object.values(TOOL_GROUPS)) {
    if (g.words.test(userText)) for (const t of g.tools) wanted.add(t);
  }
  const picked = TOOLS.filter((t: any) => wanted.has(t?.function?.name));
  // If matching produced almost nothing, send everything rather than leave her unable to
  // act. A smaller payload is not worth a refusal on a request we simply failed to classify.
  return picked.length >= 8 ? picked : TOOLS;
}

async function runAgent(messages: Array<{ role: string; content: string }>, first: string, ctx: Ctx, emit?: Emit) {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) {
    console.error('penny-staff-chat missing_OPENAI_API_KEY');
    return { message: "My reasoning service is not configured — OPENAI_API_KEY is missing on the server. That is a platform problem, not something you did." };
  }
  const sys = systemPrompt(first, ctx.isOwner === true, ctx.identified === true, ctx.fullName || first, ctx.docText, ctx.docName, (ctx as any).memories, (ctx as any).attention);

  // Which tools this turn actually needs. Matched against the last few things said rather
  // than only the latest message, so "do that for Elizabeth too" still loads client tools.
  const recentText = messages.slice(-4).map((m) => String(m?.content || '')).join(' ');
  const turnTools = toolsForTurn(recentText);
  console.log('penny-staff-chat tools_this_turn', turnTools.length, 'of', TOOLS.length);
  let didRetry = false;
  // Images ride on the most recent user message, as OpenAI's multimodal content array.
  // Attached to the LAST user turn rather than the first, because a photo sent now is
  // about what is being asked now.
  const imgs: string[] = ((ctx as any).images || []) as string[];
  const shaped = messages.map((m, i) => {
    const isLastUser = m.role === 'user' && i === messages.length - 1;
    if (!isLastUser || !imgs.length) return m;
    return {
      role: 'user',
      content: [
        { type: 'text', text: m.content || 'Look at these and tell me what you see.' },
        ...imgs.map((url) => ({ type: 'image_url', image_url: { url, detail: 'auto' } })),
      ],
    } as any;
  });
  const convo: any[] = [{ role: 'system', content: sys }, ...shaped];
  // Tools whose action truly COMPLETED this turn — the backing the truth spine trusts.
  const toolsRun: string[] = [];

  for (let round = 0; round < 5; round++) {
    emit?.({ type: 'status', phase: 'thinking', text: round === 0 ? 'Thinking' : 'Working through that' });

    // TRUE TEXT STREAMING when someone is watching.
    //
    // Progress events alone still left a wait and then a wall of text. This streams the
    // words as they are generated, which is what Arbo and Clay do.
    //
    // The reason it was not done first is real and had to be solved rather than ignored:
    // guardReply and the payment-destination guard can REPLACE a finished reply. Streaming
    // raw tokens and then retracting them would be worse than waiting.
    //
    // So the guard runs on the ACCUMULATED text as it grows. The moment it trips, the
    // stream stops, a retract event is emitted, and the refusal replaces it. A reader
    // never sees a destination even briefly, and in the normal case the text simply flows.
    const streaming = !!emit;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o', messages: convo, tools: turnTools, tool_choice: 'auto', temperature: 0.4,
        ...(streaming ? { stream: true } : {}),
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error('penny-staff-chat openai_http', res.status, t.slice(0, 300));

      // A 429 TELLS US HOW LONG TO WAIT, and we were throwing that away. The body carries
      // "Please try again in 17.786s". Waiting once and retrying turns a dead turn into a
      // slightly slow one, which is what a person actually wants.
      //
      // Only once, and only for a rate limit. Retrying a 400 just fails twice.
      if (res.status === 429 && !didRetry) {
        const m = t.match(/try again in ([0-9.]+)s/i);
        const waitMs = Math.min(25000, Math.ceil(((m ? parseFloat(m[1]) : 8) + 0.5) * 1000));
        console.log('penny-staff-chat rate_limited_waiting', waitMs);
        emit?.({ type: 'status', phase: 'waiting',
                 text: `Rate limited — waiting ${Math.ceil(waitMs / 1000)}s and trying again.` });
        await new Promise((r) => setTimeout(r, waitMs));
        didRetry = true;
        continue;
      }
      // Surfaced rather than collapsed into a generic failure — a 400 from the tools
      // payload and a 429 rate limit need completely different responses from a person.
      emit?.({ type: 'status', phase: 'error', text: `Reasoning service returned ${res.status}` });
      const plain = await plainReply(key, sys, messages);
      // The no-tools fallback bypasses finalize(), so it needs the same guard.
      if (plain) {
        const pLeak = containsPaymentDestination(plain);
        if (pLeak.leaked) {
          console.error('penny-staff-chat destination_leak_blocked_fallback', JSON.stringify(pLeak.kinds));
          return { message: destinationRefusal() };
        }
        return { message: guardReply(plain, toolsRun).text };
      }
      // THE REASON GOES IN THE MESSAGE, not into an `error` field the client never reads.
      // This exact line produced "I hit a snag reasoning about that" for an owner while
      // the actual cause — an HTTP status and body from the reasoning service — sat in a
      // property nothing displayed. That is the third generic error message in this file
      // to hide its own cause, and the pattern is now fixed rather than the instance.
      return {
        message: `My reasoning service returned ${res.status} and I could not finish that. The detail, so it can be fixed: ${t.slice(0, 240)}`,
        error: `openai ${res.status}: ${t.slice(0, 200)}`,
      };
    }
    let msg: any;
    if (streaming && res.body) {
      // Reassemble the streamed chunks into the same message shape the non-streaming
      // path produces, so everything downstream is identical.
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let content = '';
      let blocked = false;
      const calls: any[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          const payload = t.slice(5).trim();
          if (payload === '[DONE]') continue;
          let ev: any;
          try { ev = JSON.parse(payload); } catch { continue; }
          const delta = ev.choices?.[0]?.delta;
          if (!delta) continue;

          if (typeof delta.content === 'string' && delta.content) {
            content += delta.content;
            if (!blocked) {
              // Checked on every chunk, on the whole reply so far.
              if (containsPaymentDestination(content).leaked) {
                blocked = true;
                emit?.({ type: 'retract' });
              } else {
                emit?.({ type: 'delta', text: delta.content });
              }
            }
          }
          for (const tc of delta.tool_calls || []) {
            const i = tc.index ?? 0;
            calls[i] = calls[i] || { id: '', type: 'function', function: { name: '', arguments: '' } };
            if (tc.id) calls[i].id = tc.id;
            if (tc.function?.name) calls[i].function.name += tc.function.name;
            if (tc.function?.arguments) calls[i].function.arguments += tc.function.arguments;
          }
        }
      }
      const toolCalls = calls.filter(Boolean);

      // AN EMPTY ASSISTANT TURN IS NOT A VALID TURN.
      //
      // If the stream yields no text AND no tool calls — a filtered response, a dropped
      // connection, a provider hiccup — this used to build { content: '' } and push it
      // into the conversation. The next round then sends an assistant message with empty
      // content, which the API rejects, and the whole turn throws.
      //
      // From the outside that looked like "I hit a snag" with an HTTP 200, because an SSE
      // response sends its headers long before anything goes wrong.
      if (!content && toolCalls.length === 0) {
        console.error('penny-staff-chat empty_stream', JSON.stringify({ round }));
        return {
          message: "That came back empty from my reasoning service — nothing was lost, ask me again.",
        };
      }

      msg = { role: 'assistant', content, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) };
    } else {
      const data = await res.json();
      msg = data.choices?.[0]?.message;
    }
    if (!msg) return { message: "I didn't catch that — can you say it again?" };

    if (msg.tool_calls && msg.tool_calls.length) {
      convo.push({ role: 'assistant', content: msg.content || null, tool_calls: msg.tool_calls });
      for (const tc of msg.tool_calls) {
        let args: any = {};
        try { args = JSON.parse(tc.function?.arguments || '{}'); } catch { /* keep {} */ }
        const toolName = tc.function?.name;
        // SHOW THE WORK, WITHOUT SHOWING THE PLUMBING. A person waiting deserves to know
        // she is still going and roughly how long — but never which table, which id, or
        // which internal function. The label is already plain English; this adds an
        // honest estimate so a slow request reads as considered rather than broken.
        emit?.({
          type: 'tool', state: 'running', tool: toolName, label: toolLabel(toolName),
          eta_seconds: SLOW_TOOLS[toolName] ?? 3,
          step: toolsRun.length + 1,
        });
        const result = await execTool(toolName, args, ctx);
        const rr: any = result;
        // Three honest outcomes, never one optimistic one.
        emit?.({
          type: 'tool',
          state: rr?.error ? 'failed' : rr?.needs_confirmation ? 'needs_confirmation' : 'done',
          tool: toolName,
          label: toolLabel(toolName),
          detail: rr?.error ? String(rr.error) : undefined,
        });
        // Only a genuinely-COMPLETED write backs a completion claim. A needs_confirmation
        // return or an error backs nothing, so Penny can't claim an action she only offered.
        const r: any = result;
        //
        // EVERY write tool must appear here. This list had SEVEN entries while twelve
        // write tools existed, so unpublish_property, add_property, set_lead_status,
        // suspend_client, reinstate_client, release_property and create_payment_link
        // could never back a completion claim — the guard saw every one of them as
        // "nothing happened". That is why she told the owner unpublishing Elgin had
        // failed when it had just succeeded.
        //
        // Adding a write tool and not adding it here is now the easiest way to break her
        // honesty, so the default below is deliberately `false`: a tool nobody classified
        // is treated as having done nothing, which errs toward under-claiming.
        const completed =
          toolName === 'send_client_email' ? (r?.sent === true || r?.already_sent === true)
          : toolName === 'send_account_invite' ? (r?.email_sent === true)
          : toolName === 'record_closing' ? (r?.success === true)
          : toolName === 'update_community' ? (r?.ok === true)
          : toolName === 'invite_staff' ? (r?.email_sent === true)
          : toolName === 'resolve_escalation' ? (r?.ok === true)
          : (toolName === 'update_opportunity_status' || toolName === 'add_opportunity_note') ? (r?.ok === true)
          // Marketplace writes. already_off is a genuine success: the desired end state
          // was reached, whether or not this call is what moved it.
          : toolName === 'unpublish_property' ? (r?.ok === true)
          : toolName === 'add_property' ? (r?.ok === true)
          // Lead and client writes.
          : toolName === 'set_lead_status' ? (r?.ok === true)
          : (toolName === 'suspend_client' || toolName === 'reinstate_client') ? (r?.ok === true)
          // A release genuinely happened even when it was already released to them.
          : toolName === 'release_property' ? (r?.ok === true)
          // A payment link counts as done when a link came back, AND when the honest
          // answer was that credits already covered it and no link was needed.
          : toolName === 'create_payment_link' ? (r?.ok === true && (!!r?.payment_url || r?.no_payment_needed === true))
          : false;
        if (toolName && completed) toolsRun.push(toolName);
        convo.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
      }
      continue;
    }
    return { message: await finalize(key, convo, msg.content || '', toolsRun) };
  }
  // Out of rounds. Usually a request covering many items at once — "fix them all" across
  // 46 articles cannot finish in one turn. Say what actually happened and what to do
  // instead, rather than asking someone to rephrase a request that was perfectly clear.
  return {
    message: `That needs more steps than I can take in one turn${
      toolsRun.length ? `, though I did complete: ${toolsRun.join(', ')}` : ''
    }. If you asked me to do something across many items, give me a few at a time — name them or say "the first three" — and I will work through them.`,
  };
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

    // IMAGES. Staff could not send Penny a photo at all, which made her useless for the
    // thing deal flow actually runs on: someone standing in a unit with their phone.
    //
    // Capped at 8 per turn and validated as data URLs. An uncapped array is a way to send
    // a very expensive request by accident.
    const images: string[] = Array.isArray(body.images)
      ? body.images
          .filter((i: unknown) => typeof i === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,/.test(i))
          .slice(0, 8)
      : [];
    if (images.length) {
      console.log('penny-staff-chat images_received', JSON.stringify({ count: images.length }));
    }

    // Owner status is resolved SERVER-SIDE from staff_users.is_owner before the
    // prompt is composed. It is never accepted from the request body, so no
    // caller can claim ownership by asserting it. A lookup failure returns
    // false, i.e. it degrades to ordinary staff rather than granting access.
    const ownerCheck = await staffIsOwner(url, key, staffId);

    // A staff member is "identified" only if the request carried an id AND that id
    // resolved to a real active staff row. Logged either way: when Penny does not know
    // who she is talking to, that must be diagnosable from the logs rather than only
    // visible as a confusing answer in the chat.
    const identified = !!staffId && !!ownerCheck.name;
    const fullName = ownerCheck.name || staffName || '';
    console.log('penny-staff-chat identity', JSON.stringify({
      staff_id_present: !!staffId,
      resolved: identified,
      is_owner: ownerCheck.owner,
      name_source: ownerCheck.name ? 'staff_users' : (staffName ? 'request_body' : 'none'),
    }));

    // Memory is loaded BEFORE the turn, not left as a tool she has to remember to call.
    // A colleague does not consult a notebook before recognising you — they simply know.
    // If she had to choose to look, she would mostly not look, and memory that is usually
    // unread is the same as no memory.
    // Both loaded before the turn, in parallel. Neither is a tool she has to choose to
    // call: awareness she has to opt into is awareness she will mostly skip.
    const [memories, attention] = await Promise.all([
      recallMemory(url, key, staffId),
      loadAttention(url, key),
    ]);
    console.log('penny-staff-chat context_loaded', JSON.stringify({
      memories: memories.length, attention: (attention as any)?.count ?? 0,
    }));

    const agentCtx = {
      url, key, staffId, staffName, isOwner: ownerCheck.owner,
      identified, fullName, docText, docName, memories, attention, images,
    };

    // ---- STREAMING ----
    //
    // Penny used to return one block after a silent wait. On a screen reader that is
    // indistinguishable from being broken: nothing happens, then everything happens.
    //
    // With stream:true she reports what she is ACTUALLY doing while she does it. Every
    // event is tied to something real — a tool that started, finished, or failed. A
    // progress signal that cannot say no is worth nothing, so a failed tool is emitted as
    // failed rather than being hidden to keep the stream looking healthy.
    //
    // The client decides what to ANNOUNCE. Everything is on screen; only milestones are
    // spoken, and not more than one every few seconds.
    if (body?.stream === true) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const send = (ev: Record<string, unknown>) => {
            try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`)); }
            catch { /* client went away; the turn still completes below */ }
          };
          try {
            send({ type: 'start' });
            const out = await runAgent(messages, first, agentCtx, send);
            // The final text arrives as one event. It is NOT chunked into fake tokens:
            // the reply is already complete by then, and pretending otherwise would be
            // theatre rather than progress.
            send({ type: 'message', text: out.message });
            send({ type: 'done' });
          } catch (e) {
            const detail = e instanceof Error ? (e.stack || e.message) : String(e);
            console.error('penny-staff-chat stream_threw', detail);
            // THE REASON IS NOW IN THE MESSAGE.
            //
            // This used to say "I hit a snag part-way through that" and nothing else. An
            // owner saw that repeatedly and there was no way to tell what had failed —
            // the HTTP status was 200 every time, because an SSE response returns its
            // headers before anything goes wrong.
            //
            // A generic error message on a staff-only surface buys nothing and costs the
            // ability to diagnose. Staff get the actual reason.
            send({
              type: 'error',
              text: `Something broke while I was working on that, and here is the actual reason so it can be fixed: ${
                (e instanceof Error ? e.message : String(e)).slice(0, 300)
              }`,
            });
            send({ type: 'done' });
          } finally {
            try { controller.close(); } catch { /* already closed */ }
          }
        },
      });
      return new Response(stream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    const out = await runAgent(messages, first, agentCtx);
    return json({ success: true, message: out.message });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
