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

interface QuoteData {
  propertyCount: number;
  bedrooms: string;
  propertyType: string;
  location: string;
  operationType: string;
  totals: {
    adminFee: number;
    furnitureCost: number;
    logisticsFee: number;
    total: number;
    perProperty: number;
    savings: number;
  };
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (data: any, status = 200) => new Response(JSON.stringify(data), { 
    status, 
    headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
  });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return json({ error: 'Server config error' }, 500);
    }

    const headers = { 
      'apikey': SUPABASE_KEY, 
      'Authorization': `Bearer ${SUPABASE_KEY}`, 
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    const body = await req.json();
    const { action, quoteData, email, investorId } = body;

    // Generate quote number
    const quoteNumber = `AYP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    
    // Quote valid for 30 days
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);
    const validUntilStr = validUntil.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const createdAt = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Helper function to get readable labels
    const getBedroomLabel = (value: string) => {
      const labels: Record<string, string> = {
        'studio': 'Studio',
        '1': '1 Bedroom',
        '2': '2 Bedrooms',
        '3': '3 Bedrooms',
        '4': '4 Bedrooms',
        '5+': '5+ Bedrooms'
      };
      return labels[value] || value;
    };

    const getPropertyTypeLabel = (value: string) => {
      const labels: Record<string, string> = {
        'apartment': 'Apartment',
        'condo': 'Condo',
        'townhome': 'Townhome',
        'single-family': 'Single Family',
        'high-rise': 'High-Rise'
      };
      return labels[value] || value;
    };

    const getOperationTypeLabel = (value: string) => {
      const labels: Record<string, string> = {
        'str': 'Short-Term Rental',
        'mtr': 'Mid-Term Rental',
        'coliving': 'Co-Living',
        'corporate': 'Corporate Housing',
        'peerspace': 'Peerspace'
      };
      return labels[value] || value;
    };

    // Generate HTML quote document
    const generateQuoteHTML = (data: QuoteData) => {
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Setup Services Quote - ${quoteNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a2332; line-height: 1.6; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #d4a574; }
    .logo { font-size: 28px; font-weight: bold; color: #1a2332; }
    .logo span { color: #d4a574; }
    .quote-info { text-align: right; }
    .quote-number { font-size: 14px; color: #666; }
    .quote-date { font-size: 12px; color: #888; margin-top: 4px; }
    .title { font-size: 32px; font-weight: bold; color: #1a2332; margin-bottom: 8px; }
    .subtitle { font-size: 16px; color: #666; margin-bottom: 30px; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 18px; font-weight: bold; color: #1a2332; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
    .property-details { background: #f9fafb; border-radius: 8px; padding: 20px; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #666; }
    .detail-value { font-weight: 600; color: #1a2332; }
    .cost-breakdown { background: #fff; border: 2px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    .cost-row { display: flex; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #e5e7eb; }
    .cost-row:last-child { border-bottom: none; }
    .cost-row.total { background: #1a2332; color: white; }
    .cost-row.total .cost-amount { color: #d4a574; font-size: 24px; }
    .cost-row.savings { background: #ecfdf5; color: #047857; }
    .cost-label { display: flex; flex-direction: column; }
    .cost-sublabel { font-size: 12px; color: #888; margin-top: 2px; }
    .cost-row.total .cost-sublabel { color: #9ca3af; }
    .cost-amount { font-weight: bold; font-size: 18px; }
    .validity { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px 20px; margin-top: 30px; }
    .validity-title { font-weight: bold; color: #92400e; margin-bottom: 4px; }
    .validity-text { font-size: 14px; color: #92400e; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; }
    .footer-text { font-size: 14px; color: #666; margin-bottom: 8px; }
    .footer-contact { font-size: 14px; color: #1a2332; }
    .footer-contact a { color: #d4a574; text-decoration: none; }
    .disclaimer { font-size: 11px; color: #888; margin-top: 20px; padding: 15px; background: #f9fafb; border-radius: 8px; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .container { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Access<span>Your</span>Place</div>
      <div class="quote-info">
        <div class="quote-number">Quote #${quoteNumber}</div>
        <div class="quote-date">Generated: ${createdAt}</div>
      </div>
    </div>

    <h1 class="title">Setup Services Estimate</h1>
    <p class="subtitle">Professional property setup from design to photo-ready</p>

    ${data.customerName ? `
    <div class="section">
      <div class="section-title">Prepared For</div>
      <div class="property-details">
        <div class="detail-row">
          <span class="detail-label">Name</span>
          <span class="detail-value">${data.customerName}</span>
        </div>
        ${data.customerEmail ? `
        <div class="detail-row">
          <span class="detail-label">Email</span>
          <span class="detail-value">${data.customerEmail}</span>
        </div>
        ` : ''}
        ${data.customerPhone ? `
        <div class="detail-row">
          <span class="detail-label">Phone</span>
          <span class="detail-value">${data.customerPhone}</span>
        </div>
        ` : ''}
      </div>
    </div>
    ` : ''}

    <div class="section">
      <div class="section-title">Property Details</div>
      <div class="property-details">
        <div class="detail-row">
          <span class="detail-label">Number of Properties</span>
          <span class="detail-value">${data.propertyCount} ${data.propertyCount === 1 ? 'Property' : 'Properties'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Average Bedroom Count</span>
          <span class="detail-value">${getBedroomLabel(data.bedrooms)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Property Type</span>
          <span class="detail-value">${getPropertyTypeLabel(data.propertyType)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Operation Type</span>
          <span class="detail-value">${getOperationTypeLabel(data.operationType)}</span>
        </div>
        ${data.location ? `
        <div class="detail-row">
          <span class="detail-label">Location</span>
          <span class="detail-value">${data.location}</span>
        </div>
        ` : ''}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Cost Breakdown</div>
      <div class="cost-breakdown">
        <div class="cost-row">
          <div class="cost-label">
            <span>Setup Administration Fee</span>
            <span class="cost-sublabel">Dedicated US-based Setup Manager, design, sourcing & coordination</span>
          </div>
          <span class="cost-amount">$${data.totals.adminFee.toLocaleString()}</span>
        </div>
        <div class="cost-row">
          <div class="cost-label">
            <span>Furniture & Supplies</span>
            <span class="cost-sublabel">Wholesale-priced furniture, decor, linens & household items</span>
          </div>
          <span class="cost-amount">$${data.totals.furnitureCost.toLocaleString()}</span>
        </div>
        <div class="cost-row">
          <div class="cost-label">
            <span>Logistics Fee</span>
            <span class="cost-sublabel">14-day on-site YP Pro for assembly, installation & setup</span>
          </div>
          <span class="cost-amount">$${data.totals.logisticsFee.toLocaleString()}</span>
        </div>
        <div class="cost-row total">
          <div class="cost-label">
            <span>Total Investment</span>
            <span class="cost-sublabel">$${data.totals.perProperty.toLocaleString()} per property</span>
          </div>
          <span class="cost-amount">$${data.totals.total.toLocaleString()}</span>
        </div>
        ${data.totals.savings > 0 ? `
        <div class="cost-row savings">
          <div class="cost-label">
            <span>Bulk Discount Savings</span>
            <span class="cost-sublabel">Compared to individual property launches</span>
          </div>
          <span class="cost-amount">-$${data.totals.savings.toLocaleString()}</span>
        </div>
        ` : ''}
      </div>
    </div>

    <div class="validity">
      <div class="validity-title">Quote Validity</div>
      <div class="validity-text">This estimate is valid until ${validUntilStr}. Pricing may vary based on final design selections, market conditions, and specific property requirements.</div>
    </div>

    <div class="footer">
      <p class="footer-text">Ready to get started? Schedule a consultation with our Setup Management Team.</p>
      <p class="footer-contact">
        <a href="https://calendly.com/investyourplaces">Book a Call</a> | 
        <a href="mailto:setup@accessyourplace.com">setup@accessyourplace.com</a> | 
        <a href="https://accessyourplace.com/setup-services">accessyourplace.com/setup-services</a>
      </p>
    </div>

    <div class="disclaimer">
      <strong>Disclaimer:</strong> This is an estimate based on the information provided. Final costs may vary depending on actual property conditions, design complexity, furniture selections, and market-specific factors. Furniture & Supplies costs are approximate and will be finalized after design approval. This quote does not constitute a binding agreement. Contact us for a detailed proposal.
    </div>
  </div>
</body>
</html>
      `;
    };

    // Action: Generate PDF HTML for download
    if (action === 'generate') {
      const html = generateQuoteHTML(quoteData);
      return json({ 
        success: true, 
        html, 
        quoteNumber,
        validUntil: validUntilStr 
      });
    }

    // Action: Email quote
    if (action === 'email') {
      if (!email) {
        return json({ error: 'Email address required' }, 400);
      }

      if (!RESEND_KEY) {
        return json({ error: 'Email service not configured' }, 500);
      }

      const html = generateQuoteHTML({ ...quoteData, customerEmail: email });

      // Send email via Resend
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Access Your Place <onboarding@resend.dev>',
          to: email,
          subject: `Your Setup Services Quote #${quoteNumber}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1a2332;">Your Setup Services Quote</h2>
              <p>Thank you for your interest in our Setup Management Team services!</p>
              <p>Your personalized quote is attached below. This estimate is valid until <strong>${validUntilStr}</strong>.</p>
              
              <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #1a2332; margin-bottom: 15px;">Quote Summary</h3>
                <p><strong>Quote Number:</strong> ${quoteNumber}</p>
                <p><strong>Properties:</strong> ${quoteData.propertyCount}</p>
                <p><strong>Total Estimate:</strong> $${quoteData.totals.total.toLocaleString()}</p>
                ${quoteData.totals.savings > 0 ? `<p style="color: #047857;"><strong>Bulk Savings:</strong> $${quoteData.totals.savings.toLocaleString()}</p>` : ''}
              </div>
              
              <p>Ready to move forward? <a href="https://calendly.com/investyourplaces" style="color: #d4a574;">Schedule a consultation</a> with our team.</p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              
              ${html}
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              
              <p style="font-size: 12px; color: #888;">
                This email was sent by Access Your Place. If you didn't request this quote, please ignore this email.
              </p>
            </div>
          `
        })
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json();
        console.error('Resend error:', errorData);
        return json({ error: 'Failed to send email' }, 500);
      }

      return json({ 
        success: true, 
        message: 'Quote sent to your email',
        quoteNumber 
      });
    }

    // Action: Save to investor account
    if (action === 'save') {
      if (!investorId) {
        return json({ error: 'Must be logged in to save quotes' }, 401);
      }

      // Save quote to database
      const saveResponse = await fetch(`${SUPABASE_URL}/rest/v1/setup_quotes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          investor_id: investorId,
          quote_number: quoteNumber,
          property_count: quoteData.propertyCount,
          bedrooms: quoteData.bedrooms,
          property_type: quoteData.propertyType,
          operation_type: quoteData.operationType,
          location: quoteData.location || null,
          admin_fee: quoteData.totals.adminFee,
          furniture_cost: quoteData.totals.furnitureCost,
          logistics_fee: quoteData.totals.logisticsFee,
          total_estimate: quoteData.totals.total,
          per_property_cost: quoteData.totals.perProperty,
          bulk_savings: quoteData.totals.savings,
          valid_until: validUntil.toISOString(),
          status: 'active'
        })
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        console.error('Save error:', errorData);
        return json({ error: 'Failed to save quote' }, 500);
      }

      const savedQuote = await saveResponse.json();

      return json({ 
        success: true, 
        message: 'Quote saved to your account',
        quoteNumber,
        quoteId: savedQuote[0]?.id
      });
    }

    // Action: Get saved quotes for investor
    if (action === 'list') {
      if (!investorId) {
        return json({ error: 'Must be logged in to view quotes' }, 401);
      }

      const listResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/setup_quotes?investor_id=eq.${investorId}&order=created_at.desc`,
        { headers }
      );

      if (!listResponse.ok) {
        return json({ error: 'Failed to fetch quotes' }, 500);
      }

      const quotes = await listResponse.json();
      return json({ success: true, quotes });
    }

    return json({ error: 'Invalid action' }, 400);

  } catch (error) {
    console.error('Error:', error);
    return json({ error: 'Server error', details: String(error) }, 500);
  }
});
