import axios from 'axios';

import { DiarizedUtterance, DiarizedTranscriptResult } from "@/types/diarization";

export interface DeepgramResult {
  transcript: string;
  isFinal: boolean;
  resultIndex: number;
  speakerTag?: number;
  error?: string;
  topics?: string[];
}

// Helper function to format the transcript with speaker information
// Handles the nested structure from Deepgram API responses
function postProcessDeepgramResponse(data: any): string {
  try {
    console.log('Post-processing Deepgram response:', data);
    
    // Check if we have a valid data structure
    if (!data) {
      console.warn('No data provided to post-processor');
      return '';
    }
    
    // If the response already contains a formatted transcript, use it
    if (typeof data.transcript === 'string' && data.transcript.includes('Speaker')) {
      console.log('Using already formatted transcript');
      return data.transcript;
    }

    // Check for paragraphs which already has formatted transcript with speaker info
    if (data.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.transcript) {
      const paragraphsTranscript = data.results.channels[0].alternatives[0].paragraphs.transcript;
      console.log('Using paragraphs transcript:', paragraphsTranscript);
      return paragraphsTranscript.trim();
    }
    
    // Extract words from the nested structure
    let words;
    if (data.results?.channels?.[0]?.alternatives?.[0]?.words) {
      words = data.results.channels[0].alternatives[0].words;
      console.log(`Found ${words.length} words in Deepgram response structure`);
    } else if (data.rawTranscript?.words) {
      words = data.rawTranscript.words;
      console.log(`Found ${words.length} words in rawTranscript`);
    } else if (data.words) {
      words = data.words;
      console.log(`Found ${words.length} words directly in data object`);
    }
    
    // If we found words with speaker info, format the transcript
    if (words && Array.isArray(words) && words.length > 0) {
      let formatted = '';
      let currentSpeaker = -1;
      
      words.forEach((word) => {
        // Check if this word has speaker info
        if (word.speaker !== undefined && word.speaker !== null) {
          if (word.speaker !== currentSpeaker) {
            if (formatted) formatted += '\n\n';
            formatted += `Speaker ${word.speaker}: `;
            currentSpeaker = word.speaker;
          }
          formatted += `${word.punctuated_word || word.word || ''} `;
        } else {
          // No speaker info, just add the word
          formatted += `${word.punctuated_word || word.word || ''} `;
        }
      });
      
      return formatted.trim();
    }
    
    // Fallback to simple transcript if available
    if (data.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
      console.log('Falling back to simple transcript');
      return data.results.channels[0].alternatives[0].transcript;
    }
    
    // Last resort - get whatever transcript we can find
    return data.transcript || '';
  } catch (error) {
    console.error('Error in postProcessDeepgramResponse:', error);
    // Fall back to the plain transcript if available
    if (data?.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
      return data.results.channels[0].alternatives[0].transcript;
    }
    return data?.transcript || 'Error formatting transcript';
  }
}

