
// src/utils/speaker/patientDetection.ts
// Handles patient name detection functionality

// Interface for patient identification
import { PatientInfo } from './types';

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
