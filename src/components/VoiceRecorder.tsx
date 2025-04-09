
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/lib/toast';
import useSpeechRecognition from '@/hooks/useSpeechRecognition';
import { usePatientIdentification } from '@/hooks/usePatientIdentification';
import RecordingControls from '@/components/RecordingControls';
import RecordingStatus from '@/components/RecordingStatus';

interface VoiceRecorderProps {
  onTranscriptUpdate: (transcript: string) => void;
  onPatientInfoUpdate: (patientInfo: { name: string; time: string }) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  onNewPatient?: () => void;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ 
  onTranscriptUpdate, 
  onPatientInfoUpdate,
  onRecordingStateChange,
  onNewPatient
}) => {
  // State variables
  const [rawTranscript, setRawTranscript] = useState(''); 
  const [pauseThreshold] = useState(1500); // 1.5 seconds
  const [processingTranscript, setProcessingTranscript] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // Refs
  const currentTranscriptRef = useRef<string>('');
  const isFirstInteractionRef = useRef<boolean>(true);
  const transcriptUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Custom hooks
  const { 
    showPatientIdentified,
    isNewSession,
    attemptPatientIdentification,
    resetPatientIdentification
  } = usePatientIdentification({
    onPatientIdentified: onPatientInfoUpdate
  });
  
  // Log when transcript changes - useful for debugging
  useEffect(() => {
    console.log("VoiceRecorder raw transcript:", rawTranscript);
    
    // Ensure full transcript is passed to parent component
    if (rawTranscript) {
      updateTranscriptDebounced(rawTranscript);
    }
  }, [rawTranscript]);

  // Notify parent about recording state changes
  useEffect(() => {
    if (onRecordingStateChange) {
      onRecordingStateChange(isRecording);
    }
  }, [isRecording, onRecordingStateChange]);

  // Handle silence - add a line break to separate utterances
  const handleSilence = () => {
    // Add line break to help separate different speech segments
    setRawTranscript(prev => {
      if (prev.endsWith('\n\n')) return prev;
      return prev + "\n\n";
    });
  };

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

  // Initialize Web Speech Recognition
  const { 
    isRecording: webSpeechIsRecording, 
    detectedLanguage,
    startRecording, 
    stopRecording,
    resetTranscript
  } = useSpeechRecognition({
    onResult: handleSpeechResult,
    onSilence: handleSilence,
    pauseThreshold
  });
  
  // Update local recording state when web speech recording state changes
  useEffect(() => {
    setIsRecording(webSpeechIsRecording);
  }, [webSpeechIsRecording]);

  // Improved speech result handler with better real-time updates
  function handleSpeechResult({ transcript: result, isFinal, resultIndex }: { 
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
      if (isNewSession) {
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

  // Start a new session
  const startNewSession = () => {
    // Stop recording if it's active
    if (isRecording) {
      stopRecording();
    }
    
    // Reset all local state
    resetTranscript();
    setRawTranscript('');
    onTranscriptUpdate('');
    resetPatientIdentification();
    currentTranscriptRef.current = '';
    isFirstInteractionRef.current = true;
    
    // Call the parent's onNewPatient handler if provided
    if (onNewPatient) {
      console.log("Calling parent onNewPatient handler");
      onNewPatient();
    } else {
      toast.success('Ready for new patient');
    }
  };

  // Handle stopping recording
  const handleStopRecording = () => {
    // Clear any pending transcript timeouts
    if (transcriptUpdateTimeoutRef.current) {
      clearTimeout(transcriptUpdateTimeoutRef.current);
      transcriptUpdateTimeoutRef.current = null;
    }
    
    // Stop recording
    stopRecording();
  };

  // Handle toggling recording
  const handleToggleRecording = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      // Reset raw transcript for new session
      if (isNewSession) {
        setRawTranscript('');
        currentTranscriptRef.current = '';
      }
      
      startRecording();
    }
  };

  // Component UI with improved feedback on connection status
  return (
    <div className="space-y-4">
      <Card className="border-2 border-doctor-primary/30 shadow-md">
        <CardContent className="p-4 bg-gradient-to-r from-doctor-primary/10 to-transparent">
          <div className="flex flex-col items-center gap-4">
            <RecordingControls 
              isRecording={isRecording}
              isProcessing={processingTranscript}
              onToggleRecording={handleToggleRecording}
              onNewPatient={startNewSession}
            />
            
            <RecordingStatus 
              isRecording={isRecording}
              isProcessing={processingTranscript}
              detectedLanguage={detectedLanguage}
              isNewSession={isNewSession}
              showPatientIdentified={showPatientIdentified}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceRecorder;
