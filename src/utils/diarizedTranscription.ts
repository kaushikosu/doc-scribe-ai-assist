
import { toast } from "@/lib/toast";
import { AudioPart } from "@/components/DiarizedTranscriptView";

// Update to handle long audio files properly
const SYNC_API_URL = "https://speech.googleapis.com/v1p1beta1/speech:recognize";

// Maximum size for direct API upload (approximately 1MB)
const MAX_AUDIO_SIZE = 1000000; // 1MB in bytes
// Maximum duration for each audio segment (30 seconds)
const MAX_SEGMENT_DURATION = 30; // in seconds

interface DiarizedTranscriptionOptions {
  apiKey: string;
  audioBlob: Blob;
  speakerCount?: number;
  languageCode?: string;
  onPartProcessing?: (part: AudioPart) => void;
  onPartComplete?: (part: AudioPart) => void;
  onPartError?: (part: AudioPart) => void;
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
  audioParts?: AudioPart[];
}

export async function getDiarizedTranscription({
  apiKey,
  audioBlob,
  speakerCount = 2,
  languageCode = 'en-US',
  onPartProcessing,
  onPartComplete,
  onPartError
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

    // Check if audio is too large for direct processing
    if (audioBlob.size > MAX_AUDIO_SIZE) {
      console.log(`Audio size (${audioBlob.size} bytes) exceeds direct processing limit (${MAX_AUDIO_SIZE} bytes)`);
      return await processLargeAudio({
        apiKey, 
        audioBlob, 
        speakerCount, 
        languageCode,
        onPartProcessing,
        onPartComplete,
        onPartError
      });
    }
    
    // For smaller files, use the original approach
    return await processStandardAudio({
      apiKey, 
      audioBlob, 
      speakerCount, 
      languageCode,
      onPartProcessing,
      onPartComplete,
      onPartError
    });
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

// Process audio files that are within the size limit
async function processStandardAudio({
  apiKey, 
  audioBlob, 
  speakerCount, 
  languageCode,
  onPartProcessing,
  onPartComplete,
  onPartError
}: DiarizedTranscriptionOptions): Promise<DiarizedTranscription> {
  try {
    const audioPart: AudioPart = {
      id: 1,
      blob: audioBlob,
      size: audioBlob.size,
      duration: 0, // Unknown duration for single parts
      status: 'processing'
    };
    
    if (onPartProcessing) {
      onPartProcessing(audioPart);
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
        model: "latest_short", // Using short model for direct processing
        useEnhanced: true
      },
      audio: {
        content: base64Audio
      }
    };
    
    // Send the recognition request
    const response = await fetch(`${SYNC_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Google Speech API error response:", errorData);
      const errorMessage = errorData.error?.message || 'Unknown error';
      
      audioPart.status = 'error';
      audioPart.error = errorMessage;
      
      if (onPartError) {
        onPartError(audioPart);
      }
      
      throw new Error(`Speech API error: ${errorMessage}`);
    }
    
    const data = await response.json();
    const result = processGoogleSpeechResponse(data);
    
    audioPart.status = 'completed';
    audioPart.transcript = result.transcript;
    
    if (onPartComplete) {
      onPartComplete(audioPart);
    }
    
    // Add the audio part to the result
    result.audioParts = [audioPart];
    
    return result;
  } catch (error: any) {
    console.error("Error in standard audio processing:", error);
    throw error;
  }
}

// Handle larger audio files by splitting into segments
async function processLargeAudio({
  apiKey, 
  audioBlob, 
  speakerCount, 
  languageCode,
  onPartProcessing,
  onPartComplete,
  onPartError
}: DiarizedTranscriptionOptions): Promise<DiarizedTranscription> {
  try {
    toast.info("Audio is being split into smaller segments for processing");
    
    // For now, we'll create segments by slicing the blob by size
    // In a real implementation, we would use Web Audio API to properly split by time
    const totalSize = audioBlob.size;
    const segmentSize = MAX_AUDIO_SIZE * 0.9; // Leave some margin
    const segmentCount = Math.ceil(totalSize / segmentSize);
    
    console.log(`Splitting ${totalSize} byte audio into ${segmentCount} parts`);
    
    // Create audio parts
    const audioParts: AudioPart[] = [];
    const allWords: DiarizedWord[] = [];
    let totalSpeakerCount = 0;
    
    // Process each segment
    for (let i = 0; i < segmentCount; i++) {
      const start = i * segmentSize;
      const end = Math.min(start + segmentSize, totalSize);
      const segmentBlob = audioBlob.slice(start, end);
      
      // Estimated duration based on segment size ratio
      const estimatedDuration = (MAX_SEGMENT_DURATION * segmentBlob.size) / MAX_AUDIO_SIZE;
      
      const audioPart: AudioPart = {
        id: i + 1,
        blob: segmentBlob,
        size: segmentBlob.size,
        duration: estimatedDuration,
        status: 'pending'
      };
      
      audioParts.push(audioPart);
    }
    
    // Process segments in sequence to maintain order
    for (let i = 0; i < audioParts.length; i++) {
      const part = audioParts[i];
      part.status = 'processing';
      
      if (onPartProcessing) {
        onPartProcessing(part);
      }
      
      try {
        // Process this segment
        const result = await processStandardAudio({
          apiKey,
          audioBlob: part.blob, 
          speakerCount, 
          languageCode
        });
        
        part.status = 'completed';
        part.transcript = result.transcript;
        
        // Add words from this segment to the combined result
        if (result.words.length > 0) {
          // Adjust timing for words based on segment position
          const timeOffset = i * MAX_SEGMENT_DURATION;
          const adjustedWords = result.words.map(word => ({
            ...word,
            startTime: word.startTime + timeOffset,
            endTime: word.endTime + timeOffset
          }));
          
          allWords.push(...adjustedWords);
          totalSpeakerCount = Math.max(totalSpeakerCount, result.speakerCount);
        }
        
        if (onPartComplete) {
          onPartComplete(part);
        }
      } catch (error: any) {
        console.error(`Error processing segment ${i+1}:`, error);
        part.status = 'error';
        part.error = error.message;
        
        if (onPartError) {
          onPartError(part);
        }
      }
    }
    
    // Create the combined result
    const combinedTranscript = audioParts
      .filter(part => part.transcript)
      .map(part => part.transcript)
      .join(" ");
    
    return {
      transcript: combinedTranscript,
      words: allWords,
      speakerCount: totalSpeakerCount,
      audioParts: audioParts
    };
  } catch (error: any) {
    console.error("Error processing large audio:", error);
    throw new Error("Audio file too large: " + error.message);
  }
}

// Process the response from Google Speech API
function processGoogleSpeechResponse(data: any): DiarizedTranscription {
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
