import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import VoiceRecorder from '@/components/VoiceRecorder';
import TranscriptEditor from '@/components/TranscriptEditor';
import PrescriptionGenerator from '@/components/PrescriptionGenerator';
import PatientSessionBar from '@/components/PatientSessionBar';
import DocHeader from '@/components/DocHeader';
import StatusBanner from '@/components/StatusBanner';
import PatientInfoBar from '@/components/PatientInfoBar';
import { mapDeepgramSpeakersToRoles } from '@/utils/deepgramSpeechToText';
import StatusStepsBar from '@/components/StatusStepsBar';
import { generateMockPatient, MockPatientData } from '@/utils/mockPatientData';
import { createPatient, Patient } from '@/integrations/supabase/patients';
import { createConsultationSession, ConsultationSession, updateConsultationSession } from '@/integrations/supabase/consultationSessions';

const Index = () => {
  const [transcript, setTranscript] = useState('');
  const [patientInfo, setPatientInfo] = useState({
    name: '',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });
  const [currentPatient, setCurrentPatient] = useState<MockPatientData | null>(null);
  const [currentPatientRecord, setCurrentPatientRecord] = useState<Patient | null>(null);
  const [currentSessionRecord, setCurrentSessionRecord] = useState<ConsultationSession | null>(null);
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

// Handle recording start - create patient if none exists
const handleRecordingStart = async () => {
  if (!currentPatientRecord) {
    await generateNewPatient();
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
    // Create patient in the database with all ABDM-required details
    const patient = await createPatient({
      name: mockPatient.name,
      abha_id: mockPatient.abhaId,
      age: mockPatient.age,
      gender: mockPatient.gender,
      phone: mockPatient.phone,
      address: mockPatient.address,
      emergency_contact: mockPatient.emergencyContact,
      medical_history: mockPatient.medicalHistory,
      blood_group: mockPatient.bloodGroup,
      allergies: mockPatient.allergies,
    });
    setCurrentPatientRecord(patient);
    
    // Create initial consultation session
    const session = await createConsultationSession({
      patient_id: patient.id,
      live_transcript: '',
      updated_transcript: '',
      prescription: '',
      audio_path: null
    });
    setCurrentSessionRecord(session);
  } catch (error) {
    console.error('Failed to create patient and session:', error);
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

// Don't generate patient on component mount - wait for user action

  return (
    <div className="min-h-screen bg-gradient-to-b from-doctor-light via-white to-doctor-light/20">
      <PatientSessionBar 
        patient={currentPatientRecord} 
        sessionStartTime={patientInfo.time}
      />
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
              onRecordingStart={handleRecordingStart}
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
    currentPatient={currentPatientRecord}
    sessionId={currentSessionRecord?.id}
    onGeneratingStart={() => {
      setProgressStep('generating');
      setStatus({ type: 'generating', message: 'Generating prescription...' });
    }}
    onGenerated={async () => {
      setProgressStep('generated');
      setStatus({ type: 'ready', message: 'Prescription generated' });
      
      // Update consultation session with transcripts only
      if (currentSessionRecord) {
        try {
          await updateConsultationSession(currentSessionRecord.id, {
            live_transcript: transcript,
            updated_transcript: classifiedTranscript,
            session_ended_at: new Date().toISOString()
          });
        } catch (error) {
          console.error('Failed to update consultation session:', error);
        }
      }
      
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
