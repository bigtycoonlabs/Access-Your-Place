// RETIRED 2026-08-05 by owner decision. Body intentionally removed.
// See docs/KEEP_OR_TRASH_PROPOSAL.md and the retirement commit for the full
// reason this function was withdrawn rather than repaired.
//
// The Supabase MCP exposes deploy but not delete, so the function slug still
// exists. This tombstone replaces the dangerous body: it performs no work,
// touches no data, and answers every call with HTTP 410 Gone.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  console.error('scheduled-report-generation invoked after retirement — check the caller');

  return new Response(
    JSON.stringify({
      success: false,
      retired: true,
      error: 'scheduled-report-generation was retired on 2026-08-05. It produced client-facing market reports from unmeasured figures and must not be used.',
    }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
