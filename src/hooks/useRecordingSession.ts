// src/hooks/useRecordingSession.ts
import { useState } from 'react';
import { generateMockPatient, MockPatientData } from '@/utils/mockPatientData';
import { createPatient, Patient } from '@/integrations/supabase/patients';
import { createConsultationSession, ConsultationSession } from '@/integrations/supabase/consultationSessions';

export function useRecordingSession() {
  const [patientInfo, setPatientInfo] = useState({
    name: '',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });
  const [currentPatient, setCurrentPatient] = useState<MockPatientData | null>(null);
  const [currentPatientRecord, setCurrentPatientRecord] = useState<Patient | null>(null);
  const [currentSessionRecord, setCurrentSessionRecord] = useState<ConsultationSession | null>(null);

  const handleTranscriptUpdate = (newTranscript: string, setTranscript: (t: string) => void, setLiveTranscript: (t: string) => void) => {
    setTranscript(newTranscript);
    setLiveTranscript(newTranscript);
  };

  const handlePatientInfoUpdate = (newPatientInfo: { name: string; time: string }) => {
    setPatientInfo(newPatientInfo);
  };

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
      // Handle error
    }
  };

  return {
    patientInfo,
    setPatientInfo,
    currentPatient,
    setCurrentPatient,
    currentPatientRecord,
    setCurrentPatientRecord,
    currentSessionRecord,
    setCurrentSessionRecord,
    handleTranscriptUpdate,
    handlePatientInfoUpdate,
    generateNewPatient
  };
}
