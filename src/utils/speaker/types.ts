
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
  // New context properties
  medicalTermsCount: number;
  questionCount: number;
  firstPersonPronounCount: number;
  sentenceStructureComplexity: number;
  interactionHistory: Array<{
    speaker: SpeakerRole;
    text: string;
  }>;
}

export interface PatientInfo {
  name: string;
  time: string;
}

// Define a union type for speaker roles
export type SpeakerRole = 'Doctor' | 'Patient' | 'Identifying';

// New types for advanced classification
export interface SpeakerFeatures {
  medicalTermsUsage: number;
  sentenceComplexity: number;
  questionDensity: number;
  firstPersonUsage: number;
  directiveLanguage: number;
  symptomDescription: number;
  technicalJargon: number;
}
