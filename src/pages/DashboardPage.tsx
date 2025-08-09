import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import VoiceRecorder from '@/components/VoiceRecorder';
import TranscriptEditor from '@/components/TranscriptEditor';
import PrescriptionGenerator from '@/components/PrescriptionGenerator';
import DocHeader from '@/components/DocHeader';


import useAudioRecorder from '@/hooks/useAudioRecorder';
import { DiarizedTranscription } from '@/utils/diarizedTranscription';
import { processCompleteAudio, mapDeepgramSpeakersToRoles } from '@/utils/deepgramSpeechToText';

const DashboardPage = () => {
  const [transcript, setTranscript] = useState('');
  const [classifiedTranscript, setClassifiedTranscript] = useState('');
  const [patientInfo, setPatientInfo] = useState({
    name: '',
    time: ''
  });
  const [isRecording, setIsRecording] = useState(false);
  const [displayMode, setDisplayMode] = useState<'live' | 'revised'>('live');
  type StatusType = 'idle' | 'recording' | 'processing' | 'updated' | 'generating' | 'ready' | 'error';
  const [status, setStatus] = useState<{ type: StatusType; message?: string }>({ type: 'idle' });
  const [isDiarizing, setIsDiarizing] = useState(false);
  const [diarizedTranscription, setDiarizedTranscription] = useState<DiarizedTranscription | null>(null);
  
  const mountedRef = useRef(true);
  const prescriptionRef = useRef<HTMLDivElement>(null);
  
  const googleApiKey = import.meta.env.VITE_GOOGLE_SPEECH_API_KEY;
  const deepgramApiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
  
  const {
    isRecording: isAudioRecording,
    recordingDuration,
    formattedDuration,
    startRecording: startAudioRecording,
    stopRecording: stopAudioRecording,
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
    };
  }, []);

  useEffect(() => {
    console.log("Transcript updated in DashboardPage:", transcript);
  }, [transcript]);
  
  
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

  
  const processDiarizedTranscription = async (audioBlob: Blob) => {
    if (!deepgramApiKey) {
      console.error("Deepgram API key is missing");
      setStatus({ type: 'error', message: 'Deepgram API key is not configured' });
      return;
    }
    
    if (!audioBlob || audioBlob.size === 0) {
      console.error("No audio data to process");
      setStatus({ type: 'error', message: 'No audio recorded for diarization' });
      return;
    }
    
    console.log("Processing audio blob for diarization with Deepgram:", audioBlob.size, "bytes");
    setIsDiarizing(true);
    setStatus({ type: 'processing', message: 'Revising transcription' });
    
    try {
      // Process audio with Deepgram
      const { transcript: diarizedText, error } = await processCompleteAudio(audioBlob, deepgramApiKey);
      console.log("Diarized text from Deepgram:", diarizedText?.length, "characters");
      
      if (error) {
        console.error("Deepgram error:", error);
        setDiarizedTranscription({
          transcript: "Deepgram error",
          error: error
        });
        setStatus({ type: 'error', message: 'Diarization error: ' + error });
      } else if (!diarizedText || diarizedText.trim().length === 0) {
        console.warn("No speech detected by Deepgram");
        setDiarizedTranscription({
          transcript: "No speech detected by deepgram",
          error: "No speech detected"
        });
        setStatus({ type: 'error', message: 'No speech detected in the audio' });
      } else {
        const result: DiarizedTranscription = {
          transcript: diarizedText,
          error: undefined
        };
        
        console.log("Deepgram diarization complete:", result);
        setDiarizedTranscription(result);

        // Map Deepgram speakers to roles and set classified transcript for prescription
        const { classifiedTranscript: mapped } = mapDeepgramSpeakersToRoles(diarizedText, { 0: 'Doctor', 1: 'Patient' });
        setClassifiedTranscript(mapped);
        setTranscript(mapped);
         setDisplayMode('revised');
         setStatus({ type: 'ready', message: 'Revised transcript ready' });
         setTimeout(() => setStatus({ type: 'idle' }), 800);
      }
      
      setIsDiarizing(false);
      
    } catch (error: any) {
      console.error("Error in Deepgram diarized transcription:", error);
      setIsDiarizing(false);
      setDiarizedTranscription({
        transcript: "Error in deepgram transcription",
        error: error.message || "Unknown error processing audio"
      });
      setStatus({ type: 'error', message: 'Failed to process diarized transcription with Deepgram' });
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
  
  if (recordingState) {
    setDisplayMode('live');
    setStatus({ type: 'recording', message: 'Recording in progress' });
  }
  
  if (!recordingState && transcript) {
    // no status change here; processing state will be set when diarization starts
  }
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
                  <span>Speak naturally about the patient's condition, symptoms, and medications</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">3</span>
                  <span>When you stop recording, a revised transcript will appear</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">4</span>
                  <span>A prescription will be automatically generated based on the conversation</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">5</span>
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
  mode={displayMode}
  status={status}
/>


<div ref={prescriptionRef} className="animate-fade-in">
  <PrescriptionGenerator 
    transcript={transcript} 
    patientInfo={patientInfo}
    classifiedTranscript={classifiedTranscript}
  />
</div>
          </div>
        </div>
      </div>
      
    </div>
  );
};

export default DashboardPage;
