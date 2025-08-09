import { supabase } from "./client";
import { toast } from "@/lib/toast";

export type CreatePatientRecordInput = {
  patient_name?: string | null;
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
