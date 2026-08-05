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

const PHASE_NAMES = {1:'Acquisition & Initial Payment',2:'Consultation & Pre-Intake',3:'Intake Form & Service Agreement',4:'Logistics & Team Activation',5:'Product Sourcing & Spreadsheet',6:'Purchasing & Travel Logistics',7:'On-Site Setup & Live Tracking',8:'Cleanup, Media & Final Handover'};

const DEFAULT_INTAKE_FIELDS = [
  {id:'property_access',label:'Property Access Details',type:'textarea',required:true,placeholder:'How can the setup team access the property? (gate codes, key location, etc.)'},
  {id:'key_lockbox',label:'Key / Lockbox Information',type:'textarea',required:true,placeholder:'Lockbox code, key location, or smart lock details'},
  {id:'wifi_provider',label:'Wi-Fi Provider Preference',type:'select',required:false,options:['No Preference','AT&T','Comcast/Xfinity','Spectrum','Verizon Fios','T-Mobile Home Internet','Google Fiber','Other'],placeholder:'Select preferred Wi-Fi provider'},
  {id:'wifi_notes',label:'Wi-Fi Additional Notes',type:'textarea',required:false,placeholder:'Any specific internet requirements or existing service details'},
  {id:'design_style',label:'Design Style Preference',type:'select',required:true,options:['Modern Minimalist','Coastal / Beach','Mid-Century Modern','Bohemian','Industrial','Farmhouse / Rustic','Scandinavian','Luxury / Glam','Eclectic','No Preference - Trust the Team'],placeholder:'Select your preferred design style'},
  {id:'color_preferences',label:'Color Preferences',type:'textarea',required:false,placeholder:'Any color preferences or colors to avoid?'},
  {id:'budget_range',label:'Furniture Budget Range',type:'select',required:true,options:['Under $3,000','$3,000 - $5,000','$5,000 - $8,000','$8,000 - $12,000','$12,000 - $15,000','$15,000+','Flexible - Best Value'],placeholder:'Select your budget range'},
  {id:'budget_notes',label:'Budget Notes',type:'textarea',required:false,placeholder:'Any specific budget constraints or priorities?'},
  {id:'utility_electric',label:'Electric Utility Account Number',type:'text',required:false,placeholder:'Account number (if applicable)'},
  {id:'utility_gas',label:'Gas Utility Account Number',type:'text',required:false,placeholder:'Account number (if applicable)'},
  {id:'utility_water',label:'Water Utility Account Number',type:'text',required:false,placeholder:'Account number (if applicable)'},
  {id:'special_instructions',label:'Special Instructions',type:'textarea',required:false,placeholder:'Any special requirements, HOA rules, parking instructions, or other important details'},
  {id:'existing_items',label:'Existing Items to Keep',type:'textarea',required:false,placeholder:'List any existing furniture or items that should stay in the property'},
  {id:'guest_profile',label:'Target Guest Profile',type:'select',required:false,options:['Business Travelers','Families','Couples / Romantic Getaway','Digital Nomads','Medical Stays','Mixed / General','Other'],placeholder:'Who are your target guests?'},
  {id:'move_in_date',label:'Desired Move-In / Go-Live Date',type:'date',required:false,placeholder:'When do you want the property ready?'}
];

function getNextFriday(){const t=new Date(),d=t.getDay(),u=(5-d+7)%7||7,n=new Date(t);n.setDate(t.getDate()+u);return n.toISOString().split('T')[0]}
function addLog(e,a,s){const l=Array.isArray(e)?[...e]:[];l.push({action:a,by:s||'System',at:new Date().toISOString()});return l}
function addPhase(e,f,t,s){const h=Array.isArray(e)?[...e]:[];h.push({from:f,to:t,by:s||'System',at:new Date().toISOString()});return h}
function genToken(){const c='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';let t='';for(let i=0;i<32;i++)t+=c.charAt(Math.floor(Math.random()*c.length));return t}

