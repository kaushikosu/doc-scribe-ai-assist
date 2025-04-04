import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, UserPlus, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import useAzureSpeechToText from '@/hooks/useAzureSpeechToText';
import { 
  detectPatientInfo,
  PatientInfo
} from '@/utils/speaker';
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
  const [rawTranscript, setRawTranscript] = useState(''); // For storing raw transcript without speaker labels
  const [isNewSession, setIsNewSession] = useState(true);
  const [pauseThreshold, setPauseThreshold] = useState(1500); // 1.5 seconds
  const [showPatientIdentified, setShowPatientIdentified] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [region, setRegion] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>("auto");
  
  // Refs
  const currentTranscriptRef = useRef<string>('');
  const isFirstInteractionRef = useRef<boolean>(true);
  const patientIdentifiedRef = useRef<boolean>(false);
  const patientNameScanAttempts = useRef<number>(0);
  const transcriptUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Log when transcript changes - useful for debugging
  useEffect(() => {
    console.log("VoiceRecorder raw transcript:", rawTranscript);
  }, [rawTranscript]);

  // Handle API key update
  const handleApiKeySet = (newApiKey: string, newRegion?: string) => {
    console.log("API key updated");
    setApiKey(newApiKey);
    
    if (newRegion) {
      setRegion(newRegion);
      console.log("Region updated:", newRegion);
    }
    
    // Show a success toast when API key is set
    if (newApiKey) {
      const provider = newRegion ? "Azure Speech" : "Google Cloud Speech";
      toast.success(`${provider} API key configured`);
    }
  };

  // Simple no-op silence handler to keep the interface consistent
  const handleSilence = () => {
    // Only used to mark paragraph breaks in the transcript
    setRawTranscript(prev => prev + "\n");
  };

  // Debounced transcript update function to prevent UI flicker
  const updateTranscriptDebounced = (newTranscript: string) => {
    if (transcriptUpdateTimeoutRef.current) {
      clearTimeout(transcriptUpdateTimeoutRef.current);
    }
    
    // Update immediately for better real-time feel
    onTranscriptUpdate(newTranscript);
    
    // Also schedule a debounced update to catch any pending changes
    transcriptUpdateTimeoutRef.current = setTimeout(() => {
      onTranscriptUpdate(newTranscript);
    }, 100);
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

  // Initialize Azure Speech-to-Text
  const { 
    isRecording, 
    detectedLanguage, 
    toggleRecording, 
    startRecording, 
    stopRecording,
    setLanguage,
    getAccumulatedTranscript,
    resetTranscript
  } = useAzureSpeechToText({
    onResult: handleSpeechResult,
    onSilence: handleSilence,
    pauseThreshold, 
    apiKey,
    region
  });

  // Simplified speech result handler - no speaker detection during recording
  function handleSpeechResult({ transcript: result, isFinal, resultIndex }: { 
    transcript: string, 
    isFinal: boolean, 
    resultIndex: number,
    speakerTag?: number 
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
    
    // Skip the "Processing..." placeholder messages
    if (result === "Processing...") {
      console.log("Skipping processing placeholder");
      return;
    }
    
    // For real-time display, we don't classify speakers yet
    if (isFinal) {
      // Add the new text to the raw transcript
      setRawTranscript(prev => {
        const newRawTranscript = prev + (prev.endsWith('\n') || prev === '' ? '' : ' ') + result;
        currentTranscriptRef.current = newRawTranscript;
        return newRawTranscript;
      });

      // Update the parent component with the raw transcript
      updateTranscriptDebounced(currentTranscriptRef.current);
      
      // Check for patient identification in initial conversations
      if (isNewSession && !patientIdentifiedRef.current) {
        attemptPatientIdentification(result);
      }
    } else {
      // For non-final results, show them as temporary text in real-time
      const updatedTranscript = currentTranscriptRef.current + " " + result;
      updateTranscriptDebounced(updatedTranscript);
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
    
    // After stopping, process the transcript to classify speakers
    processTranscriptForSpeakers();
  };

  // Process the transcript to add speaker labels after recording stops
  const processTranscriptForSpeakers = () => {
    console.log("Processing transcript to add speaker labels");
    
    import('@/utils/speaker').then(({ detectSpeaker }) => {
      const lines = rawTranscript.split('\n').filter(line => line.trim().length > 0);
      let formattedLines: string[] = [];
      let lastSpeaker: 'Doctor' | 'Patient' = 'Doctor';
      let turnCount = 0;
      
      // Process each paragraph/utterance
      lines.forEach((line, index) => {
        const isFirstInteraction = index === 0;
        
        // Detect speaker for this line
        const speaker = detectSpeaker(line, {
          lastSpeaker,
          isFirstInteraction,
          turnCount,
          isPatientDescribingSymptoms: line.toLowerCase().includes('pain') || line.toLowerCase().includes('symptom'),
          doctorAskedQuestion: line.includes('?'),
          patientResponded: lastSpeaker === 'Doctor' && turnCount > 0,
          isPrescribing: line.toLowerCase().includes('prescribe') || line.toLowerCase().includes('medicine'),
          isGreeting: line.toLowerCase().includes('hello') || line.toLowerCase().includes('namaste')
        });
        
        // Add speaker label
        formattedLines.push(`[${speaker}]: ${line}`);
        
        // Update for next iteration
        lastSpeaker = speaker;
        turnCount++;
      });
      
      // Update with the speaker-labeled transcript
      const speakerLabeledTranscript = formattedLines.join('\n');
      console.log("Speaker-labeled transcript:", speakerLabeledTranscript);
      
      // Update the transcript and notify parent
      setTranscript(speakerLabeledTranscript);
      updateTranscriptDebounced(speakerLabeledTranscript);
      
      toast.success('Transcript processing completed');
    }).catch(err => {
      console.error("Error processing transcript:", err);
      toast.error("Failed to process transcript");
    });
  };

  // Handle language selection - improved for Telugu
  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
    
    if (language === "auto") {
      // In auto mode, let Azure detect the language
      console.log("Using automatic language detection");
      return;
    }
    
    // Map UI language selections to language codes
    const languageMap: Record<string, string> = {
      "english": "en-IN",
      "hindi": "hi-IN",
      "telugu": "te-IN"
    };
    
    if (languageMap[language]) {
      setLanguage(languageMap[language]);
      toast.success(`Language set to ${language.charAt(0).toUpperCase() + language.slice(1)}`);
    }
  };

  // Handle toggling recording
  const handleToggleRecording = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      if (!apiKey) {
        toast.error("Please configure your Speech API key first");
        return;
      }
      
      if (localStorage.getItem('speechProvider') === 'azure' && !region) {
        toast.error("Please configure your Azure region");
        return;
      }
      
      // If a specific language is selected, set it before starting
      if (selectedLanguage !== "auto") {
        const languageMap: Record<string, string> = {
          "english": "en-IN",
          "hindi": "hi-IN",
          "telugu": "te-IN"
        };
        
        if (languageMap[selectedLanguage]) {
          setLanguage(languageMap[selectedLanguage]);
        }
      }
      
      // Reset raw transcript for new session
      setRawTranscript('');
      currentTranscriptRef.current = '';
      
      startRecording();
    }
  };

  // Component UI with added language selector
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
                disabled={!apiKey || (localStorage.getItem('speechProvider') === 'azure' && !region)}
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
            
            {/* Language selector */}
            {!isRecording && (
              <div className="flex space-x-2 mt-2">
                <Button 
                  size="sm"
                  variant={selectedLanguage === "auto" ? "default" : "outline"} 
                  onClick={() => handleLanguageChange("auto")}
                >
                  Auto
                </Button>
                <Button 
                  size="sm"
                  variant={selectedLanguage === "english" ? "default" : "outline"} 
                  onClick={() => handleLanguageChange("english")}
                >
                  English
                </Button>
                <Button 
                  size="sm"
                  variant={selectedLanguage === "telugu" ? "default" : "outline"} 
                  onClick={() => handleLanguageChange("telugu")}
                >
                  Telugu
                </Button>
                <Button 
                  size="sm"
                  variant={selectedLanguage === "hindi" ? "default" : "outline"} 
                  onClick={() => handleLanguageChange("hindi")}
                >
                  Hindi
                </Button>
              </div>
            )}
            
            <div className="text-center">
              {isRecording ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-destructive animate-pulse"></span>
                    <span className="font-medium">Recording (real-time transcription)</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Using Azure Speech-to-Text with enhanced medical vocabulary
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground">
                  {!apiKey ? 
                    "Configure Speech API key above to start" :
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
            
            {/* Language indicator with clear Telugu support */}
            <div className="flex items-center gap-2 mt-2">
              <Globe className="h-4 w-4 text-doctor-primary" />
              <div className="text-sm font-medium">
                {isRecording ? 
                  `Detecting: ${
                    detectedLanguage === 'en-IN' ? 'English' : 
                    detectedLanguage === 'hi-IN' ? 'Hindi' : 
                    detectedLanguage === 'te-IN' ? 'Telugu' : 
                    'Unknown'
                  }` : 
                  selectedLanguage === "auto" ? 
                    'Multi-language recognition enabled' : 
                    `Language set to ${selectedLanguage.charAt(0).toUpperCase() + selectedLanguage.slice(1)}`
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
