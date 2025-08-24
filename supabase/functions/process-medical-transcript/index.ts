import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types
interface DiarizedUtterance {
  speaker: string;
  ts_start: number;
  ts_end: number;
  text: string;
  asr_conf: number;
}

interface ProcessRequest {
  transcript: DiarizedUtterance[];
  patientContext?: {
    name?: string;
    age?: number;
    sex?: string;
  };
  clinicContext?: {
    clinic_name?: string;
    doctor_name?: string;
  };
  options?: {
    redactMedicineNames?: boolean;
    returnDebug?: boolean;
  };
}

interface ProcessResponse {
  ir: any;
  soap: any;
  prescription: any;
  warnings: string[];
  debug?: any;
}

// Schemas for validation
const IR_SCHEMA = {
  type: 'object',
  properties: {
    chief_complaint: { type: 'string' },
    history_present_illness: { type: 'string' },
    past_medical_history: { type: 'string' },
    medications: { type: 'array', items: { type: 'string' } },
    allergies: { type: 'string' },
    social_history: { type: 'string' },
    family_history: { type: 'string' },
    review_of_systems: { type: 'string' },
    physical_exam: { type: 'string' },
    vitals: {
      type: 'object',
      properties: {
        blood_pressure: { type: 'string' },
        heart_rate: { type: 'string' },
        temperature: { type: 'string' },
        respiratory_rate: { type: 'string' }
      }
    },
    assessment: { type: 'string' },
    plan: { type: 'string' },
    languages_detected: { type: 'array', items: { type: 'string' } }
  },
  required: ['chief_complaint', 'assessment', 'plan']
} as const;

const SOAP_SCHEMA = {
  type: 'object',
  properties: {
    subjective: { type: 'string' },
    objective: { type: 'string' },
    assessment: { type: 'string' },
    plan: { type: 'string' }
  },
  required: ['subjective', 'objective', 'assessment', 'plan']
} as const;

const RX_SCHEMA = {
  type: 'object',
  properties: {
    resourceType: { type: 'string', enum: ['Bundle'] },
    type: { type: 'string', enum: ['collection'] },
    entry: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          resource: {
            type: 'object',
            properties: {
              resourceType: { type: 'string', enum: ['MedicationRequest'] },
              status: { type: 'string' },
              intent: { type: 'string' },
              medicationCodeableConcept: {
                type: 'object',
                properties: {
                  text: { type: 'string' }
                }
              },
              dosageInstruction: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    text: { type: 'string' },
                    route: {
                      type: 'object',
                      properties: {
                        text: { type: 'string' }
                      }
                    },
                    doseAndRate: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          doseQuantity: {
                            type: 'object',
                            properties: {
                              value: { type: 'number' },
                              unit: { type: 'string' }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            required: ['resourceType', 'status', 'intent', 'medicationCodeableConcept', 'dosageInstruction']
          }
        },
        required: ['resource']
      }
    }
  },
  required: ['resourceType', 'type', 'entry']
} as const;

