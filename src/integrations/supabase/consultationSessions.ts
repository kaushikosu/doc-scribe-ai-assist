import { supabase } from "./client";
import { toast } from "@/lib/toast";

export type CreateConsultationSessionInput = {
  patient_id: string;
  session_started_at?: string;
  session_ended_at?: string | null;
  live_transcript?: string | null;
  updated_transcript?: string | null;
  prescription?: string | null;
  audio_path?: string | null;
};

export type ConsultationSession = {
  id: string;
  patient_id: string;
  doctor_id: string;
  session_started_at: string;
  session_ended_at: string | null;
  live_transcript: string | null;
  updated_transcript: string | null;
  prescription: string | null;
  audio_path: string | null;
  created_at: string;
  updated_at: string;
};

export async function createConsultationSession(input: CreateConsultationSessionInput): Promise<ConsultationSession> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) {
    toast.error("You must be signed in to create consultation sessions.");
    throw userErr || new Error("No Supabase user session");
  }

  const payload = {
    ...input,
    doctor_id: userRes.user.id,
  };

  const { data, error } = await supabase
    .from("consultation_sessions")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("Failed to create consultation session:", error);
    toast.error("Failed to create consultation session");
    throw error;
  }

  toast.success("Consultation session created");
  return data;
}

export async function updateConsultationSession(id: string, updates: Partial<CreateConsultationSessionInput>): Promise<ConsultationSession> {
  const { data, error } = await supabase
    .from("consultation_sessions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to update consultation session:", error);
    toast.error("Failed to update consultation session");
    throw error;
  }

  return data;
}

export async function getConsultationSessionsByPatient(patientId: string): Promise<ConsultationSession[]> {
  const { data, error } = await supabase
    .from("consultation_sessions")
    .select("*")
    .eq("patient_id", patientId)
    .order("session_started_at", { ascending: false });

  if (error) {
    console.error("Failed to get consultation sessions:", error);
    throw error;
  }

  return data;
}

export async function endConsultationSession(id: string): Promise<ConsultationSession> {
  return updateConsultationSession(id, {
    session_ended_at: new Date().toISOString()
  });
}