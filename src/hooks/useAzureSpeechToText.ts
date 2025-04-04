import { useState, useRef, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { 
  startAzureSpeechRecognition,
  AzureSpeechResult,
  detectLanguageFromTranscript,
  languageCodeMap
} from '@/utils/azureSpeechToText';
import { detectSpeaker } from '@/utils/speakerDetection';

interface UseAzureSpeechToTextProps {
  onResult: (result: { 
    transcript: string, 
    isFinal: boolean, 
    resultIndex: number,
    speakerTag?: number 
  }) => void;
  onSilence: () => void;
  pauseThreshold: number;
  apiKey: string;
  region: string;
}

const useAzureSpeechToText = ({ 
  onResult, 
  onSilence,
  pauseThreshold,
  apiKey,
  region
}: UseAzureSpeechToTextProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<string>("en-IN");
  
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const processingRef = useRef<boolean>(false);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const azureCleanupRef = useRef<(() => void) | null>(null);
  
  // Store the complete transcript with proper line breaks between utterances
  const accumulatedTranscriptRef = useRef<string>('');
  
  // Track all results to avoid processing duplicates
  const processedResultsMapRef = useRef<Map<string, boolean>>(new Map());
  
  // Keep reference to the current recording session
  const sessionIdRef = useRef<string>(Date.now().toString());
  
  // For debugging purposes
  useEffect(() => {
    console.log("useAzureSpeechToText initialized with apiKey:", apiKey ? "API key provided" : "No API key");
  }, [apiKey]);
  
  // Start recording with Azure Speech-to-Text
  const startRecording = async () => {
    if (!apiKey) {
      toast.error("Azure Speech API key is not configured");
      return;
    }

    if (!region) {
      toast.error("Azure Speech region is not configured");
      return;
    }
    
    try {
      // Generate new session ID when starting recording
      sessionIdRef.current = Date.now().toString();
      processedResultsMapRef.current.clear();
      accumulatedTranscriptRef.current = '';
      processingRef.current = false;
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      mediaStreamRef.current = stream;
      
      // Start Azure speech recognition
      const cleanupFn = startAzureSpeechRecognition(
        apiKey,
        region,
        (result) => {
          if (result.error) {
            console.error('Azure speech processing error:', result.error);
            return;
          }
          
          // Skip empty results
          if (!result.transcript && !result.error) {
            console.log('Empty transcript received from Azure, skipping');
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
          
          // Update language detection periodically on final results
          if (result.isFinal && result.transcript.length > 5) {
            const detectedLang = detectLanguageFromTranscript(result.transcript);
            if (detectedLang !== detectedLanguage) {
              setDetectedLanguage(detectedLang);
            }
          }
        },
        onSilence,
        pauseThreshold
      );
      
      azureCleanupRef.current = cleanupFn;
      setIsRecording(true);
      
      // Signal successful start
      console.log("Recording started with Azure Speech-to-Text");
      toast.success("Started recording with Azure Speech-to-Text");
      
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (azureCleanupRef.current) {
      azureCleanupRef.current();
      azureCleanupRef.current = null;
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
    console.log("Azure recording stopped");
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

export default useAzureSpeechToText;
