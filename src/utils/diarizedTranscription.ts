import { toast } from "@/lib/toast";
import { AudioPart } from "@/components/DiarizedTranscriptView";

// Update to use long-running API for larger files
const SYNC_API_URL = "https://speech.googleapis.com/v1p1beta1/speech:recognize";
const LONG_RUNNING_API_URL = "https://speech.googleapis.com/v1p1beta1/speech:longrunningrecognize";
const OPERATIONS_API_URL = "https://speech.googleapis.com/v1p1beta1/operations";

// Maximum size for direct API upload (approximately 1MB)
const MAX_AUDIO_SIZE = 950000; // 950KB (keeping under the 1MB limit with some buffer)
// Maximum duration for each audio segment (30 seconds)
const MAX_SEGMENT_DURATION = 30; // in seconds
// Maximum size for segments we process through the sync API
const MAX_SEGMENT_SIZE = 900000; // 900KB for individual segments
// Minimum segment size to process (to avoid empty segments)
const MIN_SEGMENT_SIZE = 10000; // 10KB

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

    // For larger files, we'll use the long-running API
    if (audioBlob.size > MAX_AUDIO_SIZE || estimateDuration(audioBlob.size) > 60) {
      console.log(`Audio size (${audioBlob.size} bytes) or duration exceeds direct processing limit. Using LongRunningRecognize API`);
      return await processLargeAudioWithLongRunning({
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
      duration: estimateDuration(audioBlob.size),
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
    
    console.log("Sending request to Google Speech API");
    
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
    console.log("Google Speech API response:", JSON.stringify(data, null, 2));
    
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

// Handle larger audio files using longrunningrecognize endpoint
async function processLargeAudioWithLongRunning({
  apiKey, 
  audioBlob, 
  speakerCount, 
  languageCode,
  onPartProcessing,
  onPartComplete,
  onPartError
}: DiarizedTranscriptionOptions): Promise<DiarizedTranscription> {
  try {
    toast.info("Processing larger audio file with LongRunningRecognize API");
    
    const audioPart: AudioPart = {
      id: 1,
      blob: audioBlob,
      size: audioBlob.size,
      duration: estimateDuration(audioBlob.size),
      status: 'processing'
    };
    
    if (onPartProcessing) {
      onPartProcessing(audioPart);
    }
    
    // Convert audio blob to base64
    const base64Audio = await blobToBase64(audioBlob);
    console.log("Audio converted to base64, length:", base64Audio.length);
    
    // Configure request with diarization settings for long-running API
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
    
    console.log("Sending request to Google Speech LongRunningRecognize API");
    
    // Send the long-running recognition request
    const response = await fetch(`${LONG_RUNNING_API_URL}?key=${apiKey}`, {
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
    
    const operationData = await response.json();
    console.log("LongRunningRecognize operation started:", operationData);
    
    if (!operationData.name) {
      throw new Error("No operation name returned from API");
    }
    
    // Poll for the operation result
    const operationResult = await pollLongRunningOperation(operationData.name, apiKey);
    console.log("LongRunningRecognize operation complete:", operationResult);
    
    if (operationResult.error) {
      audioPart.status = 'error';
      audioPart.error = operationResult.error.message;
      
      if (onPartError) {
        onPartError(audioPart);
      }
      
      throw new Error(`Speech API operation error: ${operationResult.error.message}`);
    }
    
    if (!operationResult.response) {
      throw new Error("No response data in operation result");
    }
    
    const result = processGoogleSpeechResponse(operationResult.response);
    
    audioPart.status = 'completed';
    audioPart.transcript = result.transcript;
    
    if (onPartComplete) {
      onPartComplete(audioPart);
    }
    
    // Add the audio part to the result
    result.audioParts = [audioPart];
    
    return result;
  } catch (error: any) {
    console.error("Error in long-running audio processing:", error);
    throw error;
  }
}

// Poll for the result of a long-running operation
async function pollLongRunningOperation(operationName: string, apiKey: string, maxAttempts = 30): Promise<any> {
  console.log(`Polling operation: ${operationName}`);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      toast.info(`Checking transcription status (attempt ${attempt + 1}/${maxAttempts})...`);
      
      const response = await fetch(`${OPERATIONS_API_URL}/${operationName}?key=${apiKey}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error checking operation status:", errorData);
        throw new Error(`Failed to check operation status: ${errorData.error?.message || response.statusText}`);
      }
      
      const operationStatus = await response.json();
      console.log(`Operation status (attempt ${attempt + 1}):`, operationStatus);
      
      if (operationStatus.done) {
        console.log("Operation completed:", operationStatus);
        return operationStatus;
      }
      
      // Wait before polling again - with exponential backoff
      const delay = Math.min(5000 * Math.pow(1.5, attempt), 30000);
      console.log(`Waiting ${delay}ms before polling again...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
      console.error(`Error on polling attempt ${attempt + 1}:`, error);
      // Continue with next attempt despite error
    }
  }
  
  throw new Error(`Operation timed out after ${maxAttempts} attempts`);
}

// Handle larger audio files by splitting into segments (fallback if needed)
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
    const segmentSize = MAX_SEGMENT_SIZE; // Using our defined max segment size
    const segmentCount = Math.ceil(totalSize / segmentSize);
    
    console.log(`Splitting ${totalSize} byte audio into ${segmentCount} parts`);
    
    // Create audio parts
    const audioParts: AudioPart[] = [];
    const allWords: DiarizedWord[] = [];
    let totalSpeakerCount = 0;
    let combinedTranscript = "";
    
    // Process each segment
    for (let i = 0; i < segmentCount; i++) {
      const start = i * segmentSize;
      const end = Math.min(start + segmentSize, totalSize);
      const segmentBlob = audioBlob.slice(start, end);
      
      // Estimated duration based on segment size ratio
      const estimatedDuration = estimateDuration(segmentBlob.size);
      
      // Skip segments that are too small (likely silence or padding)
      if (segmentBlob.size < MIN_SEGMENT_SIZE) {
        console.log(`Skipping segment ${i+1} (${segmentBlob.size} bytes): Too small`);
        continue;
      }
      
      const audioPart: AudioPart = {
        id: i + 1,
        blob: segmentBlob,
        size: segmentBlob.size,
        duration: estimatedDuration,
        status: 'pending'
      };
      
      audioParts.push(audioPart);
    }
    
    console.log(`Created ${audioParts.length} segments for processing`);
    
    // Process segments in sequence to maintain order
    for (let i = 0; i < audioParts.length; i++) {
      const part = audioParts[i];
      part.status = 'processing';
      
      if (onPartProcessing) {
        onPartProcessing(part);
      }
      
      try {
        // Convert audio blob to base64
        const base64Audio = await blobToBase64(part.blob);
        console.log(`Processing part ${part.id} (${part.size} bytes)`);
        
        // Configure request with diarization settings
        const request = {
          config: {
            encoding: "WEBM_OPUS",
            sampleRateHertz: 48000,
            languageCode,
            enableAutomaticPunctuation: true,
            enableSpeakerDiarization: true,
            diarizationSpeakerCount: speakerCount,
            model: "latest_short",
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
          console.error(`Error processing part ${i+1}:`, errorData);
          const errorMessage = errorData.error?.message || 'Unknown error';
          
          part.status = 'error';
          part.error = errorMessage;
          
          if (onPartError) {
            onPartError(part);
          }
          
          // Continue with next part instead of failing the whole process
          continue;
        }
        
        const data = await response.json();
        console.log(`Part ${part.id} API response:`, data);
        
        const result = processGoogleSpeechResponse(data);
        
        part.status = 'completed';
        part.transcript = result.transcript;
        
        // Add to combined transcript
        if (result.transcript) {
          combinedTranscript += (combinedTranscript ? " " : "") + result.transcript;
          console.log(`Added ${result.transcript.length} characters to transcript from part ${part.id}`);
        } else {
          console.log(`No transcript in part ${part.id}`);
        }
        
        // Add words from this segment to the combined result
        if (result.words.length > 0) {
          // Adjust timing for words based on segment position
          const timeOffset = i * MAX_SEGMENT_DURATION;
          const adjustedWords = result.words.map(word => ({
            ...word,
            startTime: word.startTime + timeOffset,
            endTime: word.endTime + timeOffset
          }));
          
          console.log(`Added ${adjustedWords.length} words from part ${part.id}`);
          allWords.push(...adjustedWords);
          totalSpeakerCount = Math.max(totalSpeakerCount, result.speakerCount);
        } else {
          console.log(`No words with speaker tags in part ${part.id}`);
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
    
    // Check if we got any successful transcriptions
    const successfulParts = audioParts.filter(part => part.status === 'completed' && part.transcript);
    const errorParts = audioParts.filter(part => part.status === 'error');
    
    console.log(`Processing summary: ${successfulParts.length} successful parts, ${errorParts.length} error parts`);
    console.log(`Total transcript length: ${combinedTranscript.length} characters`);
    console.log(`Total words with speaker tags: ${allWords.length}`);
    
    // Return appropriate result based on processing success
    if (successfulParts.length === 0 && errorParts.length > 0) {
      // All parts failed, return error
      const firstErrorMessage = errorParts[0]?.error || "All audio segments failed to process";
      return {
        transcript: "",
        words: [],
        speakerCount: 0,
        error: `Failed to transcribe audio: ${firstErrorMessage}`,
        audioParts: audioParts
      };
    }
    
    return {
      transcript: combinedTranscript,
      words: allWords,
      speakerCount: totalSpeakerCount || (combinedTranscript ? 2 : 0), // Default to 2 speakers if we have transcript but no tags
      audioParts: audioParts
    };
  } catch (error: any) {
    console.error("Error processing large audio:", error);
    throw new Error("Error processing audio: " + error.message);
  }
}

// Helper to estimate duration based on file size
const estimateDuration = (bytes: number): number => {
  // Approximate calculation: ~12KB per second for 48kHz WebM opus
  return Math.max(1, Math.round(bytes / 12000));
};

// Convert audio blob to base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      try {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      } catch (error) {
        reject(new Error("Failed to extract base64 data: " + error));
      }
    };
    reader.onerror = (error) => {
      reject(new Error("FileReader error: " + error));
    };
    reader.readAsDataURL(blob);
  });
};

// Process Google Speech API response
const processGoogleSpeechResponse = (data: any): DiarizedTranscription => {
  console.log("Processing Google Speech API response");
  
  if (!data.results || data.results.length === 0) {
    console.log("No results from Google Speech API");
    return {
      transcript: "",
      words: [],
      speakerCount: 0
    };
  }
  
  // Extract words with speaker tags
  const words: DiarizedWord[] = [];
  let transcript = "";
  let maxSpeakerTag = 0;
  
  data.results.forEach((result: any) => {
    if (result.alternatives && result.alternatives[0]) {
      // Add to the raw transcript
      if (result.alternatives[0].transcript) {
        transcript += (transcript ? " " : "") + result.alternatives[0].transcript;
      }
      
      // Extract words with speaker tags if available
      if (result.alternatives[0].words) {
        result.alternatives[0].words.forEach((word: any) => {
          if (!word.word) return;
          
          const speakerTag = word.speakerTag || 0;
          maxSpeakerTag = Math.max(maxSpeakerTag, speakerTag);
          
          words.push({
            word: word.word,
            speakerTag: speakerTag,
            startTime: parseFloat(word.startTime?.seconds || 0) + 
                      parseFloat(word.startTime?.nanos || 0) / 1000000000,
            endTime: parseFloat(word.endTime?.seconds || 0) + 
                    parseFloat(word.endTime?.nanos || 0) / 1000000000
          });
        });
      }
    }
  });
  
  console.log(`Processed ${words.length} words with speaker tags`);
  console.log(`Detected ${maxSpeakerTag} speakers`);
  
  return {
    transcript,
    words,
    speakerCount: maxSpeakerTag
  };
};

// Format diarized transcript with speaker labels
export const formatDiarizedTranscript = (words: DiarizedWord[]): string => {
  if (!words || words.length === 0) {
    return "";
  }
  
  let result = "";
  let currentSpeaker = words[0].speakerTag;
  let currentUtterance = `[Speaker ${currentSpeaker}]: `;
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // If speaker changes, start a new paragraph
    if (word.speakerTag !== currentSpeaker) {
      result += currentUtterance + "\n\n";
      currentSpeaker = word.speakerTag;
      currentUtterance = `[Speaker ${currentSpeaker}]: `;
    }
    
    // Add the word to the current utterance
    currentUtterance += word.word + " ";
    
    // If this is the last word, or there's a significant pause, end the utterance
    const nextWord = words[i + 1];
    if (!nextWord || 
        nextWord.speakerTag !== currentSpeaker ||
        (nextWord.startTime - word.endTime > 1.5)) {
      result += currentUtterance + "\n\n";
      
      if (nextWord && nextWord.speakerTag === currentSpeaker) {
        // Same speaker continues after a pause
        currentUtterance = `[Speaker ${currentSpeaker}]: `;
      }
    }
  }
  
  return result.trim();
};

