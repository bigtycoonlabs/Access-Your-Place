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

const corsHeaders = {
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

    const { action, property_id, staff_id } = await req.json();

    // Action: check_score_changes - Check for properties with score changes > 10 points
    if (action === 'check_score_changes') {
      // Get properties with score history
      const { data: scoreHistory } = await supabase
        .from('penny_score_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      const alerts: any[] = [];
      const propertyScores: Record<string, { current: number; previous: number; property_id: string }> = {};

      // Group by property and find changes
      if (scoreHistory) {
        for (const record of scoreHistory) {
          if (!propertyScores[record.property_id]) {
            propertyScores[record.property_id] = {
              current: record.score,
              previous: record.score,
              property_id: record.property_id
            };
          } else {
            propertyScores[record.property_id].previous = record.score;
          }
        }

        // Check for significant changes
        for (const [propId, scores] of Object.entries(propertyScores)) {
          const change = Math.abs(scores.current - scores.previous);
          if (change >= 10) {
            alerts.push({
              property_id: propId,
              alert_type: 'score_change',
              current_score: scores.current,
              previous_score: scores.previous,
              change: scores.current - scores.previous,
              severity: change >= 20 ? 'high' : 'medium'
            });
          }
        }
      }

      return new Response(JSON.stringify({ success: true, alerts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action: check_low_scores - Find properties with scores below 40
    if (action === 'check_low_scores') {
      const { data: lowScoreProperties } = await supabase
        .from('properties')
        .select('id, listing_title, city, state, penny_score, assigned_am_id, assigned_am_name')
        .lt('penny_score', 40)
        .not('penny_score', 'is', null)
        .order('penny_score', { ascending: true });

      const alerts = (lowScoreProperties || []).map(prop => ({
        property_id: prop.id,
        alert_type: 'low_score',
        score: prop.penny_score,
        property_title: prop.listing_title || `Property in ${prop.city}, ${prop.state}`,
        assigned_am_id: prop.assigned_am_id,
        assigned_am_name: prop.assigned_am_name,
        severity: prop.penny_score < 25 ? 'critical' : 'high'
      }));

      return new Response(JSON.stringify({ success: true, alerts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action: check_high_value_deals - Find new high-value deals (85+ scores)
    if (action === 'check_high_value_deals') {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: highValueDeals } = await supabase
        .from('properties')
        .select('id, listing_title, city, state, penny_score, penny_recommendation, created_at, acquisition_fee, monthly_rent')
        .gte('penny_score', 85)
        .gte('created_at', oneDayAgo)
        .order('penny_score', { ascending: false });

      const alerts = (highValueDeals || []).map(prop => ({
        property_id: prop.id,
        alert_type: 'high_value_deal',
        score: prop.penny_score,
        recommendation: prop.penny_recommendation,
        property_title: prop.listing_title || `Property in ${prop.city}, ${prop.state}`,
        acquisition_fee: prop.acquisition_fee,
        monthly_rent: prop.monthly_rent,
        created_at: prop.created_at,
        severity: prop.penny_score >= 90 ? 'urgent' : 'high'
      }));

      return new Response(JSON.stringify({ success: true, alerts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action: generate_weekly_report - Generate weekly scoring accuracy and trends report
    if (action === 'generate_weekly_report') {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Get all scored properties from the past week
      const { data: recentProperties } = await supabase
        .from('properties')
        .select('id, penny_score, penny_recommendation, created_at, city, state, status')
        .gte('created_at', oneWeekAgo)
        .not('penny_score', 'is', null);

      // Get ML feedback for accuracy
      const { data: mlFeedback } = await supabase
        .from('penny_ml_feedback')
        .select('*')
        .gte('created_at', oneWeekAgo);

      // Calculate statistics
      const totalScored = recentProperties?.length || 0;
      const avgScore = totalScored > 0 
        ? Math.round((recentProperties?.reduce((sum, p) => sum + (p.penny_score || 0), 0) || 0) / totalScored)
        : 0;

      const scoreDistribution = {
        excellent: recentProperties?.filter(p => p.penny_score >= 85).length || 0,
        good: recentProperties?.filter(p => p.penny_score >= 70 && p.penny_score < 85).length || 0,
        average: recentProperties?.filter(p => p.penny_score >= 50 && p.penny_score < 70).length || 0,
        below_average: recentProperties?.filter(p => p.penny_score >= 40 && p.penny_score < 50).length || 0,
        flagged: recentProperties?.filter(p => p.penny_score < 40).length || 0
      };

      const recommendationBreakdown = {
        strong_buy: recentProperties?.filter(p => p.penny_recommendation === 'strong_buy').length || 0,
        buy: recentProperties?.filter(p => p.penny_recommendation === 'buy').length || 0,
        hold: recentProperties?.filter(p => p.penny_recommendation === 'hold').length || 0,
        pass: recentProperties?.filter(p => p.penny_recommendation === 'pass').length || 0
      };

      // Accuracy metrics from ML feedback
      const totalFeedback = mlFeedback?.length || 0;
      const positiveFeedback = mlFeedback?.filter(f => f.feedback_type === 'accurate' || f.feedback_type === 'helpful').length || 0;
      const accuracyRate = totalFeedback > 0 ? Math.round((positiveFeedback / totalFeedback) * 100) : null;

      const report = {
        period: {
          start: oneWeekAgo,
          end: new Date().toISOString()
        },
        summary: {
          total_properties_scored: totalScored,
          average_score: avgScore,
          accuracy_rate: accuracyRate,
          total_feedback_received: totalFeedback
        },
        score_distribution: scoreDistribution,
        recommendation_breakdown: recommendationBreakdown,
        trends: {
          high_value_deals_found: scoreDistribution.excellent,
          flagged_deals: scoreDistribution.flagged,
          flagged_percentage: totalScored > 0 ? Math.round((scoreDistribution.flagged / totalScored) * 100) : 0
        },
        generated_at: new Date().toISOString()
      };

      // Store the report
      await supabase.from('penny_weekly_reports').insert({
        report_data: report,
        period_start: oneWeekAgo,
        period_end: new Date().toISOString()
      });

      return new Response(JSON.stringify({ success: true, report }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action: send_alert - Send alert notification to staff
    if (action === 'send_alert') {
      const { alert_type, property_id: alertPropertyId, severity, message, recipient_staff_ids } = await req.json();

      // Create notification records
      const notifications = (recipient_staff_ids || []).map((staffId: string) => ({
        staff_id: staffId,
        type: 'penny_alert',
        title: `Penny AI Alert: ${alert_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}`,
        message: message,
        severity: severity,
        property_id: alertPropertyId,
        read: false,
        created_at: new Date().toISOString()
      }));

      if (notifications.length > 0) {
        await supabase.from('staff_notifications').insert(notifications);
      }

      return new Response(JSON.stringify({ success: true, notifications_sent: notifications.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action: get_monitoring_dashboard - Get all monitoring data for dashboard
    if (action === 'get_monitoring_dashboard') {
      // Get recent alerts
      const { data: recentAlerts } = await supabase
        .from('penny_score_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      // Get score distribution
      const { data: allProperties } = await supabase
        .from('properties')
        .select('penny_score, penny_recommendation, created_at')
        .not('penny_score', 'is', null);

      const distribution = {
        excellent: allProperties?.filter(p => p.penny_score >= 85).length || 0,
        good: allProperties?.filter(p => p.penny_score >= 70 && p.penny_score < 85).length || 0,
        average: allProperties?.filter(p => p.penny_score >= 50 && p.penny_score < 70).length || 0,
        below_average: allProperties?.filter(p => p.penny_score >= 40 && p.penny_score < 50).length || 0,
        flagged: allProperties?.filter(p => p.penny_score < 40).length || 0
      };

      // Get recent weekly report
      const { data: latestReport } = await supabase
        .from('penny_weekly_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return new Response(JSON.stringify({
        success: true,
        dashboard: {
          recent_alerts: recentAlerts || [],
          score_distribution: distribution,
          total_scored: allProperties?.length || 0,
          average_score: allProperties?.length 
            ? Math.round(allProperties.reduce((sum, p) => sum + (p.penny_score || 0), 0) / allProperties.length)
            : 0,
          latest_report: latestReport?.report_data || null
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action: log_score_history - Log a score change for tracking
    if (action === 'log_score_history') {
      const { score, previous_score, scoring_factors } = await req.json();

      await supabase.from('penny_score_history').insert({
        property_id,
        score,
        previous_score,
        scoring_factors,
        created_at: new Date().toISOString()
      });

      // Check if this triggers an alert
      if (previous_score && Math.abs(score - previous_score) >= 10) {
        await supabase.from('penny_score_alerts').insert({
          property_id,
          alert_type: 'score_change',
          severity: Math.abs(score - previous_score) >= 20 ? 'high' : 'medium',
          current_score: score,
          previous_score,
          message: `Score changed by ${score - previous_score} points`,
          created_at: new Date().toISOString()
        });
      }

      if (score < 40) {
        await supabase.from('penny_score_alerts').insert({
          property_id,
          alert_type: 'low_score',
          severity: score < 25 ? 'critical' : 'high',
          current_score: score,
          message: `Property score dropped to ${score}`,
          created_at: new Date().toISOString()
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Penny score monitoring error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
