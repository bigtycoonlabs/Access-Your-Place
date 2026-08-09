// penny-staff-brief — Penny's welcome + briefing for a staff member.
//
// READ-ONLY. Gathers the real state of the desk and composes a warm, truthful
// briefing in Penny's voice. Never invents a number: every count and item comes
// straight from the database. This is layer 1 of the Penny-first staff console.
//
//   waiting_on_you  — clients Penny has taken as far as she can and needs a human to move
//                     (public.penny_escalations, still open)
//   opportunities   — new buyer interest + fresh leads this week
//   landlord_alerts — new landlord inquiries
//   pending         — unread staff notifications
//   wins            — escalations cleared this week

const APP_SCHEMA = 'prj_X-ZoVQv6LKXT';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// One PostgREST read. Returns the rows AND the exact total (from content-range),
// so counts are honest even when we only show the first few rows.
async function q(
  url: string, key: string, path: string, appSchema: boolean,
): Promise<{ rows: Array<Record<string, any>>; total: number }> {
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Prefer: 'count=exact',
  };
  if (appSchema) headers['Accept-Profile'] = APP_SCHEMA;
  let rows: Array<Record<string, any>> = [];
  let total = 0;
  try {
    const res = await fetch(`${url}/rest/v1/${path}`, { headers });
    const cr = res.headers.get('content-range');
    if (cr && cr.includes('/')) {
      const t = parseInt(cr.split('/')[1], 10);
      if (!Number.isNaN(t)) total = t;
    }
    const data = await res.json();
    if (Array.isArray(data)) rows = data;
    if (!total) total = rows.length;
  } catch { /* ignore — a missing section just reads as empty */ }
  return { rows, total };
}

// One RPC read (public SECURITY DEFINER accessor). Returns rows + total like q(),
// so it drops in wherever a private-schema read used to be.
async function rpcRows(
  url: string, key: string, fn: string, args: Record<string, unknown> = {},
): Promise<{ rows: Array<Record<string, any>>; total: number }> {
  try {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const data = await res.json();
    const rows = Array.isArray(data) ? data : [];
    return { rows, total: rows.length };
  } catch {
    return { rows: [], total: 0 };
  }
}

