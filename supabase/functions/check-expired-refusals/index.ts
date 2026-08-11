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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date().toISOString();

    // Find all acquisition requests where:
    // 1. Status is 'first_refusal' (waiting for investor response)
    // 2. first_refusal_expires_at has passed
    const { data: expiredRequests, error: fetchError } = await supabase
      .from('acquisition_requests')
      .select('*, investors!acquisition_requests_investor_id_fkey(id, email, full_name, first_name)')
      .eq('status', 'first_refusal')
      .lt('first_refusal_expires_at', now);

    if (fetchError) {
      throw new Error(`Failed to fetch expired requests: ${fetchError.message}`);
    }

    if (!expiredRequests || expiredRequests.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No expired first right of refusal periods found',
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${expiredRequests.length} expired first right of refusal requests`);

    const results = [];

    for (const request of expiredRequests) {
      try {
        // Update the request status to 'available'
        const { error: updateError } = await supabase
          .from('acquisition_requests')
          .update({
            status: 'available',
            first_refusal_response: 'expired',
            updated_at: now
          })
          .eq('id', request.id);

        if (updateError) {
          console.error(`Failed to update request ${request.id}:`, updateError);
          results.push({ request_id: request.id, success: false, error: updateError.message });
          continue;
        }

        // Send notification to the original investor that their window expired
        if (request.first_refusal_investor_id) {
          try {
            await fetch(`${supabaseUrl}/functions/v1/send-acquisition-emails`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                action: 'refusal_expired',
                investor_id: request.first_refusal_investor_id,
                request_id: request.id
              })
            });
          } catch (emailError) {
            console.error('Failed to send expiration email:', emailError);
          }
        }

        // Notify all other eligible investors that the deal is now available
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-acquisition-emails`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              action: 'deal_publicly_available',
              request_id: request.id
            })
          });
        } catch (notifyError) {
          console.error('Failed to notify other investors:', notifyError);
        }

        // Also send a 4-hour reminder SMS if we're within 4 hours of expiration
        // This is handled separately to catch requests that are about to expire

        results.push({ 
          request_id: request.id, 
          success: true,
          city: request.city,
          state: request.state,
          original_investor: request.investors?.full_name || 'Unknown'
        });

        console.log(`Processed expired request ${request.id} for ${request.city}, ${request.state}`);

      } catch (processError) {
        console.error(`Error processing request ${request.id}:`, processError);
        results.push({ request_id: request.id, success: false, error: processError.message });
      }
    }

    // Also check for requests that are about to expire (within 4 hours) and send reminders
    const fourHoursFromNow = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    
    const { data: soonToExpire } = await supabase
      .from('acquisition_requests')
      .select('*, investors!acquisition_requests_investor_id_fkey(id, email, full_name)')
      .eq('status', 'first_refusal')
      .gt('first_refusal_expires_at', now)
      .lt('first_refusal_expires_at', fourHoursFromNow)
      .is('reminder_sent', null);

    let remindersSent = 0;

    for (const request of (soonToExpire || [])) {
      if (request.first_refusal_investor_id) {
        try {
          // Calculate hours remaining
          const expiresAt = new Date(request.first_refusal_expires_at);
          const hoursRemaining = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));

          // Send SMS reminder
          await fetch(`${supabaseUrl}/functions/v1/send-sms-notification`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              action: 'send',
              investor_id: request.first_refusal_investor_id,
              notification_type: 'first_refusal_reminder',
              template_key: 'first_refusal_reminder',
              template_data: {
                property_address: `${request.city}, ${request.state}`,
                hours_remaining: hoursRemaining,
                portal_link: 'https://accessyourplace.com/investor-portal'
              }
            })
          });

          // Mark reminder as sent
          await supabase
            .from('acquisition_requests')
            .update({ reminder_sent: now })
            .eq('id', request.id);

          remindersSent++;
        } catch (reminderError) {
          console.error('Failed to send reminder:', reminderError);
        }
      }
    }

    const successCount = results.filter(r => r.success).length;

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${expiredRequests.length} expired requests, ${successCount} successful`,
      processed: expiredRequests.length,
      successful: successCount,
      reminders_sent: remindersSent,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Check expired refusals error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
