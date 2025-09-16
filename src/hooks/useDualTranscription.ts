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
  console.log('🔧 [DUAL INIT] useDualTranscription hook initialized', {
    hasRealtimeCallback: !!onRealtimeResult,
    hasDiarizedCallback: !!onDiarizedResult,
    hasApiKey: !!deepgramApiKey,
    pauseThreshold
  });
  
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
    console.log("🚀 [DUAL START] startRecording function called, current isRecording:", isRecording);
    
    if (isRecording) {
      console.log("⚠️ [DUAL START] Already recording, returning early");
      return;
    }

    try {
      console.log("🎧 [DUAL START] Starting Web Speech recognition...");
      // Start Web Speech recognition
      webSpeech.startRecording();
      
      console.log("🎤 [DUAL START] Requesting audio stream for MediaRecorder...");
      
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
        console.log("✅ [DUAL START] Audio stream obtained successfully:", {
          id: audioStreamRef.current.id,
          active: audioStreamRef.current.active,
          tracks: audioStreamRef.current.getAudioTracks().length,
          trackState: audioStreamRef.current.getAudioTracks()[0]?.readyState
        });
      } else {
        console.log("♻️ [DUAL START] Reusing existing audio stream");
      }

      // Create a MediaRecorder to capture audio for processing later
      console.log("🎤 [DUAL TRANSCRIPTION] Creating MediaRecorder...");
      
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
          console.log('🎤 [DUAL MIME] Selected MIME type:', type);
          break;
        }
      }
      
      if (!selectedMimeType) {
        console.warn('🎤 [DUAL MIME] No preferred MIME types supported, using default');
      }
      
      const recorderOptions = selectedMimeType ? {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 16000
      } : { audioBitsPerSecond: 16000 };
      
      const mediaRecorder = new MediaRecorder(audioStreamRef.current, recorderOptions);
      console.log("✅ [DUAL TRANSCRIPTION] MediaRecorder created:", {
        mimeType: mediaRecorder.mimeType,
        state: mediaRecorder.state,
        stream: mediaRecorder.stream?.id
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      console.log("🎤 [DUAL TRANSCRIPTION] Starting MediaRecorder for diarization");
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(`🎵 [DUAL CHUNK] Received: ${event.data.size} bytes, total chunks: ${audioChunksRef.current.length + 1}`);
          audioChunksRef.current.push(event.data);
        } else {
          console.error(`❌ [DUAL CHUNK] Empty chunk received`);
        }
      };
      
      mediaRecorder.onstart = () => {
        console.log("✅ [DUAL TRANSCRIPTION] MediaRecorder started successfully");
      };
      
      mediaRecorder.onstop = () => {
        console.log(`🛑 [DUAL STOP] Recording stopped, processing ${audioChunksRef.current.length} chunks`);
        console.log(`📊 [DUAL STOP] Individual chunk sizes:`, audioChunksRef.current.map(chunk => chunk instanceof Blob ? chunk.size : 'unknown'));
      };
      
      mediaRecorder.onerror = (event) => {
        console.error(`❌ [DUAL ERROR] MediaRecorder error:`, event);
      };
      
      console.log(`🎤 [DUAL TRANSCRIPTION] About to start MediaRecorder with timeslice 1000ms...`);
      mediaRecorder.start(1000); // Collect data every 1000ms
      console.log(`✅ [DUAL START] MediaRecorder started, state: ${mediaRecorder.state}`);
      
      console.log("🎯 [DUAL START] Setting recording state to true...");
      setIsRecording(true);
      console.log("✅ [DUAL START] Successfully started dual transcription");
    } catch (error) {
      console.error('❌ [DUAL ERROR] Error starting recording:', error);
      console.error('❌ [DUAL ERROR] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      setIsRecording(false);
      
      // Clean up any partially created resources
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
    }
  };

  const stopRecording = () => {
    console.log("🛑 [DUAL STOP] Stopping dual transcription...");
    
    // Stop Web Speech
    webSpeech.stopRecording();
    
    // Stop MediaRecorder if it's running
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log("🛑 [DUAL STOP] Stopping MediaRecorder...");
      mediaRecorderRef.current.stop();
      
      // Process the audio for diarization after a short delay
      setTimeout(() => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          console.log(`🎯 [DUAL PROCESS] Auto-processing ${audioBlob.size} bytes for diarization`);
          
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
    console.log('🎯 [DUAL TOGGLE] toggleRecording called, current isRecording:', isRecording);
    if (isRecording) {
      console.log('🛑 [DUAL TOGGLE] Stopping recording...');
      stopRecording();
    } else {
      console.log('▶️ [DUAL TOGGLE] Starting recording...');
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
      console.log("❌ [DUAL PROCESS] No Deepgram API key available");
      return {transcript: ''};
    }
    
    try {
      // Use provided blob or create one from the recorded chunks
      let audioBlob = providedBlob;
      
      if (!audioBlob && audioChunksRef.current.length > 0) {
        audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log(`🎯 [DUAL PROCESS] Created audio blob from ${audioChunksRef.current.length} chunks: ${audioBlob.size} bytes`);
      }
      
      if (!audioBlob) {
        console.error('❌ [DUAL PROCESS] No audio data available for processing');
        return {transcript: ''};
      }
      
      // Store the audio blob for download
      setLastRecordedBlob(audioBlob);
      console.log(`🚀 [DUAL PROCESS] Processing audio blob: ${audioBlob.size} bytes (stored for download)`);
      
      const { transcript, utterances, error } = await processCompleteAudio(audioBlob, deepgramApiKey);
      if (error) {
        console.error('❌ [DUAL PROCESS] Error processing final audio:', error);
        return {transcript: ''};
      }
      
      console.log(`✅ [DUAL PROCESS] Successfully processed audio, transcript length: ${transcript.length}`);
      return {transcript, utterances};
    } catch (error) {
      console.error('❌ [DUAL PROCESS] Error in processFinalAudio:', error);
      return {transcript: ''};
    }
  };

  // Function to download the last recorded audio
  const downloadLastRecording = () => {
    if (!lastRecordedBlob) {
      console.warn('❌ [DUAL DOWNLOAD] No recorded audio available for download');
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
    
    console.log(`💾 [DUAL DOWNLOAD] Downloaded audio: ${lastRecordedBlob.size} bytes`);
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
    
    // Audio download functionality
    lastRecordedBlob,
    downloadLastRecording
  };
};

export default useDualTranscription;
