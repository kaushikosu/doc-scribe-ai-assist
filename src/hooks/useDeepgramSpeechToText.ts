import { useState, useRef, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { 
  streamAudioToDeepgram,
  ConnectionStatus,
  getSpeakerLabel,
  preconnectToDeepgram,
  disconnectDeepgram,
  processCompleteAudio
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
  onDiarizedTranscriptReady?: (transcript: string) => void;
  pauseThreshold: number;
  apiKey: string;
}

const useDeepgramSpeechToText = ({ 
  onResult, 
  onSilence,
  onDiarizedTranscriptReady,
  pauseThreshold,
  apiKey
}: UseDeepgramSpeechToTextProps) => {
  // State management
  const [isRecording, setIsRecording] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('closed');
  const [connectionErrors, setConnectionErrors] = useState(0);
  const [isPreconnected, setIsPreconnected] = useState(false);
  const [processingDiarization, setProcessingDiarization] = useState(false);
  
  // References to maintain state between renders
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupFunctionRef = useRef<(() => void) | null>(null);
  const accumulatedTranscriptRef = useRef<string>('');
  const currentSessionIdRef = useRef<string>(Date.now().toString());
  const isStoppingManuallyRef = useRef<boolean>(false);
  const deepgramClientRef = useRef<any | null>(null);
  const audioDataRef = useRef<{ getAudioBlob: () => Promise<Blob | null> } | null>(null);
  
  // Effect to initialize Deepgram connection when the component mounts
  useEffect(() => {
    console.log("useDeepgramSpeechToText initialized with API key:", apiKey ? "API key provided" : "No API key");
    
    // Pre-connect to Deepgram when component mounts
    if (apiKey && !isPreconnected && !deepgramClientRef.current) {
      preconnectDeepgram();
    }
    
    return () => {
      // Clean up the connection when component unmounts
      cleanupDeepgramConnection();
    };
  }, [apiKey]);

  // Pre-connect to Deepgram, but don't start sending audio yet
  const preconnectDeepgram = () => {
    if (!apiKey) return;
    
    console.log("Pre-connecting to Deepgram...");
    const { client, status } = preconnectToDeepgram(apiKey, handleConnectionStatusChange);
    deepgramClientRef.current = client;
    setConnectionStatus(status);
    setIsPreconnected(true);
  };
  
  // Clean up the Deepgram connection
  const cleanupDeepgramConnection = () => {
    // Stop sending audio first
    if (cleanupFunctionRef.current) {
      cleanupFunctionRef.current();
      cleanupFunctionRef.current = null;
    }
    
    // Then disconnect from Deepgram
    if (deepgramClientRef.current) {
      disconnectDeepgram(deepgramClientRef.current);
      deepgramClientRef.current = null;
      setIsPreconnected(false);
    }
    
    // Clear audio data reference
    audioDataRef.current = null;
  };
  
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
        if (!isRecording) {
          // Only show the toast when we're not recording (initial connection)
          toast.success("Connected to Deepgram");
        }
      } else if (status === 'failed') {
        setConnectionErrors(prevErrors => prevErrors + 1);
        
        // If we have multiple failures, try to restart the connection
        if (connectionErrors > 2) {
          toast.error("Connection issues with Deepgram - attempting to restart");
          
          // Try to reconnect
          cleanupDeepgramConnection();
          preconnectDeepgram();
        }
      }
    }
  };
  
  // Process recorded audio for enhanced diarization
  const processDiarization = async () => {
    if (!audioDataRef.current || !apiKey) {
      console.log("No audio data available for diarization");
      return;
    }
    
    try {
      setProcessingDiarization(true);
      toast.info("Processing audio for improved speaker detection...");
      
      // Get the recorded audio blob
      const audioBlob = await audioDataRef.current.getAudioBlob();
      if (!audioBlob) {
        console.error("Failed to get audio blob for diarization");
        setProcessingDiarization(false);
        return;
      }
      
      console.log(`Got audio blob for diarization: ${audioBlob.size} bytes`);
      
      // Process the complete audio for improved diarization
      const result = await processCompleteAudio(audioBlob, apiKey);
      
      if (result.error) {
        console.error("Error in diarization:", result.error);
        toast.error("Speaker detection failed. Using real-time transcript instead.");
        setProcessingDiarization(false);
        return;
      }
      
      if (!result.transcript) {
        console.warn("Empty diarized transcript returned");
        setProcessingDiarization(false);
        return;
      }
      
      console.log("Diarized transcript ready:", result.transcript.substring(0, 100) + "...");
      
      // Send the diarized transcript back to the component
      if (onDiarizedTranscriptReady) {
        onDiarizedTranscriptReady(result.transcript);
        toast.success("Transcript processed with speaker detection");
      }
      
    } catch (error) {
      console.error("Error processing diarization:", error);
      toast.error("Failed to process audio for speaker detection");
    } finally {
      setProcessingDiarization(false);
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
      
      // Ensure we have a valid client to use
      if (!deepgramClientRef.current) {
        preconnectDeepgram();
      }
      
      // Start streaming audio to Deepgram using the existing client
      const { stopStreaming, audioData } = streamAudioToDeepgram(
        stream,
        apiKey,
        handleSpeechResult,
        handleConnectionStatusChange,
        deepgramClientRef.current
      );
      
      cleanupFunctionRef.current = stopStreaming;
      audioDataRef.current = audioData;
      
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
  const stopRecording = async (processDiarizedTranscript = true) => {
    // Mark that we're stopping manually to avoid reconnection messages
    isStoppingManuallyRef.current = true;
    
    // Clean up audio streaming but keep the Deepgram connection alive
    if (cleanupFunctionRef.current) {
      cleanupFunctionRef.current();
      cleanupFunctionRef.current = null;
    }
    
    // Process the audio for diarization if requested
    if (processDiarizedTranscript && audioDataRef.current) {
      await processDiarization();
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
    
    console.log("Recording stopped");
    toast.success('Recording stopped');
  };

  // Return public API
  return {
    isRecording,
    connectionStatus,
    connectionErrors,
    processingDiarization,
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
    },
    processDiarization
  };
};

export default useDeepgramSpeechToText;
