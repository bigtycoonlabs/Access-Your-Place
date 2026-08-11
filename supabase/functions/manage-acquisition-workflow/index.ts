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

// manage-acquisition-workflow v2.0 - Migrated from createClient to direct PostgREST REST API
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const WORKFLOW_STAGES = [
  { stage: 'payment_received', order: 1, name: 'Payment Received' },
  { stage: 'application_process', order: 2, name: 'Application Process' },
  { stage: 'lease_review', order: 3, name: 'Lease Review & Signing' },
  { stage: 'setup_furniture', order: 4, name: 'Furniture Sourcing' },
  { stage: 'setup_software', order: 5, name: 'Software Setup' },
  { stage: 'setup_utilities', order: 6, name: 'Utility Setup' },
  { stage: 'vendor_matching', order: 7, name: 'Vendor Matching' },
  { stage: 'marketing_launch', order: 8, name: 'Marketing Launch' },
  { stage: 'completed', order: 9, name: 'Acquisition Complete' }
];

function getEnv() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return { url, key };
}

function getHeaders(key: string) {
  return {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
  };
}

function mutHeaders(key: string) {
  return {
    ...getHeaders(key),
    'Prefer': 'return=representation'
  };
}

async function db(path: string, method: string, body?: any): Promise<any> {
  const { url, key } = getEnv();
  const headers = method === 'GET' || method === 'DELETE' ? getHeaders(key) : mutHeaders(key);
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  if (method === 'GET' || method === 'POST') {
    return res.json();
  }
  if (method === 'PATCH' || method === 'DELETE') {
    if (res.headers.get('content-type')?.includes('json')) {
      return res.json();
    }
    return res.ok;
  }
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, property_id, investor_id, stage, notes, data: bodyData } = await req.json();
    console.log('[manage-acquisition-workflow v2.0] Action:', action);

    if (action === 'assign_investor') {
      // Assign property to investor and start workflow
      const { url, key } = getEnv();
      await fetch(`${url}/rest/v1/properties?id=eq.${property_id}`, {
        method: 'PATCH',
        headers: mutHeaders(key),
        body: JSON.stringify({
          assigned_investor_id: investor_id,
          acquisition_status: 'assigned',
          workflow_stage: 'payment_received'
        })
      });

      // Create workflow stages
      for (const s of WORKFLOW_STAGES) {
        await db('acquisition_workflow', 'POST', {
          property_id, investor_id,
          stage: s.stage, stage_order: s.order,
          status: s.order === 1 ? 'in_progress' : 'pending'
        });
      }

      return new Response(JSON.stringify({ success: true, message: 'Investor assigned' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (action === 'record_payment') {
      const { url, key } = getEnv();
      const now = new Date().toISOString();

      await fetch(`${url}/rest/v1/properties?id=eq.${property_id}`, {
        method: 'PATCH',
        headers: mutHeaders(key),
        body: JSON.stringify({
          acquisition_fee: bodyData.amount,
          acquisition_fee_paid: true,
          acquisition_fee_paid_date: now,
          workflow_stage: 'application_process'
        })
      });

      await fetch(`${url}/rest/v1/acquisition_workflow?property_id=eq.${property_id}&stage=eq.payment_received`, {
        method: 'PATCH',
        headers: mutHeaders(key),
        body: JSON.stringify({ status: 'completed', completed_at: now })
      });

      await fetch(`${url}/rest/v1/acquisition_workflow?property_id=eq.${property_id}&stage=eq.application_process`, {
        method: 'PATCH',
        headers: mutHeaders(key),
        body: JSON.stringify({ status: 'in_progress', started_at: now })
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (action === 'advance_stage') {
      const { url, key } = getEnv();
      const now = new Date().toISOString();
      const currentIdx = WORKFLOW_STAGES.findIndex(s => s.stage === stage);
      const nextStage = WORKFLOW_STAGES[currentIdx + 1];

      await fetch(`${url}/rest/v1/acquisition_workflow?property_id=eq.${property_id}&stage=eq.${stage}`, {
        method: 'PATCH',
        headers: mutHeaders(key),
        body: JSON.stringify({ status: 'completed', completed_at: now, notes })
      });

      if (nextStage) {
        await fetch(`${url}/rest/v1/properties?id=eq.${property_id}`, {
          method: 'PATCH',
          headers: mutHeaders(key),
          body: JSON.stringify({ workflow_stage: nextStage.stage })
        });

        await fetch(`${url}/rest/v1/acquisition_workflow?property_id=eq.${property_id}&stage=eq.${nextStage.stage}`, {
          method: 'PATCH',
          headers: mutHeaders(key),
          body: JSON.stringify({ status: 'in_progress', started_at: now })
        });
      }

      return new Response(JSON.stringify({ success: true, next_stage: nextStage?.stage }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (action === 'get_workflow') {
      const workflow = await db(`acquisition_workflow?property_id=eq.${property_id}&order=stage_order.asc&select=*`, 'GET');
      return new Response(JSON.stringify({ success: true, workflow: workflow || [] }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    throw new Error('Invalid action');
  } catch (error: any) {
    console.error('[manage-acquisition-workflow v2.0] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
