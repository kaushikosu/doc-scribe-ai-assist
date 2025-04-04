
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { toast } from "@/lib/toast";

export interface AzureSpeechResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  resultIndex?: number;
  speakerTag?: number;
  error?: string;
}

export interface SpeakerProfile {
  id: number;
  name: string;
}

// Maps Azure language codes to our simplified language codes
export const languageCodeMap: { [key: string]: string } = {
  'en-US': 'en-IN',
  'en-GB': 'en-IN',
  'en-IN': 'en-IN',
  'hi-IN': 'hi-IN',
  'te-IN': 'te-IN'
};

// Enhanced language detection
export const detectLanguageFromTranscript = (transcript: string): string => {
  // Telugu detection - improved with more Telugu character detection
  const teluguPattern = /[\u0C00-\u0C7F]/;
  if (teluguPattern.test(transcript)) {
    console.log("Telugu script detected in text");
    return 'te-IN';
  }
  
  // Hindi detection - check for Devanagari script
  const hindiPattern = /[\u0900-\u097F]/;
  if (hindiPattern.test(transcript)) {
    return 'hi-IN';
  }
  
  // Alternative Telugu pattern matching for common words
  const teluguWords = ['నమస్కారం', 'మీరు', 'ఎలా', 'ఉన్నారు', 'ధన్యవాదాలు', 'అవును', 'కాదు', 'సరే'];
  const containsTelugu = teluguWords.some(word => transcript.includes(word));
  if (containsTelugu) {
    console.log("Telugu words detected in text");
    return 'te-IN';
  }
  
  // Default to English
  return 'en-IN';
};

