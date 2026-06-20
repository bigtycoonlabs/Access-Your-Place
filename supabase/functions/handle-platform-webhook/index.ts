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
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature, x-guesty-signature, x-hostaway-signature'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const connectionId = pathParts[pathParts.length - 1] || url.searchParams.get('connection_id');
    
    // Handle test webhook
    if (req.method === 'POST') {
      const body = await req.json();
      
      // Check if this is a test webhook
      if (body.action === 'test_webhook') {
        return await handleTestWebhook(body);
      }
      
      // Check if this is getting webhook info
      if (body.action === 'get_webhook_info') {
        return await getWebhookInfo(body.connection_id);
      }
      
      // Check if this is getting webhook events
      if (body.action === 'get_webhook_events') {
        return await getWebhookEvents(body.investor_id, body.limit);
      }
      
      // Check if this is generating webhook URL
      if (body.action === 'generate_webhook_url') {
        return await generateWebhookUrl(body.connection_id);
      }

      // Handle actual webhook from platform
      if (connectionId && connectionId !== 'handle-platform-webhook') {
        return await processIncomingWebhook(connectionId, body, req.headers);
      }
      
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function generateWebhookUrl(connectionId: string) {
  const { data: connection, error } = await supabase
    .from('platform_connections')
    .select('*')
    .eq('id', connectionId)
    .single();

  if (error || !connection) {
    return new Response(JSON.stringify({ error: 'Connection not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Generate unique webhook secret if not exists
  let webhookSecret = connection.webhook_secret;
  if (!webhookSecret) {
    webhookSecret = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    
    await supabase
      .from('platform_connections')
      .update({ webhook_secret: webhookSecret })
      .eq('id', connectionId);
  }

  const baseUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.functions.supabase.co');
  const webhookUrl = `${baseUrl}/handle-platform-webhook/${connectionId}`;

  // Update connection with webhook URL
  await supabase
    .from('platform_connections')
    .update({ webhook_url: webhookUrl })
    .eq('id', connectionId);

  return new Response(JSON.stringify({
    webhook_url: webhookUrl,
    webhook_secret: webhookSecret,
    platform: connection.platform,
    instructions: getWebhookInstructions(connection.platform, webhookUrl, webhookSecret)
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function getWebhookInstructions(platform: string, webhookUrl: string, webhookSecret: string): string {
  const instructions: Record<string, string> = {
    guesty: `1. Go to Guesty Dashboard > Settings > Webhooks
2. Click "Add Webhook"
3. Enter URL: ${webhookUrl}
4. Select events: reservation.new, reservation.updated, reservation.cancelled
5. Add header: X-Webhook-Secret: ${webhookSecret}
6. Save and test the webhook`,
    
    hostaway: `1. Go to Hostaway Dashboard > Settings > API
2. Click "Webhooks" tab
3. Add new webhook with URL: ${webhookUrl}
4. Select events: reservation_created, reservation_updated, reservation_cancelled
5. Copy the signing secret and use it to verify requests
6. Save the webhook`,
    
    ownerrez: `1. Go to OwnerRez > Settings > API & Webhooks
2. Click "Add Webhook"
3. Enter URL: ${webhookUrl}
4. Select booking events
5. Add secret: ${webhookSecret}
6. Enable and save`,
    
    hospitable: `1. Go to Hospitable > Settings > Integrations
2. Find Webhooks section
3. Add endpoint: ${webhookUrl}
4. Configure for booking events
5. Use secret: ${webhookSecret}`,
    
    lodgify: `1. Go to Lodgify > Settings > API
2. Navigate to Webhooks
3. Add URL: ${webhookUrl}
4. Select reservation events
5. Save configuration`,
    
    vrbo: `1. Go to VRBO Partner Central > API Settings
2. Configure webhook endpoint: ${webhookUrl}
3. Enable booking notifications
4. Save settings`
  };

  return instructions[platform] || `Configure your ${platform} webhook to send events to: ${webhookUrl}`;
}

async function getWebhookInfo(connectionId: string) {
  const { data: connection, error } = await supabase
    .from('platform_connections')
    .select('id, platform, webhook_url, webhook_secret, is_active')
    .eq('id', connectionId)
    .single();

  if (error || !connection) {
    return new Response(JSON.stringify({ error: 'Connection not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Get recent webhook events
  const { data: recentEvents } = await supabase
    .from('webhook_events')
    .select('*')
    .eq('connection_id', connectionId)
    .order('received_at', { ascending: false })
    .limit(10);

  return new Response(JSON.stringify({
    connection_id: connection.id,
    platform: connection.platform,
    webhook_url: connection.webhook_url,
    webhook_secret: connection.webhook_secret,
    is_active: connection.is_active,
    recent_events: recentEvents || [],
    instructions: connection.webhook_url ? 
      getWebhookInstructions(connection.platform, connection.webhook_url, connection.webhook_secret || '') : 
      'Generate a webhook URL first'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function getWebhookEvents(investorId: string, limit: number = 50) {
  const { data: events, error } = await supabase
    .from('webhook_events')
    .select('*, platform_connections(platform, account_email)')
    .eq('investor_id', investorId)
    .order('received_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return new Response(JSON.stringify({ events: events || [] }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleTestWebhook(params: { connection_id: string; event_type: string; test_data?: any }) {
  const { connection_id, event_type, test_data } = params;

  const { data: connection, error } = await supabase
    .from('platform_connections')
    .select('*')
    .eq('id', connection_id)
    .single();

  if (error || !connection) {
    return new Response(JSON.stringify({ error: 'Connection not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Generate test booking data
  const testBooking = test_data || generateTestBookingData(connection.platform, event_type);

  // Log the test event
  const { data: event } = await supabase
    .from('webhook_events')
    .insert({
      connection_id,
      investor_id: connection.investor_id,
      platform: connection.platform,
      event_type: `test_${event_type}`,
      event_id: `test_${Date.now()}`,
      payload: testBooking,
      processed: false
    })
    .select()
    .single();

  // Process the test booking
  try {
    await processBookingEvent(connection, event_type, testBooking);
    
    await supabase
      .from('webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('id', event?.id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Test webhook processed successfully',
      event_id: event?.id,
      test_data: testBooking
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    await supabase
      .from('webhook_events')
      .update({ processed: true, processing_error: err.message, processed_at: new Date().toISOString() })
      .eq('id', event?.id);

    return new Response(JSON.stringify({
      success: false,
      error: err.message,
      event_id: event?.id
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

function generateTestBookingData(platform: string, eventType: string) {
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 7);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + 3);

  const baseBooking = {
    id: `test_${Date.now()}`,
    guest_name: 'Test Guest',
    guest_email: 'test@example.com',
    check_in: checkIn.toISOString().split('T')[0],
    check_out: checkOut.toISOString().split('T')[0],
    nights: 3,
    total_price: 450,
    platform_fee: 45,
    cleaning_fee: 75,
    host_payout: 480,
    status: eventType === 'cancellation' ? 'cancelled' : 'confirmed',
    created_at: new Date().toISOString()
  };

  // Format based on platform
  switch (platform) {
    case 'guesty':
      return {
        _id: baseBooking.id,
        guest: { fullName: baseBooking.guest_name, email: baseBooking.guest_email },
        checkIn: baseBooking.check_in,
        checkOut: baseBooking.check_out,
        money: {
          totalPrice: baseBooking.total_price,
          hostPayout: baseBooking.host_payout,
          commissionIncTax: baseBooking.platform_fee,
          cleaningFee: baseBooking.cleaning_fee
        },
        status: baseBooking.status,
        createdAt: baseBooking.created_at
      };
    
    case 'hostaway':
      return {
        id: parseInt(baseBooking.id.replace('test_', '')),
        guestName: baseBooking.guest_name,
        guestEmail: baseBooking.guest_email,
        arrivalDate: baseBooking.check_in,
        departureDate: baseBooking.check_out,
        totalPrice: baseBooking.total_price,
        hostPayout: baseBooking.host_payout,
        channelCommission: baseBooking.platform_fee,
        cleaningFee: baseBooking.cleaning_fee,
        status: baseBooking.status,
        createdAt: baseBooking.created_at
      };
    
    default:
      return baseBooking;
  }
}

async function processIncomingWebhook(connectionId: string, payload: any, headers: Headers) {
  const { data: connection, error } = await supabase
    .from('platform_connections')
    .select('*')
    .eq('id', connectionId)
    .single();

  if (error || !connection) {
    return new Response(JSON.stringify({ error: 'Connection not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Verify webhook signature if secret exists
  if (connection.webhook_secret) {
    const signature = headers.get('x-webhook-signature') || 
                     headers.get('x-guesty-signature') || 
                     headers.get('x-hostaway-signature');
    
    if (signature && !verifySignature(JSON.stringify(payload), connection.webhook_secret, signature)) {
      console.warn('Invalid webhook signature');
      // Log but don't reject - some platforms have different signature formats
    }
  }

  // Determine event type
  const eventType = payload.event || payload.type || payload.action || 
                   (payload.reservation ? 'reservation.updated' : 'booking.updated');

  // Log the webhook event
  const { data: event } = await supabase
    .from('webhook_events')
    .insert({
      connection_id: connectionId,
      investor_id: connection.investor_id,
      platform: connection.platform,
      event_type: eventType,
      event_id: payload.id || payload._id || payload.reservation?.id,
      payload,
      processed: false
    })
    .select()
    .single();

  // Process the event
  try {
    await processBookingEvent(connection, eventType, payload);
    
    await supabase
      .from('webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('id', event?.id);

    // Trigger portfolio recalculation
    await recalculatePortfolio(connection.investor_id);

    return new Response(JSON.stringify({ success: true, event_id: event?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    await supabase
      .from('webhook_events')
      .update({ processed: true, processing_error: err.message, processed_at: new Date().toISOString() })
      .eq('id', event?.id);

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

function verifySignature(payload: string, secret: string, signature: string): boolean {
  try {
    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');
    return signature === expectedSignature || signature === `sha256=${expectedSignature}`;
  } catch {
    return false;
  }
}

async function processBookingEvent(connection: any, eventType: string, payload: any) {
  const booking = extractBookingData(connection.platform, payload);
  
  if (!booking) {
    console.log('Could not extract booking data from payload');
    return;
  }

  const nights = Math.ceil(
    (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Determine status based on event type
  let status = booking.status || 'confirmed';
  if (eventType.includes('cancel')) {
    status = 'cancelled';
  } else if (eventType.includes('new') || eventType.includes('create')) {
    status = 'confirmed';
  }

  // Upsert booking
  await supabase
    .from('platform_bookings')
    .upsert({
      connection_id: connection.id,
      investor_id: connection.investor_id,
      platform: connection.platform,
      platform_booking_id: booking.id,
      platform_listing_id: booking.listing_id,
      guest_name: booking.guest_name,
      check_in: booking.check_in,
      check_out: booking.check_out,
      nights,
      gross_revenue: booking.gross_revenue,
      platform_fees: booking.platform_fees,
      cleaning_fee: booking.cleaning_fee,
      net_revenue: booking.net_revenue,
      status,
      booking_date: booking.booking_date || new Date().toISOString()
    }, { onConflict: 'platform_booking_id' });
}

function extractBookingData(platform: string, payload: any): any {
  const data = payload.reservation || payload.booking || payload.data || payload;
  
  switch (platform) {
    case 'guesty':
      return {
        id: data._id || data.id,
        listing_id: data.listingId,
        guest_name: data.guest?.fullName || 'Guest',
        check_in: data.checkIn,
        check_out: data.checkOut,
        gross_revenue: data.money?.totalPrice || 0,
        platform_fees: data.money?.commissionIncTax || 0,
        cleaning_fee: data.money?.cleaningFee || 0,
        net_revenue: data.money?.hostPayout || 0,
        status: data.status,
        booking_date: data.createdAt
      };
    
    case 'hostaway':
      return {
        id: data.id?.toString(),
        listing_id: data.listingMapId?.toString(),
        guest_name: data.guestName || 'Guest',
        check_in: data.arrivalDate,
        check_out: data.departureDate,
        gross_revenue: data.totalPrice || 0,
        platform_fees: data.channelCommission || 0,
        cleaning_fee: data.cleaningFee || 0,
        net_revenue: data.hostPayout || data.totalPrice || 0,
        status: data.status,
        booking_date: data.createdAt
      };
    
    case 'ownerrez':
      return {
        id: data.id?.toString(),
        listing_id: data.property_id?.toString(),
        guest_name: data.guest?.name || 'Guest',
        check_in: data.arrival,
        check_out: data.departure,
        gross_revenue: data.total || 0,
        platform_fees: data.channel_fee || 0,
        cleaning_fee: data.cleaning_fee || 0,
        net_revenue: data.owner_payout || data.total || 0,
        status: data.status,
        booking_date: data.created
      };
    
    default:
      return {
        id: data.id || data._id,
        listing_id: data.listing_id || data.listingId || data.property_id,
        guest_name: data.guest_name || data.guestName || data.guest?.name || 'Guest',
        check_in: data.check_in || data.checkIn || data.arrival || data.arrivalDate,
        check_out: data.check_out || data.checkOut || data.departure || data.departureDate,
        gross_revenue: data.total_price || data.totalPrice || data.gross_revenue || data.total || 0,
        platform_fees: data.platform_fee || data.platform_fees || data.channelCommission || 0,
        cleaning_fee: data.cleaning_fee || data.cleaningFee || 0,
        net_revenue: data.host_payout || data.hostPayout || data.net_revenue || 0,
        status: data.status,
        booking_date: data.created_at || data.createdAt || data.booking_date
      };
  }
}

async function recalculatePortfolio(investorId: string) {
  // Get all bookings for investor
  const { data: bookings } = await supabase
    .from('platform_bookings')
    .select('*, platform_listings(property_id)')
    .eq('investor_id', investorId);

  if (!bookings || bookings.length === 0) return;

  // Aggregate by property and month
  const monthlyData: Record<string, any> = {};

  for (const booking of bookings) {
    const propertyId = booking.platform_listings?.property_id || booking.property_id;
    if (!propertyId) continue;

    const checkIn = new Date(booking.check_in);
    const monthKey = `${propertyId}_${checkIn.getFullYear()}_${checkIn.getMonth() + 1}`;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        property_id: propertyId,
        investor_id: investorId,
        month: checkIn.getMonth() + 1,
        year: checkIn.getFullYear(),
        revenue: 0,
        bookings: 0,
        nights_booked: 0
      };
    }

    if (booking.status !== 'cancelled') {
      monthlyData[monthKey].revenue += parseFloat(booking.net_revenue || 0);
      monthlyData[monthKey].bookings += 1;
      monthlyData[monthKey].nights_booked += booking.nights || 0;
    }
  }

  // Update portfolio monthly data
  for (const key in monthlyData) {
    const data = monthlyData[key];
    const daysInMonth = new Date(data.year, data.month, 0).getDate();
    data.occupancy_rate = Math.min(100, Math.round((data.nights_booked / daysInMonth) * 100));

    await supabase
      .from('portfolio_monthly_data')
      .upsert({
        property_id: data.property_id,
        investor_id: data.investor_id,
        month: data.month,
        year: data.year,
        revenue: data.revenue,
        occupancy_rate: data.occupancy_rate,
        notes: `Webhook update. ${data.bookings} bookings, ${data.nights_booked} nights.`
      }, { onConflict: 'property_id,month,year' });
  }
}

