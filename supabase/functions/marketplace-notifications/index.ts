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

async function db(path: string, method: string, body?: any) {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal' },
    body: body ? JSON.stringify(body) : undefined
  });
  return method === 'GET' || method === 'POST' ? res.json() : res.ok;
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Access Your Place <marketplace@accessyourplace.com>', to, subject, html })
    });
  } catch (e) { console.error('Email error:', e); }
}

async function sendSMS(phone: string, message: string) {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const auth = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_PHONE_NUMBER');
  if (!sid || !auth || !from) return;
  
  const formattedPhone = phone.startsWith('1') ? `+${phone}` : `+1${phone.replace(/\D/g, '')}`;
  try {
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${sid}:${auth}`),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ To: formattedPhone, From: from, Body: message })
    });
  } catch (e) { console.error('SMS error:', e); }
}

async function getInvestorPrefs(investorId: string) {
  const inv = await db(`investors?id=eq.${investorId}&select=email,full_name,phone,email_notifications,notification_preferences`, 'GET');
  return inv?.[0] || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { notification_type, ...data } = await req.json();

    // Private Deal Received
    if (notification_type === 'private_deal_received') {
      const { buyer_id, listing_id, seller_name, property_address, asking_price } = data;
      const buyer = await getInvestorPrefs(buyer_id);
      if (!buyer) return new Response(JSON.stringify({ success: false, error: 'Buyer not found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      if (buyer.email_notifications?.marketplace_updates !== false) {
        await sendEmail(buyer.email, 'You Received a Private Deal Offer!', `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1a365d 0%, #2d4a7c 100%); padding: 30px; text-align: center;">
              <h1 style="color: #d4a574; margin: 0;">Private Deal Offer</h1>
            </div>
            <div style="padding: 30px; background: #ffffff;">
              <h2 style="color: #1a365d;">Hi ${buyer.full_name || 'Investor'},</h2>
              <p style="color: #475569; line-height: 1.6;">
                <strong>${seller_name}</strong> has sent you a private deal offer!
              </p>
              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>Property:</strong> ${property_address}</p>
                <p style="margin: 0;"><strong>Asking Price:</strong> $${Number(asking_price).toLocaleString()}</p>
              </div>
              <p style="color: #475569;">Log in to your investor portal to view the full details and respond.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://accessyourplace.com/investor" style="background: #d4a574; color: #1a365d; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                  View Deal
                </a>
              </div>
            </div>
          </div>
        `);
      }

      if (buyer.phone && buyer.notification_preferences?.sms_notifications?.marketplace_updates !== false) {
        await sendSMS(buyer.phone, `[AYP] You received a private deal offer from ${seller_name} for ${property_address}. Log in to view details.`);
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verification Requested
    if (notification_type === 'verification_requested') {
      const { seller_id, listing_id, property_address, fee_amount } = data;
      const seller = await getInvestorPrefs(seller_id);
      if (!seller) return new Response(JSON.stringify({ success: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      if (seller.email_notifications?.marketplace_verification !== false) {
        await sendEmail(seller.email, 'Verification Requested for Your Listing', `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1a365d 0%, #2d4a7c 100%); padding: 30px; text-align: center;">
              <h1 style="color: #d4a574; margin: 0;">Verification Requested</h1>
            </div>
            <div style="padding: 30px; background: #ffffff;">
              <h2 style="color: #1a365d;">Hi ${seller.full_name || 'Investor'},</h2>
              <p style="color: #475569; line-height: 1.6;">
                A buyer has requested verification for your listing at <strong>${property_address}</strong>.
              </p>
              <p style="color: #475569;">
                The verification fee of <strong>$${fee_amount}</strong> has been paid. Our team will begin the verification process shortly.
              </p>
              <p style="color: #475569;">
                You'll receive updates as the verification progresses.
              </p>
            </div>
          </div>
        `);
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verification Completed
    if (notification_type === 'verification_completed') {
      const { buyer_id, seller_id, listing_id, property_address, status, notes } = data;
      const passed = status === 'passed';
      
      // Notify buyer
      const buyer = await getInvestorPrefs(buyer_id);
      if (buyer?.email_notifications?.marketplace_verification !== false) {
        await sendEmail(buyer.email, `Verification ${passed ? 'Passed' : 'Failed'}: ${property_address}`, `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: ${passed ? '#059669' : '#dc2626'}; padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">Verification ${passed ? 'Passed' : 'Failed'}</h1>
            </div>
            <div style="padding: 30px; background: #ffffff;">
              <h2 style="color: #1a365d;">Hi ${buyer.full_name || 'Investor'},</h2>
              <p style="color: #475569; line-height: 1.6;">
                The verification for <strong>${property_address}</strong> has been completed.
              </p>
              <div style="background: ${passed ? '#ecfdf5' : '#fef2f2'}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${passed ? '#059669' : '#dc2626'};">
                <p style="margin: 0; font-weight: bold; color: ${passed ? '#059669' : '#dc2626'};">
                  Status: ${passed ? 'PASSED' : 'FAILED'}
                </p>
                ${notes ? `<p style="margin: 10px 0 0 0; color: #475569;">${notes}</p>` : ''}
              </div>
              ${passed ? `
                <p style="color: #475569;">You can now proceed to release the full verification report for $99.</p>
              ` : `
                <p style="color: #475569;">Unfortunately, this property did not pass our verification process. Please contact support for more details.</p>
              `}
            </div>
          </div>
        `);
      }

      if (buyer?.phone && buyer.notification_preferences?.sms_notifications?.marketplace_updates !== false) {
        await sendSMS(buyer.phone, `[AYP] Verification ${passed ? 'PASSED' : 'FAILED'} for ${property_address}. Log in for details.`);
      }

      // Notify seller
      const seller = await getInvestorPrefs(seller_id);
      if (seller?.email_notifications?.marketplace_verification !== false) {
        await sendEmail(seller.email, `Your Listing Verification: ${passed ? 'Passed' : 'Failed'}`, `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: ${passed ? '#059669' : '#dc2626'}; padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">Verification ${passed ? 'Passed' : 'Failed'}</h1>
            </div>
            <div style="padding: 30px; background: #ffffff;">
              <h2 style="color: #1a365d;">Hi ${seller.full_name || 'Investor'},</h2>
              <p style="color: #475569;">
                The verification for your listing at <strong>${property_address}</strong> has been completed.
              </p>
              <p style="color: ${passed ? '#059669' : '#dc2626'}; font-weight: bold;">
                Result: ${passed ? 'PASSED' : 'FAILED'}
              </p>
            </div>
          </div>
        `);
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Report Released
    if (notification_type === 'report_released') {
      const { buyer_id, listing_id, property_address } = data;
      const buyer = await getInvestorPrefs(buyer_id);
      if (!buyer) return new Response(JSON.stringify({ success: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      if (buyer.email_notifications?.marketplace_verification !== false) {
        await sendEmail(buyer.email, 'Verification Report Released', `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1a365d 0%, #2d4a7c 100%); padding: 30px; text-align: center;">
              <h1 style="color: #d4a574; margin: 0;">Report Available</h1>
            </div>
            <div style="padding: 30px; background: #ffffff;">
              <h2 style="color: #1a365d;">Hi ${buyer.full_name || 'Investor'},</h2>
              <p style="color: #475569; line-height: 1.6;">
                The full verification report for <strong>${property_address}</strong> is now available in your portal.
              </p>
              <p style="color: #475569;">
                The report includes detailed verification results, lease information, and our team's assessment.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://accessyourplace.com/investor" style="background: #d4a574; color: #1a365d; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                  View Report
                </a>
              </div>
            </div>
          </div>
        `);
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Transaction Status Change
    if (notification_type === 'transaction_status_change') {
      const { buyer_id, seller_id, listing_id, property_address, old_status, new_status, notes } = data;
      
      const statusLabels: Record<string, string> = {
        pending: 'Pending',
        documents_pending: 'Documents Pending',
        documents_signed: 'Documents Signed',
        access_transferred: 'Access Transferred',
        funds_held: 'Funds Held in Escrow',
        funds_released: 'Funds Released',
        completed: 'Completed',
        cancelled: 'Cancelled',
        refunded: 'Refunded'
      };

      // Notify buyer
      const buyer = await getInvestorPrefs(buyer_id);
      if (buyer?.email_notifications?.marketplace_transaction !== false) {
        await sendEmail(buyer.email, `Transaction Update: ${property_address}`, `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1a365d 0%, #2d4a7c 100%); padding: 30px; text-align: center;">
              <h1 style="color: #d4a574; margin: 0;">Transaction Update</h1>
            </div>
            <div style="padding: 30px; background: #ffffff;">
              <h2 style="color: #1a365d;">Hi ${buyer.full_name || 'Investor'},</h2>
              <p style="color: #475569; line-height: 1.6;">
                Your transaction for <strong>${property_address}</strong> has been updated.
              </p>
              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>Previous Status:</strong> ${statusLabels[old_status] || old_status}</p>
                <p style="margin: 0; color: #059669;"><strong>New Status:</strong> ${statusLabels[new_status] || new_status}</p>
                ${notes ? `<p style="margin: 10px 0 0 0; font-style: italic;">${notes}</p>` : ''}
              </div>
              <p style="color: #475569;">Log in to your portal for more details.</p>
            </div>
          </div>
        `);
      }

      if (buyer?.phone && buyer.notification_preferences?.sms_notifications?.marketplace_updates !== false) {
        await sendSMS(buyer.phone, `[AYP] Transaction update for ${property_address}: ${statusLabels[new_status] || new_status}. Log in for details.`);
      }

      // Notify seller
      const seller = await getInvestorPrefs(seller_id);
      if (seller?.email_notifications?.marketplace_transaction !== false) {
        await sendEmail(seller.email, `Transaction Update: ${property_address}`, `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1a365d 0%, #2d4a7c 100%); padding: 30px; text-align: center;">
              <h1 style="color: #d4a574; margin: 0;">Transaction Update</h1>
            </div>
            <div style="padding: 30px; background: #ffffff;">
              <h2 style="color: #1a365d;">Hi ${seller.full_name || 'Investor'},</h2>
              <p style="color: #475569;">
                The transaction for your listing at <strong>${property_address}</strong> has been updated.
              </p>
              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #059669;"><strong>New Status:</strong> ${statusLabels[new_status] || new_status}</p>
              </div>
            </div>
          </div>
        `);
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Deal Approved/Rejected for Public Listing
    if (notification_type === 'listing_status_change') {
      const { seller_id, listing_id, property_address, status, rejection_reason } = data;
      const seller = await getInvestorPrefs(seller_id);
      if (!seller) return new Response(JSON.stringify({ success: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const approved = status === 'approved' || status === 'published';

      if (seller.email_notifications?.marketplace_updates !== false) {
        await sendEmail(seller.email, `Listing ${approved ? 'Approved' : 'Rejected'}: ${property_address}`, `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: ${approved ? '#059669' : '#dc2626'}; padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">Listing ${approved ? 'Approved' : 'Rejected'}</h1>
            </div>
            <div style="padding: 30px; background: #ffffff;">
              <h2 style="color: #1a365d;">Hi ${seller.full_name || 'Investor'},</h2>
              <p style="color: #475569; line-height: 1.6;">
                Your listing for <strong>${property_address}</strong> has been ${approved ? 'approved and is now live on the marketplace' : 'rejected'}.
              </p>
              ${!approved && rejection_reason ? `
                <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
                  <p style="margin: 0; color: #dc2626;"><strong>Reason:</strong> ${rejection_reason}</p>
                </div>
              ` : ''}
              ${approved ? `
                <p style="color: #475569;">Potential buyers can now view and inquire about your listing.</p>
              ` : `
                <p style="color: #475569;">Please review the feedback and resubmit your listing with the necessary corrections.</p>
              `}
            </div>
          </div>
        `);
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Funds Released
    if (notification_type === 'funds_released') {
      const { seller_id, listing_id, property_address, amount, fee_amount, net_amount } = data;
      const seller = await getInvestorPrefs(seller_id);
      if (!seller) return new Response(JSON.stringify({ success: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      if (seller.email_notifications?.marketplace_transaction !== false) {
        await sendEmail(seller.email, 'Funds Released: Transaction Complete!', `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">Funds Released!</h1>
            </div>
            <div style="padding: 30px; background: #ffffff;">
              <h2 style="color: #1a365d;">Congratulations, ${seller.full_name || 'Investor'}!</h2>
              <p style="color: #475569; line-height: 1.6;">
                The transaction for <strong>${property_address}</strong> has been completed successfully.
              </p>
              <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>Sale Amount:</strong> $${Number(amount).toLocaleString()}</p>
                <p style="margin: 0 0 10px 0;"><strong>AYP Fee (20%):</strong> -$${Number(fee_amount).toLocaleString()}</p>
                <p style="margin: 0; font-size: 1.2em; color: #059669;"><strong>Net Amount:</strong> $${Number(net_amount).toLocaleString()}</p>
              </div>
              <p style="color: #475569;">
                The funds have been released and will be transferred to your account within 1-3 business days.
              </p>
              <p style="color: #475569;">
                Thank you for using Access Your Place Marketplace!
              </p>
            </div>
          </div>
        `);
      }

      if (seller.phone && seller.notification_preferences?.sms_notifications?.marketplace_updates !== false) {
        await sendSMS(seller.phone, `[AYP] Congratulations! $${Number(net_amount).toLocaleString()} has been released for your sale of ${property_address}.`);
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Success Manager Assigned
    if (notification_type === 'success_manager_assigned') {
      const { buyer_id, seller_id, listing_id, property_address, manager_name } = data;

      // Notify both parties
      for (const id of [buyer_id, seller_id]) {
        const inv = await getInvestorPrefs(id);
        if (inv?.email_notifications?.marketplace_transaction !== false) {
          await sendEmail(inv.email, 'Success Manager Assigned to Your Transaction', `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #1a365d 0%, #2d4a7c 100%); padding: 30px; text-align: center;">
                <h1 style="color: #d4a574; margin: 0;">Success Manager Assigned</h1>
              </div>
              <div style="padding: 30px; background: #ffffff;">
                <h2 style="color: #1a365d;">Hi ${inv.full_name || 'Investor'},</h2>
                <p style="color: #475569; line-height: 1.6;">
                  Great news! <strong>${manager_name}</strong> has been assigned as your Success Manager for the transaction at <strong>${property_address}</strong>.
                </p>
                <p style="color: #475569;">
                  Your Success Manager will guide you through the entire transaction process, ensuring:
                </p>
                <ul style="color: #475569;">
                  <li>All documents are properly prepared and signed</li>
                  <li>Access credentials are transferred securely</li>
                  <li>Funds are released at the appropriate time</li>
                  <li>Any questions or issues are resolved promptly</li>
                </ul>
                <p style="color: #475569;">
                  You can expect to hear from ${manager_name} shortly to begin the process.
                </p>
              </div>
            </div>
          `);
        }
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown notification type' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

