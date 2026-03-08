import { supabase } from '@/integrations/supabase/client';

/**
 * Generate a signed URL for a profile photo stored in the private bucket.
 * The URL is valid for 1 hour (3600 seconds).
 */
export async function getSignedProfilePhotoUrl(filePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('profile-photos')
      .createSignedUrl(filePath, 3600);
    
    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }
    
    return data.signedUrl;
  } catch (err) {
    console.error('Error getting signed URL:', err);
    return null;
  }
}

/**
 * Extract the file path from a profile photo URL (handles both public and signed URLs)
 */
export function extractProfilePhotoPath(url: string | null | undefined): string | null {
  if (!url) return null;
  
  try {
    // Handle signed URLs or public URLs from Supabase storage
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Extract path after /storage/v1/object/... or /storage/v1/sign/...
    const matches = pathname.match(/\/storage\/v1\/(?:object\/(?:public|sign)|s3)\/profile-photos\/(.+)/);
    if (matches && matches[1]) {
      return decodeURIComponent(matches[1].split('?')[0]);
    }
    
    // Fallback: try to extract from simple path
    const simpleMatch = pathname.match(/profile-photos\/(.+)/);
    if (simpleMatch && simpleMatch[1]) {
      return decodeURIComponent(simpleMatch[1].split('?')[0]);
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Upload a profile photo and return a signed URL
 */
export async function uploadProfilePhoto(
  studentId: string,
  file: File
): Promise<{ url: string; path: string } | null> {
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  const filePath = `${studentId}/profile.${fileExt}`;
  
  const { error: uploadError } = await supabase.storage
    .from('profile-photos')
    .upload(filePath, file, { contentType: file.type, upsert: true });
  
  if (uploadError) {
    throw uploadError;
  }
  
  const signedUrl = await getSignedProfilePhotoUrl(filePath);
  if (!signedUrl) {
    throw new Error('Failed to generate signed URL');
  }
  
  return { url: signedUrl, path: filePath };
}
