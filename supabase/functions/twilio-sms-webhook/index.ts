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
// twilio-sms-webhook v2.0 - Enhanced logging and error handling
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-twilio-signature',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Create fresh headers for each request to avoid cloning issues
function getDbHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': 'Bearer ' + supabaseKey
  };
}

async function dbQuery(table: string, params: string = ''): Promise<any> {
  const url = supabaseUrl + '/rest/v1/' + table + '?' + params;
  const response = await fetch(url, {
    method: 'GET',
    headers: getDbHeaders()
  });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

async function dbUpdate(table: string, filter: string, data: any): Promise<any> {
  const url = supabaseUrl + '/rest/v1/' + table + '?' + filter;
  const hdrs = getDbHeaders();
  hdrs['Prefer'] = 'return=representation';
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: hdrs,
    body: JSON.stringify(data)
  });
  const text = await response.text();
  console.log('DB Update response for', table, ':', text.substring(0, 200));
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
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
  console.log('DB Insert response for', table, ':', text.substring(0, 200));
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Parse URL-encoded form data from Twilio
function parseFormData(body: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (!body || body.trim() === '') {
    return params;
  }
  const pairs = body.split('&');
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    const eqIndex = pair.indexOf('=');
    if (eqIndex > 0) {
      const key = decodeURIComponent(pair.substring(0, eqIndex).replace(/\+/g, ' '));
      const value = decodeURIComponent(pair.substring(eqIndex + 1).replace(/\+/g, ' '));
      params[key] = value;
    }
  }
  return params;
}

// Map Twilio status to our status
function mapTwilioStatus(twilioStatus: string): string {
  const statusMap: Record<string, string> = {
    'queued': 'queued',
    'sending': 'sending',
    'sent': 'sent',
    'delivered': 'delivered',
    'undelivered': 'undelivered',
    'failed': 'failed',
    'read': 'delivered'
  };
  return statusMap[twilioStatus.toLowerCase()] || twilioStatus.toLowerCase();
}