// Process a complete audio file with Deepgram for improved diarization
export const processCompleteAudio = async (
  audioBlob: Blob,
  apiKey: string,  // We'll still accept this for backwards compatibility, but won't use it
): Promise<{transcript: string, utterances?: DiarizedUtterance[], error?: string}> => {
  try {
    console.log('Processing complete audio with Deepgram via backend server');
    
    // Convert blob to base64 for transmission
    const base64Audio = await blobToBase64(audioBlob);
    
    // Determine the correct mime type for the blob
    let mimeType = audioBlob.type;
    if (!mimeType || mimeType === 'audio/mp4') {
      mimeType = 'audio/mp4';
    } else if (mimeType.includes('webm')) {
      mimeType = 'audio/webm';
    } else {
      mimeType = 'audio/wav'; // fallback
    }
    
    console.log(`Sending audio to backend for processing: ${Math.round(base64Audio.length / 1024)} KB, type: ${mimeType}`);
    
    // Call the backend API we created
    const response = await axios.post('https://vtbpeozzyaqxjgmroeqs.supabase.co/functions/v1/deepgram-diarize-audio', {
      audio: base64Audio,
      mimeType: mimeType
    });
    
    console.log('Received response from backend:', response);

    // Post-process the response to format transcript with speaker information
    const processedTranscript = postProcessDeepgramResponse(response.data);
    
    // Extract structured utterances from Deepgram response
    const utterances = extractUtterancesFromDeepgramResponse(response.data);

    // Return the formatted transcript and utterances
    return {
      transcript: processedTranscript || response.data.transcript || '',
      utterances,
      error: response.data.error
    };
    
  } catch (error) {
    console.error('Error processing audio with Deepgram:', error);
    
    // Enhanced error handling
    let errorMessage = 'Unknown error';
    
    if (axios.isAxiosError(error)) {
      errorMessage = error.response?.data?.error || error.message;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return {
      transcript: '',
      error: `Error processing audio: ${errorMessage}`
    };
  }
};

// Helper to convert Blob to base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Extract the base64 data part (remove the data:audio/xxx;base64, prefix)
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Keep helper functions for backwards compatibility
export const getSpeakerLabel = (speakerTag?: number): string => {
  if (speakerTag === undefined) return '';
  return speakerTag === 1 ? 'Doctor' : 'Patient';
};

// Map Deepgram "Speaker X:" lines to [Doctor]/[Patient] labels
// Default mapping: Speaker 0 -> Doctor, Speaker 1 -> Patient
export const mapDeepgramSpeakersToRoles = (
  transcript: string,
  roleOfSpeaker: Record<number, 'Doctor' | 'Patient'> = { 0: 'Doctor', 1: 'Patient' }
): { classifiedTranscript: string; mapping: Record<number, 'Doctor' | 'Patient'> } => {
  if (!transcript) return { classifiedTranscript: '', mapping: roleOfSpeaker };

  const lines = transcript.split(/\n+/);
  const mappedLines = lines.map((line) => {
    const match = line.match(/^\s*Speaker\s+(\d+):\s*/);
    if (match) {
      const sp = parseInt(match[1], 10);
      const role = roleOfSpeaker[sp];
      const content = line.replace(/^\s*Speaker\s+\d+:\s*/, '');
      if (role) {
        return `[${role}]: ${content}`;
      }
      // If no mapping provided, keep original speaker label in bracketed form
      return `[Speaker ${sp}]: ${content}`;
    }
    return line;
  });

// Join paragraphs with single newline to align with other components
  const classifiedTranscript = mappedLines.join('\n\n').trim();
  return { classifiedTranscript, mapping: roleOfSpeaker };
};

// Speaker correction with AI
export interface SpeakerCorrectionResult {
  correctedTranscript: string;
  confidence: number;
  corrections: Array<{
    original: string;
    corrected: string;
    reason: string;
  }>;
  analysis: string;
}

export async function correctSpeakersWithAI(transcript: string): Promise<SpeakerCorrectionResult> {
  try {
    console.log('🤖 Starting AI speaker correction for transcript:', transcript.substring(0, 200) + '...');
    const { supabase } = await import('@/integrations/supabase/client');
    
    console.log('📡 Calling correct-transcript-speakers edge function...');
    const { data, error } = await supabase.functions.invoke('correct-transcript-speakers', {
      body: { transcript }
    });

    if (error) {
      console.error('❌ Error calling speaker correction function:', error);
      return {
        correctedTranscript: transcript,
        confidence: 0.0,
        corrections: [],
        analysis: 'Error occurred during AI correction'
      };
    }

    console.log('✅ Speaker correction successful, confidence:', data?.confidence);
    return data;
  } catch (error) {
    console.error('Error in correctSpeakersWithAI:', error);
    return {
      correctedTranscript: transcript,
      confidence: 0.0,
      corrections: [],
      analysis: 'Error occurred during AI correction'
    };
  }
}

// Enhanced processing with optional AI correction
export async function processCompleteAudioWithCorrection(
  audioBlob: Blob, 
  apiKey: string, 
  enableAICorrection: boolean = false
): Promise<{transcript: string, utterances?: DiarizedUtterance[], error?: string, correctionResult?: SpeakerCorrectionResult}> {
  try {
    // First get the standard Deepgram result
    const result = await processCompleteAudio(audioBlob, apiKey);
    
    if (result.error || !result.transcript) {
      return result;
    }

    // Apply AI correction if enabled and transcript has speaker labels
    if (enableAICorrection && result.transcript.includes('Speaker')) {
      console.log('🧠 AI correction enabled, found Speaker labels, applying correction...');
      const correctionResult = await correctSpeakersWithAI(result.transcript);
      
      // Only use corrected transcript if confidence is high enough
      if (correctionResult.confidence >= 0.85) {
        return {
          transcript: correctionResult.correctedTranscript,
          utterances: result.utterances,
          correctionResult
        };
      } else {
        console.log('AI correction confidence too low, keeping original:', correctionResult.confidence);
        return {
          ...result,
          correctionResult
        };
      }
    }

    return result;
  } catch (error) {
    console.error('Error in processCompleteAudioWithCorrection:', error);
    return {
      transcript: '',
      utterances: [],
      error: `Processing failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// Extract structured utterances from Deepgram response
export function extractUtterancesFromDeepgramResponse(data: any): DiarizedUtterance[] {
  try {
    console.log('Extracting utterances from Deepgram response');
    
    // Try to get paragraphs first (contains speaker timing info)
    const paragraphs = data?.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.paragraphs;
    if (paragraphs && Array.isArray(paragraphs)) {
      return paragraphs.map((paragraph: any, index: number) => {
        const speaker = paragraph.speaker !== undefined ? 
          (paragraph.speaker === 0 ? 'DOCTOR' : paragraph.speaker === 1 ? 'PATIENT' : `SPEAKER_${paragraph.speaker}`) :
          `SPEAKER_${index % 2}`;
        
        return {
          speaker,
          ts_start: Math.round((paragraph.start || 0) * 100) / 100,
          ts_end: Math.round((paragraph.end || 0) * 100) / 100,
          text: paragraph.text || '',
          asr_conf: Math.round((paragraph.confidence || 0.8) * 100) / 100
        };
      });
    }
    
    // Fallback: extract from words array
    const words = data?.results?.channels?.[0]?.alternatives?.[0]?.words;
    if (words && Array.isArray(words)) {
      return groupWordsIntoUtterances(words);
    }
    
    console.warn('No suitable data structure found for utterance extraction');
    return [];
  } catch (error) {
    console.error('Error extracting utterances:', error);
    return [];
  }
}

function groupWordsIntoUtterances(words: any[]): DiarizedUtterance[] {
  if (words.length === 0) return [];
  
  const utterances: DiarizedUtterance[] = [];
  let currentSpeaker: number | null = null;
  let currentWords: any[] = [];
  
  words.forEach((word, index) => {
    const wordSpeaker = word.speaker !== undefined ? word.speaker : 0;
    const speakerChanged = currentSpeaker !== null && wordSpeaker !== currentSpeaker;
    const longPause = index > 0 && ((word.start || 0) - (words[index-1].end || 0) > 1.0);
    
    if (speakerChanged || longPause) {
      if (currentWords.length > 0) {
        utterances.push(createUtteranceFromDeepgramWords(currentWords, currentSpeaker || 0));
        currentWords = [];
      }
    }
    
    currentSpeaker = wordSpeaker;
    currentWords.push(word);
    
    if (index === words.length - 1 && currentWords.length > 0) {
      utterances.push(createUtteranceFromDeepgramWords(currentWords, currentSpeaker));
    }
  });
  
  return utterances;
}

function createUtteranceFromDeepgramWords(words: any[], speakerTag: number): DiarizedUtterance {
  const text = words.map(w => w.punctuated_word || w.word || '').join(' ');
  const ts_start = Math.min(...words.map(w => w.start || 0));
  const ts_end = Math.max(...words.map(w => w.end || 0));
  const confidences = words.filter(w => w.confidence !== undefined).map(w => w.confidence);
  const asr_conf = confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0.8;
  
  const speaker = speakerTag === 0 ? 'DOCTOR' : speakerTag === 1 ? 'PATIENT' : `SPEAKER_${speakerTag}`;
  
  return {
    speaker,
    ts_start: Math.round(ts_start * 100) / 100,
    ts_end: Math.round(ts_end * 100) / 100,
    text: text.trim(),
    asr_conf: Math.round(asr_conf * 100) / 100
  };
}

// Export the utilities
export { postProcessDeepgramResponse };
