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

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

interface InvestorPreference {
  id: string;
  investor_id: string;
  preferred_locations: string[];
  preferred_states: string[];
  min_price: number | null;
  max_price: number | null;
  min_bedrooms: number | null;
  max_bedrooms: number | null;
  operation_types: string[];
  property_types: string[];
  alerts_enabled: boolean;
  alert_frequency: string;
  email_alerts: boolean;
  sms_alerts: boolean;
  push_alerts: boolean;
  last_alert_sent: string | null;
  last_digest_sent: string | null;
  digest_properties: string[];
}

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  property_type: string;
  operation_type: string;
  monthly_rent: number;
  penny_score: number;
  penny_recommendation: string;
  is_published: boolean;
  status: string;
  photos: string[];
  sqft: number;
  cap_rate: number;
  listing_title: string;
  title: string;
  projected_yearly_revenue: number;
  created_at: string;
}

// Calculate match score between a property and investor preferences
function calculateMatchScore(property: Property, prefs: InvestorPreference): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const maxScore = 100;
  
  // Location match (30 points)
  const locationWeight = 30;
  if (prefs.preferred_locations?.length > 0 || prefs.preferred_states?.length > 0) {
    let locationMatch = false;
    
    if (prefs.preferred_locations?.length > 0) {
      const cityMatch = prefs.preferred_locations.some(loc => {
        const locLower = loc.toLowerCase().trim();
        const cityLower = property.city?.toLowerCase().trim() || '';
        return cityLower.includes(locLower) || locLower.includes(cityLower);
      });
      if (cityMatch) {
        locationMatch = true;
        reasons.push(`City matches your preferred location`);
      }
    }
    
    if (prefs.preferred_states?.length > 0) {
      const stateMatch = prefs.preferred_states.some(s => 
        s.toLowerCase() === property.state?.toLowerCase()
      );
      if (stateMatch) {
        locationMatch = true;
        reasons.push(`State matches your preferred states`);
      }
    }
    
    if (locationMatch) score += locationWeight;
  } else {
    score += locationWeight * 0.5;
  }
  
  // Price range match (20 points)
  const priceWeight = 20;
  if (prefs.min_price || prefs.max_price) {
    const price = property.price || property.monthly_rent || 0;
    let priceMatch = true;
    
    if (prefs.min_price && price < prefs.min_price) priceMatch = false;
    if (prefs.max_price && price > prefs.max_price) priceMatch = false;
    
    if (priceMatch) {
      score += priceWeight;
      reasons.push(`Price within your budget range`);
    }
  } else {
    score += priceWeight * 0.5;
  }
  
  // Bedroom match (15 points)
  const bedroomWeight = 15;
  if (prefs.min_bedrooms || prefs.max_bedrooms) {
    let bedroomMatch = true;
    
    if (prefs.min_bedrooms && property.bedrooms < prefs.min_bedrooms) bedroomMatch = false;
    if (prefs.max_bedrooms && property.bedrooms > prefs.max_bedrooms) bedroomMatch = false;
    
    if (bedroomMatch) {
      score += bedroomWeight;
      reasons.push(`${property.bedrooms} bedrooms matches your criteria`);
    }
  } else {
    score += bedroomWeight * 0.5;
  }
  
  // Operation type match (20 points)
  const opWeight = 20;
  if (prefs.operation_types?.length > 0) {
    const opMatch = prefs.operation_types.some(op => {
      const opLower = op.toLowerCase();
      const propOp = property.operation_type?.toLowerCase() || '';
      return propOp.includes(opLower) || opLower.includes(propOp);
    });
    if (opMatch) {
      score += opWeight;
      reasons.push(`${property.operation_type} matches your preferred operation type`);
    }
  } else {
    score += opWeight * 0.5;
  }
  
  // Property type match (15 points)
  const propTypeWeight = 15;
  if (prefs.property_types?.length > 0) {
    const typeMatch = prefs.property_types.some(pt => {
      const ptLower = pt.toLowerCase().replace(/[_-]/g, ' ');
      const propType = property.property_type?.toLowerCase().replace(/[_-]/g, ' ') || '';
      return propType.includes(ptLower) || ptLower.includes(propType);
    });
    if (typeMatch) {
      score += propTypeWeight;
      reasons.push(`${property.property_type} matches your preferred property type`);
    }
  } else {
    score += propTypeWeight * 0.5;
  }
  
  return { score: Math.min(Math.round(score), maxScore), reasons };
}

