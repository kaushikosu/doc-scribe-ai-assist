import { supabase } from "./client";
import { toast } from "@/lib/toast";

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
  prescription: string;
  live_transcript?: string | null;
  updated_transcript?: string | null;
  audio_path?: string | null;
};

export async function createPatientRecord(input: CreatePatientRecordInput) {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) {
    toast.error("You must be signed in to save records.");
    throw userErr || new Error("No Supabase user session");
  }

  const payload = {
    doctor_id: userRes.user.id,
    patient_name: input.patient_name ?? null,
    patient_abha_id: input.patient_abha_id ?? null,
    patient_age: input.patient_age ?? null,
    patient_gender: input.patient_gender ?? null,
    patient_phone: input.patient_phone ?? null,
    patient_address: input.patient_address ?? null,
    patient_emergency_contact: input.patient_emergency_contact ?? null,
    patient_medical_history: input.patient_medical_history ?? null,
    patient_blood_group: input.patient_blood_group ?? null,
    patient_allergies: input.patient_allergies ?? null,
    prescription: input.prescription,
    live_transcript: input.live_transcript ?? null,
    updated_transcript: input.updated_transcript ?? null,
    audio_path: input.audio_path ?? null,
  };

  const { data, error } = await supabase
    .from("patient_records")
    .insert(payload)
    .select()
    .maybeSingle();

  if (error) {
    console.error("Failed to create patient record:", error);
    toast.error("Failed to save patient record");
    throw error;
  }

  toast.success("Patient record saved");
  return data;
}
