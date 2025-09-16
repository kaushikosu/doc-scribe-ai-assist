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
  lastRecordedBlob: Blob | null;
  downloadLastRecording: () => void;
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
  const [lastRecordedBlob, setLastRecordedBlob] = useState<Blob | null>(null);
  
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
    if (isRecording) {
      return;
    }

    try {
      // Start Web Speech recognition
      webSpeech.startRecording();
      
      // Check browser support first
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported in this browser');
      }
      
      if (!window.MediaRecorder) {
        throw new Error('MediaRecorder not supported in this browser');
      }
      
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
      // Check supported mime types
      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/wav'
      ];
      
      let selectedMimeType = '';
      for (const type of preferredTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          break;
        }
      }
      
      
      const recorderOptions = selectedMimeType ? {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 16000
      } : { audioBitsPerSecond: 16000 };
      
      const mediaRecorder = new MediaRecorder(audioStreamRef.current, recorderOptions);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start(1000); // Collect data every 1000ms
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
      
      // Clean up any partially created resources
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
    }
  };

  const stopRecording = () => {
    // Stop Web Speech
    webSpeech.stopRecording();
    
    // Stop MediaRecorder if it's running
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      
      // Process the audio for diarization after a short delay
      setTimeout(() => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          if (onDiarizedResult) {
            processFinalAudio(audioBlob).then(result => {
              if (result.transcript) {
                onDiarizedResult({ 
                  transcript: result.transcript, 
                  isFinal: true, 
                  resultIndex: 0, 
                  error: undefined,
                  audioBlob,  // Pass the audioBlob directly
                  utterances: result.utterances  // Pass the utterances too
                });
              }
            }).catch(error => {
              console.error('Error processing diarized audio:', error);
              onDiarizedResult({ 
                transcript: '', 
                isFinal: true, 
                resultIndex: 0, 
                error: error.message,
                audioBlob  // Pass the audioBlob even on error
              });
            });
          }
        }
      }, 100);
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
  const processFinalAudio = async (providedBlob?: Blob): Promise<{transcript: string, utterances?: any[]}> => {
    if (!deepgramApiKey) {
      return {transcript: ''};
    }
    
    try {
      // Use provided blob or create one from the recorded chunks
      let audioBlob = providedBlob;
      
      if (!audioBlob && audioChunksRef.current.length > 0) {
        audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      }
      
      if (!audioBlob) {
        console.error('No audio data available for processing');
        return {transcript: ''};
      }
      
      // Store the audio blob for potential reuse
      setLastRecordedBlob(audioBlob);
      
      const { transcript, utterances, error } = await processCompleteAudio(audioBlob, deepgramApiKey);
      if (error) {
        console.error('Error processing final audio:', error);
        return {transcript: ''};
      }
      
      return {transcript, utterances};
    } catch (error) {
      console.error('Error in processFinalAudio:', error);
      return {transcript: ''};
    }
  };

  // Function to download the last recorded audio
  const downloadLastRecording = () => {
    if (!lastRecordedBlob) {
      return;
    }
    
    const url = URL.createObjectURL(lastRecordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
    
    // Audio recording blob and download functionality
    lastRecordedBlob,
    downloadLastRecording
  };
};

export default useDualTranscription;
