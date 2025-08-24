import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DiarizedUtterance {
  speaker: string; // "DOCTOR", "PATIENT", or "SPEAKER_X"
  ts_start: number; // Start time in seconds
  ts_end: number; // End time in seconds  
  text: string; // The utterance text
  asr_conf: number; // ASR confidence score (0.0 to 1.0)
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');
    
    if (!DEEPGRAM_API_KEY) {
      throw new Error('DEEPGRAM_API_KEY is not configured');
    }

    const { audio, mimeType } = await req.json();
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log(`Processing audio for diarization: ${Math.round(audio.length / 1024)} KB, type: ${mimeType}`);
    
    // Convert base64 to binary
    const binaryString = atob(audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Prepare raw audio buffer for Deepgram (send binary body, more reliable than multipart)
    const audioBuffer = bytes.buffer;
    
    // Configure Deepgram request with diarization
    const deepgramUrl = 'https://api.deepgram.com/v1/listen?' + new URLSearchParams({
      model: 'nova-2',
      language: 'en',
      punctuate: 'true',
      diarize: 'true',
      smart_format: 'true',
      paragraphs: 'true',
      utterances: 'true'
    });

    console.log('Sending request to Deepgram API...');
    
    const response = await fetch(deepgramUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': mimeType || 'application/octet-stream'
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deepgram API error:', errorText);
      throw new Error(`Deepgram API error: ${response.status} - ${errorText}`);
    }

    const deepgramData = await response.json();
    console.log('Deepgram response received, processing...');

    // Extract utterances from Deepgram response - handle new format
    const utterances = deepgramData.results?.utterances || [];
    console.log('Utterances are: ', utterances);
    
    // Map utterances to expected format with proper speaker mapping
    const processedUtterances = utterances.map((utterance: any) => ({
      speaker: utterance.speaker === 0 ? 'DOCTOR' : utterance.speaker === 1 ? 'PATIENT' : `SPEAKER_${utterance.speaker}`,
      ts_start: Math.round((utterance.start || 0) * 100) / 100,
      ts_end: Math.round((utterance.end || 0) * 100) / 100,
      text: utterance.transcript || '',
      asr_conf: Math.round((utterance.confidence || 0.8) * 100) / 100
    }));
    
    // Create formatted transcript for backward compatibility
    const formattedTranscript = processedUtterances.length > 0 
      ? processedUtterances.map(u => `Speaker ${u.speaker === 'DOCTOR' ? '0' : u.speaker === 'PATIENT' ? '1' : u.speaker.split('_')[1]}: ${u.text}`).join('\n\n')
      : deepgramData.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

    const result = {
      transcript: formattedTranscript,
      utterances: processedUtterances,
      rawTranscript: deepgramData.results?.channels?.[0]?.alternatives?.[0]?.transcript || '',
      results: deepgramData.results // Include full results for debugging
    };

    console.log(`Processed ${utterances.length} utterances from Deepgram response`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in deepgram-diarize-audio function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        transcript: '',
        utterances: []
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Extract structured utterances from Deepgram response
function extractUtterancesFromDeepgramResponse(data: any): DiarizedUtterance[] {
  try {
    console.log('Extracting utterances from Deepgram response');
    
    // Try to get paragraphs first (contains speaker timing info)
    const paragraphs = data?.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.paragraphs;
    if (paragraphs && Array.isArray(paragraphs)) {
      return paragraphs.map((paragraph: any) => {
        const speaker = paragraph.speaker !== undefined ? 
          (paragraph.speaker === 0 ? 'DOCTOR' : paragraph.speaker === 1 ? 'PATIENT' : `SPEAKER_${paragraph.speaker}`) :
          'SPEAKER_0';
        
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