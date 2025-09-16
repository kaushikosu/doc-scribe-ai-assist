import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from '@/lib/toast';

interface UseAudioRecorderProps {
  onRecordingComplete?: (audioBlob: Blob) => void;
}

const useAudioRecorder = ({ onRecordingComplete }: UseAudioRecorderProps = {}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<string>('idle');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  const startRecording = useCallback(async () => {
    try {
      console.log("🚀 [START RECORDING] Function called - beginning audio recording setup...");
      setRecordingStatus('initializing');
      
      // Try to get audio stream with optimal quality settings
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
      
      console.log("🎧 [AUDIO STREAM] Audio stream obtained successfully");
      streamRef.current = stream;
      
      // Determine the best supported audio format for Deepgram diarization
      // Prefer formats that work better with Deepgram
      console.log(`[AUDIO DEBUG] Checking audio format support...`);
      console.log(`[AUDIO DEBUG] audio/mp4 supported:`, MediaRecorder.isTypeSupported('audio/mp4'));
      console.log(`[AUDIO DEBUG] audio/wav supported:`, MediaRecorder.isTypeSupported('audio/wav'));
      console.log(`[AUDIO DEBUG] audio/webm;codecs=opus supported:`, MediaRecorder.isTypeSupported('audio/webm;codecs=opus'));
      console.log(`[AUDIO DEBUG] audio/webm supported:`, MediaRecorder.isTypeSupported('audio/webm'));
      
      let mimeType = 'audio/mp4'; // Start with MP4 instead of WAV
      
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.warn('MP4 recording not supported, trying WAV...');
        mimeType = 'audio/wav';
        
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          console.warn('WAV recording not supported, trying WebM with Opus...');
          mimeType = 'audio/webm;codecs=opus';
          
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            console.warn('WebM+Opus not supported, falling back to basic WebM...');
            mimeType = 'audio/webm';
          }
        }
      }
      
      console.log(`Using audio format: ${mimeType}`);
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000 // 128 kbps
      });
      
      console.log(`[AUDIO DEBUG] MediaRecorder created with mimeType: ${mimeType}, audioBitsPerSecond: 128000`);
      
      mediaRecorderRef.current = mediaRecorder;

      // Create a scoped array for this recording session to prevent race conditions
      const audioChunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log(`🎵 [AUDIO CHUNK] Received: ${event.data.size} bytes, type: ${event.data.type}, total chunks: ${audioChunks.length + 1}`);
          audioChunks.push(event.data);
        } else {
          console.error(`❌ [AUDIO CHUNK] Empty or invalid chunk:`, event.data);
        }
      };
      
      // Define onstop handler before starting the recorder
      mediaRecorder.onstop = () => {
        // Log regardless of mounted state for debugging
        console.log(`🛑 [RECORDER STOP] Recording stopped, processing ${audioChunks.length} audio chunks`);
        console.log(`📊 [RECORDER STOP] Individual chunk sizes:`, audioChunks.map(chunk => chunk.size));
        
        // Only prevent state updates if component is unmounted
        if (!mountedRef.current) {
          console.log("Component unmounted, skipping state updates but still processing audio");
          
          // Still create the blob and call onRecordingComplete even if unmounted
          if (audioChunks.length > 0) {
            const blob = new Blob(audioChunks, { type: mimeType });
            console.log(`Created audio blob despite unmount: ${blob.size} bytes`);
            
            if (onRecordingComplete) {
              console.log("Calling onRecordingComplete callback despite unmount");
              onRecordingComplete(blob);
            }
          }
          
          // Always clean up resources
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          
          return;
        }
        
        setRecordingStatus('processing');
        
        // Delay processing slightly to ensure all data is collected
        setTimeout(() => {
          if (audioChunks.length === 0) {
            console.warn("No audio chunks recorded");
            toast.error("No audio was recorded");
            setRecordingStatus('error');
            return;
          }
          
          const blob = new Blob(audioChunks, { type: mimeType });
          console.log(`🎯 [FINAL BLOB] Created audio blob: ${blob.size} bytes, type: ${mimeType}`);
          console.log(`📈 [FINAL BLOB] Audio chunks count: ${audioChunks.length}, total size: ${blob.size} bytes`);
          console.log(`⏱️ [FINAL BLOB] Recording duration: ${recordingDuration} seconds`);
          console.log(`📐 [FINAL BLOB] Expected size for ${recordingDuration}s: ~${recordingDuration * 16000} bytes (rough estimate for 16kHz audio)`);
          console.log(`📊 [FINAL BLOB] Actual vs Expected ratio: ${blob.size / (recordingDuration * 16000)}`);
          
          if (blob.size < 100) {
            console.warn("Audio blob is too small, likely empty");
            toast.error("Recorded audio is too short or empty");
            setRecordingStatus('error');
            return;
          }
          
          // Save the audio blob for potential downloads
          setAudioBlob(blob);
          setRecordingStatus('complete');
          
          if (onRecordingComplete) {
            console.log("[AUDIO RECORDER DEBUG] About to call onRecordingComplete with blob size:", blob.size, "bytes");
            onRecordingComplete(blob);
          }
          
          // Stop all tracks
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
        }, 300); // Short delay to ensure all chunks are processed
      };
      
      // Start recording with more frequent data collection
      console.log(`🎤 [RECORDER START] Starting MediaRecorder.start() with format: ${mimeType}`);
      mediaRecorder.start(1000); // Changed from 500ms to 1000ms for larger chunks
      console.log(`✅ [RECORDER START] MediaRecorder started successfully, state: ${mediaRecorder.state}`);
      setIsRecording(true);
      setRecordingDuration(0);
      setRecordingStatus('recording');
      
      // Start the timer
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
      
      timerRef.current = window.setInterval(() => {
        if (mountedRef.current) {
          setRecordingDuration(prev => prev + 1);
        }
      }, 1000);
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to access microphone: ${errorMessage}`);
      setRecordingStatus('error');
    }
  }, [onRecordingComplete]);
  
  const stopRecording = useCallback(() => {
    console.log("[AUDIO DEBUG] stopRecording called, isRecording:", isRecording);
    console.log("Stopping audio recording");
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaRecorderRef.current) {
      console.log(`[AUDIO DEBUG] MediaRecorder state before stop: ${mediaRecorderRef.current.state}`);
      if (mediaRecorderRef.current.state === 'recording') {
        try {
          console.log("[AUDIO DEBUG] Requesting final data chunk...");
          // Request one final chunk of data before stopping
          mediaRecorderRef.current.requestData();
          // Add a small delay before stopping to ensure data is captured
          setTimeout(() => {
            if (mediaRecorderRef.current) {
              console.log("[AUDIO DEBUG] Calling MediaRecorder.stop()...");
              mediaRecorderRef.current.stop();
              console.log("MediaRecorder stop() called");
            }
          }, 200); // Increased delay from 100ms to 200ms
        } catch (error) {
          console.error("Error stopping MediaRecorder:", error);
          // Handle the stop error by manually triggering processing
          processRecordingManually();
        }
      } else {
        console.warn(`MediaRecorder not in recording state: ${mediaRecorderRef.current.state}`);
        // Try to process anyway
        processRecordingManually();
      }
    } else {
      console.warn("Attempted to stop recording, but MediaRecorder wasn't available");
      // Clean up anyway
      processRecordingManually();
    }
    
    setIsRecording(false);
  }, [isRecording]);
  
  // Function to process recording if the onstop event fails to trigger
  const processRecordingManually = () => {
    console.log("Processing recording manually");
    setRecordingStatus('processing');
    
    // Clean up the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // If we have no blob yet but we do have a recorder, try to get data
    if (!audioBlob && mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.requestData();
      } catch (error) {
        console.error("Error requesting final data:", error);
      }
    }
    
    // If we already have a blob, use it
    if (audioBlob && onRecordingComplete) {
      console.log("[AUDIO RECORDER DEBUG] Using existing blob for onRecordingComplete, blob size:", audioBlob.size, "bytes");
      onRecordingComplete(audioBlob);
    }
  };
  
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  return {
    isRecording,
    startRecording,
    stopRecording,
    audioBlob,
    recordingDuration,
    formattedDuration: formatDuration(recordingDuration),
    recordingStatus
  };
};

export default useAudioRecorder;
