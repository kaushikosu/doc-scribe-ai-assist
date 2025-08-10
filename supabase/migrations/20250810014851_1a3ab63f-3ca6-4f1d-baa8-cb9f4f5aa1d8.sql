-- Create patients table for patient demographics and medical information
CREATE TABLE public.patients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  abha_id TEXT UNIQUE,
  name TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  phone TEXT,
  address TEXT,
  emergency_contact TEXT,
  medical_history TEXT,
  blood_group TEXT,
  allergies TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create consultation_sessions table for session data
CREATE TABLE public.consultation_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL,
  session_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  session_ended_at TIMESTAMP WITH TIME ZONE,
  live_transcript TEXT,
  updated_transcript TEXT,
  prescription TEXT,
  audio_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for patients table
CREATE POLICY "Doctors can view all patients" 
ON public.patients 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Doctors can insert patients" 
ON public.patients 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Doctors can update patients" 
ON public.patients 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Create RLS policies for consultation_sessions table
CREATE POLICY "Doctors can view own consultation sessions" 
ON public.consultation_sessions 
FOR SELECT 
USING (auth.uid() = doctor_id);

CREATE POLICY "Doctors can insert own consultation sessions" 
ON public.consultation_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = doctor_id);

CREATE POLICY "Doctors can update own consultation sessions" 
ON public.consultation_sessions 
FOR UPDATE 
USING (auth.uid() = doctor_id);

CREATE POLICY "Doctors can delete own consultation sessions" 
ON public.consultation_sessions 
FOR DELETE 
USING (auth.uid() = doctor_id);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_patients_updated_at
BEFORE UPDATE ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_consultation_sessions_updated_at
BEFORE UPDATE ON public.consultation_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_patients_abha_id ON public.patients(abha_id);
CREATE INDEX idx_consultation_sessions_patient_id ON public.consultation_sessions(patient_id);
CREATE INDEX idx_consultation_sessions_doctor_id ON public.consultation_sessions(doctor_id);
CREATE INDEX idx_consultation_sessions_started_at ON public.consultation_sessions(session_started_at);