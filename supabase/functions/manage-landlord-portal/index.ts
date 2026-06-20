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

// Direct REST helper - bypasses Supabase JS client auth header bug
async function db(supabaseUrl: string, apiKey: string, table: string, opts: {
  method?: string; select?: string; filters?: string; order?: string;
  body?: any; single?: boolean; limit?: number;
} = {}): Promise<{ data: any; error: any }> {
  const { method = 'GET', select = '*', filters = '', order = '', body, single = false, limit } = opts;
  let url = `${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
  if (filters) url += `&${filters}`;
  if (order) url += `&order=${order}`;
  if (limit) url += `&limit=${limit}`;
  const headers: Record<string, string> = {
    'apikey': apiKey, 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json',
  };
  if (method === 'POST' || method === 'PATCH') headers['Prefer'] = 'return=representation';
  if (method === 'DELETE') headers['Prefer'] = 'return=representation';
  if (single) headers['Accept'] = 'application/vnd.pgrst.object+json';
  const fetchOpts: RequestInit = { method, headers };
  if (body && (method === 'POST' || method === 'PATCH')) fetchOpts.body = JSON.stringify(body);
  try {
    const r = await fetch(url, fetchOpts);
    if (!r.ok) { const t = await r.text(); let e; try { e = JSON.parse(t); } catch { e = { message: t }; } return { data: null, error: { message: e.message || t, code: r.status } }; }
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('json')) return { data: await r.json(), error: null };
    return { data: null, error: null };
  } catch (err) { return { data: null, error: { message: err.message } }; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const apiKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const { action, ...params } = await req.json();
    console.log('[Landlord Portal v5.0] Action:', action);

    const STAGE_ORDER = ['received','under_review','approved','denied','lease_generated','lease_signed'];
    function getStageCol(stage: string) { return `stage_${stage}_at`; }
    function stageEntry(stage: string, actor?: string) { return { stage, timestamp: new Date().toISOString(), actor: actor || 'system' }; }

    // ============ APPLICATIONS ============
    if (action === 'get_applications') {
      const { landlord_id, status } = params;
      let filters = '';
      if (landlord_id) filters += `landlord_id=eq.${landlord_id}&`;
      if (status) filters += `status=eq.${status}&`;
      const { data, error } = await db(supabaseUrl, apiKey, 'corporate_applications', { filters, order: 'created_at.desc' });
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ applications: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'submit_application') {
      const { landlord_id, client_name, client_business_name, community_name, unit_number, property_name, pdf_url, pdf_filename, submitted_by, submitted_by_id, landlord_property_id } = params;
      const now = new Date().toISOString();
      const { data, error } = await db(supabaseUrl, apiKey, 'corporate_applications', {
        method: 'POST', single: true,
        body: { landlord_id, client_name, client_business_name, community_name, unit_number, property_name, pdf_url, pdf_filename, submitted_by, submitted_by_id, landlord_property_id, status: 'received', current_stage: 'received', stage_received_at: now, stage_history: [stageEntry('received', submitted_by || 'system')] }
      });
      if (error) throw new Error(error.message);
      // Send email notification to landlord
      if (data?.landlord_id) {
        const { data: landlord } = await db(supabaseUrl, apiKey, 'landlord_contacts', { select: 'email,name,company_name', filters: `id=eq.${data.landlord_id}`, single: true });
        if (landlord?.email) {
          const resendKey = Deno.env.get('RESEND_API_KEY');
          if (resendKey) {
            try {
              await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ from: 'Access Your Place <notifications@accessyourplace.com>', to: [landlord.email], subject: `[Action Required] Corporate Leasing Update - ${community_name || property_name || 'New Application'}`,
                  html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><div style="background:#1a2332;padding:24px;text-align:center;"><h1 style="color:#d4a574;margin:0;">Access Your Place</h1></div><div style="padding:32px;background:#f9fafb;"><h2 style="color:#1a2332;">New Corporate Application</h2><p>Hello ${landlord.name},</p><p>A new corporate application has been submitted for your review:</p><div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;"><p><strong>Client:</strong> ${client_name}</p>${client_business_name ? `<p><strong>Business:</strong> ${client_business_name}</p>` : ''}${community_name ? `<p><strong>Community:</strong> ${community_name}</p>` : ''}${unit_number ? `<p><strong>Unit:</strong> ${unit_number}</p>` : ''}</div><a href="https://accessyourplace.com/landlord/portal" style="display:inline-block;background:#d4a574;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px;">Click here to access the Landlord Portal</a></div></div>` })
              });
            } catch (e) { console.error('Email error:', e); }
          }
        }
      }
      return new Response(JSON.stringify({ success: true, application: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'advance_application_stage') {
      const { application_id, new_stage, actor_name, notes, denial_reason } = params;
      if (!application_id || !new_stage) return new Response(JSON.stringify({ error: 'application_id and new_stage required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data: currentApp, error: fetchErr } = await db(supabaseUrl, apiKey, 'corporate_applications', { filters: `id=eq.${application_id}`, single: true });
      if (fetchErr) throw new Error(fetchErr.message);
      if (!currentApp) throw new Error('Application not found');
      const now = new Date().toISOString();
      const history = Array.isArray(currentApp.stage_history) ? [...currentApp.stage_history] : [];
      history.push(stageEntry(new_stage, actor_name || 'system'));
      const stageToStatus: Record<string, string> = { 'received': 'received', 'under_review': 'pending', 'approved': 'approved', 'denied': 'rejected', 'lease_generated': 'approved', 'lease_signed': 'approved' };
      const updates: any = { current_stage: new_stage, [getStageCol(new_stage)]: now, stage_history: history, status: stageToStatus[new_stage] || currentApp.status, updated_at: now };
      if (notes) updates.status_notes = notes;
      if (denial_reason && new_stage === 'denied') updates.denial_reason = denial_reason;
      if (new_stage === 'approved' || new_stage === 'denied') updates.reviewed_at = now;
      const { data, error } = await db(supabaseUrl, apiKey, 'corporate_applications', { method: 'PATCH', filters: `id=eq.${application_id}`, body: updates, single: true });
      if (error) throw new Error(error.message);
      if (currentApp.landlord_id) {
        const stageLabels: Record<string, string> = { 'received': 'Application Received', 'under_review': 'Under Review', 'approved': 'Approved', 'denied': 'Denied', 'lease_generated': 'Lease Generated', 'lease_signed': 'Lease Signed' };
        await db(supabaseUrl, apiKey, 'landlord_messages', { method: 'POST', body: { landlord_id: currentApp.landlord_id, application_id, sender_type: 'staff', sender_name: actor_name || 'System', message: `Application for ${currentApp.client_name} updated to: ${stageLabels[new_stage] || new_stage}${notes ? '. Note: ' + notes : ''}` } });
      }
      return new Response(JSON.stringify({ success: true, application: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_application_stages') {
      const { application_id } = params;
      if (!application_id) return new Response(JSON.stringify({ error: 'application_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data, error } = await db(supabaseUrl, apiKey, 'corporate_applications', { select: 'id,current_stage,stage_received_at,stage_under_review_at,stage_approved_at,stage_denied_at,stage_lease_generated_at,stage_lease_signed_at,stage_history,denial_reason,status_notes', filters: `id=eq.${application_id}`, single: true });
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ success: true, stages: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'update_application_status') {
      const { application_id, status, status_notes, lease_url, lease_filename, actor_name } = params;
      const { data: currentApp } = await db(supabaseUrl, apiKey, 'corporate_applications', { filters: `id=eq.${application_id}`, single: true });
      const now = new Date().toISOString();
      const updates: any = { status, updated_at: now };
      if (status_notes) updates.status_notes = status_notes;
      if (lease_url) updates.lease_url = lease_url;
      if (lease_filename) updates.lease_filename = lease_filename;
      if (status === 'approved' || status === 'rejected') updates.reviewed_at = now;
      const statusToStage: Record<string, string> = { 'received': 'received', 'pending': 'under_review', 'approved': 'approved', 'info_needed': 'under_review', 'rejected': 'denied' };
      const newStage = statusToStage[status] || 'received';
      updates.current_stage = newStage;
      updates[getStageCol(newStage)] = now;
      if (currentApp) { const h = Array.isArray(currentApp.stage_history) ? [...currentApp.stage_history] : []; h.push(stageEntry(newStage, actor_name || 'landlord')); updates.stage_history = h; }
      const { data, error } = await db(supabaseUrl, apiKey, 'corporate_applications', { method: 'PATCH', filters: `id=eq.${application_id}`, body: updates, single: true });
      if (error) throw new Error(error.message);
      if (data?.submitted_by_id) {
        await db(supabaseUrl, apiKey, 'landlord_messages', { method: 'POST', body: { landlord_id: data.landlord_id, application_id, sender_type: 'landlord', sender_name: 'System', message: `Application status updated to "${status}" for ${data.client_name}${status_notes ? '. Note: ' + status_notes : ''}` } });
      }
      return new Response(JSON.stringify({ success: true, application: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============ PROPERTIES ============
    if (action === 'get_landlord_properties') {
      const { landlord_id } = params;
      let filters = '';
      if (landlord_id) filters = `landlord_id=eq.${landlord_id}`;
      const { data, error } = await db(supabaseUrl, apiKey, 'landlord_properties', { filters, order: 'created_at.desc' });
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ properties: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_landlord_properties_for_review') {
      const filterStatus = params.status_filter || 'pending_analysis';
      const { data, error } = await db(supabaseUrl, apiKey, 'landlord_properties', { select: 'id,address,city,state,submission_status,created_at', filters: `submission_status=eq.${filterStatus}`, order: 'created_at.desc' });
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ properties: data || [], total: (data || []).length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'submit_property') {
      const { landlord_id, address, city, state, zip_code, unit_count, community_name, community_website, photos, videos, submission_notes } = params;
      const { data, error } = await db(supabaseUrl, apiKey, 'landlord_properties', { method: 'POST', single: true, body: { landlord_id, address, city, state, zip_code, unit_count: unit_count || 1, community_name, community_website, photos: photos || [], videos: videos || [], submission_notes, submission_status: 'pending_analysis', application_handling: 'ayp_team' } });
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ success: true, property: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'review_property') {
      const { property_id, submission_status, rejection_reason, reviewed_by } = params;
      const updates: any = { submission_status, reviewed_by, reviewed_at: new Date().toISOString() };
      if (rejection_reason) updates.rejection_reason = rejection_reason;
      const { data, error } = await db(supabaseUrl, apiKey, 'landlord_properties', { method: 'PATCH', filters: `id=eq.${property_id}`, body: updates, single: true });
      if (error) throw new Error(error.message);
      if (data?.landlord_id) {
        const msg = submission_status === 'approved' ? 'Your property has been approved!' : `Property not approved. Reason: ${rejection_reason || 'Does not meet criteria.'}`;
        await db(supabaseUrl, apiKey, 'landlord_messages', { method: 'POST', body: { landlord_id: data.landlord_id, sender_type: 'staff', sender_name: reviewed_by || 'System', message: msg } });
      }
      return new Response(JSON.stringify({ success: true, property: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'update_property_application_handling') {
      const { property_id, landlord_id, application_handling, corporate_app_requirements_note } = params;
      if (!property_id) return new Response(JSON.stringify({ error: 'property_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const updates: any = { application_handling: application_handling || 'ayp_team', updated_at: new Date().toISOString() };
      if (application_handling === 'ayp_team') { updates.corporate_app_pdf_url = null; updates.corporate_app_pdf_filename = null; updates.corporate_app_requirements_note = null; }
      if (application_handling === 'landlord_handles' && corporate_app_requirements_note !== undefined) updates.corporate_app_requirements_note = corporate_app_requirements_note;
      let filters = `id=eq.${property_id}`;
      if (landlord_id) filters += `&landlord_id=eq.${landlord_id}`;
      const { data, error } = await db(supabaseUrl, apiKey, 'landlord_properties', { method: 'PATCH', filters, body: updates, single: true });
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ success: true, property: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'save_corporate_app_pdf') {
      const { property_id, landlord_id, pdf_url, pdf_filename } = params;
      if (!property_id || !pdf_url) return new Response(JSON.stringify({ error: 'property_id and pdf_url required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      let filters = `id=eq.${property_id}`;
      if (landlord_id) filters += `&landlord_id=eq.${landlord_id}`;
      const { data, error } = await db(supabaseUrl, apiKey, 'landlord_properties', { method: 'PATCH', filters, body: { corporate_app_pdf_url: pdf_url, corporate_app_pdf_filename: pdf_filename || 'corporate_application.pdf', updated_at: new Date().toISOString() }, single: true });
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ success: true, property: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'remove_corporate_app_pdf') {
      const { property_id, landlord_id } = params;
      if (!property_id) return new Response(JSON.stringify({ error: 'property_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      let filters = `id=eq.${property_id}`;
      if (landlord_id) filters += `&landlord_id=eq.${landlord_id}`;
      const { data, error } = await db(supabaseUrl, apiKey, 'landlord_properties', { method: 'PATCH', filters, body: { corporate_app_pdf_url: null, corporate_app_pdf_filename: null, updated_at: new Date().toISOString() }, single: true });
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ success: true, property: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============ DOCUMENTS ============
    if (action === 'get_documents') {
      const { landlord_id, document_type } = params;
      let filters = '';
      if (landlord_id) filters += `landlord_id=eq.${landlord_id}&`;
      if (document_type) filters += `document_type=eq.${document_type}&`;
      const { data, error } = await db(supabaseUrl, apiKey, 'landlord_documents', { filters, order: 'created_at.desc' });
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ documents: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'upload_document') {
      const { landlord_id, landlord_property_id, document_type, title, description, file_url, file_name, file_size, uploaded_by } = params;
      const { data, error } = await db(supabaseUrl, apiKey, 'landlord_documents', { method: 'POST', single: true, body: { landlord_id, landlord_property_id, document_type: document_type || 'general', title, description, file_url, file_name, file_size, uploaded_by: uploaded_by || 'landlord' } });
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ success: true, document: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'delete_document') {
      const { document_id } = params;
      const { error } = await db(supabaseUrl, apiKey, 'landlord_documents', { method: 'DELETE', filters: `id=eq.${document_id}` });
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============ MESSAGES ============
    if (action === 'get_messages') {
      const { landlord_id, application_id } = params;
      let filters = '';
      if (landlord_id) filters += `landlord_id=eq.${landlord_id}&`;
      if (application_id) filters += `application_id=eq.${application_id}&`;
      const { data, error } = await db(supabaseUrl, apiKey, 'landlord_messages', { filters, order: 'created_at.asc' });
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ messages: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'send_message') {
      const { landlord_id, application_id, sender_type, sender_name, sender_id, message } = params;
      const { data, error } = await db(supabaseUrl, apiKey, 'landlord_messages', { method: 'POST', single: true, body: { landlord_id, application_id, sender_type, sender_name, sender_id, message } });
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ success: true, message: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'mark_messages_read') {
      const { landlord_id, reader_type } = params;
      const oppositeType = reader_type === 'landlord' ? 'staff' : 'landlord';
      await db(supabaseUrl, apiKey, 'landlord_messages', { method: 'PATCH', filters: `landlord_id=eq.${landlord_id}&sender_type=eq.${oppositeType}&is_read=eq.false`, body: { is_read: true } });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============ STAFF: LANDLORD MANAGEMENT ============
    if (action === 'get_unassigned_landlords') {
      const { data, error } = await db(supabaseUrl, apiKey, 'landlord_contacts', { filters: 'portal_enabled=eq.true&assigned_am_id=is.null', order: 'created_at.desc' });
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ landlords: data || [], total: (data || []).length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'assign_landlord') {
      const { landlord_id, am_id, am_name } = params;
      const { data, error } = await db(supabaseUrl, apiKey, 'landlord_contacts', { method: 'PATCH', filters: `id=eq.${landlord_id}`, body: { assigned_am_id: am_id, assigned_am_name: am_name, discovery_call_completed: true, discovery_call_date: new Date().toISOString(), status: 'verified' }, single: true });
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ success: true, landlord: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_all_portal_landlords') {
      const { data, error } = await db(supabaseUrl, apiKey, 'landlord_contacts', { filters: 'portal_enabled=eq.true', order: 'created_at.desc' });
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ landlords: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'send_bulk_notification') {
      const { landlord_ids, message, sender_name, sender_id } = params;
      for (const lid of (landlord_ids || [])) {
        await db(supabaseUrl, apiKey, 'landlord_messages', { method: 'POST', body: { landlord_id: lid, sender_type: 'staff', sender_name, sender_id, message } });
      }
      return new Response(JSON.stringify({ success: true, count: (landlord_ids || []).length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'update_profile') {
      const { landlord_id, contact_name, company_name, phone, location, account_type } = params;
      const updates: any = { updated_at: new Date().toISOString() };
      if (contact_name) updates.name = contact_name;
      if (company_name !== undefined) updates.company_name = company_name;
      if (phone !== undefined) updates.phone = phone;
      if (location !== undefined) updates.location = location;
      if (account_type) updates.account_type = account_type;
      const { data, error } = await db(supabaseUrl, apiKey, 'landlord_contacts', { method: 'PATCH', filters: `id=eq.${landlord_id}`, body: updates, single: true });
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ success: true, landlord: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action: ' + action }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[Landlord Portal v5.0] Error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

