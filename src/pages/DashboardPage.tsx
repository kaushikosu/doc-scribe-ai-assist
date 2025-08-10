import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import VoiceRecorder from '@/components/VoiceRecorder';
import TranscriptEditor from '@/components/TranscriptEditor';
import PrescriptionGenerator from '@/components/PrescriptionGenerator';
import PatientSessionBar from '@/components/PatientSessionBar';

import useAudioRecorder from '@/hooks/useAudioRecorder';
import { DiarizedTranscription } from '@/utils/diarizedTranscription';
import { processCompleteAudio, mapDeepgramSpeakersToRoles } from '@/utils/deepgramSpeechToText';
import { generateMockPatient, MockPatientData } from '@/utils/mockPatientData';
import { createPatient, Patient } from '@/integrations/supabase/patients';
import { createConsultationSession, ConsultationSession, updateConsultationSession } from '@/integrations/supabase/consultationSessions';

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
  const [isDiarizing, setIsDiarizing] = useState(false);
  const [diarizedTranscription, setDiarizedTranscription] = useState<DiarizedTranscription | null>(null);
  
  const mountedRef = useRef(true);
  const prescriptionRef = useRef<HTMLDivElement>(null);
  const [sessionId, setSessionId] = useState(0);
  const sessionRef = useRef(0);
  
  useEffect(() => { sessionRef.current = sessionId; }, [sessionId]);
  
  const deepgramApiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
  
  const {
    isRecording: isAudioRecording,
    startRecording: startAudioRecording,
    stopRecording: stopAudioRecording,
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
      return;
    }
    
    if (!audioBlob || audioBlob.size === 0) {
      console.error("No audio data to process");
      return;
    }
    
    console.log("Processing audio blob for diarization with Deepgram:", audioBlob.size, "bytes");
    setIsDiarizing(true);
    const startSession = sessionRef.current;
    
    try {
      const { transcript: diarizedText, error } = await processCompleteAudio(audioBlob, deepgramApiKey);
      console.log("Diarized text from Deepgram:", diarizedText?.length, "characters");
      
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
      } else if (!diarizedText || diarizedText.trim().length === 0) {
        console.warn("No speech detected by Deepgram");
        setDiarizedTranscription({
          transcript: "No speech detected by deepgram",
          error: "No speech detected"
        });
      } else {
        const result: DiarizedTranscription = {
          transcript: diarizedText,
          error: undefined
        };
        
        console.log("Deepgram diarization complete:", result);
        setDiarizedTranscription(result);

        const { classifiedTranscript: mapped } = mapDeepgramSpeakersToRoles(diarizedText, { 0: 'Doctor', 1: 'Patient' });
        setClassifiedTranscript(mapped);
        setTranscript(mapped);
        setDisplayMode('revised');
      }
      
      setIsDiarizing(false);
      
    } catch (error: any) {
      console.error("Error in Deepgram diarized transcription:", error);
      setIsDiarizing(false);
      setDiarizedTranscription({
        transcript: "Error in deepgram transcription",
        error: error.message || "Unknown error processing audio"
      });
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
    } else if (hasRecordingStarted) {
      setDisplayMode('revised');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-doctor-light via-white to-doctor-light/20">
      <PatientSessionBar 
        patient={currentPatientRecord} 
        sessionStartTime={patientInfo.time}
      />
      <div className="container py-8 max-w-6xl">
        
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
                  console.log('Prescription generation started');
                }}
                onGenerated={async () => {
                  console.log('Prescription generated');
                  
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

export default DashboardPage;