
import { useState, useRef, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { LiveClient } from "@deepgram/sdk";
import { 
  streamAudioToDeepgram,
  ConnectionStatus,
  getSpeakerLabel,
  preconnectToDeepgram,
  disconnectDeepgram
} from '@/utils/deepgramSpeechToText';

interface UseDeepgramSpeechToTextProps {
  onResult: (result: { 
    transcript: string, 
    isFinal: boolean, 
    resultIndex: number,
    speakerTag?: number,
    topics?: string[] 
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
  const [connectionErrors, setConnectionErrors] = useState(0);
  const [isPreconnected, setIsPreconnected] = useState(false);
  
  // References to maintain state between renders
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupFunctionRef = useRef<(() => void) | null>(null);
  const accumulatedTranscriptRef = useRef<string>('');
  const currentSessionIdRef = useRef<string>(Date.now().toString());
  const isStoppingManuallyRef = useRef<boolean>(false);
  const deepgramClientRef = useRef<LiveClient | null>(null);
  
  // Effect to initialize Deepgram connection when the component mounts
  useEffect(() => {
    console.log("useDeepgramSpeechToText initialized with API key:", apiKey ? "API key provided" : "No API key");
    
    // Pre-connect to Deepgram when component mounts
    if (apiKey && !isPreconnected) {
      const { client, status } = preconnectToDeepgram(apiKey, handleConnectionStatusChange);
      deepgramClientRef.current = client;
      setConnectionStatus(status);
      setIsPreconnected(true);
    }
    
    return () => {
      // Clean up the connection when component unmounts
      if (deepgramClientRef.current) {
        disconnectDeepgram(deepgramClientRef.current);
        deepgramClientRef.current = null;
      }
      stopRecording();
    };
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
    console.log("Deepgram connection status changed to:", status);
    setConnectionStatus(status);
    
    // Show appropriate toast message, but only if we aren't stopping manually
    if (!isStoppingManuallyRef.current) {
      if (status === 'open') {
        setConnectionErrors(0); // Reset error count on successful connection
        toast.success("Connected to Deepgram");
      } else if (status === 'failed') {
        setConnectionErrors(prevErrors => prevErrors + 1);
        
        // If we have multiple failures, try to restart the connection
        if (connectionErrors > 2) {
          toast.error("Connection issues with Deepgram - attempting to restart");
          
          // Try to reconnect
          if (deepgramClientRef.current) {
            disconnectDeepgram(deepgramClientRef.current);
            deepgramClientRef.current = null;
          }
          
          const { client, status } = preconnectToDeepgram(apiKey, handleConnectionStatusChange);
          deepgramClientRef.current = client;
          setConnectionStatus(status);
          setIsPreconnected(true);
        }
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
      // Reset manual stopping flag
      isStoppingManuallyRef.current = false;
      
      // Generate new session ID
      currentSessionIdRef.current = Date.now().toString();
      
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
        topics?: string[],
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
        
        // Add topics if available
        if (result.topics && result.topics.length > 0) {
          console.log("Detected topics:", result.topics.join(", "));
        }
        
        // Send result to callback
        onResult({
          transcript: formattedTranscript,
          isFinal: result.isFinal,
          resultIndex: result.resultIndex,
          speakerTag: result.speakerTag,
          topics: result.topics
        });
      };
      
      // Use existing client if we have one, otherwise create a new one
      let client = deepgramClientRef.current;
      
      // Start streaming audio to Deepgram
      const cleanup = streamAudioToDeepgram(
        stream,
        apiKey,
        handleSpeechResult,
        handleConnectionStatusChange,
        client // Pass the existing client if we have one
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
    // Mark that we're stopping manually to avoid reconnection messages
    isStoppingManuallyRef.current = true;
    
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
    connectionErrors,
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

