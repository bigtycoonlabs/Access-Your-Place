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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    console.log('[check-document-expirations] Running daily check at', now.toISOString());

    // Helper: send email via Resend
    async function sendEmail(to: string, subject: string, html: string) {
      if (!RESEND_API_KEY || !to) return false;
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Penny <penny@accessyourplace.com>', reply_to: ['success@accessyourplace.com'],
            to: [to],
            subject,
            html
          })
        });
        const result = await res.json();
        console.log('[email] Sent to', to, '- OK:', res.ok);
        return res.ok;
      } catch (e) {
        console.error('[email] Failed:', e);
        return false;
      }
    }

    // Helper: get investor info
    async function getInvestorInfo(investorId: string, doc: any): Promise<{ email: string; name: string }> {
      let email = doc.investor_email || '';
      let name = doc.investor_name || '';
      if (!email && investorId) {
        try {
          const { data: inv } = await supabase.from('investors').select('full_name, email').eq('id', investorId).single();
          if (inv) { email = inv.email || ''; name = inv.full_name || name; }
        } catch (e) {}
      }
      return { email, name };
    }

    let expiredCount = 0;
    let warningsSent = 0;
    let emailsSent = 0;

    // ===== STEP 1: Mark expired documents =====
    const { data: expiredDocs, error: expErr } = await supabase
      .from('document_signatures')
      .select('*')
      .in('signature_status', ['pending', 'viewed'])
      .not('expires_at', 'is', null)
      .lt('expires_at', now.toISOString());

    if (!expErr && expiredDocs && expiredDocs.length > 0) {
      const expiredIds = expiredDocs.map((d: any) => d.id);
      
      // Batch update status to expired
      const { error: updateErr } = await supabase
        .from('document_signatures')
        .update({ signature_status: 'expired', updated_at: now.toISOString() })
        .in('id', expiredIds);
      
      if (updateErr) {
        console.error('[check-document-expirations] Failed to mark expired:', updateErr);
      } else {
        expiredCount = expiredIds.length;
        console.log(`[check-document-expirations] Marked ${expiredCount} documents as expired`);
      }

      // Send expiration notice emails to each investor
      for (const doc of expiredDocs) {
        try {
          const invInfo = await getInvestorInfo(doc.investor_id, doc);
          if (invInfo.email) {
            const sent = await sendEmail(
              invInfo.email,
              `Document Expired: ${doc.document_name}`,
              `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 30px; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 22px;">Document Expired</h1>
                </div>
                <div style="padding: 30px; background: #ffffff;">
                  <p>Hi ${invInfo.name || 'Investor'},</p>
                  <p>The following document has expired and can no longer be signed:</p>
                  <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                    <strong style="font-size: 16px;">${doc.document_name}</strong><br/>
                    <span style="color: #666;">Type: ${doc.document_type || 'Agreement'}</span><br/>
                    <span style="color: #dc2626;">Expired: ${new Date(doc.expires_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <p>If you still need to sign this document, please contact the Success Team to request a new copy.</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="https://accessyourplace.com/investor" style="background: #d4a574; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Contact Success Team</a>
                  </div>
                </div>
                <div style="padding: 15px; background: #f8f9fa; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #999;">Access Your Place - Investor Portal</p>
                </div>
              </div>`
            );
            if (sent) emailsSent++;
          }
        } catch (e) {
          console.error('[check-document-expirations] Error sending expiration email:', e);
        }
      }
    } else {
      console.log('[check-document-expirations] No expired documents found');
    }

    // ===== STEP 2: Send 3-day expiration warnings =====
    const { data: soonExpiring, error: warnErr } = await supabase
      .from('document_signatures')
      .select('*')
      .in('signature_status', ['pending', 'viewed'])
      .not('expires_at', 'is', null)
      .gt('expires_at', now.toISOString())
      .lt('expires_at', threeDaysFromNow.toISOString());

    if (!warnErr && soonExpiring && soonExpiring.length > 0) {
      console.log(`[check-document-expirations] Found ${soonExpiring.length} documents expiring within 3 days`);
      
      for (const doc of soonExpiring) {
        try {
          // Throttle: skip if we already sent a reminder within the last 20 hours
          if (doc.last_reminder_at) {
            const lastReminder = new Date(doc.last_reminder_at);
            const hoursSinceLastReminder = (now.getTime() - lastReminder.getTime()) / (1000 * 60 * 60);
            if (hoursSinceLastReminder < 20) {
              console.log(`[check-document-expirations] Skipping ${doc.id} - reminded ${hoursSinceLastReminder.toFixed(1)}h ago`);
              continue;
            }
          }

          const invInfo = await getInvestorInfo(doc.investor_id, doc);
          if (!invInfo.email) continue;

          const expiresDate = new Date(doc.expires_at);
          const daysLeft = Math.max(1, Math.ceil((expiresDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
          const hoursLeft = Math.max(1, Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60)));
          const urgency = daysLeft <= 1 ? 'FINAL WARNING' : 'URGENT';

          const sent = await sendEmail(
            invInfo.email,
            `${urgency}: "${doc.document_name}" expires in ${daysLeft <= 1 ? `${hoursLeft} hours` : `${daysLeft} days`}!`,
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: ${daysLeft <= 1 ? '#dc2626' : '#f59e0b'}; padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 22px;">${urgency}: Document Expiring Soon</h1>
              </div>
              <div style="padding: 30px; background: #ffffff;">
                <p>Hi ${invInfo.name || 'Investor'},</p>
                <p style="color: #dc2626; font-weight: bold; font-size: 16px;">
                  Your document expires in ${daysLeft <= 1 ? `${hoursLeft} hours` : `${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}!
                </p>
                <div style="background: ${daysLeft <= 1 ? '#fef2f2' : '#fffbeb'}; border-left: 4px solid ${daysLeft <= 1 ? '#dc2626' : '#f59e0b'}; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                  <strong style="font-size: 16px;">${doc.document_name}</strong><br/>
                  <span style="color: #dc2626; font-weight: bold;">Expires: ${expiresDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${expiresDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p>Please sign this document before it expires. Once expired, you will need to request a new copy from the Success Team.</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="https://accessyourplace.com/investor" style="background: ${daysLeft <= 1 ? '#dc2626' : '#f59e0b'}; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Sign Now Before It Expires</a>
                </div>
                <p style="color: #999; font-size: 12px; text-align: center;">This is an automated reminder. You will not receive another reminder for at least 20 hours.</p>
              </div>
              <div style="padding: 15px; background: #f8f9fa; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #999;">Access Your Place - Investor Portal</p>
              </div>
            </div>`
          );

          if (sent) {
            emailsSent++;
            warningsSent++;
          }

          // Update reminder tracking
          await supabase
            .from('document_signatures')
            .update({
              reminder_count: (doc.reminder_count || 0) + 1,
              last_reminder_at: now.toISOString(),
              updated_at: now.toISOString()
            })
            .eq('id', doc.id);

        } catch (e) {
          console.error('[check-document-expirations] Error processing warning for doc:', doc.id, e);
        }
      }
    } else {
      console.log('[check-document-expirations] No documents expiring within 3 days');
    }

    const summary = {
      success: true,
      run_at: now.toISOString(),
      expired_documents: expiredCount,
      warnings_sent: warningsSent,
      total_emails_sent: emailsSent,
      soon_expiring_found: soonExpiring?.length || 0
    };

    console.log('[check-document-expirations] Summary:', JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[check-document-expirations] Fatal error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Internal error',
      run_at: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
