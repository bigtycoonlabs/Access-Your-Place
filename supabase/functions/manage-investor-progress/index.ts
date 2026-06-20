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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action, investor_id } = body;

    if (!investor_id) {
      return new Response(JSON.stringify({ error: "investor_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // ========== CHECKLIST PROGRESS ==========
    if (action === 'get_checklist') {
      const { data, error } = await supabase
        .from('investor_checklist_progress')
        .select('*')
        .eq('investor_id', investor_id)
        .single();

      return new Response(JSON.stringify({
        success: true,
        completed_items: data?.completed_items || []
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (action === 'update_checklist') {
      const { completed_items } = body;

      const { data, error } = await supabase
        .from('investor_checklist_progress')
        .upsert({
          investor_id,
          completed_items: completed_items || [],
          updated_at: new Date().toISOString()
        }, { onConflict: 'investor_id' })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        completed_items: data.completed_items
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // ========== CALENDAR EVENTS ==========
    if (action === 'get_calendar_events') {
      const { data, error } = await supabase
        .from('investor_calendar_events')
        .select('*')
        .eq('investor_id', investor_id)
        .order('event_date', { ascending: true });

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        events: data || []
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (action === 'add_calendar_event') {
      const { event } = body;

      const { data, error } = await supabase
        .from('investor_calendar_events')
        .insert({
          investor_id,
          title: event.title,
          description: event.description || null,
          event_type: event.event_type || 'reminder',
          event_date: event.event_date,
          event_time: event.event_time || null,
          status: event.status || 'upcoming',
          location: event.location || null,
          related_property: event.related_property || null
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        event: data
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (action === 'update_calendar_event') {
      const { event_id, updates } = body;

      const { data, error } = await supabase
        .from('investor_calendar_events')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', event_id)
        .eq('investor_id', investor_id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        event: data
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (action === 'delete_calendar_event') {
      const { event_id } = body;

      const { error } = await supabase
        .from('investor_calendar_events')
        .delete()
        .eq('id', event_id)
        .eq('investor_id', investor_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (action === 'sync_calendar_events') {
      // Bulk sync from localStorage - insert events that don't exist in DB
      const { events } = body;
      
      if (!events || !Array.isArray(events)) {
        return new Response(JSON.stringify({ error: "events array required" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      // Get existing events
      const { data: existing } = await supabase
        .from('investor_calendar_events')
        .select('id')
        .eq('investor_id', investor_id);

      const existingIds = new Set((existing || []).map(e => e.id));
      
      // Filter to only new events (local_ prefixed IDs are from localStorage)
      const newEvents = events
        .filter(e => e.id.startsWith('local_') || !existingIds.has(e.id))
        .map(e => ({
          investor_id,
          title: e.title,
          description: e.description || null,
          event_type: e.event_type || 'reminder',
          event_date: e.event_date,
          event_time: e.event_time || null,
          status: e.status || 'upcoming',
          location: e.location || null,
          related_property: e.related_property || null
        }));

      if (newEvents.length > 0) {
        await supabase
          .from('investor_calendar_events')
          .insert(newEvents);
      }

      // Return all events
      const { data: allEvents } = await supabase
        .from('investor_calendar_events')
        .select('*')
        .eq('investor_id', investor_id)
        .order('event_date', { ascending: true });

      return new Response(JSON.stringify({
        success: true,
        events: allEvents || [],
        synced_count: newEvents.length
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // ========== TUTORIAL PROGRESS ==========
    if (action === 'get_tutorial_progress') {
      const { data, error } = await supabase
        .from('investor_tutorial_progress')
        .select('*')
        .eq('investor_id', investor_id)
        .single();

      return new Response(JSON.stringify({
        success: true,
        watched_tutorials: data?.watched_tutorials || []
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (action === 'update_tutorial_progress') {
      const { watched_tutorials } = body;

      const { data, error } = await supabase
        .from('investor_tutorial_progress')
        .upsert({
          investor_id,
          watched_tutorials: watched_tutorials || [],
          updated_at: new Date().toISOString()
        }, { onConflict: 'investor_id' })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        watched_tutorials: data.watched_tutorials
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (err) {
    console.error("Error in manage-investor-progress:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});

