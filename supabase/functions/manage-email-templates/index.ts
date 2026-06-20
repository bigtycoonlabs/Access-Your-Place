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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('[manage-email-templates] Request received');

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error('[manage-email-templates] Missing environment variables');
      return new Response(JSON.stringify({ error: 'Configuration error', templates: [], campaigns: [] }), { 
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      console.log('[manage-email-templates] No body or invalid JSON');
      return new Response(JSON.stringify({ error: 'Invalid request body', templates: [], campaigns: [] }), { 
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { action } = body;
    console.log(`[manage-email-templates] Action: ${action}`);

    const headers = { 
      'apikey': SUPABASE_KEY, 
      'Authorization': `Bearer ${SUPABASE_KEY}`, 
      'Content-Type': 'application/json', 
      'Prefer': 'return=representation' 
    };

    // Helper function for safe fetch with timeout
    async function safeFetch(url: string, options: RequestInit = {}): Promise<any> {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, { 
          ...options, 
          signal: controller.signal 
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const text = await response.text();
          console.log(`[manage-email-templates] Fetch error: ${response.status} - ${text}`);
          return null;
        }
        
        return await response.json();
      } catch (e: any) {
        console.log(`[manage-email-templates] Fetch exception: ${e.message}`);
        return null;
      }
    }

    // List email templates
    if (action === 'list') {
      console.log('[manage-email-templates] Listing email templates');
      const templates = await safeFetch(`${SUPABASE_URL}/rest/v1/email_templates?select=*&order=template_name.asc`, { headers });
      return new Response(JSON.stringify({ templates: templates || [] }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // === CUSTOM TEMPLATES ===

    // List custom templates
    if (action === 'list_custom_templates') {
      console.log('[manage-email-templates] Listing custom templates');
      const templates = await safeFetch(`${SUPABASE_URL}/rest/v1/custom_email_templates?select=*&order=created_at.desc`, { headers });
      return new Response(JSON.stringify({ templates: templates || [] }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Create custom template
    if (action === 'create_custom_template') {
      const { template } = body;
      console.log('[manage-email-templates] Creating custom template:', template?.name);
      
      const result = await safeFetch(`${SUPABASE_URL}/rest/v1/custom_email_templates`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: template?.name || 'Untitled Template',
          subject: template?.subject || '',
          category: template?.category || 'custom',
          blocks: template?.blocks || [],
          is_active: template?.is_active ?? true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      });
      
      return new Response(JSON.stringify({ success: true, template: result?.[0] || null }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Update custom template
    if (action === 'update_custom_template') {
      const { template } = body;
      console.log('[manage-email-templates] Updating custom template:', template?.id);
      
      await safeFetch(`${SUPABASE_URL}/rest/v1/custom_email_templates?id=eq.${template?.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          name: template?.name,
          subject: template?.subject,
          category: template?.category,
          blocks: template?.blocks,
          is_active: template?.is_active,
          updated_at: new Date().toISOString()
        })
      });
      
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Delete custom template
    if (action === 'delete_custom_template') {
      const { template_id } = body;
      console.log('[manage-email-templates] Deleting custom template:', template_id);
      
      await safeFetch(`${SUPABASE_URL}/rest/v1/custom_email_templates?id=eq.${template_id}`, {
        method: 'DELETE',
        headers
      });
      
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // === CAMPAIGNS ===

    // List campaigns
    if (action === 'list_campaigns') {
      console.log('[manage-email-templates] Listing campaigns');
      const campaigns = await safeFetch(`${SUPABASE_URL}/rest/v1/email_campaigns?select=*&order=created_at.desc&limit=50`, { headers });
      return new Response(JSON.stringify({ campaigns: campaigns || [] }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Create campaign
    if (action === 'create_campaign') {
      const { campaign } = body;
      console.log('[manage-email-templates] Creating campaign:', campaign?.name);
      
      const result = await safeFetch(`${SUPABASE_URL}/rest/v1/email_campaigns`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: campaign?.name || 'Untitled Campaign',
          template_id: campaign?.template_id,
          template_name: campaign?.template_name,
          subject: campaign?.subject,
          recipient_ids: campaign?.recipient_ids || [],
          total_recipients: campaign?.total_recipients || 0,
          sent_count: 0,
          delivered_count: 0,
          opened_count: 0,
          bounced_count: 0,
          status: campaign?.status || (campaign?.scheduled_for ? 'scheduled' : 'sending'),
          scheduled_for: campaign?.scheduled_for || null,
          created_at: new Date().toISOString()
        })
      });
      
      return new Response(JSON.stringify({ success: true, campaign_id: result?.[0]?.id }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Cancel campaign
    if (action === 'cancel_campaign') {
      const { campaign_id } = body;
      console.log('[manage-email-templates] Cancelling campaign:', campaign_id);
      
      await safeFetch(`${SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaign_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: 'cancelled',
          completed_at: new Date().toISOString()
        })
      });
      
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Reschedule campaign
    if (action === 'reschedule_campaign') {
      const { campaign_id, scheduled_for } = body;
      console.log('[manage-email-templates] Rescheduling campaign:', campaign_id);
      
      await safeFetch(`${SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaign_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          scheduled_for,
          status: 'scheduled'
        })
      });
      
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Send scheduled campaign now
    if (action === 'send_scheduled_now') {
      const { campaign_id } = body;
      console.log('[manage-email-templates] Sending scheduled campaign now:', campaign_id);
      
      // Get campaign details
      const campaigns = await safeFetch(`${SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaign_id}&select=*`, { headers });
      const campaign = campaigns?.[0];
      
      if (!campaign) {
        return new Response(JSON.stringify({ error: 'Campaign not found', success: false }), { 
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Update status to sending
      await safeFetch(`${SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaign_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'sending', scheduled_for: null })
      });

      // Get template
      const templates = await safeFetch(`${SUPABASE_URL}/rest/v1/custom_email_templates?id=eq.${campaign.template_id}&select=*`, { headers });
      const template = templates?.[0];

      if (!template) {
        await safeFetch(`${SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaign_id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: 'failed' })
        });
        return new Response(JSON.stringify({ error: 'Template not found', success: false }), { 
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Get recipients
      const recipientIds = campaign.recipient_ids || [];
      if (recipientIds.length === 0) {
        await safeFetch(`${SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaign_id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: 'completed', sent_count: 0, completed_at: new Date().toISOString() })
        });
        return new Response(JSON.stringify({ success: true, sent: 0 }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Fetch investor details
      const investors = await safeFetch(`${SUPABASE_URL}/rest/v1/investors?id=in.(${recipientIds.map((id: string) => `"${id}"`).join(',')})&select=*`, { headers });

      // Send emails
      let sentCount = 0;
      for (const recipient of (investors || [])) {
        try {
          const html = generateEmailHtml(template.blocks, recipient);
          const subject = replaceVariables(template.subject, recipient);
          
          if (RESEND_API_KEY) {
            const emailRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: 'Access Your Place <noreply@accessyourplace.com>',
                to: recipient.email,
                subject,
                html
              })
            });
            
            const emailData = await emailRes.json();
            
            await safeFetch(`${SUPABASE_URL}/rest/v1/email_logs`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                template_type: 'campaign',
                recipient_email: recipient.email,
                recipient_id: recipient.id,
                subject,
                status: emailRes.ok ? 'sent' : 'failed',
                resend_id: emailData?.id,
                campaign_id,
                error_message: emailRes.ok ? null : (emailData?.message || 'Send failed'),
                sent_at: new Date().toISOString()
              })
            });
            
            if (emailRes.ok) sentCount++;
          }
        } catch (err: any) {
          console.error('[manage-email-templates] Error sending to', recipient.email, err.message);
        }
      }

      // Update campaign status
      await safeFetch(`${SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaign_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: 'completed',
          sent_count: sentCount,
          completed_at: new Date().toISOString()
        })
      });

      return new Response(JSON.stringify({ success: true, sent: sentCount }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Send campaign batch
    if (action === 'send_campaign_batch') {
      const { campaign_id, template, recipients } = body;
      console.log('[manage-email-templates] Sending campaign batch:', campaign_id);
      
      if (!RESEND_API_KEY) {
        return new Response(JSON.stringify({ error: 'Email service not configured', success: false, sent: 0, failed: 0 }), { 
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      let sentCount = 0;
      let failedCount = 0;

      for (const recipient of (recipients || [])) {
        try {
          const html = generateEmailHtml(template?.blocks || [], recipient);
          const subject = replaceVariables(template?.subject || '', recipient);
          
          const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'Access Your Place <noreply@accessyourplace.com>',
              to: recipient.email,
              subject,
              html
            })
          });
          
          const emailData = await emailRes.json();
          
          await safeFetch(`${SUPABASE_URL}/rest/v1/email_logs`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              template_type: 'campaign',
              recipient_email: recipient.email,
              recipient_id: recipient.id,
              subject,
              status: emailRes.ok ? 'sent' : 'failed',
              resend_id: emailData?.id,
              campaign_id,
              error_message: emailRes.ok ? null : (emailData?.message || 'Send failed'),
              sent_at: new Date().toISOString()
            })
          });
          
          if (emailRes.ok) {
            sentCount++;
          } else {
            failedCount++;
          }
        } catch (err: any) {
          failedCount++;
          console.error('[manage-email-templates] Error sending to', recipient?.email, err.message);
        }
      }
      
      return new Response(JSON.stringify({ success: true, sent: sentCount, failed: failedCount }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Complete campaign
    if (action === 'complete_campaign') {
      const { campaign_id, sent_count } = body;
      console.log('[manage-email-templates] Completing campaign:', campaign_id);
      
      await safeFetch(`${SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaign_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: 'completed',
          sent_count,
          completed_at: new Date().toISOString()
        })
      });
      
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Process scheduled campaigns (called by cron)
    if (action === 'process_scheduled') {
      console.log('[manage-email-templates] Processing scheduled campaigns');
      const now = new Date().toISOString();
      
      const campaigns = await safeFetch(`${SUPABASE_URL}/rest/v1/email_campaigns?status=eq.scheduled&scheduled_for=lte.${now}&select=*`, { headers });
      
      if (!campaigns || campaigns.length === 0) {
        return new Response(JSON.stringify({ success: true, processed: 0, message: 'No campaigns due' }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      let processedCount = 0;
      
      for (const campaign of campaigns) {
        try {
          await safeFetch(`${SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaign.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ status: 'sending' })
          });

          const templates = await safeFetch(`${SUPABASE_URL}/rest/v1/custom_email_templates?id=eq.${campaign.template_id}&select=*`, { headers });
          const template = templates?.[0];

          if (!template) {
            await safeFetch(`${SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaign.id}`, {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ status: 'failed', completed_at: new Date().toISOString() })
            });
            continue;
          }

          const recipientIds = campaign.recipient_ids || [];
          if (recipientIds.length === 0) {
            await safeFetch(`${SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaign.id}`, {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ status: 'completed', sent_count: 0, completed_at: new Date().toISOString() })
            });
            processedCount++;
            continue;
          }

          const investors = await safeFetch(`${SUPABASE_URL}/rest/v1/investors?id=in.(${recipientIds.map((id: string) => `"${id}"`).join(',')})&select=*`, { headers });

          let sentCount = 0;
          for (const recipient of (investors || [])) {
            try {
              const html = generateEmailHtml(template.blocks, recipient);
              const subject = replaceVariables(template.subject, recipient);
              
              if (RESEND_API_KEY) {
                const emailRes = await fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    from: 'Access Your Place <noreply@accessyourplace.com>',
                    to: recipient.email,
                    subject,
                    html
                  })
                });
                
                const emailData = await emailRes.json();
                
                await safeFetch(`${SUPABASE_URL}/rest/v1/email_logs`, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({
                    template_type: 'campaign',
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
                
                if (emailRes.ok) sentCount++;
              }
            } catch (err: any) {
              console.error('[manage-email-templates] Error sending to', recipient?.email, err.message);
            }
          }

          await safeFetch(`${SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaign.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              status: 'completed',
              sent_count: sentCount,
              completed_at: new Date().toISOString()
            })
          });

          processedCount++;
        } catch (err: any) {
          console.error('[manage-email-templates] Error processing campaign', campaign.id, err.message);
          await safeFetch(`${SUPABASE_URL}/rest/v1/email_campaigns?id=eq.${campaign.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ status: 'failed', completed_at: new Date().toISOString() })
          });
        }
      }

      return new Response(JSON.stringify({ success: true, processed: processedCount }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Update email template
    if (action === 'update') {
      const { id, subject, html_content, template_name, is_active } = body;
      console.log('[manage-email-templates] Updating template:', id);
      
      await safeFetch(`${SUPABASE_URL}/rest/v1/email_templates?id=eq.${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          subject,
          html_content,
          template_name,
          is_active,
          updated_at: new Date().toISOString()
        })
      });
      
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Preview email template
    if (action === 'preview') {
      const { html_content, subject } = body;
      console.log('[manage-email-templates] Previewing template');
      
      const sampleData: Record<string, string> = {
        investor_name: 'John Smith',
        property_address: '123 Main St, Austin, TX 78701',
        projected_profit: '$2,500',
        bedrooms: '3',
        bathrooms: '2',
        price: '$350,000',
        portal_link: 'https://accessyourplace.com/portal',
        manager_name: 'Sarah Johnson',
        document_name: 'Lease Agreement',
        signing_link: 'https://accessyourplace.com/sign/abc123',
        amount: '$499.00',
        hours_remaining: '12'
      };
      
      let preview_html = html_content || '';
      let preview_subject = subject || '';
      
      for (const [key, value] of Object.entries(sampleData)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        preview_html = preview_html.replace(regex, value);
        preview_subject = preview_subject.replace(regex, value);
      }
      
      return new Response(JSON.stringify({ success: true, preview_html, preview_subject }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Send test email
    if (action === 'send_test') {
      const { template_key, test_email } = body;
      console.log('[manage-email-templates] Sending test email to:', test_email);
      
      const templates = await safeFetch(`${SUPABASE_URL}/rest/v1/email_templates?template_key=eq.${template_key}&select=*`, { headers });
      
      if (!templates?.length) {
        return new Response(JSON.stringify({ error: 'Template not found', success: false }), { 
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      
      const template = templates[0];
      
      const sampleData: Record<string, string> = {
        investor_name: 'Test User',
        property_address: '123 Main St, Austin, TX 78701',
        projected_profit: '$2,500',
        bedrooms: '3',
        bathrooms: '2',
        price: '$350,000',
        portal_link: 'https://accessyourplace.com/portal',
        manager_name: 'Sarah Johnson',
        document_name: 'Lease Agreement',
        signing_link: 'https://accessyourplace.com/sign/test',
        amount: '$499.00',
        hours_remaining: '12'
      };
      
      let html = template.html_content || '';
      let subject = `[TEST] ${template.subject || ''}`;
      
      for (const [key, value] of Object.entries(sampleData)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(regex, value);
        subject = subject.replace(regex, value);
      }
      
      if (RESEND_API_KEY && test_email) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Access Your Place <noreply@accessyourplace.com>',
            to: test_email,
            subject,
            html
          })
        });
      }
      
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Reset template to default
    if (action === 'reset') {
      const { template_key } = body;
      console.log('[manage-email-templates] Resetting template:', template_key);
      return new Response(JSON.stringify({ success: true, message: 'Reset functionality not implemented' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // === DOCUMENT TEMPLATES ===

    // List document templates
    if (action === 'list_documents') {
      console.log('[manage-email-templates] Listing document templates');
      const templates = await safeFetch(`${SUPABASE_URL}/rest/v1/document_templates?select=*&order=name.asc`, { headers });
      return new Response(JSON.stringify({ templates: templates || [] }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Get single document template
    if (action === 'get_document') {
      const { template_id } = body;
      console.log('[manage-email-templates] Getting document template:', template_id);
      const templates = await safeFetch(`${SUPABASE_URL}/rest/v1/document_templates?id=eq.${template_id}&select=*`, { headers });
      return new Response(JSON.stringify({ template: templates?.[0] || null }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Create document template
    if (action === 'create_document') {
      const { name, template_type, category, content, variables, created_by } = body;
      console.log('[manage-email-templates] Creating document template:', name);
      
      const result = await safeFetch(`${SUPABASE_URL}/rest/v1/document_templates`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name,
          template_type,
          category,
          content,
          variables: variables || [],
          created_by,
          is_active: true
        })
      });
      
      return new Response(JSON.stringify({ success: true, template: result?.[0] || null }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Update document template
    if (action === 'update_document') {
      const { template_id, name, content, variables, is_active, updated_by } = body;
      console.log('[manage-email-templates] Updating document template:', template_id);
      
      await safeFetch(`${SUPABASE_URL}/rest/v1/document_templates?id=eq.${template_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          name,
          content,
          variables,
          is_active,
          updated_by,
          updated_at: new Date().toISOString()
        })
      });
      
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Delete document template
    if (action === 'delete_document') {
      const { template_id } = body;
      console.log('[manage-email-templates] Deleting document template:', template_id);
      
      await safeFetch(`${SUPABASE_URL}/rest/v1/document_templates?id=eq.${template_id}`, {
        method: 'DELETE',
        headers
      });
      
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Preview document with sample data
    if (action === 'preview_document') {
      const { content } = body;
      console.log('[manage-email-templates] Previewing document');
      
      const sampleData: Record<string, string> = {
        effective_date: new Date().toLocaleDateString(),
        transaction_id: 'TXN-2026-001234',
        seller_name: 'John Smith',
        seller_company: 'Smith Properties LLC',
        seller_address: '456 Oak Ave, Dallas, TX 75201',
        seller_email: 'john@smithproperties.com',
        seller_phone: '(555) 123-4567',
        buyer_name: 'Jane Doe',
        buyer_company: 'Doe Investments Inc',
        buyer_address: '789 Pine St, Houston, TX 77001',
        buyer_email: 'jane@doeinvestments.com',
        buyer_phone: '(555) 987-6543',
        property_address: '123 Main St, Austin, TX 78701',
        property_type: 'Single Family Home',
        bedrooms: '3',
        bathrooms: '2',
        acquisition_price: '45,000',
        ayp_fee: '9,000',
        net_to_seller: '36,000',
        monthly_rent: '2,500',
        security_deposit: '2,500',
        start_date: new Date().toLocaleDateString(),
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        rent_due_day: '1st',
        utilities_included: 'Water, Trash',
        furnishings_included: 'Fully furnished (see inventory list)',
        original_lease_date: '01/15/2025',
        landlord_name: 'ABC Property Management',
        assignment_date: new Date().toLocaleDateString(),
        remaining_term: '18 months',
        transfer_date: new Date().toLocaleDateString(),
        lock_brand: 'August Smart Lock Pro',
        master_code: '****',
        code_generation_method: 'Via August App',
        lock_app_login: 'property@email.com',
        wifi_name: 'MainSt_Guest',
        wifi_password: '********',
        gate_code: '1234',
        parking_info: 'Garage + 1 driveway spot',
        mailbox_info: 'Mailbox #123, key on ring',
        electric_account: 'Austin Energy #12345',
        gas_account: 'Texas Gas #67890',
        water_account: 'City Water #11111',
        internet_account: 'Spectrum #22222',
        airbnb_account: 'mainst.austin@email.com',
        vrbo_account: 'mainst.austin@email.com',
        other_platforms: 'Booking.com',
        landlord_contact: '(555) 111-2222',
        maintenance_contact: '(555) 333-4444',
        neighbor_contact: '(555) 555-6666',
        furniture_list: '- King bed with frame\n- Queen bed with frame\n- Sofa\n- Dining table with 4 chairs',
        appliances_list: '- Refrigerator\n- Stove/Oven\n- Microwave\n- Dishwasher',
        linens_list: '- 2 sets king sheets\n- 2 sets queen sheets\n- 8 towels',
        kitchen_list: '- Full cookware set\n- Dishes for 8\n- Utensils',
        electronics_list: '- 55" Smart TV\n- 42" Smart TV',
        decor_list: '- Wall art (5 pieces)\n- Throw pillows',
        outdoor_list: '- Patio furniture set\n- Grill',
        condition_notes: 'All items in good working condition.',
        total_value: '12,500'
      };
      
      let preview = content || '';
      for (const [key, value] of Object.entries(sampleData)) {
        preview = preview.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
      
      return new Response(JSON.stringify({ success: true, preview }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Unknown action - return success with empty data
    console.log('[manage-email-templates] Unknown action:', action);
    return new Response(JSON.stringify({ error: 'Invalid action', success: false, templates: [], campaigns: [] }), { 
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error('[manage-email-templates] Unexpected error:', error.message || error);
    return new Response(JSON.stringify({ 
      error: 'Server error', 
      details: error.message || 'Unknown error',
      success: false,
      templates: [],
      campaigns: []
    }), { 
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
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

  (blocks || []).forEach(block => {
    let content = replaceVariables(block?.content || '', recipient);

    switch (block?.type) {
      case 'header':
        html += `<h1 style="text-align: ${block.settings?.alignment || 'center'}; font-size: ${block.settings?.fontSize || '24px'}; font-weight: ${block.settings?.fontWeight || 'bold'}; color: ${block.settings?.color || '#1a365d'}; margin: 20px 0;">${content}</h1>`;
        break;
      case 'text':
        html += `<p style="text-align: ${block.settings?.alignment || 'left'}; font-size: ${block.settings?.fontSize || '16px'}; color: ${block.settings?.color || '#374151'}; line-height: 1.6; margin: 15px 0;">${content}</p>`;
        break;
      case 'button':
        const buttonUrl = replaceVariables(block.settings?.buttonUrl || '#', recipient);
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
    investor_name: `${recipient?.first_name || ''} ${recipient?.last_name || ''}`.trim() || 'Investor',
    investor_email: recipient?.email || '',
    investor_phone: recipient?.phone || '',
    portal_link: 'https://accessyourplace.com/portal',
    current_date: new Date().toLocaleDateString(),
  };

  let result = text || '';
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

