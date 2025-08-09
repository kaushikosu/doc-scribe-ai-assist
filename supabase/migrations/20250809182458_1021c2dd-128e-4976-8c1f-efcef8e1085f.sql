-- 1) Clear existing data from public.profiles and public.feedback
TRUNCATE TABLE public.feedback RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.profiles RESTART IDENTITY CASCADE;

-- 2) Create doctor_profiles table (ABDM-aligned doctor profile)
CREATE TABLE IF NOT EXISTS public.doctor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  gender TEXT,
  dob DATE,
  phone TEXT,
  email TEXT,
  qualifications TEXT,
  registration_council TEXT,
  registration_number TEXT,
  registration_year INTEGER,
  speciality TEXT,
  facility_name TEXT,
  facility_id TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  district TEXT,
  state TEXT,
  pincode TEXT,
  signature_url TEXT,
  stamp_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.doctor_profiles ENABLE ROW LEVEL SECURITY;

-- Policies: owner-only access
DROP POLICY IF EXISTS "Doctors can view their own profile" ON public.doctor_profiles;
CREATE POLICY "Doctors can view their own profile"
ON public.doctor_profiles
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Doctors can insert their own profile" ON public.doctor_profiles;
CREATE POLICY "Doctors can insert their own profile"
ON public.doctor_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Doctors can update their own profile" ON public.doctor_profiles;
CREATE POLICY "Doctors can update their own profile"
ON public.doctor_profiles
FOR UPDATE
USING (auth.uid() = user_id);

-- Timestamps trigger
DROP TRIGGER IF EXISTS update_doctor_profiles_updated_at ON public.doctor_profiles;
CREATE TRIGGER update_doctor_profiles_updated_at
BEFORE UPDATE ON public.doctor_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 3) Create patient_records table (captures doctor-patient sessions)
CREATE TABLE IF NOT EXISTS public.patient_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  patient_name TEXT,
  patient_identifier TEXT,
  patient_age INTEGER,
  patient_gender TEXT,
  visit_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  language TEXT,
  duration_seconds INTEGER,
  live_transcript TEXT,
  revised_transcript TEXT,
  prescription TEXT,
  audio_path TEXT, -- storage path in 'recordings' bucket (e.g., "<user_id>/session-xyz.webm")
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_patient_records_user_id_created_at ON public.patient_records (user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.patient_records ENABLE ROW LEVEL SECURITY;

-- Policies: owner-only CRUD
DROP POLICY IF EXISTS "Doctors can view their own patient records" ON public.patient_records;
CREATE POLICY "Doctors can view their own patient records"
ON public.patient_records
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Doctors can insert their own patient records" ON public.patient_records;
CREATE POLICY "Doctors can insert their own patient records"
ON public.patient_records
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Doctors can update their own patient records" ON public.patient_records;
CREATE POLICY "Doctors can update their own patient records"
ON public.patient_records
FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Doctors can delete their own patient records" ON public.patient_records;
CREATE POLICY "Doctors can delete their own patient records"
ON public.patient_records
FOR DELETE
USING (auth.uid() = user_id);

-- Timestamps trigger
DROP TRIGGER IF EXISTS update_patient_records_updated_at ON public.patient_records;
CREATE TRIGGER update_patient_records_updated_at
BEFORE UPDATE ON public.patient_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 4) Storage buckets for audio and doctor assets
INSERT INTO storage.buckets (id, name, public) VALUES ('recordings', 'recordings', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('doctor-assets', 'doctor-assets', false)
ON CONFLICT (id) DO NOTHING;

-- Clean up old policies if they exist to avoid name conflicts
DROP POLICY IF EXISTS "Users can read their own recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can manage their own recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own doctor assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can manage their own doctor assets" ON storage.objects;

-- Policies for recordings bucket
CREATE POLICY "Users can read their own recordings"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'recordings'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can manage their own recordings"
ON storage.objects FOR ALL USING (
  bucket_id = 'recordings'
  AND auth.uid()::text = (storage.foldername(name))[1]
) WITH CHECK (
  bucket_id = 'recordings'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policies for doctor-assets bucket
CREATE POLICY "Users can read their own doctor assets"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'doctor-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can manage their own doctor assets"
ON storage.objects FOR ALL USING (
  bucket_id = 'doctor-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
) WITH CHECK (
  bucket_id = 'doctor-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 5) Realtime support (optional but helpful for UI updates)
ALTER TABLE public.patient_records REPLICA IDENTITY FULL;
-- Add table to publication if not already there (no-op if exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'patient_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_records;
  END IF;
END $$;