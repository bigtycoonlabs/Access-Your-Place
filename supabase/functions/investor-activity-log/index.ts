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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { action, ...params } = await req.json();

    // Log a new activity
    if (action === 'log') {
      const { 
        investor_id, 
        activity_type, 
        activity_category,
        category, // alias for activity_category
        title, 
        description, 
        metadata,
        ip_address,
        user_agent 
      } = params;

      const finalCategory = activity_category || category || 'general';

      if (!investor_id || !activity_type || !title) {
        return new Response(JSON.stringify({ error: 'Missing required fields: investor_id, activity_type, title' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const { data, error } = await supabase
        .from('investor_activity_logs')
        .insert({
          investor_id,
          activity_type,
          activity_category: finalCategory,
          title,
          description: description || null,
          metadata: metadata || {},
          ip_address: ip_address || null,
          user_agent: user_agent || null
        })
        .select()
        .single();

      if (error) {
        console.error('Insert error:', error);
        throw error;
      }

      // Update investor's last_activity_at and engagement score
      const scoreIncrements: Record<string, number> = {
        'login': 2,
        'deal_view': 3,
        'inquiry_submitted': 10,
        'document_download': 5,
        'message_sent': 5,
        'favorite_added': 3,
        'favorite_removed': 1,
        'profile_updated': 2,
        'report_viewed': 4,
        'search_performed': 1,
        'call_booked': 8,
        'onboarding_completed': 15,
        'referral_sent': 10,
        'ai_chat': 3
      };

      const increment = scoreIncrements[activity_type] || 1;

      // Try to update investors table
      try {
        const { data: investor } = await supabase
          .from('investors')
          .select('engagement_score')
          .eq('id', investor_id)
          .single();

        const newScore = Math.min(100, (investor?.engagement_score || 0) + increment);

        await supabase
          .from('investors')
          .update({ 
            last_activity_at: new Date().toISOString(),
            engagement_score: newScore
          })
          .eq('id', investor_id);
      } catch (e) {
        // Investors table might not have these columns, ignore
      }

      return new Response(JSON.stringify({ success: true, activity: data }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get activity timeline for an investor
    if (action === 'get_timeline') {
      const { investor_id, limit = 50, offset = 0, category, start_date, end_date } = params;

      if (!investor_id) {
        return new Response(JSON.stringify({ error: 'investor_id required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      let query = supabase
        .from('investor_activity_logs')
        .select('*', { count: 'exact' })
        .eq('investor_id', investor_id)
        .order('created_at', { ascending: false });

      if (category && category !== 'all') {
        query = query.eq('activity_category', category);
      }

      if (start_date) {
        query = query.gte('created_at', start_date);
      }

      if (end_date) {
        query = query.lte('created_at', end_date);
      }

      const { data, count, error } = await query.range(offset, offset + limit - 1);

      if (error) {
        console.error('Timeline query error:', error);
        throw error;
      }

      return new Response(JSON.stringify({ activities: data || [], total: count || 0 }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get activity summary/stats for an investor
    if (action === 'get_summary') {
      const { investor_id, days = 30 } = params;

      if (!investor_id) {
        return new Response(JSON.stringify({ error: 'investor_id required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: activities, error } = await supabase
        .from('investor_activity_logs')
        .select('activity_type, activity_category, created_at')
        .eq('investor_id', investor_id)
        .gte('created_at', startDate.toISOString());

      if (error) {
        console.error('Summary query error:', error);
      }

      // Calculate summary stats
      const summary = {
        total_activities: activities?.length || 0,
        logins: 0,
        deal_views: 0,
        inquiries: 0,
        downloads: 0,
        messages: 0,
        by_category: {} as Record<string, number>,
        by_day: {} as Record<string, number>,
        last_login: null as string | null,
        most_active_day: null as string | null
      };

      (activities || []).forEach(a => {
        // Count by type
        if (a.activity_type === 'login') summary.logins++;
        if (a.activity_type === 'deal_view') summary.deal_views++;
        if (a.activity_type === 'inquiry_submitted') summary.inquiries++;
        if (a.activity_type === 'document_download') summary.downloads++;
        if (a.activity_type === 'message_sent') summary.messages++;

        // Count by category
        if (a.activity_category) {
          summary.by_category[a.activity_category] = (summary.by_category[a.activity_category] || 0) + 1;
        }

        // Count by day
        const day = new Date(a.created_at).toISOString().split('T')[0];
        summary.by_day[day] = (summary.by_day[day] || 0) + 1;

        // Track last login
        if (a.activity_type === 'login') {
          if (!summary.last_login || new Date(a.created_at) > new Date(summary.last_login)) {
            summary.last_login = a.created_at;
          }
        }
      });

      // Find most active day
      let maxCount = 0;
      Object.entries(summary.by_day).forEach(([day, count]) => {
        if (count > maxCount) {
          maxCount = count;
          summary.most_active_day = day;
        }
      });

      return new Response(JSON.stringify({ summary }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get recent activities across all investors (for admin dashboard)
    if (action === 'get_recent') {
      const { limit = 20, activity_type, activity_category } = params;

      let query = supabase
        .from('investor_activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (activity_type) {
        query = query.eq('activity_type', activity_type);
      }

      if (activity_category) {
        query = query.eq('activity_category', activity_category);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Recent activities error:', error);
        throw error;
      }

      // Try to enrich with investor names
      const investorIds = [...new Set((data || []).map(a => a.investor_id))];
      let investorMap: Record<string, any> = {};
      
      if (investorIds.length > 0) {
        const { data: investors } = await supabase
          .from('investors')
          .select('id, full_name, email')
          .in('id', investorIds);
        
        (investors || []).forEach(inv => {
          investorMap[inv.id] = inv;
        });
      }

      const enrichedActivities = (data || []).map(a => ({
        ...a,
        investor: investorMap[a.investor_id] || null
      }));

      return new Response(JSON.stringify({ activities: enrichedActivities }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Bulk log activities (for batch operations)
    if (action === 'bulk_log') {
      const { activities } = params;

      if (!activities || !Array.isArray(activities)) {
        return new Response(JSON.stringify({ error: 'activities array required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const { data, error } = await supabase
        .from('investor_activity_logs')
        .insert(activities)
        .select();

      if (error) {
        console.error('Bulk log error:', error);
        throw error;
      }

      return new Response(JSON.stringify({ success: true, logged: data?.length || 0 }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('Activity log error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

