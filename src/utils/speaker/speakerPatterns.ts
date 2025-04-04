
// src/utils/speaker/speakerPatterns.ts
// Contains pattern matching rules for doctor and patient speech

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
