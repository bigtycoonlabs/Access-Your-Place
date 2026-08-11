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
// Nightly Penny Score Refresh
//
// Runs at 2 AM via pg_cron, scans all properties where penny_scored_at is NULL
// or older than 7 days, and invokes the penny-deal-scoring edge function for
// each one in batches of 5 to keep penny_deal_scores cache fresh.
//
// Logs every run to the penny_score_refresh_log table.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET'
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const STALE_DAYS = 7;
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 2000; // pause between batches to avoid rate-limiting penny-deal-scoring

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const startedAt = new Date();
  const runId = `penny-refresh-${startedAt.toISOString()}`;

  // Parse trigger metadata
  let triggerType: 'cron' | 'manual' = 'cron';
  let triggeredBy: string | null = null;
  let onlyStale = true;
  let limitOverride: number | null = null;
  try {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      if (body.trigger_type === 'manual') triggerType = 'manual';
      triggeredBy = body.triggered_by || null;
      if (body.only_stale === false) onlyStale = false;
      if (typeof body.limit === 'number') limitOverride = body.limit;
    }
  } catch (_) {
    // ignore body parse failures
  }

  // Insert initial log row in 'running' state
  const { data: logRow, error: logErr } = await supabase
    .from('penny_score_refresh_log')
    .insert({
      run_id: runId,
      started_at: startedAt.toISOString(),
      trigger_type: triggerType,
      triggered_by: triggeredBy,
      status: 'running',
      properties_scanned: 0,
      properties_scored: 0,
      errors_encountered: 0,
      error_details: []
    })
    .select()
    .single();

  if (logErr) {
    console.error('[nightly-penny-score-refresh] Failed to create log row:', logErr);
  }
  const logId = logRow?.id;

  let propertiesScored = 0;
  let errorsEncountered = 0;
  const errorDetails: any[] = [];

  try {
    // Build the stale-properties query
    const staleCutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('properties')
      .select('id, address, city, state, zip_code, monthly_rent, bedrooms, bathrooms, operation_type, penny_scored_at, deal_status')
      .in('deal_status', ['live', 'published', 'active', 'available']);

    if (onlyStale) {
      // Postgrest "or" filter: penny_scored_at is null OR older than cutoff
      query = query.or(`penny_scored_at.is.null,penny_scored_at.lt.${staleCutoff}`);
    }

    if (limitOverride && limitOverride > 0) {
      query = query.limit(limitOverride);
    } else {
      query = query.limit(500); // safety cap per run
    }

    const { data: staleProps, error: queryErr } = await query;
    if (queryErr) throw queryErr;

    const propertiesScanned = staleProps?.length || 0;
    console.log(`[nightly-penny-score-refresh] Found ${propertiesScanned} stale properties (cutoff=${staleCutoff})`);

    if (logId) {
      await supabase
        .from('penny_score_refresh_log')
        .update({ properties_scanned: propertiesScanned })
        .eq('id', logId);
    }

    // Process in batches of BATCH_SIZE in parallel
    for (let i = 0; i < (staleProps?.length || 0); i += BATCH_SIZE) {
      const batch = staleProps!.slice(i, i + BATCH_SIZE);
      console.log(`[nightly-penny-score-refresh] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} props)`);

      const batchResults = await Promise.allSettled(
        batch.map(async (prop: any) => {
          try {
            const { data, error } = await supabase.functions.invoke('penny-deal-scoring', {
              body: {
                action: 'score_property',
                property_id: prop.id,
                property_data: prop
              }
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || 'No success flag in scoring response');

            // GUARD: never publish a score that has no research behind it.
            //
            // 42 of the 43 rows in penny_deal_scores were produced without a single one
            // of the inputs the acquisition managers' method depends on -- no hotel
            // occupancy, no hotel ADR, no regulation check, no competition analysis -- and
            // scored HIGHER and with MORE confidence than the one deal where the work was
            // actually done. All 21 live properties carried one, and they render to
            // investors in five places.
            //
            // Those were suppressed in migration suppress_unresearched_penny_scores, which
            // also nulled penny_scored_at. This job selects on penny_scored_at IS NULL, so
            // without this guard the next manual run would refill every one of them.
            //
            // A score is only written if the scorer reports the raw-market research that
            // makes it defensible. Otherwise the timestamp advances (so the property is
            // not rescanned forever) and the score stays empty. Penny saying "we have not
            // scored this one yet" is true; a confident number from nothing is not, and
            // this company's clients buy because they trust the data.
            const researched =
              data.sop_hotel_occupancy_checked === true &&
              data.sop_hotel_adr_checked === true &&
              data.sop_travel_trends_checked === true &&
              data.sop_seasonality_checked === true &&
              data.sop_regulation_checked === true &&
              data.sop_competition_checked === true;

            if (!researched) {
              console.warn('nightly-penny-score-refresh score_withheld_no_research', JSON.stringify({ property_id: prop.id }));
              await supabase
                .from('properties')
                .update({ penny_scored_at: new Date().toISOString() })
                .eq('id', prop.id);
              return { success: true, propertyId: prop.id, withheld: true };
            }

            await supabase
              .from('properties')
              .update({
                penny_scored_at: new Date().toISOString(),
                penny_score: data.score ?? null,
                penny_recommendation: data.recommendation ?? null
              })
              .eq('id', prop.id);
            return { success: true, propertyId: prop.id };
          } catch (e: any) {
            return { success: false, propertyId: prop.id, error: e?.message || String(e) };
          }
        })
      );

      for (const r of batchResults) {
        if (r.status === 'fulfilled') {
          if (r.value.success) {
            propertiesScored++;
          } else {
            errorsEncountered++;
            errorDetails.push({ property_id: r.value.propertyId, error: r.value.error });
          }
        } else {
          errorsEncountered++;
          errorDetails.push({ error: r.reason?.message || String(r.reason) });
        }
      }

      // Periodic progress update so the UI can poll for live status
      if (logId) {
        await supabase
          .from('penny_score_refresh_log')
          .update({
            properties_scored: propertiesScored,
            errors_encountered: errorsEncountered,
            error_details: errorDetails.slice(0, 50)
          })
          .eq('id', logId);
      }

      // Pause between batches
      if (i + BATCH_SIZE < (staleProps?.length || 0)) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    // Final log update
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();
    const finalStatus = errorsEncountered > 0 && propertiesScored === 0 ? 'failed' :
                        errorsEncountered > 0 ? 'partial' : 'completed';

    if (logId) {
      await supabase
        .from('penny_score_refresh_log')
        .update({
          completed_at: completedAt.toISOString(),
          properties_scanned: propertiesScanned,
          properties_scored: propertiesScored,
          errors_encountered: errorsEncountered,
          error_details: errorDetails.slice(0, 50),
          status: finalStatus,
          duration_ms: durationMs
        })
        .eq('id', logId);
    }

    return new Response(JSON.stringify({
      success: true,
      run_id: runId,
      properties_scanned: propertiesScanned,
      properties_scored: propertiesScored,
      errors_encountered: errorsEncountered,
      duration_ms: durationMs,
      status: finalStatus
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (err: any) {
    console.error('[nightly-penny-score-refresh] Fatal error:', err);
    if (logId) {
      await supabase
        .from('penny_score_refresh_log')
        .update({
          completed_at: new Date().toISOString(),
          status: 'failed',
          errors_encountered: errorsEncountered + 1,
          error_details: [...errorDetails, { fatal: err?.message || String(err) }].slice(0, 50),
          duration_ms: Date.now() - startedAt.getTime(),
          notes: 'Fatal error - see error_details'
        })
        .eq('id', logId);
    }
    return new Response(JSON.stringify({
      success: false,
      error: err?.message || String(err),
      run_id: runId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
