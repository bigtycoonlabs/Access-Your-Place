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

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, inquiry_id, status, notes, status_filter, property_filter } = await req.json();

    if (action === 'list') {
      let query = supabase.from('deal_inquiries')
        .select(`*, properties:property_id(id, listing_title, city, state, zip_code, bedrooms, bathrooms)`)
        .order('created_at', { ascending: false });

      if (status_filter && status_filter !== 'all') {
        query = query.eq('status', status_filter);
      }
      if (property_filter) {
        query = query.eq('property_id', property_filter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get statistics
      const { data: stats } = await supabase.from('deal_inquiries')
        .select('status');
      
      const statistics = {
        total: stats?.length || 0,
        new: stats?.filter(s => s.status === 'new').length || 0,
        contacted: stats?.filter(s => s.status === 'contacted').length || 0,
        qualified: stats?.filter(s => s.status === 'qualified').length || 0,
        closed: stats?.filter(s => s.status === 'closed').length || 0
      };

      return new Response(JSON.stringify({ inquiries: data, statistics }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (action === 'update_status') {
      if (!inquiry_id || !status) throw new Error('Inquiry ID and status required');

      const updateData: any = { status, updated_at: new Date().toISOString() };
      if (notes) updateData.staff_notes = notes;
      if (status === 'contacted') updateData.contacted_at = new Date().toISOString();

      const { data, error } = await supabase.from('deal_inquiries')
        .update(updateData)
        .eq('id', inquiry_id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, inquiry: data }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (action === 'add_note') {
      if (!inquiry_id || !notes) throw new Error('Inquiry ID and notes required');

      const { data: existing } = await supabase.from('deal_inquiries')
        .select('staff_notes')
        .eq('id', inquiry_id)
        .single();

      const newNotes = existing?.staff_notes 
        ? `${existing.staff_notes}\n\n[${new Date().toLocaleString()}] ${notes}`
        : `[${new Date().toLocaleString()}] ${notes}`;

      const { data, error } = await supabase.from('deal_inquiries')
        .update({ staff_notes: newNotes, updated_at: new Date().toISOString() })
        .eq('id', inquiry_id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, inquiry: data }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    throw new Error('Invalid action');
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
