
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

  // Function to detect speaker based on context clues
  const detectSpeaker = (text: string): 'Doctor' | 'Patient' => {
    const lowerText = text.toLowerCase();
    
    // Track conversation state for better detection
    const context = conversationContextRef.current;
    
    // Check if this is the beginning of conversation
    if (isFirstInteractionRef.current) {
      // First interaction is likely the doctor greeting
      isFirstInteractionRef.current = false;
      context.isGreeting = true;
      return 'Doctor';
    }
    
    // Doctor indication patterns
    const doctorGreetingPatterns = [
      /\b(hi|hello|namaste|namaskar|good morning|good afternoon)\b/i,
      /\b(how are you feeling|what brings you here|what seems to be the problem)\b/i,
      /\b(tell me about your symptoms|when did this start|how long have you been feeling)\b/i
    ];
    
    const doctorQuestionPatterns = [
      /\b(have you taken any medication|any allergies|do you have|are you feeling)\b/i,
      /\b(how severe is|rate your pain|any other symptoms|family history)\b/i,
      /\b(how long have you been|when did you notice|does it hurt when)\b/i
    ];
    
    const doctorPrescribingPatterns = [
      /\b(i recommend|i suggest|i prescribe|you should take|you need to take)\b/i,
      /\b(take this medicine|take these tablets|this will help|this medication)\b/i,
      /\b(twice daily|once daily|after meals|before meals|every morning|every night)\b/i,
      /\b(for \d+ days|for a week|for two weeks|follow up|come back|next visit)\b/i
    ];
    
    // Patient indication patterns
    const patientSymptomPatterns = [
      /\b(i have|i've been|i am having|i feel|i am experiencing|suffering from)\b/i,
      /\b(pain in my|hurts when|started|days ago|since yesterday|last week|morning|night)\b/i,
      /\b(fever|cough|cold|headache|stomachache|pain|ache|vomiting|nausea)\b/i,
      /\b(not feeling well|sick|unwell|dizzy|tired|weakness|no appetite)\b/i
    ];
    
    const patientResponsePatterns = [
      /\b(yes doctor|no doctor|thank you|thanks|ok|okay|i will|i'll try|i understand)\b/i,
      /\b(i took|i've taken|i have taken|i haven't taken|i stopped|i started)\b/i,
      /\b(tablet|tablets|medicine|pill|pills|syrup|injection|capsule|dose)\b/i
    ];

    // Someone being addressed
    const addressingDoctor = /\b(doctor|dr\.|डॉक्टर|डाक्टर|वैद्य|डॉक्टर साहब|डॉक्‍टर|డాక్టర్|వైద్యుడు)\b/i;
    const addressingPatient = /\b(मरीज़|रोगी|పేషెంట్|రోగి)\b/i;
    
    // Check for conversation context and language markers
    if (context.isGreeting && doctorGreetingPatterns.some(pattern => pattern.test(lowerText))) {
      context.isGreeting = false;
      context.doctorAskedQuestion = true;
      return 'Doctor';
    }
    
    if (context.doctorAskedQuestion && patientSymptomPatterns.some(pattern => pattern.test(lowerText))) {
      context.doctorAskedQuestion = false;
      context.isPatientDescribingSymptoms = true;
      context.patientResponded = true;
      return 'Patient';
    }
    
    if (context.isPatientDescribingSymptoms && doctorQuestionPatterns.some(pattern => pattern.test(lowerText))) {
      context.isPatientDescribingSymptoms = false;
      context.doctorAskedQuestion = true;
      return 'Doctor';
    }
    
    if (context.patientResponded && doctorPrescribingPatterns.some(pattern => pattern.test(lowerText))) {
      context.patientResponded = false;
      context.isPrescribing = true;
      return 'Doctor';
    }
    
    // Direct addressing overrides
    if (addressingDoctor.test(lowerText)) {
      return 'Patient';
    }
    
    if (addressingPatient.test(lowerText)) {
      return 'Doctor';
    }
    
    // Score-based approach as fallback
    let doctorScore = 0;
    let patientScore = 0;
    
    // Check each pattern category for matches
    doctorGreetingPatterns.forEach(pattern => {
      if (pattern.test(lowerText)) doctorScore += 2;
    });
    
    doctorQuestionPatterns.forEach(pattern => {
      if (pattern.test(lowerText)) doctorScore += 2;
    });
    
    doctorPrescribingPatterns.forEach(pattern => {
      if (pattern.test(lowerText)) doctorScore += 3; // Stronger indicator
    });
    
    patientSymptomPatterns.forEach(pattern => {
      if (pattern.test(lowerText)) patientScore += 2;
    });
    
    patientResponsePatterns.forEach(pattern => {
      if (pattern.test(lowerText)) patientScore += 2;
    });
    
    // Consider the last speaker for continuity
    if (lastSpeaker === 'Doctor') {
      patientScore += 1; // Slight bias toward alternating speakers
    } else if (lastSpeaker === 'Patient') {
      doctorScore += 1;
    }
    
    return doctorScore > patientScore ? 'Doctor' : 'Patient';
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
