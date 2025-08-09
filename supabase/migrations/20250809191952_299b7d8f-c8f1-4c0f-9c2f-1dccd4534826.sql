-- Create update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Doctor profiles table
CREATE TABLE IF NOT EXISTS public.doctor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  gender TEXT,
  dob DATE,
  phone TEXT,
  email TEXT,
  qualifications TEXT,
  registration_council TEXT,
  registration_number TEXT,
  registration_year INT,
  speciality TEXT,
  facility_name TEXT,
  facility_id TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  district TEXT,
  state TEXT,
  pincode TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.doctor_profiles ENABLE ROW LEVEL SECURITY;

-- RLS: doctors can manage only their own profiles
DROP POLICY IF EXISTS "Doctors can select own profile" ON public.doctor_profiles;
CREATE POLICY "Doctors can select own profile"
ON public.doctor_profiles
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Doctors can insert own profile" ON public.doctor_profiles;
CREATE POLICY "Doctors can insert own profile"
ON public.doctor_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Doctors can update own profile" ON public.doctor_profiles;
CREATE POLICY "Doctors can update own profile"
ON public.doctor_profiles
FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_doctor_profiles_updated_at ON public.doctor_profiles;
CREATE TRIGGER update_doctor_profiles_updated_at
BEFORE UPDATE ON public.doctor_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Patient records table (one per recording/patient session)
CREATE TABLE IF NOT EXISTS public.patient_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_name TEXT,
  session_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_ended_at TIMESTAMPTZ,
  prescription TEXT,
  live_transcript TEXT,
  updated_transcript TEXT,
  audio_path TEXT, -- storage key path in recordings bucket: {doctorId}/{recordId}.webm
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_records ENABLE ROW LEVEL SECURITY;

-- RLS: doctors manage only their own patient records
DROP POLICY IF EXISTS "Doctors can select own patient records" ON public.patient_records;
CREATE POLICY "Doctors can select own patient records"
ON public.patient_records
FOR SELECT
USING (auth.uid() = doctor_id);

DROP POLICY IF EXISTS "Doctors can insert own patient records" ON public.patient_records;
CREATE POLICY "Doctors can insert own patient records"
ON public.patient_records
FOR INSERT
WITH CHECK (auth.uid() = doctor_id);

DROP POLICY IF EXISTS "Doctors can update own patient records" ON public.patient_records;
CREATE POLICY "Doctors can update own patient records"
ON public.patient_records
FOR UPDATE
USING (auth.uid() = doctor_id);

DROP POLICY IF EXISTS "Doctors can delete own patient records" ON public.patient_records;
CREATE POLICY "Doctors can delete own patient records"
ON public.patient_records
FOR DELETE
USING (auth.uid() = doctor_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_patient_records_updated_at ON public.patient_records;
CREATE TRIGGER update_patient_records_updated_at
BEFORE UPDATE ON public.patient_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for audio recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('recordings', 'recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for per-user access using folder prefix = auth.uid()
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can read own recordings'
  ) THEN
    CREATE POLICY "Users can read own recordings"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can insert own recordings'
  ) THEN
    CREATE POLICY "Users can insert own recordings"
    ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update own recordings'
  ) THEN
    CREATE POLICY "Users can update own recordings"
    ON storage.objects
    FOR UPDATE
    USING (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete own recordings'
  ) THEN
    CREATE POLICY "Users can delete own recordings"
    ON storage.objects
    FOR DELETE
    USING (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;