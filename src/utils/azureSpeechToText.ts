
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

// Simple language detection based on content
export const detectLanguageFromTranscript = (transcript: string): string => {
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

// Function to start Azure speech recognition
export const startAzureSpeechRecognition = (
  apiKey: string,
  region: string,
  callback: (result: AzureSpeechResult) => void,
  onSilenceDetected: () => void,
  silenceThreshold: number = 1500
): (() => void) => {
  if (!apiKey || !region) {
    toast.error("Azure Speech key or region not configured");
    return () => {};
  }

  console.log("Setting up Azure Speech Recognition");
  
  // Azure Speech SDK setup
  const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(apiKey, region);
  
  // Set speech recognition language to English (can be dynamically changed)
  speechConfig.speechRecognitionLanguage = "en-IN";
  
  // Enable detailed output format to get confidence and other data
  speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed;
  
  // Enable continuous recognition
  speechConfig.enableDictation();
  
  // Set up audio configuration for microphone input
  const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
  
  // Create recognizer with enhanced settings 
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
      
      // Try to get the detailed output with confidence scores
      const resultJson = JSON.parse(e.result.properties.getProperty(SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult));
      
      if (resultJson.NBest && resultJson.NBest.length > 0) {
        // Use the highest confidence alternative
        confidence = resultJson.NBest[0].Confidence || 0.8;
      }
      
      // Analyze the text to detect speaker change
      // This is a simplified approach as Azure doesn't provide speaker diarization out-of-the-box
      // In a real implementation, you might want to use additional logic here
      
      // Send the final result to the callback
      callback({
        transcript: e.result.text,
        confidence: confidence,
        isFinal: true,
        resultIndex: e.sessionId ? parseInt(e.sessionId.substring(0, 8), 16) % 1000 : 0,
        // We can't get speaker tags directly from Azure without custom logic
        speakerTag: undefined
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