function buildDFYEmailHTML(v){const as=v.admin_fee_paid?'Paid':'Pending Payment',aa=v.admin_fee_amount||2500,cn=v.client_name||'there',np=v.num_properties||1,nb=v.num_beds||'[beds]',nba=v.num_baths||'[baths]',pt=v.property_type||'apartment',cs=v.city_state||'[City, State]',sd=v.target_start_date||'[Date TBD]',mn=v.manager_name||'Your Setup Manager',il=v.intake_form_link||'https://accessyourplace.com/portal';return`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'Segoe UI',sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f8f9fa}.container{max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}.header{background:linear-gradient(135deg,#1a365d,#2d4a7a);padding:32px 40px;text-align:center}.header h1{color:#fff;font-size:22px;margin:0 0 4px}.header p{color:#d4a574;font-size:14px;margin:0}.body{padding:36px 40px}.recap-box{background:#f0f4f8;border-left:4px solid #d4a574;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0}.fee-list{list-style:none;padding:0;margin:20px 0}.fee-list li{padding:10px 16px;margin:6px 0;background:#fafafa;border-radius:8px;border:1px solid #e8e8e8;display:flex;justify-content:space-between;align-items:center}.process-list{padding-left:0;list-style:none;counter-reset:step}.process-list li{padding:12px 16px 12px 52px;margin:8px 0;background:#fafafa;border-radius:8px;position:relative;font-size:14px;line-height:1.5;border:1px solid #f0f0f0}.process-list li::before{counter-increment:step;content:counter(step);position:absolute;left:16px;top:12px;width:24px;height:24px;background:#d4a574;color:#fff;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700}.cta-button{display:inline-block;background:linear-gradient(135deg,#d4a574,#c49464);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;margin:20px 0}.payment-info{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px 20px;margin:20px 0;font-size:14px}.signature{margin-top:32px;padding-top:20px;border-top:1px solid #e8e8e8}.footer{background:#f8f9fa;padding:20px 40px;text-align:center;font-size:12px;color:#999}</style></head><body><div class="container"><div class="header"><h1>Property Setup Recap</h1><p>Done For You (DFY) Package</p></div><div class="body"><p>Hi ${cn},</p><p>Just to recap:</p><div class="recap-box">You would like <strong>${np}</strong> (${nb} bed, ${nba} bath) <strong>${pt}</strong> set up in <strong>${cs}</strong> for a start date of <strong>${sd}</strong>.</div><ul class="fee-list"><li><span>Administration Team (${as})</span><span style="font-weight:700;color:#1a365d">$${Number(aa).toLocaleString()}</span></li><li><span>On-the-Ground Setup Team and logistics</span><span style="font-weight:700;color:#1a365d">$3,350</span></li><li><span>Furniture Package Fee</span><span style="font-size:13px;color:#666">Based on selections</span></li></ul><h3 style="color:#1a365d;border-bottom:2px solid #d4a574;padding-bottom:6px">Here's how our process works:</h3><ol class="process-list"><li>Please fill out the intake form: <a href="${il}" style="color:#d4a574;font-weight:600">Intake Form</a></li><li>We'll send over a service agreement + setup/logistics fee.</li><li>Product sourcing (24-48 hrs) with detailed spreadsheet.</li><li>Our team handles setup, Wi-Fi, photos, cleanup (7-14 days).</li></ol><div style="text-align:center"><a href="${il}" class="cta-button">Fill Out Intake Form</a></div><div class="payment-info"><strong>Payment:</strong> Zelle to <strong>admin@cooperfamilyinc.net</strong>. Visit <a href="https://accessyourplace.com" style="color:#d4a574">accessyourplace.com</a>.</div><div class="signature"><p>Best,</p><p style="font-weight:600;color:#1a365d">${mn}</p><p style="color:#666;font-size:13px">Setup Manager | Access Your Place</p></div></div><div class="footer"><p>Access Your Place ${new Date().getFullYear()}</p></div></div></body></html>`}

function buildDIYEmailHTML(v){const as=v.admin_fee_paid?'Paid':'Pending Payment',aa=v.admin_fee_amount||2500,cn=v.client_name||'there',np=v.num_properties||1,nb=v.num_beds||'[beds]',nba=v.num_baths||'[baths]',pt=v.property_type||'apartment',cs=v.city_state||'[City, State]',sd=v.target_start_date||'[Date TBD]',mn=v.manager_name||'Your Setup Manager',il=v.intake_form_link||'https://accessyourplace.com/portal';return`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'Segoe UI',sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f8f9fa}.container{max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}.header{background:linear-gradient(135deg,#1a365d,#2d4a7a);padding:32px 40px;text-align:center}.header h1{color:#fff;font-size:22px;margin:0 0 4px}.header p{color:#93c5fd;font-size:14px;margin:0}.body{padding:36px 40px}.recap-box{background:#f0f4f8;border-left:4px solid #3b82f6;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0}.fee-list{list-style:none;padding:0;margin:20px 0}.fee-list li{padding:10px 16px;margin:6px 0;background:#fafafa;border-radius:8px;border:1px solid #e8e8e8;display:flex;justify-content:space-between;align-items:center}.process-list{padding-left:0;list-style:none;counter-reset:step}.process-list li{padding:12px 16px 12px 52px;margin:8px 0;background:#fafafa;border-radius:8px;position:relative;font-size:14px;line-height:1.5;border:1px solid #f0f0f0}.process-list li::before{counter-increment:step;content:counter(step);position:absolute;left:16px;top:12px;width:24px;height:24px;background:#3b82f6;color:#fff;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700}.cta-button{display:inline-block;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;margin:20px 0}.diy-note{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin:20px 0;font-size:14px;color:#1e40af}.payment-info{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px 20px;margin:20px 0;font-size:14px}.signature{margin-top:32px;padding-top:20px;border-top:1px solid #e8e8e8}.footer{background:#f8f9fa;padding:20px 40px;text-align:center;font-size:12px;color:#999}</style></head><body><div class="container"><div class="header"><h1>Property Setup Recap</h1><p>Do It Yourself (DIY) Package</p></div><div class="body"><p>Hi ${cn},</p><p>Just to recap:</p><div class="recap-box">You would like <strong>${np}</strong> (${nb} bed, ${nba} bath) <strong>${pt}</strong> set up in <strong>${cs}</strong> for a start date of <strong>${sd}</strong>.</div><ul class="fee-list"><li><span>Administration Team (${as})</span><span style="font-weight:700;color:#1a365d">$${Number(aa).toLocaleString()}</span></li><li><span>Furniture Package Fee</span><span style="font-size:13px;color:#666">Based on selections</span></li></ul><h3 style="color:#1a365d;border-bottom:2px solid #3b82f6;padding-bottom:6px">Here's how our process works:</h3><ol class="process-list"><li>Fill out the intake form: <a href="${il}" style="color:#3b82f6;font-weight:600">Intake Form</a></li><li>We'll send over a service agreement.</li><li>Product sourcing (24-48 hrs) with detailed spreadsheet.</li><li>Your team handles setup, Wi-Fi, photos, cleanup (7-14 days).</li></ol><div class="diy-note"><strong>DIY Note:</strong> You'll coordinate your own on-site team.</div><div style="text-align:center"><a href="${il}" class="cta-button">Fill Out Intake Form</a></div><div class="payment-info"><strong>Payment:</strong> Zelle to <strong>admin@cooperfamilyinc.net</strong>. Visit <a href="https://accessyourplace.com" style="color:#3b82f6">accessyourplace.com</a>.</div><div class="signature"><p>Best,</p><p style="font-weight:600;color:#1a365d">${mn}</p><p style="color:#666;font-size:13px">Setup Manager | Access Your Place</p></div></div><div class="footer"><p>Access Your Place ${new Date().getFullYear()}</p></div></div></body></html>`}

