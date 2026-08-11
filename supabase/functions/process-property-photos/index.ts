// Repointed 6 August 2026 from ai.gateway.fastrouter.io to OpenAI directly.
//
// That gateway is NOT this company's — the owner confirmed it is leftover code — and it
// carried the same GATEWAY_API_KEY as the payment gateway that was tombstoned the same
// day. Every deal search, article and photo description sent through it went to a third
// party nobody here controls.
//
// The gateway spoke the OpenAI chat-completions shape, so this is a base URL, an auth
// header and a model swap. google/gemini-2.5-flash becomes gpt-4o, which is the model the
// rest of this platform already runs on.
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

export const corsHeaders = {
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
    const gatewayKey = Deno.env.get('OPENAI_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { property_id, listing_url, photo_urls, auto_process } = await req.json();
    if (!property_id) throw new Error('Property ID required');

    let imagesToProcess: string[] = photo_urls || [];

    // If auto_process, get listing URL from property
    if (auto_process) {
      const { data: prop } = await supabase.from('properties').select('listing_url').eq('id', property_id).single();
      if (prop?.listing_url) imagesToProcess = await scrapePhotos(prop.listing_url);
    } else if (listing_url) {
      imagesToProcess = [...imagesToProcess, ...(await scrapePhotos(listing_url))];
    }

    const processedPhotos = [];
    for (const imageUrl of imagesToProcess.slice(0, 10)) {
      try {
        const imgResponse = await fetch(imageUrl);
        if (!imgResponse.ok) continue;
        
        const imgBuffer = await imgResponse.arrayBuffer();
        let processedImage = new Uint8Array(imgBuffer);
        
        // Detect and describe any identifying text
        const textInfo = await detectIdentifyingText(imageUrl, gatewayKey);
        
        const filename = `${property_id}/${crypto.randomUUID()}.jpg`;
        
        const { error: uploadError } = await supabase.storage
          .from('digital-products')
          .upload(`property-photos/${filename}`, processedImage, { contentType: 'image/jpeg', upsert: true });

        if (uploadError) continue;

        const { data: urlData } = supabase.storage.from('digital-products').getPublicUrl(`property-photos/${filename}`);

        const { data: photoRecord } = await supabase.from('property_photos').insert({
          property_id, original_url: imageUrl, processed_url: urlData.publicUrl,
          is_processed: true, has_address_detected: textInfo.hasText, processing_status: 'completed'
        }).select().single();

        if (photoRecord) processedPhotos.push(photoRecord);
      } catch (e) { console.error(e); }
    }

    return new Response(JSON.stringify({ success: true, processed_count: processedPhotos.length, photos: processedPhotos }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});

async function scrapePhotos(url: string): Promise<string[]> {
  try {
    const res = await fetch(url);
    const html = await res.text();
    const matches = html.match(/https?:\/\/[^\s"']+\.(jpg|jpeg|png|webp)/gi) || [];
    return [...new Set(matches)].slice(0, 15);
  } catch { return []; }
}

async function detectIdentifyingText(imageUrl: string, apiKey?: string): Promise<{hasText: boolean}> {
  if (!apiKey) return { hasText: false };
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: [
          { type: 'text', text: 'Does this property image contain visible: street address, house number, community name sign, apartment complex name, or identifying text? Reply YES or NO only.' },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]}]
      })
    });
    const data = await response.json();
    return { hasText: data.choices?.[0]?.message?.content?.toUpperCase()?.includes('YES') || false };
  } catch { return { hasText: false }; }
}
