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
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action, file_path, file_paths, property_id, investor_id, bucket } = body;
    const bucketName = bucket || 'property-photos';
    const expiresIn = 3600; // 1 hour

    // â”€â”€â”€ ACTION: sign_url â”€â”€â”€ Generate signed URL for a single file path
    if (action === 'sign_url') {
      if (!file_path) {
        return new Response(JSON.stringify({ error: 'file_path is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const cleanPath = cleanFilePath(file_path, bucketName, supabaseUrl);
      console.log(`[sign_url] Generating signed URL for: ${cleanPath} in bucket: ${bucketName}`);

      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(cleanPath, expiresIn);

      if (error) {
        console.error(`[sign_url] Error:`, error.message);
        // Fallback: try with different path formats
        const fallbackPath = tryFallbackPaths(cleanPath);
        for (const fp of fallbackPath) {
          console.log(`[sign_url] Trying fallback path: ${fp}`);
          const { data: fbData, error: fbError } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(fp, expiresIn);
          if (!fbError && fbData?.signedUrl) {
            return new Response(JSON.stringify({ 
              success: true, 
              signed_url: fbData.signedUrl,
              file_path: fp,
              expires_in: expiresIn 
            }), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
        }
        
        // Final fallback: return public URL
        const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(cleanPath);
        return new Response(JSON.stringify({ 
          success: true, 
          signed_url: publicData.publicUrl,
          file_path: cleanPath,
          expires_in: expiresIn,
          fallback: 'public_url'
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        signed_url: data.signedUrl,
        file_path: cleanPath,
        expires_in: expiresIn 
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // â”€â”€â”€ ACTION: sign_urls â”€â”€â”€ Batch generate signed URLs for multiple file paths
    if (action === 'sign_urls') {
      if (!file_paths || !Array.isArray(file_paths) || file_paths.length === 0) {
        return new Response(JSON.stringify({ error: 'file_paths array is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      console.log(`[sign_urls] Generating ${file_paths.length} signed URLs`);

      const results: Array<{ file_path: string; signed_url: string | null; error?: string }> = [];

      for (const fp of file_paths.slice(0, 50)) { // Max 50 at a time
        const cleanPath = cleanFilePath(fp, bucketName, supabaseUrl);
        
        const { data, error } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(cleanPath, expiresIn);

        if (error) {
          // Try fallback paths
          let resolved = false;
          const fallbacks = tryFallbackPaths(cleanPath);
          for (const fallback of fallbacks) {
            const { data: fbData, error: fbError } = await supabase.storage
              .from(bucketName)
              .createSignedUrl(fallback, expiresIn);
            if (!fbError && fbData?.signedUrl) {
              results.push({ file_path: fp, signed_url: fbData.signedUrl });
              resolved = true;
              break;
            }
          }
          if (!resolved) {
            // Use public URL as final fallback
            const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(cleanPath);
            results.push({ file_path: fp, signed_url: publicData.publicUrl, error: 'used_public_fallback' });
          }
        } else {
          results.push({ file_path: fp, signed_url: data.signedUrl });
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        urls: results,
        count: results.length,
        expires_in: expiresIn 
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // â”€â”€â”€ ACTION: get_property_photos â”€â”€â”€ Get all photos for a property with signed URLs
    if (action === 'get_property_photos') {
      if (!property_id) {
        return new Response(JSON.stringify({ error: 'property_id is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      console.log(`[get_property_photos] Fetching photos for property: ${property_id}`);

      // Get property from investor_portfolio
      const { data: property, error: propError } = await supabase
        .from('investor_portfolio')
        .select('id, photo_urls, photo_file_paths, address')
        .eq('id', property_id)
        .single();

      if (propError || !property) {
        return new Response(JSON.stringify({ error: 'Property not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Prefer file_paths, fall back to photo_urls
      const paths = property.photo_file_paths || property.photo_urls || [];
      const signedUrls: Array<{ file_path: string; signed_url: string }> = [];

      for (const path of paths) {
        const cleanPath = cleanFilePath(path, bucketName, supabaseUrl);
        const { data, error } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(cleanPath, expiresIn);

        if (!error && data?.signedUrl) {
          signedUrls.push({ file_path: path, signed_url: data.signedUrl });
        } else {
          // Fallback to public URL
          const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(cleanPath);
          signedUrls.push({ file_path: path, signed_url: publicData.publicUrl });
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        property_id,
        address: property.address,
        photos: signedUrls,
        count: signedUrls.length,
        expires_in: expiresIn 
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // â”€â”€â”€ ACTION: list_bucket_files â”€â”€â”€ List files in a folder (for debugging/admin)
    if (action === 'list_bucket_files') {
      const folder = body.folder || '';
      
      const { data, error } = await supabase.storage
        .from(bucketName)
        .list(folder, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        files: data,
        folder,
        bucket: bucketName
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Unknown action. Supported: sign_url, sign_urls, get_property_photos, list_bucket_files' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('[property-photo-urls] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

/**
 * Clean a file path by removing bucket name prefix, leading slashes, 
 * and extracting the path from a full URL if needed.
 */
function cleanFilePath(rawPath: string, bucketName: string, supabaseUrl: string): string {
  let path = rawPath.trim();
  
  // If it's a full URL, extract the path
  if (path.startsWith('http://') || path.startsWith('https://')) {
    // Pattern: {supabaseUrl}/storage/v1/object/public/{bucket}/{path}
    const publicPattern = `/storage/v1/object/public/${bucketName}/`;
    const signedPattern = `/storage/v1/object/sign/${bucketName}/`;
    const authPattern = `/storage/v1/object/authenticated/${bucketName}/`;
    
    for (const pattern of [publicPattern, signedPattern, authPattern]) {
      const idx = path.indexOf(pattern);
      if (idx !== -1) {
        path = path.substring(idx + pattern.length);
        // Remove query params
        const qIdx = path.indexOf('?');
        if (qIdx !== -1) path = path.substring(0, qIdx);
        break;
      }
    }
    
    // Also try: just the path after /storage/v1/object/{bucket}/
    if (path.startsWith('http')) {
      try {
        const url = new URL(path);
        const pathParts = url.pathname.split(`/${bucketName}/`);
        if (pathParts.length > 1) {
          path = pathParts[pathParts.length - 1];
        }
      } catch {}
    }
  }
  
  // Remove bucket name prefix if present
  if (path.startsWith(`${bucketName}/`)) {
    path = path.substring(bucketName.length + 1);
  }
  
  // Remove leading slash
  if (path.startsWith('/')) {
    path = path.substring(1);
  }
  
  // Decode URI components
  try {
    path = decodeURIComponent(path);
  } catch {}
  
  return path;
}

/**
 * Generate fallback path variations to try
 */
function tryFallbackPaths(path: string): string[] {
  const paths: string[] = [];
  
  // Try with 'portfolio/' prefix if not present
  if (!path.startsWith('portfolio/')) {
    paths.push(`portfolio/${path}`);
  }
  
  // Try without 'portfolio/' prefix if present
  if (path.startsWith('portfolio/')) {
    paths.push(path.substring('portfolio/'.length));
  }
  
  // Try URL-encoded version
  try {
    const encoded = encodeURIComponent(path).replace(/%2F/g, '/');
    if (encoded !== path) paths.push(encoded);
  } catch {}
  
  // Try decoded version
  try {
    const decoded = decodeURIComponent(path);
    if (decoded !== path) paths.push(decoded);
  } catch {}
  
  return paths;
}
