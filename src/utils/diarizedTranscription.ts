
import { toast } from "@/lib/toast";

// Update to use the proper endpoint for long audio files
const SYNC_API_URL = "https://speech.googleapis.com/v1p1beta1/speech:recognize";
const ASYNC_API_URL = "https://speech.googleapis.com/v1p1beta1/speech:longrunningrecognize";

interface DiarizedTranscriptionOptions {
  apiKey: string;
  audioBlob: Blob;
  speakerCount?: number;
  languageCode?: string;
}

export interface DiarizedWord {
  word: string;
  speakerTag: number;
  startTime: number;
  endTime: number;
}

export interface DiarizedTranscription {
  transcript: string;
  words: DiarizedWord[];
  speakerCount: number;
  error?: string;
}

export async function getDiarizedTranscription({
  apiKey,
  audioBlob,
  speakerCount = 2,
  languageCode = 'en-US'
}: DiarizedTranscriptionOptions): Promise<DiarizedTranscription> {
  try {
    if (!apiKey) {
      console.error("No API key provided for diarization");
      throw new Error("API key is required");
    }
    
    console.log(`Processing audio for diarization: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
    
    // Validate audio blob
    if (audioBlob.size === 0) {
      console.error("Empty audio blob provided");
      throw new Error("No audio data available for diarization");
    }
    
    // Convert audio blob to base64
    const base64Audio = await blobToBase64(audioBlob);
    console.log("Audio converted to base64, length:", base64Audio.length);
    
    // Configure request with diarization settings
    const request = {
      config: {
        encoding: "WEBM_OPUS",
        sampleRateHertz: 48000,
        languageCode,
        enableAutomaticPunctuation: true,
        enableSpeakerDiarization: true,
        diarizationSpeakerCount: speakerCount,
        model: "latest_long",
        useEnhanced: true
      },
      audio: {
        content: base64Audio
      }
    };
    
    console.log("Using LongRunningRecognize endpoint for diarization");
    
    // Step 1: Start the asynchronous operation
    const startResponse = await fetch(`${ASYNC_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });
    
    if (!startResponse.ok) {
      const errorData = await startResponse.json();
      console.error("Google Speech API error starting operation:", errorData);
      const errorMessage = errorData.error?.message || `API error: ${startResponse.status}`;
      throw new Error(`Speech API error: ${errorMessage}`);
    }
    
    // Get operation name from response
    const operationData = await startResponse.json();
    if (!operationData.name) {
      throw new Error("No operation name returned from API");
    }
    
    const operationName = operationData.name;
    console.log(`LongRunningRecognize operation started: ${operationName}`);
    
    // Step 2: Poll for operation completion
    const maxAttempts = 30;
    let attempts = 0;
    let operationComplete = false;
    let operationResult = null;
    
    while (!operationComplete && attempts < maxAttempts) {
      attempts++;
      console.log(`Checking operation status (attempt ${attempts}/${maxAttempts})...`);
      
      // Wait 2 seconds between polling attempts
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check operation status
      const checkResponse = await fetch(`https://speech.googleapis.com/v1p1beta1/operations/${operationName}?key=${apiKey}`);
      
      if (!checkResponse.ok) {
        const errorData = await checkResponse.json();
        console.error("Error checking operation status:", errorData);
        continue;
      }
      
      const checkData = await checkResponse.json();
      
      // Operation complete
      if (checkData.done === true) {
        console.log("Operation completed successfully");
        operationComplete = true;
        operationResult = checkData;
      }
    }
    
    // If we timed out
    if (!operationComplete) {
      throw new Error(`Operation timed out after ${maxAttempts} attempts`);
    }
    
    // Process results
    if (!operationResult || !operationResult.response || !operationResult.response.results) {
      throw new Error("No results returned from completed operation");
    }
    
    const data = operationResult.response;
    console.log("Google diarized speech response:", data);
    
    // Process response to extract diarized words
    if (!data.results || data.results.length === 0) {
      console.warn("No transcription results returned from API");
      return {
        transcript: "",
        words: [],
        speakerCount: 0,
        error: "No transcription results returned"
      };
    }
    
    // Extract words with speaker tags
    const words: DiarizedWord[] = [];
    let fullTranscript = "";
    
    data.results.forEach((result: any) => {
      if (result.alternatives && result.alternatives[0]) {
        // Add to full transcript
        if (result.alternatives[0].transcript) {
          fullTranscript += result.alternatives[0].transcript + " ";
        }
        
        // Process words with speaker tags if available
        if (result.alternatives[0].words) {
          result.alternatives[0].words.forEach((word: any) => {
            words.push({
              word: word.word,
              speakerTag: word.speakerTag || 0,
              startTime: parseFloat(word.startTime?.seconds || 0) + parseFloat(word.startTime?.nanos || 0) / 1e9,
              endTime: parseFloat(word.endTime?.seconds || 0) + parseFloat(word.endTime?.nanos || 0) / 1e9
            });
          });
        }
      }
    });
    
    console.log(`Processed ${words.length} words with speaker tags`);
    
    // Count actual speakers detected
    const uniqueSpeakers = new Set<number>();
    words.forEach(word => {
      if (word.speakerTag > 0) {
        uniqueSpeakers.add(word.speakerTag);
      }
    });
    
    console.log(`Detected ${uniqueSpeakers.size} unique speakers`);
    
    return {
      transcript: fullTranscript.trim(),
      words,
      speakerCount: uniqueSpeakers.size
    };
    
  } catch (error: any) {
    console.error("Error in diarized transcription:", error);
    toast.error("Failed to process diarized transcription: " + error.message);
    return {
      transcript: "",
      words: [],
      speakerCount: 0,
      error: error.message
    };
  }
}