function ago(iso: string): string {
  const t = new Date(iso).getTime();
  if (!t || Number.isNaN(t)) return '';
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return json({ success: false, error: 'Server not configured' }, 500);

    const staffName = String(body.staff_name || '').trim();
    const first = staffName.split(' ').filter(Boolean)[0] || 'there';
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

    // Gather the real desk state (read-only).
    const [esc, land, inq, leads, notif, resolved, pmail] = await Promise.all([
      q(url, key, `penny_escalations?resolved_at=is.null&select=id,user_name,user_type,summary,created_at&order=created_at.asc&limit=10`, false),
      rpcRows(url, key, 'penny_new_landlord_inquiries'),
      rpcRows(url, key, 'penny_open_inquiries'),
      rpcRows(url, key, 'penny_recent_leads', { p_since: weekAgo }),
      q(url, key, `staff_notifications?is_read=eq.false&select=id,title,message,priority,created_at&order=created_at.desc&limit=10`, true),
      q(url, key, `penny_escalations?resolved_at=gte.${weekAgo}&select=id&limit=1`, false),
      rpcRows(url, key, 'penny_pending_emails'),
    ]);

    const waiting = {
      count: esc.total,
      items: esc.rows.map((r) => ({
        id: r.id,
        who: r.user_name || 'a client',
        user_type: r.user_type || '',
        summary: r.summary || 'needs a hand',
        when: ago(r.created_at),
      })),
    };
    const opportunities = {
      count: inq.total + leads.total,
      items: [
        ...inq.rows.map((r) => ({
          id: r.id, kind: 'buyer interest', who: r.investor_name || 'Someone',
          detail: r.property_label || 'a live deal',
          message: String(r.message || '').slice(0, 140), when: ago(r.created_at),
        })),
        ...leads.rows.map((r) => ({
          id: r.id, kind: 'new lead', who: r.name || 'A visitor',
          detail: [r.city, r.form_type].filter(Boolean).join(' · '), message: '', when: ago(r.created_at),
        })),
      ],
    };
    const landlordAlerts = {
      count: land.total,
      items: land.rows.map((r) => ({
        id: r.id,
        who: r.contact_name || r.company_name || 'A landlord',
        detail: [r.location, r.property_type, r.unit_count ? `${r.unit_count} units` : ''].filter(Boolean).join(' · '),
        when: ago(r.created_at),
      })),
    };
    const pending = {
      count: notif.total,
      items: notif.rows.map((r) => ({
        id: r.id, title: r.title || 'Notification',
        message: String(r.message || '').slice(0, 140),
        priority: r.priority || 'normal', when: ago(r.created_at),
      })),
    };
    const pendingEmails = {
      count: pmail.total,
      items: pmail.rows.map((r) => ({
        id: r.id, to: r.to_name || r.to_email || 'a client', subject: r.subject || '(no subject)', when: ago(r.created_at),
      })),
    };
    const wins = { resolved_this_week: resolved.total, new_interest: inq.total };

    // Compose a warm, honest briefing from the facts only.
    const parts: string[] = [`Hi ${first} — good to see you.`];
    if (waiting.count === 0) {
      parts.push(`Nothing's waiting on you right now — no one's stuck on my end.`);
    } else if (waiting.count === 1) {
      parts.push(`One client is waiting on you — I've taken them as far as I can and need you to move it forward. I'd clear that first.`);
    } else {
      parts.push(`${waiting.count} clients are waiting on you — I've taken each as far as I can and need you to move them forward. I'd clear those first.`);
    }
    if (opportunities.count > 0) {
      const bits: string[] = [];
      if (inq.total > 0) bits.push(`${inq.total} open buyer ${plural(inq.total, 'inquiry', 'inquiries')} on live deals`);
      if (leads.total > 0) bits.push(`${leads.total} new ${plural(leads.total, 'lead', 'leads')} came in this week`);
      parts.push(`On the upside: ${bits.join(', and ')}. Want me to pull ${plural(opportunities.count, 'it', 'them')} up?`);
    }
    if (landlordAlerts.count > 0) {
      parts.push(`${landlordAlerts.count === 1 ? "There's 1 new landlord inquiry" : `There are ${landlordAlerts.count} new landlord inquiries`} to look at.`);
    }
    if (pending.count > 0) {
      parts.push(`${pending.count} ${plural(pending.count, 'item', 'items')} in your notifications need a person.`);
    }
    if (pendingEmails.count > 0) {
      parts.push(`You have ${pendingEmails.count} ${plural(pendingEmails.count, 'email', 'emails')} we composed together, waiting to send${pendingEmails.count === 1 ? ` — the one to ${pendingEmails.items[0].to}` : ''}. Want to review ${plural(pendingEmails.count, 'it', 'them')} before it goes out?`);
    }
    if (wins.resolved_this_week > 0) {
      parts.push(`A win from this week: we cleared ${wins.resolved_this_week} ${plural(wins.resolved_this_week, 'escalation', 'escalations')} together.`);
    }
    if (waiting.count === 0 && opportunities.count === 0 && landlordAlerts.count === 0 && pending.count === 0 && pendingEmails.count === 0) {
      parts.push(`It's genuinely quiet — nothing needs you this second. Good time to get ahead: want to list a deal?`);
    }

    // What actually needs somebody, with ages, from the one function that computes it.
    // The staff home leads with this, so if it cannot be read the screen says so rather
    // than showing a reassuring blank.
    let attention: unknown = null;
    try {
      const r = await fetch(`${url}/rest/v1/rpc/penny_attention`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (r.ok) attention = await r.json();
      else console.error('penny-staff-brief attention_failed', r.status);
    } catch (e) {
      console.error('penny-staff-brief attention_threw', e instanceof Error ? e.message : String(e));
    }

    // The operating picture in one read. The console leads with these numbers, so if this
    // is not returned every tile shows zero — which reads as "the business is empty"
    // rather than "we could not load it". That is the exact failure I shipped last round
    // by adding a screen that consumed a field the endpoint never sent.
    let operations: unknown = null;
    try {
      const r = await fetch(`${url}/rest/v1/rpc/penny_operations_snapshot`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (r.ok) operations = await r.json();
      else console.error('penny-staff-brief operations_failed', r.status);
    } catch (e) {
      console.error('penny-staff-brief operations_threw', e instanceof Error ? e.message : String(e));
    }

    // The role procedure for whoever asked. The SOP tab leads with this, so a screen
    // consuming a field the endpoint never sends would show an empty tab — and somebody
    // reading an empty procedures tab concludes they have no responsibilities.
    let sop: unknown = null;
    if (body.staff_id) {
      try {
        const r = await fetch(`${url}/rest/v1/rpc/penny_my_sop`, {
          method: 'POST',
          headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_staff_id: body.staff_id }),
        });
        if (r.ok) sop = await r.json();
        else console.error('penny-staff-brief sop_failed', r.status);
      } catch (e) {
        console.error('penny-staff-brief sop_threw', e instanceof Error ? e.message : String(e));
      }
    }

    return json({
      success: true,
      attention,
      operations,
      sop,
      staff_name: staffName || null,
      greeting: `Hi ${first} —`,
      message: parts.join(' '),
      sections: { waiting_on_you: waiting, opportunities, landlord_alerts: landlordAlerts, pending, pending_emails: pendingEmails },
      wins,
    });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
