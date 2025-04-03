
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, Save, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

interface VoiceRecorderProps {
  onTranscriptUpdate: (transcript: string) => void;
  onPatientInfoUpdate: (patientInfo: { name: string; time: string }) => void;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onTranscriptUpdate, onPatientInfoUpdate }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isNewSession, setIsNewSession] = useState(true);
  const [lastProcessedIndex, setLastProcessedIndex] = useState(0);
  const [speakerTurn, setSpeakerTurn] = useState<'Doctor' | 'Patient'>('Doctor');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startNewSession = () => {
    setTranscript('');
    onTranscriptUpdate('');
    setIsNewSession(true);
    setSpeakerTurn('Doctor');
    setLastProcessedIndex(0);
    toast.success('Ready for new patient');
  };

  const toggleSpeaker = () => {
    setSpeakerTurn(prev => prev === 'Doctor' ? 'Patient' : 'Doctor');
    // Add a visual indicator for the speaker change
    const speakerChangeText = `\n\n[${speakerTurn === 'Doctor' ? 'Patient' : 'Doctor'} speaking]\n`;
    const newTranscript = transcript + speakerChangeText;
    setTranscript(newTranscript);
    onTranscriptUpdate(newTranscript);
  };

  const startRecording = async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create media recorder
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      // Setup Web Speech API
      if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        
        recognitionRef.current.onresult = (event) => {
          let interimTranscript = '';
          let finalTranscript = '';
          
          // Only process new results
          for (let i = lastProcessedIndex; i < event.results.length; i++) {
            const result = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
              // For final results, prefix with the current speaker
              finalTranscript += `[${speakerTurn}]: ${result}\n`;
              setLastProcessedIndex(i + 1);
            } else {
              interimTranscript += result;
            }
          }
          
          // Update transcript without losing previous content
          if (finalTranscript) {
            const newTranscript = transcript + finalTranscript;
            setTranscript(newTranscript);
            onTranscriptUpdate(newTranscript);
          }

          // Check for name mention in initial greeting patterns (only in Doctor's statements)
          if (isNewSession && speakerTurn === 'Doctor') {
            const greetingPatterns = [
              /hi\s+([A-Za-z]+)/i,
              /hello\s+([A-Za-z]+)/i,
              /patient\s+(?:is|name\s+is)?\s*([A-Za-z]+)/i,
              /this\s+is\s+([A-Za-z]+)/i,
              /([A-Za-z]+)\s+is\s+here/i
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

          // Check for "save prescription" command
          if ((finalTranscript.toLowerCase().includes("save prescription") || 
               finalTranscript.toLowerCase().includes("print prescription")) && 
              speakerTurn === 'Doctor') {
            toast.success("Saving prescription...");
            // Here you would trigger the save/print functionality
          }
        };
        
        recognitionRef.current.onerror = (event) => {
          console.error('Speech recognition error', event.error);
          toast.error('Error with speech recognition. Please try again.');
          setIsRecording(false);
        };
        
        // Initialize the transcript with the current speaker if it's empty
        if (!transcript) {
          const initialTranscript = `[${speakerTurn}]: `;
          setTranscript(initialTranscript);
          onTranscriptUpdate(initialTranscript);
        }
        
        recognitionRef.current.start();
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
    
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
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
    <Card className="border-2 border-doctor-primary/30">
      <CardContent className="p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="flex space-x-4">
            <Button 
              onClick={toggleRecording}
              className={cn(
                "w-16 h-16 rounded-full flex justify-center items-center",
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
              className="w-16 h-16 rounded-full flex justify-center items-center bg-doctor-accent hover:bg-doctor-accent/90"
              disabled={isRecording}
            >
              <UserPlus className="h-8 w-8" />
            </Button>
          </div>
          
          <div className="text-center">
            {isRecording ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-destructive animate-pulse-recording"></span>
                  <span className="font-medium">Recording as {speakerTurn}</span>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={toggleSpeaker}
                  className="mt-2"
                >
                  Switch to {speakerTurn === 'Doctor' ? 'Patient' : 'Doctor'}
                </Button>
              </div>
            ) : (
              <span className="text-muted-foreground">
                {isNewSession ? 
                  "Say 'Hi [patient name]' to start" : 
                  "Press to resume recording"
                }
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VoiceRecorder;
