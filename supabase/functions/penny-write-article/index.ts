// penny-write-article — Penny drafts for the knowledge library.
//
// THE CONSTRAINT THAT SHAPES EVERYTHING HERE:
//
// This library already shipped a Houston guide claiming a "$334 permit" (it is $275 plus a
// $33.10 admin fee), an invented "owner must live within 200 miles" rule, and an invented
// "maximum 3 STRs per owner" cap. It shipped a Nashville guide with the wrong permit fee
// and, worse, describing a permit type as merely difficult when new ones had been phased
// out entirely. An operator could have signed a lease on the strength of either.
//
// So throughput is not the goal. NOT INVENTING A NUMBER is the goal.
//
// Three rules, enforced in code rather than hoped for in a prompt:
//
//   1. NOTHING PUBLISHES ITSELF. Everything lands as needs_review. A human approves.
//   2. Every fee, rate, deadline or legal rule must carry a source URL. Claims the model
//      cannot source are extracted into unsourced_claims and shown to the reviewer, rather
//      than being quietly folded into the prose where they read as fact.
//   3. If the model returns no sources at all, the draft is REFUSED and nothing is written.
//      An unsourced regulatory article is worse than no article.
//
// Two modes:
//   rewrite — take an existing article and re-verify it against real sources
//   new     — write something the library is missing

import { containsPaymentDestination } from '../_shared/penny/doctrine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