// Function to start Azure speech recognition with improved speaker separation
export const startAzureSpeechRecognition = (
  apiKey: string,
  region: string,
  callback: (result: AzureSpeechResult) => void,
  onSilenceDetected: () => void,
  silenceThreshold: number = 1500,
  languageCode: string = 'en-IN'
): (() => void) => {
  if (!apiKey || !region) {
    toast.error("Azure Speech key or region not configured");
    return () => {};
  }

  console.log("Setting up Azure Speech Recognition with language:", languageCode);
  
  // Azure Speech SDK setup
  const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(apiKey, region);
  
  // Set recognition language explicitly
  speechConfig.speechRecognitionLanguage = languageCode;
  
  // Enable detailed output format to get confidence and other data
  speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed;
  
  // Enable dictation mode for more natural speech recognition
  speechConfig.enableDictation();
  
  // IMPORTANT: Configure for speaker separation
  // This enables speaker separation in the speech recognizer
  try {
    // Enable speaker diarization
    speechConfig.setProperty("SpeechServiceResponse_OptimizeForConversation", "true");
    // Fix: Changed to the proper property name available in the SDK
    speechConfig.setProperty("SpeechServiceConnection_EnableVoiceProfileIdentification", "true");
    speechConfig.setProperty("Conversation_SpeakerDiarizationEnabled", "true");
    speechConfig.setProperty("DifferentiateGenders", "true");
    
    // The following settings help with speaker diarization quality
    speechConfig.setProperty("SpeakerDiarization_MinimumSpeakers", "2");  // We expect at least 2 speakers
    speechConfig.setProperty("SpeakerDiarization_MaximumSpeakers", "2");  // And no more than 2 speakers
    
    console.log("Speaker diarization enabled with enhanced settings");
  } catch (error) {
    console.error("Error configuring speaker diarization:", error);
  }
  
  // Set up audio configuration for microphone input
  const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
  
  // Create recognizer
  const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
  
  // Track silence for speaker turn detection
  let lastSpeechTimestamp = Date.now();
  const silenceInterval = setInterval(() => {
    const now = Date.now();
    if (now - lastSpeechTimestamp > silenceThreshold) {
      console.log("Azure: Silence detected");
      onSilenceDetected();
      lastSpeechTimestamp = now; // Reset the timer
    }
  }, 200);
  
  // Set up event handler for when speech starts being detected
  recognizer.recognizing = (s, e) => {
    // Update silence detector timestamp
    lastSpeechTimestamp = Date.now();
    
    // Skip empty results
    if (!e.result.text || e.result.text.trim() === "") {
      return;
    }

    // Process interim results
    callback({
      transcript: e.result.text,
      confidence: 0.5, // Default confidence for interim results
      isFinal: false,
      resultIndex: e.sessionId ? parseInt(e.sessionId.substring(0, 8), 16) % 1000 : 0
    });
  };

  // Set up event handler for final recognition results
  recognizer.recognized = (s, e) => {
    // Update silence detector timestamp
    lastSpeechTimestamp = Date.now();
    
    // Handle errors from the recognition service
    if (e.result.reason === SpeechSDK.ResultReason.NoMatch) {
      console.log("NOMATCH: Speech could not be recognized.");
      return;
    }
    
    // Skip empty results
    if (!e.result.text || e.result.text.trim() === "") {
      return;
    }
    
    try {
      // For final results, try to extract more detailed information
      let confidence = 0.8; // Default confidence if not available from Azure
      let speakerTag = undefined; // Default speaker tag
      
      // Try to get the detailed output with confidence scores and speaker info
      const resultJson = JSON.parse(e.result.properties.getProperty(SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult));
      
      console.log("Azure detailed result:", JSON.stringify(resultJson, null, 2));
      
      if (resultJson.NBest && resultJson.NBest.length > 0) {
        // Use the highest confidence alternative
        confidence = resultJson.NBest[0].Confidence || 0.8;
        
        // Check if speaker information is available
        if (resultJson.NBest[0].SpeakerId !== undefined) {
          speakerTag = parseInt(resultJson.NBest[0].SpeakerId);
          console.log("Azure detected speaker:", speakerTag);
        } else if (resultJson.SpeakerId !== undefined) {
          speakerTag = parseInt(resultJson.SpeakerId);
          console.log("Azure detected speaker from root:", speakerTag);
        }
        
        // Try alternative speaker ID properties
        if (speakerTag === undefined) {
          // Fix: Use the correct property ID from the SDK
          // Remove the line causing the error and use different approach to get speaker info
          if (resultJson.Speaker !== undefined) {
            try {
              speakerTag = parseInt(resultJson.Speaker);
              console.log("Azure speaker from properties:", speakerTag);
            } catch (error) {
              console.log("Error parsing speaker ID:", error);
            }
          }
        }
      }
      
      // Auto-detect language if not explicitly set or language changed mid-stream
      const detectedLang = detectLanguageFromTranscript(e.result.text);
      if (detectedLang !== languageCode) {
        // This will help update the UI but won't change current recognition session
        console.log(`Language changed from ${languageCode} to ${detectedLang}`);
      }
      
      // Send the final result to the callback
      callback({
        transcript: e.result.text,
        confidence: confidence,
        isFinal: true,
        resultIndex: e.sessionId ? parseInt(e.sessionId.substring(0, 8), 16) % 1000 : 0,
        speakerTag: speakerTag
      });
    } catch (error) {
      console.error("Error processing recognition result:", error);
      callback({
        transcript: e.result.text, 
        confidence: 0.5,
        isFinal: true,
        resultIndex: 0,
        error: "Error processing recognition details"
      });
    }
  };

  // Set up error handler
  recognizer.canceled = (s, e) => {
    if (e.reason === SpeechSDK.CancellationReason.Error) {
      console.error(`Error: ${e.errorCode} - ${e.errorDetails}`);
      callback({
        transcript: "Speech recognition error",
        confidence: 0,
        isFinal: true,
        error: e.errorDetails
      });
    }
  };

  // Start continuous recognition
  recognizer.startContinuousRecognitionAsync(
    () => console.log("Azure speech recognition started"),
    (err) => console.error("Error starting speech recognition:", err)
  );
  
  // Return a cleanup function
  return () => {
    clearInterval(silenceInterval);
    recognizer.stopContinuousRecognitionAsync(
      () => {
        console.log("Azure speech recognition stopped");
        recognizer.close();
      },
      (err) => console.error("Error stopping speech recognition:", err)
    );
  };
};
