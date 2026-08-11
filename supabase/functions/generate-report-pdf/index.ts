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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

function generatePDFContent(report: any): string {
  const data = report.report_data || {};
  const markets = report.markets?.join(', ') || 'Multiple Markets';
  const date = new Date(report.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const reportType = report.report_type === 'weekly' ? 'Weekly' : report.report_type === 'monthly' ? 'Monthly' : 'Custom';

  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 40px; color: #333; line-height: 1.6; }
  .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 40px; margin: -40px -40px 30px; }
  .header h1 { margin: 0 0 10px; font-size: 28px; color: #d4a574; }
  .header p { margin: 0; opacity: 0.9; }
  .section { margin-bottom: 30px; page-break-inside: avoid; }
  .section h2 { color: #1a1a2e; border-bottom: 2px solid #d4a574; padding-bottom: 10px; font-size: 18px; }
  .metric-grid { display: flex; gap: 20px; flex-wrap: wrap; margin: 20px 0; }
  .metric-card { background: #f8f9fa; border-radius: 8px; padding: 20px; flex: 1; min-width: 150px; text-align: center; border-left: 4px solid #d4a574; }
  .metric-card .value { font-size: 24px; font-weight: bold; color: #1a1a2e; }
  .metric-card .label { font-size: 12px; color: #666; text-transform: uppercase; }
  .deal-card { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin: 10px 0; }
  .deal-card h4 { margin: 0 0 8px; color: #1a1a2e; }
  .deal-card p { margin: 0; font-size: 14px; color: #666; }
  .recommendation { background: #f0f7ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 10px 0; border-radius: 0 8px 8px 0; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 15px 0; }
  th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
  th { background: #f8f9fa; font-weight: 600; color: #1a1a2e; }
</style></head><body>
<div class="header">
  <h1>Access Your Place - ${reportType} Market Report</h1>
  <p>${markets} | Generated ${date}</p>
</div>`;

  // Market Overview
  if (data.market_overview) {
    html += `<div class="section"><h2>Market Overview</h2><p>${typeof data.market_overview === 'string' ? data.market_overview : JSON.stringify(data.market_overview)}</p></div>`;
  }

  // Rental Data Metrics
  if (data.rental_data) {
    const rental = typeof data.rental_data === 'object' ? data.rental_data : {};
    html += `<div class="section"><h2>Rental Market Analysis</h2>`;
    if (rental.avg_rent || rental.median_rent) {
      html += `<div class="metric-grid">`;
      if (rental.avg_rent) html += `<div class="metric-card"><div class="value">$${rental.avg_rent.toLocaleString()}</div><div class="label">Avg Monthly Rent</div></div>`;
      if (rental.median_rent) html += `<div class="metric-card"><div class="value">$${rental.median_rent.toLocaleString()}</div><div class="label">Median Rent</div></div>`;
      if (rental.yoy_change) html += `<div class="metric-card"><div class="value">${rental.yoy_change > 0 ? '+' : ''}${rental.yoy_change}%</div><div class="label">YoY Change</div></div>`;
      html += `</div>`;
    }
    if (typeof data.rental_data === 'string') html += `<p>${data.rental_data}</p>`;
    html += `</div>`;
  }

  // STR Performance
  if (data.str_data) {
    const str = typeof data.str_data === 'object' ? data.str_data : {};
    html += `<div class="section"><h2>Short-Term Rental Performance</h2>`;
    if (str.avg_daily_rate || str.occupancy_rate) {
      html += `<div class="metric-grid">`;
      if (str.avg_daily_rate) html += `<div class="metric-card"><div class="value">$${str.avg_daily_rate}</div><div class="label">Avg Daily Rate</div></div>`;
      if (str.occupancy_rate) html += `<div class="metric-card"><div class="value">${str.occupancy_rate}%</div><div class="label">Occupancy Rate</div></div>`;
      if (str.revenue_per_available) html += `<div class="metric-card"><div class="value">$${str.revenue_per_available}</div><div class="label">RevPAR</div></div>`;
      html += `</div>`;
    }
    if (typeof data.str_data === 'string') html += `<p>${data.str_data}</p>`;
    html += `</div>`;
  }

  // New Deals
  if (data.new_deals?.length > 0) {
    html += `<div class="section"><h2>New Deals in Your Markets (${data.new_deals.length})</h2>`;
    html += `<table><thead><tr><th>Address</th><th>Price</th><th>Beds/Baths</th><th>Est. Revenue</th></tr></thead><tbody>`;
    data.new_deals.slice(0, 10).forEach((d: any) => {
      html += `<tr><td>${d.address || d.full_address || 'N/A'}</td><td>$${(d.price || 0).toLocaleString()}</td><td>${d.bedrooms || '-'}/${d.bathrooms || '-'}</td><td>$${(d.estimated_revenue || d.projected_revenue || 0).toLocaleString()}/mo</td></tr>`;
    });
    html += `</tbody></table></div>`;
  }

  // Recommendations
  if (data.recommendations) {
    html += `<div class="section"><h2>Personalized Recommendations</h2>`;
    if (Array.isArray(data.recommendations)) {
      data.recommendations.forEach((r: string) => { html += `<div class="recommendation">${r}</div>`; });
    } else {
      html += `<div class="recommendation">${data.recommendations}</div>`;
    }
    html += `</div>`;
  }

  html += `<div class="footer"><p>Access Your Place | Rental Arbitrage Investment Platform</p><p>This report is for informational purposes only. Past performance does not guarantee future results.</p></div></body></html>`;
  return html;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { report_id } = await req.json();
    if (!report_id) throw new Error('Report ID required');

    // Get report data
    const { data: report, error } = await supabase.from('market_reports').select('*').eq('id', report_id).single();
    if (error || !report) throw new Error('Report not found');

    // Generate HTML content
    const htmlContent = generatePDFContent(report);

    // Convert HTML to PDF using html2pdf service or store as HTML
    const fileName = `market-report-${report_id}-${Date.now()}.html`;
    const encoder = new TextEncoder();
    const fileData = encoder.encode(htmlContent);

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('investor-documents')
      .upload(`reports/${fileName}`, fileData, { contentType: 'text/html', upsert: true });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage.from('investor-documents').getPublicUrl(`reports/${fileName}`);

    // Update report with PDF URL
    await supabase.from('market_reports').update({ pdf_url: urlData.publicUrl, pdf_generated_at: new Date().toISOString() }).eq('id', report_id);

    return new Response(JSON.stringify({ success: true, pdf_url: urlData.publicUrl, filename: fileName }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
