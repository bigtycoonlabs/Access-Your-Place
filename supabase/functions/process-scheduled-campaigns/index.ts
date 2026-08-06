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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const startTime = Date.now();
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

  const headers = { 
    'apikey': SUPABASE_KEY!, 
    'Authorization': `Bearer ${SUPABASE_KEY}`, 
    'Content-Type': 'application/json', 
    'Prefer': 'return=representation' 
  };

  // Helper function to log cron job execution
  async function logCronExecution(status: string, result: any, errorMessage?: string) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/cron_job_logs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          job_name: 'process-scheduled-campaigns',
          status,
          result,
          error_message: errorMessage,
          executed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime
        })
      });
    } catch (err) {
      console.error('Failed to log cron execution:', err);
    }
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      await logCronExecution('failed', null, 'Missing configuration');
      return new Response(JSON.stringify({ error: 'Config error' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const now = new Date().toISOString();
    console.log(`Processing scheduled campaigns at ${now}`);
    
    // Get campaigns that are scheduled and due
    const res = await fetch(`${SUPABASE_URL}/rest/v1/email_campaigns?status=eq.scheduled&scheduled_for=lte.${now}&select=*`, { headers });
    const campaigns = await res.json();
    
    if (!campaigns || campaigns.length === 0) {
      console.log('No campaigns due for processing');
      const result = { 
        success: true, 
        processed: 0, 
        message: 'No campaigns due for processing',
        checked_at: now
      };
      await logCronExecution('success', result);
      return new Response(JSON.stringify(result), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log(`Found ${campaigns.length} campaigns to process`);
    let processedCount = 0;
    let failedCount = 0;
    const results: any[] = [];

    for (const campaign of campaigns) {
      console.log(`Processing campaign: ${campaign.name} (${campaign.id})`);
      
      try {
        // Update status to sending
        await fetch(`${SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaign.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: 'sending' })
        });

        // Get template
        const templateRes = await fetch(`${SUPABASE_URL}/rest/v1/custom_email_templates?id=eq.${campaign.template_id}&select=*`, { headers });
        const templates = await templateRes.json();
        const template = templates?.[0];

        if (!template) {
          console.error(`Template not found for campaign ${campaign.id}`);
          await fetch(`${SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaign.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ 
              status: 'failed', 
              completed_at: new Date().toISOString() 
            })
          });
          failedCount++;
          results.push({ campaign_id: campaign.id, status: 'failed', reason: 'Template not found' });
          continue;
        }

        // Get recipients
        const recipientIds = campaign.recipient_ids || [];
        if (recipientIds.length === 0) {
          console.log(`No recipients for campaign ${campaign.id}`);
          await fetch(`${SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaign.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ 
              status: 'completed', 
              sent_count: 0, 
              completed_at: new Date().toISOString() 
            })
          });
          processedCount++;
          results.push({ campaign_id: campaign.id, status: 'completed', sent: 0 });
          continue;
        }

        // Fetch investor details - handle array of IDs properly
        const idsParam = recipientIds.map((id: string) => `"${id}"`).join(',');
        const investorRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=in.(${idsParam})&select=*`, { headers });
        const investors = await investorRes.json();

        if (!investors || investors.length === 0) {
          console.error(`No investors found for campaign ${campaign.id}`);
          await fetch(`${SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaign.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ 
              status: 'failed', 
              completed_at: new Date().toISOString() 
            })
          });
          failedCount++;
          results.push({ campaign_id: campaign.id, status: 'failed', reason: 'No investors found' });
          continue;
        }

        console.log(`Sending to ${investors.length} recipients`);

        // Send emails
        let sentCount = 0;
        let emailErrors = 0;

        for (const recipient of investors) {
          try {
            const html = generateEmailHtml(template.blocks, recipient);
            const subject = replaceVariables(template.subject, recipient);
            
            const emailRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: 'Penny <penny@accessyourplace.com>', reply_to: ['success@accessyourplace.com'],
                to: recipient.email,
                subject,
                html
              })
            });
            
            const emailData = await emailRes.json();
            
            // Log the email
            await fetch(`${SUPABASE_URL}/rest/v1/email_logs`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                template_type: 'scheduled_campaign',
                recipient_email: recipient.email,
                recipient_id: recipient.id,
                subject,
                status: emailRes.ok ? 'sent' : 'failed',
                resend_id: emailData?.id,
                campaign_id: campaign.id,
                error_message: emailRes.ok ? null : (emailData?.message || 'Send failed'),
                sent_at: new Date().toISOString()
              })
            });
            
            if (emailRes.ok) {
              sentCount++;
            } else {
              emailErrors++;
              console.error(`Failed to send to ${recipient.email}: ${emailData?.message}`);
            }
          } catch (err) {
            emailErrors++;
            console.error('Error sending to', recipient.email, err);
          }
        }

        // Update campaign status
        await fetch(`${SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaign.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            status: 'completed',
            sent_count: sentCount,
            bounced_count: emailErrors,
            completed_at: new Date().toISOString()
          })
        });

        processedCount++;
        results.push({ 
          campaign_id: campaign.id, 
          campaign_name: campaign.name,
          status: 'completed', 
          sent: sentCount,
          errors: emailErrors
        });
        
        console.log(`Campaign ${campaign.name} completed: ${sentCount} sent, ${emailErrors} errors`);

      } catch (err) {
        console.error('Error processing campaign', campaign.id, err);
        await fetch(`${SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaign.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ 
            status: 'failed', 
            completed_at: new Date().toISOString() 
          })
        });
        failedCount++;
        results.push({ campaign_id: campaign.id, status: 'failed', reason: String(err) });
      }
    }

    console.log(`Processing complete: ${processedCount} processed, ${failedCount} failed`);

    const finalResult = { 
      success: true, 
      processed: processedCount,
      failed: failedCount,
      total_found: campaigns.length,
      results,
      processed_at: new Date().toISOString()
    };

    // Log successful execution
    await logCronExecution('success', finalResult);

    return new Response(JSON.stringify(finalResult), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Server error:', error);
    await logCronExecution('failed', null, String(error));
    return new Response(JSON.stringify({ error: 'Server error', details: String(error) }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});

// Helper function to generate email HTML from blocks
function generateEmailHtml(blocks: any[], recipient: any): string {
  let html = `
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background-color: #ffffff;">
      <div style="background: linear-gradient(135deg, #1a365d 0%, #2d5a87 100%); padding: 20px; text-align: center;">
        <span style="color: white; font-size: 24px; font-weight: bold;">Access Your Place</span>
      </div>
      <div style="padding: 30px;">
  `;

  blocks?.forEach(block => {
    let content = replaceVariables(block.content || '', recipient);

    switch (block.type) {
      case 'header':
        html += `<h1 style="text-align: ${block.settings?.alignment || 'center'}; font-size: ${block.settings?.fontSize || '24px'}; font-weight: ${block.settings?.fontWeight || 'bold'}; color: ${block.settings?.color || '#1a365d'}; margin: 20px 0;">${content}</h1>`;
        break;
      case 'text':
        html += `<p style="text-align: ${block.settings?.alignment || 'left'}; font-size: ${block.settings?.fontSize || '16px'}; color: ${block.settings?.color || '#374151'}; line-height: 1.6; margin: 15px 0;">${content}</p>`;
        break;
      case 'button':
        let buttonUrl = replaceVariables(block.settings?.buttonUrl || '#', recipient);
        html += `<div style="text-align: ${block.settings?.alignment || 'center'}; margin: 25px 0;"><a href="${buttonUrl}" style="display: inline-block; background-color: ${block.settings?.backgroundColor || '#d4a574'}; color: ${block.settings?.color || '#ffffff'}; padding: ${block.settings?.padding || '12px 24px'}; text-decoration: none; border-radius: 6px; font-weight: 600;">${content}</a></div>`;
        break;
      case 'image':
        if (block.settings?.imageUrl) {
          html += `<div style="text-align: ${block.settings?.alignment || 'center'}; margin: 20px 0;"><img src="${block.settings.imageUrl}" alt="${block.settings?.imageAlt || ''}" style="max-width: 100%; height: auto; border-radius: 8px;"/></div>`;
        }
        break;
      case 'divider':
        html += `<hr style="border: none; border-top: ${block.settings?.height || '1px'} solid ${block.settings?.color || '#e5e7eb'}; margin: 25px 0;"/>`;
        break;
      case 'spacer':
        html += `<div style="height: ${block.settings?.height || '20px'};"></div>`;
        break;
    }
  });

  html += `
      </div>
      <div style="background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280;">
        <p>Access Your Place | Rental Arbitrage Deals</p>
        <p><a href="https://accessyourplace.com/unsubscribe" style="color: #6b7280;">Unsubscribe</a></p>
      </div>
    </div>
  `;

  return html;
}

// Helper function to replace variables
function replaceVariables(text: string, recipient: any): string {
  const variables: Record<string, string> = {
    investor_name: `${recipient.first_name || ''} ${recipient.last_name || ''}`.trim() || 'Investor',
    investor_email: recipient.email || '',
    investor_phone: recipient.phone || '',
    portal_link: 'https://accessyourplace.com/portal',
    current_date: new Date().toLocaleDateString(),
  };

  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}
