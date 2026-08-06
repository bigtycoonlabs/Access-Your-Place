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

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

interface InvestorPreference {
  id: string;
  investor_id: string;
  preference_name: string;
  target_markets: string[];
  min_budget: number;
  max_budget: number;
  operation_types: string[];
  property_types: string[];
  min_bedrooms: number;
  max_bedrooms: number;
  min_penny_score: number;
  min_cap_rate: number;
  must_have_features: string[];
  deal_breakers: string[];
  notification_email: boolean;
  notification_sms: boolean;
  notification_push: boolean;
}

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  price: number;
  bedrooms: number;
  property_type: string;
  operation_type: string;
  penny_score?: number;
  cap_rate?: number;
  features?: string[];
  market?: string;
}

// Calculate match score between property and preferences
function calculateMatchScore(property: Property, preference: InvestorPreference): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const maxScore = 100;
  let totalWeight = 0;

  // Market match (25 points)
  const propertyMarket = `${property.city}, ${property.state}`;
  if (preference.target_markets && preference.target_markets.length > 0) {
    totalWeight += 25;
    const marketMatch = preference.target_markets.some(m => 
      propertyMarket.toLowerCase().includes(m.toLowerCase()) ||
      m.toLowerCase().includes(property.city?.toLowerCase() || '')
    );
    if (marketMatch) {
      score += 25;
      reasons.push(`Located in target market: ${propertyMarket}`);
    }
  }

  // Budget match (25 points)
  if (preference.min_budget || preference.max_budget) {
    totalWeight += 25;
    const inBudget = (!preference.min_budget || property.price >= preference.min_budget) &&
                     (!preference.max_budget || property.price <= preference.max_budget);
    if (inBudget) {
      score += 25;
      reasons.push(`Within budget range: $${property.price.toLocaleString()}`);
    }
  }

  // Operation type match (15 points)
  if (preference.operation_types && preference.operation_types.length > 0) {
    totalWeight += 15;
    if (preference.operation_types.includes(property.operation_type)) {
      score += 15;
      reasons.push(`Matches operation type: ${property.operation_type}`);
    }
  }

  // Property type match (10 points)
  if (preference.property_types && preference.property_types.length > 0) {
    totalWeight += 10;
    if (preference.property_types.includes(property.property_type)) {
      score += 10;
      reasons.push(`Matches property type: ${property.property_type}`);
    }
  }

  // Bedroom count match (10 points)
  if (preference.min_bedrooms || preference.max_bedrooms) {
    totalWeight += 10;
    const bedroomMatch = (!preference.min_bedrooms || property.bedrooms >= preference.min_bedrooms) &&
                         (!preference.max_bedrooms || property.bedrooms <= preference.max_bedrooms);
    if (bedroomMatch) {
      score += 10;
      reasons.push(`${property.bedrooms} bedrooms meets criteria`);
    }
  }

  // Penny Score match (10 points)
  if (preference.min_penny_score && property.penny_score) {
    totalWeight += 10;
    if (property.penny_score >= preference.min_penny_score) {
      score += 10;
      reasons.push(`Penny Score ${property.penny_score} exceeds minimum ${preference.min_penny_score}`);
    }
  }

  // Cap rate match (5 points)
  if (preference.min_cap_rate && property.cap_rate) {
    totalWeight += 5;
    if (property.cap_rate >= preference.min_cap_rate) {
      score += 5;
      reasons.push(`Cap rate ${property.cap_rate}% meets minimum`);
    }
  }

  // Check deal breakers (can reduce score)
  if (preference.deal_breakers && preference.deal_breakers.length > 0 && property.features) {
    const hasBreaker = preference.deal_breakers.some(breaker => 
      property.features?.some(f => f.toLowerCase().includes(breaker.toLowerCase()))
    );
    if (hasBreaker) {
      score = Math.max(0, score - 30);
      reasons.push('Contains deal breaker feature');
    }
  }

  // Normalize score if we have weights
  const finalScore = totalWeight > 0 ? Math.round((score / totalWeight) * 100) : score;

  return { score: finalScore, reasons };
}