// Convert audio blob to base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      try {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      } catch (error) {
        reject(new Error("Failed to convert audio to base64: " + error));
      }
    };
    reader.onerror = (error) => {
      reject(new Error("FileReader error: " + error));
    };
    reader.readAsDataURL(blob);
  });
}

// Format diarized words into a readable transcript with speaker tags
export function formatDiarizedTranscript(words: DiarizedWord[]): string {
  if (words.length === 0) return "";
  
  const transcript: string[] = [];
  let currentSpeaker: number | null = null;
  let currentUtterance: string[] = [];
  
  // Process each word
  words.forEach((word, index) => {
    // Handle speaker change
    if (currentSpeaker !== null && word.speakerTag !== currentSpeaker) {
      // Add the previous speaker's utterance
      transcript.push(`[Speaker ${currentSpeaker}]: ${currentUtterance.join(' ')}`);
      currentUtterance = [];
    }
    
    // Update current speaker
    currentSpeaker = word.speakerTag;
    
    // Add word to current utterance
    currentUtterance.push(word.word);
    
    // End of sentence detection (basic)
    const endsWithPunctuation = word.word.match(/[.!?]$/);
    const isLastWord = index === words.length - 1;
    const longPause = index < words.length - 1 && 
                      (words[index+1].startTime - word.endTime > 1.0); // 1 second pause
                      
    if ((endsWithPunctuation || longPause || isLastWord) && currentUtterance.length > 0) {
      transcript.push(`[Speaker ${currentSpeaker}]: ${currentUtterance.join(' ')}`);
      currentUtterance = [];
    }
  });
  
  // Add any remaining utterance
  if (currentUtterance.length > 0 && currentSpeaker !== null) {
    transcript.push(`[Speaker ${currentSpeaker}]: ${currentUtterance.join(' ')}`);
  }
  
  return transcript.join('\n\n');
}

// Map speaker tags to Doctor/Patient roles
export function mapSpeakerRoles(diarizedTranscript: string): string {
  // Simple heuristic: typically speaker 1 is the doctor and speaker 2 is the patient
  // This is a simplification - in reality, we'd need more sophisticated analysis
  return diarizedTranscript
    .replace(/\[Speaker 1\]/g, '[Doctor]')
    .replace(/\[Speaker 2\]/g, '[Patient]');
}
