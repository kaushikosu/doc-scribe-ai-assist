
// src/utils/speaker/index.ts
// Main entry point for the speaker detection utilities

// Re-export everything needed from the speaker detection utils
export {
  detectSpeaker,
  classifyTranscript,
  detectLanguage,
  detectPatientInfo
} from './speakerDetection';

export type { 
  ConversationContext,
  PatientInfo 
} from './types';

export {
  doctorPatterns,
  patientPatterns
} from './speakerPatterns';
