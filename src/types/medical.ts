export interface MedicalExtraction {
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    route: string;
    instructions: string;
  }>;
  symptoms: Array<{
    description: string;
    severity: string;
    duration: string;
    onset: string;
  }>;
  diagnoses: Array<{
    primary: boolean;
    condition: string;
    icd10: string;
    confidence: number;
  }>;
  investigations: Array<{
    test: string;
    urgency: string;
    reason: string;
    instructions: string;
  }>;
  instructions: Array<{
    type: string;
    description: string;
    category: string;
  }>;
  confidence: number;
}

export interface PrescriptionData {
  medicalExtraction?: MedicalExtraction;
  rawText: string;
  patientInfo: {
    name: string;
    time: string;
  };
}