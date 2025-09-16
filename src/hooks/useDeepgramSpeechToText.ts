import { useState, useRef } from 'react';
import { toast } from '@/lib/toast';
import {
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
  const [processingDiarization, setProcessingDiarization] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState('en');
  
  // References to maintain state between renders
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedTranscriptRef = useRef<string>('');
  const resultIndexRef = useRef<number>(0);
  
  // Process recorded audio for diarization
  const processDiarization = async () => {
    if (audioChunksRef.current.length === 0 || !apiKey) {
      return '';
    }
    
    try {
      setProcessingDiarization(true);
      toast.info("Processing audio for improved speaker detection...");
      
      // Create an audio blob from recorded chunks using MP4 format
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp4' });
      
      if (!audioBlob || audioBlob.size === 0) {
        console.error("Empty audio blob for diarization");
        setProcessingDiarization(false);
        return '';
      }
      
      // Process the complete audio
      const result = await processCompleteAudio(audioBlob, apiKey);
      
      if (result.error) {
        console.error("Error in diarization:", result.error);
        toast.error("Speaker detection failed. Using real-time transcript instead.");
        setProcessingDiarization(false);
        return '';
      }
      
      if (!result.transcript) {
        console.warn("Empty diarized transcript returned");
        setProcessingDiarization(false);
        return '';
      }
      
      // Send the diarized transcript back to the component
      if (onDiarizedTranscriptReady) {
        onDiarizedTranscriptReady(result.transcript);
        toast.success("Transcript processed with speaker detection");
      }
      
      return result.transcript;
      
    } catch (error) {
      console.error("Error processing diarization:", error);
      toast.error("Failed to process audio for speaker detection");
      return '';
    } finally {
      setProcessingDiarization(false);
    }
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
        onSilence();
        lastSpeechTimeRef.current = now;
      }
    }, 200);
  };
  
  // Start recording audio
  const startRecording = async () => {
    try {
      // Reset audio chunks
      audioChunksRef.current = [];
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 44100 // High quality audio
        } 
      });
      
      mediaStreamRef.current = stream;
      
      // Check if MP4 is supported
      let mimeType = 'audio/mp4';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.warn('MP4 recording not supported, falling back to WebM');
        mimeType = 'audio/webm;codecs=opus';
      }
      
      // Set up MediaRecorder with MP4 format if supported
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000 // 128 kbps audio quality
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      // Set up data collection
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      // Start the recorder
      mediaRecorder.start(1000); // Collect data every second
      
      // Set up Web Speech API for real-time transcription
      setupWebSpeechRecognition(stream);
      
      // Set up silence detection
      setupSilenceDetection();
      
      setIsRecording(true);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to access microphone. Please check permissions.');
    }
  };

  // Set up Web Speech API for real-time transcription
  const setupWebSpeechRecognition = (stream: MediaStream) => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported in this browser');
      return;
    }
    
    try {
      // @ts-ignore - SpeechRecognition is not in the TypeScript types
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US'; // Default to English
      
      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          const isFinal = result.isFinal;
          
          // If we get a language change event
          if (recognition.lang !== 'en-US' && recognition.lang !== '') {
            setDetectedLanguage(recognition.lang.split('-')[0]);
          }
          
          // Reset silence detection timer
          lastSpeechTimeRef.current = Date.now();
          
          // Send result to callback
          onResult({
            transcript,
            isFinal,
            resultIndex: resultIndexRef.current++
          });
          
          // Accumulate final results
          if (isFinal) {
            accumulatedTranscriptRef.current += transcript + ' ';
          }
        }
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
      };
      
      recognition.start();
      
      return recognition;
    } catch (error) {
      console.error('Error setting up Web Speech API:', error);
      return null;
    }
  };

  // Stop recording and clean up resources
  const stopRecording = async () => {
    
    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
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
    
    // Process for diarization
    return await processDiarization();
  };

  // Toggle recording state
  const toggleRecording = async () => {
    if (isRecording) {
      return await stopRecording();
    } else {
      await startRecording();
      return '';
    }
  };
  
  // Return public API
  return {
    isRecording,
    processingDiarization,
    detectedLanguage,
    startRecording,
    stopRecording,
    toggleRecording,
    getAccumulatedTranscript: () => accumulatedTranscriptRef.current,
    resetTranscript: () => {
      accumulatedTranscriptRef.current = '';
      audioChunksRef.current = [];
      resultIndexRef.current = 0;
    },
    processFinalAudio: processDiarization
  };
};

export default useDeepgramSpeechToText;
