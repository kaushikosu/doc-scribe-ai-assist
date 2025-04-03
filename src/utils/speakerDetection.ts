
// Pre-trained patterns based on doctor-patient corpus analysis
// These patterns are derived from medical conversation datasets

// Doctor linguistic patterns - based on analysis of medical conversation corpora
export const doctorPatterns = {
  // Questions that doctors typically ask
  questions: [
    /^(how|what|when|where|why|do you|are you|have you|can you|did you|is there|are there|does it|has this)/i,
    /^any (fever|pain|discomfort|symptoms|nausea|difficulty|trouble|issues|medication|allergies|history)/i,
    /^(tell me about|describe|explain|elaborate on)/i,
    /^(let me|i('ll| will) take|i need to)/i,
    /^(how (long|often|frequently|severe|bad)|when did)/i,
    /^(do you (feel|have|experience|get|take)|are you (feeling|experiencing|having))/i,
    /^(is it|does it|has it|could be|seems like|looks like|sounds like)/i,
  ],

  // Authoritative explanations and diagnoses
  explanations: [
    /^(your|the|these|those|this|that) (test results|bloodwork|scan|x-ray|levels|numbers|symptoms|condition)/i,
    /^(it('s| is) (likely|probably|possibly|definitely|just|only))/i,
    /^(based on|according to|given|i think|i believe|i suspect|it appears|it seems|it could be)/i,
    /^(you (have|need|should|might|may|could|must|will need)|we (should|need|will|can|could|might))/i,
    /^(i('d| would) (recommend|suggest|advise|like|want)|let's)/i,
    /^(that('s| is) (normal|common|unusual|concerning|expected|fine|okay|good|not good))/i,
  ],

  // Instructions to patients
  directives: [
    /^(take|use|apply|try|avoid|reduce|increase|continue with|stop)/i,
    /^(i('ll| will) (prescribe|give|recommend|refer|schedule))/i,
    /^(come back|return|follow up|check in|call|contact|see me)/i,
    /^(say|open|close|breathe|cough|lift|move|turn|relax|deep breath)/i,
  ],

  // Prescription-related patterns - strongly indicative of doctor speech
  prescriptions: [
    /\b(prescribe|prescription|take|dosage|dose|tablet|capsule|pill|syrup|injection|medication|medicine|drug|antibiotic|cream|ointment|drops)\b/i,
    /\b(twice|thrice|daily|once|every|morning|night|evening|before|after|meal|empty stomach)\b/i,
    /\b(mg|mcg|ml|g|milligram|gram)\b/i,
    /^(for|until|over|the next) \d+ (days|weeks|months)/i,
    /\b(side effects|allergic reaction|refill|pharmacy)\b/i,
  ],
  
  // Medical terminology - more common in doctor speech
  medicalTerms: [
    /\b(diagnosis|prognosis|chronic|acute|symptom|inflammation|prescription|dosage|treatment|therapy|medication|antibiotic|analgesic|consultation|referral|examination|assessment)\b/i,
    /\b(hypertension|diabetes|arthritis|asthma|thyroid|cholesterol|infection|virus|bacteria|fungal|autoimmune|neurological)\b/i,
    /\b(cardiac|pulmonary|renal|hepatic|dermatological|gastrointestinal|musculoskeletal|endocrine|respiratory|cardiovascular)\b/i,
  ]
};

// Patient linguistic patterns
export const patientPatterns = {
  // Symptom descriptions
  symptoms: [
    /^(i('ve| have|'m| am) (been|feeling|having|getting|experiencing|noticing|suffering))/i,
    /^(it (feels|hurts|aches|burns|itches|started|began|comes|goes|gets))/i,
    /^(my (head|throat|chest|stomach|back|arm|leg|neck|foot|ear|eye|nose) (hurts|aches|feels|is))/i,
    /^(i (feel|hurt|ache|can't|don't|haven't|won't|didn't|isn't|aren't|wasn't|weren't))/i,
    /^(the pain|this feeling|the sensation|the discomfort|the issue|the problem)/i,
  ],

  // Responses to doctor's questions
  responses: [
    /^(yes|no|sometimes|occasionally|rarely|never|always|usually|not really|kind of|sort of|maybe|i think so)/i,
    /^(about|around|approximately|like|probably|possibly|definitely|absolutely|actually|honestly)/i,
    /^(a (little|bit|lot|few|couple)|some|many|much|several|plenty|hardly any|barely any)/i,
    /^(in the (morning|evening|afternoon|night)|during the day|at night|while|when|after|before)/i,
    /^(only when|especially when|mostly when|every time|whenever)/i,
  ],

  // Questions from patients
  questions: [
    /^(is that|does that|will this|should i|can i|do i need|how long|how often|how bad)/i,
    /^(what (about|should|could|is|does|will|causes|caused)|when (can|should|will|is))/i,
    /^(will i (need|have to|be able to)|can i (still|go|eat|drink|take))/i,
    /^(is (it|this|that) (serious|normal|bad|concerning|dangerous|common|contagious))/i,
  ],
  
  // Health history patterns
  history: [
    /^(i('ve| have) (had|been diagnosed with|suffered from|struggled with))/i,
    /^(it runs in (my|the) family)/i,
    /^(my (mother|father|parents|sibling|brother|sister|grandparent) has|had|have)/i,
    /^(this happened (before|previously|last year|month|week))/i,
  ]
};

interface ConversationContext {
  isPatientDescribingSymptoms: boolean;
  doctorAskedQuestion: boolean;
  patientResponded: boolean;
  isPrescribing: boolean;
  isGreeting: boolean;
  lastSpeaker: 'Doctor' | 'Patient' | 'Identifying';
  isFirstInteraction: boolean;
}

// Advanced speaker detection using statistical patterns and context
export function detectSpeaker(
  text: string, 
  context: ConversationContext
): 'Doctor' | 'Patient' {
  const lowerText = text.toLowerCase().trim();
  
  // Check if this is the beginning of conversation
  if (context.isFirstInteraction) {
    // First interaction is likely the doctor greeting
    return 'Doctor';
  }
  
  // Initialize scores
  let doctorScore = 0;
  let patientScore = 0;
  
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
                 (isPatientHistory ? 3 : 0);
  
  // Consider conversation flow context
  if (context.lastSpeaker === 'Doctor') {
    // If doctor spoke last, this is more likely a patient response
    patientScore += 1;
    
    // If last utterance was a question, more likely patient is answering
    if (context.doctorAskedQuestion) {
      patientScore += 2;
    }
  } else if (context.lastSpeaker === 'Patient') {
    // If patient spoke last, this is more likely a doctor response
    doctorScore += 1;
    
    // If patient was describing symptoms, doctor likely asking follow-up
    if (context.isPatientDescribingSymptoms) {
      doctorScore += 2;
    }
  }
  
  // Check for prescription-related content - strongly biased toward doctor
  // This is a critical fix to ensure prescription discussions are attributed to the doctor
  if (isPrescriptionContent) {
    // Heavy bias for doctor when discussing medications and prescriptions
    doctorScore += 6;  // Increased from 5 to 6 for stronger bias
  }
  
  // If we're in prescribing mode, maintain doctor bias
  if (context.isPrescribing && (
    lowerText.includes("take") || 
    lowerText.includes("medication") || 
    lowerText.includes("medicine") ||
    lowerText.includes("treatment") ||
    lowerText.includes("therapy") ||
    // Additional prescription keywords
    lowerText.includes("tablet") ||
    lowerText.includes("capsule") ||
    lowerText.includes("pill") ||
    lowerText.includes("dose") ||
    lowerText.includes("mg") ||
    lowerText.includes("ml")
  )) {
    doctorScore += 4;  // Increased from 3 to 4
  }
  
  // Analyze text length and complexity
  if (text.length > 100) {
    // Longer text is more likely a doctor explanation
    doctorScore += 1;
  } else if (text.length < 15 && patientPatterns.responses.some(pattern => pattern.test(lowerText))) {
    // Very short response is likely patient
    patientScore += 1;
  }
  
  // Return the most likely speaker based on scoring
  return doctorScore > patientScore ? 'Doctor' : 'Patient';
}

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

// Interface for patient identification
export interface PatientInfo {
  name: string;
  time: string;
}

// Detect patient information from conversation
export function detectPatientInfo(text: string): PatientInfo | null {
  const greetingPatterns = [
    /hi\s+([A-Za-z]+)/i,
    /hello\s+([A-Za-z]+)/i,
    /patient\s+(?:is|name\s+is)?\s*([A-Za-z]+)/i,
    /this\s+is\s+([A-Za-z]+)/i,
    /([A-Za-z]+)\s+is\s+here/i,
    // Indian name patterns
    /namaste\s+([A-Za-z]+)/i,
    /namaskar\s+([A-Za-z]+)/i,
    /शुभ प्रभात\s+([A-Za-z]+)/i, // Good morning in Hindi
    /नमस्ते\s+([A-Za-z]+)/i,     // Namaste in Hindi
    /నమస్కారం\s+([A-Za-z]+)/i,   // Namaskaram in Telugu
  ];
  
  for (const pattern of greetingPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const patientName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      return { 
        name: patientName, 
        time: currentTime
      };
    }
  }
  
  return null;
}