function buildDFYPlainText(v){const as=v.admin_fee_paid?'Paid':'Pending Payment';return`Hi ${v.client_name||'there'},\n\nJust to recap:\n\nYou would like ${v.num_properties||1} (${v.num_beds||'[beds]'} bed, ${v.num_baths||'[baths]'} bath) ${v.property_type||'apartment'} set up in ${v.city_state||'[City, State]'} for a start date of ${v.target_start_date||'[Date TBD]'}.\n\n* Administration Team (${as}): $${Number(v.admin_fee_amount||2500).toLocaleString()}\n* On-the-Ground Setup Team: $3,350\n* Furniture Package Fee: Based on selections\n\nBest,\n${v.manager_name||'Your Setup Manager'}`}
function buildDIYPlainText(v){const as=v.admin_fee_paid?'Paid':'Pending Payment';return`Hi ${v.client_name||'there'},\n\nJust to recap:\n\nYou would like ${v.num_properties||1} (${v.num_beds||'[beds]'} bed, ${v.num_baths||'[baths]'} bath) ${v.property_type||'apartment'} set up in ${v.city_state||'[City, State]'} for a start date of ${v.target_start_date||'[Date TBD]'}.\n\n* Administration Team (${as}): $${Number(v.admin_fee_amount||2500).toLocaleString()}\n* Furniture Package Fee: Based on selections\n\nBest,\n${v.manager_name||'Your Setup Manager'}`}

