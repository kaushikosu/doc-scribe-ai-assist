// src/utils/medicalPipeline.ts
import { supabase } from '@/integrations/supabase/client';
import { mapDiarizedUtterancesToPipeline } from '@/mocks/mapDiarizedUtterances';

export async function processWithMedicalPipeline(utterances: any[], currentPatient: any, patientInfo: any, setStatus: (s: any) => void, setCorrectedUtterances: (u: any[]) => void, setIr: (ir: any) => void, setSoap: (soap: any) => void, setPrescription: (p: any) => void) {
  // Always map utterances to the expected format for the edge function
  const mappedUtterances = mapDiarizedUtterancesToPipeline(utterances);
  try {
    setStatus({ type: 'processing', message: 'Classifying speakers...' });
    // 1. Call correct-transcript-speakers to classify speakers
    const { data: correctedData, error: correctError } = await supabase.functions.invoke('correct-transcript-speakers', {
      body: {
        transcript: mappedUtterances,
        patientContext: {
          name: currentPatient?.name || patientInfo.name,
          age: currentPatient?.age,
          sex: currentPatient?.gender
        },
        clinicContext: {
          doctor_name: 'Dr. Kumar',
          clinic_name: 'Medical Clinic'
        }
      }
    });
    if (correctError) {
      throw new Error(correctError.message || 'Failed to classify speakers');
    }
    const correctedUtterances = correctedData?.utterances || correctedData;
    if (!correctedUtterances || !Array.isArray(correctedUtterances)) {
      throw new Error('No corrected utterances returned from speaker classification');
    }
    // Strict check: if any utterance has a label like 'Speaker 0' or 'Speaker 1', treat as backend error
    const fallbackSpeaker = correctedUtterances.find((u: any) =>
      typeof u.speaker === 'string' && /^Speaker\s*\d+$/i.test(u.speaker)
    );
    if (fallbackSpeaker) {
      setStatus({ type: 'error', message: 'Backend failed to classify speakers. Please retry or check backend logs.' });
      throw new Error('Backend returned fallback speaker labels (Speaker 0/1).');
    }
    setCorrectedUtterances(correctedUtterances);
    // Generate revised transcript string from correctedUtterances (after AI speaker correction)
    if (Array.isArray(correctedUtterances) && correctedUtterances.length > 0) {
      const revisedTranscript = correctedUtterances
        .map(u => `[${u.speaker}]: ${u.text}`)
        .join('\n\n');
      // Optionally update classifiedTranscript and transcript in the page
    }
    setStatus({ type: 'processing', message: 'Processing medical information...' });
    // 2. Call process-medical-transcript with the corrected utterances
    const { data, error } = await supabase.functions.invoke('process-medical-transcript', {
      body: {
        transcript: correctedUtterances,
        patientContext: {
          name: currentPatient?.name || patientInfo.name,
          age: currentPatient?.age,
          sex: currentPatient?.gender
        },
        clinicContext: {
          doctor_name: 'Dr. Kumar',
          clinic_name: 'Medical Clinic'
        },
        options: {
          redactMedicineNames: false,
          returnDebug: false
        }
      }
    });
    if (error) {
      throw new Error(error.message || 'Failed to process medical transcript');
    }
    const result = data as any;
    if (result?.error) {
      throw new Error(result.error);
    }
    setIr(result.ir);
    setSoap(result.soap);
    setPrescription(result.prescription || null);
    console.log('Medical processing complete:', {
      ir: result.ir,
      soap: result.soap,
      prescription: result.prescription,
    });
  } catch (error) {
    console.error('Error in medical pipeline:', error);
    setStatus({ type: 'error', message: 'Medical processing error: ' + String(error) });
  }
}
