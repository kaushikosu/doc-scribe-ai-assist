
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

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
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
};

export { auth };
