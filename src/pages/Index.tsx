import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import VoiceRecorder from '@/components/VoiceRecorder';
import TranscriptEditor from '@/components/TranscriptEditor';
import PrescriptionGenerator from '@/components/PrescriptionGenerator';
import DocHeader from '@/components/DocHeader';
import StatusBanner from '@/components/StatusBanner';
import PatientInfoBar from '@/components/PatientInfoBar';
import { mapDeepgramSpeakersToRoles } from '@/utils/deepgramSpeechToText';
import StatusStepsBar from '@/components/StatusStepsBar';
import { generateMockPatient, MockPatientData } from '@/utils/mockPatientData';
import { createPatientRecord } from '@/integrations/supabase/patientRecords';

const Index = () => {
  const [transcript, setTranscript] = useState('');
  const [patientInfo, setPatientInfo] = useState({
    name: '',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });
  const [currentPatient, setCurrentPatient] = useState<MockPatientData | null>(null);
const [isRecording, setIsRecording] = useState(false);
const [hasRecordingStarted, setHasRecordingStarted] = useState(false);
const [classifiedTranscript, setClassifiedTranscript] = useState('');
const [displayMode, setDisplayMode] = useState<'live' | 'revised'>('live');
// Top progress bar state
// Status banner state
type StatusType = 'idle' | 'recording' | 'processing' | 'updated' | 'generating' | 'ready' | 'error';
const [status, setStatus] = useState<{ type: StatusType; message?: string }>({ type: 'idle' });
// Progress step
type ProgressStep = 'recording' | 'processing' | 'generating' | 'generated';
const [progressStep, setProgressStep] = useState<ProgressStep>('recording');
// Session id to reset child components
const [sessionId, setSessionId] = useState(0);

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
    if (!hasRecordingStarted) setHasRecordingStarted(true);
    setDisplayMode('live');
    setProgressStep('recording');
    setStatus({ type: 'recording', message: 'Recording in progress' });
  } else if (hasRecordingStarted) {
    setDisplayMode('revised');
    setProgressStep('processing');
    setStatus({ type: 'processing', message: 'Updating transcript...' });
  }
};

// Generate new patient with mock data and save to database
const generateNewPatient = async () => {
  const mockPatient = generateMockPatient();
  setCurrentPatient(mockPatient);
  setPatientInfo({
    name: mockPatient.name,
    time: mockPatient.sessionStartTime
  });

  try {
    // Save patient record to database immediately
    await createPatientRecord({
      patient_name: mockPatient.name,
      patient_abha_id: mockPatient.abhaId,
      patient_age: mockPatient.age,
      patient_gender: mockPatient.gender,
      patient_phone: mockPatient.phone,
      patient_address: mockPatient.address,
      patient_emergency_contact: mockPatient.emergencyContact,
      patient_medical_history: mockPatient.medicalHistory,
      patient_blood_group: mockPatient.bloodGroup,
      patient_allergies: mockPatient.allergies,
      prescription: '', // Will be filled when prescription is generated
      live_transcript: '',
      updated_transcript: '',
      audio_path: null
    });
  } catch (error) {
    console.error('Failed to save initial patient record:', error);
  }
};

// New Patient handler: reset everything and generate new patient
const handleNewPatient = () => {
  setIsRecording(false);
  setHasRecordingStarted(false);
  setDisplayMode('live');
  setTranscript('');
  setClassifiedTranscript('');
  setProgressStep('recording');
  setStatus({ type: 'idle' });
  setSessionId((id) => id + 1);
  generateNewPatient();
};

// Generate initial patient on component mount
useEffect(() => {
  generateNewPatient();
}, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-doctor-light via-white to-doctor-light/20">
      <div className="container py-8 max-w-6xl">
        {hasRecordingStarted && <StatusBanner status={status} />}
        <StatusStepsBar currentStep={progressStep} />
        <DocHeader patientInfo={patientInfo} />
        <PatientInfoBar patientData={currentPatient} />
        
        <div className="grid gap-6 md:grid-cols-12">
          {/* Voice Recorder Column */}
          <div className="md:col-span-4 space-y-6">
            <VoiceRecorder 
              onTranscriptUpdate={handleTranscriptUpdate} 
              onPatientInfoUpdate={handlePatientInfoUpdate}
              onRecordingStateChange={handleRecordingStateChange}
              onNewPatient={handleNewPatient}
            />
            
            <Card className="p-5 border rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-4">How to use DocScribe</h2>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-2 items-start">
                  <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">1</span>
                  <span>Configure Azure Speech API key and region</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">2</span>
                  <span>Speak naturally about the patient's condition, symptoms, and medications</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">3</span>
                  <span>The transcript will appear in real-time and can be edited if needed</span>
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
          
          {/* Main Content Column */}
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
    key={sessionId}
    transcript={transcript} 
    patientInfo={patientInfo} 
    classifiedTranscript={classifiedTranscript}
    onGeneratingStart={() => {
      setProgressStep('generating');
      setStatus({ type: 'generating', message: 'Generating prescription...' });
    }}
    onGenerated={() => {
      setProgressStep('generated');
      setStatus({ type: 'ready', message: 'Prescription generated' });
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
