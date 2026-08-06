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

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);
const resendKey = Deno.env.get('RESEND_API_KEY');

async function sendEmail(to: string, subject: string, html: string) {
  if (!resendKey) { console.log('[email] No RESEND_API_KEY'); return { success: false }; }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Penny <penny@accessyourplace.com>', reply_to: ['success@accessyourplace.com'], to: [to], subject, html })
    });
    const result = await res.json();
    console.log('[email] Sent to', to, res.ok);
    return { success: res.ok, result };
  } catch (e) { console.error('Email send error:', e); return { success: false }; }
}

// Upload base64 signature image to storage
async function uploadSignatureImage(base64Data: string, documentId: string, investorId: string): Promise<string | null> {
  try {
    if (!base64Data || !base64Data.startsWith('data:image/')) return null;
    
    const base64Content = base64Data.split(',')[1];
    if (!base64Content) return null;
    
    const binaryStr = atob(base64Content);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    
    const fileName = `${investorId}/${documentId}_${Date.now()}.png`;
    
    const { data, error } = await supabase.storage
      .from('signatures')
      .upload(fileName, bytes.buffer, {
        contentType: 'image/png',
        upsert: true
      });
    
    if (error) {
      console.error('[uploadSignature] Storage error:', error);
      return null;
    }
    
    // Get the URL (private bucket, so use createSignedUrl for access)
    const { data: urlData } = await supabase.storage
      .from('signatures')
      .createSignedUrl(fileName, 60 * 60 * 24 * 365 * 5); // 5 year signed URL
    
    return urlData?.signedUrl || `signatures/${fileName}`;
  } catch (e) {
    console.error('[uploadSignature] Error:', e);
    return null;
  }
}

