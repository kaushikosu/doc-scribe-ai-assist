
/**
 * Utility functions for patient identification from transcript
 */

/**
 * Extracts a potential patient name from greeting text
 */
export const extractPatientName = (text: string): string | null => {
  // Common greeting patterns
  const patterns = [
    /(?:namaste|hello|hi|hey)\s+([A-Z][a-z]{2,})/i,
    /(?:patient|patient's) name is\s+([A-Z][a-z]{2,})/i,
    /(?:this is|i am|i'm)\s+([A-Z][a-z]{2,})/i,
    /Mr\.|Mrs\.|Ms\.|Dr\.\s+([A-Z][a-z]{2,})/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // Fallback: try to find any capitalized word after greeting
  const simpleMatch = text.match(/(?:namaste|hello|hi|hey)\s+(\w+)/i);
  if (simpleMatch && simpleMatch[1]) {
    return simpleMatch[1].charAt(0).toUpperCase() + simpleMatch[1].slice(1);
  }
  
  return null;
};
