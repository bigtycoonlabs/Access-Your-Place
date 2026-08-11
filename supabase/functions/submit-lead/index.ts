// PostgREST on this project exposes ONLY the public schema. Sending
// Accept-Profile: prj_X-ZoVQv6LKXT made every REST call return 406 PGRST106, so
// this function returned 500 'Invalid schema' to every visitor who submitted a
// lead. Three front-end forms call it: LeadCapture, SubmitPropertyModal and
// SetupServices. Not one lead from any of them reached the database.
// Every prj_ table has a matching public view, so public is the correct profile.
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

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const {
      formType, type, name, email, phone, city,
      propertyAddress, property_address, message, formData, data,
      ...rest
    } = body;

    // Preserve everything the caller sent that isn't a first-class column,
    // so no submitted detail is ever lost.
    const additionalData = formData || data || (Object.keys(rest).length ? rest : {}) || {};

    const { data: insertData, error } = await supabase
      .from('leads')
      .insert({
        form_type: formType || type || 'general',
        name: name || null,
        email: email || null,
        phone: phone || null,
        city: city || null,
        property_address: propertyAddress || property_address || null,
        message: message || null,
        form_data: additionalData
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, data: insertData }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
