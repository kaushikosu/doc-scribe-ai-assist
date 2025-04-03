
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

interface VoiceRecorderProps {
  onTranscriptUpdate: (transcript: string) => void;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onTranscriptUpdate }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
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
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }
          
          const newTranscript = transcript + finalTranscript + interimTranscript;
          setTranscript(newTranscript);
          onTranscriptUpdate(newTranscript);
        };
        
        recognitionRef.current.onerror = (event) => {
          console.error('Speech recognition error', event.error);
          toast.error('Error with speech recognition. Please try again.');
          setIsRecording(false);
        };
        
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
      setTranscript('');
      onTranscriptUpdate('');
      startRecording();
    }
  };

  return (
    <Card className="border-2 border-doctor-primary/30">
      <CardContent className="p-4">
        <div className="flex flex-col items-center gap-4">
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
          
          <div className="text-center">
            {isRecording ? (
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-destructive animate-pulse-recording"></span>
                <span className="font-medium">Recording in progress...</span>
              </div>
            ) : (
              <span className="text-muted-foreground">Press to start recording</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VoiceRecorder;
