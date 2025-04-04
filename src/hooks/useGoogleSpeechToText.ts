
import { useState, useRef, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { 
  processMediaStream, 
  GoogleSpeechResult, 
  detectLanguageFromTranscript, 
  languageCodeMap 
} from '@/utils/googleSpeechToText';
import { detectSpeaker } from '@/utils/speakerDetection';

interface UseGoogleSpeechToTextProps {
  onResult: (result: { 
    transcript: string, 
    isFinal: boolean, 
    resultIndex: number,
    speakerTag?: number 
  }) => void;
  onSilence: () => void;
  pauseThreshold: number;
  apiKey: string;
}

const useGoogleSpeechToText = ({ 
  onResult, 
  onSilence,
  pauseThreshold,
  apiKey
}: UseGoogleSpeechToTextProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<string>("en-IN");
  
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Store the complete transcript with proper line breaks between utterances
  const accumulatedTranscriptRef = useRef<string>('');
  
  // Track all results to avoid processing duplicates
  const processedResultsMapRef = useRef<Map<number, boolean>>(new Map());
  
  // Keep reference to the current recording session
  const sessionIdRef = useRef<string>(Date.now().toString());
  
  // For debugging purposes
  useEffect(() => {
    console.log("useGoogleSpeechToText initialized with apiKey:", apiKey ? "API key provided" : "No API key");
  }, [apiKey]);
  
  // Setup silence detection
  const setupSilenceDetection = () => {
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
    }

    silenceTimerRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastSpeech = now - lastSpeechTimeRef.current;
      
      // If silence longer than threshold, trigger callback
      if (timeSinceLastSpeech > pauseThreshold && isRecording) {
        console.log("Silence detected, triggering speaker change");
        onSilence();
        lastSpeechTimeRef.current = now; // Reset the timer
      }
    }, 200);
  };

  const startRecording = async () => {
    if (!apiKey) {
      toast.error("Google Cloud Speech API key is not configured");
      return;
    }
    
    try {
      // Generate new session ID when starting recording
      sessionIdRef.current = Date.now().toString();
      processedResultsMapRef.current.clear();
      accumulatedTranscriptRef.current = '';
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      // Setup silence detection
      setupSilenceDetection();
      setIsRecording(true);
      
      // Signal successful start
      console.log("Recording started with Google Speech-to-Text");
      toast.success(`Started recording with Google Speech-to-Text`);
      
      // Add a simple initial result to verify the onResult callback is working
      onResult({
        transcript: "Initializing Google Speech API...",
        isFinal: false,
        resultIndex: -1
      });
      
      // Start continuous processing
      processContinuously();
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to access microphone. Please check permissions.');
    }
  };

  const processContinuously = async () => {
    if (!isRecording || !mediaStreamRef.current || !apiKey) {
      console.log("Cannot process: recording state:", isRecording, "stream:", !!mediaStreamRef.current, "api key:", !!apiKey);
      return;
    }
    
    try {
      console.log("Processing audio with Google Speech API");
      
      // Process audio stream and get results
      const results = await processMediaStream(mediaStreamRef.current, apiKey);
      console.log("Google Speech API returned results:", results);
      
      // Update last speech time
      if (results.length > 0) {
        lastSpeechTimeRef.current = Date.now();
      }
      
      // Handle results
      results.forEach((result, index) => {
        // Detect language from transcript
        const newLanguage = detectLanguageFromTranscript(result.transcript);
        if (newLanguage !== detectedLanguage) {
          setDetectedLanguage(newLanguage);
        }
        
        // Add to accumulated transcript
        if (result.isFinal) {
          if (accumulatedTranscriptRef.current && !accumulatedTranscriptRef.current.endsWith('\n')) {
            accumulatedTranscriptRef.current += '\n';
          }
          accumulatedTranscriptRef.current += result.transcript;
        }
        
        // Send result to callback with full details
        onResult({
          transcript: result.transcript,
          isFinal: result.isFinal,
          resultIndex: index,
          speakerTag: result.speakerTag
        });
      });
      
      // If we have no results but are still recording, simulate getting a result
      // This helps detect if the API is working but not returning expected results
      if (results.length === 0 && isRecording) {
        console.log("No results from Google Speech API, but still recording");
        // Try again in 2 seconds
        setTimeout(() => {
          if (isRecording) {
            processContinuously();
          }
        }, 2000);
      } else if (isRecording) {
        // Continue processing immediately if we got results
        processContinuously();
      }
    } catch (error) {
      console.error('Error during speech processing:', error);
      // Send the error to the callback for debugging
      onResult({
        transcript: `Error: ${error.message || 'Unknown error processing speech'}`,
        isFinal: false,
        resultIndex: -2
      });
      
      if (isRecording) {
        toast.error('Error processing speech. Restarting...');
        // Wait a bit before trying again
        setTimeout(() => {
          if (isRecording) {
            processContinuously();
          }
        }, 3000);
      }
    }
  };

  const stopRecording = () => {
    if (mediaStreamRef.current) {
      // Stop all audio tracks
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    setIsRecording(false);
    console.log("Recording stopped");
    toast.success('Recording stopped');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  return {
    isRecording,
    detectedLanguage,
    startRecording,
    stopRecording,
    toggleRecording: () => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    },
    // Expose the accumulated transcript
    getAccumulatedTranscript: () => accumulatedTranscriptRef.current,
    resetTranscript: () => {
      accumulatedTranscriptRef.current = '';
    }
  };
};

export default useGoogleSpeechToText;