// Map speaker numbers to roles (Doctor/Patient)
export const mapSpeakerRoles = (transcript: string): string => {
  if (!transcript) return "";
  
  // Simple heuristic: Usually the doctor speaks more, so we'll 
  // assume the speaker with the most content is the doctor
  const speakerLines: { [key: string]: string[] } = {};
  
  // Split into paragraphs and group by speaker
  transcript.split("\n\n").forEach(paragraph => {
    const match = paragraph.match(/^\[Speaker (\d+)\]:/);
    if (match) {
      const speakerNum = match[1];
      if (!speakerLines[speakerNum]) {
        speakerLines[speakerNum] = [];
      }
      speakerLines[speakerNum].push(paragraph);
    }
  });
  
  // Find the speaker with the most content (likely the doctor)
  let doctorSpeaker = "";
  let maxLength = 0;
  
  for (const speaker in speakerLines) {
    const totalLength = speakerLines[speaker].join(" ").length;
    if (totalLength > maxLength) {
      maxLength = totalLength;
      doctorSpeaker = speaker;
    }
  }
  
  // Replace speaker numbers with roles
  let mappedTranscript = transcript;
  for (const speaker in speakerLines) {
    const role = speaker === doctorSpeaker ? "Doctor" : "Patient";
    const pattern = new RegExp(`\\[Speaker ${speaker}\\]:`, "g");
    mappedTranscript = mappedTranscript.replace(pattern, `[${role}]:`);
  }
  
  return mappedTranscript;
};
