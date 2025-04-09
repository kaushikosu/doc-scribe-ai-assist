
import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import VoiceRecorder from '@/components/VoiceRecorder';
import TranscriptEditor from '@/components/TranscriptEditor';
import PrescriptionGenerator from '@/components/PrescriptionGenerator';
import DocHeader from '@/components/DocHeader';
import { Toaster } from '@/components/ui/sonner';
import useAudioRecorder from '@/hooks/useAudioRecorder';
import DiarizedTranscriptView from '@/components/DiarizedTranscriptView';
import { useTranscriptProcessor } from '@/hooks/useTranscriptProcessor';
import { useDiarization } from '@/hooks/useDiarization';
import HelpSidebar from '@/components/HelpSidebar';
import { toast } from '@/lib/toast';

const DashboardPage = () => {
  const [transcript, setTranscript] = useState('');
  const [classifiedTranscript, setClassifiedTranscript] = useState('');
  const [patientInfo, setPatientInfo] = useState({
    name: '',
    time: ''
  });
  const [isRecording, setIsRecording] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  
  const googleApiKey = import.meta.env.VITE_GOOGLE_SPEECH_API_KEY;
  
  // Custom hooks
  const {
    isClassifying: isClassifyingTranscript,
    handleTranscriptClassification
  } = useTranscriptProcessor({
    onTranscriptClassified: setClassifiedTranscript
  });
  
  const {
    isDiarizing,
    diarizedTranscription,
    processDiarizedTranscription,
    resetDiarization
  } = useDiarization();
  
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
      processDiarizedTranscription(blob, googleApiKey);
    }
  });
  
  useEffect(() => {
    console.log("Transcript updated in DashboardPage:", transcript);
  }, [transcript]);
  
  useEffect(() => {
    if (!isRecording && transcript) {
      console.log("Recording stopped, auto-classifying transcript");
      handleTranscriptClassification(transcript);
    }
  }, [isRecording, transcript, handleTranscriptClassification]);
  
  useEffect(() => {
    if (isRecording && !isAudioRecording) {
      console.log("Starting full audio recording for diarization");
      startAudioRecording();
    } else if (!isRecording && isAudioRecording) {
      console.log("Stopping full audio recording and processing for diarization");
      stopAudioRecording();
      if (!transcript) {
        resetDiarization();
      }
    }
  }, [isRecording, isAudioRecording, startAudioRecording, stopAudioRecording, transcript, resetDiarization]);

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

  // Reset function to handle "New Patient" action
  const handleNewPatient = () => {
    console.log("New patient button clicked, resetting all components");
    
    // Reset transcript state
    setTranscript('');
    setClassifiedTranscript('');
    
    // Reset patient info
    setPatientInfo({
      name: '',
      time: ''
    });
    
    // Reset diarized transcription
    resetDiarization();
    
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
            
            <HelpSidebar />
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
              isClassifying={isClassifyingTranscript}
            />
          </div>
        </div>
      </div>
      
      <Toaster />
    </div>
  );
};

export default DashboardPage;