async function callLLMJSON(prompt: string, schema: any): Promise<any> {
  const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY');
  const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT');
  const AZURE_OPENAI_DEPLOYMENT_NAME = Deno.env.get('AZURE_OPENAI_DEPLOYMENT_NAME');
  
  if (!AZURE_OPENAI_API_KEY || !AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_DEPLOYMENT_NAME) {
    console.error('Azure OpenAI credentials missing in environment');
    throw new Error('Azure OpenAI credentials are not configured. Need AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, and AZURE_OPENAI_DEPLOYMENT_NAME');
  }

  // Minimal, non-sensitive logging to help diagnose auth issues
  try {
    console.log('Calling Azure OpenAI API with endpoint:', AZURE_OPENAI_ENDPOINT, 'deployment:', AZURE_OPENAI_DEPLOYMENT_NAME);
  } catch (_) {
    // ignore logging errors
  }

  const apiUrl = `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT_NAME}/chat/completions?api-version=2024-08-01-preview`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': AZURE_OPENAI_API_KEY
    },
    body: JSON.stringify({
      max_completion_tokens: 4000,
      messages: [
        {
          role: 'system',
          content: 'You are a medical AI assistant. Always respond with valid JSON that matches the provided schema exactly.'
        },
        {
          role: 'user',
          content: `${prompt}\n\nPlease respond with valid JSON that matches this schema: ${JSON.stringify(schema)}`
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Provide clearer hint on common 401 cause
    if (response.status === 401) {
      throw new Error(`Azure OpenAI API error (401). Check AZURE_OPENAI_API_KEY secret value. Raw: ${errorText}`);
    }
    throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('No content in Azure OpenAI response');
  }

  try {
    // Strip markdown code block formatting if present
    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    return JSON.parse(cleanContent);
  } catch (e) {
    console.error('Failed to parse JSON:', content);
    throw new Error('Invalid JSON response from LLM');
  }
}

function normalizeTranscript(transcript: DiarizedUtterance[]): string {
  return transcript.map(utterance => 
    `${utterance.speaker} (${utterance.ts_start}s-${utterance.ts_end}s): ${utterance.text}`
  ).join('\n\n');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST method' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json() as ProcessRequest;
    
    if (!body?.transcript?.length) {
      return new Response(JSON.stringify({ error: 'Missing transcript array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const options = { 
      redact: body.options?.redactMedicineNames !== false, 
      debug: !!body.options?.returnDebug 
    };
    
    const convo = normalizeTranscript(body.transcript);

    console.log('Processing medical transcript with', body.transcript.length, 'utterances');

    // 1) Create Intermediate Representation (IR)
    const irPrompt = `You will create an Intermediate Representation (IR) from the diarized conversation below.

Constraints:
- India context.
- If uncertain about vitals/exam, leave them out.
- Summaries must be concise.
- Use generic names if you mention any medication.
- Detect languages used (en, hi, te, etc.).

Patient Context (optional): ${JSON.stringify(body.patientContext || {}, null, 2)}

Conversation:
${convo}`;

    const ir = await callLLMJSON(irPrompt, IR_SCHEMA);
    console.log('Generated IR');

    // 2) Create SOAP note from IR
    const soapPrompt = `Create a tight SOAP note from the following IR. Keep it concise and clinically readable in India.

IR:
${JSON.stringify(ir, null, 2)}`;

    const soap = await callLLMJSON(soapPrompt, SOAP_SCHEMA);
    console.log('Generated SOAP');

    // 3) Create Prescription from IR + SOAP
    const rxPrompt = `Create a FHIR-like MedicationRequest Bundle for prescriptions, using GENERIC names only${options.redact ? ' (no brand names)' : ''}.
Only include medications if clearly indicated by IR/SOAP. If lifestyle advice is sufficient, return an empty entry array but still valid schema. Include standard advice like route and timing (e.g., after food) when appropriate.

Include India-friendly formatting (e.g., dose units) and avoid controlled substances.

IR:
${JSON.stringify(ir, null, 2)}

SOAP:
${JSON.stringify(soap, null, 2)}

Patient: ${body.patientContext?.name || 'Unknown'}; Doctor: ${body.clinicContext?.doctor_name || 'Unknown'}; Clinic: ${body.clinicContext?.clinic_name || 'Unknown'}`;

    const prescription = await callLLMJSON(rxPrompt, RX_SCHEMA);
    console.log('Generated prescription');

    const response: ProcessResponse = {
      ir,
      soap,
      prescription,
      warnings: [
        'Generated content is for clinical draft use only. Review and edit before finalizing or sharing with patients.'
      ],
      debug: options.debug ? { irPrompt, soapPrompt, rxPrompt } : undefined
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in process-medical-transcript function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error',
      ir: null,
      soap: null,
      prescription: null,
      warnings: ['Processing failed']
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});