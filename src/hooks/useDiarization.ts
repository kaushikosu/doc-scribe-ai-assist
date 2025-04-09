
import { useState, useRef, useCallback } from 'react';
import { getDiarizedTranscription, DiarizedTranscription } from '@/utils/diarizedTranscription';
import { toast } from '@/lib/toast';

export function useDiarization() {
  const [isDiarizing, setIsDiarizing] = useState(false);
  const [diarizedTranscription, setDiarizedTranscription] = useState<DiarizedTranscription | null>(null);
  const mountedRef = useRef(true);

  const processDiarizedTranscription = useCallback(async (audioBlob: Blob, googleApiKey: string) => {
    if (!googleApiKey) {
      console.error("Google Speech API key is missing");
      toast.error("Google Speech API key is not configured");
      return;
    }
    
    if (!audioBlob || audioBlob.size === 0) {
      console.error("No audio data to process");
      toast.error("No audio recorded for diarization");
      return;
    }
    
    console.log("Processing audio blob for diarization:", audioBlob.size, "bytes");
    setIsDiarizing(true);
    toast.info("Processing full audio for diarized transcription...");
    
    try {
      const result = await getDiarizedTranscription({
        apiKey: googleApiKey,
        audioBlob,
        speakerCount: 2
      });
      
      if (mountedRef.current) {
        console.log("Diarization complete:", result);
        setDiarizedTranscription(result);
        
        if (result.error) {
          toast.error("Diarization error: " + result.error);
        } else if (result.words.length === 0) {
          toast.warning("No speech detected in the audio");
        } else {
          toast.success(`Diarized transcription complete (${result.speakerCount} speakers detected)`);
        }
        
        setIsDiarizing(false);
      }
    } catch (error: any) {
      console.error("Error in diarized transcription:", error);
      if (mountedRef.current) {
        setIsDiarizing(false);
        setDiarizedTranscription({
          transcript: "",
          words: [],
          speakerCount: 0,
          error: error.message
        });
        toast.error("Failed to process diarized transcription");
      }
    }
  }, []);

  const resetDiarization = useCallback(() => {
    setDiarizedTranscription(null);
    setIsDiarizing(false);
  }, []);

  return {
    isDiarizing,
    diarizedTranscription,
    processDiarizedTranscription,
    resetDiarization
  };
}
