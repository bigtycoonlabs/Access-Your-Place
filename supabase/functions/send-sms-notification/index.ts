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
// send-sms-notification v2.0 - Fixed webhook URL to use correct API domain
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// FIXED: Correct webhook URL for Twilio status callbacks
const WEBHOOK_URL = 'https://api.databasepad.com/functions/v1/twilio-sms-webhook';

// Create fresh headers for each request
function getDbHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': 'Bearer ' + supabaseKey
  };
}

async function dbInsert(table: string, data: any): Promise<any> {
  const url = supabaseUrl + '/rest/v1/' + table;
  const hdrs = getDbHeaders();
  hdrs['Prefer'] = 'return=representation';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: hdrs,
    body: JSON.stringify(data)
  });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function sendTwilioSMS(to: string, message: string): Promise<{ success: boolean; sid?: string; error?: string; errorCode?: string }> {
  const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
    console.error('Twilio credentials missing');
    return { success: false, error: 'SMS not configured - missing Twilio credentials' };
  }

  try {
    const twilioUrl = 'https://api.twilio.com/2010-04-01/Accounts/' + twilioAccountSid + '/Messages.json';
    const credentials = twilioAccountSid + ':' + twilioAuthToken;
    const auth = btoa(credentials);
    
    // Include StatusCallback URL for delivery tracking
    const formBody = 'To=' + encodeURIComponent(to) + 
                     '&From=' + encodeURIComponent(twilioPhoneNumber) + 
                     '&Body=' + encodeURIComponent(message) +
                     '&StatusCallback=' + encodeURIComponent(WEBHOOK_URL);

    console.log('Sending SMS via Twilio to:', to.substring(0, 6) + 'XXXX');
    console.log('Using StatusCallback:', WEBHOOK_URL);

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: { 
        'Authorization': 'Basic ' + auth, 
        'Content-Type': 'application/x-www-form-urlencoded' 
      },
      body: formBody
    });
    
    const responseText = await response.text();
    console.log('Twilio response status:', response.status);
    
    let result: any;
    try {
      result = JSON.parse(responseText);
    } catch {
      console.error('Invalid Twilio response:', responseText.substring(0, 200));
      return { success: false, error: 'Invalid Twilio response' };
    }
    
    if (response.ok && result.sid) {
      console.log('SMS queued successfully, SID:', result.sid);
      return { success: true, sid: result.sid };
    } else {
      console.error('Twilio error:', result.code, result.message);
      return { 
        success: false, 
        error: result.message || 'SMS send failed',
        errorCode: String(result.code || '')
      };
    }
  } catch (e: any) {
    console.error('SMS send exception:', e.message);
    return { success: false, error: e.message || 'SMS error' };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const bodyText = await req.text();
    let body: any;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const { to, message, recipient_name, message_type } = body;

    if (!to || !message) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields: to, message' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Format phone to E.164
    let formattedPhone = String(to).replace(/\D/g, '');
    if (formattedPhone.length === 10) {
      formattedPhone = '+1' + formattedPhone;
    } else if (formattedPhone.length === 11 && formattedPhone.charAt(0) === '1') {
      formattedPhone = '+' + formattedPhone;
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    console.log('Sending SMS notification to:', formattedPhone.substring(0, 6) + 'XXXX');
    const smsResult = await sendTwilioSMS(formattedPhone, message);

    if (smsResult.success) {
      // Log the SMS
      await dbInsert('sms_logs', {
        recipient_phone: formattedPhone,
        recipient_name: recipient_name || null,
        message_type: message_type || 'notification',
        message_content: message,
        status: 'sent',
        delivery_status: 'queued',
        twilio_sid: smsResult.sid
      });

      return new Response(JSON.stringify({ 
        success: true, 
        sid: smsResult.sid,
        message: 'SMS sent successfully'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    } else {
      // Log the failed SMS
      await dbInsert('sms_logs', {
        recipient_phone: formattedPhone,
        recipient_name: recipient_name || null,
        message_type: message_type || 'notification',
        message_content: message,
        status: 'failed',
        delivery_status: 'failed',
        error_message: smsResult.error,
        twilio_error_code: smsResult.errorCode || null
      });

      return new Response(JSON.stringify({ 
        success: false, 
        error: smsResult.error 
      }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

  } catch (error: any) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Unknown error' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

