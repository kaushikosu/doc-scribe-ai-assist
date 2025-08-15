import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MedicalExtraction {
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    route: string;
    instructions: string;
  }>;
  symptoms: Array<{
    description: string;
    severity: string;
    duration: string;
    onset: string;
  }>;
  diagnoses: Array<{
    primary: boolean;
    condition: string;
    icd10: string;
    confidence: number;
  }>;
  investigations: Array<{
    test: string;
    urgency: string;
    reason: string;
    instructions: string;
  }>;
  instructions: Array<{
    type: string;
    description: string;
    category: string;
  }>;
  confidence: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript } = await req.json();
    
    if (!transcript) {
      throw new Error('Transcript is required');
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    const systemPrompt = `You are a medical AI assistant specialized in extracting structured information from doctor-patient consultation transcripts. 

Extract the following information and return it as valid JSON:

1. MEDICATIONS: Extract all prescribed medications with:
   - name: exact medication name
   - dosage: amount and unit (e.g., "500mg", "2 tablets")
   - frequency: how often (e.g., "twice daily", "BID", "as needed")
   - duration: how long to take (e.g., "7 days", "until finished")
   - route: how to take (e.g., "oral", "topical", "injection")
   - instructions: special instructions

2. SYMPTOMS: Extract all reported symptoms with:
   - description: what the patient reported
   - severity: mild, moderate, severe, or as described
   - duration: how long they've had it
   - onset: when it started

3. DIAGNOSES: Extract all diagnoses with:
   - primary: true for primary diagnosis, false for secondary
   - condition: the diagnosis or suspected condition
   - icd10: ICD-10 code if identifiable (or empty string)
   - confidence: 0-100 confidence level

4. INVESTIGATIONS: Extract all tests/investigations with:
   - test: name of test or investigation
   - urgency: routine, urgent, stat, or as described
   - reason: why the test is being ordered
   - instructions: any special instructions

5. INSTRUCTIONS: Extract all non-medication instructions with:
   - type: dietary, activity, follow-up, precaution, lifestyle
   - description: the actual instruction
   - category: general category

Provide an overall confidence score (0-100) for the entire extraction.

Return ONLY valid JSON in the exact format specified. Do not include any explanation or additional text.`;

    const userPrompt = `Extract medical details from this consultation transcript:

${transcript}`;

    console.log('Sending request to Claude for medical extraction...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANTHROPIC_API_KEY}`,
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `${systemPrompt}\n\n${userPrompt}`
          }
        ],
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Claude response:', data);

    if (!data.content || !data.content[0] || !data.content[0].text) {
      throw new Error('Invalid response from Claude API');
    }

    const extractedText = data.content[0].text;
    console.log('Extracted text:', extractedText);

    // Parse the JSON response from Claude
    let extractedData: MedicalExtraction;
    try {
      extractedData = JSON.parse(extractedText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error('Failed to parse Claude response as JSON');
    }

    // Validate the extracted data structure
    if (!extractedData.medications || !Array.isArray(extractedData.medications)) {
      extractedData.medications = [];
    }
    if (!extractedData.symptoms || !Array.isArray(extractedData.symptoms)) {
      extractedData.symptoms = [];
    }
    if (!extractedData.diagnoses || !Array.isArray(extractedData.diagnoses)) {
      extractedData.diagnoses = [];
    }
    if (!extractedData.investigations || !Array.isArray(extractedData.investigations)) {
      extractedData.investigations = [];
    }
    if (!extractedData.instructions || !Array.isArray(extractedData.instructions)) {
      extractedData.instructions = [];
    }
    if (typeof extractedData.confidence !== 'number') {
      extractedData.confidence = 75; // Default confidence
    }

    console.log('Successfully extracted medical details:', extractedData);

    return new Response(JSON.stringify(extractedData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in extract-medical-details function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      medications: [],
      symptoms: [],
      diagnoses: [],
      investigations: [],
      instructions: [],
      confidence: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});