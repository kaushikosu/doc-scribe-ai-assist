import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import VoiceRecorder from '@/components/VoiceRecorder';
import TranscriptEditor from '@/components/TranscriptEditor';
import PrescriptionGenerator from '@/components/PrescriptionGenerator';
import DocHeader from '@/components/DocHeader';
import { mapDeepgramSpeakersToRoles } from '@/utils/deepgramSpeechToText';
import StatusStepsBar from '@/components/StatusStepsBar';

const Index = () => {
  const [transcript, setTranscript] = useState('');
  const [patientInfo, setPatientInfo] = useState({
    name: 'John Doe',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });
const [isRecording, setIsRecording] = useState(false);
const [classifiedTranscript, setClassifiedTranscript] = useState('');
const [displayMode, setDisplayMode] = useState<'live' | 'revised'>('live');
// Top progress bar state
type ProgressStep = 'recording' | 'processing' | 'generating' | 'generated';
const [progressStep, setProgressStep] = useState<ProgressStep>('recording');

  const prescriptionRef = useRef<HTMLDivElement>(null);

  const handleTranscriptUpdate = (newTranscript: string) => {
    setTranscript(newTranscript);
  };

  const handlePatientInfoUpdate = (newPatientInfo: { name: string; time: string }) => {
    setPatientInfo(newPatientInfo);
  };
  
const handleRecordingStateChange = (recordingState: boolean) => {
  setIsRecording(recordingState);
  if (recordingState) {
    setDisplayMode('live');
    setProgressStep('recording');
  } else if (!recordingState && transcript) {
    setProgressStep('processing');
  }
};

// Receive Deepgram diarized transcript, map speakers to roles, and store classified text
const handleDiarizedTranscriptUpdate = (deepgramTranscript: string) => {
  if (!deepgramTranscript) return;
  const { classifiedTranscript: mapped } = mapDeepgramSpeakersToRoles(deepgramTranscript, { 0: 'Doctor', 1: 'Patient' });
  setTranscript(mapped);
  setClassifiedTranscript(mapped);
  setDisplayMode('revised');
  // Move to generating step after processing is complete
  if (progressStep === 'processing') {
    setProgressStep('generating');
  }
};

  return (
    <div className="min-h-screen bg-gradient-to-b from-doctor-light via-white to-doctor-light/20">
      <div className="container py-8 max-w-6xl">
        <StatusStepsBar currentStep={progressStep} />
        <DocHeader patientInfo={patientInfo} />
        
        <div className="grid gap-6 md:grid-cols-12">
          {/* Voice Recorder Column */}
          <div className="md:col-span-4 space-y-6">
            <VoiceRecorder 
              onTranscriptUpdate={handleTranscriptUpdate} 
              onDiarizedTranscriptUpdate={handleDiarizedTranscriptUpdate}
              onPatientInfoUpdate={handlePatientInfoUpdate}
              onRecordingStateChange={handleRecordingStateChange}
            />
            
            <Card className="p-5 border-none shadow-md bg-gradient-to-br from-doctor-primary/20 via-doctor-primary/10 to-transparent rounded-xl">
              <h2 className="font-semibold text-doctor-primary mb-4 text-lg">How to use DocScribe</h2>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-2 items-start">
                  <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">1</span>
                  <span>Configure Azure Speech API key and region</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">2</span>
                  <span>Press Record to start/stop recording for the current patient</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">3</span>
                  <span>Speak naturally about the patient's condition, symptoms, and medications</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">4</span>
                  <span>The transcript will appear in real-time and can be edited if needed</span>
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
          
          {/* Main Content Column */}
          <div className="md:col-span-8 space-y-6">
<TranscriptEditor 
  transcript={transcript} 
  onTranscriptChange={setTranscript}
  isRecording={isRecording}
  mode={displayMode}
/>
            
<div ref={prescriptionRef} className="animate-fade-in">
  <PrescriptionGenerator 
    transcript={transcript} 
    patientInfo={patientInfo} 
    classifiedTranscript={classifiedTranscript}
    onGeneratingStart={() => setProgressStep('generating')}
    onGenerated={() => {
      setProgressStep('generated');
      prescriptionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }}
  />
</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
