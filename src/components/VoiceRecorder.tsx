import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, UserPlus, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

interface VoiceRecorderProps {
  onTranscriptUpdate: (transcript: string) => void;
  onPatientInfoUpdate: (patientInfo: { name: string; time: string }) => void;
}

// Define a custom error event interface for SpeechRecognition
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onTranscriptUpdate, onPatientInfoUpdate }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isNewSession, setIsNewSession] = useState(true);
  const [lastProcessedIndex, setLastProcessedIndex] = useState(0);
  const [lastSpeaker, setLastSpeaker] = useState<'Doctor' | 'Patient' | 'Identifying'>('Doctor');
  const [pauseThreshold, setPauseThreshold] = useState(1500); // 1.5 seconds (reduced for faster response)
  const [currentSilenceTime, setCurrentSilenceTime] = useState(0);
  const [speakerChanged, setSpeakerChanged] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<string>("en-IN");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const interimTranscriptRef = useRef<string>('');
  const isFirstInteractionRef = useRef<boolean>(true);
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

  // Function to detect speaker based on context clues and linguistic patterns
  const detectSpeaker = (text: string): 'Doctor' | 'Patient' => {
    const lowerText = text.toLowerCase().trim();
    
    // Track conversation state for better detection
    const context = conversationContextRef.current;
    
    // Check if this is the beginning of conversation
    if (isFirstInteractionRef.current) {
      // First interaction is likely the doctor greeting
      isFirstInteractionRef.current = false;
      context.isGreeting = true;
      return 'Doctor';
    }
    
    // ---- DOCTOR LINGUISTIC PATTERNS ----
    
    // Doctor questions - typically short, direct questions
    const doctorQuestionPatterns = [
      /^(how|what|when|where|why|do you|are you|have you|can you|did you|is there|are there|does it|has this)/i,
      /^any (fever|pain|discomfort|symptoms|nausea|difficulty|trouble|issues|medication|allergies|history)/i,
      /^(tell me about|describe|explain|elaborate on)/i,
      /^(let me|i('ll| will) take|i need to)/i,
      /^(how (long|often|frequently|severe|bad)|when did)/i,
      /^(do you (feel|have|experience|get|take)|are you (feeling|experiencing|having))/i,
      /^(is it|does it|has it|could be|seems like|looks like|sounds like)/i,
    ];
    
    // Doctor explanations/diagnoses - authoritative statements
    const doctorExplanationPatterns = [
      /^(your|the|these|those|this|that) (test results|bloodwork|scan|x-ray|levels|numbers|symptoms|condition)/i,
      /^(it('s| is) (likely|probably|possibly|definitely|just|only) (a|an|the) /i,
      /^(based on|according to|given|i think|i believe|i suspect|it appears|it seems|it could be)/i,
      /^(you (have|need|should|might|may|could|must|will need)|we (should|need|will|can|could|might))/i,
      /^(i('d| would) (recommend|suggest|advise|like|want)|let's)/i,
      /^(that('s| is) (normal|common|unusual|concerning|expected|fine|okay|good|not good))/i,
    ];
    
    // Doctor directives - instructions to patient
    const doctorDirectivePatterns = [
      /^(take|use|apply|try|avoid|reduce|increase|continue with|stop)/i,
      /^(i('ll| will) (prescribe|give|recommend|refer|schedule))/i,
      /^(come back|return|follow up|check in|call|contact|see me)/i,
      /^(say|open|close|breathe|cough|lift|move|turn|relax|deep breath)/i,
    ];
    
    // ---- PATIENT LINGUISTIC PATTERNS ----
    
    // Patient symptom descriptions
    const patientSymptomPatterns = [
      /^(i('ve| have|'m| am) (been|feeling|having|getting|experiencing|noticing|suffering))/i,
      /^(it (feels|hurts|aches|burns|itches|started|began|comes|goes|gets))/i,
      /^(my (head|throat|chest|stomach|back|arm|leg|neck|foot|ear|eye|nose) (hurts|aches|feels|is))/i,
      /^(i (feel|hurt|ache|can't|don't|haven't|won't|didn't|isn't|aren't|wasn't|weren't))/i,
      /^(the pain|this feeling|the sensation|the discomfort|the issue|the problem)/i,
    ];
    
    // Patient responses to doctor
    const patientResponsePatterns = [
      /^(yes|no|sometimes|occasionally|rarely|never|always|usually|not really|kind of|sort of|maybe|i think so)/i,
      /^(about|around|approximately|like|probably|possibly|definitely|absolutely|actually|honestly)/i,
      /^(a (little|bit|lot|few|couple)|some|many|much|several|plenty|hardly any|barely any)/i,
      /^(in the (morning|evening|afternoon|night)|during the day|at night|while|when|after|before)/i,
      /^(only when|especially when|mostly when|every time|whenever)/i,
    ];
    
    // Patient questions - usually about treatment, prognosis, or clarification
    const patientQuestionPatterns = [
      /^(is that|does that|will this|should i|can i|do i need|how long|how often|how bad)/i,
      /^(what (about|should|could|is|does|will|causes|caused)|when (can|should|will|is))/i,
      /^(will i (need|have to|be able to)|can i (still|go|eat|drink|take))/i,
      /^(is (it|this|that) (serious|normal|bad|concerning|dangerous|common|contagious))/i,
    ];
    
    // ---- CONVERSATION FLOW ANALYSIS ----
    
    // Check if the text is a doctor's question
    const isDocQuestion = doctorQuestionPatterns.some(pattern => pattern.test(lowerText));
    
    // Check if the text is a doctor's explanation
    const isDocExplanation = doctorExplanationPatterns.some(pattern => pattern.test(lowerText));
    
    // Check if the text is a doctor's directive
    const isDocDirective = doctorDirectivePatterns.some(pattern => pattern.test(lowerText));
    
    // Check if the text is a patient describing symptoms
    const isPatientSymptom = patientSymptomPatterns.some(pattern => pattern.test(lowerText));
    
    // Check if the text is a patient response
    const isPatientResponse = patientResponsePatterns.some(pattern => pattern.test(lowerText));
    
    // Check if the text is a patient question
    const isPatientQuestion = patientQuestionPatterns.some(pattern => pattern.test(lowerText));
    
    // Calculate speaker probabilities
    let doctorScore = 0;
    let patientScore = 0;
    
    // Add scores based on pattern matches
    doctorScore += (isDocQuestion ? 3 : 0) + (isDocExplanation ? 4 : 0) + (isDocDirective ? 4 : 0);
    patientScore += (isPatientSymptom ? 4 : 0) + (isPatientResponse ? 3 : 0) + (isPatientQuestion ? 3 : 0);
    
    // Consider conversation flow context
    if (lastSpeaker === 'Doctor') {
      // If doctor spoke last, this is more likely a patient response
      patientScore += 1;
      
      // If last utterance was a question, more likely patient is answering
      if (context.doctorAskedQuestion) {
        patientScore += 2;
      }
    } else if (lastSpeaker === 'Patient') {
      // If patient spoke last, this is more likely a doctor response
      doctorScore += 1;
      
      // If patient was describing symptoms, doctor likely asking follow-up
      if (context.isPatientDescribingSymptoms) {
        doctorScore += 2;
      }
    }
    
    // Analyze text length and complexity
    // Doctors often give longer explanations, patients often give shorter responses
    if (text.length > 100) {
      // Longer text is more likely a doctor explanation
      doctorScore += 1;
    } else if (text.length < 15 && patientResponsePatterns.some(pattern => pattern.test(lowerText))) {
      // Very short response is likely patient
      patientScore += 1;
    }
    
    // Check for specialized medical terminology
    const medicalTerms = /\b(diagnosis|prognosis|chronic|acute|symptom|inflammation|prescription|dosage|treatment|therapy|medication|antibiotic|analgesic|consultation|referral|examination|assessment)\b/i;
    if (medicalTerms.test(lowerText)) {
      doctorScore += 2;
    }
    
    // Update conversation context based on what was detected
    if (isDocQuestion) {
      context.doctorAskedQuestion = true;
      context.isPatientDescribingSymptoms = false;
    } else if (isPatientSymptom) {
      context.isPatientDescribingSymptoms = true;
      context.doctorAskedQuestion = false;
    } else if (isDocDirective) {
      context.isPrescribing = true;
      context.isPatientDescribingSymptoms = false;
    }
    
    // Return the most likely speaker based on scoring
    const detectedSpeaker = doctorScore > patientScore ? 'Doctor' : 'Patient';
    
    // Update conversation context for next detection
    if (detectedSpeaker === 'Doctor') {
      if (isDocQuestion) context.doctorAskedQuestion = true;
      if (isDocDirective) context.isPrescribing = true;
    } else {
      if (isPatientSymptom) context.isPatientDescribingSymptoms = true;
      if (isPatientResponse) context.patientResponded = true;
    }
    
    return detectedSpeaker;
  };

  // Function to detect language based on text
  const detectLanguage = (text: string): string => {
    // Simple language detection based on script characteristics
    // Hindi/Devanagari detection
    const devanagariPattern = /[\u0900-\u097F\u0981-\u09DC\u09DD-\u09DF]/;
    
    // Telugu detection
    const teluguPattern = /[\u0C00-\u0C7F]/;
    
    if (devanagariPattern.test(text)) {
      return 'hi-IN'; // Hindi
    } else if (teluguPattern.test(text)) {
      return 'te-IN'; // Telugu
    } else {
      return 'en-IN'; // Default to English
    }
  };

  // Function to detect silence and potentially switch speakers
  const setupSilenceDetection = () => {
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
    }

    silenceTimerRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastSpeech = now - lastSpeechTimeRef.current;
      
      setCurrentSilenceTime(timeSinceLastSpeech);
      
      // If silence longer than threshold, potentially switch speakers
      if (timeSinceLastSpeech > pauseThreshold && isRecording && lastSpeaker !== 'Identifying') {
        const newSpeaker = lastSpeaker === 'Doctor' ? 'Patient' : 'Doctor';
        setLastSpeaker(newSpeaker);
        setSpeakerChanged(true);
        
        // Only flash animation on actual speaker change, not on every recognition
        setTimeout(() => {
          setSpeakerChanged(false);
        }, 2000);
        
        lastSpeechTimeRef.current = now; // Reset the timer
      }
    }, 200);
  };

  const startNewSession = () => {
    setTranscript('');
    onTranscriptUpdate('');
    setIsNewSession(true);
    setLastSpeaker('Doctor'); // Doctor speaks first in a new session
    setLastProcessedIndex(0);
    isFirstInteractionRef.current = true;
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

  const startRecording = async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create media recorder
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      // Setup Web Speech API
      if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognitionAPI();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = detectedLanguage; // Start with default language
        
        recognitionRef.current.onresult = (event) => {
          let interimTranscript = '';
          let finalTranscript = '';
          
          // Process all results for immediate display
          for (let i = 0; i < event.results.length; i++) {
            const result = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
              // When we have final result, analyze context to determine speaker
              const detectedSpeaker = i >= lastProcessedIndex ? detectSpeaker(result) : lastSpeaker;
              
              if (i >= lastProcessedIndex) {
                // Only update speaker for new results
                setLastSpeaker(detectedSpeaker);
                lastSpeechTimeRef.current = Date.now(); // Update last speech time
                
                // Detect language and update recognition if needed
                const newLanguage = detectLanguage(result);
                if (newLanguage !== detectedLanguage) {
                  setDetectedLanguage(newLanguage);
                  // Restart recognition with new language
                  if (recognitionRef.current) {
                    recognitionRef.current.lang = newLanguage;
                    // No need to restart - just update the language
                  }
                }
              }
              
              finalTranscript += `[${detectedSpeaker}]: ${result}\n`;
              setLastProcessedIndex(i + 1);
            } else if (i >= lastProcessedIndex) {
              // Show interim results immediately with "Identifying" tag
              interimTranscript = `[Identifying]: ${result}`;
              interimTranscriptRef.current = interimTranscript;
            }
          }
          
          // Update transcript for immediate display including interim results
          if (finalTranscript || interimTranscript) {
            const newTranscript = transcript + finalTranscript + (interimTranscript ? interimTranscript : '');
            setTranscript(newTranscript);
            onTranscriptUpdate(newTranscript);
          }

          // Check for name mention in initial greeting patterns (only in Doctor's statements)
          if (isNewSession && (lastSpeaker === 'Doctor' || lastSpeaker === 'Identifying')) {
            const greetingPatterns = [
              /hi\s+([A-Za-z]+)/i,
              /hello\s+([A-Za-z]+)/i,
              /patient\s+(?:is|name\s+is)?\s*([A-Za-z]+)/i,
              /this\s+is\s+([A-Za-z]+)/i,
              /([A-Za-z]+)\s+is\s+here/i,
              // Indian name patterns
              /namaste\s+([A-Za-z]+)/i,
              /namaskar\s+([A-Za-z]+)/i,
              /शुभ प्रभात\s+([A-Za-z]+)/i, // Good morning in Hindi
              /नमस्ते\s+([A-Za-z]+)/i,     // Namaste in Hindi
              /నమస్కారం\s+([A-Za-z]+)/i,   // Namaskaram in Telugu
            ];
            
            // Use the full transcript for pattern matching
            const fullText = transcript + finalTranscript + interimTranscript;
            
            for (const pattern of greetingPatterns) {
              const match = fullText.match(pattern);
              if (match && match[1]) {
                const patientName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
                const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                onPatientInfoUpdate({ 
                  name: patientName, 
                  time: currentTime
                });
                setIsNewSession(false);
                toast.success(`Patient identified: ${patientName}`);
                break;
              }
            }
          }

          // Check for "save prescription" command in various languages
          const transcriptLower = (finalTranscript || interimTranscript).toLowerCase();
          if ((transcriptLower.includes("save prescription") || 
               transcriptLower.includes("print prescription") ||
               transcriptLower.includes("प्रिस्क्रिप्शन सेव करें") || // Hindi
               transcriptLower.includes("చికిత్స పత్రం సేవ్ చేయండి")) && // Telugu
              (lastSpeaker === 'Doctor' || lastSpeaker === 'Identifying')) {
            toast.success("Saving prescription...");
            // Here you would trigger the save/print functionality
          }
        };
        
        recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error', event.error);
          if (event.error === 'language-not-supported') {
            setDetectedLanguage('en-IN'); // Fallback to English
            if (recognitionRef.current) {
              recognitionRef.current.lang = 'en-IN';
            }
            toast.error('Language not supported, switching to English');
          } else {
            toast.error('Error with speech recognition. Please try again.');
            setIsRecording(false);
          }
        };
        
        // Initialize the transcript with the current speaker if it's empty
        if (!transcript) {
          const initialTranscript = `[${lastSpeaker}]: `;
          setTranscript(initialTranscript);
          onTranscriptUpdate(initialTranscript);
        }
        
        recognitionRef.current.start();
        setupSilenceDetection(); // Start silence detection
        setIsRecording(true);
        toast.success(`Recording started with auto-language detection`);
      } else {
        toast.error('Speech recognition is not supported in this browser');
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    // If there's an interim transcript, finalize it
    if (interimTranscriptRef.current) {
      const finalizedInterim = interimTranscriptRef.current.replace('[Identifying]:', `[${lastSpeaker}]:`);
      const newTranscript = transcript.replace(interimTranscriptRef.current, '') + finalizedInterim;
      setTranscript(newTranscript);
      onTranscriptUpdate(newTranscript);
      interimTranscriptRef.current = '';
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    setIsRecording(false);
    toast.success('Recording stopped');
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <Card className="border-2 border-doctor-primary/30 shadow-md">
      <CardContent className="p-4 bg-gradient-to-r from-doctor-primary/10 to-transparent">
        <div className="flex flex-col items-center gap-4">
          <div className="flex space-x-4">
            <Button 
              onClick={toggleRecording}
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
                  "Say 'Namaste [patient name]' to start" : 
                  "Press to resume recording"
                }
              </span>
            )}
          </div>
          
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
