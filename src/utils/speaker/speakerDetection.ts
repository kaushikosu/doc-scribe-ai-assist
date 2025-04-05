
// src/utils/speaker/speakerDetection.ts
// Core speaker detection functionality

import { ConversationContext, SpeakerRole, SpeakerFeatures } from './types';
import { doctorPatterns, patientPatterns } from './speakerPatterns';
import { detectLanguage } from './languageDetection';
import { detectPatientInfo } from './patientDetection';

// Linguistic complexity analysis
function analyzeSentenceComplexity(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // No valid sentences
  if (sentences.length === 0) return 0;
  
  // Calculate average words per sentence
  const wordsPerSentence = sentences.map(s => {
    const words = s.trim().split(/\s+/).filter(w => w.length > 0);
    return words.length;
  });
  
  // Complexity factors
  const avgLength = wordsPerSentence.reduce((sum, len) => sum + len, 0) / sentences.length;
  const subordinateClauseIndicators = (text.match(/\b(because|since|although|though|if|when|while|as|that)\b/gi) || []).length;
  const complexConstructs = (text.match(/\b(however|therefore|consequently|furthermore|nevertheless|moreover)\b/gi) || []).length;
  
  // Calculate complexity score (normalized between 0-10)
  const lengthScore = Math.min(avgLength / 20 * 5, 5); // 20+ word sentences get max score of 5
  const clauseScore = Math.min(subordinateClauseIndicators / sentences.length * 3, 3);
  const constructScore = Math.min(complexConstructs / sentences.length * 2, 2);
  
  return lengthScore + clauseScore + constructScore;
}

// Technical jargon detection (beyond basic medical terms)
function detectTechnicalJargon(text: string): number {
  const technicalTerms = [
    /\b(differential diagnosis|etiology|pathophysiology|contraindication|idiopathic|iatrogenic)\b/i,
    /\b(comorbidity|prodromal|sequelae|nosocomial|prophylaxis|palliative)\b/i,
    /\b(hemodynamic|histopathology|pharmacokinetics|pharmacodynamics)\b/i,
    /\b(anamnesis|auscultation|endogenous|exogenous|homeostasis)\b/i,
    /\b(oncotic|osmotic|perfusion|peristalsis|stenosis|thrombosis|ischemic)\b/i
  ];
  
  let termCount = 0;
  technicalTerms.forEach(term => {
    const matches = text.match(term) || [];
    termCount += matches.length;
  });
  
  // Normalize to a 0-10 scale
  return Math.min(termCount * 2, 10);
}

// Extract comprehensive features from text for ML-style classification
function extractSpeakerFeatures(text: string): SpeakerFeatures {
  const lowerText = text.toLowerCase();
  
  // Medical terminology usage
  const medicalTermMatches = doctorPatterns.medicalTerms.filter(pattern => pattern.test(text)).length;
  
  // Question density
  const questionMarks = (text.match(/\?/g) || []).length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length || 1;
  const questionDensity = questionMarks / sentences;
  
  // First-person pronoun usage
  const firstPersonPronouns = (text.match(/\b(i|i'm|i've|i'll|i'd|my|mine|me|myself)\b/gi) || []).length;
  const totalWords = text.split(/\s+/).length || 1;
  const firstPersonDensity = firstPersonPronouns / totalWords;
  
  // Directive language (instructions, orders, recommendations)
  const directivePatterns = [
    /\b(should|must|need to|have to|take|use|apply|avoid|increase|decrease|continue|stop)\b/gi,
    /\b(try|let|get|don't|do not|be sure to|make sure|remember to|follow|monitor)\b/gi
  ];
  
  let directiveCount = 0;
  directivePatterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    directiveCount += matches.length;
  });
  
  // Symptom description language
  const symptomPatterns = [
    /\b(feel|felt|feeling|pain|ache|hurt|hurting|discomfort|burning|itching|swelling)\b/gi,
    /\b(tired|fatigue|exhausted|dizzy|nauseous|sick|sore|stiff|weak|symptoms)\b/gi
  ];
  
  let symptomCount = 0;
  symptomPatterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    symptomCount += matches.length;
  });
  
  return {
    medicalTermsUsage: medicalTermMatches * 2, // Weighted importance
    sentenceComplexity: analyzeSentenceComplexity(text),
    questionDensity: questionDensity * 10, // Scale to 0-10
    firstPersonUsage: firstPersonDensity * 20, // Scale to 0-10
    directiveLanguage: Math.min(directiveCount * 2, 10),
    symptomDescription: Math.min(symptomCount * 2, 10),
    technicalJargon: detectTechnicalJargon(text)
  };
}

