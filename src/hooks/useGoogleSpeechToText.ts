import { useState, useRef, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { 
  processMediaStream, 
  GoogleSpeechResult, 
  detectLanguageFromTranscript, 
  languageCodeMap,
  streamMediaToGoogleSpeech
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
  const processingRef = useRef<boolean>(false);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamCleanupRef = useRef<(() => void) | null>(null);
  
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
      processingRef.current = false;
      
      // Request microphone permission with enhanced settings
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000 // Request 48kHz sample rate for OPUS codec
        } 
      });
      
      mediaStreamRef.current = stream;
      
      // Setup streaming to Google Speech API
      const cleanupFn = streamMediaToGoogleSpeech(stream, apiKey, (result) => {
        if (result.error) {
          console.error('Stream processing error:', result.error);
          return;
        }
        
        // Skip empty results
        if (!result.transcript && !result.error) {
          console.log('Empty transcript received, skipping');
          return;
        }
        
        // Update last speech time when we get results
        lastSpeechTimeRef.current = Date.now();
        
        // Send the streaming result directly to the callback
        onResult({
          transcript: result.transcript,
          isFinal: result.isFinal,
          resultIndex: result.resultIndex || 0,
          speakerTag: typeof result.speakerTag === 'number' ? result.speakerTag : undefined
        });
      });
      
      streamCleanupRef.current = cleanupFn;
      
      // Setup silence detection
      setupSilenceDetection();
      setIsRecording(true);
      
      // Signal successful start
      console.log("Recording started with Google Speech-to-Text (Real-time mode)");
      toast.success("Started recording with Google Speech-to-Text");
      
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (streamCleanupRef.current) {
      streamCleanupRef.current();
      streamCleanupRef.current = null;
    }
    
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    
    if (mediaStreamRef.current) {
      // Stop all audio tracks
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    if (recordingTimeoutRef.current) {
      clearInterval(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    
    setIsRecording(false);
    processingRef.current = false;
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
