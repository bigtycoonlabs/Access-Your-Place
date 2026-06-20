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

// manage-investor-pipeline v2.0 - Migrated from createClient to direct PostgREST REST API
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const getH = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
const mutH = { ...getH, 'Prefer': 'return=representation' };

async function dbGet(path: string): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: getH });
  if (!res.ok) { const t = await res.text(); console.error('[pipeline v2.0] GET error:', t); return null; }
  return res.json();
}

async function dbPost(path: string, body: any): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: 'POST', headers: mutH, body: JSON.stringify(body) });
  if (!res.ok) { const t = await res.text(); console.error('[pipeline v2.0] POST error:', t); return null; }
  return res.json();
}

async function dbPatch(path: string, body: any): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: 'PATCH', headers: mutH, body: JSON.stringify(body) });
  if (!res.ok) { const t = await res.text(); console.error('[pipeline v2.0] PATCH error:', t); return false; }
  return true;
}

async function dbDelete(path: string): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: 'DELETE', headers: getH });
  return res.ok;
}

const STAGES = ['lead', 'qualified', 'active', 'closed'];

async function sendAutomatedEmail(investor: any, sequence: any) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey || !investor.email) return;

  const subject = sequence.email_subject.replace('{{name}}', investor.name || 'Investor');
  const body = sequence.email_body
    .replace(/{{name}}/g, investor.name || 'Investor')
    .replace(/{{email}}/g, investor.email);

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'STR Arbitrage <deals@strarbitrage.com>',
        to: investor.email,
        subject,
        html: body
      })
    });

    await dbPost('pipeline_email_log', {
      investor_id: investor.id,
      sequence_id: sequence.id,
      email_subject: subject,
      status: 'sent'
    });
  } catch (e: any) { console.error('[pipeline v2.0] Email error:', e.message); }
}

async function triggerStageSequences(investorId: string, stage: string) {
  const investors = await dbGet(`investor_profiles?id=eq.${investorId}&select=*`);
  const investor = investors?.[0];
  if (!investor) return;

  const sequences = await dbGet(`pipeline_email_sequences?trigger_stage=eq.${stage}&trigger_type=eq.stage_enter&is_active=eq.true&select=*`);

  for (const seq of sequences || []) {
    if (seq.delay_days === 0) {
      await sendAutomatedEmail(investor, seq);
    }
  }
}

async function updateStage(investorId: string, newStage: string, triggerType: string, reason: string, changedBy: string) {
  const investors = await dbGet(`investor_profiles?id=eq.${investorId}&select=pipeline_stage`);
  const fromStage = investors?.[0]?.pipeline_stage;

  await dbPatch(`investor_profiles?id=eq.${investorId}`, {
    pipeline_stage: newStage,
    last_stage_change: new Date().toISOString(),
    days_in_stage: 0
  });

  await dbPost('investor_pipeline_history', {
    investor_id: investorId,
    from_stage: fromStage,
    to_stage: newStage,
    trigger_type: triggerType,
    trigger_reason: reason,
    changed_by: changedBy
  });

  await triggerStageSequences(investorId, newStage);
  return { success: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

  try {
    const { action, ...params } = await req.json();
    console.log('[manage-investor-pipeline v2.0] Action:', action);

    if (action === 'update_stage') {
      const result = await updateStage(params.investor_id, params.stage, params.trigger_type || 'manual', params.reason || '', params.changed_by || 'system');
      return json(result);
    }

    if (action === 'get_pipeline') {
      const data = await dbGet('investor_profiles?order=last_stage_change.desc.nullslast&select=*');
      const grouped: Record<string, any[]> = { lead: [], qualified: [], active: [], closed: [] };
      (data || []).forEach((inv: any) => {
        const stage = inv.pipeline_stage || 'lead';
        if (grouped[stage]) grouped[stage].push(inv);
      });
      return json(grouped);
    }

    if (action === 'get_history') {
      const data = await dbGet(`investor_pipeline_history?investor_id=eq.${params.investor_id}&order=created_at.desc&select=*`);
      return json(data || []);
    }

    if (action === 'get_sequences') {
      const data = await dbGet('pipeline_email_sequences?order=trigger_stage.asc&select=*');
      return json(data || []);
    }

    if (action === 'save_sequence') {
      const { id, ...seqData } = params.sequence;
      if (id) {
        await dbPatch(`pipeline_email_sequences?id=eq.${id}`, { ...seqData, updated_at: new Date().toISOString() });
      } else {
        await dbPost('pipeline_email_sequences', seqData);
      }
      return json({ success: true });
    }

    if (action === 'delete_sequence') {
      await dbDelete(`pipeline_email_sequences?id=eq.${params.id}`);
      return json({ success: true });
    }

    return json({ error: 'Invalid action' }, 400);
  } catch (error: any) {
    console.error('[manage-investor-pipeline v2.0] Error:', error.message);
    return json({ error: error.message }, 500);
  }
});

