import { supabase } from '@/integrations/supabase/client';
import { toast } from './toast';

// Use Supabase OAuth for Google sign-in (no Firebase)
export const signInWithGoogle = async () => {
  try {
    const redirectTo = `${window.location.origin}/app`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    });
    if (error) {
      console.error('Supabase OAuth error:', error);
      toast.error('Google sign-in failed.');
      throw error;
    }
    toast.success('Redirecting to Google…');
    // Supabase will handle the redirect automatically
  } catch (err) {
    console.error('Error starting Google sign-in:', err);
    toast.error('Failed to start Google sign-in.');
    throw err;
  }
};

export const signOutUser = async () => {
  try {
    await supabase.auth.signOut();
    toast.success('Signed out successfully');
  } catch (error) {
    console.error('Error signing out:', error);
    toast.error('Failed to sign out. Please try again.');
    throw error;
  }
};

