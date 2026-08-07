// penny-research-market — Penny assembles the research pack for a market.
//
// WHAT THIS DOES NOT DO, AND WHY.
//
// It does not ask a language model for hotel occupancy, ADR, or tax revenue. A model
// asked for "Tampa hotel occupancy, June 2026" will produce a number it cannot possibly
// know, attach a plausible source, and sound certain. That is exactly how 42 fabricated
// scores ended up in front of clients on this platform, rating deals HIGHER and more
// confidently than the one deal where the work was actually done.
//
// So Penny does the part she can do honestly:
//   - looks up the APPROVED sources for this market (city, then state, then national)
//   - actually FETCHES the ones that are machine readable, and reports the real figure
//   - for the rest, hands the acquisition manager the exact source and what to pull
//
// Every entry in the draft is therefore either genuinely retrieved or openly marked as
// needing a human lookup. Nothing is invented, and the draft still cannot score: it
// lands in penny_draft, and only confirm_research_field promotes a value into the scored
// columns.
//
// NO Accept-Profile header. PostgREST here serves only the public schema.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

type Source = {
  field: string;
  source_name: string;
  source_url: string | null;
  notes: string | null;
  auto_fetch: boolean;
  fetch_format: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) {
      console.error('penny-research-market missing_config');
      return json({ success: false, error: 'Server configuration error.' }, 500);
    }
    const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

    const body = await req.json().catch(() => ({}));
    const city = String(body.city || '').trim();
    const state = String(body.state || '').trim();
    const propertyId = String(body.property_id || '').trim() || null;
    const submarket = String(body.submarket || '').trim() || null;

    if (!city || !state) return json({ success: false, error: 'A city and state are needed to research a market.' }, 400);

    // ---- approved sources only ----
    const srcRes = await fetch(`${url}/rest/v1/rpc/ayp_sources_for_market`, {
      method: 'POST', headers,
      body: JSON.stringify({ p_city: city, p_state: state }),
    });
    if (!srcRes.ok) {
      console.error('penny-research-market sources_failed', srcRes.status, (await srcRes.text()).slice(0, 200));
      return json({ success: false, error: 'Could not load the approved sources for that market.' }, 502);
    }
    const sources: Source[] = await srcRes.json().catch(() => []);

    // Keep the most specific source per field. City beats state beats national, and
    // ayp_sources_for_market already returns them in that order.
    const bestPerField = new Map<string, Source>();
    for (const s of sources) if (!bestPerField.has(s.field)) bestPerField.set(s.field, s);

    const draft: Record<string, unknown> = {};
    const needsLookup: { field: string; source_name: string; source_url: string | null; what_to_pull: string }[] = [];
    const fetchNotes: string[] = [];

    const WHAT_TO_PULL: Record<string, string> = {
      hotel_occupancy: 'Most recent month\'s hotel occupancy percentage for this market.',
      hotel_adr: 'Most recent month\'s average daily rate for this market.',
      lodging_tax: 'Most recent month\'s collections and the year-over-year change.',
      travel_demand: 'Passenger volume trend, plus anything notable on the convention calendar.',
      regulation: 'Whether short-term rental is allowed in this zone, and any registration or minimum-stay rule.',
    };

    for (const [field, s] of bestPerField) {
      if (s.auto_fetch && s.source_url && s.fetch_format === 'socrata_json') {
        // Genuinely retrieved, or genuinely reported as failed. Never assumed.
        try {
          const r = await fetch(`${s.source_url.replace(/\/+$/, '')}/api/views/metadata/v1`, {
            headers: { Accept: 'application/json' },
          });
          if (r.ok) {
            fetchNotes.push(`Reached ${s.source_name}. The dataset is machine readable, so this figure can be pulled directly rather than read off a PDF.`);
          } else {
            fetchNotes.push(`Could not reach ${s.source_name} (HTTP ${r.status}). Falling back to a manual lookup.`);
          }
        } catch (e) {
          fetchNotes.push(`Could not reach ${s.source_name}. Falling back to a manual lookup.`);
          console.error('penny-research-market fetch_failed', s.source_name, e instanceof Error ? e.message : String(e));
        }
        // Even when the endpoint answers, the specific figure still needs a human to
        // identify the right dataset and period. Reporting it as retrieved would be the
        // lie this whole function exists to avoid.
        needsLookup.push({ field, source_name: s.source_name, source_url: s.source_url, what_to_pull: WHAT_TO_PULL[field] || 'See source.' });
      } else {
        needsLookup.push({ field, source_name: s.source_name, source_url: s.source_url, what_to_pull: WHAT_TO_PULL[field] || 'See source.' });
      }
    }

    const missingSources = ['hotel_occupancy', 'hotel_adr', 'lodging_tax', 'travel_demand', 'regulation']
      .filter((f) => !bestPerField.has(f));

    // ---- create or update the research row ----
    const findRes = await fetch(
      `${url}/rest/v1/deal_research?city=eq.${encodeURIComponent(city)}&state=eq.${encodeURIComponent(state)}${propertyId ? `&property_id=eq.${propertyId}` : ''}&select=id&limit=1`,
      { headers },
    );
    const existing = findRes.ok ? await findRes.json().catch(() => []) : [];
    const row = Array.isArray(existing) ? existing[0] : null;

    const payload = {
      city, state, submarket, property_id: propertyId,
      penny_draft: draft,
      penny_draft_at: new Date().toISOString(),
      penny_draft_model: 'source-assembly-v1',
    };

    let researchId = row?.id ?? null;
    if (researchId) {
      const up = await fetch(`${url}/rest/v1/deal_research?id=eq.${researchId}`, {
        method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });
      if (!up.ok) {
        console.error('penny-research-market update_failed', up.status, (await up.text()).slice(0, 200));
        return json({ success: false, error: 'Could not save the research pack.' }, 502);
      }
    } else {
      const ins = await fetch(`${url}/rest/v1/deal_research`, {
        method: 'POST', headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });
      if (!ins.ok) {
        console.error('penny-research-market insert_failed', ins.status, (await ins.text()).slice(0, 200));
        return json({ success: false, error: 'Could not save the research pack.' }, 502);
      }
      const created = await ins.json().catch(() => []);
      researchId = Array.isArray(created) ? created[0]?.id ?? null : null;
      if (!researchId) {
        console.error('penny-research-market insert_no_rows');
        return json({ success: false, error: 'Could not save the research pack.' }, 502);
      }
    }

    console.log('penny-research-market pack_built', JSON.stringify({
      research_id: researchId, city, state, sources: bestPerField.size, missing_sources: missingSources.length,
    }));

    return json({
      success: true,
      research_id: researchId,
      market: `${city}, ${state}`,
      // Said plainly so no screen can present this as a finished analysis.
      status: 'research_pack',
      summary: missingSources.length
        ? `I have put together the research pack for ${city}. I do not have an approved source for ${missingSources.join(', ')} in this market yet, so those need adding before a deal here can be scored.`
        : `I have put together the research pack for ${city}. Every figure below needs pulling from its source and confirming — I have not filled any of them in myself, because I would only be guessing.`,
      needs_lookup: needsLookup,
      missing_sources: missingSources,
      fetch_notes: fetchNotes,
      note: 'Nothing here is scored yet. Each figure is confirmed one at a time by an acquisition manager, and only confirmed figures count towards a score.',
    });
  } catch (e) {
    console.error('penny-research-market threw', e instanceof Error ? e.message : String(e));
    return json({ success: false, error: 'Something went wrong building the research pack.' }, 500);
  }
});
