import { supabase } from '@/lib/supabase';

/**
 * Upload a landlord's file into their own folder of the private seller-documents bucket.
 *
 * The browser has no general write access to storage. manage-landlord-portal checks the
 * landlord's sign-in and hands back a one-time upload link for a path in their folder;
 * the file goes straight there. Returns the path, which the caller passes back to the
 * function as storage_path so it can record the file.
 */
export async function uploadLandlordFile(
  file: File,
  purpose: 'document' | 'application_pdf',
  propertyId?: string,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('manage-landlord-portal', {
    body: { action: 'create_upload_url', file_name: file.name, purpose, property_id: propertyId },
  });
  if (error || !data?.success || !data.path || !data.token) {
    throw new Error(data?.error || 'We could not prepare the upload. Please try again.');
  }
  const { error: upErr } = await supabase.storage.from(data.bucket || 'seller-documents')
    .uploadToSignedUrl(data.path, data.token, file, { contentType: file.type || undefined });
  if (upErr) throw new Error('The file did not upload. Check your connection and try again.');
  return data.path as string;
}
