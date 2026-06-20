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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, investorId, notificationId, type, title, message, data } = await req.json();

    if (action === 'get') {
      // Get notifications for investor
      const { data: notifications, error } = await supabase
        .from('investor_notifications')
        .select('*')
        .eq('investor_id', investorId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const unreadCount = notifications?.filter(n => !n.read).length || 0;

      return new Response(JSON.stringify({ notifications, unreadCount }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (action === 'create') {
      // Create a new notification
      const { error } = await supabase
        .from('investor_notifications')
        .insert({ investor_id: investorId, type, title, message, data: data || {} });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (action === 'markRead') {
      // Mark single notification as read
      const { error } = await supabase
        .from('investor_notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (action === 'markAllRead') {
      // Mark all notifications as read for investor
      const { error } = await supabase
        .from('investor_notifications')
        .update({ read: true })
        .eq('investor_id', investorId)
        .eq('read', false);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

