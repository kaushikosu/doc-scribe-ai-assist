
// src/utils/speaker/languageDetection.ts
// Handles language detection functionality

// Language detection utility
export function detectLanguage(text: string): string {
  // Simple language detection based on script characteristics
  // Hindi/Devanagari detection
  const devanagariPattern = /[\u0900-\u097F\u0981-\u09DC\u09DD-\u09DF]/;
  
  // Telugu detection
  const teluguPattern = /[\u0C00-\u0C7F]/;
  
  if (devanagariPattern.test(text)) {
    return 'hi-IN'; // Hindi
  } else if (teluguPattern.test(text)) {
    return 'te-IN'; // Telugu
  } else {
    return 'en-IN'; // Default to English
  }
}
