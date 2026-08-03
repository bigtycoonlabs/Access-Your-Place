import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return json({ error: 'Server configuration error' }, 500);

    const supabase = createClient(supabaseUrl, serviceKey, { db: { schema: 'public' } });
    const body = await req.json();
    const investorId = body.investorId || body.investor_id;
    const action = body.action;

    if (!investorId && ['get', 'create', 'markAllRead'].includes(action)) {
      return json({ error: 'investorId is required' }, 400);
    }

    if (action === 'get') {
      const { data, error } = await supabase.from('investor_notifications')
        .select('*').eq('investor_id', investorId).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      const notifications = data || [];
      return json({ notifications, unreadCount: notifications.filter((item: any) => !(item.read ?? item.is_read)).length });
    }

    if (action === 'create') {
      const { error } = await supabase.from('investor_notifications').insert({
        investor_id: investorId,
        type: body.type || body.notification_type || 'general',
        notification_type: body.notification_type || body.type || 'general',
        title: body.title || 'Notification',
        message: body.message || '',
        data: body.data || {},
        read: false,
        is_read: false
      });
      if (error) throw error;
      return json({ success: true });
    }

    if (action === 'markRead') {
      if (!body.notificationId && !body.notification_id) return json({ error: 'notificationId is required' }, 400);
      const { error } = await supabase.from('investor_notifications')
        .update({ read: true, is_read: true, read_at: new Date().toISOString() })
        .eq('id', body.notificationId || body.notification_id);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === 'markAllRead') {
      const { error } = await supabase.from('investor_notifications')
        .update({ read: true, is_read: true, read_at: new Date().toISOString() })
        .eq('investor_id', investorId);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: `Invalid action: ${String(action)}` }, 400);
  } catch (error) {
    console.error('manage-notifications:', error);
    return json({ error: error instanceof Error ? error.message : 'Notification request failed' }, 500);
  }
});
