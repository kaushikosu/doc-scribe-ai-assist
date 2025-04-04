
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, UserPlus, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import useGoogleSpeechToText from '@/hooks/useGoogleSpeechToText';
import { 
  detectSpeaker, 
  detectPatientInfo,
  PatientInfo
} from '@/utils/speakerDetection';
import ApiKeyInput from './ApiKeyInput';

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
  const [pauseThreshold, setPauseThreshold] = useState(1500); // 1.5 seconds
  const [currentSilenceTime, setCurrentSilenceTime] = useState(0);
  const [speakerChanged, setSpeakerChanged] = useState(false);
  const [showPatientIdentified, setShowPatientIdentified] = useState(false);
  const [googleApiKey, setGoogleApiKey] = useState<string>('');
  
  // Track complete formatted transcript with speaker labels
  const [formattedTranscript, setFormattedTranscript] = useState('');

  // Refs
  const interimTranscriptRef = useRef<string>('');
  const isFirstInteractionRef = useRef<boolean>(true);
  const patientIdentifiedRef = useRef<boolean>(false);
  const patientNameScanAttempts = useRef<number>(0);
  const turnCountRef = useRef<number>(0); // Track conversation turns
  
  // Conversation context tracking
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

  // Log when transcript changes - useful for debugging
  useEffect(() => {
    console.log("VoiceRecorder formatted transcript:", formattedTranscript);
  }, [formattedTranscript]);

  // Handle API key update
  const handleApiKeySet = (apiKey: string) => {
    console.log("API key updated");
    setGoogleApiKey(apiKey);
    // Show a success toast when API key is set
    if (apiKey) {
      toast.success("Google Cloud Speech API key configured");
    }
  };

  // Handle silence detection - switch speaker on silence
  const handleSilence = () => {
    if (lastSpeaker !== 'Identifying') {
      const newSpeaker = lastSpeaker === 'Doctor' ? 'Patient' : 'Doctor';
      setLastSpeaker(newSpeaker);
      setSpeakerChanged(true);
      turnCountRef.current += 1; // Increment turn counter on speaker change
      
      // Only flash animation on actual speaker change
      setTimeout(() => {
        setSpeakerChanged(false);
      }, 2000);
    }
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

  // Initialize Google Speech-to-Text with enhanced settings
  const { 
    isRecording, 
    detectedLanguage, 
    toggleRecording, 
    startRecording, 
    stopRecording,
    getAccumulatedTranscript,
    resetTranscript
  } = useGoogleSpeechToText({
    onResult: handleSpeechResult,
    onSilence: handleSilence,
    pauseThreshold,
    apiKey: googleApiKey
  });

  // Process speech recognition results
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
    
    if (isFinal) {
      // When we have final result, use the speaker tag from Google if available
      // or analyze context to determine speaker
      let detectedSpeaker: 'Doctor' | 'Patient' | 'Identifying';
      
      if (speakerTag !== undefined) {
        // Use Google's speaker diarization (speaker 1 is typically the first speaker - the doctor)
        detectedSpeaker = speakerTag === 1 ? 'Doctor' : 'Patient';
      } else {
        // Fallback to our custom detection
        detectedSpeaker = detectSpeaker(result, {
          ...conversationContextRef.current,
          lastSpeaker,
          isFirstInteraction: isFirstInteractionRef.current,
          turnCount: turnCountRef.current
        });
      }
      
      // Update speaker and increment turn counter
      setLastSpeaker(detectedSpeaker);
      turnCountRef.current += 1;
      
      // Format with speaker tag for final results
      const formattedResult = `[${detectedSpeaker}]: ${result}\n`;
      
      // Update our complete formatted transcript
      setFormattedTranscript(prev => {
        const newTranscript = prev + formattedResult;
        console.log("Updated formatted transcript:", newTranscript);
        return newTranscript;
      });
      
      interimTranscriptRef.current = '';
      setLastProcessedIndex(resultIndex + 1);
      
      // Update context based on detected speaker
      updateConversationContext(detectedSpeaker, result);
      
      // Check for patient identification in initial conversations
      if (isNewSession && !patientIdentifiedRef.current) {
        attemptPatientIdentification(result);
      }
      
      // Update the parent component with the formatted transcript (with speaker labels)
      console.log("Sending transcript to parent:", formattedTranscript + formattedResult);
      onTranscriptUpdate(formattedTranscript + formattedResult);
      
    } else {
      // For interim results, show with "Identifying" tag
      interimTranscriptRef.current = `[Identifying]: ${result}`;
      
      // Combine formatted transcript with interim for real-time display
      const combinedTranscript = formattedTranscript + interimTranscriptRef.current;
      console.log("Sending interim combined transcript:", combinedTranscript);
      onTranscriptUpdate(combinedTranscript);
      
      // Even for interim results, try to identify patient
      if (isNewSession && !patientIdentifiedRef.current) {
        attemptPatientIdentification(result);
      }
    }
    
    // Check for "save prescription" command
    if ((result.toLowerCase().includes("save prescription") || 
         result.toLowerCase().includes("print prescription")) && 
        (lastSpeaker === 'Doctor' || lastSpeaker === 'Identifying')) {
      toast.success("Saving prescription...");
    }
  }
  
  // Update conversation context based on speaker and content
  function updateConversationContext(speaker: 'Doctor' | 'Patient' | 'Identifying', content: string) {
    if (speaker === 'Doctor') {
      // Check if doctor is asking a question
      if (content.match(/\?$/) || content.toLowerCase().startsWith('how') || 
          content.toLowerCase().startsWith('what') || content.toLowerCase().startsWith('when')) {
        conversationContextRef.current.doctorAskedQuestion = true;
      } else {
        conversationContextRef.current.doctorAskedQuestion = false;
        // If doctor is talking about medication, mark as prescribing
        if (content.toLowerCase().includes('prescribe') || 
            content.toLowerCase().includes('medication') || 
            content.toLowerCase().includes('medicine') || 
            content.toLowerCase().includes('tablet')) {
          conversationContextRef.current.isPrescribing = true;
        }
      }
    } else if (speaker === 'Patient') {
      conversationContextRef.current.patientResponded = true;
      if (content.toLowerCase().includes('pain') || 
          content.toLowerCase().includes('hurt') || 
          content.toLowerCase().includes('feel')) {
        conversationContextRef.current.isPatientDescribingSymptoms = true;
      }
    }
  }
  
  // Multiple attempts to identify patient name
  function attemptPatientIdentification(text: string) {
    console.log("Checking for patient name in:", text);
    
    // Method 1: Try utility function
    const patientInfo = detectPatientInfo(text);
    
    if (patientInfo) {
      console.log("Patient identified:", patientInfo);
      onPatientInfoUpdate(patientInfo);
      setIsNewSession(false);
      patientIdentifiedRef.current = true;
      
      // Show success notification
      setShowPatientIdentified(true);
      setTimeout(() => {
        setShowPatientIdentified(false);
      }, 3000);
      
      toast.success(`Patient identified: ${patientInfo.name}`);
      isFirstInteractionRef.current = false;
      return;
    }
    
    // Method 2: Try our local extractor
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
    
    // Method 3: After several attempts, try capitalized words
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
    
    // Method 4: Last resort - check for any word after greeting
    if (patientNameScanAttempts.current > 5) {
      const wordsAfterGreeting = text.match(/(?:hello|hi|hey|namaste)\s+(\w+)/i);
      if (wordsAfterGreeting && wordsAfterGreeting[1]) {
        const guessedName = wordsAfterGreeting[1].charAt(0).toUpperCase() + wordsAfterGreeting[1].slice(1);
        const currentTime = new Date().toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        const fallbackPatient = {
          name: guessedName,
          time: currentTime
        };
        
        console.log("Fallback patient identification:", fallbackPatient);
        onPatientInfoUpdate(fallbackPatient);
        setIsNewSession(false);
        patientIdentifiedRef.current = true;
        setShowPatientIdentified(true);
        setTimeout(() => {
          setShowPatientIdentified(false);
        }, 3000);
        
        toast.success(`Patient identified: ${guessedName}`);
        isFirstInteractionRef.current = false;
      }
    }
  }

  // Start a new session
  const startNewSession = () => {
    resetTranscript();
    setTranscript('');
    setFormattedTranscript(''); // Clear formatted transcript
    onTranscriptUpdate('');
    setIsNewSession(true);
    setLastSpeaker('Doctor');
    setLastProcessedIndex(0);
    isFirstInteractionRef.current = true;
    patientIdentifiedRef.current = false;
    patientNameScanAttempts.current = 0;
    turnCountRef.current = 0; // Reset turn counter
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
      interimTranscriptRef.current = '';
      
      // Update the formatted transcript with the finalized interim
      setFormattedTranscript(prev => {
        const newTranscript = prev + finalizedInterim + '\n';
        console.log("Final transcript after stop:", newTranscript);
        return newTranscript;
      });
      
      // Update the parent with the complete transcript
      onTranscriptUpdate(formattedTranscript + finalizedInterim + '\n');
    }
    stopRecording();
  };

  // Handle toggling recording
  const handleToggleRecording = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      if (!googleApiKey) {
        toast.error("Please configure your Google Cloud Speech API key first");
        return;
      }
      
      // Add an initial transcript entry to test the flow
      const initialMessage = "[Doctor]: Starting new recording session.\n";
      setFormattedTranscript(initialMessage);
      onTranscriptUpdate(initialMessage);
      
      startRecording();
    }
  };

  // Component UI
  return (
    <div className="space-y-4">
      <ApiKeyInput onApiKeySet={handleApiKeySet} />
      
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
                disabled={!googleApiKey}
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
                    Using Google Cloud Speech-to-Text with enhanced medical vocabulary
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground">
                  {!googleApiKey ? 
                    "Configure Google Cloud Speech API key above to start" :
                    (isNewSession ? 
                      "Start with 'Namaste [patient name]' or 'Hello [patient name]'" : 
                      "Press to resume recording"
                    )
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
                  `Detecting: ${detectedLanguage === 'en-IN' ? 'English' : detectedLanguage === 'hi-IN' ? 'Hindi' : 'Telugu'}` : 
                  'Multi-language recognition enabled'
                }
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceRecorder;
