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

async function sendEmail(to: string, subject: string, html: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    console.log('No Resend API key configured');
    return { success: false, error: 'No Resend key' };
  }
  
  try {
    console.log(`Sending email to: ${to}, subject: ${subject}`);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${resendKey}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        from: 'Access Your Place <notifications@accessyourplace.com>', 
        to: [to], 
        subject, 
        html 
      })
    });
    
    const result = await res.json();
    console.log('Resend response:', res.status, JSON.stringify(result));
    
    if (!res.ok) {
      return { success: false, error: result.message || 'Email send failed' };
    }
    
    // Log the email
    try {
      await supabase.from('email_logs').insert({
        template_type: 'notification',
        recipient_email: to,
        subject,
        status: 'sent',
        resend_id: result.id
      });
    } catch (logErr) {
      console.log('Email log error (non-critical):', logErr);
    }
    
    return { success: true, id: result.id };
  } catch (err: any) {
    console.error('Email send error:', err);
    return { success: false, error: err.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { action, inquiryId, newStatus, propertyAddress, investor_id, property_data, acquisition_data, referral_data, report_data } = await req.json();

    console.log('Notification action:', action);

    // Handle different notification types
    if (action === 'inquiry_status') {
      const { data: inquiry, error: inquiryError } = await supabase
        .from('deal_inquiries')
        .select('*, investors(*)')
        .eq('id', inquiryId)
        .single();
      
      if (inquiryError || !inquiry?.investors) {
        console.error('Inquiry fetch error:', inquiryError);
        throw new Error('Inquiry or investor not found');
      }
      
      const investor = inquiry.investors;
      
      const statusMessages: Record<string, string> = {
        'reviewing': 'Your inquiry is now being reviewed by our team.',
        'contacted': 'Our team has reached out regarding your inquiry.',
        'scheduled': 'A viewing or call has been scheduled.',
        'converted': 'Congratulations! Your inquiry has been converted to an acquisition.',
        'closed': 'Your inquiry has been closed.'
      };

      // Create in-app notification
      await supabase.from('investor_notifications').insert({
        investor_id: investor.id, 
        type: 'inquiry_status',
        title: `Inquiry Update: ${newStatus}`,
        message: `${statusMessages[newStatus] || 'Status updated.'} Property: ${propertyAddress || 'N/A'}`,
        data: { inquiryId, newStatus, propertyAddress }
      });

      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#1e3a5f,#2d5a87);color:white;padding:30px;text-align:center;border-radius:8px 8px 0 0">
            <h1 style="margin:0;font-size:24px;">Inquiry Status Update</h1>
          </div>
          <div style="padding:30px;background:#fff;border:1px solid #e5e5e5">
            <p style="margin:0 0 15px;">Hi ${investor.full_name || 'Investor'},</p>
            <p style="margin:0 0 15px;">${statusMessages[newStatus] || 'Your inquiry status has been updated.'}</p>
            <p style="margin:0 0 20px;"><strong>Property:</strong> ${propertyAddress || 'N/A'}</p>
            <a href="https://accessyourplace.com/investor" style="display:inline-block;background:#f59e0b;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">View Details</a>
          </div>
          <div style="background:#f8f9fa;padding:20px;text-align:center;font-size:12px;color:#666;border-radius:0 0 8px 8px">
            Access Your Place | Rental Arbitrage Made Simple
          </div>
        </div>
      `;
      
      const emailResult = await sendEmail(investor.email, `Inquiry Update: ${newStatus}`, emailHtml);
      console.log('Inquiry status email result:', emailResult);
    }

    if (action === 'deal_alert') {
      const { data: investor, error: invError } = await supabase
        .from('investors')
        .select('*')
        .eq('id', investor_id)
        .single();
      
      if (invError || !investor) {
        console.error('Investor fetch error:', invError);
        throw new Error('Investor not found');
      }
      
      // Create in-app notification
      await supabase.from('investor_notifications').insert({
        investor_id: investor.id, 
        type: 'deal_alert',
        title: `New Deal: ${property_data.city}, ${property_data.state}`,
        message: `A new ${property_data.bedrooms}BR/${property_data.bathrooms}BA property matching your criteria is available.`,
        data: property_data
      });

      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#1e3a5f,#2d5a87);color:white;padding:30px;text-align:center;border-radius:8px 8px 0 0">
            <h1 style="margin:0;font-size:24px;">New Investment Opportunity</h1>
          </div>
          <div style="padding:30px;background:#fff;border:1px solid #e5e5e5">
            <p style="margin:0 0 15px;">Hi ${investor.full_name || 'Investor'},</p>
            <p style="margin:0 0 15px;">A new deal matching your criteria is available!</p>
            <div style="background:#f8f9fa;padding:20px;border-radius:8px;margin:20px 0">
              <h3 style="margin:0 0 10px;color:#1e3a5f;">${property_data.property_type || 'Property'} - ${property_data.city}, ${property_data.state}</h3>
              <p style="margin:0;"><strong>Bedrooms:</strong> ${property_data.bedrooms}<br><strong>Bathrooms:</strong> ${property_data.bathrooms}<br><strong>Est. Revenue:</strong> ${property_data.estimated_rent || 'Contact for details'}</p>
            </div>
            <a href="https://accessyourplace.com/investor" style="display:inline-block;background:#f59e0b;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">View Deal</a>
          </div>
          <div style="background:#f8f9fa;padding:20px;text-align:center;font-size:12px;color:#666;border-radius:0 0 8px 8px">
            Access Your Place
          </div>
        </div>
      `;
      
      const emailResult = await sendEmail(investor.email, `New Deal: ${property_data.city}, ${property_data.state}`, emailHtml);
      console.log('Deal alert email result:', emailResult);
    }

    if (action === 'acquisition_update') {
      const { data: investor, error: invError } = await supabase
        .from('investors')
        .select('*')
        .eq('id', investor_id)
        .single();
      
      if (invError || !investor) {
        console.error('Investor fetch error:', invError);
        throw new Error('Investor not found');
      }

      // Create in-app notification
      await supabase.from('investor_notifications').insert({
        investor_id: investor.id, 
        type: 'acquisition_update',
        title: `Acquisition Update: ${acquisition_data.new_stage}`,
        message: `Your acquisition for ${acquisition_data.property_address} has moved to ${acquisition_data.new_stage}.`,
        data: acquisition_data
      });

      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#1e3a5f,#2d5a87);color:white;padding:30px;text-align:center;border-radius:8px 8px 0 0">
            <h1 style="margin:0;font-size:24px;">Acquisition Progress</h1>
          </div>
          <div style="padding:30px;background:#fff;border:1px solid #e5e5e5">
            <p style="margin:0 0 15px;">Hi ${investor.full_name || 'Investor'},</p>
            <p style="margin:0 0 15px;">Great news! Your acquisition has progressed.</p>
            <div style="background:#f8f9fa;padding:20px;border-radius:8px;margin:20px 0">
              <h3 style="margin:0 0 10px;color:#1e3a5f;">${acquisition_data.property_address}</h3>
              <p style="margin:0;"><strong>New Stage:</strong> <span style="background:#10b981;color:#fff;padding:4px 12px;border-radius:20px">${acquisition_data.new_stage}</span></p>
            </div>
            <a href="https://accessyourplace.com/investor" style="display:inline-block;background:#f59e0b;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">View Details</a>
          </div>
          <div style="background:#f8f9fa;padding:20px;text-align:center;font-size:12px;color:#666;border-radius:0 0 8px 8px">
            Access Your Place
          </div>
        </div>
      `;
      
      const emailResult = await sendEmail(investor.email, `Acquisition Update: ${acquisition_data.new_stage}`, emailHtml);
      console.log('Acquisition update email result:', emailResult);
    }

    if (action === 'referral_reward') {
      const { data: investor, error: invError } = await supabase
        .from('investors')
        .select('*')
        .eq('id', investor_id)
        .single();
      
      if (invError || !investor) {
        console.error('Investor fetch error:', invError);
        throw new Error('Investor not found');
      }

      // Create in-app notification
      await supabase.from('investor_notifications').insert({
        investor_id: investor.id, 
        type: 'referral_reward',
        title: `Referral Reward: ${referral_data.reward_amount}`,
        message: `Your referral ${referral_data.referred_name} completed their first acquisition!`,
        data: referral_data
      });

      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#059669,#10b981);color:white;padding:30px;text-align:center;border-radius:8px 8px 0 0">
            <h1 style="margin:0;font-size:24px;">Congratulations!</h1>
            <p style="margin:10px 0 0;">You Earned a Referral Reward</p>
          </div>
          <div style="padding:30px;background:#fff;border:1px solid #e5e5e5">
            <p style="margin:0 0 15px;">Hi ${investor.full_name || 'Investor'},</p>
            <p style="margin:0 0 15px;">Your referral ${referral_data.referred_name} has completed their first acquisition!</p>
            <div style="background:linear-gradient(135deg,#fef3c7,#fde68a);padding:30px;border-radius:8px;text-align:center;margin:20px 0">
              <p style="margin:0;color:#92400e;">Your Reward</p>
              <p style="font-size:48px;font-weight:bold;color:#d97706;margin:10px 0">${referral_data.reward_amount}</p>
            </div>
            <a href="https://accessyourplace.com/investor" style="display:inline-block;background:#f59e0b;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">View Rewards</a>
          </div>
          <div style="background:#f8f9fa;padding:20px;text-align:center;font-size:12px;color:#666;border-radius:0 0 8px 8px">
            Access Your Place
          </div>
        </div>
      `;
      
      const emailResult = await sendEmail(investor.email, `Referral Reward: ${referral_data.reward_amount}`, emailHtml);
      console.log('Referral reward email result:', emailResult);
    }

    if (action === 'welcome_email') {
      const { data: investor, error: invError } = await supabase
        .from('investors')
        .select('*')
        .eq('id', investor_id)
        .single();
      
      if (invError || !investor) {
        console.error('Investor fetch error:', invError);
        throw new Error('Investor not found');
      }

      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#1e3a5f,#2d5a87);color:white;padding:30px;text-align:center;border-radius:8px 8px 0 0">
            <h1 style="margin:0;font-size:24px;">Welcome to Access Your Place!</h1>
          </div>
          <div style="padding:30px;background:#fff;border:1px solid #e5e5e5">
            <p style="margin:0 0 15px;">Hi ${investor.full_name || 'Investor'},</p>
            <p style="margin:0 0 15px;">Welcome to Access Your Place! We're excited to have you join our community of rental arbitrage investors.</p>
            <p style="margin:0 0 15px;">Here's what you can do next:</p>
            <ul style="margin:0 0 20px;padding-left:20px;">
              <li>Browse our vetted deal flow</li>
              <li>Use Penny AI to find properties</li>
              <li>Book a discovery call with our team</li>
              <li>Explore our Knowledge Library</li>
            </ul>
            <a href="https://accessyourplace.com/investor" style="display:inline-block;background:#f59e0b;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">Go to Your Dashboard</a>
          </div>
          <div style="background:#f8f9fa;padding:20px;text-align:center;font-size:12px;color:#666;border-radius:0 0 8px 8px">
            Access Your Place | Rental Arbitrage Made Simple
          </div>
        </div>
      `;
      
      const emailResult = await sendEmail(investor.email, 'Welcome to Access Your Place!', emailHtml);
      console.log('Welcome email result:', emailResult);
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  } catch (error: any) {
    console.error('Notification error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});

