import { supabase } from '@/lib/supabase';

const BUCKET_NAME = 'property-photos';
const SUPABASE_URL = 'https://adcbrclppmnguzkzwiys.supabase.co';
const SIGNED_URL_EXPIRY = 3600; // 1 hour in seconds

// In-memory cache for signed URLs to avoid redundant calls
const urlCache = new Map<string, { url: string; expiresAt: number }>();
const CACHE_BUFFER = 300_000; // 5 minutes buffer before expiry

/**
 * Resolve a photo URL or storage path to a full public URL.
 * Works for:
 *   - Full URLs (returned as-is)
 *   - Storage paths like "portfolio/investor123/photo.jpg"
 *   - Paths prefixed with bucket name "property-photos/portfolio/..."
 *   - Blob URLs (returned as-is)
 */
export function resolvePublicPhotoUrl(urlOrPath: string): string {
  if (!urlOrPath) return '';
  const trimmed = urlOrPath.trim();
  
  // Already a full URL or blob URL - return as-is
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  
  // It's a storage path - construct the public URL
  let path = trimmed;
  
  // Remove bucket name prefix if present
  if (path.startsWith(`${BUCKET_NAME}/`)) {
    path = path.substring(BUCKET_NAME.length + 1);
  }
  
  // Remove leading slash
  if (path.startsWith('/')) {
    path = path.substring(1);
  }
  
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${path}`;
}

/**
 * Batch resolve photo URLs/paths to full public URLs.
 */
export function resolvePublicPhotoUrls(urlsOrPaths: string[]): string[] {
  if (!urlsOrPaths || urlsOrPaths.length === 0) return [];
  return urlsOrPaths.map(resolvePublicPhotoUrl).filter(Boolean);
}

/**
 * Extract the storage file path from a full Supabase public URL or return as-is if already a path.
 * Handles formats:
 *   - https://{project}.supabase.co/storage/v1/object/public/property-photos/portfolio/...
 *   - property-photos/portfolio/...
 *   - portfolio/investor123/timestamp-photo.jpg
 */

export function extractFilePath(urlOrPath: string): string {
  if (!urlOrPath) return '';
  
  let path = urlOrPath.trim();
  
  // If it's a full URL, extract the path portion
  if (path.startsWith('http://') || path.startsWith('https://')) {
    // Try to extract from known URL patterns
    const patterns = [
      `/storage/v1/object/public/${BUCKET_NAME}/`,
      `/storage/v1/object/sign/${BUCKET_NAME}/`,
      `/storage/v1/object/authenticated/${BUCKET_NAME}/`,
    ];
    
    for (const pattern of patterns) {
      const idx = path.indexOf(pattern);
      if (idx !== -1) {
        path = path.substring(idx + pattern.length);
        // Remove query params (like ?token=...)
        const qIdx = path.indexOf('?');
        if (qIdx !== -1) path = path.substring(0, qIdx);
        break;
      }
    }
    
    // Fallback: try splitting on bucket name
    if (path.startsWith('http')) {
      try {
        const url = new URL(path);
        const parts = url.pathname.split(`/${BUCKET_NAME}/`);
        if (parts.length > 1) {
          path = parts[parts.length - 1];
        }
      } catch {
        // Not a valid URL, use as-is
      }
    }
  }
  
  // Remove bucket name prefix if someone stored it with the bucket name
  if (path.startsWith(`${BUCKET_NAME}/`)) {
    path = path.substring(BUCKET_NAME.length + 1);
  }
  
  // Remove leading slash
  if (path.startsWith('/')) {
    path = path.substring(1);
  }
  
  // Decode URI components
  try {
    path = decodeURIComponent(path);
  } catch {
    // Already decoded
  }
  
  return path;
}

/**
 * Check if a URL/path looks like a storage file path (not a full URL)
 */
export function isFilePath(value: string): boolean {
  return !value.startsWith('http://') && !value.startsWith('https://') && !value.startsWith('blob:');
}

/**
 * Check if a URL is a blob URL (local preview)
 */
export function isBlobUrl(value: string): boolean {
  return value.startsWith('blob:');
}

/**
 * Generate a signed URL for a single file path.
 * Uses edge function with client-side fallback.
 * Results are cached in memory.
 */
export async function generateSignedUrl(filePathOrUrl: string): Promise<string> {
  if (!filePathOrUrl) return '';
  
  // Don't process blob URLs
  if (isBlobUrl(filePathOrUrl)) return filePathOrUrl;
  
  const filePath = extractFilePath(filePathOrUrl);
  if (!filePath) return filePathOrUrl;
  
  // Check cache
  const cached = urlCache.get(filePath);
  if (cached && cached.expiresAt > Date.now() + CACHE_BUFFER) {
    return cached.url;
  }
  
  try {
    // Try edge function first (uses service role key for reliable signing)
    const { data, error } = await supabase.functions.invoke('property-photo-urls', {
      body: { action: 'sign_url', file_path: filePath }
    });
    
    if (!error && data?.signed_url) {
      // Cache the result
      urlCache.set(filePath, {
        url: data.signed_url,
        expiresAt: Date.now() + (SIGNED_URL_EXPIRY * 1000)
      });
      return data.signed_url;
    }
  } catch (e) {
    console.warn('[photoUtils] Edge function failed, trying client-side:', e);
  }
  
  // Fallback: client-side signed URL generation
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, SIGNED_URL_EXPIRY);
    
    if (!error && data?.signedUrl) {
      urlCache.set(filePath, {
        url: data.signedUrl,
        expiresAt: Date.now() + (SIGNED_URL_EXPIRY * 1000)
      });
      return data.signedUrl;
    }
  } catch (e) {
    console.warn('[photoUtils] Client-side signed URL failed:', e);
  }
  
  // Final fallback: public URL
  try {
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
    if (data?.publicUrl) {
      urlCache.set(filePath, {
        url: data.publicUrl,
        expiresAt: Date.now() + (SIGNED_URL_EXPIRY * 1000)
      });
      return data.publicUrl;
    }
  } catch {
    // Return original
  }
  
  return filePathOrUrl;
}

/**
 * Batch generate signed URLs for multiple file paths.
 * Uses edge function for efficiency with individual fallbacks.
 */
export async function generateSignedUrls(filePathsOrUrls: string[]): Promise<string[]> {
  if (!filePathsOrUrls || filePathsOrUrls.length === 0) return [];
  
  const results: string[] = new Array(filePathsOrUrls.length).fill('');
  const uncachedPaths: { index: number; filePath: string; original: string }[] = [];
  
  // Check cache first
  for (let i = 0; i < filePathsOrUrls.length; i++) {
    const original = filePathsOrUrls[i];
    
    if (!original || isBlobUrl(original)) {
      results[i] = original || '';
      continue;
    }
    
    const filePath = extractFilePath(original);
    const cached = urlCache.get(filePath);
    
    if (cached && cached.expiresAt > Date.now() + CACHE_BUFFER) {
      results[i] = cached.url;
    } else {
      uncachedPaths.push({ index: i, filePath, original });
    }
  }
  
  // If all cached, return immediately
  if (uncachedPaths.length === 0) return results;
  
  // Try batch edge function
  try {
    const { data, error } = await supabase.functions.invoke('property-photo-urls', {
      body: { 
        action: 'sign_urls', 
        file_paths: uncachedPaths.map(p => p.filePath) 
      }
    });
    
    if (!error && data?.urls && Array.isArray(data.urls)) {
      for (let i = 0; i < data.urls.length; i++) {
        const urlResult = data.urls[i];
        const uncached = uncachedPaths[i];
        if (urlResult?.signed_url) {
          results[uncached.index] = urlResult.signed_url;
          urlCache.set(uncached.filePath, {
            url: urlResult.signed_url,
            expiresAt: Date.now() + (SIGNED_URL_EXPIRY * 1000)
          });
        } else {
          results[uncached.index] = uncached.original;
        }
      }
      return results;
    }
  } catch (e) {
    console.warn('[photoUtils] Batch edge function failed, falling back to individual:', e);
  }
  
  // Fallback: generate individually
  const promises = uncachedPaths.map(async ({ index, original }) => {
    const url = await generateSignedUrl(original);
    results[index] = url;
  });
  
  await Promise.all(promises);
  return results;
}

/**
 * Clear the URL cache (useful when photos are updated)
 */
export function clearPhotoUrlCache(): void {
  urlCache.clear();
}

/**
 * Build the storage file path for a new upload
 */
export function buildUploadPath(
  investorId: string, 
  fileName: string, 
  propertyId?: string
): string {
  const timestamp = Date.now();
  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  
  if (propertyId) {
    return `portfolio/${investorId}/${propertyId}/${timestamp}-${safeName}`;
  }
  return `portfolio/${investorId}/${timestamp}-${safeName}`;
}
