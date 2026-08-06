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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Parse optional body params ──
    let forceRun = false;
    try {
      const body = await req.json();
      forceRun = body?.force === true;
    } catch { /* no body — fine */ }

    // ── Idempotency guard: skip if already ran within last 14 minutes ──
    if (!forceRun) {
      const { data: recentRun } = await supabase
        .from('cron_execution_log')
        .select('id, started_at')
        .eq('job_name', 'check-error-thresholds')
        .eq('status', 'success')
        .gte('started_at', new Date(Date.now() - 14 * 60 * 1000).toISOString())
        .order('started_at', { ascending: false })
        .limit(1);

      if (recentRun && recentRun.length > 0) {
        console.log(`[check-error-thresholds] Skipping — already ran at ${recentRun[0].started_at}`);
        return new Response(JSON.stringify({
          success: true,
          skipped: true,
          reason: 'Already ran within the last 14 minutes',
          last_run: recentRun[0].started_at,
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // ── Log execution start ──
    const { data: execLog } = await supabase
      .from('cron_execution_log')
      .insert({
        job_name: 'check-error-thresholds',
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    const execId = execLog?.id;

    const now = new Date();
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const dedupWindow = twoHoursAgo;

    const alerts: Array<{
      type: string;
      severity: 'critical' | 'warning' | 'info';
      title: string;
      description: string;
      function_name?: string;
      error_category?: string;
      error_count: number;
      alert_key: string;
    }> = [];

    // ── Check 1: More than 10 errors of the same type in 15 minutes ──
    const { data: recentErrors } = await supabase
      .from('error_logs')
      .select('*')
      .gte('created_at', fifteenMinAgo)
      .eq('resolved', false);

    const recentList = recentErrors || [];

    const categoryGroups: Record<string, any[]> = {};
    recentList.forEach((e: any) => {
      if (!categoryGroups[e.error_category]) categoryGroups[e.error_category] = [];
      categoryGroups[e.error_category].push(e);
    });

    for (const [category, errors] of Object.entries(categoryGroups)) {
      if (errors.length > 10) {
        const topFunc = getTopFunction(errors);
        const timeSlot = now.toISOString().slice(0, 16);
        alerts.push({
          type: 'threshold_breach',
          severity: 'critical',
          title: `Threshold Breach: ${errors.length} ${category} errors in 15 min`,
          description: `${errors.length} errors of type "${category}" detected in the last 15 minutes. Most affected function: ${topFunc.name} (${topFunc.count} errors). This indicates a systemic issue requiring immediate attention.`,
          error_category: category,
          error_count: errors.length,
          function_name: topFunc.name,
          alert_key: `threshold:${category}:${timeSlot}`,
        });
      }
    }

    // ── Check 2: 100% failure rate for a specific function in the last hour ──
    const { data: hourErrors } = await supabase
      .from('error_logs')
      .select('function_name, error_category, error_message')
      .gte('created_at', oneHourAgo)
      .eq('resolved', false)
      .eq('error_type', 'edge_function');

    const hourList = hourErrors || [];

    const funcGroups: Record<string, any[]> = {};
    hourList.forEach((e: any) => {
      if (!funcGroups[e.function_name]) funcGroups[e.function_name] = [];
      funcGroups[e.function_name].push(e);
    });

    for (const [funcName, errors] of Object.entries(funcGroups)) {
      if (errors.length >= 5) {
        const categories = new Set(errors.map((e: any) => e.error_category));
        if (categories.size <= 2) {
          const hourSlot = now.toISOString().slice(0, 13);
          alerts.push({
            type: 'total_failure',
            severity: 'critical',
            title: `Total Failure: ${funcName} (${errors.length} consecutive errors)`,
            description: `The edge function "${funcName}" has failed ${errors.length} times in the last hour with no successful responses detected. Error pattern: ${errors[0].error_category}. Last error: "${errors[errors.length - 1].error_message?.slice(0, 200)}". This function appears to be completely non-functional.`,
            function_name: funcName,
            error_category: errors[0].error_category,
            error_count: errors.length,
            alert_key: `total_failure:${funcName}:${hourSlot}`,
          });
        }
      }
    }

    // ── Check 3: Any auth-type errors ──
    const authErrors = recentList.filter((e: any) => e.error_category === 'auth');
    if (authErrors.length > 0) {
      const authFuncGroups: Record<string, any[]> = {};
      authErrors.forEach((e: any) => {
        if (!authFuncGroups[e.function_name]) authFuncGroups[e.function_name] = [];
        authFuncGroups[e.function_name].push(e);
      });

      const affectedFunctions = Object.keys(authFuncGroups);
      const timeSlot = now.toISOString().slice(0, 16);
      
      alerts.push({
        type: 'auth_error',
        severity: 'warning',
        title: `Auth Error Alert: ${authErrors.length} authentication failures`,
        description: `${authErrors.length} authentication/authorization errors detected in the last 15 minutes across ${affectedFunctions.length} function(s): ${affectedFunctions.join(', ')}. This may indicate a JWT/session configuration problem.`,
        error_category: 'auth',
        error_count: authErrors.length,
        function_name: affectedFunctions.join(', '),
        alert_key: `auth:${affectedFunctions.sort().join(',')}:${timeSlot}`,
      });
    }

    // ── Deduplicate ──
    const newAlerts: typeof alerts = [];
    for (const alert of alerts) {
      const { data: existing } = await supabase
        .from('error_alert_log')
        .select('id')
        .eq('alert_key', alert.alert_key)
        .gte('created_at', dedupWindow)
        .limit(1);

      if (!existing || existing.length === 0) {
        newAlerts.push(alert);
      } else {
        console.log(`Skipping duplicate alert: ${alert.alert_key}`);
      }
    }

    // ── Compute comparison badge data (current 1h vs previous 1h) ──
    const { data: currentHourErrors } = await supabase
      .from('error_logs')
      .select('id', { count: 'exact' })
      .gte('created_at', oneHourAgo)
      .eq('resolved', false);

    const { data: prevHourErrors } = await supabase
      .from('error_logs')
      .select('id', { count: 'exact' })
      .gte('created_at', twoHoursAgo)
      .lt('created_at', oneHourAgo)
      .eq('resolved', false);

    const currentCount = currentHourErrors?.length || 0;
    const previousCount = prevHourErrors?.length || 0;
    const changePct = previousCount === 0
      ? (currentCount > 0 ? 100 : 0)
      : Math.round(((currentCount - previousCount) / previousCount) * 100);
    const trendDirection = currentCount > previousCount ? 'up' : currentCount < previousCount ? 'down' : 'flat';
    const trendIcon = trendDirection === 'up' ? '&#9650;' : trendDirection === 'down' ? '&#9660;' : '&#9654;';
    const trendColor = trendDirection === 'up' ? '#dc2626' : trendDirection === 'down' ? '#16a34a' : '#6b7280';

    // ── Compute hourly trend data (last 12 hours) ──
    const hourlyBuckets: Array<{ label: string; total: number; auth: number; timeout: number; db: number; network: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const bucketStart = new Date(now.getTime() - (i + 1) * 3600000).toISOString();
      const bucketEnd = new Date(now.getTime() - i * 3600000).toISOString();
      const d = new Date(now.getTime() - i * 3600000);
      const label = `${d.getUTCHours().toString().padStart(2, '0')}:00`;

      const { data: bucketErrors } = await supabase
        .from('error_logs')
        .select('error_category')
        .gte('created_at', bucketStart)
        .lt('created_at', bucketEnd)
        .eq('resolved', false);

      const errs = bucketErrors || [];
      hourlyBuckets.push({
        label,
        total: errs.length,
        auth: errs.filter((e: any) => e.error_category === 'auth').length,
        timeout: errs.filter((e: any) => e.error_category === 'timeout').length,
        db: errs.filter((e: any) => e.error_category === 'db').length,
        network: errs.filter((e: any) => e.error_category === 'network').length,
      });
    }

    const maxHourlyTotal = Math.max(...hourlyBuckets.map(b => b.total), 1);

    // ── Send email alerts for new alerts ──
    let emailsSent = 0;

    if (newAlerts.length > 0 && resendApiKey) {
      const { data: successStaff } = await supabase
        .from('staff')
        .select('email, full_name')
        .or('department.eq.success_managers,roles.cs.{success_managers},department.eq.admin,roles.cs.{admin}')
        .eq('is_active', true);

      const recipientEmails = (successStaff || [])
        .map((s: any) => s.email)
        .filter((e: string) => e && e.includes('@'));

      const SHARED_MAILBOX = 'success@accessyourplace.com';
      if (!recipientEmails.includes(SHARED_MAILBOX)) {
        recipientEmails.push(SHARED_MAILBOX);
      }

      const dashboardUrl = 'https://preview-f1ypusd3--rental-trust-data.deploypad.app/staff#analytics';

      if (recipientEmails.length > 0) {
        for (const alert of newAlerts) {
          const severityColor = alert.severity === 'critical' ? '#dc2626' : alert.severity === 'warning' ? '#d97706' : '#2563eb';
          const severityBg = alert.severity === 'critical' ? '#fef2f2' : alert.severity === 'warning' ? '#fffbeb' : '#eff6ff';
          const severityLabel = alert.severity.toUpperCase();

          const hourlyTrendRows = hourlyBuckets.map(b => {
            const barWidth = Math.max(Math.round((b.total / maxHourlyTotal) * 100), 2);
            const barColor = b.total === 0 ? '#d1d5db' : b.total <= 3 ? '#fbbf24' : '#ef4444';
            return `<tr>
              <td style="padding:3px 8px;font-size:11px;color:#6b7280;white-space:nowrap;border-bottom:1px solid #f3f4f6;">${b.label}</td>
              <td style="padding:3px 8px;border-bottom:1px solid #f3f4f6;">
                <div style="background:#f3f4f6;border-radius:4px;height:14px;width:100%;position:relative;">
                  <div style="background:${barColor};border-radius:4px;height:14px;width:${barWidth}%;min-width:2px;"></div>
                </div>
              </td>
              <td style="padding:3px 8px;font-size:11px;font-weight:600;color:#374151;text-align:right;border-bottom:1px solid #f3f4f6;">${b.total}</td>
              <td style="padding:3px 4px;font-size:10px;color:#dc2626;text-align:center;border-bottom:1px solid #f3f4f6;">${b.auth || ''}</td>
              <td style="padding:3px 4px;font-size:10px;color:#f59e0b;text-align:center;border-bottom:1px solid #f3f4f6;">${b.timeout || ''}</td>
              <td style="padding:3px 4px;font-size:10px;color:#8b5cf6;text-align:center;border-bottom:1px solid #f3f4f6;">${b.db || ''}</td>
              <td style="padding:3px 4px;font-size:10px;color:#f97316;text-align:center;border-bottom:1px solid #f3f4f6;">${b.network || ''}</td>
            </tr>`;
          }).join('');

          const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;padding:20px;">
              <div style="max-width:640px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);border-top:4px solid ${severityColor};">
                <div style="padding:24px 32px;background:${severityBg};">
                  <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
                    <span style="display:inline-block;padding:4px 10px;background:${severityColor};color:white;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:0.5px;">${severityLabel}</span>
                    <span style="font-size:12px;color:#6b7280;">${now.toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })} ET</span>
                    <span style="display:inline-block;padding:3px 8px;background:${trendDirection === 'up' ? '#fef2f2' : trendDirection === 'down' ? '#f0fdf4' : '#f9fafb'};color:${trendColor};border-radius:12px;font-size:11px;font-weight:600;border:1px solid ${trendDirection === 'up' ? '#fecaca' : trendDirection === 'down' ? '#bbf7d0' : '#e5e7eb'};">
                      ${trendIcon} ${Math.abs(changePct)}% vs prev hour (${currentCount} vs ${previousCount})
                    </span>
                  </div>
                  <h1 style="margin:0;font-size:18px;font-weight:600;color:#1f2937;">${alert.title}</h1>
                </div>
                <div style="padding:24px 32px;">
                  <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">${alert.description}</p>
                  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
                    <tr>
                      <td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;font-size:13px;color:#6b7280;width:140px;">Alert Type</td>
                      <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;">${alert.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</td>
                    </tr>
                    ${alert.function_name ? `
                    <tr>
                      <td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;font-size:13px;color:#6b7280;">Function(s)</td>
                      <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;"><code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;">${alert.function_name}</code></td>
                    </tr>` : ''}
                    ${alert.error_category ? `
                    <tr>
                      <td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;font-size:13px;color:#6b7280;">Error Category</td>
                      <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;text-transform:capitalize;">${alert.error_category}</td>
                    </tr>` : ''}
                    <tr>
                      <td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;font-size:13px;color:#6b7280;">Error Count</td>
                      <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;font-weight:700;color:${severityColor};">${alert.error_count}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;font-size:13px;color:#6b7280;">Trend (1h)</td>
                      <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;font-weight:600;color:${trendColor};">
                        ${trendDirection === 'up' ? '&#9650; Up' : trendDirection === 'down' ? '&#9660; Down' : '&#9654; Flat'} ${Math.abs(changePct)}% (${currentCount} now vs ${previousCount} prev hour)
                      </td>
                    </tr>
                  </table>
                  <h3 style="margin:0 0 8px;font-size:14px;font-weight:600;color:#1f2937;">12-Hour Error Trend</h3>
                  <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px;font-size:11px;">
                    <thead>
                      <tr style="background:#f9fafb;">
                        <th style="padding:4px 8px;text-align:left;font-size:10px;color:#6b7280;font-weight:600;">Hour</th>
                        <th style="padding:4px 8px;text-align:left;font-size:10px;color:#6b7280;font-weight:600;">Trend</th>
                        <th style="padding:4px 8px;text-align:right;font-size:10px;color:#6b7280;font-weight:600;">Total</th>
                        <th style="padding:4px 4px;text-align:center;font-size:10px;color:#dc2626;font-weight:600;">Auth</th>
                        <th style="padding:4px 4px;text-align:center;font-size:10px;color:#f59e0b;font-weight:600;">Timeout</th>
                        <th style="padding:4px 4px;text-align:center;font-size:10px;color:#8b5cf6;font-weight:600;">DB</th>
                        <th style="padding:4px 4px;text-align:center;font-size:10px;color:#f97316;font-weight:600;">Network</th>
                      </tr>
                    </thead>
                    <tbody>${hourlyTrendRows}</tbody>
                  </table>
                  ${alert.type === 'auth_error' ? `
                  <div style="padding:12px 16px;background:#fffbeb;border-left:4px solid #d97706;border-radius:4px;margin-bottom:20px;">
                    <p style="margin:0;font-size:13px;color:#92400e;"><strong>Recommended Action:</strong> Check if the affected edge function(s) have <code>verify_jwt</code> enabled. Staff dashboard uses custom localStorage sessions, not Supabase Auth JWTs. Redeploy with <code>verify_jwt: false</code> and validate the staff session token in the function body instead.</p>
                  </div>` : ''}
                  ${alert.type === 'total_failure' ? `
                  <div style="padding:12px 16px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:4px;margin-bottom:20px;">
                    <p style="margin:0;font-size:13px;color:#991b1b;"><strong>Recommended Action:</strong> This function appears completely non-functional. Check the edge function logs in the Supabase dashboard for deployment errors, missing environment variables, or runtime exceptions. Consider redeploying the function.</p>
                  </div>` : ''}
                  ${alert.type === 'threshold_breach' ? `
                  <div style="padding:12px 16px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:4px;margin-bottom:20px;">
                    <p style="margin:0;font-size:13px;color:#991b1b;"><strong>Recommended Action:</strong> A high volume of errors indicates a systemic issue. Check if there's a database outage, network issue, or a recent deployment that introduced a bug.</p>
                  </div>` : ''}
                  <div style="text-align:center;margin-top:24px;">
                    <a href="${dashboardUrl}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#1a365d,#2d4a7c);color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
                      View Full Error Log in Analytics Dashboard
                    </a>
                  </div>
                </div>
                <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
                  <p style="margin:0;font-size:11px;color:#9ca3af;">
                    Automated alert from AYP Infrastructure Health Monitor &middot; Checks run every 15 minutes
                    <br>Duplicate alerts are suppressed for 2 hours per issue
                  </p>
                </div>
              </div>
            </body>
            </html>`;

          try {
            const emailResponse = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'Access Your Place Alerts <alerts@accessyourplace.com>',
                to: recipientEmails,
                subject: `[${severityLabel}] ${alert.title} | ${trendDirection === 'up' ? '▲' : trendDirection === 'down' ? '▼' : '—'} ${Math.abs(changePct)}% vs prev hour`,
                html: emailHtml,
              }),
            });

            if (emailResponse.ok) {
              emailsSent++;
              console.log(`Alert email sent: ${alert.title}`);
            } else {
              const errText = await emailResponse.text();
              console.error(`Failed to send alert email: ${errText}`);
            }
          } catch (emailErr) {
            console.error('Email send error:', emailErr);
          }

          await supabase.from('error_alert_log').insert({
            alert_type: alert.type,
            alert_key: alert.alert_key,
            function_name: alert.function_name,
            error_category: alert.error_category,
            error_count: alert.error_count,
            details: {
              severity: alert.severity,
              title: alert.title,
              description: alert.description,
              trend: trendDirection,
              trend_change_pct: changePct,
              current_hour_count: currentCount,
              previous_hour_count: previousCount,
            },
            email_sent_to: recipientEmails,
          });
        }
      } else {
        console.log('No recipient emails found — logging alerts without sending');
        for (const alert of newAlerts) {
          await supabase.from('error_alert_log').insert({
            alert_type: alert.type,
            alert_key: alert.alert_key,
            function_name: alert.function_name,
            error_category: alert.error_category,
            error_count: alert.error_count,
            details: {
              severity: alert.severity,
              title: alert.title,
              description: alert.description,
              trend: trendDirection,
              trend_change_pct: changePct,
            },
            email_sent_to: [],
          });
        }
      }
    }

    const durationMs = Date.now() - startTime;

    const resultPayload = {
      success: true,
      checked_at: now.toISOString(),
      errors_in_window: recentList.length,
      alerts_detected: alerts.length,
      alerts_new: newAlerts.length,
      alerts_deduplicated: alerts.length - newAlerts.length,
      emails_sent: emailsSent,
      comparison: {
        current_hour: currentCount,
        previous_hour: previousCount,
        change_pct: changePct,
        trend: trendDirection,
      },
      hourly_trend: hourlyBuckets,
      alert_details: newAlerts.map(a => ({
        type: a.type,
        severity: a.severity,
        title: a.title,
        error_count: a.error_count,
      })),
      duration_ms: durationMs,
    };

    // ── Log execution completion ──
    if (execId) {
      await supabase
        .from('cron_execution_log')
        .update({
          status: 'success',
          completed_at: new Date().toISOString(),
          duration_ms: durationMs,
          result: resultPayload,
        })
        .eq('id', execId);
    }

    return new Response(JSON.stringify(resultPayload), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (err: any) {
    console.error('Threshold check error:', err);

    const durationMs = Date.now() - startTime;

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase
        .from('cron_execution_log')
        .insert({
          job_name: 'check-error-thresholds',
          status: 'failed',
          started_at: new Date(Date.now() - durationMs).toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: durationMs,
          error_message: err.message,
        });
    } catch { /* best effort */ }

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

function getTopFunction(errors: any[]): { name: string; count: number } {
  const counts: Record<string, number> = {};
  errors.forEach(e => {
    counts[e.function_name] = (counts[e.function_name] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort(([,a], [,b]) => b - a);
  return sorted.length > 0 ? { name: sorted[0][0], count: sorted[0][1] } : { name: 'unknown', count: 0 };
}
