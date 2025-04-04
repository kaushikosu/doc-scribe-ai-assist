
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, UserPlus, Globe, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import useDeepgramSpeechToText from '@/hooks/useDeepgramSpeechToText';
import { PatientInfo } from '@/utils/speaker';

// Default Deepgram API key from environment
const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY || "";

interface VoiceRecorderProps {
  onTranscriptUpdate: (transcript: string) => void;
  onPatientInfoUpdate: (patientInfo: { name: string; time: string }) => void;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ 
  onTranscriptUpdate, 
  onPatientInfoUpdate 
}) => {
  // State variables
  const [transcript, setTranscript] = useState('');
  const [rawTranscript, setRawTranscript] = useState(''); 
  const [isNewSession, setIsNewSession] = useState(true);
  const [pauseThreshold, setPauseThreshold] = useState(1500); // 1.5 seconds
  const [showPatientIdentified, setShowPatientIdentified] = useState(false);
  const [apiKey] = useState<string>(DEEPGRAM_API_KEY);
  const [speakerMap, setSpeakerMap] = useState<Map<number, string>>(new Map([[1, 'Doctor'], [2, 'Patient']]));
  const [connectionErrorCount, setConnectionErrorCount] = useState(0);
  
  // Refs
  const currentTranscriptRef = useRef<string>('');
  const isFirstInteractionRef = useRef<boolean>(true);
  const patientIdentifiedRef = useRef<boolean>(false);
  const patientNameScanAttempts = useRef<number>(0);
  const transcriptUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speakersDetectedRef = useRef<Set<number>>(new Set());

  // Log when transcript changes - useful for debugging
  useEffect(() => {
    console.log("VoiceRecorder raw transcript:", rawTranscript);
    
    // Ensure full transcript is passed to parent component
    if (rawTranscript) {
      updateTranscriptDebounced(rawTranscript);
    }
  }, [rawTranscript]);

  // Handle silence - add a line break to separate utterances
  const handleSilence = () => {
    // Add line break to help separate different speech segments
    setRawTranscript(prev => {
      if (prev.endsWith('\n')) return prev;
      return prev + "\n";
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

  // Try to extract patient name from greeting patterns
  const extractPatientName = (text: string): string | null => {
    // Common greeting patterns
    const patterns = [
      /(?:namaste|hello|hi|hey)\s+([A-Z][a-z]{2,})/i,
      /(?:patient|patient's) name is\s+([A-Z][a-z]{2,})/i,
      /(?:this is|i am|i'm)\s+([A-Z][a-z]{2,})/i,
      /Mr\.|Mrs\.|Ms\.|Dr\.\s+([A-Z][a-z]{2,})/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    // Fallback: try to find any capitalized word after greeting
    const simpleMatch = text.match(/(?:namaste|hello|hi|hey)\s+(\w+)/i);
    if (simpleMatch && simpleMatch[1]) {
      return simpleMatch[1].charAt(0).toUpperCase() + simpleMatch[1].slice(1);
    }
    
    return null;
  };

  // Initialize Deepgram Speech Recognition
  const { 
    isRecording, 
    connectionStatus,
    toggleRecording, 
    startRecording, 
    stopRecording,
    getAccumulatedTranscript,
    resetTranscript
  } = useDeepgramSpeechToText({
    onResult: handleSpeechResult,
    onSilence: handleSilence,
    pauseThreshold,
    apiKey
  });
  
  // Monitor connection status
  useEffect(() => {
    if (connectionStatus === 'failed') {
      setConnectionErrorCount(prev => prev + 1);
      
      // If we've had multiple failures, show a more persistent error
      if (connectionErrorCount > 2) {
        toast.error("Experiencing connection issues. Please check your internet connection.", {
          duration: 5000
        });
      }
    } else if (connectionStatus === 'open') {
      // Reset error count on successful connection
      setConnectionErrorCount(0);
    }
  }, [connectionStatus]);

  // Improved speech result handler with better real-time updates
  function handleSpeechResult({ transcript: result, isFinal, resultIndex, speakerTag }: { 
    transcript: string, 
    isFinal: boolean, 
    resultIndex: number,
    speakerTag?: number 
  }) {
    // For diagnostic purposes
    console.log("Received speech result:", { result, isFinal, resultIndex, speakerTag });
    
    if (!result) {
      console.log("Empty result received, ignoring");
      return;
    }
    
    // Check for specific error messages
    if (result.startsWith('Error:')) {
      console.error("Error in speech recognition:", result);
      return;
    }
    
    // Track speakers we've seen
    if (typeof speakerTag === 'number' && speakerTag > 0) {
      speakersDetectedRef.current.add(speakerTag);
      console.log(`Speaker ${speakerTag} detected. Total speakers: ${speakersDetectedRef.current.size}`);
    }
    
    if (isFinal) {
      // Add the new text to the raw transcript - ensure it's on a new line if needed
      setRawTranscript(prev => {
        // If we're starting a new utterance and the previous doesn't end with a newline, add one
        let newRawTranscript;
        if (prev === '') {
          newRawTranscript = result;
        } else if (prev.endsWith('\n')) {
          newRawTranscript = prev + result;
        } else {
          newRawTranscript = prev + '\n' + result;
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
      // Add the non-final result to the current transcript for real-time feedback
      const updatedTranscript = currentTranscriptRef.current + 
        (currentTranscriptRef.current && !currentTranscriptRef.current.endsWith('\n') ? '\n' : '') + 
        result + '...'; // Show ellipsis for non-final results
      
      // Update both the reference and the parent component
      onTranscriptUpdate(updatedTranscript);
    }
  }
  
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
      
      // Show success notification
      setShowPatientIdentified(true);
      setTimeout(() => {
        setShowPatientIdentified(false);
      }, 3000);
      
      toast.success(`Patient identified: ${extractedName}`);
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
        
        toast.success(`Patient identified: ${possibleName}`);
        isFirstInteractionRef.current = false;
      }
    }
  }

  // Start a new session
  const startNewSession = () => {
    resetTranscript();
    setTranscript('');
    setRawTranscript('');
    onTranscriptUpdate('');
    setIsNewSession(true);
    isFirstInteractionRef.current = true;
    patientIdentifiedRef.current = false;
    patientNameScanAttempts.current = 0;
    currentTranscriptRef.current = '';
    setShowPatientIdentified(false);
    speakersDetectedRef.current.clear();
    
    toast.success('Ready for new patient');
  };

  // Handle stopping recording
  const handleStopRecording = () => {
    // Clear any pending transcript timeouts
    if (transcriptUpdateTimeoutRef.current) {
      clearTimeout(transcriptUpdateTimeoutRef.current);
      transcriptUpdateTimeoutRef.current = null;
    }
    
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
            <div className="flex space-x-4">
              <Button 
                onClick={handleToggleRecording}
                className={cn(
                  "w-16 h-16 rounded-full flex justify-center items-center shadow-lg transition-all",
                  isRecording 
                    ? "bg-destructive hover:bg-destructive/90" 
                    : "bg-doctor-primary hover:bg-doctor-primary/90"
                )}
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
                disabled={isRecording}
              >
                <UserPlus className="h-8 w-8" />
              </Button>
            </div>
            
            <div className="text-center">
              {isRecording ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "h-3 w-3 rounded-full", 
                      connectionStatus === 'open' 
                        ? "bg-destructive animate-pulse"
                        : "bg-amber-500 animate-pulse"
                    )}></span>
                    <span className="font-medium">
                      {connectionStatus === 'open' 
                        ? "Recording with Deepgram" 
                        : "Connecting to Deepgram..."}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {connectionStatus === 'open' ? 
                      'Connected and streaming audio...' : 
                      connectionStatus === 'connecting' ? 
                      'Connecting to Deepgram...' :
                      connectionStatus === 'failed' ?
                      'Connection issues - trying to reconnect...' :
                      'Waiting for connection...'}
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground">
                  {isNewSession ? 
                    "Start with 'Namaste [patient name]' or 'Hello [patient name]'" : 
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
            <div className="flex items-center gap-2 mt-2">
              {connectionStatus === 'failed' && connectionErrorCount > 1 ? (
                <div className="flex items-center gap-1 text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Connection issues</span>
                </div>
              ) : (
                <>
                  <Globe className="h-4 w-4 text-doctor-primary" />
                  <div className="text-sm font-medium">
                    {isRecording ? 
                      `Using Deepgram real-time transcription with diarization` : 
                      'Automatic speaker detection enabled'
                    }
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceRecorder;
