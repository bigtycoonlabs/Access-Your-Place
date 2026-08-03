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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, ...params } = await req.json();

    if (action === 'register') {
      const { email, password, contact_name, company_name, phone, account_type, location, unit_count, property_type } = params;
      
      if (!email || !password || !contact_name) {
        return new Response(JSON.stringify({ error: 'Email, password, and name are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if email exists
      const { data: existing } = await supabase
        .from('landlord_contacts')
        .select('id')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle();

      if (existing) {
        // If exists but no password, allow them to set one (upgrade to portal)
        const { data: existingFull } = await supabase
          .from('landlord_contacts')
          .select('*')
          .eq('id', existing.id)
          .single();

        if (existingFull?.password_hash) {
          return new Response(JSON.stringify({ error: 'An account with this email already exists. Please log in.' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Upgrade existing contact to portal user
        const encoder = new TextEncoder();
        const data = encoder.encode(password + 'ayp_landlord_salt_2026');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const sessionToken = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const { error: updateErr } = await supabase
          .from('landlord_contacts')
          .update({
            password_hash: hashHex,
            portal_enabled: true,
            account_type: account_type || 'private_landlord',
            session_token: sessionToken,
            session_expires_at: expiresAt,
            last_login: new Date().toISOString(),
            status: 'pending_verification'
          })
          .eq('id', existing.id);

        if (updateErr) throw updateErr;

        return new Response(JSON.stringify({
          success: true,
          landlord: { ...existingFull, portal_enabled: true, status: 'pending_verification' },
          session_token: sessionToken
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Hash password
      const encoder = new TextEncoder();
      const data = encoder.encode(password + 'ayp_landlord_salt_2026');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: newLandlord, error: insertErr } = await supabase
        .from('landlord_contacts')
        .insert({
          name: contact_name,
          email: email.toLowerCase().trim(),
          company_name: company_name || null,
          phone: phone || null,
          password_hash: hashHex,
          account_type: account_type || 'private_landlord',
          portal_enabled: true,
          status: 'pending_verification',
          location: location || null,
          unit_count: unit_count || null,
          property_type: property_type || null,
          session_token: sessionToken,
          session_expires_at: expiresAt,
          last_login: new Date().toISOString(),
          contact_type: account_type === 'management_company' ? 'management_company' : 'landlord'
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      return new Response(JSON.stringify({
        success: true,
        landlord: newLandlord,
        session_token: sessionToken
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'login') {
      const { email, password } = params;
      
      if (!email || !password) {
        return new Response(JSON.stringify({ error: 'Email and password are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const encoder = new TextEncoder();
      const data = encoder.encode(password + 'ayp_landlord_salt_2026');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const { data: landlord, error } = await supabase
        .from('landlord_contacts')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .eq('password_hash', hashHex)
        .eq('portal_enabled', true)
        .maybeSingle();

      if (!landlord) {
        return new Response(JSON.stringify({ error: 'Invalid email or password' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (landlord.status === 'suspended') {
        return new Response(JSON.stringify({ error: 'Your account has been suspended. Please contact support.' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await supabase
        .from('landlord_contacts')
        .update({ session_token: sessionToken, session_expires_at: expiresAt, last_login: new Date().toISOString() })
        .eq('id', landlord.id);

      return new Response(JSON.stringify({
        success: true,
        landlord,
        session_token: sessionToken
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'verify_session') {
      const { session_token } = params;
      if (!session_token) {
        return new Response(JSON.stringify({ error: 'No session token' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: landlord } = await supabase
        .from('landlord_contacts')
        .select('*')
        .eq('session_token', session_token)
        .eq('portal_enabled', true)
        .gt('session_expires_at', new Date().toISOString())
        .maybeSingle();

      if (!landlord) {
        return new Response(JSON.stringify({ error: 'Session expired' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, landlord }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'logout') {
      const { session_token } = params;
      if (session_token) {
        await supabase
          .from('landlord_contacts')
          .update({ session_token: null, session_expires_at: null })
          .eq('session_token', session_token);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
