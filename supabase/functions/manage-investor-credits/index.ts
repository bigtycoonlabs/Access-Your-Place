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

    const { action, ...params } = await req.json();

    switch (action) {
      case 'get_all_credits': {
        // Get all credits with investor info
        const { data: credits, error } = await supabase
          .from('investor_credits')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Get investor details for each credit
        const investorIds = [...new Set(credits?.map(c => c.investor_id) || [])];
        const { data: investors } = await supabase
          .from('investors')
          .select('id, name, email')
          .in('id', investorIds);

        const investorMap = new Map(investors?.map(i => [i.id, i]) || []);
        
        const enrichedCredits = credits?.map(credit => ({
          ...credit,
          investor_name: investorMap.get(credit.investor_id)?.name || 'Unknown',
          investor_email: investorMap.get(credit.investor_id)?.email || ''
        }));

        return new Response(JSON.stringify({ success: true, credits: enrichedCredits }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_credit_requests': {
        const { status_filter } = params;
        
        let query = supabase
          .from('credit_requests')
          .select('*')
          .order('created_at', { ascending: false });

        if (status_filter && status_filter !== 'all') {
          query = query.eq('request_status', status_filter);
        }

        const { data: requests, error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify({ success: true, requests }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'approve_credit_request': {
        const { request_id, admin_notes, approved_amount, staff_name } = params;

        // Get the request
        const { data: request, error: reqError } = await supabase
          .from('credit_requests')
          .select('*')
          .eq('id', request_id)
          .single();

        if (reqError) throw reqError;

        // Update request status
        const { error: updateError } = await supabase
          .from('credit_requests')
          .update({
            request_status: 'approved',
            admin_notes,
            reviewed_by: staff_name,
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', request_id);

        if (updateError) throw updateError;

        // Create the credit
        const creditAmount = approved_amount || request.amount_requested;
        const { error: creditError } = await supabase
          .from('investor_credits')
          .insert({
            investor_id: request.investor_id,
            amount: creditAmount,
            credit_type: 'approved_request',
            source_description: `Approved credit request: ${request.description}`,
            related_acquisition_id: request.related_acquisition_id,
            credit_status: 'active',
            expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year expiry
            created_by: staff_name
          });

        if (creditError) throw creditError;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'reject_credit_request': {
        const { request_id, admin_notes, staff_name } = params;

        const { error } = await supabase
          .from('credit_requests')
          .update({
            request_status: 'rejected',
            admin_notes,
            reviewed_by: staff_name,
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', request_id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'assign_credit': {
        const { investor_id, amount, credit_type, description, expires_in_days, staff_name } = params;

        const expiresAt = expires_in_days 
          ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabase
          .from('investor_credits')
          .insert({
            investor_id,
            amount,
            credit_type: credit_type || 'manual',
            source_description: description,
            credit_status: 'active',
            expires_at: expiresAt,
            created_by: staff_name
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, credit: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_expiring_credits': {
        const { days_until_expiry } = params;
        const expiryDate = new Date(Date.now() + (days_until_expiry || 30) * 24 * 60 * 60 * 1000);

        const { data: credits, error } = await supabase
          .from('investor_credits')
          .select('*')
          .eq('credit_status', 'active')
          .lt('expires_at', expiryDate.toISOString())
          .order('expires_at', { ascending: true });

        if (error) throw error;

        // Get investor details
        const investorIds = [...new Set(credits?.map(c => c.investor_id) || [])];
        const { data: investors } = await supabase
          .from('investors')
          .select('id, name, email')
          .in('id', investorIds);

        const investorMap = new Map(investors?.map(i => [i.id, i]) || []);
        
        const enrichedCredits = credits?.map(credit => ({
          ...credit,
          investor_name: investorMap.get(credit.investor_id)?.name || 'Unknown',
          investor_email: investorMap.get(credit.investor_id)?.email || ''
        }));

        return new Response(JSON.stringify({ success: true, credits: enrichedCredits }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_credit_history': {
        const { investor_id } = params;

        const { data: credits, error } = await supabase
          .from('investor_credits')
          .select('*')
          .eq('investor_id', investor_id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, credits }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'use_credit': {
        const { credit_id, used_for, staff_name } = params;

        const { error } = await supabase
          .from('investor_credits')
          .update({
            credit_status: 'used',
            used_at: new Date().toISOString(),
            used_for,
            updated_at: new Date().toISOString()
          })
          .eq('id', credit_id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_stats': {
        // Get overall credit statistics
        const { data: allCredits } = await supabase
          .from('investor_credits')
          .select('*');

        const { data: pendingRequests } = await supabase
          .from('credit_requests')
          .select('*')
          .eq('request_status', 'pending');

        const now = new Date();
        const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const stats = {
          total_active_credits: allCredits?.filter(c => c.credit_status === 'active').length || 0,
          total_active_amount: allCredits?.filter(c => c.credit_status === 'active')
            .reduce((sum, c) => sum + parseFloat(c.amount), 0) || 0,
          total_used_credits: allCredits?.filter(c => c.credit_status === 'used').length || 0,
          total_used_amount: allCredits?.filter(c => c.credit_status === 'used')
            .reduce((sum, c) => sum + parseFloat(c.amount), 0) || 0,
          expiring_soon: allCredits?.filter(c => 
            c.credit_status === 'active' && 
            c.expires_at && 
            new Date(c.expires_at) <= thirtyDaysFromNow
          ).length || 0,
          pending_requests: pendingRequests?.length || 0
        };

        return new Response(JSON.stringify({ success: true, stats }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'search_investors': {
        const { query } = params;

        const { data: investors, error } = await supabase
          .from('investors')
          .select('id, name, email')
          .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(20);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, investors }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_credit_usage_audit': {
        // Get all credit usage audit records with enriched data
        const { data: auditRecords, error } = await supabase
          .from('credit_usage_audit')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Get investor details
        const investorIds = [...new Set(auditRecords?.map(a => a.investor_id) || [])];
        const { data: investors } = await supabase
          .from('investors')
          .select('id, name, email')
          .in('id', investorIds);

        const investorMap = new Map(investors?.map(i => [i.id, i]) || []);

        // Get property details
        const propertyIds = [...new Set(auditRecords?.map(a => a.property_id).filter(Boolean) || [])];
        let propertyMap = new Map();
        if (propertyIds.length > 0) {
          const { data: properties } = await supabase
            .from('properties')
            .select('id, title, city, state')
            .in('id', propertyIds);
          propertyMap = new Map(properties?.map(p => [p.id, p]) || []);
        }

        const enrichedRecords = auditRecords?.map(record => ({
          ...record,
          investor_name: investorMap.get(record.investor_id)?.name || 'Unknown',
          investor_email: investorMap.get(record.investor_id)?.email || '',
          property_title: propertyMap.get(record.property_id)?.title || 'N/A',
          property_location: propertyMap.get(record.property_id) 
            ? `${propertyMap.get(record.property_id).city}, ${propertyMap.get(record.property_id).state}`
            : 'N/A'
        }));

        return new Response(JSON.stringify({ success: true, audit_records: enrichedRecords }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_credit_usage_stats': {
        // Get credit usage statistics
        const { data: auditRecords, error } = await supabase
          .from('credit_usage_audit')
          .select('*');

        if (error) throw error;

        const stats = {
          total_transactions: auditRecords?.length || 0,
          total_credits_used: auditRecords?.reduce((sum, r) => sum + parseFloat(r.total_credit_amount || 0), 0) || 0,
          credits_only_transactions: auditRecords?.filter(r => r.transaction_type === 'credits_only').length || 0,
          partial_credit_transactions: auditRecords?.filter(r => r.transaction_type === 'partial_credits').length || 0,
          average_credit_per_transaction: auditRecords?.length 
            ? (auditRecords.reduce((sum, r) => sum + parseFloat(r.total_credit_amount || 0), 0) / auditRecords.length).toFixed(2)
            : 0
        };

        return new Response(JSON.stringify({ success: true, stats }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_investor_credit_summary': {
        const { investor_id } = params;

        // Get all credits for investor
        const { data: credits } = await supabase
          .from('investor_credits')
          .select('*')
          .eq('investor_id', investor_id);

        // Get usage audit for investor
        const { data: usageRecords } = await supabase
          .from('credit_usage_audit')
          .select('*')
          .eq('investor_id', investor_id)
          .order('created_at', { ascending: false });

        const activeCredits = credits?.filter(c => c.credit_status === 'active' && new Date(c.expires_at) > new Date()) || [];
        const usedCredits = credits?.filter(c => c.credit_status === 'used') || [];

        const summary = {
          total_active_credits: activeCredits.length,
          total_active_amount: activeCredits.reduce((sum, c) => sum + parseFloat(c.amount), 0),
          total_used_credits: usedCredits.length,
          total_used_amount: usedCredits.reduce((sum, c) => sum + parseFloat(c.amount), 0),
          total_saved: usageRecords?.reduce((sum, r) => sum + parseFloat(r.total_credit_amount || 0), 0) || 0,
          recent_usage: usageRecords?.slice(0, 5) || [],
          active_credits: activeCredits
        };

        return new Response(JSON.stringify({ success: true, summary }), {
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
