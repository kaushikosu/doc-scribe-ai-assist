import { useState, useRef, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { detectLanguage } from '@/utils/speaker';

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

  const startRecording = async () => {
    try {
      // Generate new session ID when starting recording
      sessionIdRef.current = Date.now().toString();
      processedResultsMapRef.current.clear();
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
          } else {
            toast.error('Error with speech recognition. Please try again.');
            setIsRecording(false);
          }
        };
        
        recognitionRef.current.start();
        setupSilenceDetection();
        setIsRecording(true);
        toast.success('Recording started');
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
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop all tracks in the stream to release the microphone
    if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
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
    }
  };
};

export default useSpeechRecognition;
