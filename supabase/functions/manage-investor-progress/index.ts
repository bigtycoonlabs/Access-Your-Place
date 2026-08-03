import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return json({ error: 'Server configuration error' }, 500);
    const db = createClient(url, key, { db: { schema: 'public' } });
    const body = await req.json();
    const investorId = body.investor_id || body.investorId;
    if (!investorId) return json({ error: 'investor_id is required' }, 400);

    switch (body.action) {
      case 'get_checklist': {
        const { data, error } = await db.from('investor_checklist_progress').select('*').eq('investor_id', investorId).maybeSingle();
        if (error) throw error;
        return json({ success: true, completed_items: data?.completed_items || [] });
      }
      case 'update_checklist': {
        const { data, error } = await db.from('investor_checklist_progress').upsert({ investor_id: investorId, completed_items: body.completed_items || [], updated_at: new Date().toISOString() }, { onConflict: 'investor_id' }).select().single();
        if (error) throw error;
        return json({ success: true, completed_items: data.completed_items });
      }
      case 'get_calendar_events': {
        const { data, error } = await db.from('investor_calendar_events').select('*').eq('investor_id', investorId).order('event_date', { ascending: true });
        if (error) throw error;
        return json({ success: true, events: data || [] });
      }
      case 'add_calendar_event': {
        if (!body.event?.title || !body.event?.event_date) return json({ error: 'event title and date are required' }, 400);
        const { data, error } = await db.from('investor_calendar_events').insert({ investor_id: investorId, title: body.event.title, description: body.event.description || null, event_type: body.event.event_type || 'reminder', event_date: body.event.event_date, event_time: body.event.event_time || null, status: body.event.status || 'upcoming', location: body.event.location || null, related_property: body.event.related_property || null }).select().single();
        if (error) throw error;
        return json({ success: true, event: data });
      }
      case 'update_calendar_event': {
        if (!body.event_id) return json({ error: 'event_id is required' }, 400);
        const { data, error } = await db.from('investor_calendar_events').update({ ...(body.updates || {}), updated_at: new Date().toISOString() }).eq('id', body.event_id).eq('investor_id', investorId).select().maybeSingle();
        if (error) throw error;
        return json({ success: true, event: data });
      }
      case 'delete_calendar_event': {
        if (!body.event_id) return json({ error: 'event_id is required' }, 400);
        const { error } = await db.from('investor_calendar_events').delete().eq('id', body.event_id).eq('investor_id', investorId);
        if (error) throw error;
        return json({ success: true });
      }
      case 'sync_calendar_events': {
        const events = Array.isArray(body.events) ? body.events : [];
        if (events.length) {
          const rows = events.map((event: any) => ({ investor_id: investorId, title: event.title, description: event.description || null, event_type: event.event_type || 'reminder', event_date: event.event_date, event_time: event.event_time || null, status: event.status || 'upcoming', location: event.location || null, related_property: event.related_property || null }));
          const { error } = await db.from('investor_calendar_events').insert(rows);
          if (error) throw error;
        }
        const { data, error } = await db.from('investor_calendar_events').select('*').eq('investor_id', investorId).order('event_date', { ascending: true });
        if (error) throw error;
        return json({ success: true, events: data || [], synced_count: events.length });
      }
      case 'get_tutorial_progress': {
        const { data, error } = await db.from('investor_tutorial_progress').select('*').eq('investor_id', investorId).maybeSingle();
        if (error) throw error;
        return json({ success: true, watched_tutorials: data?.watched_tutorials || [] });
      }
      case 'update_tutorial_progress': {
        const { data, error } = await db.from('investor_tutorial_progress').upsert({ investor_id: investorId, watched_tutorials: body.watched_tutorials || [], updated_at: new Date().toISOString() }, { onConflict: 'investor_id' }).select().single();
        if (error) throw error;
        return json({ success: true, watched_tutorials: data.watched_tutorials });
      }
      default:
        return json({ error: `Unknown action: ${String(body.action)}` }, 400);
    }
  } catch (error) {
    console.error('manage-investor-progress:', error);
    return json({ error: error instanceof Error ? error.message : 'Progress request failed' }, 500);
  }
});
