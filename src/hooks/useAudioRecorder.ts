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
      console.log("Starting audio recording for diarization...");
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
      
      console.log("Audio stream obtained successfully");
      streamRef.current = stream;
      
      // Determine the best supported audio format
      let mimeType = 'audio/mp4';
      
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.warn('M4A/MP4 recording is not supported in this browser, falling back to WebM');
        mimeType = 'audio/webm;codecs=opus';
        
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          // Fall back further if needed
          mimeType = 'audio/webm';
        }
      }
      
      console.log(`Using audio format: ${mimeType}`);
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000 // 128 kbps
      });
      
      mediaRecorderRef.current = mediaRecorder;

      // Create a scoped array for this recording session to prevent race conditions
      const audioChunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log(`Audio chunk received: ${event.data.size} bytes`);
          audioChunks.push(event.data);
        }
      };
      
      // Define onstop handler before starting the recorder
      mediaRecorder.onstop = () => {
        // Log regardless of mounted state for debugging
        console.log(`Recording stopped, processing ${audioChunks.length} audio chunks`);
        
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
          console.log(`Created audio blob: ${blob.size} bytes, type: ${mimeType}`);
          
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
            console.log("Calling onRecordingComplete callback with audio blob");
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
      mediaRecorder.start(500); // Collect data every 500ms for more reliable chunks
      console.log("MediaRecorder started successfully");
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
    console.log("Stopping audio recording");
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === 'recording') {
        try {
          console.log("Calling stop() on MediaRecorder");
          // Request one final chunk of data before stopping
          mediaRecorderRef.current.requestData();
          // Add a small delay before stopping to ensure data is captured
          setTimeout(() => {
            if (mediaRecorderRef.current) {
              mediaRecorderRef.current.stop();
              console.log("MediaRecorder stop() called");
            }
          }, 100);
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
      console.log("Using existing blob for onRecordingComplete");
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
