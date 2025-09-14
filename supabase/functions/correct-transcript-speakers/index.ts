import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript } = await req.json();

    if (!transcript) {
      throw new Error('No transcript provided');
    }

    // Accept transcript as string, array, or object (array of utterances)
    let transcriptText = '';
    if (typeof transcript === 'string') {
      transcriptText = transcript;
    } else if (Array.isArray(transcript)) {
      // Array of utterances: join as "Speaker: text" lines
      transcriptText = transcript.map(u => {
        if (typeof u === 'string') return u;
        if (u.speaker && u.transcript) return `${u.speaker}: ${u.transcript}`;
        if (u.speaker && u.text) return `${u.speaker}: ${u.text}`;
        return JSON.stringify(u);
      }).join('\n');
    } else if (typeof transcript === 'object') {
      // Object: try to join fields if possible
      if (transcript.speaker && transcript.transcript) {
        transcriptText = `${transcript.speaker}: ${transcript.transcript}`;
      } else if (transcript.speaker && transcript.text) {
        transcriptText = `${transcript.speaker}: ${transcript.text}`;
      } else {
        transcriptText = JSON.stringify(transcript);
      }
    }

    console.log('Processing transcript for speaker correction:', transcriptText.substring(0, 200) + '...');

    const prompt = `You are an expert medical conversation analyst. Your task is to correctly identify speakers in a medical consultation transcript and fix any incorrect speaker labels.

CONTEXT: This is a transcript from a medical consultation between a Doctor and a Patient. The transcript was processed by an AI diarization system that assigned speakers as "Speaker 0:", "Speaker 1:", etc., but some speaker assignments may be incorrect.

ANALYSIS GUIDELINES:
1. **Doctor Speech Patterns:**
   - Uses medical terminology and clinical language
   - Asks diagnostic questions ("How long have you been experiencing...", "On a scale of 1-10...", "Any family history of...")
   - Provides explanations and diagnoses
   - Gives instructions and prescriptions
   - Uses directive language ("I recommend...", "You should...", "Take this medication...")
   - Speaks with medical authority and expertise

2. **Patient Speech Patterns:**
   - Describes personal symptoms and experiences
   - Uses first-person language ("I feel...", "My pain...", "It started when...")
   - Asks questions about their condition or treatment
   - Responds to doctor's questions with personal information
   - Uses layman's terms to describe medical issues
   - Expresses concerns, fears, or confusion

3. **Conversation Flow Logic:**
   - Doctor typically opens with greetings and initial questions
   - Patient describes symptoms and concerns
   - Doctor asks follow-up diagnostic questions
   - Patient provides more details
   - Doctor explains diagnosis and treatment
   - Patient may ask clarifying questions

TASK: Analyze the transcript and:
1. Identify which original speaker (Speaker 0, Speaker 1, etc.) is the Doctor vs Patient
2. Replace ALL speaker labels with correct "Doctor:" or "Patient:" labels
3. Ensure conversation flow makes logical sense
4. Preserve the exact timing and content of speech

CONFIDENCE RULES:
- Only make corrections if you are highly confident (>85%)
- If unsure about any speaker assignment, keep original labels
- Look for clear patterns across multiple exchanges
- Consider the entire conversation context, not just individual statements

TRANSCRIPT TO ANALYZE:
${transcriptText}

OUTPUT FORMAT: Return a JSON object with:
{
  "correctedTranscript": "The corrected transcript with proper Doctor:/Patient: labels",
  "confidence": 0.95,
  "corrections": [
    {
      "original": "Speaker 0",
      "corrected": "Doctor",
      "reason": "Uses medical terminology and asks diagnostic questions"
    }
  ],
  "analysis": "Brief explanation of the correction reasoning"
}

If confidence is below 85%, return the original transcript unchanged with confidence score.`;

    // Azure OpenAI environment variables (Supabase Edge Functions/Deno)
    // Use globalThis.Deno.env.get if available, else undefined
  // Use (globalThis as any) to avoid TS index signature errors
  // @ts-ignore
  const getEnv = (key: string) => (typeof globalThis !== 'undefined' && (globalThis as any).Deno && (globalThis as any).Deno.env && typeof (globalThis as any).Deno.env.get === 'function') ? (globalThis as any).Deno.env.get(key) : undefined;
    const AZURE_OPENAI_ENDPOINT = getEnv('AZURE_OPENAI_ENDPOINT');
    const AZURE_OPENAI_API_KEY = getEnv('AZURE_OPENAI_API_KEY');
    const AZURE_OPENAI_DEPLOYMENT_NAME = getEnv('AZURE_OPENAI_DEPLOYMENT_NAME');
    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY || !AZURE_OPENAI_DEPLOYMENT_NAME) {
      throw new Error('Azure OpenAI environment variables are not configured');
    }

    const azureUrl = `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT_NAME}/chat/completions?api-version=2024-02-15-preview`;
    const response = await fetch(azureUrl, {
      method: 'POST',
      headers: {
        'api-key': AZURE_OPENAI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: "You are a helpful assistant." },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.1,
        stream: false
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Azure OpenAI API error:', errorText);
      throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
  console.log('Azure OpenAI response:', JSON.stringify(data, null, 2));

    // Azure OpenAI returns choices[0].message.content
    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error('Invalid response from Azure OpenAI API');
    }

  const content = data.choices[0].message.content;
  console.log('LLM response (full):', content);

    // Robustly extract JSON from LLM output
    let result;
    try {
      let jsonString = content;
      // Remove code block markers if present
      if (jsonString.startsWith('```json')) {
        jsonString = jsonString.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (jsonString.startsWith('```')) {
        jsonString = jsonString.replace(/^```/, '').replace(/```$/, '').trim();
      }
      // Find first and last curly braces
      const firstBrace = jsonString.indexOf('{');
      const lastBrace = jsonString.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1);
        result = JSON.parse(jsonString);
      } else {
        throw new Error('No valid JSON found in LLM response after stripping code block markers');
      }
    } catch (parseError) {
      console.error('Error parsing LLM response:', parseError, '\nFull LLM content:', content);
      // Fallback: return original transcript
      result = {
        correctedTranscript: transcriptText,
        confidence: 0.0,
        corrections: [],
        analysis: 'Could not parse LLM response, returning original transcript'
      };
    }

    // Validate result structure
    if (!result.correctedTranscript || typeof result.correctedTranscript !== 'string' || !result.correctedTranscript.trim()) {
      result.correctedTranscript = transcriptText;
    }
    if (typeof result.confidence !== 'number') {
      result.confidence = 0.0;
    }
    if (!Array.isArray(result.corrections)) {
      result.corrections = [];
    }

    // Convert correctedTranscript string to array of utterance objects
    function parseUtterances(transcriptStr: string): { speaker: string; text: string }[] {
      // Split on newlines, match "Speaker: text" or "Doctor: text" or "Patient: text"
      const lines: string[] = transcriptStr.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
      const utterances: { speaker: string; text: string }[] = [];
      for (const line of lines) {
        // Match "Doctor: ..." or "Patient: ..."
        const match = line.match(/^(Doctor|Patient):\s*(.*)$/i);
        if (match) {
          utterances.push({
            speaker: match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase(),
            text: match[2].trim()
          });
        } else {
          // If no speaker label, treat as unknown
          utterances.push({
            speaker: 'Unknown',
            text: line
          });
        }
      }
      return utterances;
    }

  const correctedUtterances = parseUtterances(result.correctedTranscript);
  console.log('Parsed utterances:', JSON.stringify(correctedUtterances, null, 2));
  console.log('Returning', correctedUtterances.length, 'utterances');

    // Return both the original result and the utterance array for compatibility
    // Add both 'correctedUtterances' and 'utterances' (alias) for downstream compatibility
    return new Response(JSON.stringify({
      ...result,
      correctedUtterances,
      utterances: correctedUtterances
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in correct-transcript-speakers function:', error);
    let errorMessage = 'Unknown error';
    if (typeof error === 'object' && error && 'message' in error && typeof (error as any).message === 'string') {
      errorMessage = (error as any).message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        correctedTranscript: '',
        confidence: 0.0,
        corrections: [],
        analysis: 'Error occurred during speaker correction'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});