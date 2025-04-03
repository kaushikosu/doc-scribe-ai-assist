
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, UserPlus, Languages } from 'lucide-react';
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

// List of supported languages
const SUPPORTED_LANGUAGES = [
  { code: 'en-IN', name: 'English (India)' },
  { code: 'hi-IN', name: 'Hindi' },
  { code: 'te-IN', name: 'Telugu' },
];

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onTranscriptUpdate, onPatientInfoUpdate }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isNewSession, setIsNewSession] = useState(true);
  const [lastProcessedIndex, setLastProcessedIndex] = useState(0);
  const [lastSpeaker, setLastSpeaker] = useState<'Doctor' | 'Patient' | 'Identifying'>('Doctor');
  const [pauseThreshold, setPauseThreshold] = useState(1500); // 1.5 seconds (reduced for faster response)
  const [currentSilenceTime, setCurrentSilenceTime] = useState(0);
  const [speakerChanged, setSpeakerChanged] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(SUPPORTED_LANGUAGES[0]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const interimTranscriptRef = useRef<string>('');

  // Function to detect speaker based on context and silence
  const detectSpeaker = (text: string): 'Doctor' | 'Patient' => {
    const lowerText = text.toLowerCase();
    
    // Doctor indication keywords
    const doctorPatterns = [
      /\b(i recommend|i suggest|i prescribe|you should|you need to|your condition|your symptoms)\b/i,
      /\b(the diagnosis|the treatment|your test results|your blood pressure|your heart rate)\b/i,
      /\b(what brings you here|how can i help|tell me about your symptoms|when did this start)\b/i,
      /\b(take this medication|twice daily|once daily|after meals|doctor|dr\.)\b/i
    ];
    
    // Patient indication keywords
    const patientPatterns = [
      /\b(i feel|i have been|i am experiencing|i've been|my stomach|my head|my body|my chest)\b/i,
      /\b(pain in my|hurts when i|started|ago|thank you doctor|yes doctor|no doctor)\b/i,
      /\b(medicine|tablet|injection|prescription|sick|pain|ache|fever|cough|cold)\b/i
    ];
    
    // Check for doctor or patient patterns
    let doctorMatches = 0;
    let patientMatches = 0;
    
    doctorPatterns.forEach(pattern => {
      if (pattern.test(lowerText)) doctorMatches++;
    });
    
    patientPatterns.forEach(pattern => {
      if (pattern.test(lowerText)) patientMatches++;
    });
    
    return doctorMatches > patientMatches ? 'Doctor' : 'Patient';
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
    setLastSpeaker('Doctor');
    setLastProcessedIndex(0);
    toast.success('Ready for new patient');
  };

  const changeLanguage = (language: typeof SUPPORTED_LANGUAGES[0]) => {
    setSelectedLanguage(language);
    
    // Restart recognition if already recording
    if (isRecording) {
      stopRecording();
      setTimeout(() => startRecording(), 300);
    }
    
    toast.success(`Language changed to ${language.name}`);
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
        recognitionRef.current.lang = selectedLanguage.code;
        
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
          toast.error('Error with speech recognition. Please try again.');
          setIsRecording(false);
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
        toast.success(`Recording started in ${selectedLanguage.name}`);
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
                  Auto-detecting speakers based on context and pauses
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
          
          {/* Language selector */}
          <div className="flex items-center gap-2 mt-2">
            <Languages className="h-4 w-4 text-doctor-primary" />
            <div className="flex gap-2">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <Button
                  key={lang.code}
                  variant={selectedLanguage.code === lang.code ? "default" : "outline"}
                  size="sm"
                  className={selectedLanguage.code === lang.code ? "bg-doctor-primary" : ""}
                  onClick={() => changeLanguage(lang)}
                  disabled={isRecording}
                >
                  {lang.name}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VoiceRecorder;
