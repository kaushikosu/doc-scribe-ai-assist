
import { useState, useRef, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { 
  startAzureSpeechRecognition,
  AzureSpeechResult,
  detectLanguageFromTranscript,
  languageCodeMap
} from '@/utils/azureSpeechToText';

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
  const supportedLanguages = useRef<string[]>(["en-IN", "hi-IN", "te-IN"]);
  
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const processingRef = useRef<boolean>(false);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const azureCleanupRef = useRef<(() => void) | null>(null);
  const accumulatedTranscriptRef = useRef<string>('');
  const processedResultsMapRef = useRef<Map<string, boolean>>(new Map());
  const sessionIdRef = useRef<string>(Date.now().toString());

  useEffect(() => {
    console.log("useAzureSpeechToText initialized with apiKey:", apiKey ? "API key provided" : "No API key");
    console.log("Supporting languages:", supportedLanguages.current.join(", "));
  }, [apiKey]);

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
      sessionIdRef.current = Date.now().toString();
      processedResultsMapRef.current.clear();
      accumulatedTranscriptRef.current = '';
      processingRef.current = false;

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      mediaStreamRef.current = stream;
      
      const cleanupFn = startAzureSpeechRecognition(
        apiKey,
        region,
        (result) => {
          if (result.error) {
            console.error('Azure speech processing error:', result.error);
            return;
          }
          
          if (!result.transcript && !result.error) {
            console.log('Empty transcript received from Azure, skipping');
            return;
          }
          
          lastSpeechTimeRef.current = Date.now();
          
          console.log('Azure transcript received:', result.transcript);
          
          // Detect language if needed
          if (result.transcript.length > 3) {
            const detectedLang = detectLanguageFromTranscript(result.transcript);
            
            if (detectedLang !== detectedLanguage && supportedLanguages.current.includes(detectedLang)) {
              console.log('Changing language detection from', detectedLanguage, 'to', detectedLang);
              setDetectedLanguage(detectedLang);
              
              if (result.isFinal && detectedLang === 'te-IN') {
                toast.success('Telugu language detected');
              }
            }
          }

          // For faster real-time experience, we'll prioritize displaying 
          // the text immediately without waiting for speaker detection
          onResult({
            transcript: result.transcript,
            isFinal: result.isFinal,
            resultIndex: result.resultIndex || 0,
            // Include speaker tag but don't rely on it for real-time display
            speakerTag: typeof result.speakerTag === 'number' ? result.speakerTag : undefined
          });
        },
        onSilence,
        pauseThreshold,
        detectedLanguage
      );
      
      azureCleanupRef.current = cleanupFn;
      setIsRecording(true);
      
      console.log("Recording started with Azure Speech-to-Text");
      toast.success(`Started recording with Azure Speech-to-Text (${detectedLanguage === 'te-IN' ? 'Telugu' : detectedLanguage === 'hi-IN' ? 'Hindi' : 'English'})`);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to access microphone. Please check permissions.');
    }
  };

  const setLanguage = (lang: string) => {
    if (supportedLanguages.current.includes(lang)) {
      setDetectedLanguage(lang);
      console.log('Manually set language to:', lang);
      return true;
    }
    console.log('Unsupported language:', lang);
    return false;
  };

  const stopRecording = () => {
    if (azureCleanupRef.current) {
      azureCleanupRef.current();
      azureCleanupRef.current = null;
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
    console.log("Azure recording stopped");
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
    setLanguage,
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

export default useAzureSpeechToText;
