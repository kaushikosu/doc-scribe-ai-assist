
import { useState, useRef, useEffect } from 'react';
import { toast } from '@/lib/toast';
import useGoogleSpeechToText from './useGoogleSpeechToText';

interface UseSpeechRecognitionProps {
  onResult: (result: { 
    transcript: string, 
    isFinal: boolean, 
    resultIndex: number,
    speakerTag?: number 
  }) => void;
  onSilence: () => void;
  pauseThreshold?: number;
}

const useSpeechRecognition = ({ 
  onResult, 
  onSilence,
  pauseThreshold = 1500
}: UseSpeechRecognitionProps) => {
  const [detectedLanguage, setDetectedLanguage] = useState<string>("en-IN");
  const apiKey = import.meta.env.VITE_GOOGLE_SPEECH_API_KEY;
  
  // We need to add these missing properties to match what VoiceRecorder expects
  const {
    isRecording,
    processingStatus,
    startRecording,
    stopRecording,
    setIdle,
    toggleRecording,
    getAccumulatedTranscript,
    resetTranscript
  } = useGoogleSpeechToText({
    onResult,
    onSilence,
    pauseThreshold,
    apiKey: apiKey || ''
  });

  useEffect(() => {
    console.log("useSpeechRecognition initialized with API key:", apiKey ? "API key provided" : "No API key");
  }, [apiKey]);

  return {
    isRecording,
    detectedLanguage,
    processingStatus, // Add the missing property
    startRecording,
    stopRecording,
    setIdle, // Add the missing property
    toggleRecording,
    getAccumulatedTranscript,
    resetTranscript
  };
};

export default useSpeechRecognition;
