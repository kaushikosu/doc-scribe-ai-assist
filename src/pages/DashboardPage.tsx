
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import VoiceRecorder from '@/components/VoiceRecorder';
import TranscriptEditor from '@/components/TranscriptEditor';
import PrescriptionGenerator from '@/components/PrescriptionGenerator';
import DocHeader from '@/components/DocHeader';
import { Toaster } from '@/components/ui/sonner';
import { classifyTranscript } from '@/utils/speaker';
import { toast } from '@/lib/toast';
import useAudioRecorder from '@/hooks/useAudioRecorder';
import DiarizedTranscriptView from '@/components/DiarizedTranscriptView';
import { getDiarizedTranscription, DiarizedTranscription } from '@/utils/diarizedTranscription';

const DashboardPage = () => {
  const [transcript, setTranscript] = useState('');
  const [classifiedTranscript, setClassifiedTranscript] = useState('');
  const [patientInfo, setPatientInfo] = useState({
    name: '',
    time: ''
  });
  const [isRecording, setIsRecording] = useState(false);
  
  const [isDiarizing, setIsDiarizing] = useState(false);
  const [diarizedTranscription, setDiarizedTranscription] = useState<DiarizedTranscription | null>(null);
  
  const lastProcessedTranscriptRef = useRef('');
  const mountedRef = useRef(true);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  
  const googleApiKey = import.meta.env.VITE_GOOGLE_SPEECH_API_KEY;
  
  const {
    isRecording: isAudioRecording,
    recordingDuration,
    formattedDuration,
    startRecording: startAudioRecording,
    stopRecording: stopAudioRecording,
    reset: resetAudioRecorder,
    audioBlob
  } = useAudioRecorder({
    onRecordingComplete: (blob) => {
      console.log("Full audio recording complete:", blob.size, "bytes");
      processDiarizedTranscription(blob);
    }
  });
  
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    console.log("Transcript updated in DashboardPage:", transcript);
  }, [transcript]);
  
  useEffect(() => {
    if (!isRecording && transcript && transcript !== lastProcessedTranscriptRef.current) {
      console.log("Recording stopped, auto-classifying transcript");
      handleTranscriptClassification();
    }
  }, [isRecording, transcript]);
  
  useEffect(() => {
    if (isRecording && !isAudioRecording) {
      console.log("Starting full audio recording for diarization");
      startAudioRecording();
    } else if (!isRecording && isAudioRecording) {
      console.log("Stopping full audio recording and processing for diarization");
      stopAudioRecording();
      if (!transcript) {
        setDiarizedTranscription(null);
      }
    }
  }, [isRecording, isAudioRecording, startAudioRecording, stopAudioRecording, transcript]);

  const handleTranscriptClassification = useCallback(() => {
    if (!transcript || transcript.trim().length === 0 || transcript === lastProcessedTranscriptRef.current) {
      return;
    }
    
    setIsClassifying(true);
    
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }
    
    timeoutIdRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      
      try {
        const classified = classifyTranscript(transcript);
        lastProcessedTranscriptRef.current = transcript;
        
        if (mountedRef.current) {
          setClassifiedTranscript(classified);
          setIsClassifying(false);
          console.log("Transcript classified successfully");
        }
      } catch (error) {
        console.error("Error classifying transcript:", error);
        if (mountedRef.current) {
          setIsClassifying(false);
          toast.error("Failed to classify transcript");
        }
      }
    }, 800);
  }, [transcript]);
  
  const processDiarizedTranscription = async (audioBlob: Blob) => {
    if (!googleApiKey) {
      console.error("Google Speech API key is missing");
      toast.error("Google Speech API key is not configured");
      return;
    }
    
    if (!audioBlob || audioBlob.size === 0) {
      console.error("No audio data to process");
      toast.error("No audio recorded for diarization");
      return;
    }
    
    console.log("Processing audio blob for diarization:", audioBlob.size, "bytes");
    setIsDiarizing(true);
    toast.info("Processing full audio for diarized transcription...");
    
    try {
      const result = await getDiarizedTranscription({
        apiKey: googleApiKey,
        audioBlob,
        speakerCount: 2
      });
      
      if (mountedRef.current) {
        console.log("Diarization complete:", result);
        setDiarizedTranscription(result);
        
        if (result.error) {
          toast.error("Diarization error: " + result.error);
        } else if (result.words.length === 0) {
          toast.warning("No speech detected in the audio");
        } else {
          toast.success(`Diarized transcription complete (${result.speakerCount} speakers detected)`);
        }
        
        setIsDiarizing(false);
      }
    } catch (error: any) {
      console.error("Error in diarized transcription:", error);
      if (mountedRef.current) {
        setIsDiarizing(false);
        setDiarizedTranscription({
          transcript: "",
          words: [],
          speakerCount: 0,
          error: error.message
        });
        toast.error("Failed to process diarized transcription");
      }
    }
  };

  const handleTranscriptUpdate = (newTranscript: string) => {
    console.log("handleTranscriptUpdate called with:", newTranscript?.length);
    if (newTranscript !== undefined) {
      setTranscript(newTranscript);
    }
  };

  const handlePatientInfoUpdate = (newPatientInfo: { name: string; time: string }) => {
    setPatientInfo(newPatientInfo);
  };
  
  const handleRecordingStateChange = (recordingState: boolean) => {
    console.log("Recording state changed to:", recordingState);
    setIsRecording(recordingState);
    
    if (!recordingState && transcript) {
      toast.info('Processing transcript...');
    }
  };

  // Add a reset function to handle "New Patient" action
  const handleNewPatient = () => {
    console.log("New patient button clicked, resetting all components");
    
    // Reset transcript state
    setTranscript('');
    setClassifiedTranscript('');
    lastProcessedTranscriptRef.current = '';
    
    // Reset patient info
    setPatientInfo({
      name: '',
      time: ''
    });
    
    // Reset diarized transcription
    setDiarizedTranscription(null);
    setIsDiarizing(false);
    
    // Reset audio recorder
    resetAudioRecorder();
    
    toast.success("Ready for new patient");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-doctor-light via-white to-doctor-light/20">
      <div className="container py-8 max-w-6xl">
        <DocHeader patientInfo={patientInfo} />
        
        <div className="grid gap-6 md:grid-cols-12">
          <div className="md:col-span-4 space-y-6">
            <VoiceRecorder 
              onTranscriptUpdate={handleTranscriptUpdate} 
              onPatientInfoUpdate={handlePatientInfoUpdate}
              onRecordingStateChange={handleRecordingStateChange}
              onNewPatient={handleNewPatient}
            />
            
            <Card className="p-5 border-none shadow-md bg-gradient-to-br from-doctor-primary/20 via-doctor-primary/10 to-transparent rounded-xl">
              <h2 className="font-semibold text-doctor-primary mb-4 text-lg">How to use DocScribe</h2>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-2 items-start">
                  <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">1</span>
                  <span>Click the microphone button to start recording</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">2</span>
                  <span>Say "Hi [patient name]" to begin a new session</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">3</span>
                  <span>Speak naturally about the patient's condition, symptoms, and medications</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">4</span>
                  <span>When you stop recording, the transcript will be classified automatically</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">5</span>
                  <span>A prescription will be automatically generated based on the conversation</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">6</span>
                  <span>Press the "New Patient" button for the next consultation</span>
                </li>
              </ol>
            </Card>
          </div>
          
          <div className="md:col-span-8 space-y-6">
            <TranscriptEditor 
              transcript={transcript} 
              onTranscriptChange={setTranscript}
              isRecording={isRecording}
            />
            
            <DiarizedTranscriptView 
              diarizedData={diarizedTranscription}
              isProcessing={isDiarizing}
              recordingDuration={formattedDuration}
              isRecording={isAudioRecording}
              audioBlob={audioBlob}
            />
            
            <PrescriptionGenerator 
              transcript={transcript} 
              patientInfo={patientInfo}
              classifiedTranscript={classifiedTranscript}
              isClassifying={isClassifying}
            />
          </div>
        </div>
      </div>
      
      <Toaster />
    </div>
  );
};

export default DashboardPage;
