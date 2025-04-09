
import { useState, useRef, useCallback } from 'react';
import { extractPatientName } from '@/utils/patientIdentification';
import { toast } from '@/lib/toast';

interface UsePatientIdentificationProps {
  onPatientIdentified: (patientInfo: { name: string; time: string }) => void;
}

export function usePatientIdentification({ onPatientIdentified }: UsePatientIdentificationProps) {
  const [showPatientIdentified, setShowPatientIdentified] = useState(false);
  const [isNewSession, setIsNewSession] = useState(true);
  
  const patientIdentifiedRef = useRef<boolean>(false);
  const patientNameScanAttempts = useRef<number>(0);

  const attemptPatientIdentification = useCallback((text: string) => {
    console.log("Checking for patient name in:", text);
    
    // Try to extract patient name
    patientNameScanAttempts.current += 1;
    const extractedName = extractPatientName(text);
    
    if (extractedName) {
      const currentTime = new Date().toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      const identifiedPatient = {
        name: extractedName,
        time: currentTime
      };
      
      console.log("Patient identified through extraction:", identifiedPatient);
      onPatientIdentified(identifiedPatient);
      setIsNewSession(false);
      patientIdentifiedRef.current = true;
      
      // Show success notification
      setShowPatientIdentified(true);
      setTimeout(() => {
        setShowPatientIdentified(false);
      }, 3000);
      
      toast.success(`Patient identified: ${extractedName}`);
      return true;
    }
    
    // After several attempts, try capitalized words
    if (patientNameScanAttempts.current > 3) {
      const capitalizedWords = text.match(/\b[A-Z][a-z]{2,}\b/g);
      if (capitalizedWords && capitalizedWords.length > 0) {
        const possibleName = capitalizedWords[0];
        const currentTime = new Date().toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        const suggestedPatient = {
          name: possibleName,
          time: currentTime
        };
        
        console.log("Suggested patient from capitalized words:", suggestedPatient);
        onPatientIdentified(suggestedPatient);
        setIsNewSession(false);
        patientIdentifiedRef.current = true;
        
        // Show notification
        setShowPatientIdentified(true);
        setTimeout(() => {
          setShowPatientIdentified(false);
        }, 3000);
        
        toast.success(`Patient identified: ${possibleName}`);
        return true;
      }
    }
    
    return false;
  }, [onPatientIdentified]);

  const resetPatientIdentification = useCallback(() => {
    setIsNewSession(true);
    patientIdentifiedRef.current = false;
    patientNameScanAttempts.current = 0;
    setShowPatientIdentified(false);
  }, []);

  return {
    showPatientIdentified,
    isNewSession,
    isPatientIdentified: patientIdentifiedRef.current,
    attemptPatientIdentification,
    resetPatientIdentification
  };
}
