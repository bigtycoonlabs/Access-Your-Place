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

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET = 'seller-documents';

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  lease: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  financial: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'],
  photos: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;
    console.log('[seller-docs v2] Action:', action);

    // ==================== UPLOAD FILE ====================
    if (action === 'upload') {
      const { investor_id, listing_id, category, file_name, file_data, mime_type, file_size } = body;

      if (!investor_id || !category || !file_name || !file_data || !mime_type) {
        return json({ success: false, error: 'Missing required fields: investor_id, category, file_name, file_data, mime_type' }, 400);
      }

      if (!['lease', 'financial', 'photos'].includes(category)) {
        return json({ success: false, error: 'Invalid category. Must be: lease, financial, or photos' }, 400);
      }

      const allowedTypes = ALLOWED_MIME_TYPES[category];
      if (!allowedTypes.includes(mime_type)) {
        return json({ success: false, error: `File type ${mime_type} not allowed for ${category}.` }, 400);
      }

      const estimatedSize = Math.ceil(file_data.length * 0.75);
      if (estimatedSize > MAX_FILE_SIZE) {
        return json({ success: false, error: `File too large. Maximum size is 10MB.` }, 400);
      }

      // Use the path pattern: seller-docs/{investorId}/{listingId}/{category}/{filename}
      const sanitizedName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const timestamp = Date.now();
      const uniqueName = `${timestamp}_${sanitizedName}`;
      const listingFolder = listing_id || 'draft';
      const filePath = `seller-docs/${investor_id}/${listingFolder}/${category}/${uniqueName}`;

      const fileBytes = base64ToUint8Array(file_data);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, fileBytes, {
          contentType: mime_type,
          upsert: false
        });

      if (uploadError) {
        console.error('[seller-docs v2] Upload error:', uploadError);
        return json({ success: false, error: `Upload failed: ${uploadError.message}` }, 500);
      }

      // Create signed URL for immediate preview
      const { data: signedUrlData } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(filePath, 3600); // 1 hour

      // Store metadata in seller_listing_documents table
      try {
        await supabase.from('seller_listing_documents').insert({
          investor_id,
          listing_id: listing_id || null,
          category,
          file_name: sanitizedName,
          original_file_name: file_name,
          file_path: filePath,
          mime_type,
          file_size: estimatedSize,
          bucket_name: BUCKET,
          status: 'uploaded'
        });
      } catch (e) {
        console.log('[seller-docs v2] Metadata insert note:', e);
      }

      return json({
        success: true,
        file: {
          path: filePath,
          name: file_name,
          mime_type,
          size: estimatedSize,
          category,
          signed_url: signedUrlData?.signedUrl || null,
          uploaded_at: new Date().toISOString()
        }
      });
    }

    // ==================== GET SIGNED URLS ====================
    if (action === 'get_signed_urls') {
      const { file_paths } = body;
      
      if (!file_paths || !Array.isArray(file_paths) || file_paths.length === 0) {
        return json({ success: true, urls: [] });
      }

      const urls = [];
      for (const filePath of file_paths) {
        // Determine which bucket to use based on path
        let bucket = BUCKET;
        let cleanPath = filePath;
        
        // If the path contains a full URL, extract just the path
        if (filePath.includes('/storage/v1/object/')) {
          const parts = filePath.split('/storage/v1/object/');
          if (parts[1]) {
            const afterObject = parts[1].replace(/^(public|sign)\//, '');
            const slashIdx = afterObject.indexOf('/');
            if (slashIdx > 0) {
              bucket = afterObject.substring(0, slashIdx);
              cleanPath = afterObject.substring(slashIdx + 1);
            }
          }
        }
        
        // If path starts with a known bucket name prefix, extract it
        if (cleanPath.startsWith('seller-documents/')) {
          cleanPath = cleanPath.replace('seller-documents/', '');
        } else if (cleanPath.startsWith('investor-documents/')) {
          bucket = 'investor-documents';
          cleanPath = cleanPath.replace('investor-documents/', '');
        }

        // Try the primary bucket first
        let signedUrl = null;
        let error = null;
        
        const { data: signedUrlData, error: signError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(cleanPath, 3600);
        
        if (signedUrlData?.signedUrl) {
          signedUrl = signedUrlData.signedUrl;
        } else {
          error = signError?.message || 'Failed to generate signed URL';
          
          // Fallback: try the other bucket
          const fallbackBucket = bucket === BUCKET ? 'investor-documents' : BUCKET;
          const { data: fallbackData } = await supabase.storage
            .from(fallbackBucket)
            .createSignedUrl(cleanPath, 3600);
          
          if (fallbackData?.signedUrl) {
            signedUrl = fallbackData.signedUrl;
            error = null;
          }
          
          // Also try with seller-listings prefix if the path uses seller-docs
          if (!signedUrl && cleanPath.startsWith('seller-docs/')) {
            const altPath = cleanPath.replace('seller-docs/', 'seller-listings/');
            const { data: altData } = await supabase.storage
              .from('investor-documents')
              .createSignedUrl(altPath, 3600);
            if (altData?.signedUrl) {
              signedUrl = altData.signedUrl;
              error = null;
            }
          }
        }

        urls.push({
          path: filePath,
          signed_url: signedUrl,
          error,
          file_name: cleanPath.split('/').pop()?.replace(/^\d+_/, '') || filePath
        });
      }

      return json({ success: true, urls });
    }

    // ==================== DELETE FILE ====================
    if (action === 'delete') {
      const { investor_id, file_path } = body;
      
      if (!investor_id || !file_path) {
        return json({ success: false, error: 'Missing required fields' }, 400);
      }

      // Verify the file belongs to this investor
      if (!file_path.includes(investor_id)) {
        return json({ success: false, error: 'Unauthorized: file does not belong to this investor' }, 403);
      }

      // Try deleting from seller-documents bucket first
      const { error } = await supabase.storage.from(BUCKET).remove([file_path]);
      if (error) {
        // Fallback: try investor-documents bucket
        const { error: fallbackErr } = await supabase.storage.from('investor-documents').remove([file_path]);
        if (fallbackErr) {
          console.error('[seller-docs v2] Delete error from both buckets:', error.message, fallbackErr.message);
        }
      }

      // Remove metadata from seller_listing_documents
      try {
        await supabase.from('seller_listing_documents').delete().eq('file_path', file_path);
      } catch (e) {}
      
      // Also try legacy table
      try {
        await supabase.from('seller_document_uploads').delete().eq('file_path', file_path);
      } catch (e) {}

      return json({ success: true });
    }

    // ==================== GET LISTING DOCUMENTS ====================
    if (action === 'get_listing_documents') {
      const { listing_id } = body;
      
      if (!listing_id) {
        return json({ success: false, error: 'Missing listing_id' }, 400);
      }

      // Try getting from deal_listings first
      let listing: any = null;
      const { data: dealListing } = await supabase.from('deal_listings')
        .select('proof_of_lease_urls, financial_data_urls, property_photo_urls, seller_id, inventory_list, video_walkthrough_url')
        .eq('id', listing_id)
        .single();
      
      if (dealListing) {
        listing = dealListing;
      } else {
        // Fallback: try marketplace_listings table
        const { data: mktListing } = await supabase.from('marketplace_listings')
          .select('proof_of_lease_urls, financial_data_urls, property_photo_urls, seller_id, inventory_list, video_walkthrough_url')
          .eq('id', listing_id)
          .single();
        listing = mktListing;
      }

      if (!listing) {
        // Final fallback: reconstruct from seller_listing_documents table
        const { data: docs } = await supabase.from('seller_listing_documents')
          .select('*')
          .eq('listing_id', listing_id)
          .order('created_at', { ascending: true });
        
        if (docs && docs.length > 0) {
          const categorized: Record<string, any[]> = { lease: [], financial: [], photos: [] };
          for (const doc of docs) {
            const { data: signedData } = await supabase.storage
              .from(doc.bucket_name || BUCKET)
              .createSignedUrl(doc.file_path, 3600);
            
            categorized[doc.category]?.push({
              path: doc.file_path,
              signed_url: signedData?.signedUrl || null,
              file_name: doc.original_file_name || doc.file_name,
              is_image: (doc.mime_type || '').startsWith('image/')
            });
          }
          return json({ success: true, documents: categorized });
        }
        
        return json({ success: true, documents: { lease: [], financial: [], photos: [] } });
      }

      // Generate signed URLs for all documents
      const generateSignedUrls = async (paths: string[] | null) => {
        if (!paths || paths.length === 0) return [];
        const results = [];
        for (const path of paths) {
          // Try seller-documents bucket first, then investor-documents
          let signedUrl = null;
          
          const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
          if (data?.signedUrl) {
            signedUrl = data.signedUrl;
          } else {
            // Fallback to investor-documents bucket
            const { data: fallback } = await supabase.storage.from('investor-documents').createSignedUrl(path, 3600);
            signedUrl = fallback?.signedUrl || null;
          }
          
          results.push({
            path,
            signed_url: signedUrl,
            file_name: path.split('/').pop()?.replace(/^\d+_/, '') || path,
            is_image: path.match(/\.(jpg|jpeg|png|webp|gif)$/i) !== null
          });
        }
        return results;
      };

      const [leaseUrls, financialUrls, photoUrls] = await Promise.all([
        generateSignedUrls(listing.proof_of_lease_urls),
        generateSignedUrls(listing.financial_data_urls),
        generateSignedUrls(listing.property_photo_urls)
      ]);

      return json({
        success: true,
        documents: {
          lease: leaseUrls,
          financial: financialUrls,
          photos: photoUrls
        },
        inventory_list: listing.inventory_list,
        video_walkthrough_url: listing.video_walkthrough_url
      });
    }

    // ==================== UPDATE LISTING DOCUMENT URLS ====================
    if (action === 'update_listing_urls') {
      const { listing_id, investor_id, category, file_paths } = body;
      
      if (!listing_id || !investor_id || !category) {
        return json({ success: false, error: 'Missing required fields' }, 400);
      }

      const columnMap: Record<string, string> = {
        lease: 'proof_of_lease_urls',
        financial: 'financial_data_urls',
        photos: 'property_photo_urls'
      };

      const column = columnMap[category];
      if (!column) {
        return json({ success: false, error: 'Invalid category' }, 400);
      }

      // Try deal_listings first
      const { error } = await supabase.from('deal_listings')
        .update({ [column]: file_paths || [], updated_at: new Date().toISOString() })
        .eq('id', listing_id)
        .eq('seller_id', investor_id);

      if (error) {
        // Fallback: try marketplace_listings
        const { error: mktErr } = await supabase.from('marketplace_listings')
          .update({ [column]: file_paths || [], updated_at: new Date().toISOString() })
          .eq('id', listing_id)
          .eq('seller_id', investor_id);
        
        if (mktErr) {
          console.error('[seller-docs v2] Update error:', error.message, mktErr?.message);
          return json({ success: false, error: error.message }, 500);
        }
      }

      return json({ success: true });
    }

    return json({ success: false, error: `Unknown action: ${action}` }, 400);
  } catch (error: any) {
    console.error('[seller-docs v2] Error:', error.message);
    return json({ success: false, error: error.message }, 500);
  }
});
