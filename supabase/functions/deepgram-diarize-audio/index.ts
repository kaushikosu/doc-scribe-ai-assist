import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DiarizedUtterance {
  speaker: string; // "SPEAKER_0", "SPEAKER_1", etc.
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
    
    // Validate audio size - diarization needs sufficient audio
    if (audio.length < 50000) { // Less than ~50KB base64 is probably too short
      console.warn('Audio file may be too short for reliable diarization');
    }
    
    // Convert base64 to binary
    const binaryString = atob(audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Prepare raw audio buffer for Deepgram (send binary body, more reliable than multipart)
    const audioBuffer = bytes.buffer;
    
    // Configure Deepgram request with diarization
    // Note: Diarization requires longer audio samples (typically 10+ seconds)
    const urlParams: Record<string, string> = {
      model: 'nova-2',
      language: 'en',
      punctuate: 'true',
      diarize: 'true',
      smart_format: 'true',
      paragraphs: 'true',
      utterances: 'true'
    };
    
    // Only add encoding/sample_rate for raw audio formats
    if (!mimeType || (!mimeType.includes('webm') && !mimeType.includes('mp4'))) {
      urlParams.encoding = 'linear16';
      urlParams.sample_rate = '16000';
    }
    
    const deepgramUrl = 'https://api.deepgram.com/v1/listen?' + new URLSearchParams(urlParams);

    console.log('Sending request to Deepgram API...');
    
    // For WebM audio, use a generic audio content type that Deepgram handles better
    let contentType = mimeType || 'application/octet-stream';
    if (mimeType && mimeType.includes('webm')) {
      contentType = 'audio/webm'; // Simplified content type for better compatibility
      console.log('Adjusted WebM content type for Deepgram compatibility');
    }
    
    const response = await fetch(deepgramUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': contentType
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
    console.log('Full Deepgram response:', JSON.stringify(deepgramData, null, 2));

    // Extract utterances from Deepgram response - handle new format
    const utterances = deepgramData.results?.utterances || [];
    console.log('Utterances are: ', utterances);
    
    // Also check if we have basic transcript even if no diarization
    const basicTranscript = deepgramData.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    console.log('Basic transcript length:', basicTranscript.length);
    console.log('Basic transcript:', basicTranscript.substring(0, 200) + '...');
    
    // Log more details about the response structure
    console.log('Response structure check:');
    console.log('- Has results:', !!deepgramData.results);
    console.log('- Has channels:', !!deepgramData.results?.channels);
    console.log('- Has utterances:', !!deepgramData.results?.utterances);
    console.log('- Has paragraphs:', !!deepgramData.results?.channels?.[0]?.alternatives?.[0]?.paragraphs);
    console.log('- Confidence score:', deepgramData.results?.channels?.[0]?.alternatives?.[0]?.confidence);
    
    // Map utterances to expected format with generic speaker labels
    const processedUtterances = utterances.map((utterance: any) => ({
      speaker: `SPEAKER_${utterance.speaker || 0}`,
      ts_start: Math.round((utterance.start || 0) * 100) / 100,
      ts_end: Math.round((utterance.end || 0) * 100) / 100,
      text: utterance.transcript || '',
      asr_conf: Math.round((utterance.confidence || 0.8) * 100) / 100
    }));
    
    // Create formatted transcript for backward compatibility
    let formattedTranscript = '';
    
    if (processedUtterances.length > 0) {
      // Use diarized utterances with generic speaker numbers
      formattedTranscript = processedUtterances.map((u: any) => `Speaker ${u.speaker.split('_')[1]}: ${u.text}`).join('\n\n');
    } else {
      // Fallback: use basic transcript without creating fake utterances
      // Let the client-side handle non-diarized content appropriately
      const basicTranscript = deepgramData.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      if (basicTranscript && basicTranscript.trim()) {
        formattedTranscript = basicTranscript; // Return raw transcript without speaker labels
        console.log('Diarization failed, returning basic transcript without speaker assignment');
      } else {
        console.log('No transcript available from Deepgram');
      }
    }

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
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
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
        const speaker = `SPEAKER_${paragraph.speaker !== undefined ? paragraph.speaker : 0}`;
        
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
      utterances.push(createUtteranceFromDeepgramWords(currentWords, currentSpeaker || 0));
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
  
  const speaker = `SPEAKER_${speakerTag}`;
  
  return {
    speaker,
    ts_start: Math.round(ts_start * 100) / 100,
    ts_end: Math.round(ts_end * 100) / 100,
    text: text.trim(),
    asr_conf: Math.round(asr_conf * 100) / 100
  };
}