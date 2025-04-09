import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, UserPlus, Globe, RotateCw, Loader } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import useSpeechRecognition from '@/hooks/useSpeechRecognition';

interface VoiceRecorderProps {
  onTranscriptUpdate: (transcript: string) => void;
  onPatientInfoUpdate: (patientInfo: { name: string; time: string }) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  onNewPatient?: () => void;
  onProcessingStateChange?: (isProcessing: boolean) => void;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ 
  onTranscriptUpdate, 
  onPatientInfoUpdate,
  onRecordingStateChange,
  onNewPatient,
  onProcessingStateChange
}) => {
  const [transcript, setTranscript] = useState('');
  const [rawTranscript, setRawTranscript] = useState(''); 
  const [isNewSession, setIsNewSession] = useState(true);
  const [pauseThreshold, setPauseThreshold] = useState(1500);
  const [showPatientIdentified, setShowPatientIdentified] = useState(false);
  const [processingTranscript, setProcessingTranscript] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  const currentTranscriptRef = useRef<string>('');
  const isFirstInteractionRef = useRef<boolean>(true);
  const patientIdentifiedRef = useRef<boolean>(false);
  const patientNameScanAttempts = useRef<number>(0);
  const transcriptUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    console.log("VoiceRecorder raw transcript:", rawTranscript);
    
    if (rawTranscript) {
      currentTranscriptRef.current = rawTranscript;
      updateTranscriptDebounced(rawTranscript);
    }
  }, [rawTranscript]);

  useEffect(() => {
    if (onRecordingStateChange) {
      onRecordingStateChange(isRecording);
    }
  }, [isRecording, onRecordingStateChange]);
  
  useEffect(() => {
    if (onProcessingStateChange) {
      onProcessingStateChange(processingTranscript);
    }
  }, [processingTranscript, onProcessingStateChange]);

  const handleSilence = () => {
    setRawTranscript(prev => {
      if (prev.endsWith('\n\n')) return prev;
      return prev + "\n\n";
    });
  };

  const updateTranscriptDebounced = (newTranscript: string) => {
    if (transcriptUpdateTimeoutRef.current) {
      clearTimeout(transcriptUpdateTimeoutRef.current);
    }
    
    onTranscriptUpdate(newTranscript);
    transcriptUpdateTimeoutRef.current = setTimeout(() => {
      onTranscriptUpdate(newTranscript);
    }, 50);
  };

  const extractPatientName = (text: string): string | null => {
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
    
    const simpleMatch = text.match(/(?:namaste|hello|hi|hey)\s+(\w+)/i);
    if (simpleMatch && simpleMatch[1]) {
      return simpleMatch[1].charAt(0).toUpperCase() + simpleMatch[1].slice(1);
    }
    
    return null;
  };

  const { 
    isRecording: webSpeechIsRecording, 
    detectedLanguage,
    processingStatus,
    startRecording, 
    stopRecording,
    setIdle,
    toggleRecording: webToggleRecording,
    getAccumulatedTranscript,
    resetTranscript
  } = useSpeechRecognition({
    onResult: handleSpeechResult,
    onSilence: handleSilence,
    pauseThreshold
  });
  
  useEffect(() => {
    setIsRecording(webSpeechIsRecording);
    setProcessingTranscript(processingStatus === 'processing');
    
    if (processingStatus === 'idle' && processingTranscript) {
      setProcessingTranscript(false);
    }
  }, [webSpeechIsRecording, processingStatus, processingTranscript]);

  function handleSpeechResult({ transcript: result, isFinal, resultIndex }: { 
    transcript: string, 
    isFinal: boolean, 
    resultIndex: number
  }) {
    console.log("Received speech result:", { result, isFinal, resultIndex });
    
    if (!result) {
      console.log("Empty result received, ignoring");
      return;
    }
    
    if (result === "Processing..." || result === "Listening...") {
      console.log("Skipping UI state message:", result);
      return;
    }
    
    if (result.startsWith('Error:')) {
      console.error("Error in speech recognition:", result);
      return;
    }
    
    if (isFinal) {
      setRawTranscript(prev => {
        const updatedTranscript = prev === '' ? result : 
          prev.endsWith('\n\n') ? prev + result : prev + '\n\n' + result;
        currentTranscriptRef.current = updatedTranscript;
        return updatedTranscript;
      });
      
      if (isNewSession && !patientIdentifiedRef.current) {
        attemptPatientIdentification(result);
      }
    } else {
      const updatedTranscript = currentTranscriptRef.current + 
        (currentTranscriptRef.current && !currentTranscriptRef.current.endsWith('\n\n') ? '\n\n' : '') + 
        result + '...';
      
      onTranscriptUpdate(updatedTranscript);
    }
  }

  function attemptPatientIdentification(text: string) {
    console.log("Checking for patient name in:", text);
    
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
      
      setShowPatientIdentified(true);
      setTimeout(() => {
        setShowPatientIdentified(false);
      }, 3000);
      
      toast.success(`Patient identified: ${extractedName}`);
      isFirstInteractionRef.current = false;
      return;
    }
    
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
        
        setShowPatientIdentified(true);
        setTimeout(() => {
          setShowPatientIdentified(false);
        }, 3000);
        
        toast.success(`Patient identified: ${possibleName}`);
        isFirstInteractionRef.current = false;
      }
    }
  }

  const startNewSession = () => {
    if (isRecording) {
      stopRecording();
    }
    
    resetTranscript();
    setTranscript('');
    setRawTranscript('');
    currentTranscriptRef.current = '';
    onTranscriptUpdate('');
    setIsNewSession(true);
    isFirstInteractionRef.current = true;
    patientIdentifiedRef.current = false;
    patientNameScanAttempts.current = 0;
    setShowPatientIdentified(false);
    setProcessingTranscript(false);
    setIdle(); // Reset the processing status
    
    onPatientInfoUpdate({
      name: '',
      time: ''
    });
    
    if (transcriptUpdateTimeoutRef.current) {
      clearTimeout(transcriptUpdateTimeoutRef.current);
      transcriptUpdateTimeoutRef.current = null;
    }
    
    if (onNewPatient) {
      onNewPatient();
    }
    
    toast.success('Ready for new patient');
  };

  const handleStopRecording = () => {
    if (transcriptUpdateTimeoutRef.current) {
      clearTimeout(transcriptUpdateTimeoutRef.current);
      transcriptUpdateTimeoutRef.current = null;
    }
    
    stopRecording();
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      if (isNewSession) {
        setRawTranscript('');
        currentTranscriptRef.current = '';
      }
      
      startRecording();
    }
  };

  const getConnectionStatusInfo = () => {
    if (processingTranscript) {
      return {
        color: "bg-blue-500",
        text: "Processing",
        subtext: "Processing transcript...",
        icon: <RotateCw className="h-4 w-4 animate-spin" />
      };
    }

    if (isRecording) {
      return {
        color: "bg-green-500",
        text: "Recording",
        subtext: `Using ${detectedLanguage} language`,
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
                disabled={processingTranscript}
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
                    Using Web Speech Recognition ({detectedLanguage})
                  </div>
                </div>
              ) : processingTranscript ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-blue-500 animate-pulse"></span>
                    <span className="font-medium">Processing</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader className="h-3 w-3 animate-spin" />
                    Processing transcript...
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
            
            {showPatientIdentified && (
              <div className="animate-fade-in text-sm font-medium text-doctor-accent">
                Patient identified!
              </div>
            )}
            
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