// Use extracted features to predict speaker with weighted scoring algorithm
function predictSpeakerFromFeatures(features: SpeakerFeatures, context: ConversationContext): number {
  // Positive score indicates doctor, negative indicates patient
  // Weights determined through analysis of medical conversations
  const weights = {
    medicalTermsUsage: 1.5,     // Strong indicator for doctor
    sentenceComplexity: 0.8,    // Doctors often use more complex sentences
    questionDensity: 0.6,       // Questions can come from either, but slightly more from doctors
    firstPersonUsage: -1.8,     // Strong indicator for patient
    directiveLanguage: 1.2,     // Doctors give directives/instructions 
    symptomDescription: -2.0,   // Very strong indicator for patient
    technicalJargon: 2.0        // Very strong indicator for doctor
  };
  
  // Calculate weighted score
  let score = 0;
  score += features.medicalTermsUsage * weights.medicalTermsUsage;
  score += features.sentenceComplexity * weights.sentenceComplexity;
  score += features.questionDensity * weights.questionDensity;
  score += features.firstPersonUsage * weights.firstPersonUsage;
  score += features.directiveLanguage * weights.directiveLanguage;
  score += features.symptomDescription * weights.symptomDescription;
  score += features.technicalJargon * weights.technicalJargon;
  
  // Apply conversation context adjustments
  if (context.lastSpeaker === 'Doctor') {
    // If doctor spoke last, slightly favor patient next
    score -= 2;
    
    // If doctor asked a question, strongly favor patient response
    if (context.doctorAskedQuestion) {
      score -= 4;
    }
  } else if (context.lastSpeaker === 'Patient') {
    // If patient spoke last, slightly favor doctor next
    score += 2;
    
    // If patient was describing symptoms, doctor likely responds
    if (context.isPatientDescribingSymptoms) {
      score += 4;
    }
  }
  
  // Balance score based on turn count to create more realistic dialogue patterns
  if (context.turnCount % 2 === 0) {
    score += 1; // Even turns slightly favor doctor
  } else {
    score -= 1; // Odd turns slightly favor patient
  }
  
  return score;
}

// Advanced speaker detection using ML-inspired feature extraction and context
export function detectSpeaker(
  text: string, 
  context: ConversationContext
): SpeakerRole {
  const lowerText = text.toLowerCase().trim();
  
  if (!text || text.trim().length === 0) {
    return context.lastSpeaker || 'Doctor';
  }
  
  // First interaction is likely doctor greeting
  if (context.isFirstInteraction) {
    // Check for doctor greetings at the very beginning
    if (/(hello|hi|good morning|namaste|welcome)/i.test(lowerText)) {
      return 'Doctor';
    }
  }
  
  // STRONG pattern-based indicators - these override most other patterns
  // Doctor strong indicators
  if (
    /^(i would like to|i('ll| will) prescribe|let me|i recommend)/i.test(lowerText) ||
    /^(based on|according to|looking at) (your|the|these)/i.test(lowerText) ||
    /^(take|use) (this|these|the|two|three|four|one)/i.test(lowerText) ||
    /^(we need to|you should|you need to|you must)/i.test(lowerText)
  ) {
    return 'Doctor';
  }
  
  // Patient strong indicators
  if (
    /^i('m| am) (not )?feeling/i.test(lowerText) ||
    /^i('ve| have) been/i.test(lowerText) ||
    /^(my|i('ve| have)|the) (pain|headache|problem|issue)/i.test(lowerText) ||
    /^(yes|no),? (doctor|i (have|had|am|do|don't|can't))/i.test(lowerText)
  ) {
    return 'Patient';
  }
  
  // Extract comprehensive features for ML-style classification
  const features = extractSpeakerFeatures(text);
  
  // Use features to predict speaker (positive score = doctor, negative = patient)
  const predictionScore = predictSpeakerFromFeatures(features, context);
  
  // Make final prediction based on score
  // Positive score indicates doctor, negative indicates patient
  return predictionScore > 0 ? 'Doctor' : 'Patient';
}

// Helper function to classify entire transcript
export function classifyTranscript(transcript: string): string {
  // Split transcript into paragraphs
  const paragraphs = transcript
    .split(/\n+/)
    .filter(p => p.trim().length > 0);
  
  if (paragraphs.length === 0) return '';
  
  // Initialize conversation context with extended fields
  let context: ConversationContext = {
    isPatientDescribingSymptoms: false,
    doctorAskedQuestion: false,
    patientResponded: false,
    isPrescribing: false,
    isGreeting: false,
    lastSpeaker: 'Doctor', // Starting assumption
    isFirstInteraction: true,
    turnCount: 0,
    // New context properties
    medicalTermsCount: 0,
    questionCount: 0,
    firstPersonPronounCount: 0,
    sentenceStructureComplexity: 0,
    interactionHistory: []
  };
  
  // Process each paragraph
  let classified = '';
  
  // First pass: identify speakers and build context
  paragraphs.forEach((paragraph, index) => {
    // Skip already classified paragraphs
    if (paragraph.match(/^\[(Doctor|Patient|Identifying)\]:/)) {
      classified += paragraph + '\n\n';
      
      // Update context based on existing classification
      const speakerMatch = paragraph.match(/^\[(Doctor|Patient|Identifying)\]:/);
      if (speakerMatch && speakerMatch[1]) {
        context.lastSpeaker = speakerMatch[1] as SpeakerRole;
        
        // Add to interaction history
        context.interactionHistory.push({
          speaker: speakerMatch[1] as SpeakerRole,
          text: paragraph.replace(/^\[[^\]]+\]:/, '').trim()
        });
      }
      
      return;
    }
    
    // Detect speaker for this paragraph
    const speaker = detectSpeaker(paragraph, context);
    
    // Add speaker label to the paragraph
    classified += `[${speaker}]: ${paragraph}\n\n`;
    
    // Add to interaction history for context
    context.interactionHistory.push({
      speaker: speaker,
      text: paragraph
    });
    
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
      
    // Update advanced context metrics
    const features = extractSpeakerFeatures(paragraph);
    context.medicalTermsCount += features.medicalTermsUsage / 2;
    context.questionCount += features.questionDensity / 10;
    context.firstPersonPronounCount += features.firstPersonUsage / 20;
    context.sentenceStructureComplexity = features.sentenceComplexity;
  });
  
  return classified.trim();
}

// Re-export functions from other files to maintain backward compatibility
export { detectLanguage } from './languageDetection';
export { detectPatientInfo } from './patientDetection';
export type { ConversationContext, PatientInfo, SpeakerRole } from './types';
