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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const BUCKET = 'property-photos';

    const contentType = req.headers.get('content-type') || '';

    // ========== FORMDATA BINARY UPLOAD (no base64 overhead) ==========
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const staffId = formData.get('staff_id') as string || 'unknown';
      const folder = formData.get('folder') as string || `am-submissions/${staffId}`;

      if (!file) return json({ success: false, error: 'file is required in FormData' }, 400);

      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const timestamp = Date.now();
      const sanitizedName = (file.name || 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${folder}/${timestamp}_${sanitizedName}`;

      console.log(`[upload-deal-photo] FormData upload: ${filePath} (${bytes.length} bytes)`);

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, bytes, {
          contentType: file.type || 'image/jpeg',
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('[upload-deal-photo] Upload error:', JSON.stringify(error));
        return json({ success: false, error: error.message }, 500);
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      return json({ success: true, url: urlData?.publicUrl || '', file_path: filePath, file_size: bytes.length });
    }

    // ========== JSON BODY ACTIONS ==========
    const body = await req.json();
    const { action } = body;

    // ========== UPLOAD SINGLE PHOTO (base64 fallback) ==========
    if (action === 'upload_photo') {
      const { base64_data, file_name, content_type: ct, staff_id, folder } = body;
      if (!base64_data) return json({ success: false, error: 'base64_data is required' }, 400);

      const binaryString = atob(base64_data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const timestamp = Date.now();
      const sanitizedName = (file_name || 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
      const subfolder = folder || `am-submissions/${staff_id || 'unknown'}`;
      const filePath = `${subfolder}/${timestamp}_${sanitizedName}`;

      console.log(`[upload-deal-photo] Base64 upload: ${filePath} (${bytes.length} bytes)`);

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, bytes, {
          contentType: ct || 'image/jpeg',
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('[upload-deal-photo] Upload error:', JSON.stringify(error));
        return json({ success: false, error: error.message }, 500);
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      return json({ success: true, url: urlData?.publicUrl || '', file_path: filePath, file_size: bytes.length });
    }

    // ========== DELETE PHOTO ==========
    if (action === 'delete_photo') {
      const { file_path, url } = body;
      let pathToDelete = file_path;
      if (!pathToDelete && url) {
        const match = url.match(/property-photos\/(.+?)(\?|$)/);
        if (match) pathToDelete = decodeURIComponent(match[1]);
      }
      if (!pathToDelete) return json({ success: false, error: 'file_path or url required' }, 400);

      const { error } = await supabase.storage.from(BUCKET).remove([pathToDelete]);
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true, deleted: pathToDelete });
    }

    // ========== BATCH DELETE PHOTOS ==========
    if (action === 'batch_delete') {
      const { file_paths, urls } = body;
      const paths: string[] = [];
      if (Array.isArray(file_paths)) paths.push(...file_paths);
      if (Array.isArray(urls)) {
        for (const u of urls) {
          const match = u.match(/property-photos\/(.+?)(\?|$)/);
          if (match) paths.push(decodeURIComponent(match[1]));
        }
      }
      if (paths.length === 0) return json({ success: false, error: 'No paths to delete' }, 400);

      const { error } = await supabase.storage.from(BUCKET).remove(paths);
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true, deleted: paths.length });
    }

    return json({ success: false, error: `Unknown action: ${action}` }, 400);
  } catch (error: any) {
    console.error('[upload-deal-photo] Error:', error);
    return json({ success: false, error: error.message }, 500);
  }
});
