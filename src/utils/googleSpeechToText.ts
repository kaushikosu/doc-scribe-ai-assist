
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
  speakerTag?: number; // For speaker diarization
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

// Process media stream to get audio data
export const processMediaStream = async (stream: MediaStream, apiKey: string): Promise<GoogleSpeechResult[]> => {
  try {
    console.log("Processing media stream with Google Speech API");
    
    // Create a media recorder to capture audio
    const mediaRecorder = new MediaRecorder(stream, { 
      // Use lower bitrate for better transmission
      audioBitsPerSecond: 16000 
    });
    const audioChunks: Blob[] = [];
    
    return new Promise((resolve, reject) => {
      // Collect audio data
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };
      
      // Once recording stops, process the audio
      mediaRecorder.onstop = async () => {
        try {
          // Check if we have any audio data
          if (audioChunks.length === 0) {
            console.log("No audio chunks collected");
            resolve([]);
            return;
          }
          
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          console.log(`Collected audio: ${audioBlob.size} bytes`);
          
          if (audioBlob.size < 100) {
            console.log("Audio too small, skipping");
            resolve([]);
            return;
          }
          
          const base64Audio = await blobToBase64(audioBlob);
          
          const recognitionConfig: RecognitionConfig = {
            encoding: "LINEAR16",
            sampleRateHertz: 16000,
            languageCode: "en-US",
            alternativeLanguageCodes: ["hi-IN", "te-IN"],
            enableAutomaticPunctuation: true,
            enableSpeakerDiarization: true,
            diarizationSpeakerCount: 2, // Assuming doctor and patient
            model: "command_and_search", // Using a more general model since medical might not be available
            useEnhanced: true
          };
          
          const request: SpeechRecognitionRequest = {
            config: recognitionConfig,
            audio: { content: base64Audio }
          };
          
          console.log("Sending request to Google Speech API");
          
          // Send request to Google Cloud Speech-to-Text API
          const response = await fetch(`${GOOGLE_SPEECH_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
          });
          
          // Check for non-OK response
          if (!response.ok) {
            const errorData = await response.json();
            console.error("Google Speech API error response:", errorData);
            const errorMessage = errorData.error?.message || 'Unknown error';
            toast.error(`Speech API error: ${errorMessage}`);
            throw new Error(`Google Speech API error: ${errorMessage}`);
          }
          
          const data = await response.json();
          console.log("Google Speech API response:", data);
          
          // Process and format results
          const results: GoogleSpeechResult[] = [];
          
          // If no results or empty results, return empty array
          if (!data.results || data.results.length === 0) {
            console.log("No results from Google Speech API");
            // Return a default result for debugging
            results.push({
              transcript: "Listening...",
              confidence: 1.0,
              isFinal: false
            });
            resolve(results);
            return;
          }
          
          // Process results from the API
          data.results.forEach((result: any) => {
            const alternatives = result.alternatives || [];
            
            alternatives.forEach((alternative: any) => {
              const transcript = alternative.transcript || '';
              const confidence = alternative.confidence || 0;
              
              // If speaker diarization is enabled and we have word-level info
              if (result.alternatives[0].words && result.alternatives[0].words.length > 0) {
                // Group by speaker tag
                const speakerSegments: { [key: number]: string[] } = {};
                
                result.alternatives[0].words.forEach((word: any) => {
                  const speakerTag = word.speakerTag || 0;
                  if (!speakerSegments[speakerTag]) {
                    speakerSegments[speakerTag] = [];
                  }
                  speakerSegments[speakerTag].push(word.word);
                });
                
                // Create a result for each speaker
                Object.entries(speakerSegments).forEach(([speakerTag, words]) => {
                  results.push({
                    transcript: words.join(' '),
                    confidence,
                    isFinal: true,
                    speakerTag: parseInt(speakerTag, 10)
                  });
                });
              } else {
                // No speaker diarization, just use the transcript
                results.push({
                  transcript,
                  confidence,
                  isFinal: true
                });
              }
            });
          });
          
          resolve(results);
        } catch (error) {
          console.error('Error processing audio:', error);
          reject(error);
        }
      };
      
      // Start recording audio
      mediaRecorder.start();
      
      // Record for 3 seconds (shorter for quicker feedback)
      setTimeout(() => {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      }, 3000);
    });
  } catch (error) {
    console.error('Error setting up media recorder:', error);
    toast.error('Failed to start audio recording. Please check your microphone settings.');
    return [{
      transcript: "Error: Failed to access microphone",
      confidence: 0,
      isFinal: true
    }];
  }
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
