
import { useState, useRef, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { detectLanguage } from '@/utils/speakerDetection';

// Define a custom error event interface for SpeechRecognition
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface UseSpeechRecognitionProps {
  onResult: (result: { 
    transcript: string, 
    isFinal: boolean, 
    resultIndex: number 
  }) => void;
  onSilence: () => void;
  pauseThreshold: number;
}

const useSpeechRecognition = ({ 
  onResult, 
  onSilence,
  pauseThreshold
}: UseSpeechRecognitionProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<string>("en-IN");
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Store the complete transcript with proper line breaks between utterances
  const accumulatedTranscriptRef = useRef<string>('');
  
  // Track all results to avoid processing duplicates
  const processedResultsMapRef = useRef<Map<number, boolean>>(new Map());
  
  // Keep reference to the current recording session
  const sessionIdRef = useRef<string>(Date.now().toString());
  
  // Enhanced patient name detection
  const nameDetectionAttemptsRef = useRef<number>(0);
  const continuousTextBufferRef = useRef<string>('');
  const nameRecognitionPatterns = [
    /(?:namaste|hello|hi|hey)\s+([A-Z][a-z]{2,})/i,          // Common greetings
    /(?:patient|patient's) name is\s+([A-Z][a-z]{2,})/i,     // Explicit statement
    /(?:this is|i am|i'm)\s+([A-Z][a-z]{2,})/i,              // Self introduction
    /(?:meet|meeting)\s+([A-Z][a-z]{2,})/i,                  // Meeting introduction
    /(?:for|about|regarding)\s+([A-Z][a-z]{2,})/i,           // Reference introduction
    /(?:Mr\.|Mrs\.|Ms\.|Dr\.)\s+([A-Z][a-z]{2,})/i,          // Title with name
    /\b([A-Z][a-z]{2,})\s+(?:is here|has arrived|is waiting)/i // Person with context
  ];
  
  // Setup silence detection
  const setupSilenceDetection = () => {
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
    }

    silenceTimerRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastSpeech = now - lastSpeechTimeRef.current;
      
      // If silence longer than threshold, trigger callback
      if (timeSinceLastSpeech > pauseThreshold && isRecording) {
        onSilence();
        lastSpeechTimeRef.current = now; // Reset the timer
      }
    }, 200);
  };

  // Enhanced name detection function with multiple methods
  const detectPatientName = (text: string): string | null => {
    // Method 1: Try regex patterns
    for (const pattern of nameRecognitionPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    // Method 2: Look for capitalized words after greeting words
    const greetingFollowedByName = /(?:namaste|hello|hi|hey)\s+(\w+)/i;
    const greetingMatch = text.match(greetingFollowedByName);
    if (greetingMatch && greetingMatch[1]) {
      // Check if first letter is capital (likely a name)
      const possibleName = greetingMatch[1];
      if (possibleName.charAt(0) === possibleName.charAt(0).toUpperCase()) {
        return possibleName;
      }
    }
    
    // Method 3: Try to find any capitalized words in the text (less reliable)
    if (nameDetectionAttemptsRef.current > 3) {
      const capitalizedWords = text.match(/\b[A-Z][a-z]{2,}\b/g);
      if (capitalizedWords && capitalizedWords.length > 0) {
        // Take the first capitalized word as a potential name
        return capitalizedWords[0];
      }
    }
    
    return null;
  };

  const startRecording = async () => {
    try {
      // Generate new session ID when starting recording
      sessionIdRef.current = Date.now().toString();
      processedResultsMapRef.current.clear();
      nameDetectionAttemptsRef.current = 0;
      continuousTextBufferRef.current = '';
      accumulatedTranscriptRef.current = '';
      
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
        recognitionRef.current.lang = detectedLanguage;
        
        recognitionRef.current.onresult = (event) => {
          // Update last speech time
          lastSpeechTimeRef.current = Date.now();
          
          // Process results
          let interimTranscript = '';
          let finalTranscript = '';
          
          // Process new results, keeping track of what we've seen
          for (let i = event.resultIndex; i < event.results.length; i++) {
            // Skip already processed results
            if (processedResultsMapRef.current.has(i) && event.results[i].isFinal) {
              continue;
            }
            
            const transcript = event.results[i][0].transcript;
            
            // Add to continuous buffer for better name detection
            continuousTextBufferRef.current += ' ' + transcript;
            
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
              
              // Mark this result as processed
              processedResultsMapRef.current.set(i, true);
              
              // Add to accumulated transcript with an explicit line break
              // This ensures each speech segment is on its own line
              if (accumulatedTranscriptRef.current && !accumulatedTranscriptRef.current.endsWith('\n')) {
                accumulatedTranscriptRef.current += '\n';
              }
              accumulatedTranscriptRef.current += transcript;
              
              // Detect language and update if needed
              const newLanguage = detectLanguage(transcript);
              if (newLanguage !== detectedLanguage) {
                setDetectedLanguage(newLanguage);
                if (recognitionRef.current) {
                  recognitionRef.current.lang = newLanguage;
                }
              }
            } else {
              interimTranscript += transcript;
            }
          }
          
          // Send both the immediate result and the accumulated transcript
          onResult({
            transcript: finalTranscript || interimTranscript,
            isFinal: !!finalTranscript,
            resultIndex: event.resultIndex
          });
          
          // For diagnostic purposes
          console.log("Accumulated transcript:", accumulatedTranscriptRef.current);
          console.log("Continuous buffer:", continuousTextBufferRef.current);
          
          // Try to detect patient name more aggressively
          nameDetectionAttemptsRef.current++;
          const detectedName = detectPatientName(continuousTextBufferRef.current);
          
          if (detectedName) {
            console.log("Detected patient name:", detectedName);
            // We would trigger a callback here to set the patient name
            // This needs to be implemented in the onResult handler in VoiceRecorder
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
          } else if (event.error === 'no-speech') {
            // This is normal, don't show an error
            console.log('No speech detected');
          } else {
            toast.error('Error with speech recognition. Please try again.');
            setIsRecording(false);
          }
        };
        
        recognitionRef.current.start();
        setupSilenceDetection();
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  return {
    isRecording,
    detectedLanguage,
    startRecording,
    stopRecording,
    toggleRecording: () => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    },
    // Expose the accumulated transcript
    getAccumulatedTranscript: () => accumulatedTranscriptRef.current,
    resetTranscript: () => {
      accumulatedTranscriptRef.current = '';
      continuousTextBufferRef.current = '';
      nameDetectionAttemptsRef.current = 0;
    }
  };
};

export default useSpeechRecognition;
