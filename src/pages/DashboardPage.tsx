import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import VoiceRecorder from '@/components/VoiceRecorder';
import TranscriptEditor from '@/components/TranscriptEditor';
import PrescriptionGenerator from '@/components/PrescriptionGenerator';
import DocHeader from '@/components/DocHeader';
import StatusBanner from '@/components/StatusBanner';
import DebugPanel from '@/components/DebugPanel';

import { supabase } from '@/integrations/supabase/client';

import useAudioRecorder from '@/hooks/useAudioRecorder';
import { DiarizedTranscription } from '@/utils/diarizedTranscription';
import { processCompleteAudioWithCorrection, mapDeepgramSpeakersToRoles, processCompleteAudio } from '@/utils/deepgramSpeechToText';
import { generateMockPatient, MockPatientData } from '@/utils/mockPatientData';
import { createPatient, Patient } from '@/integrations/supabase/patients';
import { createConsultationSession, ConsultationSession, updateConsultationSession, uploadSessionAudio } from '@/integrations/supabase/consultationSessions';

const DashboardPage = () => {
  const [transcript, setTranscript] = useState('');
  const [classifiedTranscript, setClassifiedTranscript] = useState('');
  const [patientInfo, setPatientInfo] = useState({
    name: '',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });
  const [currentPatient, setCurrentPatient] = useState<MockPatientData | null>(null);
  const [currentPatientRecord, setCurrentPatientRecord] = useState<Patient | null>(null);
  const [currentSessionRecord, setCurrentSessionRecord] = useState<ConsultationSession | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecordingStarted, setHasRecordingStarted] = useState(false);
  const [displayMode, setDisplayMode] = useState<'live' | 'revised'>('live');
  const [enableAICorrection, setEnableAICorrection] = useState(true);
  
  // Debug panel states
  const [liveTranscript, setLiveTranscript] = useState('');
  const [deepgramTranscript, setDeepgramTranscript] = useState('');
  const [deepgramUtterances, setDeepgramUtterances] = useState<Array<{
    speaker: string;
    ts_start: number;
    ts_end: number;
    text: string;
  }>>([]);
  const [ir, setIr] = useState<any>(null);
  const [soap, setSoap] = useState<any>(null);
  const [prescription, setPrescription] = useState<any>(null);
  type StatusType = 'idle' | 'recording' | 'processing' | 'updated' | 'generating' | 'ready' | 'error';
  type ProgressStep = 'recording' | 'processing' | 'generating' | 'generated';
  const [status, setStatus] = useState<{ type: StatusType; message?: string }>({ type: 'idle' });
  const [progressStep, setProgressStep] = useState<ProgressStep>('recording');
  const [isDiarizing, setIsDiarizing] = useState(false);
  const [diarizedTranscription, setDiarizedTranscription] = useState<DiarizedTranscription | null>(null);
  
  const mountedRef = useRef(true);
  const prescriptionRef = useRef<HTMLDivElement>(null);
  const [sessionId, setSessionId] = useState(0);
  const sessionRef = useRef(0);
  useEffect(() => { sessionRef.current = sessionId; }, [sessionId]);
  
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
    // Proceed without client key; edge function stores Deepgram secret
    const apiKeyForCompat = (deepgramApiKey as string) || '';
    
    if (!audioBlob || audioBlob.size === 0) {
      console.error("No audio data to process");
      setStatus({ type: 'error', message: 'No audio recorded for diarization' });
      return;
    }
    
    console.log("Processing audio blob for diarization with Deepgram:", audioBlob.size, "bytes");
    setIsDiarizing(true);
    setStatus({ type: 'processing', message: 'Updating transcript...' });
    const startSession = sessionRef.current;
    
    try {
      // Process audio with Deepgram only (no correction)
      const { transcript: diarizedText, utterances, error } = await processCompleteAudio(audioBlob, apiKeyForCompat);
      console.log("Diarized text from Deepgram:", diarizedText?.length, "characters");
      
      // Update debug panel with Deepgram result
      if (diarizedText) {
        setDeepgramTranscript(diarizedText);
      }
      if (utterances && utterances.length > 0) {
        setDeepgramUtterances(utterances);
        // Process with medical IR pipeline
        await processWithMedicalPipeline(utterances);
      }
      
      if (sessionRef.current !== startSession) {
        console.log("Stale diarization result ignored");
        setIsDiarizing(false);
        return;
      }
      
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
        setStatus({ type: 'generating', message: 'Generating prescription...' });

        // Upload audio to storage after successful processing
        if (currentSessionRecord) {
          console.log("Uploading audio to storage for session:", currentSessionRecord.id);
          try {
            const uploadResult = await uploadSessionAudio(currentSessionRecord.id, audioBlob);
            if (uploadResult.success) {
              console.log("Audio uploaded successfully to storage");
              // Update current session record with the new data
              if (uploadResult.session) {
                setCurrentSessionRecord(uploadResult.session);
              }
            } else {
              console.error("Failed to upload audio:", uploadResult.error);
            }
          } catch (uploadError) {
            console.error("Error uploading audio:", uploadError);
          }
        }
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

  // New function to process with IR → SOAP → Prescription pipeline
  const processWithMedicalPipeline = async (utterances: Array<{
    speaker: string;
    ts_start: number;
    ts_end: number;
    text: string;
  }>) => {
    try {
      setStatus({ type: 'processing', message: 'Processing medical information...' });

      const { data, error } = await supabase.functions.invoke('process-medical-transcript', {
        body: {
          transcript: utterances,
          patientContext: {
            name: currentPatient?.name || patientInfo.name,
            age: currentPatient?.age,
            sex: currentPatient?.gender
          },
          clinicContext: {
            doctor_name: 'Dr. Kumar',
            clinic_name: 'Medical Clinic'
          },
          options: {
            redactMedicineNames: false,
            returnDebug: false
          }
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to process medical transcript');
      }

      const result = data as any;

      if (result?.error) {
        throw new Error(result.error);
      }

      setIr(result.ir);
      setSoap(result.soap);
      setPrescription(result.prescription);

      console.log('Medical processing complete:', {
        ir: result.ir,
        soap: result.soap,
        prescription: result.prescription,
      });
    } catch (error) {
      console.error('Error in medical pipeline:', error);
      setStatus({ type: 'error', message: 'Medical processing error: ' + String(error) });
    }
  };

  const handleTranscriptUpdate = (newTranscript: string) => {
    console.log("handleTranscriptUpdate called with:", newTranscript?.length);
    if (newTranscript !== undefined) {
      setTranscript(newTranscript);
      setLiveTranscript(newTranscript); // Update debug panel
    }
  };

  const handlePatientInfoUpdate = (newPatientInfo: { name: string; time: string }) => {
    setPatientInfo(newPatientInfo);
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
  
const handleRecordingStateChange = (recordingState: boolean) => {
  console.log("Recording state changed to:", recordingState);
  setIsRecording(recordingState);

  if (recordingState) {
    if (!hasRecordingStarted) setHasRecordingStarted(true);
    setDisplayMode('live');
    setProgressStep('recording');
    if (status.type !== 'recording') {
      setStatus({ type: 'recording', message: 'Recording in progress' });
    }
  } else if (hasRecordingStarted) {
    setDisplayMode('revised');
    setProgressStep('processing');
    setStatus(prev => {
      if (prev.type === 'generating' || prev.type === 'ready') return prev;
      return { type: 'processing', message: 'Updating transcript...' };
    });
  }
};

  return (
    <div className="min-h-screen bg-gradient-to-b from-doctor-light via-white to-doctor-light/20">
      <div className="container py-8 max-w-6xl">
        {hasRecordingStarted && <StatusBanner status={status} />}
        <DocHeader patientInfo={patientInfo} />
        
        <div className="grid gap-6 md:grid-cols-12">
          <div className="md:col-span-4 space-y-6">
            <VoiceRecorder 
              onTranscriptUpdate={handleTranscriptUpdate} 
              onPatientInfoUpdate={handlePatientInfoUpdate}
              onRecordingStateChange={handleRecordingStateChange}
              onRecordingStart={handleRecordingStart}
              onNewPatient={() => {
                setIsRecording(false);
                setHasRecordingStarted(false);
                setDisplayMode('live');
                setTranscript('');
                setClassifiedTranscript('');
                setDiarizedTranscription(null);
                setLiveTranscript('');
                setDeepgramTranscript('');
                setDeepgramUtterances([]);
                setIr(null);
                setSoap(null);
                setPrescription(null);
                setProgressStep('recording');
                setStatus({ type: 'idle' });
                setSessionId(id => id + 1);
                generateNewPatient();
              }}
            />
            
            <Card className="p-5 border rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-4">How to use DocScribe</h2>
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
    onGenerated={async (generatedPrescription?: string) => {
      setProgressStep('generated');
      setStatus({ type: 'ready', message: 'Prescription generated' });
      
      // Update consultation session with transcripts
      if (currentSessionRecord) {
        try {
          console.log("Saving prescription to database:", generatedPrescription);
          await updateConsultationSession(currentSessionRecord.id, {
            live_transcript: transcript,
            updated_transcript: classifiedTranscript,
            prescription: generatedPrescription || '',
            session_ended_at: new Date().toISOString()
          });
          console.log("Consultation session updated successfully");
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
        
        {/* Debug Panel */}
        <div className="mt-8">
          <DebugPanel
            liveTranscript={liveTranscript}
            deepgramTranscript={deepgramTranscript}
            deepgramUtterances={deepgramUtterances}
            ir={ir}
            soap={soap}
            prescription={prescription}
            isRecording={isRecording}
          />
        </div>
      </div>
      
    </div>
  );
};

export default DashboardPage;
