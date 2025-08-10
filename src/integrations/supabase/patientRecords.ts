import { createPatient, findPatientByAbhaId, Patient } from "./patients";
import { createConsultationSession, ConsultationSession } from "./consultationSessions";

export type CreatePatientRecordInput = {
  patient_name?: string | null;
  patient_abha_id?: string | null;
  patient_age?: number | null;
  patient_gender?: string | null;
  patient_phone?: string | null;
  patient_address?: string | null;
  patient_emergency_contact?: string | null;
  patient_medical_history?: string | null;
  patient_blood_group?: string | null;
  patient_allergies?: string | null;
  prescription?: string;
  live_transcript?: string | null;
  updated_transcript?: string | null;
  audio_path?: string | null;
};

export type PatientRecordResult = {
  patient: Patient;
  session: ConsultationSession;
};

export async function createPatientRecord(input: CreatePatientRecordInput): Promise<PatientRecordResult> {
  let patient: Patient;

  // Check if patient already exists by ABHA ID
  if (input.patient_abha_id) {
    const existingPatient = await findPatientByAbhaId(input.patient_abha_id);
    if (existingPatient) {
      patient = existingPatient;
    } else {
      // Create new patient
      patient = await createPatient({
        name: input.patient_name || "Unknown Patient",
        abha_id: input.patient_abha_id,
        age: input.patient_age,
        gender: input.patient_gender,
        phone: input.patient_phone,
        address: input.patient_address,
        emergency_contact: input.patient_emergency_contact,
        medical_history: input.patient_medical_history,
        blood_group: input.patient_blood_group,
        allergies: input.patient_allergies,
      });
    }
  } else {
    // Create new patient without ABHA ID (for mock patients)
    patient = await createPatient({
      name: input.patient_name || "Unknown Patient",
      abha_id: input.patient_abha_id,
      age: input.patient_age,
      gender: input.patient_gender,
      phone: input.patient_phone,
      address: input.patient_address,
      emergency_contact: input.patient_emergency_contact,
      medical_history: input.patient_medical_history,
      blood_group: input.patient_blood_group,
      allergies: input.patient_allergies,
    });
  }

  // Create consultation session
  const session = await createConsultationSession({
    patient_id: patient.id,
    live_transcript: input.live_transcript,
    updated_transcript: input.updated_transcript,
    prescription: input.prescription || '',
    audio_path: input.audio_path,
  });

  return { patient, session };
}