async function rest(url: string, key: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

const SYSTEM = `You write for the Access Your Place knowledge library.

WHO READS THIS: someone about to put their own savings into a furnished rental operation.
Often alongside a job. Frequently it is the most money they have risked on anything. If you
are wrong about a permit fee they budget wrong. If you are wrong about whether a permit is
even available, they sign a lease they cannot use.

THE ONE RULE THAT OVERRIDES EVERYTHING: never state a fee, tax rate, deadline, cap or legal
requirement you cannot attach to a real source. Not an estimate, not "typically around",
not a number that looks right. If you do not have it, say the reader must confirm it with
the city and put it in unsourced_claims.

We have already published invented rules and it could have cost someone real money. That is
the failure this job exists to prevent.

STYLE
- Plain, direct, speakable. Short sentences. A reader may be listening with a screen reader.
- No hype. No "unlock", "leverage", "in today's fast-paced market".
- Lead with what decides the deal, not with a history of the city.
- Say plainly when a market is bad for arbitrage. That is the most useful thing you can
  write, and it is the thing nobody else writes.
- Never claim how many properties we have launched anywhere.
- Never state a payment destination of any kind.

STRUCTURE: an H1-worthy title, then sections with clear headings. Fees and rules as short
lists. End with what it means for an operator in practice.

Return ONLY valid JSON, no markdown fences:
{
  "title": "...",
  "slug": "lowercase-hyphenated",
  "category": "STR Regulations" | "Acquisition" | "Setup & Operations" | "Tips & Tricks",
  "meta_description": "under 160 characters",
  "excerpt": "one or two sentences",
  "content": "the full article as plain text with headings",
  "sources": ["https://...", "https://..."],
  "unsourced_claims": ["any statement you could not attach to a source"]
}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL') || '';
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const openai = Deno.env.get('OPENAI_API_KEY') || '';
    if (!openai) return json({ ok: false, error: 'No OPENAI_API_KEY. Nothing was written.' }, 500);

    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode || 'new');
    const staffId = body.staff_id ? String(body.staff_id) : null;

    // ---- gather REAL grounding before writing a word ----
    let existing: any = null;
    let topic = String(body.topic || '').trim();
    let city = String(body.city || '').trim();
    let state = String(body.state || '').trim();

    if (mode === 'rewrite') {
      if (!body.article_id) return json({ ok: false, error: 'Which article? article_id is required.' }, 400);
      const r = await rest(url, key, `blog_articles?id=eq.${body.article_id}&select=*`);
      const rows = Array.isArray(r.data) ? r.data : [];
      existing = rows[0];
      if (!existing) return json({ ok: false, error: 'No article with that id. Nothing was written.' }, 404);
      city = existing.city || city;
      state = existing.state || state;
      topic = existing.title;
    }

    // Approved sources for this market. Penny may cite from here and from what she is
    // given — broad invention is exactly what produced the bad articles.
    let sources: any[] = [];
    if (city || state) {
      const q = city
        ? `research_sources?is_active=eq.true&city=ilike.*${encodeURIComponent(city)}*&select=source_name,source_url,field,notes&limit=25`
        : `research_sources?is_active=eq.true&state=eq.${encodeURIComponent(state)}&select=source_name,source_url,field,notes&limit=25`;
      const r = await rest(url, key, q);
      sources = Array.isArray(r.data) ? r.data : [];
    }

    const existingTitles = await rest(
      url, key, 'blog_articles?select=title,slug&order=created_at.desc&limit=60',
    );
    const titles = (Array.isArray(existingTitles.data) ? existingTitles.data : [])
      .map((a: any) => a.title).filter(Boolean);

    const grounding = [
      sources.length
        ? `APPROVED SOURCES for this market — prefer these, and cite the URL you actually used:\n${
            sources.map((s: any) => `- ${s.source_name} (${s.field}): ${s.source_url}${s.notes ? ` — ${s.notes}` : ''}`).join('\n')
          }`
        : 'NO APPROVED SOURCES ARE REGISTERED FOR THIS MARKET. Say so plainly in the article and put every specific figure in unsourced_claims.',
      existing
        ? `You are REWRITING this article. Keep what is right, fix what is wrong, and do not preserve a number just because it was already there:\n\n${String(existing.content).slice(0, 6000)}`
        : '',
      titles.length ? `The library already covers these — do not repeat one:\n${titles.slice(0, 40).join('\n')}` : '',
      topic ? `Topic: ${topic}` : '',
      city || state ? `Market: ${[city, state].filter(Boolean).join(', ')}` : '',
    ].filter(Boolean).join('\n\n');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openai}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: grounding },
        ],
        temperature: 0.4,
        max_tokens: 3000,
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error('penny-write-article openai_http', res.status, t.slice(0, 300));
      // FOUR different failures used to return the same 502 with a message that did not
      // say which. Production logged five of these in two seconds, each under 900ms —
      // far too fast to be a real generation, so they were rejections, not timeouts.
      //
      // A rate limit is the one that matters here: it means somebody asked for every
      // article at once and the writer was called in a burst. That needs "slow down and
      // do a few", not "try again", so it says so.
      if (res.status === 429) {
        return json({
          ok: false, rate_limited: true,
          error: 'The writing model is rate limiting us — too many articles requested at once. Do a few at a time rather than all of them.',
        }, 429);
      }
      return json({
        ok: false,
        error: `The writing model returned ${res.status} and nothing was written. Detail: ${t.slice(0, 200)}`,
      }, 502);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || '';
    let draft: any;
    try {
      draft = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      console.error('penny-write-article unparseable', raw.slice(0, 300));
      return json({ ok: false,
        error: `The draft came back as something other than JSON, so nothing was written. It started: ${raw.slice(0, 120)}`,
      }, 502);
    }

    if (!draft?.title || !draft?.content || !draft?.slug) {
      return json({ ok: false,
        error: `The draft was missing ${[!draft?.title && 'a title', !draft?.slug && 'a slug', !draft?.content && 'a body'].filter(Boolean).join(' and ')}. Nothing was written.`,
      }, 502);
    }

    // RULE 3: an unsourced regulatory article is worse than no article.
    const cited: string[] = Array.isArray(draft.sources) ? draft.sources.filter(Boolean) : [];
    const regulatory = /permit|licen[cs]e|ordinance|zoning|tax/i.test(draft.content);
    if (regulatory && cited.length === 0) {
      return json({
        ok: false,
        refused: true,
        error: 'That draft states rules or rates and cited no sources, so it was not saved. An unsourced regulatory article is worse than none.',
      }, 422);
    }

    // The destination guard applies to anything Penny writes, anywhere.
    const leak = containsPaymentDestination(draft.content);
    if (leak.leaked) {
      console.error('penny-write-article destination_leak_blocked', JSON.stringify(leak.kinds));
      return json({ ok: false, error: 'The draft contained something shaped like a payment destination and was discarded.' }, 422);
    }

    const unsourced: string[] = Array.isArray(draft.unsourced_claims) ? draft.unsourced_claims : [];
    const slug = String(draft.slug).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

    const row: Record<string, unknown> = {
      title: draft.title,
      slug: mode === 'rewrite' ? `${slug}-v2-${Date.now().toString(36)}` : slug,
      category: draft.category || 'STR Regulations',
      excerpt: draft.excerpt || null,
      meta_description: (draft.meta_description || '').slice(0, 160) || null,
      content: draft.content,
      city: city || null,
      state: state || null,
      status: 'draft',                 // NOT published. A human approves.
      authored_by: 'penny',
      review_state: 'needs_review',
      review_requested_at: new Date().toISOString(),
      legal_sources: cited,
      unsourced_claims: unsourced,
      rewrite_of: existing?.id || null,
      created_at: new Date().toISOString(),
    };

    const ins = await rest(url, key, 'blog_articles', { method: 'POST', body: JSON.stringify(row) });
    if (!ins.ok) {
      console.error('penny-write-article insert_failed', ins.status, JSON.stringify(ins.data).slice(0, 300));
      return json({ ok: false,
        error: `The draft could not be saved (${ins.status}). Detail: ${JSON.stringify(ins.data).slice(0, 200)}`,
      }, 502);
    }
    const saved = Array.isArray(ins.data) ? ins.data[0] : ins.data;

    console.log('penny-write-article drafted', JSON.stringify({
      slug: row.slug, mode, sources: cited.length, unsourced: unsourced.length,
    }));

    return json({
      ok: true,
      article_id: saved?.id,
      slug: row.slug,
      title: draft.title,
      mode,
      source_count: cited.length,
      unsourced_claims: unsourced,
      status: 'needs_review',
      note: unsourced.length
        ? `Drafted and waiting for review. ${unsourced.length} claim(s) could not be sourced and are flagged for whoever reviews it.`
        : 'Drafted and waiting for review. Every figure in it carries a source.',
      requested_by: staffId,
    });
  } catch (e) {
    console.error('penny-write-article threw', e instanceof Error ? e.message : String(e));
    return json({ ok: false, error: 'Something went wrong writing that. Nothing was saved.' }, 500);
  }
});
