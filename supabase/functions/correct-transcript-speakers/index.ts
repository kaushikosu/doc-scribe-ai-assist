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
${transcript}

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

    // @ts-ignore: Deno namespace is available in Edge Functions
    const ANTHROPIC_API_KEY = (globalThis as any).Deno?.env.get('ANTHROPIC_API_KEY') ?? Deno.env.get('ANTHROPIC_API_KEY');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANTHROPIC_API_KEY}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', errorText);
      throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const content = data.content[0].text;
    
    console.log('Claude response:', content.substring(0, 500) + '...');

    // Parse the JSON response from Claude
    let result;
    try {
      // Extract JSON from the response (Claude might include extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON found in Claude response');
      }
    } catch (parseError) {
      console.error('Error parsing Claude response:', parseError);
      // Fallback: return original transcript
      result = {
        correctedTranscript: transcript,
        confidence: 0.0,
        corrections: [],
        analysis: 'Could not parse AI response, returning original transcript'
      };
    }

    // Validate result structure
    if (!result.correctedTranscript) {
      result.correctedTranscript = transcript;
    }
    if (typeof result.confidence !== 'number') {
      result.confidence = 0.0;
    }
    if (!Array.isArray(result.corrections)) {
      result.corrections = [];
    }

    console.log('Final result confidence:', result.confidence);

    return new Response(JSON.stringify(result), {
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