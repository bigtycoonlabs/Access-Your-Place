// ayp-db: Supabase Edge Function — DB proxy for Access Your Place Railway server
// Uses public.ayp_* RPC functions (which internally query prj_X-ZoVQv6LKXT)
// This bypasses PostgREST's HTTP API from Railway (which is Cloudflare-blocked)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ayp-secret',
};

// SECURITY: no hardcoded fallback. If AYP_DB_SECRET is not configured, the x-ayp-secret
// path is disabled entirely (fail closed) — a weak/guessable default must never grant access.
const AYP_SECRET = Deno.env.get('AYP_DB_SECRET') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Auth: accept a CONFIGURED x-ayp-secret OR the service role key in Authorization.
  // The secret path only works when AYP_DB_SECRET is set to a real (>=16 char) value —
  // otherwise it is treated as unconfigured and rejected, so there is no default backdoor.
  const secret = req.headers.get('x-ayp-secret');
  const authHeader = req.headers.get('authorization') || '';
  const isServiceRole = !!SERVICE_ROLE_KEY && authHeader.includes(SERVICE_ROLE_KEY.slice(0, 20));
  const secretConfigured = AYP_SECRET.length >= 16;
  const secretOk = secretConfigured && !!secret && secret === AYP_SECRET;
  if (!secretOk && !isServiceRole) {
    return respond({ error: 'Unauthorized' }, 401);
  }

  // Create client using DEFAULT (public) schema — our ayp_* functions are in public
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return respond({ error: 'Invalid JSON body' }, 400); }

  const action = body.action as string;
  const table = body.table as string;

  if (!action) return respond({ error: 'action required' }, 400);

  try {
    if (action === 'ping') {
      return respond({ ok: true, ts: new Date().toISOString() });
    }

    if (!table) return respond({ error: 'table required' }, 400);

    if (action === 'select_raw') {
      // ayp_query(p_table, p_filter, p_limit, p_select, p_order)
      const filter  = (body.filter  as string)  || '';
      const select  = (body.select  as string)  || '*';
      const order   = (body.order   as string)  || 'created_at.desc';
      const limit   = (body.limit   as number)  || 100;

      const { data, error } = await supabase.rpc('ayp_query', {
        p_table:  table,
        p_filter: filter,
        p_limit:  limit,
        p_select: select,
        p_order:  order,
      });

      if (error) return respond({ error: error.message, details: error.details }, 400);
      // ayp_query returns jsonb — may be array or error object
      if (data && typeof data === 'object' && !Array.isArray(data) && (data as Record<string,unknown>).error) {
        return respond({ error: (data as Record<string,unknown>).error }, 400);
      }
      return respond({ data: Array.isArray(data) ? data : [] });
    }

    if (action === 'insert') {
      // ayp_insert(p_table, p_data jsonb)
      const rowData = body.data as Record<string, unknown>;
      if (!rowData) return respond({ error: 'data required' }, 400);

      const { data, error } = await supabase.rpc('ayp_insert', {
        p_table: table,
        p_data:  rowData,
      });

      if (error) return respond({ error: error.message }, 400);
      return respond({ data: Array.isArray(data) ? data : (data ? [data] : []) });
    }

    if (action === 'update') {
      // ayp_update(p_table, p_data jsonb, p_filter jsonb)
      const updates = body.updates as Record<string, unknown>;
      const filter  = body.filter  as Record<string, unknown> || {};
      if (!updates) return respond({ error: 'updates required' }, 400);

      const { data, error } = await supabase.rpc('ayp_update', {
        p_table:  table,
        p_data:   updates,
        p_filter: filter,
      });

      if (error) return respond({ error: error.message }, 400);
      return respond({ data: Array.isArray(data) ? data : (data ? [data] : []) });
    }

    if (action === 'delete') {
      // ayp_delete(p_table, p_filter jsonb)
      const filter = body.filter as Record<string, unknown> || {};

      const { data, error } = await supabase.rpc('ayp_delete', {
        p_table:  table,
        p_filter: filter,
      });

      if (error) return respond({ error: error.message }, 400);
      return respond({ success: true });
    }

    return respond({ error: 'Unknown action: ' + action }, 400);
  } catch (e) {
    return respond({ error: String(e) }, 500);
  }
});
