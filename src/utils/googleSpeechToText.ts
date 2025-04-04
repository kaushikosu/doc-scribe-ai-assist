
import { toast } from "@/lib/toast";

// Google Cloud Speech API base URL
const GOOGLE_SPEECH_API_URL = "https://speech.googleapis.com/v1p1beta1/speech:recognize";

// Configuration for speech recognition
interface RecognitionConfig {
  encoding: string;
  sampleRateHertz: number; 
  languageCode: string;
  alternativeLanguageCodes?: string[];
  enableAutomaticPunctuation?: boolean;
  enableSpeakerDiarization?: boolean;
  diarizationSpeakerCount?: number;
  model?: string;
  useEnhanced?: boolean;
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
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Process audio blob directly - used for chunk-based processing
export const processMediaStream = async (audioData: Blob, apiKey: string): Promise<GoogleSpeechResult[]> => {
  try {
    console.log(`Processing audio blob: ${audioData.size} bytes`);
    
    if (!audioData || !apiKey || audioData.size < 50) {
      console.log("Invalid audio data or API key or audio too small");
      return [];
    }
    
    const base64Audio = await blobToBase64(audioData);
    console.log("Audio converted to base64, length:", base64Audio.length);
    
    // Configure with explicit diarization settings
    const recognitionConfig: RecognitionConfig = {
      encoding: "WEBM_OPUS",
      sampleRateHertz: 48000,
      languageCode: "en-US",
      alternativeLanguageCodes: ["hi-IN", "te-IN"],
      enableAutomaticPunctuation: true,
      enableSpeakerDiarization: true, // Enable speaker diarization
      diarizationSpeakerCount: 2,     // Expecting 2 speakers (doctor & patient)
      model: "medical_conversation", // Use medical model if available, fallback to default
      useEnhanced: true
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
      toast.error(`Speech API error: ${errorMessage}`);
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
  } catch (error) {
    console.error('Error processing audio:', error);
    toast.error('Failed to process audio. Please try again.');
    return [{
      transcript: "Error: Failed to process audio",
      confidence: 0,
      isFinal: true,
      error: error.message
    }];
  }
};

// New function for streaming audio to Google Speech API with diarization
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
        // Only send "Processing..." for the first chunk or if we're getting several empty responses
        if (chunkIndex === 0 || noResultsCounter > 3) {
          callback({
            transcript: "Processing...",
            confidence: 0.5,
            isFinal: false,
            resultIndex: chunkIndex
          });
        }
        
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
  
  // Start recording with short time slices for more responsive feel
  mediaRecorder.start(2000); // Process every 2 seconds for better diarization
  
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
