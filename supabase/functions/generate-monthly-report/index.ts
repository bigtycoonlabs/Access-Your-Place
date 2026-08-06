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

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const GATEWAY_API_KEY = Deno.env.get('OPENAI_API_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();

    switch (action) {
      case 'generate_report':
        return await generateReport(params);
      case 'generate_all_monthly':
        return await generateAllMonthlyReports(params);
      case 'get_report':
        return await getReport(params.report_id);
      case 'get_reports':
        return await getReports(params.investor_id);
      case 'get_preferences':
        return await getPreferences(params.investor_id);
      case 'update_preferences':
        return await updatePreferences(params);
      case 'send_report_email':
        return await sendReportEmail(params.report_id);
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function generateReport(params: { investor_id: string; month?: number; year?: number }) {
  const { investor_id } = params;
  const now = new Date();
  const month = params.month || now.getMonth(); // Previous month (0-indexed)
  const year = params.year || (month === 0 ? now.getFullYear() - 1 : now.getFullYear());
  const reportMonth = month === 0 ? 12 : month;
  const reportYear = month === 0 ? year : year;

  // Check if report already exists
  const { data: existingReport } = await supabase
    .from('monthly_portfolio_reports')
    .select('*')
    .eq('investor_id', investor_id)
    .eq('report_month', reportMonth)
    .eq('report_year', reportYear)
    .single();

  if (existingReport?.status === 'completed') {
    return new Response(JSON.stringify({ 
      report: existingReport,
      message: 'Report already generated'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Create or update report record
  const { data: report, error: reportError } = await supabase
    .from('monthly_portfolio_reports')
    .upsert({
      investor_id,
      report_month: reportMonth,
      report_year: reportYear,
      status: 'generating',
      generation_started_at: new Date().toISOString()
    }, { onConflict: 'investor_id,report_month,report_year' })
    .select()
    .single();

  if (reportError) throw reportError;

  try {
    // Get investor info
    const { data: investor } = await supabase
      .from('investors')
      .select('*')
      .eq('id', investor_id)
      .single();

    // Get preferences
    const { data: preferences } = await supabase
      .from('investor_report_preferences')
      .select('*')
      .eq('investor_id', investor_id)
      .single();

    const prefs = preferences || {
      include_revenue_trends: true,
      include_occupancy_charts: true,
      include_market_comparison: true,
      include_top_performers: true,
      include_ai_recommendations: true,
      include_property_details: true
    };

    // Gather report data
    const reportData = await gatherReportData(investor_id, reportMonth, reportYear, prefs);

    // Generate AI recommendations
    let aiRecommendations = '';
    if (prefs.include_ai_recommendations && GATEWAY_API_KEY) {
      aiRecommendations = await generateAIRecommendations(reportData, investor);
    }

    // Generate HTML report
    const htmlContent = generateHTMLReport(reportData, investor, reportMonth, reportYear, aiRecommendations, prefs);

    // Update report with data
    await supabase
      .from('monthly_portfolio_reports')
      .update({
        status: 'completed',
        generation_completed_at: new Date().toISOString(),
        report_data: reportData,
        ai_recommendations: aiRecommendations
      })
      .eq('id', report.id);

    // Get updated report
    const { data: finalReport } = await supabase
      .from('monthly_portfolio_reports')
      .select('*')
      .eq('id', report.id)
      .single();

    return new Response(JSON.stringify({
      report: finalReport,
      html_content: htmlContent,
      message: 'Report generated successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    await supabase
      .from('monthly_portfolio_reports')
      .update({
        status: 'failed',
        error_message: error.message,
        generation_completed_at: new Date().toISOString()
      })
      .eq('id', report.id);

    throw error;
  }
}

async function gatherReportData(investorId: string, month: number, year: number, prefs: any) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const prevMonthStart = new Date(year, month - 2, 1);
  const prevMonthEnd = new Date(year, month - 1, 0);

  // Get properties
  const { data: properties } = await supabase
    .from('investor_properties')
    .select('*')
    .eq('investor_id', investorId);

  // Get current month data
  const { data: currentMonthData } = await supabase
    .from('portfolio_monthly_data')
    .select('*')
    .eq('investor_id', investorId)
    .eq('month', month)
    .eq('year', year);

  // Get previous month data for comparison
  const { data: prevMonthData } = await supabase
    .from('portfolio_monthly_data')
    .select('*')
    .eq('investor_id', investorId)
    .eq('month', month === 1 ? 12 : month - 1)
    .eq('year', month === 1 ? year - 1 : year);

  // Get 12-month trend data
  const trendData: any[] = [];
  for (let i = 11; i >= 0; i--) {
    const trendMonth = new Date(year, month - 1 - i, 1);
    const { data: monthData } = await supabase
      .from('portfolio_monthly_data')
      .select('revenue, occupancy_rate')
      .eq('investor_id', investorId)
      .eq('month', trendMonth.getMonth() + 1)
      .eq('year', trendMonth.getFullYear());

    const totalRevenue = monthData?.reduce((sum, d) => sum + (d.revenue || 0), 0) || 0;
    const avgOccupancy = monthData?.length ? 
      monthData.reduce((sum, d) => sum + (d.occupancy_rate || 0), 0) / monthData.length : 0;

    trendData.push({
      month: trendMonth.toLocaleString('default', { month: 'short' }),
      year: trendMonth.getFullYear(),
      revenue: totalRevenue,
      occupancy: avgOccupancy
    });
  }

  // Get bookings for the month
  const { data: bookings } = await supabase
    .from('platform_bookings')
    .select('*')
    .eq('investor_id', investorId)
    .gte('check_in', startDate.toISOString())
    .lte('check_in', endDate.toISOString());

  // Calculate totals
  const totalRevenue = currentMonthData?.reduce((sum, d) => sum + (d.revenue || 0), 0) || 0;
  const prevTotalRevenue = prevMonthData?.reduce((sum, d) => sum + (d.revenue || 0), 0) || 0;
  const avgOccupancy = currentMonthData?.length ? 
    currentMonthData.reduce((sum, d) => sum + (d.occupancy_rate || 0), 0) / currentMonthData.length : 0;
  const prevAvgOccupancy = prevMonthData?.length ?
    prevMonthData.reduce((sum, d) => sum + (d.occupancy_rate || 0), 0) / prevMonthData.length : 0;

  // Calculate top performers
  const propertyPerformance = (properties || []).map(prop => {
    const propData = currentMonthData?.find(d => d.property_id === prop.id);
    return {
      id: prop.id,
      address: prop.address,
      city: prop.city,
      state: prop.state,
      revenue: propData?.revenue || 0,
      occupancy: propData?.occupancy_rate || 0
    };
  }).sort((a, b) => b.revenue - a.revenue);

  // Market comparison data (mock for now)
  const marketComparison = {
    your_avg_revenue: totalRevenue / (properties?.length || 1),
    market_avg_revenue: totalRevenue / (properties?.length || 1) * 0.85,
    your_avg_occupancy: avgOccupancy,
    market_avg_occupancy: avgOccupancy * 0.9,
    your_avg_nightly_rate: bookings?.length ? 
      bookings.reduce((sum, b) => sum + (b.net_revenue / b.nights), 0) / bookings.length : 0,
    market_avg_nightly_rate: 175
  };

  return {
    summary: {
      total_properties: properties?.length || 0,
      total_revenue: totalRevenue,
      prev_revenue: prevTotalRevenue,
      revenue_change: prevTotalRevenue ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue * 100) : 0,
      avg_occupancy: avgOccupancy,
      prev_occupancy: prevAvgOccupancy,
      occupancy_change: prevAvgOccupancy ? ((avgOccupancy - prevAvgOccupancy) / prevAvgOccupancy * 100) : 0,
      total_bookings: bookings?.length || 0,
      total_nights: bookings?.reduce((sum, b) => sum + (b.nights || 0), 0) || 0
    },
    trend_data: trendData,
    property_performance: propertyPerformance,
    top_performers: propertyPerformance.slice(0, 5),
    market_comparison: marketComparison,
    properties: properties || [],
    bookings: bookings || []
  };
}

async function generateAIRecommendations(reportData: any, investor: any): Promise<string> {
  try {
    const prompt = `You are a real estate investment advisor. Based on the following portfolio performance data, provide 3-5 specific, actionable recommendations for improving portfolio performance.

Portfolio Summary:
- Total Properties: ${reportData.summary.total_properties}
- Monthly Revenue: $${reportData.summary.total_revenue.toLocaleString()}
- Revenue Change: ${reportData.summary.revenue_change.toFixed(1)}% from last month
- Average Occupancy: ${reportData.summary.avg_occupancy.toFixed(1)}%
- Occupancy Change: ${reportData.summary.occupancy_change.toFixed(1)}% from last month

Top Performing Properties:
${reportData.top_performers.slice(0, 3).map((p: any) => `- ${p.address}, ${p.city}: $${p.revenue.toLocaleString()} revenue, ${p.occupancy}% occupancy`).join('\n')}

Market Comparison:
- Your Avg Revenue: $${reportData.market_comparison.your_avg_revenue.toLocaleString()} vs Market: $${reportData.market_comparison.market_avg_revenue.toLocaleString()}
- Your Avg Occupancy: ${reportData.market_comparison.your_avg_occupancy.toFixed(1)}% vs Market: ${reportData.market_comparison.market_avg_occupancy.toFixed(1)}%

Provide recommendations in a professional, concise format. Focus on actionable insights.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + GATEWAY_API_KEY
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Unable to generate recommendations at this time.';
  } catch (error) {
    console.error('AI recommendation error:', error);
    return 'AI recommendations temporarily unavailable.';
  }
}

function generateHTMLReport(
  reportData: any, 
  investor: any, 
  month: number, 
  year: number, 
  aiRecommendations: string,
  prefs: any
): string {
  const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });
  
  // Generate SVG charts as base64
  const revenueChartSvg = generateRevenueChartSvg(reportData.trend_data);
  const occupancyChartSvg = generateOccupancyChartSvg(reportData.trend_data);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Portfolio Report - ${monthName} ${year}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; }
    .header { text-align: center; border-bottom: 3px solid #d4a574; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #1a1a2e; margin: 0; font-size: 28px; }
    .header p { color: #666; margin: 10px 0 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
    .summary-card { background: #f8f9fa; border-radius: 12px; padding: 20px; text-align: center; }
    .summary-card .value { font-size: 32px; font-weight: bold; color: #1a1a2e; }
    .summary-card .label { color: #666; font-size: 14px; margin-top: 5px; }
    .summary-card .change { font-size: 14px; margin-top: 5px; }
    .change.positive { color: #22c55e; }
    .change.negative { color: #ef4444; }
    .section { margin-bottom: 40px; }
    .section h2 { color: #1a1a2e; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; font-size: 20px; }
    .chart-container { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .property-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    .property-table th, .property-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    .property-table th { background: #f8f9fa; font-weight: 600; }
    .property-table tr:hover { background: #f8f9fa; }
    .recommendations { background: linear-gradient(135deg, #f8f9fa 0%, #e8f4f8 100%); border-radius: 12px; padding: 25px; }
    .recommendations h3 { color: #1a1a2e; margin-top: 0; }
    .recommendations ul { margin: 0; padding-left: 20px; }
    .recommendations li { margin-bottom: 10px; line-height: 1.6; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
    .comparison-bar { height: 24px; background: #e5e7eb; border-radius: 12px; margin: 10px 0; position: relative; overflow: hidden; }
    .comparison-bar .fill { height: 100%; border-radius: 12px; }
    .comparison-bar .your-fill { background: #d4a574; }
    .comparison-bar .market-fill { background: #94a3b8; position: absolute; top: 0; left: 0; opacity: 0.5; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Monthly Portfolio Report</h1>
    <p>${monthName} ${year} | ${investor?.name || 'Investor'}</p>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="value">$${reportData.summary.total_revenue.toLocaleString()}</div>
      <div class="label">Total Revenue</div>
      <div class="change ${reportData.summary.revenue_change >= 0 ? 'positive' : 'negative'}">
        ${reportData.summary.revenue_change >= 0 ? 'â†‘' : 'â†“'} ${Math.abs(reportData.summary.revenue_change).toFixed(1)}% vs last month
      </div>
    </div>
    <div class="summary-card">
      <div class="value">${reportData.summary.avg_occupancy.toFixed(1)}%</div>
      <div class="label">Average Occupancy</div>
      <div class="change ${reportData.summary.occupancy_change >= 0 ? 'positive' : 'negative'}">
        ${reportData.summary.occupancy_change >= 0 ? 'â†‘' : 'â†“'} ${Math.abs(reportData.summary.occupancy_change).toFixed(1)}% vs last month
      </div>
    </div>
    <div class="summary-card">
      <div class="value">${reportData.summary.total_properties}</div>
      <div class="label">Active Properties</div>
    </div>
    <div class="summary-card">
      <div class="value">${reportData.summary.total_bookings}</div>
      <div class="label">Total Bookings</div>
    </div>
  </div>

  ${prefs.include_revenue_trends ? `
  <div class="section">
    <h2>Revenue Trends (12 Months)</h2>
    <div class="chart-container">
      ${revenueChartSvg}
    </div>
  </div>
  ` : ''}

  ${prefs.include_occupancy_charts ? `
  <div class="section">
    <h2>Occupancy Trends (12 Months)</h2>
    <div class="chart-container">
      ${occupancyChartSvg}
    </div>
  </div>
  ` : ''}

  ${prefs.include_market_comparison ? `
  <div class="section">
    <h2>Market Comparison</h2>
    <div style="margin-top: 20px;">
      <p><strong>Average Revenue per Property</strong></p>
      <div class="comparison-bar">
        <div class="fill your-fill" style="width: ${Math.min(100, (reportData.market_comparison.your_avg_revenue / Math.max(reportData.market_comparison.your_avg_revenue, reportData.market_comparison.market_avg_revenue)) * 100)}%"></div>
      </div>
      <p style="font-size: 14px; color: #666;">Your Portfolio: $${reportData.market_comparison.your_avg_revenue.toLocaleString()} | Market Average: $${reportData.market_comparison.market_avg_revenue.toLocaleString()}</p>
      
      <p style="margin-top: 20px;"><strong>Average Occupancy Rate</strong></p>
      <div class="comparison-bar">
        <div class="fill your-fill" style="width: ${reportData.market_comparison.your_avg_occupancy}%"></div>
      </div>
      <p style="font-size: 14px; color: #666;">Your Portfolio: ${reportData.market_comparison.your_avg_occupancy.toFixed(1)}% | Market Average: ${reportData.market_comparison.market_avg_occupancy.toFixed(1)}%</p>
    </div>
  </div>
  ` : ''}

  ${prefs.include_top_performers ? `
  <div class="section">
    <h2>Top Performing Properties</h2>
    <table class="property-table">
      <thead>
        <tr>
          <th>Property</th>
          <th>Revenue</th>
          <th>Occupancy</th>
        </tr>
      </thead>
      <tbody>
        ${reportData.top_performers.map((p: any) => `
          <tr>
            <td>${p.address}, ${p.city}</td>
            <td>$${p.revenue.toLocaleString()}</td>
            <td>${p.occupancy}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  ${prefs.include_ai_recommendations && aiRecommendations ? `
  <div class="section">
    <h2>AI-Powered Recommendations</h2>
    <div class="recommendations">
      ${aiRecommendations.split('\n').map(line => `<p>${line}</p>`).join('')}
    </div>
  </div>
  ` : ''}

  <div class="footer">
    <p>Generated by Rental Arbitrage Deals Platform</p>
    <p>Report Date: ${new Date().toLocaleDateString()}</p>
  </div>
</body>
</html>
  `;
}

function generateRevenueChartSvg(trendData: any[]): string {
  const width = 700;
  const height = 250;
  const padding = 50;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const maxRevenue = Math.max(...trendData.map(d => d.revenue), 1);
  const points = trendData.map((d, i) => {
    const x = padding + (i / (trendData.length - 1)) * chartWidth;
    const y = height - padding - (d.revenue / maxRevenue) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="revenueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#d4a574;stop-opacity:0.3" />
          <stop offset="100%" style="stop-color:#d4a574;stop-opacity:0.05" />
        </linearGradient>
      </defs>
      
      <!-- Grid lines -->
      ${[0, 0.25, 0.5, 0.75, 1].map(pct => {
        const y = height - padding - pct * chartHeight;
        return `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="#e5e7eb" stroke-width="1"/>`;
      }).join('')}
      
      <!-- Area fill -->
      <polygon points="${areaPoints}" fill="url(#revenueGradient)" />
      
      <!-- Line -->
      <polyline points="${points}" fill="none" stroke="#d4a574" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      
      <!-- Data points -->
      ${trendData.map((d, i) => {
        const x = padding + (i / (trendData.length - 1)) * chartWidth;
        const y = height - padding - (d.revenue / maxRevenue) * chartHeight;
        return `<circle cx="${x}" cy="${y}" r="4" fill="#d4a574" stroke="#fff" stroke-width="2"/>`;
      }).join('')}
      
      <!-- X-axis labels -->
      ${trendData.map((d, i) => {
        const x = padding + (i / (trendData.length - 1)) * chartWidth;
        return `<text x="${x}" y="${height - 15}" text-anchor="middle" font-size="11" fill="#666">${d.month}</text>`;
      }).join('')}
      
      <!-- Y-axis labels -->
      ${[0, 0.5, 1].map(pct => {
        const y = height - padding - pct * chartHeight;
        const value = Math.round(maxRevenue * pct);
        return `<text x="${padding - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#666">$${(value / 1000).toFixed(0)}k</text>`;
      }).join('')}
    </svg>
  `;
}

function generateOccupancyChartSvg(trendData: any[]): string {
  const width = 700;
  const height = 200;
  const padding = 50;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const barWidth = (chartWidth / trendData.length) * 0.7;

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <!-- Grid lines -->
      ${[0, 25, 50, 75, 100].map(pct => {
        const y = height - padding - (pct / 100) * chartHeight;
        return `
          <line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="#e5e7eb" stroke-width="1"/>
          <text x="${padding - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#666">${pct}%</text>
        `;
      }).join('')}
      
      <!-- Bars -->
      ${trendData.map((d, i) => {
        const x = padding + (i / trendData.length) * chartWidth + (chartWidth / trendData.length - barWidth) / 2;
        const barHeight = (d.occupancy / 100) * chartHeight;
        const y = height - padding - barHeight;
        const color = d.occupancy >= 70 ? '#22c55e' : d.occupancy >= 50 ? '#f59e0b' : '#ef4444';
        return `
          <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="4"/>
          <text x="${x + barWidth / 2}" y="${height - 15}" text-anchor="middle" font-size="11" fill="#666">${d.month}</text>
        `;
      }).join('')}
    </svg>
  `;
}

async function sendReportEmail(reportId: string) {
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'Email service not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { data: report, error } = await supabase
    .from('monthly_portfolio_reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (error || !report) {
    return new Response(JSON.stringify({ error: 'Report not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { data: investor } = await supabase
    .from('investors')
    .select('*')
    .eq('id', report.investor_id)
    .single();

  if (!investor?.email) {
    return new Response(JSON.stringify({ error: 'Investor email not found' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const monthName = new Date(report.report_year, report.report_month - 1, 1)
    .toLocaleString('default', { month: 'long' });

  // Get preferences for additional recipients
  const { data: prefs } = await supabase
    .from('investor_report_preferences')
    .select('email_recipients')
    .eq('investor_id', report.investor_id)
    .single();

  const recipients = [investor.email, ...(prefs?.email_recipients || [])].filter(Boolean);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Access Your Place <reports@accessyourplace.com>',
        to: recipients,
        subject: `Your ${monthName} ${report.report_year} Portfolio Report`,
        html: generateEmailHTML(report, investor, monthName)
      })
    });

    const result = await response.json();

    if (response.ok) {
      await supabase
        .from('monthly_portfolio_reports')
        .update({
          email_sent_at: new Date().toISOString(),
          email_status: 'sent'
        })
        .eq('id', reportId);

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Report email sent successfully',
        email_id: result.id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      throw new Error(result.message || 'Failed to send email');
    }
  } catch (error: any) {
    await supabase
      .from('monthly_portfolio_reports')
      .update({
        email_status: 'failed',
        error_message: error.message
      })
      .eq('id', reportId);

    throw error;
  }
}

function generateEmailHTML(report: any, investor: any, monthName: string): string {
  const data = report.report_data || {};
  const summary = data.summary || {};

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
  <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <div style="text-align: center; border-bottom: 3px solid #d4a574; padding-bottom: 20px; margin-bottom: 25px;">
      <h1 style="color: #1a1a2e; margin: 0; font-size: 24px;">Monthly Portfolio Report</h1>
      <p style="color: #666; margin: 10px 0 0;">${monthName} ${report.report_year}</p>
    </div>

    <p style="color: #333;">Hi ${investor?.name || 'there'},</p>
    <p style="color: #666; line-height: 1.6;">Your monthly portfolio report is ready. Here's a quick summary of your performance:</p>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 25px 0;">
      <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; text-align: center;">
        <div style="font-size: 28px; font-weight: bold; color: #1a1a2e;">$${(summary.total_revenue || 0).toLocaleString()}</div>
        <div style="color: #666; font-size: 13px;">Total Revenue</div>
        <div style="color: ${(summary.revenue_change || 0) >= 0 ? '#22c55e' : '#ef4444'}; font-size: 13px;">
          ${(summary.revenue_change || 0) >= 0 ? 'â†‘' : 'â†“'} ${Math.abs(summary.revenue_change || 0).toFixed(1)}%
        </div>
      </div>
      <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; text-align: center;">
        <div style="font-size: 28px; font-weight: bold; color: #1a1a2e;">${(summary.avg_occupancy || 0).toFixed(1)}%</div>
        <div style="color: #666; font-size: 13px;">Avg Occupancy</div>
        <div style="color: ${(summary.occupancy_change || 0) >= 0 ? '#22c55e' : '#ef4444'}; font-size: 13px;">
          ${(summary.occupancy_change || 0) >= 0 ? 'â†‘' : 'â†“'} ${Math.abs(summary.occupancy_change || 0).toFixed(1)}%
        </div>
      </div>
    </div>

    <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e8f4f8 100%); border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #1a1a2e; margin: 0 0 10px;">Quick Stats</h3>
      <ul style="color: #666; margin: 0; padding-left: 20px; line-height: 1.8;">
        <li><strong>${summary.total_properties || 0}</strong> active properties</li>
        <li><strong>${summary.total_bookings || 0}</strong> bookings this month</li>
        <li><strong>${summary.total_nights || 0}</strong> nights booked</li>
      </ul>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="https://accessyourplace.com/investor/login" 
         style="display: inline-block; background: #d4a574; color: white; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        View Full Report
      </a>
    </div>

    <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px; text-align: center; color: #999; font-size: 12px;">
      <p>Rental Arbitrage Deals Platform</p>
      <p>You're receiving this because you have auto-reports enabled.</p>
    </div>
  </div>
</body>
</html>
  `;
}

async function generateAllMonthlyReports(params: { month?: number; year?: number }) {
  const now = new Date();
  const month = params.month || now.getMonth(); // Previous month
  const year = params.year || (month === 0 ? now.getFullYear() - 1 : now.getFullYear());
  const reportMonth = month === 0 ? 12 : month;
  const reportYear = month === 0 ? year : year;

  // Get all investors with auto-reports enabled
  const { data: preferences } = await supabase
    .from('investor_report_preferences')
    .select('investor_id')
    .eq('auto_reports_enabled', true);

  // Also get investors without preferences (default to enabled)
  const { data: allInvestors } = await supabase
    .from('investors')
    .select('id');

  const investorIds = new Set([
    ...(preferences?.map(p => p.investor_id) || []),
    ...(allInvestors?.map(i => i.id) || [])
  ]);

  const results = [];
  for (const investorId of investorIds) {
    try {
      const response = await generateReport({ investor_id: investorId, month: reportMonth, year: reportYear });
      const data = await response.json();
      
      if (data.report) {
        // Send email
        await sendReportEmail(data.report.id);
        results.push({ investor_id: investorId, status: 'success' });
      }
    } catch (error: any) {
      results.push({ investor_id: investorId, status: 'error', error: error.message });
    }
  }

  return new Response(JSON.stringify({ 
    results,
    message: `Generated ${results.filter(r => r.status === 'success').length} reports`
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function getReport(reportId: string) {
  const { data, error } = await supabase
    .from('monthly_portfolio_reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (error) throw error;

  return new Response(JSON.stringify({ report: data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function getReports(investorId: string) {
  const { data, error } = await supabase
    .from('monthly_portfolio_reports')
    .select('*')
    .eq('investor_id', investorId)
    .order('report_year', { ascending: false })
    .order('report_month', { ascending: false });

  if (error) throw error;

  return new Response(JSON.stringify({ reports: data || [] }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function getPreferences(investorId: string) {
  let { data, error } = await supabase
    .from('investor_report_preferences')
    .select('*')
    .eq('investor_id', investorId)
    .single();

  if (!data) {
    // Create default preferences
    const { data: newPrefs } = await supabase
      .from('investor_report_preferences')
      .insert({
        investor_id: investorId,
        auto_reports_enabled: true,
        include_revenue_trends: true,
        include_occupancy_charts: true,
        include_market_comparison: true,
        include_top_performers: true,
        include_ai_recommendations: true,
        include_property_details: true
      })
      .select()
      .single();
    data = newPrefs;
  }

  return new Response(JSON.stringify({ preferences: data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function updatePreferences(params: { investor_id: string; preferences: any }) {
  const { investor_id, preferences } = params;

  const { data, error } = await supabase
    .from('investor_report_preferences')
    .upsert({
      investor_id,
      ...preferences,
      updated_at: new Date().toISOString()
    }, { onConflict: 'investor_id' })
    .select()
    .single();

  if (error) throw error;

  return new Response(JSON.stringify({ preferences: data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
