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
  turnCount: number;
}

// Advanced speaker detection using statistical patterns and context
export function detectSpeaker(
  text: string, 
  context: ConversationContext
): 'Doctor' | 'Patient' {
  const lowerText = text.toLowerCase().trim();
  
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
    patientScore += 2; // Increased from 1 to 2
    
    // If last utterance was a question, more likely patient is answering
    if (context.doctorAskedQuestion) {
      patientScore += 3; // Increased from 2 to 3
    }
  } else if (context.lastSpeaker === 'Patient') {
    // If patient spoke last, this is more likely a doctor response
    doctorScore += 2; // Increased from 1 to 2
    
    // If patient was describing symptoms, doctor likely asking follow-up
    if (context.isPatientDescribingSymptoms) {
      doctorScore += 3; // Increased from 2 to 3
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
    doctorScore += 5;  // Increased from 4 to 5
  }
  
  // Analyze text length and complexity
  if (text.length > 100) {
    // Longer explanations are more likely from doctor
    doctorScore += 2; // Increased from 1 to 2
  } else if (text.length < 15 && patientPatterns.responses.some(pattern => pattern.test(lowerText))) {
    // Very short response is likely patient
    patientScore += 2; // Increased from 1 to 2
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

// Enhanced patient name detection
export function detectPatientInfo(text: string): PatientInfo | null {
  // Normalize text: remove extra spaces and convert to lowercase for better matching
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  
  // Comprehensive greeting patterns for patient detection
  const greetingPatterns = [
    // Common doctor greetings that involve patient names
    /(?:hi|hello|hey|good morning|good afternoon|good evening|welcome)\s+(?:mr\.?|mrs\.?|ms\.?|miss|dr\.?)?\s*([A-Za-z]+)/i,
    
    // "Namaste" variations (common in Indian context)
    /(?:namaste|namaskar|नमस्ते|నమస్కారం)\s+(?:mr\.?|mrs\.?|ms\.?|miss|dr\.?)?\s*([A-Za-z]+)/i,
    
    // Direct patient references
    /(?:patient|patient's name|client|person)(?:'s| is| name is)?\s+(?:mr\.?|mrs\.?|ms\.?|miss|dr\.?)?\s*([A-Za-z]+)/i,
    
    // Introduction patterns
    /(?:this is|meet|let me introduce|introducing|i('m| am) seeing|i have)\s+(?:mr\.?|mrs\.?|ms\.?|miss|dr\.?)?\s*([A-Za-z]+)/i,
    
    // Arrival patterns
    /(?:mr\.?|mrs\.?|ms\.?|miss|dr\.?)?\s*([A-Za-z]+)\s+(?:is here|has arrived|is waiting|has come)/i,
    
    // Common Indian greetings with names
    /(?:शुभ प्रभात|शुभ दिन|शुभ सन्ध्या|శుభోదయం|శుభ దినం)\s+(?:mr\.?|mrs\.?|ms\.?|miss|dr\.?)?\s*([A-Za-z]+)/i,
    
    // Very direct references
    /(?:name is|called|my name is|i am)\s+([A-Za-z]+)/i,
    
    // Explicit patient identification
    /(?:for|with)\s+patient\s+(?:mr\.?|mrs\.?|ms\.?|miss|dr\.?)?\s*([A-Za-z]+)/i,
    
    // Check for "namaste" anywhere followed by a name
    /namaste.*?\s+([A-Za-z]+)/i,
    
    // Look for "doctor" + anything + name pattern (e.g., "Doctor, I'm John")
    /(?:doctor|doc|dr\.?)(?:[,\s].*?)?\s+([A-Za-z]+)(?:\s|$)/i,
    
    // General case for sentences that start with a name
    /^(?:mr\.?|mrs\.?|ms\.?|miss|dr\.?)?\s*([A-Za-z]{3,})\s+(?:is|has|wants|needs|came|suffering|here)/i,
  ];
  
  // First scan the whole text with each pattern
  for (const pattern of greetingPatterns) {
    const match = normalizedText.match(pattern);
    if (match && match[1]) {
      // Validate the name (must be at least 2 chars and not a common word)
      const possibleName = match[1];
      
      if (possibleName.length >= 2 && !isCommonWord(possibleName)) {
        // Format name properly (capitalize first letter)
        const patientName = possibleName.charAt(0).toUpperCase() + 
                           possibleName.slice(1).toLowerCase();
        
        const currentTime = new Date().toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        return { 
          name: patientName, 
          time: currentTime
        };
      }
    }
  }
  
  // Try to break the text into segments and analyze each
  const segments = normalizedText.split(/[.,!?;]|\[Doctor\]|\[Patient\]|\[Identifying\]/);
  
  for (const segment of segments) {
    if (segment.trim().length < 3) continue; // Skip very short segments
    
    for (const pattern of greetingPatterns) {
      const match = segment.match(pattern);
      if (match && match[1]) {
        const possibleName = match[1];
        
        if (possibleName.length >= 2 && !isCommonWord(possibleName)) {
          const patientName = possibleName.charAt(0).toUpperCase() + 
                             possibleName.slice(1).toLowerCase();
          
          const currentTime = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          
          return { 
            name: patientName, 
            time: currentTime
          };
        }
      }
    }
  }
  
  // Fallback strategy: look for capitalized words after greetings
  const capitalizedNameMatch = normalizedText.match(
    /(?:hello|hi|hey|namaste|namaskar|good morning|good afternoon)\s+([A-Z][a-z]{2,})/
  );
  
  if (capitalizedNameMatch && capitalizedNameMatch[1]) {
    const possibleName = capitalizedNameMatch[1];
    
    if (!isCommonWord(possibleName)) {
      const currentTime = new Date().toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      return { 
        name: possibleName, 
        time: currentTime
      };
    }
  }
  
  return null;
}

// Helper function to filter out common words that aren't names
function isCommonWord(word: string): boolean {
  const commonWords = [
    "the", "and", "for", "not", "but", "you", "all", "any", "can", "had", "has", 
    "have", "her", "his", "one", "our", "out", "she", "that", "this", "was", 
    "were", "who", "will", "with", "there", "they", "then", "than", "some",
    "yes", "no", "okay", "fine", "sure", "please", "thanks", "welcome", 
    "here", "today", "tomorrow", "doctor", "patient", "nurse", "sir", "madam"
  ];
  
  return commonWords.includes(word.toLowerCase());
}
