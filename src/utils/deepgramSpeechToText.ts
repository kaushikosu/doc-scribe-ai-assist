import axios from 'axios';

export interface DeepgramResult {
  transcript: string;
  isFinal: boolean;
  resultIndex: number;
  speakerTag?: number;
  error?: string;
  topics?: string[];
}

// Process a complete audio file with Deepgram for improved diarization
export const processCompleteAudio = async (
  audioBlob: Blob,
  apiKey: string,  // We'll still accept this for backwards compatibility, but won't use it
): Promise<{transcript: string, error?: string}> => {
  try {
    console.log('Processing complete audio with Deepgram via backend server');
    
    // Convert blob to base64 for transmission
    const base64Audio = await blobToBase64(audioBlob);
    
    // Determine the correct mime type for the blob
    let mimeType = audioBlob.type;
    if (!mimeType || mimeType === 'audio/mp4') {
      mimeType = 'audio/mp4';
    } else if (mimeType.includes('webm')) {
      mimeType = 'audio/webm';
    } else {
      mimeType = 'audio/wav'; // fallback
    }
    
    console.log(`Sending audio to backend for processing: ${Math.round(base64Audio.length / 1024)} KB, type: ${mimeType}`);
    
    // Call the backend API we created
    const response = await axios.post('https://vtbpeozzyaqxjgmroeqs.supabase.co/functions/v1/deepgram-diarize-audio', {
      audio: base64Audio,
      mimeType: mimeType
    });
    

    console.log('Received response from backend:', response);

    // Return the formatted transcript
    return {
      transcript: response.data.transcript,
      error: response.data.error
    };
    
  } catch (error) {
    console.error('Error processing audio with Deepgram:', error);
    
    // Enhanced error handling
    let errorMessage = 'Unknown error';
    
    if (axios.isAxiosError(error)) {
      errorMessage = error.response?.data?.error || error.message;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return {
      transcript: '',
      error: `Error processing audio: ${errorMessage}`
    };
  }
};

// Helper to convert Blob to base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Extract the base64 data part (remove the data:audio/xxx;base64, prefix)
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Keep helper functions for backwards compatibility
export const getSpeakerLabel = (speakerTag?: number): string => {
  if (speakerTag === undefined) return '';
  return speakerTag === 1 ? 'Doctor' : 'Patient';
};
