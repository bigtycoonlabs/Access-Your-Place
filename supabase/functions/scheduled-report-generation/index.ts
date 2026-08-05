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

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

async function sendReportEmail(investor: any, report: any, pdfUrl: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) { console.log('No Resend key'); return; }

  const markets = report.markets?.join(', ') || 'your markets';
  const reportType = report.report_type === 'weekly' ? 'Weekly' : 'Monthly';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; text-align: center;">
        <h1 style="color: #d4a574; margin: 0;">Your ${reportType} Market Report</h1>
        <p style="color: #fff; opacity: 0.9; margin: 10px 0 0;">${markets}</p>
      </div>
      <div style="padding: 30px;">
        <p>Hi ${investor.full_name},</p>
        <p>Your ${reportType.toLowerCase()} market report for <strong>${markets}</strong> is ready!</p>
        <p>This report includes:</p>
        <ul>
          <li>Current rental market analysis</li>
          <li>STR performance metrics</li>
          <li>New deals in your target areas</li>
          <li>Personalized investment recommendations</li>
        </ul>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${pdfUrl}" style="display: inline-block; background: #d4a574; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">Download Report</a>
        </div>
        <p>You can also view all your reports in the <a href="https://accessyourplace.com/investor" style="color: #d4a574;">Investor Portal</a>.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">You're receiving this because you subscribed to ${reportType.toLowerCase()} market reports. <a href="https://accessyourplace.com/investor" style="color: #d4a574;">Manage preferences</a></p>
      </div>
    </div>
  `;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Access Your Place <reports@accessyourplace.com>',
        to: investor.email,
        subject: `Your ${reportType} Market Report - ${markets}`,
        html
      })
    });
    console.log(`Email sent to ${investor.email}`);
  } catch (e) {
    console.error('Email error:', e);
  }
}

async function generateReportForInvestor(schedule: any) {
  const logEntry = { schedule_id: schedule.id, investor_id: schedule.investor_id, started_at: new Date().toISOString(), status: 'processing' };
  
  try {
    // Get investor details
    const { data: investor } = await supabase.from('investor_profiles').select('*').eq('id', schedule.investor_id).single();
    if (!investor) throw new Error('Investor not found');

    const markets = schedule.markets || investor.preferred_markets || [];
    if (markets.length === 0) throw new Error('No markets configured');

    // Generate the report using existing function
    const gatewayKey = Deno.env.get('GATEWAY_API_KEY');
    const reportType = schedule.frequency;

    // Create report record
    const { data: report, error: reportError } = await supabase.from('market_reports').insert({
      investor_id: schedule.investor_id,
      report_type: reportType,
      markets,
      status: 'generating'
    }).select('*').single();

    if (reportError) throw reportError;

    // Generate AI analysis
    const prompt = `Generate a comprehensive ${reportType} real estate market report for: ${markets.join(', ')}.
Include: 1) Market overview and trends 2) Average rental rates and changes 3) STR occupancy and ADR data 4) Investment recommendations.
Format as JSON with keys: market_overview, rental_data (with avg_rent, median_rent, yoy_change), str_data (with avg_daily_rate, occupancy_rate, revenue_per_available), recommendations (array of 3-5 actionable tips).`;

    const aiResponse = await fetch('https://ai.gateway.fastrouter.io/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': gatewayKey! },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    });

    const aiData = await aiResponse.json();
    let reportData = {};
    
    try {
      const content = aiData.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) reportData = JSON.parse(jsonMatch[0]);
    } catch (e) {
      reportData = { market_overview: aiData.choices?.[0]?.message?.content || 'Report data unavailable' };
    }

    // Get new deals in markets
    const { data: deals } = await supabase.from('properties').select('*').in('city', markets).eq('status', 'published').order('created_at', { ascending: false }).limit(10);
    reportData.new_deals = deals || [];

    // Update report with data
    await supabase.from('market_reports').update({ report_data: reportData, status: 'completed', generated_at: new Date().toISOString() }).eq('id', report.id);

    // Generate PDF
    const pdfResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-report-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
      body: JSON.stringify({ report_id: report.id })
    });
    const pdfData = await pdfResponse.json();

    // Send email with report
    if (pdfData.pdf_url) {
      await sendReportEmail(investor, { ...report, markets }, pdfData.pdf_url);
    }

    // Update schedule last_generated
    await supabase.from('market_report_schedules').update({ last_generated: new Date().toISOString() }).eq('id', schedule.id);

    // Log success
    await supabase.from('report_generation_logs').insert({ ...logEntry, status: 'success', completed_at: new Date().toISOString(), report_id: report.id });

    return { success: true, report_id: report.id };
  } catch (error) {
    console.error('Generation error:', error);
    await supabase.from('report_generation_logs').insert({ ...logEntry, status: 'failed', error_message: error.message, completed_at: new Date().toISOString() });
    return { success: false, error: error.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
    const dayOfMonth = today.getDate();

    // Get all active schedules
    const { data: schedules } = await supabase.from('market_report_schedules').select('*').eq('is_active', true);

    const dueSchedules = (schedules || []).filter(s => {
      // Check if already generated today
      if (s.last_generated) {
        const lastGen = new Date(s.last_generated);
        if (lastGen.toDateString() === today.toDateString()) return false;
      }

      if (s.frequency === 'weekly') {
        return s.day_of_week === dayOfWeek;
      } else if (s.frequency === 'monthly') {
        return s.day_of_month === dayOfMonth;
      }
      return false;
    });

    console.log(`Found ${dueSchedules.length} reports due for generation`);

    const results = [];
    for (const schedule of dueSchedules) {
      const result = await generateReportForInvestor(schedule);
      results.push({ schedule_id: schedule.id, ...result });
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Cron error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
