import { useState, useEffect, useRef, useCallback } from 'react';
import useSpeechRecognition from './useSpeechRecognition';
import { 
  processCompleteAudio,
  DeepgramResult
} from '@/utils/deepgramSpeechToText';

interface UseDualTranscriptionProps {
  onRealtimeResult: (result: { 
    transcript: string; 
    isFinal: boolean; 
    resultIndex: number 
  }) => void;
  onDiarizedResult?: (result: DeepgramResult) => void;
  onSilence?: () => void;
  pauseThreshold?: number;
  deepgramApiKey?: string;
}

interface DualTranscriptionResult {
  isRecording: boolean;
  detectedLanguage: string;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  toggleRecording: () => Promise<void>;
  resetTranscript: () => void;
  getAccumulatedTranscript: () => string;
  processFinalAudio: (audioBlob: Blob) => Promise<string>;
}

const useDualTranscription = ({
  onRealtimeResult,
  onDiarizedResult,
  onSilence,
  pauseThreshold = 1500,
  deepgramApiKey = import.meta.env.VITE_DEEPGRAM_API_KEY || ''
}: UseDualTranscriptionProps): DualTranscriptionResult => {
  // State for recording
  const [isRecording, setIsRecording] = useState(false);
  
  // Refs for audio recording
  const audioStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  
  // Initialize Web Speech Recognition for real-time transcript
  const webSpeech = useSpeechRecognition({
    onResult: onRealtimeResult,
    onSilence,
    pauseThreshold
  });

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
    };
  }, []);

  const startRecording = async () => {
    if (isRecording) return;

    try {
      // Start Web Speech recognition
      webSpeech.startRecording();
      
      // Set up audio recording for post-processing
      if (!audioStreamRef.current) {
        audioStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
          audio: { 
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      }

      // Create a MediaRecorder to capture audio for processing later
      const mediaRecorder = new MediaRecorder(audioStreamRef.current);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start();
      
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    // Stop Web Speech
    webSpeech.stopRecording();
    
    // Stop MediaRecorder if it's running
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop media stream tracks
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    
    setIsRecording(false);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  const resetTranscript = () => {
    webSpeech.resetTranscript();
    audioChunksRef.current = [];
  };
  
  // Process the recorded audio for improved diarization
  const processFinalAudio = async (providedBlob?: Blob): Promise<string> => {
    if (!deepgramApiKey) {
      return '';
    }
    
    try {
      // Use provided blob or create one from the recorded chunks
      let audioBlob = providedBlob;
      
      if (!audioBlob && audioChunksRef.current.length > 0) {
        audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      }
      
      if (!audioBlob) {
        console.error('No audio data available for processing');
        return '';
      }
      
      const { transcript, error } = await processCompleteAudio(audioBlob, deepgramApiKey);
      if (error) {
        console.error('Error processing final audio:', error);
        return '';
      }
      
      return transcript;
    } catch (error) {
      console.error('Error in processFinalAudio:', error);
      return '';
    }
  };

  return {
    // Web Speech API properties
    isRecording,
    detectedLanguage: webSpeech.detectedLanguage,
    getAccumulatedTranscript: webSpeech.getAccumulatedTranscript,
    
    // Combined operations
    startRecording,
    stopRecording,
    toggleRecording,
    resetTranscript,
    
    // Deepgram-specific properties
    processFinalAudio
  };
};

export default useDualTranscription;
