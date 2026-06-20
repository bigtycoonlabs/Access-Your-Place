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

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// FCM v1 API endpoint - uses Google API key for server-side sending
const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");

interface PushPayload {
  action: string;
  investor_id?: string;
  investor_ids?: string[];
  notification_type?: string;
  title?: string;
  body?: string;
  data?: Record<string, string>;
  deep_link?: string;
  // For registering/managing tokens
  token?: string;
  platform?: string;
  device_id?: string;
  device_model?: string;
  os_version?: string;
  app_version?: string;
  // For deal alerts
  deal_id?: string;
  // For document updates
  document_id?: string;
  document_name?: string;
  // For acquisition milestones
  acquisition_id?: string;
  milestone_name?: string;
}

// Notification type configurations
const NOTIFICATION_CONFIGS: Record<string, { 
  icon?: string; 
  color?: string; 
  sound?: string;
  channel_id?: string;
  priority?: string;
  category?: string;
}> = {
  deal_alert: {
    icon: 'ic_deal',
    color: '#d4a574',
    sound: 'deal_alert',
    channel_id: 'deal_alerts',
    priority: 'high',
    category: 'DEAL_ALERT'
  },
  document_update: {
    icon: 'ic_document',
    color: '#1a365d',
    sound: 'default',
    channel_id: 'documents',
    priority: 'high',
    category: 'DOCUMENT'
  },
  acquisition_milestone: {
    icon: 'ic_milestone',
    color: '#22c55e',
    sound: 'milestone',
    channel_id: 'acquisitions',
    priority: 'high',
    category: 'ACQUISITION'
  },
  message: {
    icon: 'ic_message',
    color: '#3b82f6',
    sound: 'message',
    channel_id: 'messages',
    priority: 'high',
    category: 'MESSAGE'
  },
  general: {
    icon: 'ic_notification',
    color: '#1a365d',
    sound: 'default',
    channel_id: 'general',
    priority: 'default',
    category: 'GENERAL'
  }
};

