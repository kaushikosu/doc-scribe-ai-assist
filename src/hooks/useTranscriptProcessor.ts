
import { useState, useRef, useCallback, useEffect } from 'react';
import { classifyTranscript } from '@/utils/speaker';
import { toast } from '@/lib/toast';

interface UseTranscriptProcessorProps {
  onTranscriptClassified?: (classifiedTranscript: string) => void;
}

export function useTranscriptProcessor({ onTranscriptClassified }: UseTranscriptProcessorProps = {}) {
  const [isClassifying, setIsClassifying] = useState(false);
  const lastProcessedTranscriptRef = useRef('');
  const mountedRef = useRef(true);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);
  
  const handleTranscriptClassification = useCallback((transcript: string) => {
    if (!transcript || transcript.trim().length === 0 || transcript === lastProcessedTranscriptRef.current) {
      return;
    }
    
    setIsClassifying(true);
    
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }
    
    timeoutIdRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      
      try {
        const classified = classifyTranscript(transcript);
        lastProcessedTranscriptRef.current = transcript;
        
        if (mountedRef.current) {
          if (onTranscriptClassified) {
            onTranscriptClassified(classified);
          }
          setIsClassifying(false);
          console.log("Transcript classified successfully");
        }
      } catch (error) {
        console.error("Error classifying transcript:", error);
        if (mountedRef.current) {
          setIsClassifying(false);
          toast.error("Failed to classify transcript");
        }
      }
    }, 800);
  }, [onTranscriptClassified]);

  return {
    isClassifying,
    handleTranscriptClassification,
    lastProcessedTranscript: lastProcessedTranscriptRef.current
  };
}
