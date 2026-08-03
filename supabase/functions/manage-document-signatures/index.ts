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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
  
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  async function sendEmail(to: string, subject: string, html: string) {
    if (!RESEND_API_KEY || !to) {
      console.log('[email] Skipped - no API key or recipient:', { hasKey: !!RESEND_API_KEY, to });
      return { success: false, reason: 'no_key_or_recipient' };
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'AYP Success Team <notifications@accessyourplace.com>',
          to: [to],
          subject,
          html
        })
      });
      const result = await res.json();
      console.log('[email] Sent to', to, '- Result:', JSON.stringify(result).substring(0, 200));
      return { success: res.ok, result };
    } catch (e) {
      console.error('[email] Send failed:', e);
      return { success: false, error: e };
    }
  }

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
      const { error } = await supabase.storage.from('signatures').upload(fileName, bytes.buffer, { contentType: 'image/png', upsert: true });
      if (error) { console.error('[uploadSignature] Error:', error); return null; }
      const { data: urlData } = await supabase.storage.from('signatures').createSignedUrl(fileName, 60 * 60 * 24 * 365 * 5);
      return urlData?.signedUrl || `signatures/${fileName}`;
    } catch (e) { console.error('[uploadSignature] Error:', e); return null; }
  }

  async function findStaffEmail(sentBy: string, staffId?: string): Promise<{ email: string; name: string } | null> {
    try {
      if (staffId) {
        const { data } = await supabase.from('staff_users').select('email, first_name, last_name, name').eq('id', staffId).limit(1);
        if (data?.[0]?.email) {
          const s = data[0];
          return { email: s.email, name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.name || sentBy };
        }
      }
      const { data: staffMembers } = await supabase.from('staff_members').select('email, full_name').ilike('full_name', sentBy).limit(1);
      if (staffMembers?.[0]?.email) return { email: staffMembers[0].email, name: staffMembers[0].full_name || sentBy };
      const nameParts = sentBy.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        const { data: staffUsers } = await supabase.from('staff_users').select('email, first_name, last_name, name')
          .ilike('first_name', nameParts[0]).ilike('last_name', nameParts.slice(1).join(' ')).limit(1);
        if (staffUsers?.[0]?.email) {
          const s = staffUsers[0];
          return { email: s.email, name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.name || sentBy };
        }
      }
      const { data: byName } = await supabase.from('staff_users').select('email, first_name, last_name, name').ilike('name', sentBy).limit(1);
      if (byName?.[0]?.email) return { email: byName[0].email, name: byName[0].name || sentBy };
      if (sentBy.includes('@')) {
        const { data: byEmail } = await supabase.from('staff_users').select('email, first_name, last_name, name').ilike('email', sentBy).limit(1);
        if (byEmail?.[0]?.email) {
          const s = byEmail[0];
          return { email: s.email, name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.name || sentBy };
        }
      }
      return null;
    } catch (e) { console.error('[findStaffEmail] Error:', e); return null; }
  }

  async function getInvestorInfo(investorId: string, doc: any): Promise<{ email: string; name: string }> {
    let email = doc.investor_email || '';
    let name = doc.investor_name || '';
    if (!email && investorId) {
      try {
        const { data: inv } = await supabase.from('investors').select('full_name, email').eq('id', investorId).single();
        if (inv) { email = inv.email || ''; name = inv.full_name || name; }
      } catch (e) { console.warn('[getInvestorInfo] Lookup failed:', e); }
    }
    return { email, name };
  }

  try {
    const body = await req.json();
    const { action } = body;
    console.log('[manage-document-signatures] Action:', action);

    // ===== SEND DOCUMENT =====
    if (action === 'send_document') {
      const { investor_id, document_name, document_type, document_content, document_url, file_path, expires_in_days, sent_by, sent_by_id, property_id, acquisition_id, investor_name, investor_email } = body;
      if (!investor_id || !document_name) {
        return new Response(JSON.stringify({ error: 'investor_id and document_name are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const expiresAt = expires_in_days ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString() : null;
      const { data: doc, error: insertError } = await supabase
        .from('document_signatures')
        .insert({
          investor_id, document_name, document_type: document_type || 'agreement',
          document_content: document_content || '', document_url: document_url || null,
          file_path: file_path || null, signature_status: 'pending',
          expires_at: expiresAt, sent_by: sent_by || 'Success Team',
          sent_by_id: sent_by_id || null, property_id: property_id || null,
          acquisition_id: acquisition_id || null, investor_name: investor_name || null,
          investor_email: investor_email || null, reminder_count: 0,
          created_at: new Date().toISOString()
        })
        .select().single();
      if (insertError) throw insertError;

      const invInfo = await getInvestorInfo(investor_id, { investor_email, investor_name });
      if (invInfo.email) {
        await sendEmail(invInfo.email, `Action Required: ${document_name} - Ready for Signature`,
          `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1a365d, #2d4a7c); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 22px;">Document Ready for Signature</h1>
            </div>
            <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p>Hi ${invInfo.name || 'Investor'},</p>
              <p>A new document requires your electronic signature:</p>
              <div style="background: #f8f9fa; border-left: 4px solid #d4a574; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <strong style="font-size: 16px;">${document_name}</strong><br/>
                <span style="color: #666;">Type: ${document_type || 'Agreement'}</span><br/>
                ${expiresAt ? `<span style="color: #dc2626;">Expires: ${new Date(expiresAt).toLocaleDateString()}</span>` : ''}
              </div>
              <p>Please log in to your Investor Portal to review the full agreement and provide your electronic signature.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://accessyourplace.com/investor" style="background: #d4a574; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Review & Sign Document</a>
              </div>
              <p style="color: #666; font-size: 13px;">Sent by: ${sent_by || 'AYP Success Team'}</p>
            </div>
          </div>`
        );
      }
      return new Response(JSON.stringify({ success: true, document: doc }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ===== GET DOCUMENTS =====
    if (action === 'get_documents') {
      const { investor_id, status, sent_by, limit: docLimit } = body;
      let query = supabase.from('document_signatures').select('*').order('created_at', { ascending: false });
      if (investor_id) query = query.eq('investor_id', investor_id);
      if (status) query = query.eq('signature_status', status);
      if (sent_by) query = query.eq('sent_by', sent_by);
      if (docLimit) query = query.limit(docLimit);
      const { data, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, documents: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ===== GET ALL DOCUMENTS (for staff) =====
    if (action === 'get_all_documents') {
      const { status, sent_by, limit: docLimit } = body;
      let query = supabase.from('document_signatures').select('*').order('created_at', { ascending: false });
      if (status) query = query.eq('signature_status', status);
      if (sent_by) query = query.eq('sent_by', sent_by);
      query = query.limit(docLimit || 200);
      const { data, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, documents: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ===== SIGN DOCUMENT - Enhanced with signature image upload =====
    if (action === 'sign_document') {
      const { document_id, investor_id, signature_data, signed_ip } = body;
      if (!document_id) {
        return new Response(JSON.stringify({ error: 'document_id is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: doc, error: fetchError } = await supabase
        .from('document_signatures').select('*').eq('id', document_id).single();
      if (fetchError || !doc) {
        return new Response(JSON.stringify({ error: 'Document not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (doc.signature_status === 'signed') {
        return new Response(JSON.stringify({ error: 'Document already signed', already_signed: true }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (doc.expires_at && new Date(doc.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: 'Document has expired' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const now = new Date().toISOString();
      const sigData = signature_data || {};

      // Upload signature image if present
      let signatureImageUrl = null;
      const sigImage = sigData.signature_image_url || sigData.signature;
      if (sigImage && typeof sigImage === 'string' && sigImage.startsWith('data:image/')) {
        signatureImageUrl = await uploadSignatureImage(sigImage, document_id, doc.investor_id || investor_id);
      }

      const enrichedSigData = {
        ...sigData,
        typed_name: sigData.typed_name || sigData.signed_name || '',
        signed_name: sigData.signed_name || sigData.typed_name || '',
        timestamp: sigData.timestamp || now,
        signed_at: now,
        ip_address: signed_ip || sigData.ip_address || 'unknown',
        initials: sigData.initials || '',
        agreement_text: sigData.agreement_text || '',
        has_drawn_signature: sigData.has_drawn_signature || sigData.type === 'drawn',
        signature_image_url: signatureImageUrl || sigData.signature_image_url || null,
      };

      // Remove large base64 data from stored signature_data to save space
      if (enrichedSigData.signature && typeof enrichedSigData.signature === 'string' && enrichedSigData.signature.startsWith('data:image/')) {
        enrichedSigData.signature = signatureImageUrl ? '[stored in signatures bucket]' : enrichedSigData.signature.substring(0, 100) + '...';
      }

      const { data: updated, error: updateError } = await supabase
        .from('document_signatures')
        .update({
          signature_status: 'signed',
          signature_data: enrichedSigData,
          signed_at: now,
          signed_ip: signed_ip || 'unknown',
          updated_at: now
        })
        .eq('id', document_id).select().single();
      if (updateError) throw updateError;

      // Build signature display for emails
      const signatureHtml = signatureImageUrl
        ? `<img src="${signatureImageUrl}" alt="Electronic Signature" style="max-width: 300px; height: auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; background: #fafafa;" />`
        : `<p style="font-family: cursive; font-size: 28px; color: #1a365d; margin: 10px 0; padding: 10px; border-bottom: 2px solid #d4a574;">${enrichedSigData.typed_name || enrichedSigData.signed_name || 'Signed'}</p>`;

      // EMAIL 1: Confirmation to investor
      let investorEmailSent = false;
      const invInfo = await getInvestorInfo(doc.investor_id || investor_id, doc);
      if (invInfo.email) {
        const result = await sendEmail(invInfo.email, `Signature Confirmed: ${doc.document_name}`,
          `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #16a34a, #15803d); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 22px;">Signature Confirmed</h1>
            </div>
            <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p>Hi ${invInfo.name || 'Investor'},</p>
              <p>Your electronic signature has been successfully recorded for:</p>
              <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <strong style="font-size: 16px;">${doc.document_name}</strong><br/>
                <span style="color: #666;">Signed: ${new Date(now).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</span>
              </div>
              <div style="margin: 16px 0; padding: 12px; background: #f8f9fa; border-radius: 8px;">
                <p style="margin: 0 0 8px; font-size: 13px; color: #666;">Your Signature:</p>
                ${signatureHtml}
              </div>
              <p style="color: #666; font-size: 13px;">A copy is available in your Investor Portal under "Electronic Signatures".</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://accessyourplace.com/investor" style="background: #d4a574; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">View in Portal</a>
              </div>
              <p style="color: #999; font-size: 11px; border-top: 1px solid #eee; padding-top: 12px;">
                Electronic signature confirmed under the ESIGN Act and UETA. Document ID: ${document_id}
              </p>
            </div>
          </div>`
        );
        investorEmailSent = result?.success || false;
      }

      // EMAIL 2: Notify staff who sent the document
      let staffEmailSent = false;
      if (doc.sent_by) {
        const staffInfo = await findStaffEmail(doc.sent_by, doc.sent_by_id);
        if (staffInfo?.email) {
          const result = await sendEmail(staffInfo.email, `Document Signed: ${doc.document_name} by ${invInfo.name || 'Investor'}`,
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #1a365d, #2d4a7c); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 22px;">Document Signed!</h1>
              </div>
              <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <p>Hi ${staffInfo.name || doc.sent_by},</p>
                <p>An investor has signed a document you sent:</p>
                <div style="background: #f0f9ff; border-left: 4px solid #1a365d; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                  <strong style="font-size: 16px;">${doc.document_name}</strong><br/>
                  <span style="color: #333;">Investor: ${invInfo.name || 'Unknown'} (${invInfo.email || 'N/A'})</span><br/>
                  <span style="color: #666;">Signed: ${new Date(now).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</span>
                </div>
                <h3 style="color: #1a365d; margin-top: 25px;">Signature Details (Audit Trail)</h3>
                <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
                  <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #666; width: 140px;">Signed Name:</td><td style="padding: 8px 0; font-weight: bold;">${enrichedSigData.typed_name || enrichedSigData.signed_name || 'N/A'}</td></tr>
                  <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #666;">Method:</td><td style="padding: 8px 0;">${enrichedSigData.has_drawn_signature ? 'Hand-drawn signature' : 'Typed signature'}</td></tr>
                  <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #666;">Timestamp:</td><td style="padding: 8px 0;">${enrichedSigData.timestamp || now}</td></tr>
                  <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #666;">IP Address:</td><td style="padding: 8px 0;">${enrichedSigData.ip_address || signed_ip || 'unavailable'}</td></tr>
                  ${enrichedSigData.initials ? `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #666;">Initials:</td><td style="padding: 8px 0;">${enrichedSigData.initials}</td></tr>` : ''}
                </table>
                <div style="margin: 16px 0; padding: 12px; background: #f8f9fa; border-radius: 8px;">
                  <p style="margin: 0 0 8px; font-size: 13px; color: #666;">Electronic Signature:</p>
                  ${signatureHtml}
                </div>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="https://accessyourplace.com/staff" style="background: #1a365d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">View in Dashboard</a>
                </div>
              </div>
            </div>`
          );
          staffEmailSent = result?.success || false;
        } else {
          console.log('[sign_document] Could not find staff email for sent_by:', doc.sent_by);
        }
      }

      // Log activity
      try {
        await supabase.from('investor_activity_logs').insert({
          investor_id: doc.investor_id || investor_id,
          activity_type: 'document_signed',
          activity_category: 'document',
          title: `Document Signed: ${doc.document_name}`,
          description: `Signed by ${enrichedSigData.typed_name || invInfo.name} from IP ${signed_ip || 'unknown'}`,
          metadata: { document_id, document_name: doc.document_name, signed_ip, has_signature_image: !!signatureImageUrl }
        });
      } catch (e) { console.warn('[sign_document] Activity log failed:', e); }

      return new Response(JSON.stringify({ 
        success: true, document: updated,
        signature_image_url: signatureImageUrl,
        emails_sent: { investor: investorEmailSent, staff: staffEmailSent }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ===== MARK AS VIEWED =====
    if (action === 'mark_viewed') {
      const { document_id } = body;
      if (!document_id) {
        return new Response(JSON.stringify({ error: 'document_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const { data: doc } = await supabase.from('document_signatures').select('signature_status').eq('id', document_id).single();
      if (doc?.signature_status === 'pending') {
        await supabase.from('document_signatures').update({ signature_status: 'viewed', viewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', document_id);
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== REJECT DOCUMENT =====
    if (action === 'reject_document') {
      const { document_id, rejection_reason } = body;
      if (!document_id) {
        return new Response(JSON.stringify({ error: 'document_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const { data: updated, error } = await supabase
        .from('document_signatures')
        .update({ signature_status: 'rejected', rejection_reason, updated_at: new Date().toISOString() })
        .eq('id', document_id).select().single();
      if (error) throw error;

      if (updated?.sent_by) {
        const staffInfo = await findStaffEmail(updated.sent_by, updated.sent_by_id);
        const invInfo = await getInvestorInfo(updated.investor_id, updated);
        if (staffInfo?.email) {
          await sendEmail(staffInfo.email, `Document Rejected: ${updated.document_name}`,
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #dc2626; padding: 25px; text-align: center; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0;">Document Rejected</h1>
              </div>
              <div style="padding: 25px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <p>Hi ${staffInfo.name},</p>
                <p><strong>${invInfo.name || 'An investor'}</strong> has rejected the document <strong>"${updated.document_name}"</strong>.</p>
                ${rejection_reason ? `<p>Reason: <em>${rejection_reason}</em></p>` : ''}
                <p>Please review and take appropriate action.</p>
              </div>
            </div>`
          );
        }
      }
      return new Response(JSON.stringify({ success: true, document: updated }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ===== SEND REMINDER =====
    if (action === 'send_reminder') {
      const { document_id } = body;
      if (!document_id) {
        return new Response(JSON.stringify({ error: 'document_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const { data: doc } = await supabase.from('document_signatures').select('*').eq('id', document_id).single();
      if (!doc) throw new Error('Document not found');
      if (doc.signature_status === 'signed') {
        return new Response(JSON.stringify({ error: 'Already signed' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const invInfo = await getInvestorInfo(doc.investor_id, doc);
      if (invInfo.email) {
        await sendEmail(invInfo.email, `Reminder: ${doc.document_name} - Signature Required`,
          `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #f59e0b; padding: 25px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0;">Signature Reminder</h1>
            </div>
            <div style="padding: 25px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p>Hi ${invInfo.name},</p>
              <p>This is a friendly reminder that <strong>"${doc.document_name}"</strong> is still awaiting your electronic signature.</p>
              ${doc.expires_at ? `<p style="color: #dc2626;">This document expires on ${new Date(doc.expires_at).toLocaleDateString()}.</p>` : ''}
              <div style="text-align: center; margin: 25px 0;">
                <a href="https://accessyourplace.com/investor" style="background: #d4a574; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Sign Now</a>
              </div>
            </div>
          </div>`
        );
      }
      await supabase.from('document_signatures').update({
        reminder_count: (doc.reminder_count || 0) + 1,
        last_reminder_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', document_id);
      return new Response(JSON.stringify({ success: true, reminder_sent: !!invInfo.email }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ===== DELETE DOCUMENT =====
    if (action === 'delete_document') {
      const { document_id } = body;
      if (!document_id) {
        return new Response(JSON.stringify({ error: 'document_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const { error } = await supabase.from('document_signatures').delete().eq('id', document_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== UPDATE DOCUMENT =====
    if (action === 'update_document') {
      const { document_id, updates } = body;
      if (!document_id) {
        return new Response(JSON.stringify({ error: 'document_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const allowedFields = ['document_name', 'document_content', 'document_url', 'document_type', 'expires_at'];
      const updateData: any = { updated_at: new Date().toISOString() };
      for (const field of allowedFields) {
        if (updates?.[field] !== undefined) updateData[field] = updates[field];
      }
      const { data, error } = await supabase.from('document_signatures').update(updateData).eq('id', document_id).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, document: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ===== CHECK EXPIRATIONS =====
    if (action === 'check_expirations') {
      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      let expiredCount = 0;
      let warningsSent = 0;

      const { data: expiredDocs } = await supabase
        .from('document_signatures').select('*')
        .in('signature_status', ['pending', 'viewed'])
        .not('expires_at', 'is', null)
        .lt('expires_at', now.toISOString());

      if (expiredDocs && expiredDocs.length > 0) {
        const expiredIds = expiredDocs.map((d: any) => d.id);
        await supabase.from('document_signatures')
          .update({ signature_status: 'expired', updated_at: now.toISOString() })
          .in('id', expiredIds);
        expiredCount = expiredIds.length;

        for (const doc of expiredDocs) {
          const invInfo = await getInvestorInfo(doc.investor_id, doc);
          if (invInfo.email) {
            await sendEmail(invInfo.email, `Document Expired: ${doc.document_name}`,
              `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #dc2626; padding: 25px; text-align: center; border-radius: 12px 12px 0 0;">
                  <h1 style="color: white; margin: 0;">Document Expired</h1>
                </div>
                <div style="padding: 25px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                  <p>Hi ${invInfo.name},</p>
                  <p>The document <strong>"${doc.document_name}"</strong> has expired and can no longer be signed.</p>
                  <p>Please contact the Success Team if you need a new copy.</p>
                </div>
              </div>`
            );
          }
        }
      }

      const { data: soonExpiring } = await supabase
        .from('document_signatures').select('*')
        .in('signature_status', ['pending', 'viewed'])
        .not('expires_at', 'is', null)
        .gt('expires_at', now.toISOString())
        .lt('expires_at', threeDaysFromNow.toISOString());

      if (soonExpiring && soonExpiring.length > 0) {
        for (const doc of soonExpiring) {
          if (doc.last_reminder_at) {
            const lastReminder = new Date(doc.last_reminder_at);
            if (now.getTime() - lastReminder.getTime() < 20 * 60 * 60 * 1000) continue;
          }
          const invInfo = await getInvestorInfo(doc.investor_id, doc);
          if (invInfo.email) {
            const expiresDate = new Date(doc.expires_at);
            const daysLeft = Math.ceil((expiresDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
            await sendEmail(invInfo.email, `URGENT: ${doc.document_name} expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
              `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #f59e0b; padding: 25px; text-align: center; border-radius: 12px 12px 0 0;">
                  <h1 style="color: white; margin: 0;">Expiring Soon!</h1>
                </div>
                <div style="padding: 25px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                  <p>Hi ${invInfo.name},</p>
                  <p style="color: #dc2626; font-weight: bold;">Your document "${doc.document_name}" expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}!</p>
                  <p>Please sign it before <strong>${expiresDate.toLocaleDateString()}</strong>.</p>
                  <div style="text-align: center; margin: 25px 0;">
                    <a href="https://accessyourplace.com/investor" style="background: #dc2626; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: bold;">Sign Now</a>
                  </div>
                </div>
              </div>`
            );
            await supabase.from('document_signatures').update({
              reminder_count: (doc.reminder_count || 0) + 1,
              last_reminder_at: now.toISOString()
            }).eq('id', doc.id);
            warningsSent++;
          }
        }
      }

      return new Response(JSON.stringify({ success: true, expired: expiredCount, warnings_sent: warningsSent }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[manage-document-signatures] Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
