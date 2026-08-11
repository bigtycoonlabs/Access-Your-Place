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

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

// Send email notification
async function sendEmailAlert(to: string, investorName: string, deals: any[]): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  
  const dealsList = deals.map(d => `
    <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <h3 style="margin: 0 0 8px 0; color: #1a365d;">${d.city}, ${d.state} ${d.zip_code || ''}</h3>
      <p style="margin: 4px 0; color: #4b5563;">${d.bedrooms} BR / ${d.bathrooms} BA â€¢ ${d.operation_type || 'STR'}</p>
      <p style="margin: 4px 0; color: #059669; font-weight: bold;">Projected Revenue: $${d.projected_revenue?.toLocaleString() || 'TBD'}/mo</p>
      <a href="https://accessyourplace.com/deals/${d.id}" style="display: inline-block; margin-top: 12px; padding: 8px 16px; background: #d4a574; color: white; text-decoration: none; border-radius: 4px;">View Deal</a>
    </div>
  `).join('');
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Penny <penny@accessyourplace.com>', reply_to: ['success@accessyourplace.com'],
        to: [to],
        subject: `ðŸ  ${deals.length} New Deal${deals.length > 1 ? 's' : ''} Matching Your Preferences!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1a365d 0%, #2d4a7c 100%); padding: 24px; text-align: center;">
              <h1 style="color: white; margin: 0;">Access Your Place</h1>
              <p style="color: #d4a574; margin: 8px 0 0 0;">New Deals Alert</p>
            </div>
            
            <div style="padding: 24px;">
              <p style="font-size: 16px; color: #374151;">Hi ${investorName.split(' ')[0]}!</p>
              
              <p style="font-size: 16px; color: #374151;">
                Great news! I found <strong>${deals.length} new deal${deals.length > 1 ? 's' : ''}</strong> that match your investment preferences. Here's what I've got for you:
              </p>
              
              ${dealsList}
              
              <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin-top: 24px;">
                <p style="margin: 0; color: #4b5563;">
                  <strong>ðŸ’¡ Penny's Tip:</strong> Before moving forward with any deal, I recommend scheduling a call with one of our acquisition managers. They'll ensure the property is the perfect fit for your goals!
                </p>
                <a href="https://accessyourplace.com/investor/portal" style="display: inline-block; margin-top: 12px; padding: 10px 20px; background: #1a365d; color: white; text-decoration: none; border-radius: 4px;">Book a Call</a>
              </div>
            </div>
            
            <div style="background: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                Penny AI â€¢ Your Success Manager at Access Your Place<br>
                <span style="font-size: 12px;">Set Up Your Place LLC</span>
              </p>
            </div>
          </div>
        `
      })
    });
    
    return response.ok;
  } catch (error) {
    console.error('Email alert error:', error);
    return false;
  }
}