// Send notification via FCM HTTP v1 API
async function sendFCMNotification(token: string, title: string, body: string, data: Record<string, string>, config: any): Promise<{ success: boolean; error?: string }> {
  try {
    // Use FCM legacy HTTP API with server key (Google API Key)
    const fcmPayload = {
      to: token,
      notification: {
        title,
        body,
        sound: config.sound || 'default',
        badge: 1,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        icon: config.icon || 'ic_notification',
        color: config.color || '#1a365d',
        channel_id: config.channel_id || 'general',
      },
      data: {
        ...data,
        notification_type: data.notification_type || 'general',
        deep_link: data.deep_link || '',
        click_action: 'OPEN_DEEP_LINK',
        timestamp: new Date().toISOString(),
      },
      priority: config.priority === 'high' ? 'high' : 'normal',
      content_available: true,
      mutable_content: true,
    };

    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${GOOGLE_API_KEY}`,
      },
      body: JSON.stringify(fcmPayload),
    });

    const result = await response.json();

    if (result.success >= 1) {
      return { success: true };
    }

    // Check for token errors
    if (result.results?.[0]?.error) {
      const error = result.results[0].error;
      
      // Token is no longer valid - mark as inactive
      if (['NotRegistered', 'InvalidRegistration', 'MismatchSenderId'].includes(error)) {
        await supabase
          .from('device_tokens')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('token', token);
      }
      
      return { success: false, error };
    }

    return { success: false, error: 'Unknown FCM error' };
  } catch (err: any) {
    console.error('FCM send error:', err);
    return { success: false, error: err.message };
  }
}

// Register or update a device token
async function registerToken(payload: PushPayload) {
  const { investor_id, token, platform, device_id, device_model, os_version, app_version } = payload;

  if (!investor_id || !token || !platform) {
    return { success: false, error: 'investor_id, token, and platform are required' };
  }

  // Upsert the token
  const { data, error } = await supabase
    .from('device_tokens')
    .upsert({
      investor_id,
      token,
      platform,
      device_id: device_id || null,
      device_model: device_model || null,
      os_version: os_version || null,
      app_version: app_version || null,
      is_active: true,
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'investor_id,token',
    })
    .select()
    .single();

  if (error) {
    console.error('Token registration error:', error);
    return { success: false, error: error.message };
  }

  return { success: true, device_token: data };
}

// Unregister a device token
async function unregisterToken(payload: PushPayload) {
  const { investor_id, token } = payload;

  if (!investor_id || !token) {
    return { success: false, error: 'investor_id and token are required' };
  }

  const { error } = await supabase
    .from('device_tokens')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('investor_id', investor_id)
    .eq('token', token);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// Send notification to a single investor
async function sendToInvestor(investorId: string, title: string, body: string, notificationType: string, data: Record<string, string>, deepLink?: string) {
  // Get all active device tokens for this investor
  const { data: tokens, error: tokenError } = await supabase
    .from('device_tokens')
    .select('*')
    .eq('investor_id', investorId)
    .eq('is_active', true);

  if (tokenError || !tokens || tokens.length === 0) {
    console.log(`No active tokens for investor ${investorId}`);
    return { success: false, sent: 0, failed: 0, error: 'No active device tokens' };
  }

  const config = NOTIFICATION_CONFIGS[notificationType] || NOTIFICATION_CONFIGS.general;
  const notificationData = {
    ...data,
    notification_type: notificationType,
    deep_link: deepLink || '',
    investor_id: investorId,
  };

  let sent = 0;
  let failed = 0;

  for (const deviceToken of tokens) {
    const result = await sendFCMNotification(deviceToken.token, title, body, notificationData, config);

    // Log the notification
    await supabase.from('push_notification_log').insert({
      investor_id: investorId,
      device_token_id: deviceToken.id,
      notification_type: notificationType,
      title,
      body,
      data: notificationData,
      platform: deviceToken.platform,
      status: result.success ? 'sent' : 'failed',
      error_message: result.error || null,
      deep_link: deepLink || null,
      sent_at: new Date().toISOString(),
    });

    if (result.success) {
      sent++;
      // Update last_used_at
      await supabase
        .from('device_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', deviceToken.id);
    } else {
      failed++;
    }
  }

  return { success: sent > 0, sent, failed, total_tokens: tokens.length };
}

// Send deal alert notification
async function sendDealAlert(payload: PushPayload) {
  const { investor_id, investor_ids, deal_id, title, body } = payload;

  const targetIds = investor_ids || (investor_id ? [investor_id] : []);
  
  if (targetIds.length === 0) {
    return { success: false, error: 'No target investors specified' };
  }

  const notificationTitle = title || 'New Deal Alert';
  const notificationBody = body || 'A new deal matching your criteria is available!';
  const deepLink = deal_id ? `accessyourplace://deals/${deal_id}` : 'accessyourplace://investor?tab=deal-alerts';

  const results = [];
  for (const id of targetIds) {
    const result = await sendToInvestor(id, notificationTitle, notificationBody, 'deal_alert', {
      deal_id: deal_id || '',
    }, deepLink);
    results.push({ investor_id: id, ...result });
  }

  const totalSent = results.reduce((sum, r) => sum + (r.sent || 0), 0);
  const totalFailed = results.reduce((sum, r) => sum + (r.failed || 0), 0);

  return { success: totalSent > 0, results, total_sent: totalSent, total_failed: totalFailed };
}

// Send document update notification
async function sendDocumentUpdate(payload: PushPayload) {
  const { investor_id, document_id, document_name, title, body } = payload;

  if (!investor_id) {
    return { success: false, error: 'investor_id is required' };
  }

  const notificationTitle = title || 'Document Update';
  const notificationBody = body || `Your document "${document_name || 'Unknown'}" has been updated.`;
  const deepLink = 'accessyourplace://investor?tab=documents';

  return await sendToInvestor(investor_id, notificationTitle, notificationBody, 'document_update', {
    document_id: document_id || '',
    document_name: document_name || '',
  }, deepLink);
}

// Send acquisition milestone notification
async function sendAcquisitionMilestone(payload: PushPayload) {
  const { investor_id, acquisition_id, milestone_name, title, body } = payload;

  if (!investor_id) {
    return { success: false, error: 'investor_id is required' };
  }

  const notificationTitle = title || 'Acquisition Milestone';
  const notificationBody = body || `Milestone reached: ${milestone_name || 'Progress update'}`;
  const deepLink = 'accessyourplace://investor?tab=acquisitions';

  return await sendToInvestor(investor_id, notificationTitle, notificationBody, 'acquisition_milestone', {
    acquisition_id: acquisition_id || '',
    milestone_name: milestone_name || '',
  }, deepLink);
}

// Send a general/custom notification
async function sendCustomNotification(payload: PushPayload) {
  const { investor_id, investor_ids, title, body, notification_type, data, deep_link } = payload;

  const targetIds = investor_ids || (investor_id ? [investor_id] : []);
  
  if (targetIds.length === 0 || !title || !body) {
    return { success: false, error: 'investor_id(s), title, and body are required' };
  }

  const results = [];
  for (const id of targetIds) {
    const result = await sendToInvestor(id, title, body, notification_type || 'general', data || {}, deep_link);
    results.push({ investor_id: id, ...result });
  }

  return { success: true, results };
}

// Get notification history for an investor
async function getNotificationHistory(payload: PushPayload) {
  const { investor_id } = payload;

  if (!investor_id) {
    return { success: false, error: 'investor_id is required' };
  }

  const { data, error } = await supabase
    .from('push_notification_log')
    .select('*')
    .eq('investor_id', investor_id)
    .order('sent_at', { ascending: false })
    .limit(50);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, notifications: data };
}

