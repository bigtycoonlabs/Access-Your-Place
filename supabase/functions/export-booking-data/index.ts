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

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const headers = {
  'Content-Type': 'application/json',
  'apikey': supabaseKey,
  'Authorization': `Bearer ${supabaseKey}`
};

async function dbQuery(table: string, params: string = '') {
  const url = `${supabaseUrl}/rest/v1/${table}?${params}`;
  const res = await fetch(url, { headers });
  return await res.json();
}

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US');
  } catch {
    return dateStr;
  }
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '';
  return value.toFixed(2);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, investor_id, format, filters } = body;

    if (action === 'export_bookings') {
      if (!investor_id) {
        return new Response(JSON.stringify({ error: 'Investor ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Build query params based on filters
      let queryParams = `select=*,platform_listings(listing_name,address,city,state,property_id)`;
      
      // Get connections for this investor first
      const connections = await dbQuery('platform_connections', `investor_id=eq.${investor_id}&select=id`);
      if (!connections?.length) {
        return new Response(JSON.stringify({ 
          error: 'No platform connections found',
          data: null 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const connectionIds = connections.map((c: any) => c.id);
      
      // Get listings for these connections
      const listings = await dbQuery('platform_listings', `connection_id=in.(${connectionIds.join(',')})&select=id,listing_name,platform,property_id`);
      if (!listings?.length) {
        return new Response(JSON.stringify({ 
          error: 'No listings found',
          data: null 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const listingIds = listings.map((l: any) => l.id);
      
      // Build booking query with filters
      let bookingQuery = `listing_id=in.(${listingIds.join(',')})&select=*,platform_listings(listing_name,address,city,state,property_id,platform)&order=check_in.desc`;
      
      // Apply date range filter
      if (filters?.start_date) {
        bookingQuery += `&check_in=gte.${filters.start_date}`;
      }
      if (filters?.end_date) {
        bookingQuery += `&check_out=lte.${filters.end_date}`;
      }
      
      // Apply platform filter
      if (filters?.platform && filters.platform !== 'all') {
        // Get listing IDs for this platform only
        const platformListings = listings.filter((l: any) => l.platform === filters.platform);
        if (platformListings.length === 0) {
          return new Response(JSON.stringify({ 
            error: 'No bookings found for selected platform',
            data: null 
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const platformListingIds = platformListings.map((l: any) => l.id);
        bookingQuery = `listing_id=in.(${platformListingIds.join(',')})&select=*,platform_listings(listing_name,address,city,state,property_id,platform)&order=check_in.desc`;
        if (filters?.start_date) {
          bookingQuery += `&check_in=gte.${filters.start_date}`;
        }
        if (filters?.end_date) {
          bookingQuery += `&check_out=lte.${filters.end_date}`;
        }
      }
      
      // Apply property filter
      if (filters?.property_id && filters.property_id !== 'all') {
        const propertyListings = listings.filter((l: any) => l.property_id === filters.property_id);
        if (propertyListings.length === 0) {
          return new Response(JSON.stringify({ 
            error: 'No bookings found for selected property',
            data: null 
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const propertyListingIds = propertyListings.map((l: any) => l.id);
        bookingQuery = `listing_id=in.(${propertyListingIds.join(',')})&select=*,platform_listings(listing_name,address,city,state,property_id,platform)&order=check_in.desc`;
        if (filters?.start_date) {
          bookingQuery += `&check_in=gte.${filters.start_date}`;
        }
        if (filters?.end_date) {
          bookingQuery += `&check_out=lte.${filters.end_date}`;
        }
      }

      const bookings = await dbQuery('platform_bookings', bookingQuery);
      
      if (!bookings?.length) {
        return new Response(JSON.stringify({ 
          error: 'No bookings found matching filters',
          data: null 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Generate export based on format
      if (format === 'csv') {
        // CSV headers
        const csvHeaders = [
          'Platform',
          'Listing Name',
          'Property Address',
          'Guest Name',
          'Check In',
          'Check Out',
          'Nights',
          'Gross Revenue',
          'Net Revenue',
          'Platform Fees',
          'Cleaning Fee',
          'Status',
          'Booking ID',
          'Created At'
        ];

        let csvContent = csvHeaders.join(',') + '\n';

        for (const booking of bookings) {
          const row = [
            escapeCSV(booking.platform_listings?.platform || booking.platform || ''),
            escapeCSV(booking.platform_listings?.listing_name || ''),
            escapeCSV(booking.platform_listings?.address ? 
              `${booking.platform_listings.address}, ${booking.platform_listings.city}, ${booking.platform_listings.state}` : ''),
            escapeCSV(booking.guest_name || ''),
            escapeCSV(formatDate(booking.check_in)),
            escapeCSV(formatDate(booking.check_out)),
            escapeCSV(booking.nights || ''),
            escapeCSV(formatCurrency(booking.gross_revenue)),
            escapeCSV(formatCurrency(booking.net_revenue)),
            escapeCSV(formatCurrency(booking.platform_fees)),
            escapeCSV(formatCurrency(booking.cleaning_fee)),
            escapeCSV(booking.status || ''),
            escapeCSV(booking.platform_booking_id || ''),
            escapeCSV(formatDate(booking.created_at))
          ];
          csvContent += row.join(',') + '\n';
        }

        // Calculate summary
        const totalGross = bookings.reduce((sum: number, b: any) => sum + (parseFloat(b.gross_revenue) || 0), 0);
        const totalNet = bookings.reduce((sum: number, b: any) => sum + (parseFloat(b.net_revenue) || 0), 0);
        const totalNights = bookings.reduce((sum: number, b: any) => sum + (parseInt(b.nights) || 0), 0);
        
        csvContent += '\n';
        csvContent += 'Summary\n';
        csvContent += `Total Bookings,${bookings.length}\n`;
        csvContent += `Total Nights,${totalNights}\n`;
        csvContent += `Total Gross Revenue,$${totalGross.toFixed(2)}\n`;
        csvContent += `Total Net Revenue,$${totalNet.toFixed(2)}\n`;
        csvContent += `Average Nightly Rate,$${totalNights > 0 ? (totalNet / totalNights).toFixed(2) : '0.00'}\n`;

        // Return as base64 encoded data
        const base64Content = btoa(unescape(encodeURIComponent(csvContent)));
        
        return new Response(JSON.stringify({
          success: true,
          filename: `booking_export_${new Date().toISOString().split('T')[0]}.csv`,
          content_type: 'text/csv',
          data: base64Content,
          record_count: bookings.length,
          summary: {
            total_bookings: bookings.length,
            total_nights: totalNights,
            total_gross: totalGross,
            total_net: totalNet
          }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      } else if (format === 'excel') {
        // For Excel, we'll create a more structured format that can be opened in Excel
        // Using tab-separated values with .xls extension for compatibility
        
        const headers = [
          'Platform',
          'Listing Name',
          'Property Address',
          'Guest Name',
          'Check In',
          'Check Out',
          'Nights',
          'Gross Revenue',
          'Net Revenue',
          'Platform Fees',
          'Cleaning Fee',
          'Status',
          'Booking ID',
          'Created At'
        ];

        let excelContent = headers.join('\t') + '\n';

        for (const booking of bookings) {
          const row = [
            booking.platform_listings?.platform || booking.platform || '',
            booking.platform_listings?.listing_name || '',
            booking.platform_listings?.address ? 
              `${booking.platform_listings.address}, ${booking.platform_listings.city}, ${booking.platform_listings.state}` : '',
            booking.guest_name || '',
            formatDate(booking.check_in),
            formatDate(booking.check_out),
            booking.nights || '',
            formatCurrency(booking.gross_revenue),
            formatCurrency(booking.net_revenue),
            formatCurrency(booking.platform_fees),
            formatCurrency(booking.cleaning_fee),
            booking.status || '',
            booking.platform_booking_id || '',
            formatDate(booking.created_at)
          ];
          excelContent += row.join('\t') + '\n';
        }

        // Summary section
        const totalGross = bookings.reduce((sum: number, b: any) => sum + (parseFloat(b.gross_revenue) || 0), 0);
        const totalNet = bookings.reduce((sum: number, b: any) => sum + (parseFloat(b.net_revenue) || 0), 0);
        const totalNights = bookings.reduce((sum: number, b: any) => sum + (parseInt(b.nights) || 0), 0);
        
        excelContent += '\n';
        excelContent += 'Summary\n';
        excelContent += `Total Bookings\t${bookings.length}\n`;
        excelContent += `Total Nights\t${totalNights}\n`;
        excelContent += `Total Gross Revenue\t$${totalGross.toFixed(2)}\n`;
        excelContent += `Total Net Revenue\t$${totalNet.toFixed(2)}\n`;
        excelContent += `Average Nightly Rate\t$${totalNights > 0 ? (totalNet / totalNights).toFixed(2) : '0.00'}\n`;

        const base64Content = btoa(unescape(encodeURIComponent(excelContent)));
        
        return new Response(JSON.stringify({
          success: true,
          filename: `booking_export_${new Date().toISOString().split('T')[0]}.xls`,
          content_type: 'application/vnd.ms-excel',
          data: base64Content,
          record_count: bookings.length,
          summary: {
            total_bookings: bookings.length,
            total_nights: totalNights,
            total_gross: totalGross,
            total_net: totalNet
          }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ error: 'Invalid format. Use csv or excel.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get_export_options') {
      // Get available platforms and properties for filter dropdowns
      if (!investor_id) {
        return new Response(JSON.stringify({ error: 'Investor ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const connections = await dbQuery('platform_connections', `investor_id=eq.${investor_id}&select=id,platform,platform_name`);
      const platforms = [...new Set((connections || []).map((c: any) => ({ id: c.platform, name: c.platform_name })))];

      const properties = await dbQuery('investor_properties', `investor_id=eq.${investor_id}&select=id,address,city,state`);

      // Get date range of available bookings
      const connectionIds = (connections || []).map((c: any) => c.id);
      let dateRange = { min: null, max: null };
      
      if (connectionIds.length > 0) {
        const listings = await dbQuery('platform_listings', `connection_id=in.(${connectionIds.join(',')})&select=id`);
        const listingIds = (listings || []).map((l: any) => l.id);
        
        if (listingIds.length > 0) {
          const minBooking = await dbQuery('platform_bookings', `listing_id=in.(${listingIds.join(',')})&order=check_in.asc&limit=1&select=check_in`);
          const maxBooking = await dbQuery('platform_bookings', `listing_id=in.(${listingIds.join(',')})&order=check_out.desc&limit=1&select=check_out`);
          
          dateRange = {
            min: minBooking?.[0]?.check_in || null,
            max: maxBooking?.[0]?.check_out || null
          };
        }
      }

      return new Response(JSON.stringify({
        success: true,
        platforms: platforms,
        properties: properties || [],
        date_range: dateRange
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Export error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

