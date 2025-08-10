-- Add ABDM-compliant patient fields to patient_records table
ALTER TABLE public.patient_records 
ADD COLUMN IF NOT EXISTS patient_abha_id text,
ADD COLUMN IF NOT EXISTS patient_age integer,
ADD COLUMN IF NOT EXISTS patient_gender text,
ADD COLUMN IF NOT EXISTS patient_phone text,
ADD COLUMN IF NOT EXISTS patient_address text,
ADD COLUMN IF NOT EXISTS patient_emergency_contact text,
ADD COLUMN IF NOT EXISTS patient_medical_history text,
ADD COLUMN IF NOT EXISTS patient_blood_group text,
ADD COLUMN IF NOT EXISTS patient_allergies text;