// Get device tokens for an investor
async function getDeviceTokens(payload: PushPayload) {
  const { investor_id } = payload;

  if (!investor_id) {
    return { success: false, error: 'investor_id is required' };
  }

  const { data, error } = await supabase
    .from('device_tokens')
    .select('*')
    .eq('investor_id', investor_id)
    .eq('is_active', true)
    .order('last_used_at', { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, tokens: data };
}

// Mark notification as clicked (for analytics)
async function markNotificationClicked(payload: PushPayload) {
  const { data: notifData } = payload as any;
  const notificationId = notifData?.notification_id || payload.data?.notification_id;

  if (!notificationId) {
    return { success: false, error: 'notification_id is required in data' };
  }

  const { error } = await supabase
    .from('push_notification_log')
    .update({ 
      status: 'clicked', 
      clicked_at: new Date().toISOString() 
    })
    .eq('id', notificationId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// Clean up stale tokens (tokens not used in 90 days)
async function cleanupStaleTokens() {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data, error } = await supabase
    .from('device_tokens')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('is_active', true)
    .lt('last_used_at', ninetyDaysAgo.toISOString())
    .select('id');

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, deactivated_count: data?.length || 0 };
}

// Send notification to all active investors (broadcast)
async function broadcastNotification(payload: PushPayload) {
  const { title, body, notification_type, data, deep_link } = payload;

  if (!title || !body) {
    return { success: false, error: 'title and body are required' };
  }

  // Get all unique investor IDs with active tokens
  const { data: tokens, error } = await supabase
    .from('device_tokens')
    .select('investor_id')
    .eq('is_active', true);

  if (error || !tokens) {
    return { success: false, error: error?.message || 'No active tokens' };
  }

  const uniqueInvestorIds = [...new Set(tokens.map(t => t.investor_id))];

  const results = [];
  for (const investorId of uniqueInvestorIds) {
    const result = await sendToInvestor(investorId, title, body, notification_type || 'general', data || {}, deep_link);
    results.push({ investor_id: investorId, ...result });
  }

  const totalSent = results.reduce((sum, r) => sum + (r.sent || 0), 0);

  return { 
    success: totalSent > 0, 
    total_investors: uniqueInvestorIds.length,
    total_sent: totalSent,
    results 
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: PushPayload = await req.json();
    const { action } = payload;

    let result;

    switch (action) {
      case 'register_token':
        result = await registerToken(payload);
        break;
      case 'unregister_token':
        result = await unregisterToken(payload);
        break;
      case 'send_deal_alert':
        result = await sendDealAlert(payload);
        break;
      case 'send_document_update':
        result = await sendDocumentUpdate(payload);
        break;
      case 'send_acquisition_milestone':
        result = await sendAcquisitionMilestone(payload);
        break;
      case 'send_notification':
        result = await sendCustomNotification(payload);
        break;
      case 'send_message_notification':
        result = await sendCustomNotification({
          ...payload,
          notification_type: 'message',
          deep_link: 'accessyourplace://investor?tab=messages',
        });
        break;
      case 'broadcast':
        result = await broadcastNotification(payload);
        break;
      case 'get_history':
        result = await getNotificationHistory(payload);
        break;
      case 'get_tokens':
        result = await getDeviceTokens(payload);
        break;
      case 'mark_clicked':
        result = await markNotificationClicked(payload);
        break;
      case 'cleanup_stale':
        result = await cleanupStaleTokens();
        break;
      default:
        result = { success: false, error: `Unknown action: ${action}` };
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: result.success ? 200 : 400,
    });
  } catch (err: any) {
    console.error('Push notification error:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 500,
    });
  }
});

