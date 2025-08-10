-- Create RLS policies for the recordings bucket
-- Doctors can upload their own consultation recordings
CREATE POLICY "Doctors can upload their own recordings" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'recordings' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Doctors can view their own recordings
CREATE POLICY "Doctors can view their own recordings" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'recordings' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Doctors can update their own recordings
CREATE POLICY "Doctors can update their own recordings" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'recordings' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Doctors can delete their own recordings
CREATE POLICY "Doctors can delete their own recordings" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'recordings' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);