Deno.serve(async (req: Request) => {
  console.log('=== Twilio Webhook Request ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  // Log all headers
  const headerEntries: string[] = [];
  req.headers.forEach((value, key) => {
    headerEntries.push(key + ': ' + value.substring(0, 50));
  });
  console.log('Headers:', headerEntries.join(', '));

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Handle GET requests (for testing/verification)
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ 
      status: 'ok', 
      message: 'Twilio SMS Webhook is active and ready to receive callbacks',
      timestamp: new Date().toISOString(),
      version: '2.0'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    // Read the raw body
    const bodyText = await req.text();
    console.log('Raw body length:', bodyText.length);
    console.log('Raw body preview:', bodyText.substring(0, 500));

    // Try to parse as form data (Twilio sends application/x-www-form-urlencoded)
    let params: Record<string, string> = {};
    
    // Check content type
    const contentType = req.headers.get('content-type') || '';
    console.log('Content-Type:', contentType);
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      params = parseFormData(bodyText);
      console.log('Parsed form data params:', JSON.stringify(params));
    } else if (contentType.includes('application/json')) {
      // Handle JSON (for testing)
      try {
        const jsonBody = JSON.parse(bodyText);
        params = jsonBody;
        console.log('Parsed JSON params:', JSON.stringify(params));
      } catch (e) {
        console.log('Failed to parse JSON, trying form data');
        params = parseFormData(bodyText);
      }
    } else {
      // Try form data anyway
      params = parseFormData(bodyText);
      console.log('Parsed params (unknown content-type):', JSON.stringify(params));
    }

    // Extract Twilio callback parameters
    const messageSid = params.MessageSid || params.SmsSid || params.messageSid || params.sid || '';
    const messageStatus = params.MessageStatus || params.SmsStatus || params.messageStatus || params.status || '';
    const errorCode = params.ErrorCode || params.errorCode || '';
    const errorMessage = params.ErrorMessage || params.errorMessage || '';
    const toPhone = params.To || params.to || '';
    const fromPhone = params.From || params.from || '';
    const accountSid = params.AccountSid || params.accountSid || '';

    console.log('Extracted webhook data:', JSON.stringify({
      messageSid: messageSid,
      messageStatus: messageStatus,
      errorCode: errorCode,
      errorMessage: errorMessage,
      toPhone: toPhone ? toPhone.substring(0, 6) + 'XXXX' : 'none',
      fromPhone: fromPhone ? fromPhone.substring(0, 6) + 'XXXX' : 'none',
      accountSid: accountSid ? accountSid.substring(0, 10) + '...' : 'none'
    }));

    // Always log the webhook event for debugging
    const webhookLogResult = await dbInsert('sms_webhook_logs', {
      twilio_sid: messageSid || 'unknown',
      status: messageStatus || 'unknown',
      error_code: errorCode || null,
      error_message: errorMessage || null,
      to_phone: toPhone || null,
      from_phone: fromPhone || null,
      raw_payload: bodyText.substring(0, 2000),
      received_at: new Date().toISOString()
    });
    console.log('Webhook log insert result:', JSON.stringify(webhookLogResult));

    if (!messageSid) {
      console.log('No MessageSid in webhook, returning success anyway');
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
      });
    }

    const mappedStatus = mapTwilioStatus(messageStatus);
    const now = new Date().toISOString();
    console.log('Mapped status:', mappedStatus);

    // Update investor_invitations table
    console.log('Updating investor_invitations for SID:', messageSid);
    const invitationUpdate: Record<string, any> = {
      delivery_status: mappedStatus
    };

    // Update main status for final statuses
    if (mappedStatus === 'delivered') {
      invitationUpdate.status = 'delivered';
      invitationUpdate.delivered_at = now;
    } else if (mappedStatus === 'failed' || mappedStatus === 'undelivered') {
      invitationUpdate.status = 'failed';
      invitationUpdate.twilio_error_code = errorCode || null;
      invitationUpdate.twilio_error_message = errorMessage || null;
      invitationUpdate.error_message = errorCode ? 'Twilio Error ' + errorCode + ': ' + (errorMessage || 'Delivery failed') : 'Message delivery failed';
    }

    const invResult = await dbUpdate('investor_invitations', 'twilio_sid=eq.' + messageSid, invitationUpdate);
    console.log('Invitation update completed');

    // Update sms_logs table
    console.log('Updating sms_logs for SID:', messageSid);
    const smsLogUpdate: Record<string, any> = {
      delivery_status: mappedStatus
    };

    if (mappedStatus === 'delivered') {
      smsLogUpdate.status = 'delivered';
      smsLogUpdate.delivered_at = now;
    } else if (mappedStatus === 'failed' || mappedStatus === 'undelivered') {
      smsLogUpdate.status = 'failed';
      smsLogUpdate.twilio_error_code = errorCode || null;
      smsLogUpdate.twilio_error_message = errorMessage || null;
      smsLogUpdate.error_message = errorCode ? 'Twilio Error ' + errorCode + ': ' + (errorMessage || 'Delivery failed') : 'Message delivery failed';
    }

    // Try updating by twilio_sid first, then by twilio_message_sid
    let smsResult = await dbUpdate('sms_logs', 'twilio_sid=eq.' + messageSid, smsLogUpdate);
    if (!smsResult || (Array.isArray(smsResult) && smsResult.length === 0)) {
      smsResult = await dbUpdate('sms_logs', 'twilio_message_sid=eq.' + messageSid, smsLogUpdate);
    }
    console.log('SMS log update completed');

    // Return TwiML empty response (Twilio expects this)
    console.log('=== Webhook processing complete ===');
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('Webhook error:', error.message);
    console.error('Error stack:', error.stack);
    
    // Log the error
    try {
      await dbInsert('sms_webhook_logs', {
        twilio_sid: 'error',
        status: 'error',
        error_message: error.message,
        raw_payload: 'Error processing webhook: ' + error.message,
        received_at: new Date().toISOString()
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
    // Still return success to Twilio to prevent retries
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml', ...corsHeaders }
    });
  }
});

