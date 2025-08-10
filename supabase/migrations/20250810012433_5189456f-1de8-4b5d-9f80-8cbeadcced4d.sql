-- Create function to handle new user signup and create doctor profile
CREATE OR REPLACE FUNCTION public.handle_new_doctor_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Insert a new doctor profile for the newly created user
  INSERT INTO public.doctor_profiles (user_id, email, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- Create trigger to automatically create doctor profile on user signup
CREATE TRIGGER on_auth_user_created_doctor_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_doctor_signup();