// Generate beautiful HTML email for deal alerts
function generateAlertEmail(investorName: string, deals: Array<{ property: Property; score: number; reasons: string[] }>, isDigest: boolean = false): string {
  const firstName = investorName?.split(' ')[0] || 'Investor';
  const dealCount = deals.length;
  
  const dealCards = deals.map(({ property, score, reasons }) => {
    const pennyScoreColor = (property.penny_score || 0) >= 80 ? '#059669' : (property.penny_score || 0) >= 60 ? '#d97706' : '#6b7280';
    const matchColor = score >= 80 ? '#059669' : score >= 60 ? '#d97706' : '#ef4444';
    
    return `
      <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 16px; background: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div>
            <h3 style="margin: 0 0 4px 0; color: #1a365d; font-size: 18px;">
              ${property.listing_title || property.title || `${property.city}, ${property.state}`}
            </h3>
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              ${property.city}, ${property.state} ${property.zip_code || ''}
            </p>
          </div>
          <div style="text-align: right;">
            <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; background: ${matchColor}15; color: ${matchColor}; font-weight: bold; font-size: 14px;">
              ${score}% Match
            </span>
          </div>
        </div>
        
        <div style="display: flex; gap: 16px; margin-bottom: 12px; flex-wrap: wrap;">
          <div style="background: #f3f4f6; padding: 8px 14px; border-radius: 8px;">
            <span style="font-size: 12px; color: #6b7280; display: block;">Bedrooms</span>
            <span style="font-weight: bold; color: #1f2937;">${property.bedrooms || 'N/A'} BR / ${property.bathrooms || 'N/A'} BA</span>
          </div>
          <div style="background: #f3f4f6; padding: 8px 14px; border-radius: 8px;">
            <span style="font-size: 12px; color: #6b7280; display: block;">Monthly Rent</span>
            <span style="font-weight: bold; color: #059669;">$${property.monthly_rent?.toLocaleString() || 'TBD'}</span>
          </div>
          <div style="background: #f3f4f6; padding: 8px 14px; border-radius: 8px;">
            <span style="font-size: 12px; color: #6b7280; display: block;">Type</span>
            <span style="font-weight: bold; color: #1f2937;">${property.operation_type || 'N/A'}</span>
          </div>
          ${property.penny_score ? `
          <div style="background: ${pennyScoreColor}10; padding: 8px 14px; border-radius: 8px;">
            <span style="font-size: 12px; color: #6b7280; display: block;">Penny Score</span>
            <span style="font-weight: bold; color: ${pennyScoreColor};">${property.penny_score}/100</span>
          </div>
          ` : ''}
        </div>
        
        ${reasons.length > 0 ? `
        <div style="margin-bottom: 12px;">
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; font-weight: 600;">Why this matches:</p>
          <p style="margin: 0; font-size: 13px; color: #4b5563;">${reasons.join(' | ')}</p>
        </div>
        ` : ''}
        
        <a href="https://accessyourplace.com/property/${property.id}" 
           style="display: inline-block; padding: 10px 24px; background: #d4a574; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
          View Property Details
        </a>
      </div>
    `;
  }).join('');
  
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; background: #f9fafb;">
      <div style="background: linear-gradient(135deg, #1a365d 0%, #2d4a7c 100%); padding: 32px 24px; text-align: center; border-radius: 0 0 16px 16px;">
        <h1 style="color: white; margin: 0 0 4px 0; font-size: 24px;">Access Your Place</h1>
        <p style="color: #d4a574; margin: 0; font-size: 16px; font-weight: 500;">
          ${isDigest ? 'Deal Alert Digest' : 'New Deal Alert'}
        </p>
      </div>
      
      <div style="padding: 32px 24px;">
        <p style="font-size: 16px; color: #374151; margin-bottom: 8px;">Hi ${firstName},</p>
        
        <p style="font-size: 16px; color: #374151; margin-bottom: 24px;">
          ${isDigest 
            ? `Here's your deal digest! I found <strong>${dealCount} propert${dealCount > 1 ? 'ies' : 'y'}</strong> matching your investment preferences.`
            : `Great news! A new property just went live that matches your deal alert criteria. Here's what I found:`
          }
        </p>
        
        ${dealCards}
        
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 20px; margin-top: 24px; border: 1px solid #fbbf24;">
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            <strong>Penny's Tip:</strong> Properties with high match scores and Penny Scores above 75 tend to perform exceptionally well. 
            I recommend scheduling a call with your acquisition manager to discuss any deals that catch your eye!
          </p>
          <a href="https://accessyourplace.com/investor/portal" 
             style="display: inline-block; margin-top: 12px; padding: 10px 20px; background: #1a365d; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Open Your Portal
          </a>
        </div>
      </div>
      
      <div style="background: #f3f4f6; padding: 20px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">
          Penny AI â€” Your Deal Alert Assistant at Access Your Place
        </p>
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
          Set Up Your Place LLC | 
          <a href="https://accessyourplace.com/investor/portal" style="color: #d4a574;">Manage Alert Preferences</a> | 
          <a href="https://accessyourplace.com/investor/unsubscribe" style="color: #9ca3af;">Unsubscribe</a>
        </p>
      </div>
    </div>
  `;
}

// Send email via Resend
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return false;
  }
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Penny AI <penny@accessyourplace.com>',
        to: [to],
        subject,
        html
      })
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Resend API error: ${response.status} - ${errorBody}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

// Send push notification via the send-push-notification edge function
async function sendPushNotification(supabaseUrl: string, supabaseKey: string, investorId: string, title: string, body: string, dealId?: string): Promise<boolean> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        action: 'send_deal_alert',
        investor_id: investorId,
        title,
        body,
        deal_id: dealId || '',
        deep_link: dealId ? `accessyourplace://deals/${dealId}` : 'accessyourplace://investor?tab=deal-alerts',
      }),
    });
    
    const result = await response.json();
    return result.success === true;
  } catch (err) {
    console.error('Push notification error:', err);
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
    const { action } = body;

    // ============================================================
    // ACTION: check_new_property
    // ============================================================
    if (action === 'check_new_property') {
      const { property_id } = body;
      
      if (!property_id) {
        return new Response(JSON.stringify({ success: false, error: 'property_id is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      
      const { data: property, error: propError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', property_id)
        .single();
      
      if (propError || !property) {
        return new Response(JSON.stringify({ success: false, error: 'Property not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      
      const { data: allPrefs } = await supabase
        .from('investor_deal_preferences')
        .select('*')
        .eq('alerts_enabled', true);
      
      if (!allPrefs || allPrefs.length === 0) {
        return new Response(JSON.stringify({
          success: true, matched: 0, notified: 0,
          message: 'No active alert preferences found'
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      
      const investorIds = allPrefs.map(p => p.investor_id);
      const { data: investors } = await supabase
        .from('investors')
        .select('id, email, full_name, phone')
        .in('id', investorIds);
      
      const investorMap = new Map((investors || []).map(i => [i.id, i]));
      
      let matched = 0;
      let instantNotified = 0;
      let pushNotified = 0;
      let digestQueued = 0;
      const errors: string[] = [];
      
      for (const pref of allPrefs) {
        const { score, reasons } = calculateMatchScore(property, pref);
        if (score < 40) continue;
        
        matched++;
        const investor = investorMap.get(pref.investor_id);
        if (!investor) continue;
        
        const frequency = pref.alert_frequency || 'instant';
        
        if (frequency === 'instant') {
          // Send email
          if (pref.email_alerts && investor.email) {
            const emailHtml = generateAlertEmail(
              investor.full_name || 'Investor',
              [{ property, score, reasons }],
              false
            );
            const subject = `New Deal Alert: ${property.city}, ${property.state} â€” ${score}% Match`;
            const sent = await sendEmail(investor.email, subject, emailHtml);
            if (sent) instantNotified++;
            else errors.push(`Failed to email ${investor.email}`);
          }
          
          // Send push notification
          if (pref.push_alerts) {
            const pushTitle = `New ${score}% Match in ${property.city}, ${property.state}`;
            const pushBody = `${property.bedrooms}BR/${property.bathrooms}BA ${property.operation_type || 'property'} â€” $${property.monthly_rent?.toLocaleString() || 'TBD'}/mo`;
            const pushSent = await sendPushNotification(supabaseUrl, supabaseKey, pref.investor_id, pushTitle, pushBody, property.id);
            if (pushSent) pushNotified++;
          }
          
          // Log the alert
          await supabase.from('deal_alert_logs').insert({
            investor_id: pref.investor_id,
            property_id: property.id,
            alert_type: 'instant',
            channels_sent: [
              pref.email_alerts && 'email', 
              pref.sms_alerts && 'sms', 
              pref.push_alerts && 'push'
            ].filter(Boolean),
            match_score: score,
            match_details: { reasons, property_city: property.city, property_state: property.state },
            sent_at: new Date().toISOString()
          });
          
          await supabase
            .from('investor_deal_preferences')
            .update({ last_alert_sent: new Date().toISOString() })
            .eq('id', pref.id);
            
        } else {
          const existingDigest = pref.digest_properties || [];
          const digestEntry = {
            property_id: property.id,
            score,
            reasons,
            queued_at: new Date().toISOString()
          };
          
          await supabase
            .from('investor_deal_preferences')
            .update({ digest_properties: [...existingDigest, digestEntry] })
            .eq('id', pref.id);
          
          digestQueued++;
        }
      }
      
      return new Response(JSON.stringify({
        success: true, property_id, matched,
        instant_notified: instantNotified,
        push_notified: pushNotified,
        digest_queued: digestQueued,
        errors: errors.length > 0 ? errors : undefined,
        message: `Matched ${matched} investors. Sent ${instantNotified} emails, ${pushNotified} push notifications, queued ${digestQueued} for digest.`
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // ============================================================
    // ACTION: send_digest
    // ============================================================
    if (action === 'send_digest') {
      const { frequency } = body;
      
      if (!frequency || !['daily', 'weekly'].includes(frequency)) {
        return new Response(JSON.stringify({ success: false, error: 'frequency must be daily or weekly' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      
      const { data: prefsWithDigest } = await supabase
        .from('investor_deal_preferences')
        .select('*')
        .eq('alerts_enabled', true)
        .eq('alert_frequency', frequency)
        .not('digest_properties', 'eq', '[]');
      
      if (!prefsWithDigest || prefsWithDigest.length === 0) {
        return new Response(JSON.stringify({
          success: true, sent: 0, message: `No ${frequency} digests to send`
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      
      const allPropertyIds = new Set<string>();
      for (const pref of prefsWithDigest) {
        for (const entry of (pref.digest_properties || [])) {
          if (entry.property_id) allPropertyIds.add(entry.property_id);
        }
      }
      
      const { data: properties } = await supabase
        .from('properties').select('*').in('id', [...allPropertyIds]);
      const propertyMap = new Map((properties || []).map(p => [p.id, p]));
      
      const investorIds = prefsWithDigest.map(p => p.investor_id);
      const { data: investors } = await supabase
        .from('investors').select('id, email, full_name, phone').in('id', investorIds);
      const investorMap = new Map((investors || []).map(i => [i.id, i]));
      
      let digestsSent = 0;
      let pushSent = 0;
      
      for (const pref of prefsWithDigest) {
        const investor = investorMap.get(pref.investor_id);
        if (!investor) continue;
        
        const digestEntries = pref.digest_properties || [];
        if (digestEntries.length === 0) continue;
        
        const deals = digestEntries
          .map((entry: any) => {
            const prop = propertyMap.get(entry.property_id);
            if (!prop) return null;
            return { property: prop, score: entry.score || 50, reasons: entry.reasons || [] };
          })
          .filter(Boolean)
          .sort((a: any, b: any) => b.score - a.score);
        
        if (deals.length === 0) continue;
        
        // Send email digest
        if (pref.email_alerts && investor.email) {
          const emailHtml = generateAlertEmail(investor.full_name || 'Investor', deals, true);
          const subject = `Your ${frequency === 'daily' ? 'Daily' : 'Weekly'} Deal Digest â€” ${deals.length} New Match${deals.length > 1 ? 'es' : ''}`;
          const sent = await sendEmail(investor.email, subject, emailHtml);
          if (sent) digestsSent++;
        }
        
        // Send push notification for digest
        if (pref.push_alerts) {
          const pushTitle = `${frequency === 'daily' ? 'Daily' : 'Weekly'} Deal Digest`;
          const pushBody = `${deals.length} new propert${deals.length > 1 ? 'ies' : 'y'} matching your criteria!`;
          const sent = await sendPushNotification(supabaseUrl, supabaseKey, pref.investor_id, pushTitle, pushBody);
          if (sent) pushSent++;
        }
        
        // Log alerts
        for (const deal of deals) {
          await supabase.from('deal_alert_logs').insert({
            investor_id: pref.investor_id,
            property_id: deal.property.id,
            alert_type: `${frequency}_digest`,
            channels_sent: [pref.email_alerts && 'email', pref.push_alerts && 'push'].filter(Boolean),
            match_score: deal.score,
            match_details: { reasons: deal.reasons, digest: true },
            sent_at: new Date().toISOString()
          });
        }
        
        await supabase
          .from('investor_deal_preferences')
          .update({ digest_properties: [], last_digest_sent: new Date().toISOString(), last_alert_sent: new Date().toISOString() })
          .eq('id', pref.id);
      }
      
      return new Response(JSON.stringify({
        success: true, sent: digestsSent, push_sent: pushSent,
        total_preferences: prefsWithDigest.length,
        message: `Sent ${digestsSent} ${frequency} digest emails and ${pushSent} push notifications`
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // ============================================================
    // ACTION: batch_check
    // ============================================================
    if (action === 'batch_check') {
      const { hours_back = 24 } = body;
      const cutoffTime = new Date(Date.now() - hours_back * 60 * 60 * 1000).toISOString();
      
      const { data: recentProperties } = await supabase
        .from('properties').select('*')
        .eq('status', 'published').eq('is_published', true)
        .gte('created_at', cutoffTime);
      
      if (!recentProperties || recentProperties.length === 0) {
        return new Response(JSON.stringify({
          success: true, processed: 0, message: 'No new properties to check'
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      
      const { data: allPrefs } = await supabase
        .from('investor_deal_preferences').select('*').eq('alerts_enabled', true);
      
      if (!allPrefs || allPrefs.length === 0) {
        return new Response(JSON.stringify({
          success: true, processed: recentProperties.length, matched: 0,
          message: 'No active preferences to match against'
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      
      const investorIds = [...new Set(allPrefs.map(p => p.investor_id))];
      const { data: investors } = await supabase
        .from('investors').select('id, email, full_name, phone').in('id', investorIds);
      const investorMap = new Map((investors || []).map(i => [i.id, i]));
      
      const propertyIds = recentProperties.map(p => p.id);
      const { data: existingAlerts } = await supabase
        .from('deal_alert_logs').select('investor_id, property_id').in('property_id', propertyIds);
      const alertedSet = new Set((existingAlerts || []).map(a => `${a.investor_id}:${a.property_id}`));
      
      const investorDeals: Map<string, Array<{ property: any; score: number; reasons: string[] }>> = new Map();
      
      for (const property of recentProperties) {
        for (const pref of allPrefs) {
          const alertKey = `${pref.investor_id}:${property.id}`;
          if (alertedSet.has(alertKey)) continue;
          
          const { score, reasons } = calculateMatchScore(property, pref);
          if (score < 40) continue;
          
          if (!investorDeals.has(pref.investor_id)) {
            investorDeals.set(pref.investor_id, []);
          }
          investorDeals.get(pref.investor_id)!.push({ property, score, reasons });
        }
      }
      
      let totalNotified = 0;
      let totalPushSent = 0;
      
      for (const [investorId, deals] of investorDeals) {
        if (deals.length === 0) continue;
        
        const investor = investorMap.get(investorId);
        const pref = allPrefs.find(p => p.investor_id === investorId);
        if (!investor || !pref) continue;
        
        const frequency = pref.alert_frequency || 'instant';
        deals.sort((a, b) => b.score - a.score);
        
        if (frequency === 'instant') {
          // Email
          if (pref.email_alerts && investor.email) {
            const emailHtml = generateAlertEmail(investor.full_name || 'Investor', deals, deals.length > 1);
            const subject = deals.length === 1
              ? `New Deal Alert: ${deals[0].property.city}, ${deals[0].property.state} â€” ${deals[0].score}% Match`
              : `${deals.length} New Deals Match Your Criteria!`;
            const sent = await sendEmail(investor.email, subject, emailHtml);
            if (sent) totalNotified++;
          }
          
          // Push notification
          if (pref.push_alerts) {
            const pushTitle = deals.length === 1
              ? `New ${deals[0].score}% Match in ${deals[0].property.city}`
              : `${deals.length} New Deals Match Your Criteria!`;
            const pushBody = deals.length === 1
              ? `${deals[0].property.bedrooms}BR/${deals[0].property.bathrooms}BA â€” $${deals[0].property.monthly_rent?.toLocaleString() || 'TBD'}/mo`
              : `Check out ${deals.length} new properties matching your investment preferences`;
            const sent = await sendPushNotification(supabaseUrl, supabaseKey, investorId, pushTitle, pushBody, deals[0].property.id);
            if (sent) totalPushSent++;
          }
          
          for (const deal of deals) {
            await supabase.from('deal_alert_logs').insert({
              investor_id: investorId,
              property_id: deal.property.id,
              alert_type: 'instant',
              channels_sent: [pref.email_alerts && 'email', pref.push_alerts && 'push', pref.sms_alerts && 'sms'].filter(Boolean),
              match_score: deal.score,
              match_details: { reasons: deal.reasons, batch: true },
              sent_at: new Date().toISOString()
            });
          }
          
          await supabase
            .from('investor_deal_preferences')
            .update({ last_alert_sent: new Date().toISOString() })
            .eq('id', pref.id);
            
        } else {
          const existingDigest = pref.digest_properties || [];
          const newEntries = deals.map(d => ({
            property_id: d.property.id, score: d.score, reasons: d.reasons,
            queued_at: new Date().toISOString()
          }));
          
          await supabase
            .from('investor_deal_preferences')
            .update({ digest_properties: [...existingDigest, ...newEntries] })
            .eq('id', pref.id);
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        properties_checked: recentProperties.length,
        investors_matched: investorDeals.size,
        instant_notified: totalNotified,
        push_notified: totalPushSent,
        message: `Checked ${recentProperties.length} properties. Matched ${investorDeals.size} investors. Sent ${totalNotified} emails, ${totalPushSent} push notifications.`
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // ============================================================
    // ACTION: get_alert_settings
    // ============================================================
    if (action === 'get_alert_settings') {
      const { investor_id } = body;
      const { data } = await supabase
        .from('investor_deal_preferences').select('*').eq('investor_id', investor_id).single();
      
      return new Response(JSON.stringify({ success: true, settings: data || null }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ============================================================
    // ACTION: save_alert_settings
    // ============================================================
    if (action === 'save_alert_settings') {
      const { investor_id, settings } = body;
      
      if (!investor_id || !settings) {
        return new Response(JSON.stringify({ success: false, error: 'investor_id and settings required' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      
      const { data: existing } = await supabase
        .from('investor_deal_preferences').select('id').eq('investor_id', investor_id).single();
      
      const updateData = {
        investor_id,
        preferred_locations: settings.preferred_locations || [],
        preferred_states: settings.preferred_states || [],
        min_price: settings.min_price || null,
        max_price: settings.max_price || null,
        min_bedrooms: settings.min_bedrooms || null,
        max_bedrooms: settings.max_bedrooms || null,
        operation_types: settings.operation_types || [],
        property_types: settings.property_types || [],
        alerts_enabled: settings.alerts_enabled !== false,
        alert_frequency: settings.alert_frequency || 'instant',
        email_alerts: settings.email_alerts !== false,
        sms_alerts: settings.sms_alerts === true,
        push_alerts: settings.push_alerts !== false,
        updated_at: new Date().toISOString()
      };
      
      let result;
      if (existing) {
        const { data, error } = await supabase
          .from('investor_deal_preferences').update(updateData).eq('investor_id', investor_id).select().single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase
          .from('investor_deal_preferences').insert({ ...updateData, created_at: new Date().toISOString() }).select().single();
        if (error) throw error;
        result = data;
      }
      
      return new Response(JSON.stringify({
        success: true, settings: result, message: 'Alert settings saved successfully'
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // ============================================================
    // ACTION: get_alert_history
    // ============================================================
    if (action === 'get_alert_history') {
      const { investor_id, limit = 30 } = body;
      
      const { data } = await supabase
        .from('deal_alert_logs').select('*').eq('investor_id', investor_id)
        .order('sent_at', { ascending: false }).limit(limit);
      
      const propertyIds = [...new Set((data || []).map(a => a.property_id))];
      let propertyMap = new Map();
      
      if (propertyIds.length > 0) {
        const { data: properties } = await supabase
          .from('properties')
          .select('id, city, state, bedrooms, bathrooms, price, monthly_rent, operation_type, penny_score, listing_title, title')
          .in('id', propertyIds);
        propertyMap = new Map((properties || []).map(p => [p.id, p]));
      }
      
      const enrichedAlerts = (data || []).map(alert => ({
        ...alert, property: propertyMap.get(alert.property_id) || null
      }));
      
      return new Response(JSON.stringify({ success: true, alerts: enrichedAlerts }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ============================================================
    // ACTION: preview_matches
    // ============================================================
    if (action === 'preview_matches') {
      const { investor_id, settings } = body;
      
      let prefs = settings;
      if (!prefs && investor_id) {
        const { data } = await supabase
          .from('investor_deal_preferences').select('*').eq('investor_id', investor_id).single();
        prefs = data;
      }
      
      if (!prefs) {
        return new Response(JSON.stringify({
          success: true, matches: [], message: 'No preferences configured'
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      
      const { data: properties } = await supabase
        .from('properties').select('*').eq('status', 'published').eq('is_published', true).limit(50);
      
      const matches = (properties || [])
        .map(property => {
          const { score, reasons } = calculateMatchScore(property, prefs);
          return { property, score, reasons };
        })
        .filter(m => m.score >= 30)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
      
      return new Response(JSON.stringify({
        success: true, matches, total_properties: properties?.length || 0
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('check-deal-alerts error:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

