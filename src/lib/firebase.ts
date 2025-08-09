
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { toast } from "./toast";
import { supabase } from "@/integrations/supabase/client";

// Your web app's Firebase configuration
// Replace these with your actual Firebase config values
const firebaseConfig = {
  apiKey: "AIzaSyAqEuh9RAb_4GQBLCKIKNzplzLgzy1fYrg",
  authDomain: "hospital-firebase-project.firebaseapp.com",
  projectId: "hospital-firebase-project",
  storageBucket: "hospital-firebase-project.firebasestorage.app",
  messagingSenderId: "17639743079",
  appId: "1:17639743079:web:950eb09d612cc43c92bec2",
  measurementId: "G-8RSJ0NNE9K"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Function to handle Google sign-in
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // Link Firebase session to Supabase using the Google ID token
    try {
      const idToken = await result.user.getIdToken(true);
      const { error: supabaseError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      if (supabaseError) {
        console.error('Supabase sign-in with ID token failed:', supabaseError);
        toast.error('Signed in with Google, but failed to start Supabase session.');
      }
    } catch (linkError) {
      console.error('Error linking Firebase to Supabase:', linkError);
    }
    return result.user;
  } catch (error: any) {
    console.error("Error signing in with Google:", error);
    
    // Check for specific Firebase error codes
    if (error.code === 'auth/operation-not-allowed') {
      toast.error('Google authentication is not enabled in the Firebase console. Please enable Google authentication in the Firebase console under Authentication > Sign-in method.');
      
      // Log detailed instructions
      console.error(`
        To fix this error:
        1. Go to the Firebase console: https://console.firebase.google.com
        2. Select your project: "hospital-firebase-project"
        3. Go to Authentication > Sign-in method
        4. Enable Google as a sign-in provider
        5. Configure the OAuth consent screen if required
      `);
    } else {
      toast.error('Failed to sign in with Google. Please try again later.');
    }
    
    throw error;
  }
};

// Function to handle sign out
export const signOutUser = async () => {
  try {
    await signOut(auth);
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
  } catch (error) {
    console.error("Error signing out:", error);
    toast.error("Failed to sign out. Please try again.");
    throw error;
  }
};

export { auth };
