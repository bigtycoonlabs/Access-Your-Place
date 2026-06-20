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
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

function mask(str: string | null, keep = 0): string {
  if (!str) return '';
  const s = String(str);
  if (keep <= 0) return '*'.repeat(Math.min(s.length, 8));
  return s.slice(0, keep) + '*'.repeat(Math.max(s.length - keep, 3));
}
function maskPhone() { return '***-***-****'; }
function maskEmail(email: string | null) {
  if (!email) return '';
  const [u, d] = String(email).split('@');
  if (!d) return '****';
  return (u ? u[0] : '*') + '***@' + '*****.' + d.split('.').pop();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const b = await req.json();
    const action = b.action;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ---- OPERATOR: list incoming housing requests, PII fully masked ----
    if (action === 'list_open_requests') {
      const { data, error } = await supabase
        .from('resident_requests')
        .select('id, target_city, target_state, budget_monthly, duration_months, move_in_date, notes, status, full_name, email, phone_number, created_at')
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      const masked = (data || []).map((r: any) => ({
        id: r.id,
        first_name: (r.full_name || '').split(' ')[0] || 'Resident',
        last_name_masked: mask((r.full_name || '').split(' ').slice(1).join(' ') || 'X', 1),
        email_masked: maskEmail(r.email),
        phone_masked: maskPhone(),
        target_city: r.target_city, target_state: r.target_state,
        budget_monthly: r.budget_monthly, duration_months: r.duration_months,
        move_in_date: r.move_in_date, notes: r.notes, status: r.status,
        created_at: r.created_at
      }));
      return ok({ requests: masked });
    }

    // ---- OPERATOR: open/append a thread (pitch) ----
    if (action === 'operator_message') {
      const { request_id, operator_id, operator_name, body: msg } = b;
      const { data: reqRow } = await supabase.from('resident_requests')
        .select('status').eq('id', request_id).maybeSingle();
      if (!reqRow || reqRow.status === 'closed') return ok({ error: 'Request closed' }, 400);
      let { data: thread } = await supabase.from('resident_threads')
        .select('id, status').eq('request_id', request_id).eq('operator_id', operator_id).maybeSingle();
      if (!thread) {
        const { data: t, error: tErr } = await supabase.from('resident_threads').insert({
          request_id, operator_id, operator_name: operator_name || 'Operator'
        }).select('id, status').single();
        if (tErr) throw tErr;
        thread = t;
      }
      if (thread.status === 'closed') return ok({ error: 'Thread closed' }, 400);
      const { error: mErr } = await supabase.from('resident_messages').insert({
        thread_id: thread.id, sender_type: 'operator', body: String(msg).slice(0, 4000)
      });
      if (mErr) throw mErr;
      return ok({ ok: true, thread_id: thread.id });
    }

    // ---- RESIDENT: load own dashboard (full PII visible to self) ----
    if (action === 'resident_dashboard') {
      const { access_token } = b;
      const { data: resident } = await supabase.from('residents')
        .select('id, full_name, email, phone_number, status').eq('access_token', access_token).maybeSingle();
      if (!resident) return ok({ error: 'Invalid token' }, 401);
      const { data: requests } = await supabase.from('resident_requests')
        .select('*').eq('resident_id', resident.id).order('created_at', { ascending: false });
      const reqIds = (requests || []).map((r: any) => r.id);
      let threads: any[] = [];
      let messages: any[] = [];
      if (reqIds.length) {
        const { data: th } = await supabase.from('resident_threads').select('*').in('request_id', reqIds);
        threads = th || [];
        const thIds = threads.map((t) => t.id);
        if (thIds.length) {
          const { data: ms } = await supabase.from('resident_messages')
            .select('*').in('thread_id', thIds).order('created_at', { ascending: true });
          messages = ms || [];
        }
      }
      return ok({ resident, requests: requests || [], threads, messages });
    }

    // ---- RESIDENT: reply in a thread ----
    if (action === 'resident_message') {
      const { access_token, thread_id, body: msg } = b;
      const { data: resident } = await supabase.from('residents')
        .select('id').eq('access_token', access_token).maybeSingle();
      if (!resident) return ok({ error: 'Invalid token' }, 401);
      const { data: thread } = await supabase.from('resident_threads')
        .select('id, status, request_id').eq('id', thread_id).maybeSingle();
      if (!thread || thread.status === 'closed') return ok({ error: 'Thread closed' }, 400);
      const { error } = await supabase.from('resident_messages').insert({
        thread_id, sender_type: 'resident', body: String(msg).slice(0, 4000)
      });
      if (error) throw error;
      return ok({ ok: true });
    }

    // ---- RESIDENT: accept an operator -> unlock PII for them, wipe all others ----
    if (action === 'accept_operator') {
      const { access_token, thread_id } = b;
      const { data: resident } = await supabase.from('residents')
        .select('id').eq('access_token', access_token).maybeSingle();
      if (!resident) return ok({ error: 'Invalid token' }, 401);
      const { data: thread } = await supabase.from('resident_threads')
        .select('id, request_id, operator_id').eq('id', thread_id).maybeSingle();
      if (!thread) return ok({ error: 'Thread not found' }, 404);

      // verify ownership
      const { data: reqRow } = await supabase.from('resident_requests')
        .select('id, resident_id').eq('id', thread.request_id).maybeSingle();
      if (!reqRow || reqRow.resident_id !== resident.id) return ok({ error: 'Forbidden' }, 403);

      // Mark request selected + PII unlocked for chosen operator
      await supabase.from('resident_requests').update({
        status: 'selected', selected_operator_id: thread.operator_id, pii_unlocked: true
      }).eq('id', thread.request_id);

      // Selected thread -> selected
      await supabase.from('resident_threads').update({ status: 'selected' }).eq('id', thread_id);

      // All other threads on this request -> closed + wipe their messages
      const { data: others } = await supabase.from('resident_threads')
        .select('id').eq('request_id', thread.request_id).neq('id', thread_id);
      const otherIds = (others || []).map((t: any) => t.id);
      if (otherIds.length) {
        await supabase.from('resident_messages').delete().in('thread_id', otherIds);
        await supabase.from('resident_threads').update({ status: 'closed' }).in('id', otherIds);
      }
      return ok({ ok: true });
    }

    return ok({ error: 'Unknown action' }, 400);
  } catch (e) {
    return ok({ error: String(e?.message || e) }, 500);
  }

  function ok(body: any, status = 200) {
    return new Response(JSON.stringify(body), {
      status, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

