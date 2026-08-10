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

    const body = await req.json();
    const { action, property_id, note_id, data } = body;

    let result;

    // INVESTOR notes, not property notes.
    //
    // This function's existing cases are all scoped to a PROPERTY and write to
    // outreach_notes. The acquisition manager's dialog asks about an INVESTOR — a different
    // subject entirely, so this is not a rename and could not be aliased.
    //
    // investor_notes already exists with exactly the right shape (investor_id, content,
    // type, created_by) and nothing had ever written to it.
    if (action === 'get_notes') {
      if (!body.investor_id) {
        return new Response(JSON.stringify({ success: false, error: 'investor_id is required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: rows, error } = await supabase
        .from('investor_notes')
        .select('*')
        .eq('investor_id', body.investor_id)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('manage-notes get_notes failed', error.message);
        return new Response(JSON.stringify({ success: false, error: 'Could not read the notes.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, notes: rows || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'add_note') {
      const text = String(body.note ?? body.notes ?? '').trim();
      if (!body.investor_id) {
        return new Response(JSON.stringify({ success: false, error: 'investor_id is required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // An empty note is not a note. Saving one means the next person opens the file and
      // learns nothing, which is the same failure as not writing it down at all.
      if (!text) {
        return new Response(JSON.stringify({ success: false, error: 'A note needs something in it. Say what actually happened.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: row, error } = await supabase
        .from('investor_notes')
        .insert({
          investor_id: body.investor_id,
          content: text,
          type: body.note_type || 'general',
          created_by: body.created_by || null,
        })
        .select()
        .single();
      if (error) {
        console.error('manage-notes add_note failed', error.message);
        return new Response(JSON.stringify({ success: false, error: 'Could not save the note. Nothing was recorded.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, note: row }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    switch (action) {
      case 'create':
        const { data: newNote, error: createErr } = await supabase
          .from('outreach_notes')
          .insert({ property_id, ...data })
          .select()
          .single();
        if (createErr) throw createErr;
        result = newNote;
        break;

      case 'update':
        const { data: updated, error: updateErr } = await supabase
          .from('outreach_notes')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', note_id)
          .select()
          .single();
        if (updateErr) throw updateErr;
        result = updated;
        break;

      case 'delete':
        const { error: deleteErr } = await supabase
          .from('outreach_notes')
          .delete()
          .eq('id', note_id);
        if (deleteErr) throw deleteErr;
        result = { deleted: true };
        break;

      case 'get':
        const { data: notes, error: getErr } = await supabase
          .from('outreach_notes')
          .select('*')
          .eq('property_id', property_id)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false });
        if (getErr) throw getErr;
        result = notes;
        break;

      default:
        throw new Error('Invalid action');
    }

    return new Response(JSON.stringify({ result }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
