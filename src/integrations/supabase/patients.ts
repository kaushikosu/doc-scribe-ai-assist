import { supabase } from "./client";
import { toast } from "@/lib/toast";

export type CreatePatientInput = {
  name: string;
  abha_id?: string | null;
  age?: number | null;
  gender?: string | null;
  phone?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  medical_history?: string | null;
  blood_group?: string | null;
  allergies?: string | null;
};

export type Patient = {
  id: string;
  abha_id: string | null;
  name: string;
  age: number | null;
  gender: string | null;
  phone: string | null;
  address: string | null;
  emergency_contact: string | null;
  medical_history: string | null;
  blood_group: string | null;
  allergies: string | null;
  created_at: string;
  updated_at: string;
};

export async function createPatient(input: CreatePatientInput): Promise<Patient> {
  const { data, error } = await supabase
    .from("patients")
    .insert(input)
    .select()
    .single();

  if (error) {
    console.error("Failed to create patient:", error);
    toast.error("Failed to create patient");
    throw error;
  }

  toast.success("Patient created successfully");
  return data;
}

export async function findPatientByAbhaId(abhaId: string): Promise<Patient | null> {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("abha_id", abhaId)
    .maybeSingle();

  if (error) {
    console.error("Failed to find patient:", error);
    return null;
  }

  return data;
}

export async function updatePatient(id: string, updates: Partial<CreatePatientInput>): Promise<Patient> {
  const { data, error } = await supabase
    .from("patients")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to update patient:", error);
    toast.error("Failed to update patient");
    throw error;
  }

  return data;
}