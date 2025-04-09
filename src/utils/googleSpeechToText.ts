
import { toast } from "@/lib/toast";

// Google Cloud Speech API base URL
const GOOGLE_SPEECH_API_URL = "https://speech.googleapis.com/v1p1beta1/speech:recognize";

// Maximum recommended size for direct API upload (approximately 1MB)
const MAX_RECOMMENDED_AUDIO_SIZE = 900000; // 900KB to stay under Google's ~1MB limit
const MAX_CHUNK_DURATION_MS = 60000; // 60 seconds per chunk

// Configuration for speech recognition
interface RecognitionConfig {
  encoding: string;
  sampleRateHertz: number; 
  languageCode: string;
  enableAutomaticPunctuation?: boolean;
  enableSpeakerDiarization?: boolean;
  diarizationSpeakerCount?: number;
  model?: string;
  useEnhanced?: boolean;
  maxAlternatives?: number;
}

interface SpeechRecognitionRequest {
  config: RecognitionConfig;
  audio: {
    content: string;
  };
}

export interface GoogleSpeechResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  resultIndex?: number;
  speakerTag?: number; // For speaker diarization
  error?: string;
}

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

// Estimate audio duration from blob size and type
export const estimateAudioDuration = (blob: Blob): number => {
  // For WEBM Opus, rough estimate based on typical bitrates
  // Using a conservative estimate of 32 kbps
  const bitRate = 32000; // bits per second
  const bitsPerByte = 8;
  
  // Calculate duration in seconds
  const durationSec = (blob.size * bitsPerByte) / bitRate;
  
  // Return duration in milliseconds
  return durationSec * 1000;
};

// Split audio blob into manageable chunks for API processing
export const splitAudioIntoChunks = async (audioBlob: Blob): Promise<Blob[]> => {
  // If audio is already small enough, return as a single chunk
  if (audioBlob.size <= MAX_RECOMMENDED_AUDIO_SIZE) {
    return [audioBlob];
  }
  
  console.log(`Audio size (${audioBlob.size} bytes) exceeds recommended limit. Splitting into chunks...`);
  
  // Estimate the number of chunks needed
  const estimatedChunks = Math.ceil(audioBlob.size / MAX_RECOMMENDED_AUDIO_SIZE);
  const estimatedChunkSize = Math.ceil(audioBlob.size / estimatedChunks);
  
  const audioDuration = estimateAudioDuration(audioBlob);
  const durationPerChunk = audioDuration / estimatedChunks;
  
  console.log(`Estimated ${estimatedChunks} chunks needed, ${durationPerChunk.toFixed(1)}ms per chunk`);
  
  // Use MediaRecorder to actually split the audio
  // For now, we'll use a simpler approach - return the whole blob as one chunk
  // In a real implementation, you would need to use Web Audio API to split the audio properly
  
  // Placeholder for actual audio splitting
  const chunks: Blob[] = [];
  
  try {
    // Create an audio element to decode the blob
    const audioElement = new Audio();
    const audioUrl = URL.createObjectURL(audioBlob);
    audioElement.src = audioUrl;
    
    // Wait for audio to load metadata
    await new Promise((resolve) => {
      audioElement.addEventListener('loadedmetadata', resolve);
      audioElement.addEventListener('error', () => {
        console.error('Error loading audio metadata');
        resolve(null);
      });
    });
    
    // Use blob slicing as a crude approximation
    // Note: This doesn't respect audio packet boundaries and may corrupt the audio
    // A proper implementation would use Web Audio API to split cleanly
    const chunkSize = Math.ceil(audioBlob.size / estimatedChunks);
    
    for (let i = 0; i < estimatedChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min((i + 1) * chunkSize, audioBlob.size);
      
      // Use slice to get chunk
      const chunk = audioBlob.slice(start, end, audioBlob.type);
      chunks.push(chunk);
      
      console.log(`Created chunk ${i+1}/${estimatedChunks}, size: ${chunk.size} bytes`);
    }
    
    // Clean up
    URL.revokeObjectURL(audioUrl);
    
  } catch (error) {
    console.error('Error splitting audio:', error);
    // Fallback to single chunk
    chunks.push(audioBlob);
  }
  
  return chunks.length > 0 ? chunks : [audioBlob];
};