// Send email notification
async function sendEmailNotification(investor: any, property: Property, matchScore: number, reasons: string[]): Promise<boolean> {
  if (!RESEND_API_KEY) return false;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Penny <penny@accessyourplace.com>', reply_to: ['success@accessyourplace.com'],
        to: investor.email,
        subject: `ðŸ  New Deal Match: ${property.address} (${matchScore}% Match)`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">New Deal Alert!</h1>
              <p style="color: #d1fae5; margin: 10px 0 0;">Penny found a property matching your criteria</p>
            </div>
            
            <div style="padding: 30px; background: #f9fafb;">
              <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                  <h2 style="margin: 0; color: #111827;">${property.address}</h2>
                  <span style="background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold;">
                    ${matchScore}% Match
                  </span>
                </div>
                
                <p style="color: #6b7280; margin: 0 0 20px;">${property.city}, ${property.state}</p>
                
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 20px;">
                  <div style="background: #f3f4f6; padding: 12px; border-radius: 8px;">
                    <p style="margin: 0; color: #6b7280; font-size: 12px;">PRICE</p>
                    <p style="margin: 4px 0 0; color: #111827; font-size: 18px; font-weight: bold;">$${property.price?.toLocaleString()}</p>
                  </div>
                  <div style="background: #f3f4f6; padding: 12px; border-radius: 8px;">
                    <p style="margin: 0; color: #6b7280; font-size: 12px;">BEDROOMS</p>
                    <p style="margin: 4px 0 0; color: #111827; font-size: 18px; font-weight: bold;">${property.bedrooms}</p>
                  </div>
                  <div style="background: #f3f4f6; padding: 12px; border-radius: 8px;">
                    <p style="margin: 0; color: #6b7280; font-size: 12px;">OPERATION TYPE</p>
                    <p style="margin: 4px 0 0; color: #111827; font-size: 18px; font-weight: bold;">${property.operation_type}</p>
                  </div>
                  <div style="background: #f3f4f6; padding: 12px; border-radius: 8px;">
                    <p style="margin: 0; color: #6b7280; font-size: 12px;">PENNY SCORE</p>
                    <p style="margin: 4px 0 0; color: #10b981; font-size: 18px; font-weight: bold;">${property.penny_score || 'N/A'}</p>
                  </div>
                </div>
                
                <div style="background: #ecfdf5; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                  <p style="margin: 0 0 8px; color: #065f46; font-weight: bold;">Why This Matches:</p>
                  <ul style="margin: 0; padding-left: 20px; color: #047857;">
                    ${reasons.map(r => `<li>${r}</li>`).join('')}
                  </ul>
                </div>
                
                <a href="https://accessyourplace.com/investor/login?deal=${property.id}" 
                   style="display: block; background: #10b981; color: white; text-align: center; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                  View Deal Details
                </a>
              </div>
            </div>
            
            <div style="padding: 20px; text-align: center; color: #6b7280; font-size: 12px;">
              <p>You're receiving this because you have deal alerts enabled.</p>
              <a href="https://accessyourplace.com/investor/login" style="color: #10b981;">Manage Preferences</a>
            </div>
          </div>
        `
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Email notification error:', error);
    return false;
  }
}

// Send SMS notification
async function sendSMSNotification(investor: any, property: Property, matchScore: number): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER || !investor.phone) {
    return false;
  }

  try {
    const message = `ðŸ  Penny AI Deal Alert!\n\n${matchScore}% match found:\n${property.address}\n${property.city}, ${property.state}\n$${property.price?.toLocaleString()} | ${property.bedrooms}BR\n\nView: rentalacquisitions.com/investor-portal`;

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          To: investor.phone,
          From: TWILIO_PHONE_NUMBER,
          Body: message
        })
      }
    );

    return response.ok;
  } catch (error) {
    console.error('SMS notification error:', error);
    return false;
  }
}

// Find matching investors for a property
async function findMatchingInvestors(property: Property): Promise<any[]> {
  const { data: preferences } = await supabase
    .from('investor_deal_preferences')
    .select('*')
    .eq('is_active', true);

  if (!preferences) return [];

  const matches: any[] = [];

  for (const pref of preferences) {
    const { score, reasons } = calculateMatchScore(property, pref);
    
    // Only notify if score meets minimum threshold (60%)
    if (score >= 60) {
      // Get investor details
      const { data: investor } = await supabase
        .from('investors')
        .select('id, email, phone, first_name, last_name')
        .eq('id', pref.investor_id)
        .single();

      if (investor) {
        matches.push({
          investor,
          preference: pref,
          matchScore: score,
          reasons
        });
      }
    }
  }

  return matches;
}

// Process new property and notify matching investors
async function processNewProperty(propertyId: string): Promise<any> {
  // Get property details
  const { data: property, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single();

  if (error || !property) {
    return { success: false, error: 'Property not found' };
  }

  // Get Penny score if available
  const { data: pennyScore } = await supabase
    .from('penny_deal_scores')
    .select('overall_score')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const propertyWithScore: Property = {
    ...property,
    penny_score: pennyScore?.overall_score,
    market: `${property.city}, ${property.state}`
  };

  // Find matching investors
  const matches = await findMatchingInvestors(propertyWithScore);
  
  const notifications: any[] = [];

  for (const match of matches) {
    // Check if we already notified this investor about this property
    const { data: existing } = await supabase
      .from('deal_match_notifications')
      .select('id')
      .eq('investor_id', match.investor.id)
      .eq('property_id', propertyId)
      .single();

    if (existing) continue;

    // Send notifications
    let emailSent = false;
    let smsSent = false;

    if (match.preference.notification_email) {
      emailSent = await sendEmailNotification(match.investor, propertyWithScore, match.matchScore, match.reasons);
    }

    if (match.preference.notification_sms) {
      smsSent = await sendSMSNotification(match.investor, propertyWithScore, match.matchScore);
    }

    // Log the notification
    const { data: notification } = await supabase
      .from('deal_match_notifications')
      .insert({
        investor_id: match.investor.id,
        property_id: propertyId,
        preference_id: match.preference.id,
        match_score: match.matchScore,
        match_reasons: match.reasons,
        penny_score: propertyWithScore.penny_score,
        notification_sent_email: emailSent,
        notification_sent_sms: smsSent,
        notification_sent_push: match.preference.notification_push
      })
      .select()
      .single();

    // Create in-app notification
    if (match.preference.notification_push) {
      await supabase
        .from('investor_notifications')
        .insert({
          investor_id: match.investor.id,
          type: 'deal_match',
          title: `New ${match.matchScore}% Match: ${property.address}`,
          message: `A new property in ${property.city} matches your criteria. ${match.reasons[0]}`,
          data: { property_id: propertyId, match_score: match.matchScore },
          is_read: false
        });
    }

    notifications.push({
      investor_id: match.investor.id,
      investor_name: `${match.investor.first_name} ${match.investor.last_name}`,
      match_score: match.matchScore,
      email_sent: emailSent,
      sms_sent: smsSent
    });
  }

  return {
    success: true,
    property_id: propertyId,
    matches_found: matches.length,
    notifications_sent: notifications.length,
    notifications
  };
}

// Save or update investor preferences
async function savePreferences(investorId: string, preferences: Partial<InvestorPreference>): Promise<any> {
  const { data: existing } = await supabase
    .from('investor_deal_preferences')
    .select('id')
    .eq('investor_id', investorId)
    .eq('preference_name', preferences.preference_name || 'Default')
    .single();

  if (existing) {
    const { data, error } = await supabase
      .from('investor_deal_preferences')
      .update({
        ...preferences,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single();

    return { success: !error, data, error };
  } else {
    const { data, error } = await supabase
      .from('investor_deal_preferences')
      .insert({
        investor_id: investorId,
        ...preferences
      })
      .select()
      .single();

    return { success: !error, data, error };
  }
}

// Get investor preferences
async function getPreferences(investorId: string): Promise<any> {
  const { data, error } = await supabase
    .from('investor_deal_preferences')
    .select('*')
    .eq('investor_id', investorId)
    .order('created_at', { ascending: false });

  return { success: !error, data, error };
}

// Get match history for investor
async function getMatchHistory(investorId: string): Promise<any> {
  const { data, error } = await supabase
    .from('deal_match_notifications')
    .select(`
      *,
      properties:property_id (
        id, address, city, state, price, bedrooms, property_type
      )
    `)
    .eq('investor_id', investorId)
    .order('created_at', { ascending: false })
    .limit(50);

  return { success: !error, data, error };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, investor_id, property_id, preferences } = await req.json();

    switch (action) {
      case 'process_new_property':
        if (!property_id) {
          return new Response(JSON.stringify({ success: false, error: 'property_id required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const processResult = await processNewProperty(property_id);
        return new Response(JSON.stringify(processResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'save_preferences':
        if (!investor_id || !preferences) {
          return new Response(JSON.stringify({ success: false, error: 'investor_id and preferences required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const saveResult = await savePreferences(investor_id, preferences);
        return new Response(JSON.stringify(saveResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'get_preferences':
        if (!investor_id) {
          return new Response(JSON.stringify({ success: false, error: 'investor_id required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const getResult = await getPreferences(investor_id);
        return new Response(JSON.stringify(getResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'get_match_history':
        if (!investor_id) {
          return new Response(JSON.stringify({ success: false, error: 'investor_id required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const historyResult = await getMatchHistory(investor_id);
        return new Response(JSON.stringify(historyResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'delete_preference':
        const { preference_id } = await req.json();
        const { error: deleteError } = await supabase
          .from('investor_deal_preferences')
          .delete()
          .eq('id', preference_id)
          .eq('investor_id', investor_id);
        return new Response(JSON.stringify({ success: !deleteError }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'test_match':
        // Test matching without sending notifications
        if (!property_id) {
          return new Response(JSON.stringify({ success: false, error: 'property_id required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const { data: testProperty } = await supabase
          .from('properties')
          .select('*')
          .eq('id', property_id)
          .single();
        
        if (!testProperty) {
          return new Response(JSON.stringify({ success: false, error: 'Property not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const testMatches = await findMatchingInvestors(testProperty);
        return new Response(JSON.stringify({ 
          success: true, 
          property: testProperty,
          potential_matches: testMatches.length,
          matches: testMatches.map(m => ({
            investor_id: m.investor.id,
            name: `${m.investor.first_name} ${m.investor.last_name}`,
            match_score: m.matchScore,
            reasons: m.reasons
          }))
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      default:
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid action',
          valid_actions: ['process_new_property', 'save_preferences', 'get_preferences', 'get_match_history', 'delete_preference', 'test_match']
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('Error in intelligent-deal-matching:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