// Find staff email by name or ID
async function findStaffEmail(sentBy: string, staffId?: string): Promise<{ email: string; name: string } | null> {
  try {
    if (staffId) {
      const { data } = await supabase.from('staff_users').select('email, first_name, last_name, name').eq('id', staffId).limit(1);
      if (data?.[0]?.email) {
        const s = data[0];
        return { email: s.email, name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.name || sentBy };
      }
    }
    const { data: sm } = await supabase.from('staff_members').select('email, full_name').ilike('full_name', sentBy).limit(1);
    if (sm?.[0]?.email) return { email: sm[0].email, name: sm[0].full_name || sentBy };
    
    const nameParts = sentBy.trim().split(/\s+/);
    if (nameParts.length >= 2) {
      const { data: su } = await supabase.from('staff_users').select('email, first_name, last_name, name')
        .ilike('first_name', nameParts[0]).ilike('last_name', nameParts.slice(1).join(' ')).limit(1);
      if (su?.[0]?.email) {
        const s = su[0];
        return { email: s.email, name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.name || sentBy };
      }
    }
    const { data: byName } = await supabase.from('staff_users').select('email, first_name, last_name, name').ilike('name', sentBy).limit(1);
    if (byName?.[0]?.email) return { email: byName[0].email, name: byName[0].name || sentBy };
    return null;
  } catch (e) { console.error('[findStaffEmail] Error:', e); return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // GET PENDING AGREEMENTS for an investor
    if (action === 'get_pending_agreements') {
      const { investor_id } = body;
      if (!investor_id) throw new Error('investor_id required');

      // Query investor_documents for pending agreements
      const { data: docs, error } = await supabase
        .from('investor_documents')
        .select('*')
        .eq('investor_id', investor_id)
        .eq('document_type', 'agreement')
        .in('status', ['pending_signature', 'sent'])
        .order('created_at', { ascending: false });

      if (error) {
        const { data: sigDocs } = await supabase
          .from('document_signatures')
          .select('*')
          .eq('investor_id', investor_id)
          .in('signature_status', ['pending', 'viewed'])
          .order('created_at', { ascending: false });

        return new Response(JSON.stringify({
          success: true,
          agreements: (sigDocs || []).map(d => ({
            id: d.id,
            document_name: d.document_name,
            document_type: d.document_type || 'agreement',
            content: d.document_content || d.content || '',
            status: d.signature_status,
            created_at: d.created_at,
            expires_at: d.expires_at,
            sent_by: d.sent_by,
            sent_by_id: d.sent_by_id,
            metadata: { sent_by_name: d.sent_by },
            source_table: 'document_signatures'
          }))
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      return new Response(JSON.stringify({
        success: true,
        agreements: (docs || []).map(d => ({
          id: d.id,
          document_name: d.document_name || d.name || 'Agreement',
          document_type: d.document_type,
          content: d.content || d.document_content || '',
          status: d.status,
          created_at: d.created_at,
          expires_at: d.expires_at,
          metadata: d.metadata,
          source_table: 'investor_documents'
        }))
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // GET ALL AGREEMENTS (pending + signed) for an investor
    if (action === 'get_all_agreements') {
      const { investor_id } = body;
      if (!investor_id) throw new Error('investor_id required');

      const { data: docs } = await supabase
        .from('investor_documents')
        .select('*')
        .eq('investor_id', investor_id)
        .eq('document_type', 'agreement')
        .order('created_at', { ascending: false });

      const { data: sigDocs } = await supabase
        .from('document_signatures')
        .select('*')
        .eq('investor_id', investor_id)
        .order('created_at', { ascending: false });

      const allDocs = [
        ...(docs || []).map(d => ({
          id: d.id,
          document_name: d.document_name || d.name || 'Agreement',
          document_type: d.document_type,
          content: d.content || d.document_content || '',
          status: d.status,
          signed_at: d.signed_at,
          created_at: d.created_at,
          source_table: 'investor_documents'
        })),
        ...(sigDocs || []).map(d => ({
          id: d.id,
          document_name: d.document_name,
          document_type: d.document_type || 'agreement',
          content: d.document_content || '',
          status: d.signature_status,
          signed_at: d.signed_at,
          created_at: d.created_at,
          source_table: 'document_signatures'
        }))
      ];

      return new Response(JSON.stringify({ success: true, agreements: allDocs }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // SIGN AGREEMENT - Enhanced with signature image upload
    if (action === 'sign_agreement') {
      const { 
        agreement_id, investor_id, investor_name, investor_email, 
        signature_name, ip_address, source_table,
        signature_type, signature_image, initials
      } = body;
      
      if (!agreement_id || !investor_id || !signature_name) {
        throw new Error('agreement_id, investor_id, and signature_name required');
      }

      const signedAt = new Date().toISOString();
      
      // Upload signature image if provided
      let signatureImageUrl = null;
      if (signature_image && signature_image.startsWith('data:image/')) {
        signatureImageUrl = await uploadSignatureImage(signature_image, agreement_id, investor_id);
        console.log('[sign_agreement] Signature image uploaded:', !!signatureImageUrl);
      }

      const signatureData = {
        type: signature_type || 'typed',
        signature: signature_name,
        signed_name: signature_name,
        typed_name: signature_name,
        initials: initials || '',
        ip_address: ip_address || 'unknown',
        timestamp: signedAt,
        signature_image_url: signatureImageUrl,
        has_drawn_signature: signature_type === 'drawn',
        agreement_text: 'I have read and agree to the terms of this document. My electronic signature is legally binding.'
      };

      let updateSuccess = false;
      let agreementName = 'Agreement';
      let sentBy = '';
      let sentById = '';

      // Try investor_documents first
      if (source_table === 'investor_documents' || !source_table) {
        const { data: doc, error } = await supabase
          .from('investor_documents')
          .update({
            status: 'signed',
            signed_at: signedAt,
            signature_data: signatureData,
            metadata: {
              signed_by: investor_name,
              signed_ip: ip_address,
              signature_name: signature_name,
              signature_image_url: signatureImageUrl
            }
          })
          .eq('id', agreement_id)
          .eq('investor_id', investor_id)
          .select()
          .single();

        if (!error && doc) {
          updateSuccess = true;
          agreementName = doc.document_name || doc.name || 'Agreement';
          sentBy = doc.metadata?.sent_by_name || doc.metadata?.sent_by || '';
          sentById = doc.metadata?.sent_by_id || '';
        }
      }

      // Try document_signatures as fallback
      if (!updateSuccess) {
        const { data: doc, error } = await supabase
          .from('document_signatures')
          .update({
            signature_status: 'signed',
            signed_at: signedAt,
            signed_ip: ip_address || 'unknown',
            signature_data: signatureData
          })
          .eq('id', agreement_id)
          .eq('investor_id', investor_id)
          .select()
          .single();

        if (!error && doc) {
          updateSuccess = true;
          agreementName = doc.document_name || 'Agreement';
          sentBy = doc.sent_by || '';
          sentById = doc.sent_by_id || '';
        }
      }

      if (!updateSuccess) {
        throw new Error('Failed to update agreement status. Document not found.');
      }

      // Log the activity
      try {
        await supabase.from('investor_activity_logs').insert({
          investor_id,
          action: 'agreement_signed',
          details: `Signed agreement: ${agreementName}`,
          metadata: {
            agreement_id,
            signature_name,
            signature_type: signature_type || 'typed',
            ip_address,
            signed_at: signedAt,
            has_signature_image: !!signatureImageUrl
          },
          performed_by: investor_name || 'investor',
          performed_by_type: 'investor'
        });
      } catch (logErr) { console.error('Activity log error:', logErr); }

      // Get investor info
      const { data: investor } = await supabase
        .from('investors')
        .select('assigned_acquisition_manager_id, assigned_acquisition_manager_name, full_name, email')
        .eq('id', investor_id)
        .single();

      const investorFullName = investor?.full_name || investor_name || 'Investor';
      const investorActualEmail = investor?.email || investor_email || '';

      // Build signature display for email
      const signatureHtml = signatureImageUrl
        ? `<img src="${signatureImageUrl}" alt="Electronic Signature" style="max-width: 300px; height: auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; background: #fafafa;" />`
        : `<p style="font-family: cursive; font-size: 28px; color: #1a365d; margin: 10px 0; padding: 10px; border-bottom: 2px solid #d4a574;">${signature_name}</p>`;

      // ===== EMAIL 1: Notify the staff member who sent the agreement =====
      let staffEmailSent = false;
      
      // First try the sent_by from the document
      if (sentBy) {
        const staffInfo = await findStaffEmail(sentBy, sentById);
        if (staffInfo?.email) {
          const result = await sendEmail(
            staffInfo.email,
            `Agreement Signed: ${investorFullName} signed "${agreementName}"`,
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #16a34a, #15803d); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                <h2 style="margin: 0; font-size: 22px;">Agreement Signed!</h2>
                <p style="margin: 8px 0 0; opacity: 0.9;">An investor has completed their signature</p>
              </div>
              <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; background: #ffffff;">
                <p>Hi ${staffInfo.name},</p>
                <p><strong>${investorFullName}</strong> has signed the agreement you sent:</p>
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px; margin: 16px 0;">
                  <p style="margin: 0 0 8px; font-weight: bold; font-size: 16px; color: #166534;">${agreementName}</p>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="padding: 4px 0; color: #666; width: 120px;">Signed by:</td><td style="padding: 4px 0; font-weight: 600;">${signature_name}</td></tr>
                    <tr><td style="padding: 4px 0; color: #666;">Method:</td><td style="padding: 4px 0;">${signature_type === 'drawn' ? 'Hand-drawn signature' : 'Typed signature'}</td></tr>
                    <tr><td style="padding: 4px 0; color: #666;">Date/Time:</td><td style="padding: 4px 0;">${new Date(signedAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</td></tr>
                    <tr><td style="padding: 4px 0; color: #666;">IP Address:</td><td style="padding: 4px 0;">${ip_address || 'N/A'}</td></tr>
                    ${initials ? `<tr><td style="padding: 4px 0; color: #666;">Initials:</td><td style="padding: 4px 0;">${initials}</td></tr>` : ''}
                  </table>
                </div>
                <div style="margin: 16px 0; padding: 12px; background: #f8f9fa; border-radius: 8px;">
                  <p style="margin: 0 0 8px; font-size: 13px; color: #666;">Electronic Signature:</p>
                  ${signatureHtml}
                </div>
                <div style="text-align: center; margin: 24px 0;">
                  <a href="https://accessyourplace.com/staff" style="background: #1a365d; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">View in Dashboard</a>
                </div>
              </div>
            </div>`
          );
          staffEmailSent = result?.success || false;
        }
      }

      // Also notify AM if different from sent_by
      if (investor?.assigned_acquisition_manager_id) {
        const { data: amStaff } = await supabase
          .from('staff_members')
          .select('email, first_name')
          .eq('id', investor.assigned_acquisition_manager_id)
          .single();

        if (amStaff?.email) {
          await sendEmail(
            amStaff.email,
            `Agreement Signed: ${investorFullName}`,
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #1a365d; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h2 style="margin: 0;">Agreement Signed</h2>
              </div>
              <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                <p>Hi ${amStaff.first_name || 'Team'},</p>
                <p><strong>${investorFullName}</strong> has signed: <strong>${agreementName}</strong></p>
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <p style="margin: 0;">Signed at: ${new Date(signedAt).toLocaleString()}</p>
                  <p style="margin: 5px 0 0;">E-Signature: ${signature_name}</p>
                </div>
                <div style="margin: 16px 0; padding: 12px; background: #f8f9fa; border-radius: 8px;">
                  ${signatureHtml}
                </div>
              </div>
            </div>`
          );
        }
      }

      // ===== EMAIL 2: Confirmation to investor =====
      let investorEmailSent = false;
      if (investorActualEmail) {
        const result = await sendEmail(
          investorActualEmail,
          `Signature Confirmed: ${agreementName}`,
          `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #16a34a, #15803d); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
              <h2 style="margin: 0;">Signature Confirmed</h2>
              <p style="margin: 8px 0 0; opacity: 0.9;">Your agreement has been signed successfully</p>
            </div>
            <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p>Hi ${investorFullName},</p>
              <p>Your electronic signature has been recorded for:</p>
              <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
                <strong style="font-size: 16px;">${agreementName}</strong><br/>
                <span style="color: #666;">Signed: ${new Date(signedAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</span>
              </div>
              <div style="margin: 16px 0; padding: 12px; background: #f8f9fa; border-radius: 8px;">
                <p style="margin: 0 0 8px; font-size: 13px; color: #666;">Your Signature:</p>
                ${signatureHtml}
              </div>
              <p style="color: #666; font-size: 13px;">A copy of this signed agreement is available in your Investor Portal under "Electronic Signatures".</p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="https://accessyourplace.com/investor" style="background: #d4a574; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">View in Portal</a>
              </div>
              <p style="color: #999; font-size: 11px; border-top: 1px solid #eee; padding-top: 12px; margin-top: 20px;">
                This email confirms your electronic signature under the ESIGN Act and UETA. Please keep this for your records.
                Document ID: ${agreement_id}
              </p>
            </div>
          </div>`
        );
        investorEmailSent = result?.success || false;
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Agreement signed successfully',
        signed_at: signedAt,
        signature_image_url: signatureImageUrl,
        emails_sent: { investor: investorEmailSent, staff: staffEmailSent }
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // SEND AGREEMENT TO INVESTOR (from staff)
    if (action === 'send_agreement') {
      const { investor_id, investor_name, investor_email, document_name, content, template_type, sent_by, sent_by_name } = body;
      if (!investor_id || !content || !document_name) throw new Error('investor_id, content, and document_name required');

      let docId = null;
      const { data: doc, error: docError } = await supabase
        .from('investor_documents')
        .insert({
          investor_id,
          document_name,
          document_type: 'agreement',
          content,
          status: 'pending_signature',
          metadata: {
            template_type: template_type || 'custom',
            sent_by,
            sent_by_name,
            sent_at: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (docError) {
        const { data: sigDoc, error: sigError } = await supabase
          .from('document_signatures')
          .insert({
            investor_id,
            document_name,
            document_type: 'agreement',
            document_content: content,
            signature_status: 'pending',
            sent_by: sent_by_name || sent_by || 'AYP Team',
            sent_by_id: sent_by || null,
            reminder_count: 0
          })
          .select()
          .single();
        if (sigError) throw sigError;
        docId = sigDoc?.id;
      } else {
        docId = doc?.id;
      }

      // Log activity
      try {
        await supabase.from('investor_activity_logs').insert({
          investor_id,
          action: 'agreement_sent',
          details: `Agreement sent for signature: ${document_name}`,
          metadata: { document_id: docId, sent_by, sent_by_name },
          performed_by: sent_by_name || sent_by || 'staff',
          performed_by_type: 'staff'
        });
      } catch (logErr) { console.error('Log error:', logErr); }

      // Send email to investor
      if (investor_email) {
        await sendEmail(
          investor_email,
          `Action Required: Please Sign - ${document_name}`,
          `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1a365d, #2d4a7c); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
              <h2 style="margin: 0;">Agreement Ready for Signature</h2>
            </div>
            <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p>Hi ${investor_name || 'Investor'},</p>
              <p>A new agreement is ready for your review and electronic signature:</p>
              <div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p style="margin: 0; font-weight: bold; font-size: 16px;">${document_name}</p>
                <p style="margin: 5px 0 0; color: #666;">Sent by: ${sent_by_name || 'AYP Team'}</p>
              </div>
              <p>Please log in to your Investor Portal to review the full agreement and provide your electronic signature.</p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="https://accessyourplace.com/investor/login" style="background: #d4a574; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Review & Sign Agreement</a>
              </div>
              <p style="color: #666; font-size: 12px;">If you have questions, please contact your assigned acquisition manager.</p>
            </div>
          </div>`
        );
      }

      return new Response(JSON.stringify({
        success: true,
        document_id: docId,
        message: 'Agreement sent to investor'
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (err) {
    console.error('[sign-agreement] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
