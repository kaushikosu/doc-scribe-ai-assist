
import { useState, useRef, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { 
  streamAudioToDeepgram,
  ConnectionStatus,
  getSpeakerLabel
} from '@/utils/deepgramSpeechToText';

interface UseDeepgramSpeechToTextProps {
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

const useDeepgramSpeechToText = ({ 
  onResult, 
  onSilence,
  pauseThreshold,
  apiKey
}: UseDeepgramSpeechToTextProps) => {
  // State management
  const [isRecording, setIsRecording] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('closed');
  
  // References to maintain state between renders
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupFunctionRef = useRef<(() => void) | null>(null);
  const accumulatedTranscriptRef = useRef<string>('');
  const currentSessionIdRef = useRef<string>(Date.now().toString());
  
  // Effect to log API key availability
  useEffect(() => {
    console.log("useDeepgramSpeechToText initialized with API key:", apiKey ? "API key provided" : "No API key");
    return () => stopRecording();
  }, [apiKey]);
  
  // Set up silence detection timer
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

  // Handle Deepgram connection status changes
  const handleConnectionStatusChange = (status: ConnectionStatus) => {
    setConnectionStatus(status);
    
    // Show appropriate toast message
    if (status === 'open') {
      toast.success("Connected to Deepgram");
    } else if (status === 'failed') {
      toast.error("Failed to connect to Deepgram");
      stopRecording();
    } else if (status === 'closed') {
      if (isRecording) {
        toast.info("Deepgram connection closed");
      }
    }
  };
  
  // Start recording audio and streaming to Deepgram
  const startRecording = async () => {
    if (!apiKey) {
      toast.error("Deepgram API key is not configured");
      return;
    }
    
    try {
      // Generate new session ID
      currentSessionIdRef.current = Date.now().toString();
      accumulatedTranscriptRef.current = '';
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        } 
      });
      
      mediaStreamRef.current = stream;
      
      // Process speech result from Deepgram
      const handleSpeechResult = (result: {
        transcript: string,
        isFinal: boolean,
        resultIndex: number,
        speakerTag?: number,
        error?: string
      }) => {
        if (result.error) {
          console.error('Deepgram error:', result.error);
          return;
        }
        
        if (!result.transcript && !result.error) {
          return;
        }
        
        // Reset silence detection timer
        lastSpeechTimeRef.current = Date.now();
        
        // Get formatted transcript with speaker label
        let formattedTranscript = result.transcript;
        if (result.speakerTag) {
          const speakerLabel = getSpeakerLabel(result.speakerTag);
          if (speakerLabel) {
            formattedTranscript = `[${speakerLabel}]: ${result.transcript}`;
          }
        }
        
        // Send result to callback
        onResult({
          transcript: formattedTranscript,
          isFinal: result.isFinal,
          resultIndex: result.resultIndex,
          speakerTag: result.speakerTag
        });
      };
      
      // Start streaming audio to Deepgram
      const cleanup = streamAudioToDeepgram(
        stream,
        apiKey,
        handleSpeechResult,
        handleConnectionStatusChange
      );
      
      cleanupFunctionRef.current = cleanup;
      
      // Set up silence detection
      setupSilenceDetection();
      
      setIsRecording(true);
      toast.success("Started recording with Deepgram");
      
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to access microphone. Please check permissions.');
    }
  };

  // Stop recording and clean up resources
  const stopRecording = () => {
    // Clean up Deepgram connection
    if (cleanupFunctionRef.current) {
      cleanupFunctionRef.current();
      cleanupFunctionRef.current = null;
    }
    
    // Stop media streams
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    // Clear silence detection timer
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    setIsRecording(false);
    setConnectionStatus('closed');
    
    console.log("Recording stopped");
    toast.success('Recording stopped');
  };

  // Return public API
  return {
    isRecording,
    connectionStatus,
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

export default useDeepgramSpeechToText;
