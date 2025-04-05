
// src/utils/speaker/speakerDetection.ts
// Core speaker detection functionality

import { ConversationContext } from './types';
import { doctorPatterns, patientPatterns } from './speakerPatterns';
import { detectLanguage } from './languageDetection';
import { detectPatientInfo } from './patientDetection';

// Advanced speaker detection using statistical patterns and context
export function detectSpeaker(
  text: string, 
  context: ConversationContext
): 'Doctor' | 'Patient' {
  const lowerText = text.toLowerCase().trim();
  
  if (!text || text.trim().length === 0) {
    return context.lastSpeaker || 'Doctor';
  }
  
  // Initialize scores with bias based on conversation turn count
  // This helps create more realistic back-and-forth dialogue patterns
  let doctorScore = context.turnCount % 2 === 0 ? 1 : 0; // Even turns slightly favor doctor
  let patientScore = context.turnCount % 2 === 1 ? 1 : 0; // Odd turns slightly favor patient
  
  // First interaction is likely doctor greeting
  if (context.isFirstInteraction) {
    // Check for doctor greetings at the very beginning
    if (/(hello|hi|good morning|namaste|welcome)/i.test(lowerText)) {
      return 'Doctor';
    }
  }
  
  // STRONG patient indicators - these override most other patterns
  if (
    /^i('m| am) (not )?feeling/i.test(lowerText) ||
    /^i('ve| have) been/i.test(lowerText) ||
    /^(my|i('ve| have)|the) (pain|headache|problem|issue)/i.test(lowerText) ||
    /^(yes|no),? (doctor|i (have|had|am|do|don't|can't))/i.test(lowerText)
  ) {
    patientScore += 8; // Very strong patient indicators
  }
  
  // STRONG doctor indicators - these override most other patterns
  if (
    /^(i would like to|i('ll| will) prescribe|let me|i recommend)/i.test(lowerText) ||
    /^(based on|according to|looking at) (your|the|these)/i.test(lowerText) ||
    /^(take|use) (this|these|the|two|three|four|one)/i.test(lowerText) ||
    /^(we need to|you should|you need to|you must)/i.test(lowerText)
  ) {
    doctorScore += 8; // Very strong doctor indicators
  }
  
  // Check pattern matches for doctor speech
  const isDocQuestion = doctorPatterns.questions.some(pattern => pattern.test(lowerText));
  const isDocExplanation = doctorPatterns.explanations.some(pattern => pattern.test(lowerText));
  const isDocDirective = doctorPatterns.directives.some(pattern => pattern.test(lowerText));
  const isPrescriptionContent = doctorPatterns.prescriptions.some(pattern => pattern.test(lowerText));
  const hasMedicalTerms = doctorPatterns.medicalTerms.some(pattern => pattern.test(lowerText));
  
  // Check pattern matches for patient speech
  const isPatientSymptom = patientPatterns.symptoms.some(pattern => pattern.test(lowerText));
  const isPatientResponse = patientPatterns.responses.some(pattern => pattern.test(lowerText));
  const isPatientQuestion = patientPatterns.questions.some(pattern => pattern.test(lowerText));
  const isPatientHistory = patientPatterns.history.some(pattern => pattern.test(lowerText));
  
  // Add scores based on pattern matches
  doctorScore += (isDocQuestion ? 3 : 0) + 
                (isDocExplanation ? 4 : 0) + 
                (isDocDirective ? 4 : 0) +
                (hasMedicalTerms ? 2 : 0);
  
  patientScore += (isPatientSymptom ? 4 : 0) + 
                 (isPatientResponse ? 3 : 0) + 
                 (isPatientQuestion ? 3 : 0) +
                 (isPatientHistory ? 4 : 0);
  
  // Consider conversation flow context
  if (context.lastSpeaker === 'Doctor') {
    // If doctor spoke last, this is more likely a patient response
    patientScore += 2;
    
    // If last utterance was a question, more likely patient is answering
    if (context.doctorAskedQuestion) {
      patientScore += 3;
    }
  } else if (context.lastSpeaker === 'Patient') {
    // If patient spoke last, this is more likely a doctor response
    doctorScore += 2;
    
    // If patient was describing symptoms, doctor likely asking follow-up
    if (context.isPatientDescribingSymptoms) {
      doctorScore += 3;
    }
  }
  
  // Check for first-person pronouns - strong indicator for speaker
  const firstPersonCount = (text.match(/\b(i|i'm|i've|i'll|i'd|my|mine|me|myself)\b/gi) || []).length;
  if (firstPersonCount > 0) {
    // More first-person references likely means patient speaking about themselves
    patientScore += Math.min(firstPersonCount, 4);
  }
  
  // Check for second-person - more typical of doctor speaking to patient
  const secondPersonCount = (text.match(/\b(you|your|yours|yourself)\b/gi) || []).length;
  if (secondPersonCount > 0) {
    doctorScore += Math.min(secondPersonCount, 3);
  }
  
  // Check for prescription-related content - strongly biased toward doctor
  if (isPrescriptionContent) {
    doctorScore += 6;  
  }
  
  // If we're in prescribing mode, maintain doctor bias
  if (context.isPrescribing && (
    lowerText.includes("take") || 
    lowerText.includes("medication") || 
    lowerText.includes("medicine") ||
    lowerText.includes("treatment") ||
    lowerText.includes("therapy") ||
    lowerText.includes("tablet") ||
    lowerText.includes("capsule") ||
    lowerText.includes("pill") ||
    lowerText.includes("dose") ||
    lowerText.includes("mg") ||
    lowerText.includes("ml")
  )) {
    doctorScore += 5;
  }
  
  // Analyze text length and complexity
  if (text.length > 100) {
    // Longer explanations are more likely from doctor
    doctorScore += 2;
  } else if (text.length < 15 && patientPatterns.responses.some(pattern => pattern.test(lowerText))) {
    // Very short response is likely patient
    patientScore += 2;
  }
  
  // Special case: If text contains both "I" and medical terms, could be a doctor 
  // sharing personal experience or explaining a concept
  if (firstPersonCount > 0 && hasMedicalTerms) {
    // If contains "as a doctor" or similar phrases, boost doctor score
    if (/(as (a|your) doctor|in my experience|in my practice|in my medical opinion)/i.test(text)) {
      doctorScore += 5;
    }
  }
  
  // Return the most likely speaker based on scoring
  return doctorScore > patientScore ? 'Doctor' : 'Patient';
}

// Helper function to classify entire transcript
export function classifyTranscript(transcript: string): string {
  // Split transcript into paragraphs
  const paragraphs = transcript
    .split(/\n+/)
    .filter(p => p.trim().length > 0);
  
  if (paragraphs.length === 0) return '';
  
  // Initialize conversation context
  let context: ConversationContext = {
    isPatientDescribingSymptoms: false,
    doctorAskedQuestion: false,
    patientResponded: false,
    isPrescribing: false,
    isGreeting: false,
    lastSpeaker: 'Doctor', // Starting assumption
    isFirstInteraction: true,
    turnCount: 0
  };
  
  // Process each paragraph
  let classified = '';
  
  paragraphs.forEach((paragraph, index) => {
    // Skip already classified paragraphs
    if (paragraph.match(/^\[(Doctor|Patient|Identifying)\]:/)) {
      classified += paragraph + '\n\n';
      
      // Update context based on existing classification
      const speakerMatch = paragraph.match(/^\[(Doctor|Patient|Identifying)\]:/);
      if (speakerMatch && speakerMatch[1]) {
        context.lastSpeaker = speakerMatch[1] as 'Doctor' | 'Patient';
      }
      
      return;
    }
    
    // Detect speaker for this paragraph
    const speaker = detectSpeaker(paragraph, context);
    
    // Add speaker label to the paragraph
    classified += `[${speaker}]: ${paragraph}\n\n`;
    
    // Update context for next iteration
    context.lastSpeaker = speaker;
    context.isFirstInteraction = false;
    context.turnCount++;
    
    // Update other context flags based on content
    context.doctorAskedQuestion = paragraph.includes('?') && speaker === 'Doctor';
    context.isPatientDescribingSymptoms = 
      speaker === 'Patient' && 
      (/pain|hurt|feel|symptom|problem|issue/i.test(paragraph));
    context.isPrescribing = 
      speaker === 'Doctor' && 
      (/prescribe|take|medicine|medication|treatment|therapy|dose/i.test(paragraph));
  });
  
  return classified.trim();
}

// Re-export functions from other files to maintain backward compatibility
export { detectLanguage } from './languageDetection';
export { detectPatientInfo } from './patientDetection';
export type { ConversationContext, PatientInfo } from './types';
