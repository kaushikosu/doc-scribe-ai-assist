
import "https://deno.land/x/xhr@0.1.0/mod.ts";
// @ts-ignore: Deno Edge Functions import
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno namespace is available in Edge Functions

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

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript } = await req.json();
    
    if (!transcript) {
      throw new Error('Transcript is required');
    }

  // @ts-ignore: Deno namespace is available in Edge Functions
  const AZURE_OPENAI_ENDPOINT = (globalThis as any).Deno?.env.get('AZURE_OPENAI_ENDPOINT') ?? Deno.env.get('AZURE_OPENAI_ENDPOINT');
  // @ts-ignore
  const AZURE_OPENAI_API_KEY = (globalThis as any).Deno?.env.get('AZURE_OPENAI_API_KEY') ?? Deno.env.get('AZURE_OPENAI_API_KEY');
  // @ts-ignore
  const AZURE_OPENAI_DEPLOYMENT_NAME = (globalThis as any).Deno?.env.get('AZURE_OPENAI_DEPLOYMENT_NAME') ?? Deno.env.get('AZURE_OPENAI_DEPLOYMENT_NAME');
    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY || !AZURE_OPENAI_DEPLOYMENT_NAME) {
      throw new Error('Azure OpenAI environment variables are not configured');
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


    console.log('Sending request to Azure OpenAI for medical extraction...');

    const azureUrl = `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT_NAME}/chat/completions?api-version=2024-02-15-preview`;
    const response = await fetch(azureUrl, {
      method: 'POST',
      headers: {
        'api-key': AZURE_OPENAI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
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
    console.log('Azure OpenAI response:', data);

    // Azure OpenAI returns choices[0].message.content
    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error('Invalid response from Azure OpenAI API');
    }

    const extractedText = data.choices[0].message.content;
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
    let errorMessage = 'Unknown error';
    if (typeof error === 'object' && error && 'message' in error && typeof (error as any).message === 'string') {
      errorMessage = (error as any).message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    return new Response(JSON.stringify({ 
      error: errorMessage,
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