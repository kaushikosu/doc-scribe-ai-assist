-- Fix critical security issue: Restrict patient access to only doctors who have consultation sessions with those patients

-- Drop the overly permissive policy that allows all doctors to view all patients
DROP POLICY IF EXISTS "Doctors can view all patients" ON public.patients;

-- Create a security definer function to check if a doctor has a relationship with a patient
CREATE OR REPLACE FUNCTION public.doctor_has_patient_relationship(patient_uuid uuid, doctor_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.consultation_sessions 
    WHERE patient_id = patient_uuid 
    AND doctor_id = doctor_uuid
  );
$$;

-- Create new restrictive RLS policy for patient SELECT operations
CREATE POLICY "Doctors can view only their patients" 
ON public.patients 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND public.doctor_has_patient_relationship(id, auth.uid())
);

-- Update the INSERT policy to be more specific
DROP POLICY IF EXISTS "Doctors can insert patients" ON public.patients;
CREATE POLICY "Authenticated doctors can insert patients" 
ON public.patients 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Update the UPDATE policy to only allow doctors to update their own patients
DROP POLICY IF EXISTS "Doctors can update patients" ON public.patients;
CREATE POLICY "Doctors can update only their patients" 
ON public.patients 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND public.doctor_has_patient_relationship(id, auth.uid())
);

-- Grant necessary permissions to the function
GRANT EXECUTE ON FUNCTION public.doctor_has_patient_relationship(uuid, uuid) TO authenticated;