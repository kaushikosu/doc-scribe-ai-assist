
import { useState, useRef, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { 
  processMediaStream, 
  GoogleSpeechResult, 
  detectLanguageFromTranscript, 
  languageCodeMap,
  streamMediaToGoogleSpeech
} from '@/utils/googleSpeechToText';

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
  
  const accumulatedTranscriptRef = useRef<string>('');
  const processedResultsMapRef = useRef<Map<number, boolean>>(new Map());
  const sessionIdRef = useRef<string>(Date.now().toString());
  
  useEffect(() => {
    console.log("useGoogleSpeechToText initialized with apiKey:", apiKey ? "API key provided" : "No API key");
  }, [apiKey]);
  
  const setupSilenceDetection = () => {
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
    }

    silenceTimerRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastSpeech = now - lastSpeechTimeRef.current;
      
      if (timeSinceLastSpeech > pauseThreshold && isRecording) {
        console.log("Silence detected, triggering speaker change");
        onSilence();
        lastSpeechTimeRef.current = now;
      }
    }, 200);
  };

  const startRecording = async () => {
    if (!apiKey) {
      toast.error("Google Cloud Speech API key is not configured");
      return;
    }
    
    try {
      sessionIdRef.current = Date.now().toString();
      processedResultsMapRef.current.clear();
      accumulatedTranscriptRef.current = '';
      processingRef.current = false;
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000
        } 
      });
      
      mediaStreamRef.current = stream;
      
      // Enable diarization in the Google Speech API call
      const cleanupFn = streamMediaToGoogleSpeech(stream, apiKey, (result) => {
        if (result.error) {
          // Check if it's a size limitation error
          if (result.error.includes("too long") || result.error.includes("LongRunningRecognize")) {
            console.log("Stream chunk too large for sync API, will use LongRunningRecognize for final processing");
            // Don't show error, as we'll handle this in the final processing
            return;
          }
          
          console.error('Stream processing error:', result.error);
          return;
        }
        
        if (!result.transcript && !result.error) {
          console.log('Empty transcript received, skipping');
          return;
        }
        
        lastSpeechTimeRef.current = Date.now();
        
        // Process the result with speaker tag if available
        onResult({
          transcript: result.transcript,
          isFinal: result.isFinal,
          resultIndex: result.resultIndex || 0,
          speakerTag: result.speakerTag
        });
      });
      
      streamCleanupRef.current = cleanupFn;
      setupSilenceDetection();
      setIsRecording(true);
      
      console.log("Recording started with Google Speech-to-Text (Diarization enabled)");
      toast.success("Started recording with Google diarization");
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
    getAccumulatedTranscript: () => accumulatedTranscriptRef.current,
    resetTranscript: () => {
      accumulatedTranscriptRef.current = '';
    }
  };
};

export default useGoogleSpeechToText;
