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

function generateInvoiceNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${year}${month}-${random}`;
}

function generateReceiptHTML(transaction: any, investor: any): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { text-align: center; border-bottom: 2px solid #d4a574; padding-bottom: 20px; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: bold; color: #1a365d; }
    .receipt-title { font-size: 28px; color: #333; margin-top: 10px; }
    .details { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .details-section { }
    .details-section h3 { color: #666; font-size: 12px; text-transform: uppercase; margin-bottom: 5px; }
    .details-section p { margin: 3px 0; }
    .line-items { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .line-items th { background: #f5f5f5; padding: 12px; text-align: left; border-bottom: 2px solid #ddd; }
    .line-items td { padding: 12px; border-bottom: 1px solid #eee; }
    .total-row td { font-weight: bold; font-size: 18px; border-top: 2px solid #333; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
    .status-completed { background: #d4edda; color: #155724; }
    .status-pending { background: #fff3cd; color: #856404; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Access Your Place</div>
    <div class="receipt-title">${transaction.payment_status === 'completed' ? 'Receipt' : 'Invoice'}</div>
  </div>
  
  <div class="details">
    <div class="details-section">
      <h3>Bill To</h3>
      <p><strong>${investor?.full_name || 'Investor'}</strong></p>
      <p>${investor?.email || ''}</p>
    </div>
    <div class="details-section" style="text-align: right;">
      <h3>Invoice Details</h3>
      <p><strong>Invoice #:</strong> ${transaction.invoice_number || generateInvoiceNumber()}</p>
      <p><strong>Date:</strong> ${new Date(transaction.created_at).toLocaleDateString()}</p>
      <p><strong>Status:</strong> <span class="status-badge status-${transaction.payment_status}">${transaction.payment_status.toUpperCase()}</span></p>
    </div>
  </div>

  <table class="line-items">
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${transaction.description || transaction.transaction_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</td>
        <td style="text-align: right;">$${parseFloat(transaction.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      </tr>
      ${transaction.credits_applied > 0 ? `
      <tr>
        <td>Credits Applied</td>
        <td style="text-align: right; color: #28a745;">-$${parseFloat(transaction.credits_applied).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      </tr>
      ` : ''}
      <tr class="total-row">
        <td>Total ${transaction.payment_status === 'completed' ? 'Paid' : 'Due'}</td>
        <td style="text-align: right;">$${(parseFloat(transaction.amount) - (transaction.credits_applied || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      </tr>
    </tbody>
  </table>

  ${transaction.paid_at ? `<p><strong>Payment Date:</strong> ${new Date(transaction.paid_at).toLocaleDateString()}</p>` : ''}
  ${transaction.payment_method ? `<p><strong>Payment Method:</strong> ${transaction.payment_method}</p>` : ''}

  <div class="footer">
    <p>Thank you for your business!</p>
    <p>Access Your Place | support@accessyourplace.com</p>
  </div>
</body>
</html>
  `;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();

    switch (action) {
      case 'get_payment_history': {
        const { investor_id, limit = 50, offset = 0 } = params;
        
        const { data: transactions, error } = await supabase
          .from('payment_transactions')
          .select('*')
          .eq('investor_id', investor_id)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        
        if (error) throw error;

        // Get summary stats
        const { data: stats } = await supabase
          .from('payment_transactions')
          .select('amount, payment_status, credits_applied')
          .eq('investor_id', investor_id);

        const summary = {
          total_paid: stats?.filter(t => t.payment_status === 'completed').reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0,
          total_credits_used: stats?.reduce((sum, t) => sum + (parseFloat(t.credits_applied) || 0), 0) || 0,
          pending_amount: stats?.filter(t => t.payment_status === 'pending').reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0,
          transaction_count: stats?.length || 0
        };

        return new Response(JSON.stringify({ transactions, summary }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_payment_schedules': {
        const { investor_id } = params;
        
        const { data, error } = await supabase
          .from('payment_schedules')
          .select('*')
          .eq('investor_id', investor_id)
          .in('payment_status', ['upcoming', 'due', 'overdue'])
          .order('due_date', { ascending: true });
        
        if (error) throw error;
        return new Response(JSON.stringify({ schedules: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_transaction': {
        const { transaction_id, investor_id } = params;
        
        const { data, error } = await supabase
          .from('payment_transactions')
          .select('*')
          .eq('id', transaction_id)
          .eq('investor_id', investor_id)
          .single();
        
        if (error) throw error;
        return new Response(JSON.stringify({ transaction: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'generate_receipt': {
        const { transaction_id, investor_id } = params;
        
        const { data: transaction, error: txError } = await supabase
          .from('payment_transactions')
          .select('*')
          .eq('id', transaction_id)
          .eq('investor_id', investor_id)
          .single();
        
        if (txError) throw txError;

        const { data: investor } = await supabase
          .from('investors')
          .select('full_name, email')
          .eq('id', investor_id)
          .single();

        const html = generateReceiptHTML(transaction, investor);
        
        return new Response(JSON.stringify({ html, transaction }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'create_transaction': {
        const { investor_id, transaction_type, amount, description, property_id, acquisition_id, payment_method, credits_applied } = params;
        
        const invoice_number = generateInvoiceNumber();
        
        const { data, error } = await supabase
          .from('payment_transactions')
          .insert({
            investor_id,
            transaction_type,
            amount,
            description,
            property_id,
            acquisition_id,
            payment_method,
            credits_applied: credits_applied || 0,
            invoice_number,
            payment_status: 'pending'
          })
          .select()
          .single();
        
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, transaction: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'update_transaction_status': {
        const { transaction_id, payment_status, stripe_payment_id, receipt_url } = params;
        
        const updateData: any = {
          payment_status,
          updated_at: new Date().toISOString()
        };
        
        if (payment_status === 'completed') {
          updateData.paid_at = new Date().toISOString();
        }
        if (stripe_payment_id) updateData.stripe_payment_id = stripe_payment_id;
        if (receipt_url) updateData.receipt_url = receipt_url;

        const { data, error } = await supabase
          .from('payment_transactions')
          .update(updateData)
          .eq('id', transaction_id)
          .select()
          .single();
        
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, transaction: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'create_schedule': {
        const { investor_id, transaction_type, amount, due_date, description, property_id, acquisition_id } = params;
        
        const { data, error } = await supabase
          .from('payment_schedules')
          .insert({
            investor_id,
            transaction_type,
            amount,
            due_date,
            description,
            property_id,
            acquisition_id
          })
          .select()
          .single();
        
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, schedule: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_combined_summary': {
        // Get combined credits and payments summary
        const { investor_id } = params;
        
        // Get payment summary
        const { data: transactions } = await supabase
          .from('payment_transactions')
          .select('*')
          .eq('investor_id', investor_id);

        // Get credit summary
        const { data: credits } = await supabase
          .from('investor_credits')
          .select('*')
          .eq('investor_id', investor_id);

        // Get upcoming payments
        const { data: schedules } = await supabase
          .from('payment_schedules')
          .select('*')
          .eq('investor_id', investor_id)
          .in('payment_status', ['upcoming', 'due', 'overdue'])
          .order('due_date', { ascending: true })
          .limit(5);

        const summary = {
          total_paid: transactions?.filter(t => t.payment_status === 'completed').reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0,
          total_credits_used: transactions?.reduce((sum, t) => sum + (parseFloat(t.credits_applied) || 0), 0) || 0,
          pending_payments: transactions?.filter(t => t.payment_status === 'pending').reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0,
          available_credits: credits?.filter(c => c.credit_status === 'active').reduce((sum, c) => sum + parseFloat(c.amount), 0) || 0,
          upcoming_payments: schedules || [],
          recent_transactions: transactions?.slice(0, 5) || []
        };

        return new Response(JSON.stringify({ summary }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
