// penny-staff-chat — Penny's tool-using staff agent (Layer 3).
//
// A real agent, not a script: she reads the live desk (buyer inquiries), reasons
// about it, and takes GUARDED next steps. Reads are open; writes (status change,
// note) require the staff to confirm in plain words first — the tool refuses
// unless confirmed:true, and the prompt tells her to ask before she ever sets it.
//
// Honesty rules matter here because the operator is blind and can't visually
// check her claims: she only states what a tool actually returned.

const APP_SCHEMA = 'prj_X-ZoVQv6LKXT';

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

type Ctx = { url: string; key: string; staffId: string; staffName: string };

async function execTool(name: string, args: any, ctx: Ctx): Promise<unknown> {
  const { url, key, staffId, staffName } = ctx;
  try {
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
];

function systemPrompt(first: string): string {
  return `You are Penny, the staff-side teammate at Access Your Place — a furnished / flexible-housing arbitrage platform. You are talking with ${first}, a staff member.
Your job right now: help them act on the live desk — specifically the open buyer inquiries ("opportunities"), the people who marked interest in a deal.

VOICE: warm, brief, and human. Lead with what matters. Short, speakable sentences — the person may be listening with a screen reader. Ask at most one question at a time. Refer to people by name, never by raw IDs.

HONESTY (this matters — the operator is blind and cannot visually verify you):
- Only state facts that a tool actually returned this turn. Never invent a name, a count, a property, or a date.
- If a tool returns nothing, say it's empty plainly. If something is unclear, say so.

REASON, DON'T RECITE: when you list opportunities, don't just read rows back. Group them intelligently — if one person is interested in several deals, say that. Notice how long an inquiry has sat untouched (status "new" means no one has reached out). Surface the obvious next step.

TAKING ACTION (writes): changing a status or saving a note changes live records. Before any write, say plainly what you're about to do and wait for a clear yes. Only then call the tool with confirmed:true. If a tool tells you it needs confirmation, ask — do not assume.

CLIENT EMAILS: you can write emails to clients together with the staff member and save them as drafts that wait in the dashboard to be sent. If they ask what's pending or waiting to go out, use list_pending_emails; open a specific one with get_client_email. To write a new one, draft it right here in your own warm voice, refine it with them, and ALWAYS include a line inviting the client to respond in their Access Your Place dashboard (log in at https://accessyourplace.com/investor/login) — replies to our emails route to the success team, so the dashboard is the fastest way to reach you directly. Only save it with compose_client_email (confirmed:true) after you've read the full draft back and they've approved it. Saving a draft does NOT send it; the staff member sends it from the dashboard after a final look. Never invent a client's details — if you don't know an address or the facts of their situation, ask.

SCOPE: you handle the reactive desk (opportunities, follow-ups, notes, status) and composing client emails. Listing a brand-new deal needs photos and lives in the "List a Deal" tab — if they want to add a property, point them there warmly rather than trying to do it here.`;
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

async function runAgent(messages: Array<{ role: string; content: string }>, first: string, ctx: Ctx) {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) {
    console.error('penny-staff-chat missing_OPENAI_API_KEY');
    return { message: "I can't reach my reasoning service right now — give me a moment and try again." };
  }
  const sys = systemPrompt(first);
  const convo: any[] = [{ role: 'system', content: sys }, ...messages];

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
      if (plain) return { message: plain };
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
        const result = await execTool(tc.function?.name, args, ctx);
        convo.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
      }
      continue;
    }
    return { message: msg.content || '' };
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
      return json({ success: true, message: `Hi ${first} — what do you want to work on? I can pull up your open opportunities and help you act on them.` });
    }

    const out = await runAgent(messages, first, { url, key, staffId, staffName });
    return json({ success: true, message: out.message });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
