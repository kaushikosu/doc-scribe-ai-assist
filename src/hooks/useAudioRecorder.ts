
import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from '@/lib/toast';

interface UseAudioRecorderProps {
  onRecordingComplete?: (audioBlob: Blob) => void;
}

const useAudioRecorder = ({ onRecordingComplete }: UseAudioRecorderProps = {}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
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
      console.log("Starting audio recording for diarization...");
      audioChunksRef.current = [];
      
      // Don't reset audioBlob on start - keep the previous recording available until we have a new one
      // This allows the download button to remain available between recordings
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      console.log("Audio stream obtained successfully");
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(`Audio chunk received: ${event.data.size} bytes`);
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        if (!mountedRef.current) return;
        
        console.log(`Recording stopped, processing ${audioChunksRef.current.length} audio chunks`);
        
        if (audioChunksRef.current.length === 0) {
          console.warn("No audio chunks recorded");
          toast.error("No audio was recorded");
          return;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log(`Created audio blob: ${audioBlob.size} bytes`);
        
        if (audioBlob.size < 100) {
          console.warn("Audio blob is too small, likely empty");
          toast.error("Recorded audio is too short or empty");
          return;
        }
        
        setAudioBlob(audioBlob);
        
        if (onRecordingComplete) {
          console.log("Calling onRecordingComplete callback with audio blob");
          onRecordingComplete(audioBlob);
        }
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };
      
      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      console.log("MediaRecorder started successfully");
      setIsRecording(true);
      setRecordingDuration(0);
      
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
      toast.error('Failed to access microphone. Please check permissions.');
    }
  }, [onRecordingComplete]);
  
  const stopRecording = useCallback(() => {
    console.log("Stopping audio recording");
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaRecorderRef.current && isRecording) {
      console.log("Calling stop() on MediaRecorder");
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      console.warn("Attempted to stop recording, but MediaRecorder wasn't active", {
        isRecording,
        mediaRecorderState: mediaRecorderRef.current?.state || 'null'
      });
    }
  }, [isRecording]);
  
  // Add a reset function to clear audio blob and reset recording duration
  const reset = useCallback(() => {
    console.log("Resetting audio recorder state");
    setAudioBlob(null);
    setRecordingDuration(0);
    audioChunksRef.current = [];
    
    // Make sure recording is stopped
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    
    // Clear any active timers
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Stop any active streams
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, [isRecording]);
  
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  return {
    isRecording,
    startRecording,
    stopRecording,
    reset,
    audioBlob,
    recordingDuration,
    formattedDuration: formatDuration(recordingDuration)
  };
};

export default useAudioRecorder;
