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

    // ---- forgot_password / reset_password -----------------------------------
    //
    // Landlords previously had NO recovery path: this function implemented register,
    // login, verify_session and logout, and nothing else. A landlord who forgot their
    // password was locked out permanently with no self-serve route back, and no staff
    // tool to fix it either.
    //
    // Mirrors the investor flow (investor-login): one-hour single-use token, expiry
    // enforced, and the reply is identical whether or not the address is on file so this
    // cannot be used to discover which landlords have portal accounts.

    if (action === 'forgot_password') {
      const { email, base_url } = params;
      const GENERIC = 'If this email has a portal account, a reset link is on its way.';
      if (!email) {
        return new Response(JSON.stringify({ error: 'Enter the email on your account.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: landlord } = await supabase
        .from('landlord_contacts')
        .select('id,name,email,portal_enabled')
        .eq('email', String(email).toLowerCase().trim())
        .eq('portal_enabled', true)
        .maybeSingle();

      // Same reply as the success case — never reveal whether an account exists.
      if (!landlord) {
        return new Response(JSON.stringify({ success: true, message: GENERIC }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const token = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
      const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      const { error: tokenErr } = await supabase
        .from('landlord_contacts')
        .update({ reset_token: token, reset_token_expires: expires, updated_at: new Date().toISOString() })
        .eq('id', landlord.id);

      // Checked on purpose: if the token never saved, the emailed link cannot work and
      // the landlord would burn an hour discovering that.
      if (tokenErr) {
        console.error('landlord-auth forgot_password token_write_failed', tokenErr.message);
        return new Response(JSON.stringify({ error: 'We could not start a password reset. Please try again.' }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const site = String(base_url || 'https://accessyourplace.com').replace(/\/+$/, '');
      const resetUrl = `${site}/landlord/reset-password?token=${token}`;
      const resendKey = Deno.env.get('RESEND_API_KEY');
      let emailOk = false;

      if (!resendKey) {
        console.error('landlord-auth forgot_password missing RESEND_API_KEY');
      } else {
        try {
          const sendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
            body: JSON.stringify({
              from: 'Penny <penny@accessyourplace.com>',
              reply_to: ['success@accessyourplace.com'],
              to: [landlord.email],
              subject: 'Reset your Access Your Place landlord password',
              text:
                `Hi ${landlord.name || 'there'},\n\n` +
                `You asked to reset your landlord portal password. Open this link within the next hour to choose a new one:\n\n${resetUrl}\n\n` +
                `If you didn't ask for this, ignore this email and your password stays as it is.\n\n` +
                `Penny\nClient Success | Access Your Place`,
            }),
          });
          emailOk = sendRes.ok;
          if (!sendRes.ok) {
            console.error('landlord-auth forgot_password send_failed', sendRes.status, (await sendRes.text()).slice(0, 200));
          }
        } catch (sendErr) {
          console.error('landlord-auth forgot_password send_threw', sendErr instanceof Error ? sendErr.message : String(sendErr));
        }
      }

      // A failure to SEND is our problem, not a fact about their account, so it is
      // reported. The generic message still hides whether the address exists.
      if (!emailOk) {
        return new Response(JSON.stringify({ error: 'We could not send the reset email just now. Please try again in a moment.' }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, message: GENERIC }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'reset_password') {
      const { reset_token, new_password } = params;
      if (!reset_token) {
        return new Response(JSON.stringify({ error: 'This reset link is missing its token. Please request a new one.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (!new_password || String(new_password).length < 8) {
        return new Response(JSON.stringify({ error: 'Choose a password of at least 8 characters.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: landlord } = await supabase
        .from('landlord_contacts')
        .select('id,reset_token_expires,portal_enabled,status')
        .eq('reset_token', String(reset_token))
        .maybeSingle();

      if (!landlord) {
        return new Response(JSON.stringify({ error: 'This reset link is not valid. It may already have been used. Please request a new one.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (landlord.status === 'suspended') {
        return new Response(JSON.stringify({ error: 'This account is suspended. Please contact your acquisition manager.' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (!landlord.reset_token_expires || new Date(landlord.reset_token_expires).getTime() < Date.now()) {
        return new Response(JSON.stringify({ error: 'This reset link has expired. Please request a new one.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Same SHA-256 + fixed-salt scheme the login path uses. Deliberately NOT changed
      // to bcrypt here: login still compares this exact hash, so switching one side
      // alone would lock every landlord out. The upgrade is worth doing and is cheap
      // right now (landlord_contacts currently holds zero portal passwords) but it must
      // change register, login and this path together, in its own commit.
      const enc = new TextEncoder();
      const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(new_password) + 'ayp_landlord_salt_2026'));
      const hashHex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');

      const { data: saved, error: saveErr } = await supabase
        .from('landlord_contacts')
        .update({
          password_hash: hashHex,
          reset_token: null,
          reset_token_expires: null,
          session_token: null,      // old sessions die with the old password
          session_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', landlord.id)
        .select('id')
        .maybeSingle();

      // Report success ONLY if the write landed. Never on the strength of no error.
      if (saveErr || !saved) {
        console.error('landlord-auth reset_password write_failed', saveErr?.message || 'no rows');
        return new Response(JSON.stringify({ error: 'We could not save your new password. Please try again.' }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('landlord-auth reset_completed', JSON.stringify({ landlord_id: landlord.id }));
      return new Response(JSON.stringify({ success: true, message: 'Your password has been updated. You can sign in with it now.' }), {
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