async function notifyManager(supabase, managerId, subject, html) {
  try {
    const rk = Deno.env.get('RESEND_API_KEY');
    const { data: mgr } = await supabase.from('staff_users').select('email').eq('id', managerId).single();
    if (mgr?.email && rk) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${rk}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'Setup Notifications <setup@rentalnarbitrage.com>', to: [mgr.email], subject, html })
      });
    }
  } catch (e) { console.error('Notify manager error:', e); }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const body = await req.json();
    const { action, ...params } = body;
    const ok = (d) => new Response(JSON.stringify(d), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    // â”€â”€â”€ LIST PROJECTS â”€â”€â”€
    if (action === 'list_projects') {
      let q = supabase.from('setup_projects').select('*').order('created_at', { ascending: false });
      if (params.assigned_manager_id) q = q.eq('assigned_manager_id', params.assigned_manager_id);
      if (params.phase) q = q.eq('phase', params.phase);
      if (params.status) q = q.eq('status', params.status);
      if (params.package_type) q = q.eq('package_type', params.package_type);
      const { data, error } = await q;
      if (error) throw error;
      return ok({ success: true, projects: data || [] });
    }

    if (action === 'get_project') {
      const { data, error } = await supabase.from('setup_projects').select('*').eq('id', params.project_id).single();
      if (error) throw error;
      return ok({ success: true, project: data });
    }

    if (action === 'get_investor_projects') {
      if (!params.investor_id) throw new Error('investor_id required');
      const { data, error } = await supabase.from('setup_projects').select('*').eq('investor_id', params.investor_id).order('created_at', { ascending: false });
      if (error) throw error;
      return ok({ success: true, projects: data || [] });
    }

    if (action === 'get_intake_fields') {
      const { data: project, error } = await supabase.from('setup_projects').select('intake_form_fields,intake_form_submitted,intake_form_data,property_address,investor_name,package_type,phase').eq('id', params.project_id).single();
      if (error) throw error;
      const fields = project?.intake_form_fields?.length > 0 ? project.intake_form_fields : DEFAULT_INTAKE_FIELDS;
      return ok({ success: true, fields, project: { intake_form_submitted: project.intake_form_submitted, intake_form_data: project.intake_form_data, property_address: project.property_address, investor_name: project.investor_name, package_type: project.package_type, phase: project.phase } });
    }

    if (action === 'configure_intake_fields') {
      const { data: cur } = await supabase.from('setup_projects').select('activity_log').eq('id', params.project_id).single();
      const { data, error } = await supabase.from('setup_projects').update({ intake_form_fields: params.fields, updated_at: new Date().toISOString(), activity_log: addLog(cur?.activity_log, `Intake form fields configured (${params.fields.length} fields)`, params.staff_name) }).eq('id', params.project_id).select().single();
      if (error) throw error;
      return ok({ success: true, project: data });
    }

    if (action === 'submit_intake_form') {
      const { data: project } = await supabase.from('setup_projects').select('*').eq('id', params.project_id).single();
      if (!project) throw new Error('Project not found');
      if (params.investor_id && project.investor_id !== params.investor_id) throw new Error('Unauthorized');
      const { data, error } = await supabase.from('setup_projects').update({ intake_form_submitted: true, intake_form_data: params.form_data, updated_at: new Date().toISOString(), activity_log: addLog(project.activity_log, `Intake form submitted by ${params.investor_name || 'Operator'}`, params.investor_name || 'Operator') }).eq('id', params.project_id).select().single();
      if (error) throw error;
      if (project.assigned_manager_id) await notifyManager(supabase, project.assigned_manager_id, `Intake Form Submitted: ${project.property_address}`, `<h2>Intake Form Submitted</h2><p><strong>${params.investor_name || project.investor_name}</strong> submitted the intake form for <strong>${project.property_address}</strong>.</p><p><a href="https://accessyourplace.com/staff/dashboard">View in Dashboard</a></p>`);
      return ok({ success: true, project: data });
    }

    if (action === 'approve_spreadsheet') {
      const { data: project } = await supabase.from('setup_projects').select('*').eq('id', params.project_id).single();
      if (!project) throw new Error('Project not found');
      if (params.investor_id && project.investor_id !== params.investor_id) throw new Error('Unauthorized');
      const { data, error } = await supabase.from('setup_projects').update({ spreadsheet_approved: true, spreadsheet_approved_at: new Date().toISOString(), updated_at: new Date().toISOString(), activity_log: addLog(project.activity_log, 'Sourcing spreadsheet approved by Operator', project.investor_name || 'Operator') }).eq('id', params.project_id).select().single();
      if (error) throw error;
      if (project.assigned_manager_id) await notifyManager(supabase, project.assigned_manager_id, `Spreadsheet Approved: ${project.property_address}`, `<h2>Spreadsheet Approved</h2><p>Operator approved the sourcing spreadsheet for <strong>${project.property_address}</strong>.</p>`);
      return ok({ success: true, project: data });
    }

    if (action === 'generate_pro_token') {
      const { data: project } = await supabase.from('setup_projects').select('*').eq('id', params.project_id).single();
      if (!project) throw new Error('Project not found');
      const token = genToken();
      const { data, error } = await supabase.from('setup_projects').update({ pro_portal_token: token, pro_portal_token_created_at: new Date().toISOString(), updated_at: new Date().toISOString(), activity_log: addLog(project.activity_log, 'Pro portal token generated', params.staff_name) }).eq('id', params.project_id).select().single();
      if (error) throw error;
      const portalUrl = `https://accessyourplace.com/pro-portal/${token}`;
      if (project.setup_pro_email) {
        try {
          const rk = Deno.env.get('RESEND_API_KEY');
          if (rk) await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': `Bearer ${rk}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'Setup Team <setup@rentalnarbitrage.com>', to: [project.setup_pro_email], subject: `Your Setup Pro Portal Access: ${project.property_address}`, html: `<h2>Setup Pro Portal Access</h2><p>Hi ${project.setup_pro_name || 'there'},</p><p>Access your portal for <strong>${project.property_address}</strong>:</p><p><a href="${portalUrl}" style="display:inline-block;background:#1a365d;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600">Open Pro Portal</a></p>` }) });
        } catch (e) { console.error('Pro email error:', e); }
      }
      return ok({ success: true, project: data, portal_url: portalUrl, token });
    }

    // â”€â”€â”€ EMAIL PRO PORTAL LINK â”€â”€â”€
    if (action === 'email_pro_portal_link') {
      const { data: project } = await supabase.from('setup_projects').select('*').eq('id', params.project_id).single();
      if (!project?.pro_portal_token) throw new Error('No portal token generated yet');
      if (!project.setup_pro_email) throw new Error('No pro email set');
      const portalUrl = `https://accessyourplace.com/pro-portal/${project.pro_portal_token}`;
      const rk = Deno.env.get('RESEND_API_KEY');
      if (!rk) throw new Error('Email not configured');
      await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': `Bearer ${rk}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'Setup Team <setup@rentalnarbitrage.com>', to: [project.setup_pro_email], subject: `Your Setup Pro Portal: ${project.property_address}`, html: `<h2>Setup Pro Portal</h2><p>Hi ${project.setup_pro_name || 'there'},</p><p>Here is your portal link for <strong>${project.property_address}</strong>:</p><p><a href="${portalUrl}" style="display:inline-block;background:#1a365d;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600">Open Pro Portal</a></p><p>This link is unique to you.</p>` }) });
      const { data } = await supabase.from('setup_projects').update({ updated_at: new Date().toISOString(), activity_log: addLog(project.activity_log, `Pro portal link emailed to ${project.setup_pro_email}`, params.staff_name) }).eq('id', params.project_id).select().single();
      return ok({ success: true, project: data, emailed_to: project.setup_pro_email });
    }

    if (action === 'pro_portal_access') {
      if (!params.token) throw new Error('Token required');
      const { data: project, error } = await supabase.from('setup_projects').select('id,property_address,phase,package_type,status,setup_pro_name,setup_pro_email,sourcing_spreadsheet,spreadsheet_approved,pro_contract_agreement_text,pro_contract_sent,pro_contract_signed,pro_contract_signed_at,pro_contract_signature,maintenance_check_completed,maintenance_check_data,maintenance_check_submitted_at,media_uploaded,media_approved,media_photos,media_videos,delivery_tracking,vendor_appointments,flight_details,pro_arrival_date,assigned_manager_name,investor_name,city_state,num_beds,num_baths').eq('pro_portal_token', params.token).single();
      if (error || !project) throw new Error('Invalid or expired portal link');
      // Track access
      await supabase.from('setup_projects').update({ pro_portal_last_accessed: new Date().toISOString() }).eq('id', project.id);
      return ok({ success: true, project });
    }

    if (action === 'pro_update_delivery') {
      if (!params.token) throw new Error('Token required');
      const { data: project } = await supabase.from('setup_projects').select('*').eq('pro_portal_token', params.token).single();
      if (!project) throw new Error('Invalid token');
      const ss = Array.isArray(project.sourcing_spreadsheet) ? [...project.sourcing_spreadsheet] : [];
      if (params.item_index >= 0 && params.item_index < ss.length) {
        if (params.delivered !== undefined) ss[params.item_index].delivered = params.delivered;
        if (params.placed !== undefined) ss[params.item_index].placed = params.placed;
        ss[params.item_index].updated_at = new Date().toISOString();
      }
      const { data } = await supabase.from('setup_projects').update({ sourcing_spreadsheet: ss, updated_at: new Date().toISOString(), activity_log: addLog(project.activity_log, `Pro updated item #${params.item_index + 1}`, project.setup_pro_name || 'Setup Pro') }).eq('id', project.id).select('sourcing_spreadsheet').single();
      return ok({ success: true, spreadsheet: data?.sourcing_spreadsheet });
    }

    if (action === 'pro_submit_maintenance') {
      if (!params.token) throw new Error('Token required');
      const { data: project } = await supabase.from('setup_projects').select('*').eq('pro_portal_token', params.token).single();
      if (!project) throw new Error('Invalid token');
      await supabase.from('setup_projects').update({ maintenance_check_completed: true, maintenance_check_data: params.maintenance_data, maintenance_check_submitted_at: new Date().toISOString(), maintenance_check_status: 'pending_review', updated_at: new Date().toISOString(), activity_log: addLog(project.activity_log, 'Maintenance check submitted by Pro', project.setup_pro_name || 'Setup Pro') }).eq('id', project.id);
      if (project.assigned_manager_id) await notifyManager(supabase, project.assigned_manager_id, `Maintenance Check: ${project.property_address}`, `<h2>Maintenance Check Submitted</h2><p>${project.setup_pro_name} submitted maintenance check for <strong>${project.property_address}</strong>.</p>`);
      return ok({ success: true });
    }

    if (action === 'pro_sign_contract') {
      if (!params.token) throw new Error('Token required');
      const { data: project } = await supabase.from('setup_projects').select('*').eq('pro_portal_token', params.token).single();
      if (!project) throw new Error('Invalid token');
      await supabase.from('setup_projects').update({ pro_contract_signed: true, pro_contract_signed_at: new Date().toISOString(), pro_contract_signature: params.signature, updated_at: new Date().toISOString(), activity_log: addLog(project.activity_log, `Contract signed by ${params.signer_name || project.setup_pro_name}`, params.signer_name || project.setup_pro_name || 'Setup Pro') }).eq('id', project.id);
      if (project.assigned_manager_id) await notifyManager(supabase, project.assigned_manager_id, `Contract Signed: ${project.setup_pro_name} - ${project.property_address}`, `<h2>Contract Signed</h2><p><strong>${project.setup_pro_name}</strong> signed the agreement for <strong>${project.property_address}</strong>.</p>`);
      return ok({ success: true });
    }

    if (action === 'pro_upload_media') {
      if (!params.token) throw new Error('Token required');
      const { data: project } = await supabase.from('setup_projects').select('*').eq('pro_portal_token', params.token).single();
      if (!project) throw new Error('Invalid token');
      const ep = Array.isArray(project.media_photos) ? project.media_photos : [];
      const ev = Array.isArray(project.media_videos) ? project.media_videos : [];
      await supabase.from('setup_projects').update({ media_uploaded: true, media_photos: [...ep, ...(params.photos || [])], media_videos: [...ev, ...(params.videos || [])], media_reupload_requested: false, updated_at: new Date().toISOString(), activity_log: addLog(project.activity_log, `Media uploaded: ${(params.photos||[]).length} photos, ${(params.videos||[]).length} videos`, project.setup_pro_name || 'Setup Pro') }).eq('id', project.id);
      if (project.assigned_manager_id) await notifyManager(supabase, project.assigned_manager_id, `Media Uploaded: ${project.property_address}`, `<h2>Media Uploaded</h2><p>${project.setup_pro_name} uploaded media for <strong>${project.property_address}</strong>. Please review.</p>`);
      return ok({ success: true });
    }

    // â”€â”€â”€ APPROVE MAINTENANCE CHECK â”€â”€â”€
    if (action === 'approve_maintenance') {
      const { data: project } = await supabase.from('setup_projects').select('*').eq('id', params.project_id).single();
      if (!project) throw new Error('Project not found');
      const { data, error } = await supabase.from('setup_projects').update({ maintenance_check_status: 'approved', updated_at: new Date().toISOString(), activity_log: addLog(project.activity_log, 'Maintenance check approved', params.staff_name) }).eq('id', params.project_id).select().single();
      if (error) throw error;
      return ok({ success: true, project: data });
    }

    // â”€â”€â”€ FLAG MAINTENANCE CHECK â”€â”€â”€
    if (action === 'flag_maintenance') {
      const { data: project } = await supabase.from('setup_projects').select('*').eq('id', params.project_id).single();
      if (!project) throw new Error('Project not found');
      const { data, error } = await supabase.from('setup_projects').update({ maintenance_check_status: 'flagged', maintenance_check_flagged_items: params.flagged_items || [], updated_at: new Date().toISOString(), activity_log: addLog(project.activity_log, `Maintenance check flagged: ${params.notes || 'Items need attention'}`, params.staff_name) }).eq('id', params.project_id).select().single();
      if (error) throw error;
      return ok({ success: true, project: data });
    }

    // â”€â”€â”€ APPROVE MEDIA â”€â”€â”€
    if (action === 'approve_media') {
      const { data: project } = await supabase.from('setup_projects').select('*').eq('id', params.project_id).single();
      if (!project) throw new Error('Project not found');
      const { data, error } = await supabase.from('setup_projects').update({ media_approved: true, media_approved_at: new Date().toISOString(), updated_at: new Date().toISOString(), activity_log: addLog(project.activity_log, 'Media approved by manager', params.staff_name) }).eq('id', params.project_id).select().single();
      if (error) throw error;
      return ok({ success: true, project: data });
    }

    // â”€â”€â”€ REQUEST MEDIA RE-UPLOAD â”€â”€â”€
    if (action === 'request_media_reupload') {
      const { data: project } = await supabase.from('setup_projects').select('*').eq('id', params.project_id).single();
      if (!project) throw new Error('Project not found');
      const { data, error } = await supabase.from('setup_projects').update({ media_reupload_requested: true, media_reupload_notes: params.notes || '', media_approved: false, updated_at: new Date().toISOString(), activity_log: addLog(project.activity_log, `Media re-upload requested: ${params.notes || 'See notes'}`, params.staff_name) }).eq('id', params.project_id).select().single();
      if (error) throw error;
      return ok({ success: true, project: data });
    }

    // â”€â”€â”€ SAVE FORM TEMPLATE â”€â”€â”€
    if (action === 'save_form_template') {
      const { name, description, fields, property_type, staff_name, staff_id } = params;
      if (!name || !fields) throw new Error('name and fields required');
      const { data, error } = await supabase.from('intake_form_templates').insert({ name, description: description || '', fields, property_type: property_type || null, created_by: staff_name || 'Staff', created_by_id: staff_id || null }).select().single();
      if (error) throw error;
      return ok({ success: true, template: data });
    }

    // â”€â”€â”€ LIST FORM TEMPLATES â”€â”€â”€
    if (action === 'list_form_templates') {
      const { data, error } = await supabase.from('intake_form_templates').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return ok({ success: true, templates: data || [] });
    }

    // â”€â”€â”€ DELETE FORM TEMPLATE â”€â”€â”€
    if (action === 'delete_form_template') {
      const { error } = await supabase.from('intake_form_templates').delete().eq('id', params.template_id);
      if (error) throw error;
      return ok({ success: true });
    }

    // â”€â”€â”€ LOAD FORM TEMPLATE INTO PROJECT â”€â”€â”€
    if (action === 'load_form_template') {
      const { data: template } = await supabase.from('intake_form_templates').select('*').eq('id', params.template_id).single();
      if (!template) throw new Error('Template not found');
      // Increment usage count
      await supabase.from('intake_form_templates').update({ usage_count: (template.usage_count || 0) + 1 }).eq('id', params.template_id);
      const { data: cur } = await supabase.from('setup_projects').select('activity_log').eq('id', params.project_id).single();
      const { data, error } = await supabase.from('setup_projects').update({ intake_form_fields: template.fields, intake_form_template_id: params.template_id, updated_at: new Date().toISOString(), activity_log: addLog(cur?.activity_log, `Loaded form template: ${template.name}`, params.staff_name) }).eq('id', params.project_id).select().single();
      if (error) throw error;
      return ok({ success: true, project: data, template });
    }

    // â”€â”€â”€ CREATE PROJECT â”€â”€â”€
    if (action === 'create_project') {
      const { project_data: pd, staff_name } = params;
      const { data, error } = await supabase.from('setup_projects').insert({
        property_address: pd.property_address, investor_id: pd.investor_id || null, investor_name: pd.investor_name || null, investor_email: pd.investor_email || null, investor_phone: pd.investor_phone || null, property_id: pd.property_id || null, assigned_manager_id: pd.assigned_manager_id || null, assigned_manager_name: pd.assigned_manager_name || null, admin_fee_amount: pd.admin_fee_amount || 2500, status: 'pending', phase: 1, budget: pd.budget || 0, actual_cost: 0, estimated_completion: pd.estimated_completion || null, num_properties: pd.num_properties || 1, num_beds: pd.num_beds || null, num_baths: pd.num_baths || null, property_type: pd.property_type || 'apartment', city_state: pd.city_state || null, target_start_date: pd.target_start_date || null, intake_form_link: pd.intake_form_link || null, intake_form_fields: DEFAULT_INTAKE_FIELDS, checklist: [], notes: '', photos: [], phase_history: [{ from: 0, to: 1, by: staff_name || 'System', at: new Date().toISOString() }], activity_log: [{ action: 'Project created', by: staff_name || 'System', at: new Date().toISOString() }]
      }).select().single();
      if (error) throw error;
      return ok({ success: true, project: data });
    }

    if (action === 'update_project') {
      const u = params.updates;
      u.updated_at = new Date().toISOString();
      const { data: cur } = await supabase.from('setup_projects').select('activity_log').eq('id', params.project_id).single();
      if (params.staff_name) { const cf = Object.keys(u).filter(k => k !== 'updated_at' && k !== 'activity_log'); if (cf.length > 0) u.activity_log = addLog(cur?.activity_log, `Updated: ${cf.join(', ')}`, params.staff_name); }
      const { data, error } = await supabase.from('setup_projects').update(u).eq('id', params.project_id).select().single();
      if (error) throw error;
      return ok({ success: true, project: data });
    }

    if (action === 'advance_phase') {
      const { data: project, error: fe } = await supabase.from('setup_projects').select('*').eq('id', params.project_id).single();
      if (fe) throw fe;
      const cp = project.phase || 1;
      let np = cp + 1;
      if (project.package_type === 'diy') { if (np === 4) np = 5; if (np === 6) np = 8; }
      if (np > 8) {
        const { data, error } = await supabase.from('setup_projects').update({ phase: 8, status: 'complete', completed_at: new Date().toISOString(), actual_completion: new Date().toISOString().split('T')[0], updated_at: new Date().toISOString(), phase_history: addPhase(project.phase_history, cp, 8, params.staff_name), activity_log: addLog(project.activity_log, 'Project completed', params.staff_name) }).eq('id', params.project_id).select().single();
        if (error) throw error;
        return ok({ success: true, project: data, completed: true });
      }
      const sm = { 1:'pending',2:'in_progress',3:'in_progress',4:'in_progress',5:'furniture_delivery',6:'furniture_delivery',7:'final_inspection',8:'complete' };
      const { data, error } = await supabase.from('setup_projects').update({ phase: np, status: sm[np] || 'in_progress', updated_at: new Date().toISOString(), phase_history: addPhase(project.phase_history, cp, np, params.staff_name), activity_log: addLog(project.activity_log, `Advanced to Phase ${np}: ${PHASE_NAMES[np]}`, params.staff_name) }).eq('id', params.project_id).select().single();
      if (error) throw error;
      return ok({ success: true, project: data });
    }

    if (action === 'record_admin_fee') {
      const { data: project } = await supabase.from('setup_projects').select('*').eq('id', params.project_id).single();
      const amt = params.amount || project?.admin_fee_amount || 2500;
      const comm = amt * 0.15;
      const pd = getNextFriday();
      const { data, error } = await supabase.from('setup_projects').update({ admin_fee_paid: true, admin_fee_paid_at: new Date().toISOString(), admin_fee_amount: amt, manager_commission_amount: comm, manager_commission_queued: true, manager_commission_payout_date: pd, updated_at: new Date().toISOString(), activity_log: addLog(project?.activity_log, `Admin fee $${amt} recorded. Commission $${comm.toFixed(2)} queued for ${pd}`, params.staff_name) }).eq('id', params.project_id).select().single();
      if (error) throw error;
      return ok({ success: true, project: data, commission: comm, payout_date: pd });
    }

    if (action === 'record_logistics_fee') {
      const { data: project } = await supabase.from('setup_projects').select('*').eq('id', params.project_id).single();
      const { data, error } = await supabase.from('setup_projects').update({ logistics_fee_paid: true, logistics_fee_paid_at: new Date().toISOString(), logistics_fee_amount: params.amount || project?.logistics_fee_amount || 3350, updated_at: new Date().toISOString(), activity_log: addLog(project?.activity_log, `Logistics fee $${params.amount || 3350} recorded`, params.staff_name) }).eq('id', params.project_id).select().single();
      if (error) throw error;
      return ok({ success: true, project: data });
    }

    if (action === 'record_furniture_fee') {
      const { data: project } = await supabase.from('setup_projects').select('*').eq('id', params.project_id).single();
      const { data, error } = await supabase.from('setup_projects').update({ furniture_supply_fee: params.amount, furniture_supply_fee_paid: true, furniture_supply_fee_paid_at: new Date().toISOString(), updated_at: new Date().toISOString(), activity_log: addLog(project?.activity_log, `Furniture fee $${params.amount} recorded`, params.staff_name) }).eq('id', params.project_id).select().single();
      if (error) throw error;
      return ok({ success: true, project: data });
    }

    if (action === 'set_package_type') {
      const { data: project } = await supabase.from('setup_projects').select('*').eq('id', params.project_id).single();
      const { data, error } = await supabase.from('setup_projects').update({ package_type: params.package_type, recap_type: params.package_type, updated_at: new Date().toISOString(), activity_log: addLog(project?.activity_log, `Package: ${params.package_type === 'dfy' ? 'Done For You' : 'Do It Yourself'}`, params.staff_name) }).eq('id', params.project_id).select().single();
      if (error) throw error;
      return ok({ success: true, project: data });
    }

    if (action === 'assign_pro') {
      const { data: project } = await supabase.from('setup_projects').select('*').eq('id', params.project_id).single();
      const { data, error } = await supabase.from('setup_projects').update({ setup_pro_id: params.pro_id || null, setup_pro_name: params.pro_name, setup_pro_email: params.pro_email || null, updated_at: new Date().toISOString(), activity_log: addLog(project?.activity_log, `Setup Pro: ${params.pro_name}`, params.staff_name) }).eq('id', params.project_id).select().single();
      if (error) throw error;
      return ok({ success: true, project: data });
    }

    if (action === 'update_spreadsheet') {
      const { data: project } = await supabase.from('setup_projects').select('*').eq('id', params.project_id).single();
      const { data, error } = await supabase.from('setup_projects').update({ sourcing_spreadsheet: params.items, updated_at: new Date().toISOString(), activity_log: addLog(project?.activity_log, `Spreadsheet updated (${params.items.length} items)`, params.staff_name) }).eq('id', params.project_id).select().single();
      if (error) throw error;
      return ok({ success: true, project: data });
    }

    if (action === 'preview_recap') {
      const { data: project } = await supabase.from('setup_projects').select('*').eq('id', params.project_id).single();
      const tv = params.template_vars || {};
      const vars = { client_name: tv.client_name || project?.investor_name || 'there', num_properties: tv.num_properties || project?.num_properties || 1, num_beds: tv.num_beds || project?.num_beds || '[beds]', num_baths: tv.num_baths || project?.num_baths || '[baths]', property_type: tv.property_type || project?.property_type || 'apartment', city_state: tv.city_state || project?.city_state || '[City, State]', target_start_date: tv.target_start_date || project?.target_start_date || '[Date TBD]', admin_fee_paid: project?.admin_fee_paid || false, admin_fee_amount: project?.admin_fee_amount || 2500, manager_name: tv.manager_name || project?.assigned_manager_name || 'Your Setup Manager', intake_form_link: tv.intake_form_link || project?.intake_form_link || 'https://accessyourplace.com/portal' };
      const type = params.recap_type || project?.package_type || 'dfy';
      return ok({ success: true, preview: { html: type === 'diy' ? buildDIYEmailHTML(vars) : buildDFYEmailHTML(vars), plain_text: type === 'diy' ? buildDIYPlainText(vars) : buildDFYPlainText(vars), subject: 'Recap & Next Steps: Setting up your property!', recap_type: type, vars } });
    }

    if (action === 'send_recap') {
      const { data: project } = await supabase.from('setup_projects').select('*').eq('id', params.project_id).single();
      const type = params.recap_type || project?.package_type || 'dfy';
      const tv = params.template_vars || {};
      const vars = { client_name: tv.client_name || project?.investor_name || 'there', num_properties: tv.num_properties || project?.num_properties || 1, num_beds: tv.num_beds || project?.num_beds || '[beds]', num_baths: tv.num_baths || project?.num_baths || '[baths]', property_type: tv.property_type || project?.property_type || 'apartment', city_state: tv.city_state || project?.city_state || '[City, State]', target_start_date: tv.target_start_date || project?.target_start_date || '[Date TBD]', admin_fee_paid: project?.admin_fee_paid || false, admin_fee_amount: project?.admin_fee_amount || 2500, manager_name: tv.manager_name || project?.assigned_manager_name || 'Your Setup Manager', intake_form_link: tv.intake_form_link || project?.intake_form_link || 'https://accessyourplace.com/portal' };
      const html = type === 'diy' ? buildDIYEmailHTML(vars) : buildDFYEmailHTML(vars);
      const pt = type === 'diy' ? buildDIYPlainText(vars) : buildDFYPlainText(vars);
      const subj = 'Recap & Next Steps: Setting up your property!';
      const { data: up } = await supabase.from('setup_projects').update({ recap_sent: true, recap_sent_at: new Date().toISOString(), recap_type: type, recap_email_body: pt, updated_at: new Date().toISOString(), activity_log: addLog(project?.activity_log, `${type==='diy'?'DIY':'DFY'} recap ${params.send_as_message?'sent as portal message':'emailed'}`, params.staff_name) }).eq('id', params.project_id).select().single();
      let es = false, ms = false;
      if (project?.investor_email && !params.send_as_message) {
        try { const rk = Deno.env.get('RESEND_API_KEY'); if (rk) { const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': `Bearer ${rk}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'Setup Team <setup@rentalnarbitrage.com>', to: [project.investor_email], subject: subj, html, text: pt }) }); if (r.ok) es = true; } } catch (e) { console.error(e); }
      }
      if (params.send_as_message && project?.investor_id) {
        try { const { error: me } = await supabase.from('investor_messages').insert({ investor_id: project.investor_id, sender_type: 'staff', sender_name: params.staff_name || 'Setup Manager', subject: subj, message: pt, message_type: 'setup_recap', is_read: false }); if (!me) ms = true; } catch (e) { console.error(e); }
      }
      return ok({ success: true, project: up, email_sent: es, message_sent: ms, recap_type: type });
    }

    if (action === 'delete_project') {
      await supabase.from('setup_projects').delete().eq('id', params.project_id);
      return ok({ success: true });
    }

    if (action === 'get_stats') {
      const { data: projects } = await supabase.from('setup_projects').select('phase,status,package_type,admin_fee_paid,admin_fee_amount,logistics_fee_paid,logistics_fee_amount,furniture_supply_fee,furniture_supply_fee_paid,manager_commission_amount');
      const s = { total: (projects||[]).length, by_phase: {}, active: 0, completed: 0, total_admin_fees: 0, total_logistics_fees: 0, total_furniture_fees: 0, total_commissions: 0, dfy_count: 0, diy_count: 0 };
      for (const p of (projects||[])) { const ph = p.phase||1; s.by_phase[ph] = (s.by_phase[ph]||0)+1; if (p.status==='complete') s.completed++; else s.active++; if (p.admin_fee_paid) s.total_admin_fees += Number(p.admin_fee_amount||0); if (p.logistics_fee_paid) s.total_logistics_fees += Number(p.logistics_fee_amount||0); if (p.furniture_supply_fee_paid) s.total_furniture_fees += Number(p.furniture_supply_fee||0); if (p.manager_commission_amount) s.total_commissions += Number(p.manager_commission_amount); if (p.package_type==='dfy') s.dfy_count++; if (p.package_type==='diy') s.diy_count++; }
      return ok({ success: true, stats: s });
    }

    // Legacy
    if (action === 'list') { let q = supabase.from('setup_tasks').select('*').order('category').order('created_at'); if (params.property_id) q = q.eq('property_id', params.property_id); if (params.investor_id) q = q.eq('investor_id', params.investor_id); const { data } = await q; return ok({ success: true, tasks: data || [] }); }
    if (action === 'create_default_tasks') { const DT = { design: [{ name: 'Property Design Consultation', description: 'Initial design consultation' }], furniture: [{ name: 'Furniture Package Selection', description: 'Select furniture package' }], software: [{ name: 'PMS Setup', description: 'Configure PMS' }], utilities: [{ name: 'Internet Setup', description: 'Set up WiFi' }], vendors: [{ name: 'Cleaning Team Match', description: 'Match cleaning service' }], marketing: [{ name: 'Professional Photography', description: 'Schedule photos' }] }; const tasks = []; for (const [cat, ct] of Object.entries(DT)) { for (const t of ct) tasks.push({ property_id: params.property_id, investor_id: params.investor_id, category: cat, task_name: t.name, description: t.description, status: 'pending', priority: 'medium' }); } const { data, error } = await supabase.from('setup_tasks').insert(tasks).select(); if (error) throw error; return ok({ success: true, tasks: data }); }
    if (action === 'complete') { const { data, error } = await supabase.from('setup_tasks').update({ status: 'completed', completed_at: new Date().toISOString(), completed_by: params.completed_by, updated_at: new Date().toISOString() }).eq('id', params.task_id).select().single(); if (error) throw error; return ok({ success: true, task: data }); }
    if (action === 'update') { params.updates.updated_at = new Date().toISOString(); const { data, error } = await supabase.from('setup_tasks').update(params.updates).eq('id', params.task_id).select().single(); if (error) throw error; return ok({ success: true, task: data }); }
    if (action === 'delete') { await supabase.from('setup_tasks').delete().eq('id', params.task_id); return ok({ success: true }); }

    throw new Error(`Invalid action: ${action}`);
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
