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
// manage-email-logs - Email delivery tracking and management v2.0
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('[manage-email-logs] Request received');

  // Default response structure
  const defaultResponse = {
    success: true,
    logs: [],
    total: 0,
    page: 1,
    limit: 50,
    stats: {
      total: 0,
      sent: 0,
      delivered: 0,
      opened: 0,
      bounced: 0,
      failed: 0
    },
    template_types: []
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('[manage-email-logs] Missing environment variables');
      return new Response(JSON.stringify(defaultResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const headers = {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    };

    // Helper function for safe fetch with timeout
    async function safeFetch(url: string, options: RequestInit = {}): Promise<any> {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, { 
          ...options, 
          signal: controller.signal 
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const text = await response.text();
          console.log(`[manage-email-logs] Fetch error: ${response.status} - ${text}`);
          return null;
        }
        
        // Get content-range header for count
        const contentRange = response.headers.get('content-range');
        const data = await response.json();
        
        return { data, contentRange };
      } catch (e: any) {
        console.log(`[manage-email-logs] Fetch exception: ${e.message}`);
        return null;
      }
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      console.log('[manage-email-logs] No body or invalid JSON');
      return new Response(JSON.stringify(defaultResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { action, page = 1, limit = 50, search, status_filter, type_filter, date_from, date_to } = body;
    console.log(`[manage-email-logs] Action: ${action}`);

    if (action === 'get_logs') {
      console.log('[manage-email-logs] Getting email logs');
      
      // Build query parameters
      let queryParams = `select=*&order=sent_at.desc`;
      
      // Add pagination
      const offset = (page - 1) * limit;
      queryParams += `&offset=${offset}&limit=${limit}`;
      
      // Build filter conditions
      if (status_filter && status_filter !== 'all') {
        queryParams += `&status=eq.${encodeURIComponent(status_filter)}`;
      }
      
      if (type_filter && type_filter !== 'all') {
        queryParams += `&template_type=eq.${encodeURIComponent(type_filter)}`;
      }
      
      if (search) {
        queryParams += `&or=(recipient_email.ilike.*${encodeURIComponent(search)}*,subject.ilike.*${encodeURIComponent(search)}*)`;
      }

      // Fetch logs
      const logsResult = await safeFetch(`${supabaseUrl}/rest/v1/email_logs?${queryParams}`, { headers });
      const logs = logsResult?.data || [];

      // Get total count for pagination
      const countResult = await safeFetch(`${supabaseUrl}/rest/v1/email_logs?select=id`, {
        headers: { ...headers, 'Prefer': 'count=exact' }
      });
      const totalCount = countResult?.contentRange ? parseInt(countResult.contentRange.split('/')[1] || '0') : logs.length;

      // Get all logs for stats (limit to recent 1000)
      const allLogsResult = await safeFetch(`${supabaseUrl}/rest/v1/email_logs?select=status,template_type&limit=1000`, { headers });
      const allLogs = allLogsResult?.data || [];
      
      const stats = {
        total: allLogs.length,
        sent: allLogs.filter((l: any) => l.status === 'sent').length,
        delivered: allLogs.filter((l: any) => l.status === 'delivered').length,
        opened: allLogs.filter((l: any) => l.status === 'opened').length,
        bounced: allLogs.filter((l: any) => l.status === 'bounced').length,
        failed: allLogs.filter((l: any) => l.status === 'failed').length
      };

      // Get unique template types for filter dropdown
      const uniqueTypes = [...new Set(allLogs.map((t: any) => t.template_type).filter(Boolean))] as string[];

      console.log(`[manage-email-logs] Returning ${logs.length} logs, stats: ${JSON.stringify(stats)}`);

      return new Response(JSON.stringify({
        success: true,
        logs,
        total: totalCount,
        page,
        limit,
        stats,
        template_types: uniqueTypes
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get_stats') {
      console.log('[manage-email-logs] Getting email stats');
      
      // Get email stats for dashboard
      const logsResult = await safeFetch(`${supabaseUrl}/rest/v1/email_logs?select=status,template_type,sent_at&limit=5000`, { headers });
      const logs = logsResult?.data || [];

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const stats = {
        total: logs.length,
        today: logs.filter((l: any) => new Date(l.sent_at) >= today).length,
        this_week: logs.filter((l: any) => new Date(l.sent_at) >= thisWeek).length,
        this_month: logs.filter((l: any) => new Date(l.sent_at) >= thisMonth).length,
        by_status: {
          sent: logs.filter((l: any) => l.status === 'sent').length,
          delivered: logs.filter((l: any) => l.status === 'delivered').length,
          opened: logs.filter((l: any) => l.status === 'opened').length,
          bounced: logs.filter((l: any) => l.status === 'bounced').length,
          failed: logs.filter((l: any) => l.status === 'failed').length
        },
        by_type: logs.reduce((acc: any, log: any) => {
          const type = log.template_type || 'unknown';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {})
      };

      return new Response(JSON.stringify({ success: true, stats }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'log_email') {
      console.log('[manage-email-logs] Logging new email');
      
      const { recipient_email, subject, template_type, status, error_message, resend_id, recipient_id, campaign_id } = body;
      
      const logData: any = {
        recipient_email,
        subject,
        template_type,
        status: status || 'sent',
        sent_at: new Date().toISOString()
      };
      
      if (error_message) logData.error_message = error_message;
      if (resend_id) logData.resend_id = resend_id;
      if (recipient_id) logData.recipient_id = recipient_id;
      if (campaign_id) logData.campaign_id = campaign_id;

      const insertResult = await safeFetch(`${supabaseUrl}/rest/v1/email_logs`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(logData)
      });

      return new Response(JSON.stringify({ success: true, log: insertResult?.data?.[0] || null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'update_status') {
      console.log('[manage-email-logs] Updating email status');
      
      const { log_id, resend_id, new_status } = body;
      
      let updateQuery = '';
      if (log_id) {
        updateQuery = `id=eq.${log_id}`;
      } else if (resend_id) {
        updateQuery = `resend_id=eq.${encodeURIComponent(resend_id)}`;
      } else {
        return new Response(JSON.stringify({ success: false, error: 'log_id or resend_id required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await safeFetch(`${supabaseUrl}/rest/v1/email_logs?${updateQuery}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: new_status })
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Unknown action - return default response
    console.log('[manage-email-logs] Unknown action:', action);
    return new Response(JSON.stringify({ ...defaultResponse, error: 'Unknown action' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[manage-email-logs] Unexpected error:', error.message || error);
    return new Response(JSON.stringify({ 
      ...defaultResponse,
      success: false,
      error: error.message || 'Server error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