// Check if audio size might be too large for direct API processing
const shouldSplitAudio = (audioSize: number): boolean => {
  return audioSize > MAX_RECOMMENDED_AUDIO_SIZE;
};

// Process audio blob directly - used for chunk-based processing
export const processMediaStream = async (audioData: Blob, apiKey: string): Promise<GoogleSpeechResult[]> => {
  try {
    console.log(`Processing audio blob: ${audioData.size} bytes`);
    
    if (!audioData || !apiKey) {
      console.log("Invalid audio data or API key");
      return [{
        transcript: "Error: Missing audio data or API key",
        confidence: 0,
        isFinal: true,
        error: "Missing audio data or API key"
      }];
    }
    
    // Skip very small audio chunks that likely don't contain speech
    if (audioData.size < 50) {
      console.log("Audio too small, skipping");
      return [];
    }
    
    // Check if audio might be too large for direct API processing
    if (shouldSplitAudio(audioData.size)) {
      console.warn(`Audio size (${audioData.size} bytes) exceeds recommended limit of ${MAX_RECOMMENDED_AUDIO_SIZE} bytes`);
      console.log("Consider using diarizedTranscription.ts for large audio files");
      // Continue with processing anyway, but log warning
    }
    
    const base64Audio = await blobToBase64(audioData);
    console.log("Audio converted to base64, length:", base64Audio.length);
    
    // Configure with diarization settings
    const recognitionConfig: RecognitionConfig = {
      encoding: "WEBM_OPUS",
      sampleRateHertz: 48000,
      languageCode: "en-US",
      enableAutomaticPunctuation: true,
      enableSpeakerDiarization: true, // Enable speaker diarization
      diarizationSpeakerCount: 2,     // Expecting 2 speakers (doctor & patient)
      model: "latest_short", // Use latest_short for better compatibility with short segments
      useEnhanced: true,
      maxAlternatives: 1
    };
    
    const request: SpeechRecognitionRequest = {
      config: recognitionConfig,
      audio: { content: base64Audio }
    };
    
    console.log("Sending request to Google Speech API with diarization enabled");
    
    // Send request to Google Cloud Speech-to-Text API
    const response = await fetch(`${GOOGLE_SPEECH_API_URL}?key=${apiKey}`, {
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
      
      // Log the error with more details
      console.error(`API error (${response.status}): ${errorMessage}`);
      console.error("Request config:", JSON.stringify({
        ...request,
        audio: { content: "base64_content_truncated" } // Don't log the entire content
      }));
      
      // Don't show toast for "no speech" - this is a normal case
      if (!errorMessage.includes("no speech") && !errorMessage.includes("No speech")) {
        toast.error(`Speech API error: ${errorMessage}`);
      } else {
        console.log("No speech detected in audio, suppressing error toast");
      }
      
      return [{
        transcript: `Error: ${errorMessage}`,
        confidence: 0,
        isFinal: true,
        error: errorMessage
      }];
    }
    
    const data = await response.json();
    console.log("Google Speech API response:", data);
    
    // Process and format results with speaker diarization
    const results: GoogleSpeechResult[] = [];
    
    if (!data.results || data.results.length === 0) {
      console.log("No results from Google Speech API");
      return [];
    }
    
    // Process diarization results
    let speakerResults = new Map<number, string[]>();
    
    // First extract all words with speaker tags
    data.results.forEach((result: any) => {
      if (result.alternatives && 
          result.alternatives[0] && 
          result.alternatives[0].words) {
            
        result.alternatives[0].words.forEach((word: any) => {
          const speakerTag = word.speakerTag || 0;
          if (!speakerResults.has(speakerTag)) {
            speakerResults.set(speakerTag, []);
          }
          speakerResults.get(speakerTag)!.push(word.word);
        });
      }
    });
    
    // If we got speaker-tagged words, create results for each speaker
    if (speakerResults.size > 0) {
      console.log("Speaker diarization results:", Array.from(speakerResults.entries()));
      
      // For each speaker, create a result with their transcript
      speakerResults.forEach((words, speakerTag) => {
        if (words.length > 0) {
          const speakerTranscript = words.join(' ');
          results.push({
            transcript: speakerTranscript,
            confidence: 0.9, // Approximate confidence
            isFinal: true,
            speakerTag: speakerTag
          });
        }
      });
    } else {
      // Fallback to normal transcript processing if no speaker tags
      data.results.forEach((result: any, resultIndex: number) => {
        if (result.alternatives && result.alternatives.length > 0) {
          const transcript = result.alternatives[0].transcript || '';
          const confidence = result.alternatives[0].confidence || 0;
          
          if (transcript.trim() !== '') {
            results.push({
              transcript,
              confidence,
              isFinal: true,
              resultIndex
            });
          }
        }
      });
    }
    
    return results;
  } catch (error: any) {
    console.error('Error processing audio:', error);
    
    // Only show toast for serious errors, not "no speech detected" which is normal
    if (!error.message?.includes("no speech") && !error.message?.includes("No speech")) {
      toast.error('Failed to process audio. Please try again.');
    }
    
    return [{
      transcript: "Error: Failed to process audio",
      confidence: 0,
      isFinal: true,
      error: error.message
    }];
  }
};

// Streaming audio to Google Speech API with diarization
export const streamMediaToGoogleSpeech = (stream: MediaStream, apiKey: string, callback: (result: GoogleSpeechResult) => void) => {
  if (!stream || !apiKey) {
    console.error("Invalid stream or API key for streaming");
    return () => {};
  }
  
  console.log("Setting up streaming to Google Speech API with diarization");
  
  // Create a media recorder for capturing audio chunks
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'audio/webm;codecs=opus',
    audioBitsPerSecond: 48000
  });
  
  let processingChunk = false;
  let chunkIndex = 0;
  let noResultsCounter = 0;
  
  mediaRecorder.ondataavailable = async (event) => {
    if (event.data.size > 0 && !processingChunk) {
      processingChunk = true;
      
      try {
        // Always send a "Processing..." message for better real-time feedback
        callback({
          transcript: "Processing...",
          confidence: 0.5,
          isFinal: false,
          resultIndex: chunkIndex
        });
        
        const results = await processMediaStream(event.data, apiKey);
        
        if (results.length > 0) {
          // We have actual transcription results
          noResultsCounter = 0;
          
          // Send each result through callback
          results.forEach((result) => {
            callback({
              ...result,
              resultIndex: chunkIndex
            });
          });
        } else {
          // Count consecutive empty responses
          noResultsCounter++;
          
          // If we're getting repeated empty responses, send a feedback message
          if (noResultsCounter > 2) {
            callback({
              transcript: "Listening...",
              confidence: 0.5,
              isFinal: false,
              resultIndex: chunkIndex
            });
          }
        }
        
        chunkIndex++;
      } catch (error: any) {
        console.error("Error in stream processing:", error);
        callback({
          transcript: "Error processing speech",
          confidence: 0,
          isFinal: false,
          resultIndex: chunkIndex,
          error: error.message
        });
      } finally {
        processingChunk = false;
      }
    }
  };
  
  // Start recording with shorter time slices for more responsive feel
  mediaRecorder.start(800); // Process every 800ms for better balance of responsiveness and API calls
  
  // Return a cleanup function
  return () => {
    mediaRecorder.stop();
  };
};

// Maps Google Speech API language codes to our simplified language codes
export const languageCodeMap: { [key: string]: string } = {
  'en-US': 'en-IN',
  'en-GB': 'en-IN',
  'en-IN': 'en-IN',
  'hi-IN': 'hi-IN',
  'te-IN': 'te-IN'
};

// Detect language from transcript content
export const detectLanguageFromTranscript = (transcript: string): string => {
  // Simple language detection based on common words
  // Hindi detection
  const hindiWords = ['नमस्ते', 'आप', 'कैसे', 'है', 'धन्यवाद', 'दर्द', 'दवा'];
  const containsHindi = hindiWords.some(word => transcript.includes(word));
  if (containsHindi) return 'hi-IN';
  
  // Telugu detection 
  const teluguWords = ['నమస్కారం', 'మీరు', 'ఎలా', 'ఉన్నారు', 'ధన్యవాదాలు'];
  const containsTelugu = teluguWords.some(word => transcript.includes(word));
  if (containsTelugu) return 'te-IN';
  
  // Default to English
  return 'en-IN';
};