// Send SMS notification
async function sendSMSAlert(to: string, investorName: string, dealCount: number): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) return false;
  
  try {
    const message = `Hi ${investorName.split(' ')[0]}! Penny here from Access Your Place. ðŸ  I found ${dealCount} new deal${dealCount > 1 ? 's' : ''} matching your preferences! Check your email or log in to view them. Questions? Reply to chat with me!`;
    
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          To: to,
          From: TWILIO_PHONE_NUMBER,
          Body: message
        })
      }
    );
    
    return response.ok;
  } catch (error) {
    console.error('SMS alert error:', error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { action, investor_id, preferences } = body;

    // Get investor deal preferences
    if (action === 'get_preferences') {
      const { data } = await supabase
        .from('investor_deal_preferences')
        .select('*')
        .eq('investor_id', investor_id)
        .single();

      // Transform to expected format
      const prefs = data ? {
        id: data.id,
        preferred_locations: data.target_markets || [],
        preferred_states: [],
        min_price: data.min_projected_revenue,
        max_price: data.max_monthly_rent,
        min_bedrooms: data.min_bedrooms,
        max_bedrooms: data.max_bedrooms,
        operation_types: data.operation_types || [],
        property_types: [],
        alerts_enabled: true,
        alert_frequency: 'instant',
        email_alerts: data.notify_email !== false,
        sms_alerts: data.notify_sms === true,
        push_alerts: true
      } : null;

      return new Response(JSON.stringify({
        success: true,
        preferences: prefs
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Save investor deal preferences
    if (action === 'save_preferences') {
      const { data, error } = await supabase
        .from('investor_deal_preferences')
        .upsert({
          investor_id,
          target_markets: preferences.preferred_locations || [],
          min_bedrooms: preferences.min_bedrooms,
          max_bedrooms: preferences.max_bedrooms,
          operation_types: preferences.operation_types || [],
          min_projected_revenue: preferences.min_price,
          max_monthly_rent: preferences.max_price,
          notify_email: preferences.email_alerts !== false,
          notify_sms: preferences.sms_alerts === true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'investor_id' })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        preferences: data,
        message: 'Deal alert preferences saved! You\'ll be notified when matching deals are listed.'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get alert history
    if (action === 'get_alert_history') {
      const { limit = 20 } = body;
      
      const { data } = await supabase
        .from('deal_alert_logs')
        .select(`
          *,
          properties:deal_id(city, state, bedrooms, bathrooms, projected_revenue)
        `)
        .eq('investor_id', investor_id)
        .order('created_at', { ascending: false })
        .limit(limit);

      const alerts = (data || []).map(log => ({
        id: log.id,
        property_id: log.deal_id,
        alert_type: 'new_deal',
        channels_sent: [
          log.email_sent && 'email',
          log.sms_sent && 'sms'
        ].filter(Boolean),
        match_score: 85, // Default score
        match_details: {},
        sent_at: log.created_at,
        properties: log.properties
      }));

      return new Response(JSON.stringify({
        success: true,
        alerts
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Preview matching deals
    if (action === 'preview_matches') {
      const prefs = preferences || {};
      
      let query = supabase
        .from('properties')
        .select('id, city, state, zip_code, bedrooms, bathrooms, projected_revenue, operation_type, monthly_rent')
        .eq('status', 'published')
        .limit(20);

      // Apply filters based on preferences
      if (prefs.min_bedrooms) {
        query = query.gte('bedrooms', prefs.min_bedrooms);
      }
      if (prefs.max_bedrooms) {
        query = query.lte('bedrooms', prefs.max_bedrooms);
      }
      if (prefs.operation_types?.length > 0) {
        query = query.in('operation_type', prefs.operation_types);
      }

      const { data: properties } = await query;

      // Calculate match scores
      const matches = (properties || []).map(prop => {
        let score = 50; // Base score
        
        // Location match
        if (prefs.preferred_locations?.length > 0) {
          if (prefs.preferred_locations.some((loc: string) => 
            prop.city?.toLowerCase().includes(loc.toLowerCase())
          )) {
            score += 30;
          }
        } else {
          score += 15; // No location preference = partial match
        }
        
        // Bedroom match
        if (prefs.min_bedrooms && prop.bedrooms >= prefs.min_bedrooms) {
          score += 10;
        }
        if (prefs.max_bedrooms && prop.bedrooms <= prefs.max_bedrooms) {
          score += 10;
        }
        
        // Operation type match
        if (prefs.operation_types?.includes(prop.operation_type)) {
          score += 10;
        }
        
        return {
          property: prop,
          match_score: Math.min(score, 100)
        };
      }).sort((a, b) => b.match_score - a.match_score);

      return new Response(JSON.stringify({
        success: true,
        matches
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Process new deal - find matching investors and notify them
    if (action === 'process_new_deal') {
      const { deal } = body;
      
      if (!deal) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Deal data is required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get all investor preferences
      const { data: allPrefs } = await supabase
        .from('investor_deal_preferences')
        .select('*');

      if (!allPrefs || allPrefs.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          notified: 0,
          message: 'No investor preferences configured'
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Find matching investors
      const matchingInvestorIds: string[] = [];
      
      for (const pref of allPrefs) {
        let matches = true;
        
        // Check location
        if (pref.target_markets?.length > 0) {
          const dealCity = deal.city?.toLowerCase();
          const marketMatch = pref.target_markets.some((m: string) => 
            dealCity?.includes(m.toLowerCase())
          );
          if (!marketMatch) matches = false;
        }
        
        // Check bedrooms
        if (pref.min_bedrooms && deal.bedrooms < pref.min_bedrooms) matches = false;
        if (pref.max_bedrooms && deal.bedrooms > pref.max_bedrooms) matches = false;
        
        // Check operation type
        if (pref.operation_types?.length > 0 && deal.operation_type) {
          if (!pref.operation_types.includes(deal.operation_type)) matches = false;
        }
        
        if (matches) {
          matchingInvestorIds.push(pref.investor_id);
        }
      }

      if (matchingInvestorIds.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          notified: 0,
          message: 'No matching investor preferences found'
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get investor details
      const { data: investors } = await supabase
        .from('investors')
        .select('id, email, first_name, last_name, phone')
        .in('id', matchingInvestorIds);

      // Get preferences for notification settings
      const prefMap = new Map(allPrefs.map(p => [p.investor_id, p]));

      let emailsSent = 0;
      let smsSent = 0;

      for (const investor of (investors || [])) {
        const pref = prefMap.get(investor.id);
        if (!pref) continue;
        
        const investorName = `${investor.first_name || ''} ${investor.last_name || ''}`.trim() || 'Investor';

        // Send email if enabled
        if (pref.notify_email && investor.email) {
          const sent = await sendEmailAlert(investor.email, investorName, [deal]);
          if (sent) emailsSent++;
        }

        // Send SMS if enabled
        if (pref.notify_sms && investor.phone) {
          const sent = await sendSMSAlert(investor.phone, investorName, 1);
          if (sent) smsSent++;
        }

        // Log the notification
        await supabase
          .from('deal_alert_logs')
          .insert({
            investor_id: investor.id,
            deal_id: deal.id,
            email_sent: pref.notify_email && investor.email,
            sms_sent: pref.notify_sms && investor.phone,
            created_at: new Date().toISOString()
          });
      }

      return new Response(JSON.stringify({
        success: true,
        notified: matchingInvestorIds.length,
        emails_sent: emailsSent,
        sms_sent: smsSent,
        message: `Notified ${matchingInvestorIds.length} investors about the new deal`
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Batch process - check all recent deals against all preferences
    if (action === 'batch_process') {
      const { hours_back = 24 } = body;
      
      const cutoffTime = new Date(Date.now() - hours_back * 60 * 60 * 1000).toISOString();
      
      // Get recent published deals
      const { data: recentDeals } = await supabase
        .from('properties')
        .select('*')
        .eq('status', 'published')
        .gte('created_at', cutoffTime);

      if (!recentDeals || recentDeals.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          processed: 0,
          message: 'No new deals to process'
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get all investor preferences
      const { data: allPrefs } = await supabase
        .from('investor_deal_preferences')
        .select('*');

      if (!allPrefs || allPrefs.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          processed: 0,
          message: 'No investor preferences configured'
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get all investors
      const investorIds = [...new Set(allPrefs.map(p => p.investor_id))];
      const { data: investors } = await supabase
        .from('investors')
        .select('id, email, first_name, last_name, phone')
        .in('id', investorIds);

      const investorMap = new Map((investors || []).map(i => [i.id, i]));
      const prefMap = new Map(allPrefs.map(p => [p.investor_id, p]));

      // Match deals to investors
      const investorMatches: Map<string, any[]> = new Map();

      for (const deal of recentDeals) {
        for (const pref of allPrefs) {
          let matches = true;

          if (pref.target_markets?.length > 0) {
            const dealCity = deal.city?.toLowerCase();
            const marketMatch = pref.target_markets.some((m: string) => 
              dealCity?.includes(m.toLowerCase())
            );
            if (!marketMatch) matches = false;
          }

          if (pref.min_bedrooms && deal.bedrooms < pref.min_bedrooms) matches = false;
          if (pref.max_bedrooms && deal.bedrooms > pref.max_bedrooms) matches = false;
          
          if (pref.operation_types?.length > 0 && deal.operation_type) {
            if (!pref.operation_types.includes(deal.operation_type)) matches = false;
          }

          if (matches) {
            const investorId = pref.investor_id;
            if (!investorMatches.has(investorId)) {
              investorMatches.set(investorId, []);
            }
            investorMatches.get(investorId)!.push(deal);
          }
        }
      }

      // Send notifications
      let totalNotified = 0;

      for (const [investorId, deals] of investorMatches) {
        if (deals.length === 0) continue;

        const investor = investorMap.get(investorId);
        const pref = prefMap.get(investorId);
        if (!investor || !pref) continue;

        const investorName = `${investor.first_name || ''} ${investor.last_name || ''}`.trim() || 'Investor';

        // Check if we already notified about these deals
        const dealIds = deals.map(d => d.id);
        const { data: existingLogs } = await supabase
          .from('deal_alert_logs')
          .select('deal_id')
          .eq('investor_id', investorId)
          .in('deal_id', dealIds);

        const alreadyNotified = new Set(existingLogs?.map(l => l.deal_id) || []);
        const newDeals = deals.filter(d => !alreadyNotified.has(d.id));

        if (newDeals.length === 0) continue;

        // Send notifications
        if (pref.notify_email && investor.email) {
          await sendEmailAlert(investor.email, investorName, newDeals);
        }

        if (pref.notify_sms && investor.phone) {
          await sendSMSAlert(investor.phone, investorName, newDeals.length);
        }

        // Log notifications
        for (const deal of newDeals) {
          await supabase
            .from('deal_alert_logs')
            .insert({
              investor_id: investorId,
              deal_id: deal.id,
              email_sent: pref.notify_email && investor.email,
              sms_sent: pref.notify_sms && investor.phone,
              created_at: new Date().toISOString()
            });
        }

        totalNotified++;
      }

      return new Response(JSON.stringify({
        success: true,
        deals_processed: recentDeals.length,
        investors_notified: totalNotified,
        message: `Processed ${recentDeals.length} deals, notified ${totalNotified} investors`
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid action'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('Deal alerts error:', error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
