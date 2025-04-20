import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, UserPlus, Globe, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import useDualTranscription from '@/hooks/useDualTranscription';
import { DeepgramResult } from '@/utils/deepgramSpeechToText';

interface VoiceRecorderProps {
  onTranscriptUpdate: (transcript: string) => void;
  onDiarizedTranscriptUpdate?: (transcript: string) => void;
  onPatientInfoUpdate: (patientInfo: { name: string; time: string }) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ 
  onTranscriptUpdate, 
  onDiarizedTranscriptUpdate,
  onPatientInfoUpdate,
  onRecordingStateChange
}) => {
  // State variables
  const [transcript, setTranscript] = useState('');
  const [rawTranscript, setRawTranscript] = useState(''); 
  const [diarizedTranscript, setDiarizedTranscript] = useState('');
  const [isNewSession, setIsNewSession] = useState(true);
  const [pauseThreshold, setPauseThreshold] = useState(1500); // 1.5 seconds
  const [showPatientIdentified, setShowPatientIdentified] = useState(false);
  const [processingTranscript, setProcessingTranscript] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  // Refs
  const currentTranscriptRef = useRef<string>('');
  const diarizedMessagesRef = useRef<string[]>([]);
  const isFirstInteractionRef = useRef<boolean>(true);
  const patientIdentifiedRef = useRef<boolean>(false);
  const patientNameScanAttempts = useRef<number>(0);
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

  // Safe toast functions to avoid render-time calls
  const showSuccessToast = useCallback((message: string) => {
    setTimeout(() => {
      toast.success(message);
    }, 0);
  }, []);

  // Initialize dual transcription
  const { 
    isRecording: dualIsRecording, 
    detectedLanguage,
    startRecording, 
    stopRecording,
    toggleRecording: dualToggleRecording,
    resetTranscript,
    getAccumulatedTranscript,
    processFinalAudio
  } = useDualTranscription({
    onRealtimeResult: handleSpeechResult,
    onSilence: handleSilence,
    pauseThreshold,
    deepgramApiKey
  });
  
  // Update local recording state when dual recording state changes
  useEffect(() => {
    setIsRecording(dualIsRecording);
    
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

  // Handler for Web Speech results (real-time transcription)
  function handleSpeechResult({ 
    transcript: result, 
    isFinal, 
    resultIndex 
  }: { 
    transcript: string, 
    isFinal: boolean, 
    resultIndex: number
  }) {
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
      
      // Check for patient identification in initial conversations
      if (isNewSession && !patientIdentifiedRef.current) {
        attemptPatientIdentification(result);
      }
    } else {
      // For non-final results, show them as temporary text in real-time
      const updatedTranscript = currentTranscriptRef.current + 
        (currentTranscriptRef.current && !currentTranscriptRef.current.endsWith('\n\n') ? '\n\n' : '') + 
        result + '...'; // Show ellipsis for non-final results
      
      // Update both the reference and the parent component
      onTranscriptUpdate(updatedTranscript);
    }
  }
  
  // Try to extract patient name from greeting patterns
  const extractPatientName = (text: string): string | null => {
    return null;
  };
  
  // Multiple attempts to identify patient name
  function attemptPatientIdentification(text: string) {
    console.log("Checking for patient name in:", text);
    
    // Try to extract patient name
    patientNameScanAttempts.current += 1;
    const extractedName = extractPatientName(text);
    
    if (extractedName) {
      const currentTime = new Date().toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      const identifiedPatient = {
        name: extractedName,
        time: currentTime
      };
      
      console.log("Patient identified through extraction:", identifiedPatient);
      onPatientInfoUpdate(identifiedPatient);
      setIsNewSession(false);
      patientIdentifiedRef.current = true;
      
      // Show success notification using setTimeout to avoid render-time state changes
      setShowPatientIdentified(true);
      setTimeout(() => {
        setShowPatientIdentified(false);
      }, 3000);
      
      showSuccessToast(`Patient identified: ${extractedName}`);
      isFirstInteractionRef.current = false;
      return;
    }
    
    // After several attempts, try capitalized words
    if (patientNameScanAttempts.current > 3) {
      const capitalizedWords = text.match(/\b[A-Z][a-z]{2,}\b/g);
      if (capitalizedWords && capitalizedWords.length > 0) {
        const possibleName = capitalizedWords[0];
        const currentTime = new Date().toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        const suggestedPatient = {
          name: possibleName,
          time: currentTime
        };
        
        console.log("Suggested patient from capitalized words:", suggestedPatient);
        onPatientInfoUpdate(suggestedPatient);
        setIsNewSession(false);
        patientIdentifiedRef.current = true;
        
        // Show notification
        setShowPatientIdentified(true);
        setTimeout(() => {
          setShowPatientIdentified(false);
        }, 3000);
        
        showSuccessToast(`Patient identified: ${possibleName}`);
        isFirstInteractionRef.current = false;
      }
    }
  }

  // Start a new session
  const startNewSession = async () => {
    // Process final audio for improved diarization if we have recorded audio
    if (audioBlob) {
      setProcessingTranscript(true);
      
      // Get final diarized transcript if possible
      try {
        const finalDiarizedTranscript = await processFinalAudio(audioBlob);
        if (finalDiarizedTranscript && onDiarizedTranscriptUpdate) {
          setDiarizedTranscript(finalDiarizedTranscript);
          onDiarizedTranscriptUpdate(finalDiarizedTranscript);
        }
      } catch (error) {
        console.error("Error processing final audio:", error);
      }
      
      setProcessingTranscript(false);
      setAudioBlob(null);
    }
    
    // Reset everything
    resetTranscript();
    setTranscript('');
    setRawTranscript('');
    setDiarizedTranscript('');
    diarizedMessagesRef.current = [];
    onTranscriptUpdate('');
    if (onDiarizedTranscriptUpdate) onDiarizedTranscriptUpdate('');
    
    setIsNewSession(true);
    isFirstInteractionRef.current = true;
    patientIdentifiedRef.current = false;
    patientNameScanAttempts.current = 0;
    currentTranscriptRef.current = '';
    setShowPatientIdentified(false);
    
    showSuccessToast('Ready for new patient');
  };

  // Handle stopping recording
  const handleStopRecording = async () => {
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
        
        // Process with Deepgram now if needed
        if (onDiarizedTranscriptUpdate) {
          try {
            const finalDiarizedTranscript = await processFinalAudio(recordedBlob);
            if (finalDiarizedTranscript) {
              setDiarizedTranscript(finalDiarizedTranscript);
              onDiarizedTranscriptUpdate(finalDiarizedTranscript);
            }
          } catch (error) {
            console.error("Error processing final audio:", error);
          }
        }
        
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
      
      dualToggleRecording();
    }
  };

  // Get connection status display info
  const getConnectionStatusInfo = () => {
    if (processingTranscript) {
      return {
        color: "bg-blue-500",
        text: "Processing",
        subtext: "Processing transcript with Deepgram...",
        icon: <RotateCw className="h-4 w-4 animate-spin" />
      };
    }

    if (isRecording) {
      return {
        color: "bg-green-500",
        text: "Recording",
        subtext: `Using Web Speech (${detectedLanguage})`,
        icon: <Globe className="h-4 w-4" />
      };
    } else {
      return {
        color: "bg-slate-400",
        text: "Ready",
        subtext: "Press record to start",
        icon: <Globe className="h-4 w-4" />
      };
    }
  };

  const statusInfo = getConnectionStatusInfo();

  // Component UI with improved feedback on connection status
  return (
    <div className="space-y-4">
      <Card className="border-2 border-doctor-primary/30 shadow-md">
        <CardContent className="p-4 bg-gradient-to-r from-doctor-primary/10 to-transparent">
          <div className="flex flex-col items-center gap-4">
            <div className="flex space-x-4">
              <Button 
                onClick={handleToggleRecording}
                className={cn(
                  "w-16 h-16 rounded-full flex justify-center items-center shadow-lg transition-all",
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
                className="w-16 h-16 rounded-full flex justify-center items-center bg-doctor-accent hover:bg-doctor-accent/90 shadow-lg transition-all"
                disabled={isRecording || processingTranscript}
              >
                <UserPlus className="h-8 w-8" />
              </Button>
            </div>
            
            <div className="text-center">
              {isRecording ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full animate-pulse bg-destructive"></span>
                    <span className="font-medium">Recording</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Using Web Speech ({detectedLanguage})
                  </div>
                </div>
              ) : processingTranscript ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-blue-500 animate-pulse"></span>
                    <span className="font-medium">Processing</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Processing transcript with Deepgram...
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground">
                  {isNewSession ? 
                    "Start with 'Hello [patient name]' or 'Hi [patient name]'" : 
                    "Press to resume recording"
                  }
                </span>
              )}
            </div>
            
            {/* Patient identified animation - only shows temporarily */}
            {showPatientIdentified && (
              <div className="animate-fade-in text-sm font-medium text-doctor-accent">
                Patient identified!
              </div>
            )}
            
            {/* Connection status indicator */}
            <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-gray-50">
              <div className={cn("h-3 w-3 rounded-full", statusInfo.color)}></div>
              <div className="flex flex-col">
                <div className="text-sm font-medium flex items-center gap-1">
                  {statusInfo.icon}
                  <span>{statusInfo.text}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {statusInfo.subtext}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceRecorder;
