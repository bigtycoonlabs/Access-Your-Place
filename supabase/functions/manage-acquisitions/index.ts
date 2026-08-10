// TOMBSTONED 9 August 2026.
//
// This function did not do what its name and its callers implied. It ignored the `action`
// parameter entirely and read a completely different shape of request — so every screen
// calling it with an action got silence, not an error, which is the worst available
// outcome on this platform.
//
// The owner's instruction was plain: if it does not exist or half exists, remove it.
//
// It returns 410 Gone rather than being deleted, because a deleted slug 404s with no
// explanation and somebody re-adds it in six months. This says what happened and why.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return new Response(JSON.stringify({
    success: false,
    gone: true,
    error: 'RETIRED_FUNCTION',
    message:
      'This endpoint was retired on 9 August 2026. It never handled the actions its callers sent — ' +
      'it silently ignored them. Nothing here is failing intermittently; it is gone on purpose. ' +
      'If you need this capability, it needs building properly rather than reviving.',
  }), { status: 410, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
});
