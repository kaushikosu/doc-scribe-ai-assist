
// src/utils/speaker/types.ts
// Contains shared types for speaker detection functionality

export interface ConversationContext {
  isPatientDescribingSymptoms: boolean;
  doctorAskedQuestion: boolean;
  patientResponded: boolean;
  isPrescribing: boolean;
  isGreeting: boolean;
  lastSpeaker: 'Doctor' | 'Patient' | 'Identifying';
  isFirstInteraction: boolean;
  turnCount: number;
}

export interface PatientInfo {
  name: string;
  time: string;
}
