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

// manage-portfolio-approvals v4.0 - Investor confirmation emails + inline editing + improved notifications
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
const resendApiKey = Deno.env.get('RESEND_API_KEY');

async function sendEmail(to: string, subject: string, htmlBody: string): Promise<{ success: boolean; resendId?: string; error?: string }> {
  if (!resendApiKey) return { success: false, error: 'Resend API key not configured' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Penny <penny@accessyourplace.com>', reply_to: ['success@accessyourplace.com'],
        to: [to],
        subject,
        html: htmlBody
      })
    });
    const result = await res.json();
    if (res.ok) {
      console.log(`Email sent to ${to}: ${result.id}`);
      return { success: true, resendId: result.id };
    }
    console.error(`Email failed to ${to}:`, result);
    return { success: false, error: result.message || JSON.stringify(result) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

async function logEmail(supabase: any, params: {
  recipientEmail: string; recipientId?: string; subject: string;
  templateType: string; status: string; resendId?: string; errorMessage?: string;
}) {
  try {
    await supabase.from('email_logs').insert({
      recipient_email: params.recipientEmail, recipient_id: params.recipientId || null,
      subject: params.subject, template_type: params.templateType, status: params.status,
      resend_id: params.resendId || null, error_message: params.errorMessage || null,
      sent_at: new Date().toISOString()
    });
  } catch (e: any) { console.error('Failed to log email:', e.message); }
}

function buildRequestNotificationEmail(params: {
  requestType: string; investorName: string; investorEmail: string;
  propertyAddress: string; propertyCity?: string; propertyState?: string;
  additionalDetails?: Record<string, any>;
}): string {
  const { requestType, investorName, investorEmail, propertyAddress, propertyCity, propertyState, additionalDetails } = params;
  const typeLabels: Record<string, { label: string; color: string }> = {
    'portfolio_submission': { label: 'New Portfolio Property', color: '#d4a574' },
    'acquisition_request': { label: 'Acquisition Request', color: '#3b82f6' },
    'sell_request': { label: 'Sell Request', color: '#8b5cf6' },
  };
  const typeInfo = typeLabels[requestType] || { label: requestType, color: '#6b7280' };
  const location = [propertyCity, propertyState].filter(Boolean).join(', ');
  let detailsHtml = '';
  if (additionalDetails) {
    const rows = Object.entries(additionalDetails).filter(([_, v]) => v != null && v !== '')
      .map(([k, v]) => `<tr><td style="padding:6px 12px;color:#6b7280;font-size:14px;">${k}</td><td style="padding:6px 12px;font-weight:600;font-size:14px;">${v}</td></tr>`).join('');
    if (rows) detailsHtml = `<table style="width:100%;border-collapse:collapse;margin-top:12px;">${rows}</table>`;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;"><div style="max-width:600px;margin:0 auto;padding:20px;"><div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);"><div style="background:linear-gradient(135deg,#1a365d,#2d4a7c);padding:24px 32px;"><h1 style="color:white;margin:0;font-size:20px;">Access Your Place</h1><p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px;">Success Team Notification</p></div><div style="padding:24px 32px 0;"><div style="display:inline-block;background:${typeInfo.color};color:white;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:600;">${typeInfo.label}</div></div><div style="padding:20px 32px 32px;"><h2 style="color:#1a365d;margin:0 0 16px;font-size:18px;">New Request Requires Your Attention</h2><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;"><table style="width:100%;border-collapse:collapse;"><tr><td style="padding:6px 12px;color:#6b7280;font-size:14px;">Investor</td><td style="padding:6px 12px;font-weight:600;font-size:14px;">${investorName}</td></tr><tr><td style="padding:6px 12px;color:#6b7280;font-size:14px;">Email</td><td style="padding:6px 12px;font-size:14px;"><a href="mailto:${investorEmail}" style="color:#3b82f6;">${investorEmail}</a></td></tr><tr><td style="padding:6px 12px;color:#6b7280;font-size:14px;">Property</td><td style="padding:6px 12px;font-weight:600;font-size:14px;">${propertyAddress}</td></tr>${location ? `<tr><td style="padding:6px 12px;color:#6b7280;font-size:14px;">Location</td><td style="padding:6px 12px;font-size:14px;">${location}</td></tr>` : ''}</table>${detailsHtml}</div><a href="https://accessyourplace.com/staff" style="display:inline-block;background:#d4a574;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Review in Dashboard</a></div></div></div></body></html>`;
}

function buildInvestorConfirmationEmail(params: {
  investorName: string; propertyAddress: string; status: 'approved' | 'rejected';
  staffNotes?: string; propertyCity?: string; propertyState?: string;
}): string {
  const { investorName, propertyAddress, status, staffNotes, propertyCity, propertyState } = params;
  const isApproved = status === 'approved';
  const statusColor = isApproved ? '#10b981' : '#ef4444';
  const statusLabel = isApproved ? 'Approved' : 'Needs Attention';
  const statusMessage = isApproved
    ? 'Great news! Your property has been reviewed and approved by our Success Team. It is now active in your portfolio.'
    : 'Your property submission has been reviewed and requires some additional information or changes before it can be approved.';
  const location = [propertyCity, propertyState].filter(Boolean).join(', ');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;"><div style="max-width:600px;margin:0 auto;padding:20px;"><div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);"><div style="background:linear-gradient(135deg,#1a365d,#2d4a7c);padding:24px 32px;"><h1 style="color:white;margin:0;font-size:20px;">Access Your Place</h1><p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px;">Portfolio Update</p></div><div style="padding:24px 32px;"><div style="display:inline-block;background:${statusColor};color:white;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:16px;">${statusLabel}</div><h2 style="color:#1a365d;margin:0 0 8px;font-size:18px;">Hi ${investorName},</h2><p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 16px;">${statusMessage}</p><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;"><table style="width:100%;border-collapse:collapse;"><tr><td style="padding:6px 12px;color:#6b7280;font-size:14px;">Property</td><td style="padding:6px 12px;font-weight:600;font-size:14px;">${propertyAddress}</td></tr>${location ? `<tr><td style="padding:6px 12px;color:#6b7280;font-size:14px;">Location</td><td style="padding:6px 12px;font-size:14px;">${location}</td></tr>` : ''}<tr><td style="padding:6px 12px;color:#6b7280;font-size:14px;">Status</td><td style="padding:6px 12px;font-weight:600;font-size:14px;color:${statusColor};">${isApproved ? 'Active' : 'Requires Changes'}</td></tr></table></div>${staffNotes ? `<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin-bottom:16px;"><p style="color:#92400e;font-size:13px;font-weight:600;margin:0 0 4px;">Notes from Success Team:</p><p style="color:#78350f;font-size:14px;margin:0;">${staffNotes}</p></div>` : ''}<a href="https://accessyourplace.com/investor" style="display:inline-block;background:#d4a574;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">View Your Portfolio</a><p style="color:#9ca3af;font-size:12px;margin-top:20px;">If you have questions, please contact your Success Team manager or reply to this email.</p></div></div></div></body></html>`;
}

async function notifySuccessTeamEmail(supabase: any, params: {
  requestType: string; investorName: string; investorEmail: string;
  propertyAddress: string; propertyCity?: string; propertyState?: string;
  additionalDetails?: Record<string, any>;
}): Promise<{ emailsSent: number; smsSent: number }> {
  let emailsSent = 0;
  let smsSent = 0;
  try {
    const { data: staffUsers } = await supabase.from('staff_users').select('id, name, first_name, last_name, email, phone, whatsapp_number, department, team, roles, permissions').eq('is_active', true);
    const successTeam = (staffUsers || []).filter((s: any) => {
      const dept = (s.department || '').toLowerCase();
      const team = (s.team || '').toLowerCase();
      const roles = (s.roles || []).map((r: string) => r.toLowerCase());
      const perms = (s.permissions || []);
      return dept.includes('success') || team.includes('success') || roles.includes('success_managers') || perms.includes('all');
    });
    if (successTeam.length === 0) { console.log('No success team members found'); return { emailsSent: 0, smsSent: 0 }; }
    console.log(`Found ${successTeam.length} success team members to notify`);
    const typeLabels: Record<string, string> = {
      'portfolio_submission': 'New Portfolio Property Submission',
      'acquisition_request': 'New Acquisition Request',
      'sell_request': 'New Sell Request',
    };
    const subject = `[Action Required] ${typeLabels[params.requestType] || params.requestType} - ${params.investorName}`;
    const htmlBody = buildRequestNotificationEmail(params);
    for (const member of successTeam) {
      if (member.email) {
        const result = await sendEmail(member.email, subject, htmlBody);
        await logEmail(supabase, { recipientEmail: member.email, recipientId: member.id, subject, templateType: `success_team_${params.requestType}`, status: result.success ? 'sent' : 'failed', resendId: result.resendId, errorMessage: result.error });
        if (result.success) emailsSent++;
      }
    }
    return { emailsSent, smsSent };
  } catch (e: any) { console.error('Error notifying success team:', e.message); return { emailsSent, smsSent }; }
}

async function sendInvestorConfirmation(supabase: any, params: {
  investorId: string; investorEmail: string; investorName: string;
  propertyAddress: string; propertyCity?: string; propertyState?: string;
  status: 'approved' | 'rejected'; staffNotes?: string;
}) {
  if (!params.investorEmail) return;
  const subject = params.status === 'approved'
    ? `Your Property at ${params.propertyAddress} Has Been Approved!`
    : `Update on Your Property Submission - ${params.propertyAddress}`;
  const html = buildInvestorConfirmationEmail({
    investorName: params.investorName, propertyAddress: params.propertyAddress,
    status: params.status, staffNotes: params.staffNotes,
    propertyCity: params.propertyCity, propertyState: params.propertyState,
  });
  const result = await sendEmail(params.investorEmail, subject, html);
  await logEmail(supabase, {
    recipientEmail: params.investorEmail, recipientId: params.investorId,
    subject, templateType: `investor_portfolio_${params.status}`,
    status: result.success ? 'sent' : 'failed', resendId: result.resendId, errorMessage: result.error,
  });
  // Also create investor_notification record
  try {
    await supabase.from('investor_notifications').insert({
      investor_id: params.investorId,
      type: `portfolio_${params.status}`,
      title: params.status === 'approved' ? 'Property Approved' : 'Property Update Required',
      message: params.status === 'approved'
        ? `Your property at ${params.propertyAddress} has been approved and is now active in your portfolio.`
        : `Your property at ${params.propertyAddress} needs attention. ${params.staffNotes || 'Please review and resubmit.'}`,
      read: false,
      created_at: new Date().toISOString()
    });
  } catch (e) { console.log('investor_notifications insert skipped:', e); }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { action, ...params } = await req.json();

    switch (action) {
      // Marks the acquisition itself finished, which is different from approving a
      // property. Filtered on not-already-complete so a second click reports the truth
      // rather than a fresh success.
      case 'mark_acquisition_complete': {
        const { property_id, staff_name } = params;
        if (!property_id) {
          return new Response(JSON.stringify({ success: false, error: 'property_id is required.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data, error } = await supabase
          .from('acquisition_requests')
          .update({
            status: 'completed',
            manager_notes: staff_name ? `Marked complete by ${staff_name}` : null,
            updated_at: new Date().toISOString(),
          })
          .eq('converted_property_id', property_id)
          .neq('status', 'completed')
          .select();
        if (error) {
          console.error('[manage-portfolio-approvals] mark_acquisition_complete failed:', error.message);
          return new Response(JSON.stringify({ success: false, error: 'Could not mark it complete. Nothing was changed.' }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (!data?.length) {
          return new Response(JSON.stringify({ success: false,
            error: 'Nothing was updated — either there is no acquisition against that property, or it was already complete.' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ success: true, acquisitions: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'get_pending_approvals': {
        const { data: properties, error } = await supabase.from('portfolio_properties').select('*').eq('property_status', 'pending_approval').order('created_at', { ascending: false });
        if (error) throw error;
        const investorIds = [...new Set(properties?.map(p => p.investor_id) || [])];
        let investorMap = new Map();
        if (investorIds.length > 0) {
          const { data: investors } = await supabase.from('investors').select('id, full_name, email').in('id', investorIds);
          investorMap = new Map(investors?.map(i => [i.id, i]) || []);
        }
        const enriched = properties?.map(p => ({ ...p, investor_name: investorMap.get(p.investor_id)?.full_name || 'Unknown', investor_email: investorMap.get(p.investor_id)?.email || '' }));
        return json({ success: true, properties: enriched });
      }

      case 'get_all_portfolio_properties': {
        const { status_filter } = params;
        let query = supabase.from('portfolio_properties').select('*').order('created_at', { ascending: false });
        if (status_filter && status_filter !== 'all') query = query.eq('property_status', status_filter);
        const { data: properties, error } = await query;
        if (error) throw error;
        const investorIds = [...new Set(properties?.map(p => p.investor_id) || [])];
        let investorMap = new Map();
        if (investorIds.length > 0) {
          const { data: investors } = await supabase.from('investors').select('id, full_name, email').in('id', investorIds);
          investorMap = new Map(investors?.map(i => [i.id, i]) || []);
        }
        const enriched = properties?.map(p => ({ ...p, investor_name: investorMap.get(p.investor_id)?.full_name || 'Unknown', investor_email: investorMap.get(p.investor_id)?.email || '' }));
        return json({ success: true, properties: enriched });
      }

      case 'submit_property': {
        const { investor_id, property_data } = params;
        if (!investor_id) return json({ error: 'Investor ID required' }, 400);
        
        const { data: investor } = await supabase.from('investors').select('full_name, email').eq('id', investor_id).single();
        const investorName = investor?.full_name || 'An investor';
        const investorEmail = investor?.email || '';
        
        const address = property_data?.address || params.address || 'Not specified';
        const city = property_data?.city || params.city || '';
        const state = property_data?.state || params.state || '';

        // Try inserting into portfolio_properties
        const insertData = {
          investor_id,
          address,
          city,
          state,
          zip_code: property_data?.zip_code || params.zip_code || '',
          bedrooms: property_data?.bedrooms || params.bedrooms || 0,
          bathrooms: property_data?.bathrooms || params.bathrooms || 0,
          monthly_rent: property_data?.monthly_rent || params.monthly_rent || 0,
          acquisition_fee: property_data?.acquisition_fee || params.acquisition_fee || 0,
          initial_investment: property_data?.initial_investment || 0,
          monthly_earnings: property_data?.monthly_earnings || 0,
          acquired_through_ayp: property_data?.acquired_through_ayp ?? params.acquired_through_ayp ?? true,
          acquisition_source: property_data?.acquisition_source || 'ayp',
          property_type: property_data?.property_type || 'single_family',
          property_status: 'pending_approval',
          notes: property_data?.notes || params.notes || '',
          photo_urls: property_data?.photo_urls || [],
          square_footage: property_data?.square_footage || 0,
          operation_type: property_data?.operation_type || '',
          community_name: property_data?.community_name || '',
          community_website: property_data?.community_website || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          submission_timeline: JSON.stringify([
            { stage: 'submitted', date: new Date().toISOString(), by: investorName, notes: 'Property submitted for approval' }
          ])
        };

        const { data: property, error: insertErr } = await supabase.from('portfolio_properties').insert(insertData).select().single();
        
        // If portfolio_properties doesn't exist, try investor_portfolio
        if (insertErr) {
          console.log('portfolio_properties insert failed, trying investor_portfolio:', insertErr.message);
          const { data: altProp, error: altErr } = await supabase.from('investor_portfolio').insert({
            ...insertData,
            status: 'pending_approval'
          }).select().single();
          if (altErr) {
            console.error('Both tables failed:', altErr.message);
            return json({ success: false, error: `Insert failed: ${insertErr.message}. Alt: ${altErr.message}` });
          }
          // Notify success team
          await notifySuccessTeamEmail(supabase, {
            requestType: 'portfolio_submission', investorName, investorEmail,
            propertyAddress: address, propertyCity: city, propertyState: state,
            additionalDetails: { 'Bedrooms': insertData.bedrooms, 'Monthly Rent': insertData.monthly_rent ? `$${insertData.monthly_rent.toLocaleString()}` : 'N/A' }
          });
          return json({ success: true, property: altProp });
        }

        // Notify success team via email
        const notifyResult = await notifySuccessTeamEmail(supabase, {
          requestType: 'portfolio_submission', investorName, investorEmail,
          propertyAddress: address, propertyCity: city, propertyState: state,
          additionalDetails: {
            'Bedrooms': insertData.bedrooms, 'Bathrooms': insertData.bathrooms,
            'Monthly Rent': insertData.monthly_rent ? `$${insertData.monthly_rent.toLocaleString()}` : 'N/A',
            'Acquisition Fee': insertData.acquisition_fee ? `$${insertData.acquisition_fee.toLocaleString()}` : 'N/A',
          }
        });
        console.log(`Notification result: ${notifyResult.emailsSent} emails sent`);

        // Create notification record
        try {
          await supabase.from('notifications').insert({
            type: 'portfolio_submission', title: 'New Portfolio Property Submitted',
            message: `${investorName} submitted ${address} for approval`,
            data: { investor_id, property_id: property?.id, address },
            created_at: new Date().toISOString()
          });
        } catch (e) { console.log('Notification insert skipped'); }

        return json({ success: true, property, emails_sent: notifyResult.emailsSent });
      }

      case 'submit_acquisition_request': {
        const { investor_id, property_id, address, city, state, request_type, notes } = params;
        if (!investor_id) return json({ error: 'Investor ID required' }, 400);
        const { data: investor } = await supabase.from('investors').select('full_name, email').eq('id', investor_id).single();
        const investorName = investor?.full_name || 'An investor';
        const investorEmail = investor?.email || '';
        await notifySuccessTeamEmail(supabase, {
          requestType: request_type || 'acquisition_request', investorName, investorEmail,
          propertyAddress: address || 'Not specified', propertyCity: city, propertyState: state,
          additionalDetails: { 'Request Type': request_type === 'sell_request' ? 'Sell My Operation' : 'New Acquisition', 'Notes': notes || 'None' }
        });
        try {
          await supabase.from('notifications').insert({ type: request_type || 'acquisition_request', title: `New ${request_type === 'sell_request' ? 'Sell' : 'Acquisition'} Request`, message: `${investorName} submitted a request for ${address || 'a property'}`, data: { investor_id, property_id, address, request_type }, created_at: new Date().toISOString() });
        } catch (e) {}
        return json({ success: true });
      }

      case 'get_all_pending_requests': {
        const results: any = { portfolio_approvals: [], acquisition_requests: [], deal_inquiries: [], support_requests: [], stats: {} };

        // 1. Portfolio approvals - try both tables
        let portfolioProps: any[] = [];
        try {
          const { data } = await supabase.from('portfolio_properties').select('*').eq('property_status', 'pending_approval').order('created_at', { ascending: false });
          if (data) portfolioProps = data;
        } catch (e) { console.log('portfolio_properties query failed, trying investor_portfolio'); }
        
        if (portfolioProps.length === 0) {
          try {
            const { data } = await supabase.from('investor_portfolio').select('*').in('property_status', ['pending_approval', 'pending']).order('created_at', { ascending: false });
            if (data) portfolioProps = data;
          } catch (e) { console.log('investor_portfolio query also failed'); }
        }

        if (portfolioProps.length > 0) {
          const investorIds = [...new Set(portfolioProps.map(p => p.investor_id))];
          let investorMap = new Map();
          if (investorIds.length > 0) {
            const { data: investors } = await supabase.from('investors').select('id, full_name, email').in('id', investorIds);
            investorMap = new Map(investors?.map(i => [i.id, i]) || []);
          }
          results.portfolio_approvals = portfolioProps.map(p => ({
            ...p, request_type: 'portfolio_approval',
            investor_name: investorMap.get(p.investor_id)?.full_name || 'Unknown',
            investor_email: investorMap.get(p.investor_id)?.email || '',
          }));
        }

        // 2. Acquisition requests
        try {
          const { data: acqRequests } = await supabase.from('acquisitions').select('*').in('status', ['pending', 'submitted', 'under_review']).order('created_at', { ascending: false }).limit(50);
          if (acqRequests && acqRequests.length > 0) {
            const investorIds = [...new Set(acqRequests.map(a => a.investor_id).filter(Boolean))];
            let investorMap = new Map();
            if (investorIds.length > 0) {
              const { data: investors } = await supabase.from('investors').select('id, full_name, email').in('id', investorIds);
              investorMap = new Map(investors?.map(i => [i.id, i]) || []);
            }
            results.acquisition_requests = acqRequests.map(a => ({
              ...a, request_type: 'acquisition_request',
              investor_name: investorMap.get(a.investor_id)?.full_name || a.investor_name || 'Unknown',
              investor_email: investorMap.get(a.investor_id)?.email || a.investor_email || '',
            }));
          }
        } catch (e) { console.log('acquisitions query skipped'); }

        // 3. Deal inquiries
        try {
          const { data: inquiries } = await supabase.from('deal_inquiries').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(50);
          if (inquiries) results.deal_inquiries = inquiries.map(i => ({ ...i, request_type: 'deal_inquiry', investor_name: i.name || i.investor_name || 'Unknown', investor_email: i.email || i.investor_email || '' }));
        } catch (e) {}

        // 4. Support requests
        try {
          const { data: supportReqs } = await supabase.from('support_requests').select('*').in('status', ['open', 'pending', 'new']).order('created_at', { ascending: false }).limit(50);
          if (supportReqs) results.support_requests = supportReqs;
        } catch (e) {}

        results.stats = {
          portfolio_pending: results.portfolio_approvals.length,
          acquisitions_pending: results.acquisition_requests.length,
          inquiries_pending: results.deal_inquiries.length,
          support_open: results.support_requests.length,
          total_pending: results.portfolio_approvals.length + results.acquisition_requests.length + results.deal_inquiries.length + results.support_requests.length
        };

        return json({ success: true, ...results });
      }

      case 'update_property_details': {
        const { property_id, updates, staff_name } = params;
        if (!property_id || !updates) return json({ error: 'Property ID and updates required' }, 400);

        const allowedFields = ['address', 'city', 'state', 'zip_code', 'bedrooms', 'bathrooms', 'monthly_rent', 'acquisition_fee', 'initial_investment', 'monthly_earnings', 'property_type', 'notes', 'square_footage', 'operation_type', 'community_name', 'community_website'];
        const safeUpdates: any = { updated_at: new Date().toISOString() };
        for (const [key, value] of Object.entries(updates)) {
          if (allowedFields.includes(key)) safeUpdates[key] = value;
        }

        // Try portfolio_properties first
        let success = false;
        try {
          const { error } = await supabase.from('portfolio_properties').update(safeUpdates).eq('id', property_id);
          if (!error) success = true;
        } catch (e) {}
        
        if (!success) {
          try {
            const { error } = await supabase.from('investor_portfolio').update(safeUpdates).eq('id', property_id);
            if (!error) success = true;
          } catch (e) {}
        }

        if (!success) return json({ success: false, error: 'Failed to update property' });

        // Add timeline entry
        try {
          const { data: prop } = await supabase.from('portfolio_properties').select('submission_timeline').eq('id', property_id).single();
          const timeline = JSON.parse(prop?.submission_timeline || '[]');
          timeline.push({ stage: 'edited', date: new Date().toISOString(), by: staff_name || 'Staff', notes: `Property details updated: ${Object.keys(updates).join(', ')}` });
          await supabase.from('portfolio_properties').update({ submission_timeline: JSON.stringify(timeline) }).eq('id', property_id);
        } catch (e) {}

        return json({ success: true });
      }

      case 'approve_property': {
        const { property_id, staff_name, admin_notes, edited_data } = params;

        // Fetch property from either table
        let property: any = null;
        let tableName = 'portfolio_properties';
        try {
          const { data } = await supabase.from('portfolio_properties').select('*').eq('id', property_id).single();
          if (data) property = data;
        } catch (e) {}
        if (!property) {
          try {
            const { data } = await supabase.from('investor_portfolio').select('*').eq('id', property_id).single();
            if (data) { property = data; tableName = 'investor_portfolio'; }
          } catch (e) {}
        }
        if (!property) return json({ success: false, error: 'Property not found' });

        const updateData: any = {
          property_status: 'active', reviewed_by: staff_name,
          reviewed_at: new Date().toISOString(), admin_notes,
          updated_at: new Date().toISOString()
        };
        if (edited_data) Object.assign(updateData, edited_data);

        // Update timeline
        try {
          const timeline = JSON.parse(property.submission_timeline || '[]');
          timeline.push({ stage: 'approved', date: new Date().toISOString(), by: staff_name || 'Staff', notes: admin_notes || 'Property approved' });
          updateData.submission_timeline = JSON.stringify(timeline);
        } catch (e) {}

        const { error: updateError } = await supabase.from(tableName).update(updateData).eq('id', property_id);
        if (updateError) throw updateError;

        // Get investor info for email
        const { data: investor } = await supabase.from('investors').select('full_name, email').eq('id', property.investor_id).single();

        // Send investor confirmation email
        if (investor?.email) {
          await sendInvestorConfirmation(supabase, {
            investorId: property.investor_id, investorEmail: investor.email,
            investorName: investor.full_name || 'Investor',
            propertyAddress: property.address, propertyCity: property.city, propertyState: property.state,
            status: 'approved', staffNotes: admin_notes,
          });
        }

        // Create notification
        try {
          await supabase.from('notifications').insert({
            investor_id: property.investor_id, type: 'portfolio_approved',
            title: 'Property Approved', message: `Your property at ${property.address} has been approved.`, read: false
          });
        } catch (e) {}

        // Handle credits if needed
        if (!property.documents_complete && property.acquisition_fee > 0) {
          try {
            await supabase.from('investor_credits').insert({
              investor_id: property.investor_id, amount: property.acquisition_fee,
              credit_type: 'acquisition_fee',
              source_description: `Acquisition fee credit for ${property.address}`,
              related_property_id: property_id, credit_status: 'active',
              expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), created_by: 'system'
            });
          } catch (e) { console.error('Credit creation failed:', e); }
        }

        return json({ success: true, email_sent: !!investor?.email });
      }

      case 'reject_property': {
        const { property_id, staff_name, admin_notes, rejection_reason } = params;

        let property: any = null;
        let tableName = 'portfolio_properties';
        try {
          const { data } = await supabase.from('portfolio_properties').select('*').eq('id', property_id).single();
          if (data) property = data;
        } catch (e) {}
        if (!property) {
          try {
            const { data } = await supabase.from('investor_portfolio').select('*').eq('id', property_id).single();
            if (data) { property = data; tableName = 'investor_portfolio'; }
          } catch (e) {}
        }
        if (!property) return json({ success: false, error: 'Property not found' });

        const updateData: any = {
          property_status: 'rejected', reviewed_by: staff_name,
          reviewed_at: new Date().toISOString(), admin_notes: admin_notes || rejection_reason,
          updated_at: new Date().toISOString()
        };

        try {
          const timeline = JSON.parse(property.submission_timeline || '[]');
          timeline.push({ stage: 'rejected', date: new Date().toISOString(), by: staff_name || 'Staff', notes: rejection_reason || admin_notes || 'Property rejected' });
          updateData.submission_timeline = JSON.stringify(timeline);
        } catch (e) {}

        const { error } = await supabase.from(tableName).update(updateData).eq('id', property_id);
        if (error) throw error;

        // Send investor rejection email
        const { data: investor } = await supabase.from('investors').select('full_name, email').eq('id', property.investor_id).single();
        if (investor?.email) {
          await sendInvestorConfirmation(supabase, {
            investorId: property.investor_id, investorEmail: investor.email,
            investorName: investor.full_name || 'Investor',
            propertyAddress: property.address, propertyCity: property.city, propertyState: property.state,
            status: 'rejected', staffNotes: rejection_reason || admin_notes,
          });
        }

        try {
          await supabase.from('notifications').insert({
            investor_id: property.investor_id, type: 'portfolio_rejected',
            title: 'Property Submission Update',
            message: `Your property at ${property.address} requires changes. Reason: ${rejection_reason || admin_notes}`, read: false
          });
        } catch (e) {}

        return json({ success: true, email_sent: !!investor?.email });
      }

      case 'update_document_status': {
        const { property_id, has_lease_documents, has_corporate_sublease, lease_type } = params;
        const documents_complete = has_lease_documents || has_corporate_sublease;
        const { error } = await supabase.from('portfolio_properties').update({
          has_lease_documents, has_corporate_sublease, lease_type, documents_complete, updated_at: new Date().toISOString()
        }).eq('id', property_id);
        if (error) throw error;
        return json({ success: true });
      }

      case 'search_existing_deals': {
        const { address, city, state } = params;
        let query = supabase.from('properties').select('id, address, city, state, bedrooms, bathrooms, monthly_rent').limit(10);
        if (address) query = query.ilike('address', `%${address}%`);
        if (city) query = query.ilike('city', `%${city}%`);
        if (state) query = query.ilike('state', `%${state}%`);
        const { data: deals, error } = await query;
        if (error) throw error;
        return json({ success: true, deals });
      }

      case 'get_stats': {
        let allProperties: any[] = [];
        try {
          const { data } = await supabase.from('portfolio_properties').select('property_status, documents_complete, published_to_dealflow');
          if (data) allProperties = data;
        } catch (e) {}
        const stats = {
          pending_approval: allProperties.filter(p => p.property_status === 'pending_approval').length,
          approved: allProperties.filter(p => p.property_status === 'active').length,
          rejected: allProperties.filter(p => p.property_status === 'rejected').length,
          documents_pending: allProperties.filter(p => p.property_status === 'active' && !p.documents_complete).length,
        };
        return json({ success: true, stats });
      }

      case 'get_property_timeline': {
        const { property_id } = params;
        let timeline: any[] = [];
        try {
          const { data } = await supabase.from('portfolio_properties').select('submission_timeline, property_status, created_at, reviewed_at, reviewed_by').eq('id', property_id).single();
          if (data?.submission_timeline) {
            timeline = JSON.parse(data.submission_timeline);
          } else if (data) {
            timeline = [{ stage: 'submitted', date: data.created_at, by: 'Investor', notes: 'Property submitted' }];
            if (data.reviewed_at) {
              timeline.push({ stage: data.property_status === 'active' ? 'approved' : data.property_status === 'rejected' ? 'rejected' : 'review', date: data.reviewed_at, by: data.reviewed_by || 'Staff' });
            }
          }
        } catch (e) {}
        return json({ success: true, timeline });
      }

      default:
        return json({ error: `Invalid action: ${action}` }, 400);
    }
  } catch (error: any) {
    console.error('manage-portfolio-approvals error:', error);
    return json({ error: error.message }, 200);
  }
});
