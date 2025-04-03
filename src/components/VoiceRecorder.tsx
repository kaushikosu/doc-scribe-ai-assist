
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, UserPlus, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import useSpeechRecognition from '@/hooks/useSpeechRecognition';
import { 
  detectSpeaker, 
  detectPatientInfo,
  PatientInfo
} from '@/utils/speakerDetection';

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
  const [isNewSession, setIsNewSession] = useState(true);
  const [lastProcessedIndex, setLastProcessedIndex] = useState(0);
  const [lastSpeaker, setLastSpeaker] = useState<'Doctor' | 'Patient' | 'Identifying'>('Doctor');
  const [pauseThreshold, setPauseThreshold] = useState(1500); // 1.5 seconds (reduced for faster response)
  const [currentSilenceTime, setCurrentSilenceTime] = useState(0);
  const [speakerChanged, setSpeakerChanged] = useState(false);
  const [showPatientIdentified, setShowPatientIdentified] = useState(false);

  // Refs
  const interimTranscriptRef = useRef<string>('');
  const isFirstInteractionRef = useRef<boolean>(true);
  const patientIdentifiedRef = useRef<boolean>(false);
  const accumulatedTranscriptRef = useRef<string>('');
  const patientNameScanAttempts = useRef<number>(0);
  
  // NEW: Track continuous text for better name detection
  const continuousTextBufferRef = useRef<string>('');
  
  const conversationContextRef = useRef<{
    isPatientDescribingSymptoms: boolean;
    doctorAskedQuestion: boolean;
    patientResponded: boolean;
    isPrescribing: boolean;
    isGreeting: boolean;
  }>({
    isPatientDescribingSymptoms: false,
    doctorAskedQuestion: false,
    patientResponded: false,
    isPrescribing: false,
    isGreeting: true
  });

  // Handle silence detection
  const handleSilence = () => {
    if (lastSpeaker !== 'Identifying') {
      const newSpeaker = lastSpeaker === 'Doctor' ? 'Patient' : 'Doctor';
      setLastSpeaker(newSpeaker);
      setSpeakerChanged(true);
      
      // Only flash animation on actual speaker change
      setTimeout(() => {
        setSpeakerChanged(false);
      }, 2000);
    }
  };

  // NEW: Check for patient name in buffered text
  const checkForPatientName = (textToCheck: string) => {
    if (!isNewSession || patientIdentifiedRef.current) return;
    
    console.log("Checking for patient name in:", textToCheck);
    const patientInfo = detectPatientInfo(textToCheck);
    
    if (patientInfo) {
      console.log("Patient identified:", patientInfo);
      onPatientInfoUpdate(patientInfo);
      setIsNewSession(false);
      patientIdentifiedRef.current = true;
      
      // Show the patient identified notification temporarily
      setShowPatientIdentified(true);
      setTimeout(() => {
        setShowPatientIdentified(false);
      }, 3000); // Hide after 3 seconds
      
      toast.success(`Patient identified: ${patientInfo.name}`);
      isFirstInteractionRef.current = false;
    } else {
      // Increment the scan attempt counter
      patientNameScanAttempts.current += 1;
      
      // After several attempts, check if there are common name patterns
      if (patientNameScanAttempts.current > 5) {
        // Try to extract possible names from capitalized words
        const capitalizedWords = textToCheck.match(/\b[A-Z][a-z]{2,}\b/g);
        if (capitalizedWords && capitalizedWords.length > 0) {
          // Use the first capitalized word as a potential name
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
  };

  // Handle speech recognition results
  const handleSpeechResult = ({ transcript: result, isFinal, resultIndex }: { 
    transcript: string, 
    isFinal: boolean, 
    resultIndex: number 
  }) => {
    // Add to continuous text buffer for better name detection
    continuousTextBufferRef.current += " " + result;
    
    let interimTranscript = '';
    let finalTranscript = '';
    
    if (isFinal) {
      // When we have final result, analyze context to determine speaker
      const detectedSpeaker = resultIndex >= lastProcessedIndex ? 
        detectSpeaker(result, {
          ...conversationContextRef.current,
          lastSpeaker,
          isFirstInteraction: isFirstInteractionRef.current
        }) : lastSpeaker;
      
      if (resultIndex >= lastProcessedIndex) {
        // Only update speaker for new results
        setLastSpeaker(detectedSpeaker);
        
        // Update conversation context based on detected speaker
        if (detectedSpeaker === 'Doctor') {
          // Check if doctor is asking a question
          if (result.match(/\?$/) || result.toLowerCase().startsWith('how') || 
              result.toLowerCase().startsWith('what') || result.toLowerCase().startsWith('when')) {
            conversationContextRef.current.doctorAskedQuestion = true;
          } else {
            // If doctor is talking about medication, mark as prescribing
            if (result.toLowerCase().includes('prescribe') || 
                result.toLowerCase().includes('medication') || 
                result.toLowerCase().includes('medicine') || 
                result.toLowerCase().includes('tablet') ||
                result.toLowerCase().includes('dose')) {
              conversationContextRef.current.isPrescribing = true;
            }
          }
        } else {
          // Patient is speaking
          conversationContextRef.current.patientResponded = true;
          if (result.toLowerCase().includes('pain') || 
              result.toLowerCase().includes('hurt') || 
              result.toLowerCase().includes('feel')) {
            conversationContextRef.current.isPatientDescribingSymptoms = true;
          }
        }
      }
      
      // Accumulate the transcript instead of replacing it
      finalTranscript = `[${detectedSpeaker}]: ${result}\n`;
      accumulatedTranscriptRef.current += finalTranscript;
      setLastProcessedIndex(resultIndex + 1);
    } else if (resultIndex >= lastProcessedIndex) {
      // Show interim results immediately with "Identifying" tag
      interimTranscript = `[Identifying]: ${result}`;
      interimTranscriptRef.current = interimTranscript;
    }
    
    // Update transcript for display including full transcript + interim results
    const displayTranscript = accumulatedTranscriptRef.current + (interimTranscriptRef.current || '');
    setTranscript(displayTranscript);
    onTranscriptUpdate(displayTranscript);

    // Check for patient identification in initial conversation
    if (isNewSession && !patientIdentifiedRef.current) {
      // Check both the current result and the full buffer
      checkForPatientName(result);
      checkForPatientName(continuousTextBufferRef.current);
      
      // Also check the current display transcript
      checkForPatientName(displayTranscript);
    }

    // Check for "save prescription" command
    const transcriptLower = (result || '').toLowerCase();
    if ((transcriptLower.includes("save prescription") || 
         transcriptLower.includes("print prescription") ||
         transcriptLower.includes("प्रिस्क्रिप्शन सेव करें") || // Hindi
         transcriptLower.includes("చికిత్స పత్రం సేవ్ చేయండి")) && // Telugu
        (lastSpeaker === 'Doctor' || lastSpeaker === 'Identifying')) {
      toast.success("Saving prescription...");
      // Here you would trigger the save/print functionality
    }
  };

  // Initialize speech recognition
  const { 
    isRecording, 
    detectedLanguage, 
    toggleRecording, 
    startRecording, 
    stopRecording 
  } = useSpeechRecognition({
    onResult: handleSpeechResult,
    onSilence: handleSilence,
    pauseThreshold
  });

  // Start a new session
  const startNewSession = () => {
    accumulatedTranscriptRef.current = '';
    setTranscript('');
    onTranscriptUpdate('');
    setIsNewSession(true);
    setLastSpeaker('Doctor'); // Doctor speaks first in a new session
    setLastProcessedIndex(0);
    isFirstInteractionRef.current = true;
    patientIdentifiedRef.current = false;
    patientNameScanAttempts.current = 0;
    continuousTextBufferRef.current = '';
    setShowPatientIdentified(false);
    // Reset conversation context
    conversationContextRef.current = {
      isPatientDescribingSymptoms: false,
      doctorAskedQuestion: false,
      patientResponded: false,
      isPrescribing: false,
      isGreeting: true
    };
    toast.success('Ready for new patient');
  };

  // Handle stopping recording
  const handleStopRecording = () => {
    // If there's an interim transcript, finalize it
    if (interimTranscriptRef.current) {
      const finalizedInterim = interimTranscriptRef.current.replace('[Identifying]:', `[${lastSpeaker}]:`);
      accumulatedTranscriptRef.current += finalizedInterim + '\n';
      interimTranscriptRef.current = '';
      
      // Update the display transcript
      setTranscript(accumulatedTranscriptRef.current);
      onTranscriptUpdate(accumulatedTranscriptRef.current);
    }
    stopRecording();
  };

  // Handle toggling recording
  const handleToggleRecording = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      // Initialize the transcript with the current speaker if it's empty
      if (!accumulatedTranscriptRef.current) {
        const initialTranscript = `[${lastSpeaker}]: `;
        accumulatedTranscriptRef.current = initialTranscript;
        setTranscript(initialTranscript);
        onTranscriptUpdate(initialTranscript);
      }
      toggleRecording();
    }
  };

  // Component UI
  return (
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
                    "h-3 w-3 rounded-full bg-destructive",
                    speakerChanged ? "animate-pulse-recording" : ""
                  )}></span>
                  <span className="font-medium">Recording ({lastSpeaker === 'Identifying' ? 'Listening...' : `${lastSpeaker} speaking`})</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Auto-detecting language and speakers in conversation
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
          
          {/* Language indicator */}
          <div className="flex items-center gap-2 mt-2">
            <Globe className="h-4 w-4 text-doctor-primary" />
            <div className="text-sm font-medium">
              {isRecording ? 
                `Auto-detecting: ${detectedLanguage === 'en-IN' ? 'English' : detectedLanguage === 'hi-IN' ? 'Hindi' : 'Telugu'}` : 
                'Auto language detection enabled'
              }
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VoiceRecorder;
