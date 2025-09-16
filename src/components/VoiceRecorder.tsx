import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, UserPlus, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

import useDualTranscription from '@/hooks/useDualTranscription';
import { DeepgramResult } from '@/utils/deepgramSpeechToText';

interface VoiceRecorderProps {
  onTranscriptUpdate: (transcript: string) => void;
  onAudioProcessingComplete?: (audioBlob: Blob) => Promise<void>;
  onDiarizedResultComplete?: (utterances: any[], audioBlob: Blob) => Promise<void>;
  onPatientInfoUpdate: (patientInfo: { name: string; time: string }) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  onNewPatient?: () => void;
  onRecordingStart?: () => void;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ 
  onTranscriptUpdate, 
  onAudioProcessingComplete,
  onDiarizedResultComplete,
  onPatientInfoUpdate,
  onRecordingStateChange,
  onNewPatient,
  onRecordingStart
}) => {
  // State variables
  const [transcript, setTranscript] = useState('');
  const [rawTranscript, setRawTranscript] = useState(''); 
  const [diarizedTranscript, setDiarizedTranscript] = useState('');
  const [isNewSession, setIsNewSession] = useState(true);
  const [pauseThreshold, setPauseThreshold] = useState(1500); // 1.5 seconds
  
  const [processingTranscript, setProcessingTranscript] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [justStopped, setJustStopped] = useState(false);
  
  // Refs
  const currentTranscriptRef = useRef<string>('');
  const diarizedMessagesRef = useRef<string[]>([]);
  const transcriptUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Handle silence - add a line break to separate utterances
  const handleSilence = () => {
    // Add line break to help separate different speech segments
    setRawTranscript(prev => {
      if (prev.endsWith('\n\n')) return prev;
      return prev + "\n\n";
    });
  };

  // Get Deepgram API key from environment
  const deepgramApiKey = import.meta.env.VITE_DEEPGRAM_API_KEY || '';

  // Memoized callback for diarized results
  // NOTE: Using empty dependency array because onAudioProcessingComplete
  // changes on every render due to processDiarizedTranscription dependencies
  const handleDiarizedResult = useCallback(async (result: DeepgramResult) => {
    console.log("🎯 [VOICE RECORDER] Diarized result received, triggering medical pipeline");
    
    // NEW: Use diarized utterances directly instead of calling Deepgram again
    if (onDiarizedResultComplete && result.utterances && result.audioBlob) {
      try {
        console.log("🎯 [VOICE RECORDER] Calling onDiarizedResultComplete with utterances:", result.utterances.length, "utterances, blob:", result.audioBlob.size, "bytes");
        await onDiarizedResultComplete(result.utterances, result.audioBlob);
      } catch (error) {
        console.error("Error in diarized result processing:", error);
      }
    } else if (onAudioProcessingComplete && result.audioBlob) {
      // Fallback to old method if new callback not provided
      try {
        console.log("🎯 [VOICE RECORDER] Falling back to onAudioProcessingComplete with blob:", result.audioBlob.size, "bytes");
        await onAudioProcessingComplete(result.audioBlob);
      } catch (error) {
        console.error("Error in audio processing complete:", error);
      }
    } else {
      console.log("🎯 [VOICE RECORDER] No suitable callback or missing data");
      console.log("🎯 [VOICE RECORDER] onDiarizedResultComplete:", !!onDiarizedResultComplete, "onAudioProcessingComplete:", !!onAudioProcessingComplete);
      console.log("🎯 [VOICE RECORDER] utterances:", !!result.utterances, "audioBlob:", !!result.audioBlob);
    }
  }, []); // Keep empty until parent callback is truly stable

  // Handler for Web Speech results (real-time transcription)
  // NOTE: Now properly memoized with onTranscriptUpdate dependency
  const handleSpeechResult = useCallback(({ 
    transcript: result, 
    isFinal, 
    resultIndex 
  }: { 
    transcript: string, 
    isFinal: boolean, 
    resultIndex: number
  }) => {
    // For diagnostic purposes
    console.log("Received speech result:", { result, isFinal, resultIndex });
    
    if (!result) {
      console.log("Empty result received, ignoring");
      return;
    }
    
    // Check for specific error messages
    if (result.startsWith('Error:')) {
      console.error("Error in speech recognition:", result);
      return;
    }
    
    if (isFinal) {
      // Add the new text to the raw transcript - ensure it's on a new line if needed
      setRawTranscript(prev => {
        // If we're starting a new utterance and the previous doesn't end with a newline, add one
        let newRawTranscript;
        if (prev === '') {
          newRawTranscript = result;
        } else if (prev.endsWith('\n\n')) {
          newRawTranscript = prev + result;
        } else {
          newRawTranscript = prev + '\n\n' + result;
        }
        
        currentTranscriptRef.current = newRawTranscript;
        return newRawTranscript;
      });
      
    } else {
      // For non-final results, show them as temporary text in real-time
      const updatedTranscript = currentTranscriptRef.current + 
        (currentTranscriptRef.current && !currentTranscriptRef.current.endsWith('\n\n') ? '\n\n' : '') + 
        result + '...'; // Show ellipsis for non-final results
      
      // Update both the reference and the parent component
      onTranscriptUpdate(updatedTranscript);
    }
  }, [onTranscriptUpdate]); // Now that parent callback is stable

  // Safe toast functions to avoid render-time calls

  // Initialize dual transcription
  const {
    isRecording: dualIsRecording, 
    detectedLanguage,
    startRecording, 
    stopRecording,
    toggleRecording: dualToggleRecording,
    resetTranscript,
    getAccumulatedTranscript,
    lastRecordedBlob,
    downloadLastRecording
  } = useDualTranscription({
    onRealtimeResult: handleSpeechResult,
    onDiarizedResult: handleDiarizedResult,
    onSilence: handleSilence,
    pauseThreshold,
    deepgramApiKey
  });
  
  // Update local recording state when dual recording state changes
  useEffect(() => {
    setIsRecording(dualIsRecording);
    if (dualIsRecording) setJustStopped(false);
    
    if (onRecordingStateChange) {
      onRecordingStateChange(dualIsRecording);
    }
  }, [dualIsRecording, onRecordingStateChange]);

  // Log when transcript changes - useful for debugging
  useEffect(() => {
    console.log("VoiceRecorder raw transcript:", rawTranscript);
    
    // Ensure full transcript is passed to parent component
    if (rawTranscript) {
      updateTranscriptDebounced(rawTranscript);
    }
  }, [rawTranscript]);

  // Improved transcript update function with better real-time performance
  const updateTranscriptDebounced = (newTranscript: string) => {
    if (transcriptUpdateTimeoutRef.current) {
      clearTimeout(transcriptUpdateTimeoutRef.current);
    }
    
    // Update immediately for better real-time feel
    onTranscriptUpdate(newTranscript);
    
    // Also schedule a debounced update to catch any pending changes
    transcriptUpdateTimeoutRef.current = setTimeout(() => {
      onTranscriptUpdate(newTranscript);
    }, 50); // Small delay for better responsiveness
  };

  // Start a new session
  const startNewSession = async () => {
    setJustStopped(false);
    // REMOVE duplicate audio processing - this is now handled by useDualTranscription
    
    // Reset everything
    resetTranscript();
    setTranscript('');
    setRawTranscript('');
    setDiarizedTranscript('');
    diarizedMessagesRef.current = [];
    onTranscriptUpdate('');
    onNewPatient?.();
  };

  // Handle stopping recording
  const handleStopRecording = async () => {
    setJustStopped(true);
    // Clear any pending transcript timeouts
    if (transcriptUpdateTimeoutRef.current) {
      clearTimeout(transcriptUpdateTimeoutRef.current);
      transcriptUpdateTimeoutRef.current = null;
    }
    
    setProcessingTranscript(true);
    
    // Stop recording
    stopRecording();
    
    // Setup audio recording for Deepgram processing
    try {
      // Use MediaRecorder API to capture audio
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = async () => {
        // Save the audio blob for later processing
        const recordedBlob = new Blob(audioChunks, { type: 'audio/webm' });
        setAudioBlob(recordedBlob);
        
        // REMOVE duplicate processing - this is now handled by useDualTranscription
        
        setProcessingTranscript(false);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      // Start recording for a short period to capture audio
      mediaRecorder.start();
      
      // Stop after a fixed amount of time (e.g., 5 seconds)
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 5000);
      
    } catch (error) {
      console.error("Error setting up audio recording:", error);
      setProcessingTranscript(false);
    }
  };

  // Handle toggling recording
  const handleToggleRecording = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      // Reset raw transcript for new session
      if (isNewSession) {
        setRawTranscript('');
        setDiarizedTranscript('');
        diarizedMessagesRef.current = [];
        currentTranscriptRef.current = '';
      }
      
      // Trigger patient creation if needed before starting recording
      onRecordingStart?.();
      
      dualToggleRecording();
    }
  };


  // Component UI with improved feedback on connection status
  return (
    <div className="space-y-4">
      <Card className="border-2 border-doctor-primary/30 shadow-md">
        <CardContent className="p-4 bg-gradient-to-r from-doctor-primary/10 to-transparent">
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <Button 
                onClick={handleToggleRecording}
                className={cn(
                  "w-16 h-16 rounded-full flex justify-center items-center shadow-lg transition-all mx-auto sm:mx-0",
                  isRecording 
                    ? "bg-destructive hover:bg-destructive/90" 
                    : "bg-doctor-primary hover:bg-doctor-primary/90"
                )}
                disabled={processingTranscript}
              >
                {isRecording ? (
                  <MicOff className="h-8 w-8" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </Button>
              
              <Button
                onClick={startNewSession}
                className="w-16 h-16 rounded-full flex justify-center items-center bg-doctor-accent hover:bg-doctor-accent/90 shadow-lg transition-all mx-auto sm:mx-0"
                disabled={isRecording || processingTranscript}
              >
                <UserPlus className="h-8 w-8" />
              </Button>
              
              <Button
                onClick={downloadLastRecording}
                className="w-16 h-16 rounded-full flex justify-center items-center bg-green-600 hover:bg-green-700 shadow-lg transition-all mx-auto sm:mx-0"
                disabled={!lastRecordedBlob || isRecording}
                title="Download last recording"
              >
                <Download className="h-8 w-8" />
              </Button>
            </div>
            
            <div className="text-center">
              {isRecording ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full animate-pulse bg-destructive"></span>
                    <span className="font-medium">Recording</span>
                  </div>
                </div>
              ) : (justStopped || processingTranscript) ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-doctor-secondary animate-pulse"></span>
                    <span className="font-medium">Recording stopped</span>
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground">
                  Press record to start a new session
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceRecorder;
