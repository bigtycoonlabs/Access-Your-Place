import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// DISABLED. Diagnostic retired; reads no environment and returns nothing.
// Safe to delete from the Supabase dashboard (Edge Functions -> env-probe -> Delete).
serve(() => new Response(JSON.stringify({ error: 'gone', disabled: true }), {
  status: 410, headers: { 'Content-Type': 'application/json' },
}))
