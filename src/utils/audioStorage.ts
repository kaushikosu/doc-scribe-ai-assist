import { supabase } from '@/integrations/supabase/client';

/**
 * Upload audio recording to Supabase storage
 * @param audioBlob - The audio blob to upload
 * @param sessionId - The consultation session ID
 * @param userId - The doctor's user ID
 * @returns Promise with the storage path or error
 */
export async function uploadAudioRecording(
  audioBlob: Blob,
  sessionId: string,
  userId: string
): Promise<{ path: string | null; error: string | null }> {
  try {
    // Create a unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `consultation-${sessionId}-${timestamp}.webm`;
    const filePath = `${userId}/${fileName}`;

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('recordings')
      .upload(filePath, audioBlob, {
        contentType: 'audio/webm',
        upsert: false
      });

    if (error) {
      console.error('Error uploading audio:', error);
      return { path: null, error: error.message };
    }

    return { path: data.path, error: null };

  } catch (error) {
    console.error('Error in uploadAudioRecording:', error);
    return { 
      path: null, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

/**
 * Update consultation session with audio path
 * @param sessionId - The consultation session ID
 * @param audioPath - The storage path of the uploaded audio
 * @returns Promise with success/error status
 */
export async function updateSessionAudioPath(
  sessionId: string, 
  audioPath: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('consultation_sessions')
      .update({ audio_path: audioPath })
      .eq('id', sessionId);

    if (error) {
      console.error('Error updating session audio path:', error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };

  } catch (error) {
    console.error('Error in updateSessionAudioPath:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

/**
 * Get signed URL for audio playback
 * @param audioPath - The storage path of the audio file
 * @returns Promise with the signed URL or error
 */
export async function getAudioSignedUrl(
  audioPath: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    const { data, error } = await supabase.storage
      .from('recordings')
      .createSignedUrl(audioPath, 3600); // 1 hour expiry

    if (error) {
      console.error('Error creating signed URL:', error);
      return { url: null, error: error.message };
    }

    return { url: data.signedUrl, error: null };

  } catch (error) {
    console.error('Error in getAudioSignedUrl:', error);
    return { 
      url: null, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

/**
 * Delete audio recording from storage
 * @param audioPath - The storage path of the audio file to delete
 * @returns Promise with success/error status
 */
export async function deleteAudioRecording(
  audioPath: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase.storage
      .from('recordings')
      .remove([audioPath]);

    if (error) {
      console.error('Error deleting audio:', error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };

  } catch (error) {
    console.error('Error in deleteAudioRecording:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}