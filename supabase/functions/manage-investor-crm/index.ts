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

// manage-investor-crm v2.0 - Migrated from createClient to direct PostgREST REST API
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
  if (!res.ok) { const t = await res.text(); console.error('[crm v2.0] GET error:', t.substring(0, 300)); return null; }
  return res.json();
}

async function dbGetWithCount(path: string): Promise<{ data: any; count: number }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { ...getH, 'Prefer': 'count=exact' }
  });
  if (!res.ok) { const t = await res.text(); console.error('[crm v2.0] GET count error:', t.substring(0, 300)); return { data: null, count: 0 }; }
  const data = await res.json();
  const contentRange = res.headers.get('content-range');
  let count = Array.isArray(data) ? data.length : 0;
  if (contentRange) {
    const match = contentRange.match(/\/(\d+)/);
    if (match) count = parseInt(match[1]);
  }
  return { data, count };
}

async function dbPost(path: string, body: any): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: 'POST', headers: mutH, body: JSON.stringify(body) });
  if (!res.ok) { const t = await res.text(); console.error('[crm v2.0] POST error:', t.substring(0, 300)); return null; }
  return res.json();
}

async function dbUpsert(path: string, body: any, onConflict: string): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: { ...mutH, 'Prefer': 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify(body)
  });
  if (!res.ok) { const t = await res.text(); console.error('[crm v2.0] UPSERT error:', t.substring(0, 300)); return null; }
  return res.json();
}

async function dbPatch(path: string, body: any): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: 'PATCH', headers: mutH, body: JSON.stringify(body) });
  if (!res.ok) { const t = await res.text(); console.error('[crm v2.0] PATCH error:', t.substring(0, 300)); return null; }
  return res.json();
}

async function dbDelete(path: string): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: 'DELETE', headers: getH });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });

  try {
    const { action, ...params } = await req.json();
    console.log('[manage-investor-crm v2.0] Action:', action);

    if (action === 'list') {
      const { search, activity_level, limit = 50, offset = 0 } = params;
      
      let path = 'investor_profiles?select=*';
      
      if (search) {
        path += `&or=(full_name.ilike.%25${encodeURIComponent(search)}%25,email.ilike.%25${encodeURIComponent(search)}%25,name.ilike.%25${encodeURIComponent(search)}%25)`;
      }
      if (activity_level && activity_level !== 'all') {
        path += `&activity_level=eq.${activity_level}`;
      }
      
      path += `&order=engagement_score.desc.nullslast&offset=${offset}&limit=${limit}`;
      
      const { data, count } = await dbGetWithCount(path);
      return json({ investors: data || [], total: count });
    }

    if (action === 'get') {
      const { id } = params;
      const investors = await dbGet(`investor_profiles?id=eq.${id}&select=*`);
      const investor = investors?.[0] || null;
      
      const communications = await dbGet(`investor_communications?investor_id=eq.${id}&order=created_at.desc&limit=50&select=*`);
      
      // Note: deal_inquiries join with properties may not work via REST API easily, so fetch separately
      const inquiries = await dbGet(`deal_inquiries?investor_id=eq.${id}&order=created_at.desc&select=*`);
      const acquisitions = await dbGet(`acquisitions?investor_id=eq.${id}&select=*`);

      return json({ investor, communications: communications || [], inquiries: inquiries || [], acquisitions: acquisitions || [] });
    }

    if (action === 'create') {
      const investorData = { ...params.investor, pipeline_stage: 'lead', last_stage_change: new Date().toISOString() };
      const result = await dbPost('investor_profiles', investorData);
      const newInvestor = result?.[0] || result;
      
      if (newInvestor?.id) {
        await dbPost('investor_pipeline_history', {
          investor_id: newInvestor.id, to_stage: 'lead', trigger_type: 'automatic', trigger_reason: 'New investor created', changed_by: 'system'
        });
      }
      
      return json({ investor: newInvestor });
    }

    if (action === 'update') {
      const { id, ...updates } = params;
      updates.updated_at = new Date().toISOString();
      const result = await dbPatch(`investor_profiles?id=eq.${id}`, updates);
      const updated = result?.[0] || result;
      return json({ investor: updated });
    }

    if (action === 'log_communication') {
      const result = await dbPost('investor_communications', params.communication);
      const comm = result?.[0] || result;
      
      if (params.communication?.investor_id) {
        // Update engagement score
        const investors = await dbGet(`investor_profiles?id=eq.${params.communication.investor_id}&select=engagement_score`);
        const currentScore = investors?.[0]?.engagement_score || 0;
        const newScore = Math.min(100, currentScore + 5);
        await dbPatch(`investor_profiles?id=eq.${params.communication.investor_id}`, {
          last_activity_at: new Date().toISOString(),
          engagement_score: newScore
        });
      }
      
      return json({ communication: comm });
    }

    if (action === 'import_csv') {
      const { investors } = params;
      let imported = 0, skipped = 0;
      
      for (const inv of investors) {
        const investorData = { ...inv, pipeline_stage: 'lead', last_stage_change: new Date().toISOString() };
        const result = await dbUpsert('investor_profiles', investorData, 'email');
        if (result) {
          imported++;
          const newInvestor = result?.[0] || result;
          if (newInvestor?.id) {
            await dbPost('investor_pipeline_history', {
              investor_id: newInvestor.id, to_stage: 'lead', trigger_type: 'automatic', trigger_reason: 'CSV import', changed_by: 'system'
            });
          }
        } else {
          skipped++;
        }
      }
      return json({ imported, skipped });
    }

    if (action === 'sync_from_investors') {
      const existingInvestors = await dbGet('investors?select=*');
      if (!existingInvestors?.length) {
        return json({ synced: 0 });
      }
      
      let synced = 0;
      for (const inv of existingInvestors) {
        const profile = {
          email: inv.email,
          full_name: inv.full_name || inv.name || 'Unknown',
          name: inv.name || inv.full_name,
          phone: inv.phone,
          investment_budget_min: inv.budget_min || 0,
          investment_budget_max: inv.budget_max || 0,
          budget_min: inv.budget_min || 0,
          budget_max: inv.budget_max || 0,
          preferred_markets: inv.preferred_markets || [],
          activity_level: 'new',
          pipeline_stage: 'lead',
          last_stage_change: new Date().toISOString()
        };
        const result = await dbUpsert('investor_profiles', profile, 'email');
        if (result) synced++;
      }
      
      return json({ synced });
    }

    if (action === 'get_stats') {
      const all = await dbGet('investor_profiles?select=activity_level,engagement_score,pipeline_stage');
      const total = all?.length || 0;
      const byActivity: Record<string, number> = { vip: 0, high: 0, medium: 0, low: 0, new: 0 };
      const byPipeline: Record<string, number> = { lead: 0, qualified: 0, active: 0, closed: 0 };
      let totalScore = 0;
      (all || []).forEach((i: any) => {
        if (i.activity_level && byActivity[i.activity_level] !== undefined) byActivity[i.activity_level]++;
        if (i.pipeline_stage && byPipeline[i.pipeline_stage] !== undefined) byPipeline[i.pipeline_stage]++;
        totalScore += i.engagement_score || 0;
      });
      
      return json({ total, byActivity, byPipeline, avgEngagement: total ? Math.round(totalScore / total) : 0 });
    }

    return json({ error: 'Invalid action' }, 400);
  } catch (error: any) {
    console.error('[manage-investor-crm v2.0] Error:', error.message);
    return json({ error: error.message }, 500);
  }
});

