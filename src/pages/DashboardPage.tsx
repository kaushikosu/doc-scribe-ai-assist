import React, { useState, useEffect, useRef } from 'react';
import { useSessionState } from '@/components/SessionStateContext';
// Only import mock for test/dev usage
// eslint-disable-next-line import/no-extraneous-dependencies
import { Card } from '@/components/ui/card';
import VoiceRecorder from '@/components/VoiceRecorder';
import TranscriptEditor from '@/components/TranscriptEditor';
import PrescriptionGenerator from '@/components/PrescriptionGenerator';
import DocHeader from '@/components/DocHeader';
import StatusBanner from '@/components/StatusBanner';
import DebugPanel from '@/components/DebugPanel';
import { formatPrescriptionString } from '@/components/PrescriptionFormatter';
import { STATUS_CONFIG } from '@/components/StatusStates';
import HowToUseCard from '@/components/HowToUseCard';

import { supabase } from '@/integrations/supabase/client';

import useAudioRecorder from '@/hooks/useAudioRecorder';
import { DiarizedTranscription } from '@/utils/diarizedTranscription';
import { processCompleteAudioWithCorrection, processCompleteAudio } from '@/utils/deepgramSpeechToText';
import { updateConsultationSession, uploadSessionAudio } from '@/integrations/supabase/consultationSessions';
import { useRecordingSession } from '@/hooks/useRecordingSession';

const DashboardPage = () => {
  const [transcript, _setTranscript] = useState('');
  const setTranscript = (val: string, trigger?: string) => {
    console.log(`[DEBUG] setTranscript:`, val, trigger ? `| Trigger: ${trigger}` : '');
    _setTranscript(val);
  };
  const { isTranscriptFinalized, setIsTranscriptFinalized } = useSessionState();
  // Ref to always have latest finalized state in async/closure
  const isTranscriptFinalizedRef = useRef(isTranscriptFinalized);
  useEffect(() => { isTranscriptFinalizedRef.current = isTranscriptFinalized; }, [isTranscriptFinalized]);
  const debugSetIsTranscriptFinalized = (val: boolean, trigger?: string) => {
    console.log(`[DEBUG] setIsTranscriptFinalized:`, val, trigger ? `| Trigger: ${trigger}` : '');
    setIsTranscriptFinalized(val);
  };
  const [classifiedTranscript, setClassifiedTranscript] = useState('');
  const {
    patientInfo,
    setPatientInfo,
    currentPatient,
    setCurrentPatient,
    currentPatientRecord,
    setCurrentPatientRecord,
    currentSessionRecord,
    setCurrentSessionRecord,
    handleTranscriptUpdate,
    handlePatientInfoUpdate,
    generateNewPatient
  } = useRecordingSession();
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecordingStarted, setHasRecordingStarted] = useState(false);
  const [displayMode, setDisplayMode] = useState<'live' | 'revised'>('live');
  const [enableAICorrection, setEnableAICorrection] = useState(true);
  
  // Debug panel states
  const [liveTranscript, setLiveTranscript] = useState('');
  const [deepgramTranscript, setDeepgramTranscript] = useState('');
  const [deepgramUtterances, setDeepgramUtterances] = useState<Array<{
    speaker: string;
    start: number;
    end: number;
    transcript: string;
    confidence: number;
  }>>([]);
  const [correctedUtterances, setCorrectedUtterances] = useState<any[]>([]);
  const [ir, setIr] = useState<any>(null);
  const [soap, setSoap] = useState<any>(null);
  // Store prescription as FHIR object only
  const [prescription, setPrescription] = useState<any>(null);
  type StatusType = 'ready' | 'recording' | 'processing' | 'classifying' | 'generating' | 'generated' | 'error';
  type ProgressStep = 'recording' | 'processing' | 'generating' | 'generated';
  const [status, setStatus] = useState<{ type: StatusType; message?: string }>({ type: 'ready' });
  const [progressStep, setProgressStep] = useState<ProgressStep>('recording');
  const [isDiarizing, setIsDiarizing] = useState(false);
  const [diarizedTranscription, setDiarizedTranscription] = useState<DiarizedTranscription | null>(null);
  
  const mountedRef = useRef(true);
  const prescriptionRef = useRef<HTMLDivElement>(null);
  const [sessionId, setSessionId] = useState(0);
  const sessionRef = useRef(0);
  useEffect(() => { sessionRef.current = sessionId; }, [sessionId]);
  
  const googleApiKey = import.meta.env.VITE_GOOGLE_SPEECH_API_KEY;
  const deepgramApiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
  
  const {
    isRecording: isAudioRecording,
    recordingDuration,
    formattedDuration,
    startRecording: startAudioRecording,
    stopRecording: stopAudioRecording,
    audioBlob
  } = useAudioRecorder({
    onRecordingComplete: (blob) => {
      console.log("Full audio recording complete:", blob.size, "bytes");
      processDiarizedTranscription(blob);
    }
  });
  
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    console.log("Transcript updated in DashboardPage:", transcript);
  }, [transcript]);
  
  
  // Removed useEffect that triggers diarization on isRecording/isAudioRecording/audioBlob changes

  
  const processDiarizedTranscription = async (audioBlob: Blob) => {
    // Proceed without client key; edge function stores Deepgram secret
    const apiKeyForCompat = (deepgramApiKey as string) || '';
    
    if (!audioBlob || audioBlob.size === 0) {
      console.error("No audio data to process");
      setStatus({ type: 'error', message: 'No audio recorded for diarization' });
      return;
    }
    
    console.log("Processing audio blob for diarization with Deepgram:", audioBlob.size, "bytes");
    setIsDiarizing(true);
  console.log('[DEBUG] setStatus: processing (Updating transcript...)');
  console.log('[DEBUG] setStatus: processing (Updating transcript...) | Trigger: diarization start');
  setStatus({ type: 'processing', message: 'Updating transcript...' });
    const startSession = sessionRef.current;
    
    try {
      // Process audio with Deepgram only (no correction)
      const { transcript: diarizedText, utterances, error } = await processCompleteAudio(audioBlob, apiKeyForCompat);
      console.log("Diarized text from Deepgram:", diarizedText?.length, "characters");
      
      // Update debug panel with Deepgram result
      if (diarizedText) {
        setDeepgramTranscript(diarizedText);
      }
      if (Array.isArray(utterances) && utterances.length > 0) {
        // Map utterances to expected shape for debug panel (raw Deepgram output)
        setDeepgramUtterances(
          utterances.map(u => ({
            speaker: u.speaker,
            start: u.ts_start,
            end: u.ts_end,
            transcript: u.text,
            confidence: u.asr_conf
          }))
        );
        // Process with medical IR pipeline
        await processWithMedicalPipeline(utterances);
      } else if (diarizedText && diarizedText.trim() && diarizedText.trim().length > 0) {
        // Fallback: try to derive utterances from plain transcript if Deepgram utterances missing
        const fallbackUtterances = diarizedText.split(/\n+/).map((line, idx) => {
          // Only match Speaker N: text, fallback to Speaker 0/1, never DOCTOR/PATIENT here
          const m1 = line.match(/^\s*Speaker\s+(\d+):\s*(.*)$/i);
          let speaker = `Speaker ${idx % 2}`;
          let text = line.trim();
          if (m1) {
            const sp = parseInt(m1[1], 10);
            speaker = `Speaker ${sp}`;
            text = m1[2];
          }
          return { speaker, ts_start: 0, ts_end: 0, text, asr_conf: 1 };
        }).filter(u => u.text && u.text.length > 0);
        if (Array.isArray(fallbackUtterances) && fallbackUtterances.length > 0) {
          setDeepgramUtterances(
            fallbackUtterances.map(u => ({
              speaker: u.speaker,
              start: u.ts_start,
              end: u.ts_end,
              transcript: u.text,
              confidence: u.asr_conf
            }))
          );
          await processWithMedicalPipeline(fallbackUtterances);
        }
      }
      
      if (sessionRef.current !== startSession) {
        console.log("Stale diarization result ignored");
        setIsDiarizing(false);
        return;
      }
      
      if (error) {
        console.error("Deepgram error:", error);
        setDiarizedTranscription({
          transcript: "Deepgram error",
          error: error
        });
        setStatus({ type: 'error', message: 'Diarization error: ' + error });
  } else if (!diarizedText || !diarizedText.trim() || diarizedText.trim().length === 0) {
        console.warn("No speech detected by Deepgram");
        setDiarizedTranscription({
          transcript: "No speech detected by deepgram",
          error: "No speech detected"
        });
        setStatus({ type: 'error', message: 'No speech detected in the audio' });
      } else {
        const result: DiarizedTranscription = {
          transcript: diarizedText,
          error: undefined
        };
        
        console.log("Deepgram diarization complete:", result);
        setDiarizedTranscription(result);

        // Only set transcript/classifiedTranscript if not already classified (i.e., not already Doctor/Patient)
        // Only set transcript/classifiedTranscript if in 'live' mode (before speaker correction)
        if (displayMode === 'live' && !isTranscriptFinalizedRef.current) {
          setClassifiedTranscript(diarizedText);
          setTranscript(diarizedText, 'diarization (displayMode live, not finalized)');
        } else {
          console.log('[DEBUG] Skipped setTranscript from diarization because isTranscriptFinalizedRef:', isTranscriptFinalizedRef.current);
        }
        setDisplayMode('revised');
  console.log('[DEBUG] setStatus: generating (Generating prescription...)');
        if (!isTranscriptFinalizedRef.current) {
          console.log('[DEBUG] setStatus: generating (Generating prescription...) | Trigger: diarization complete');
          setStatus({ type: 'generating', message: 'Generating prescription...' });
        } else {
          console.log('[DEBUG] Skipped setStatus: generating (already finalized)');
        }

        // Upload audio to storage after successful processing
        if (currentSessionRecord) {
          console.log("Uploading audio to storage for session:", currentSessionRecord.id);
          try {
            const uploadResult = await uploadSessionAudio(currentSessionRecord.id, audioBlob);
            if (uploadResult.success) {
              console.log("Audio uploaded successfully to storage");
              // Update current session record with the new data
              if (uploadResult.session) {
                setCurrentSessionRecord(uploadResult.session);
              }
            } else {
              console.error("Failed to upload audio:", uploadResult.error);
            }
          } catch (uploadError) {
            console.error("Error uploading audio:", uploadError);
          }
        }
      }
      
      setIsDiarizing(false);
      
    } catch (error: any) {
      console.error("Error in Deepgram diarized transcription:", error);
      setIsDiarizing(false);
      setDiarizedTranscription({
        transcript: "Error in deepgram transcription",
        error: error.message || "Unknown error processing audio"
      });
      setStatus({ type: 'error', message: 'Failed to process diarized transcription with Deepgram' });
    }
  };

  // New function to process with IR → SOAP → Prescription pipeline
  const processWithMedicalPipeline = async (utterances: any[]) => {
    try {
  console.log('[DEBUG] setStatus: processing (Classifying speakers...)');
  console.log('[DEBUG] setStatus: processing (Classifying speakers...) | Trigger: medical pipeline start');
  setStatus({ type: 'processing', message: 'Classifying speakers...' });

      // 1. Call correct-transcript-speakers to classify speakers
      const { data: correctedData, error: correctError } = await supabase.functions.invoke('correct-transcript-speakers', {
        body: {
          transcript: utterances,
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
        setStatus({ type: 'error', message: 'Speaker labels could not be classified. Please retry or check backend logs.' });
        setClassifiedTranscript('');
        setTranscript('');
        setCorrectedUtterances([]);
        return; // Do not proceed to show transcript
      }


      setCorrectedUtterances(correctedUtterances);

      // Generate revised transcript string from correctedUtterances (after AI speaker correction)

  if (Array.isArray(correctedUtterances) && correctedUtterances.length > 0) {
    // Use the speaker label as returned by correct-transcript-speakers, no fallback/hardcoding
    const revisedTranscript = correctedUtterances
      .map(u => `[${u.speaker}]: ${u.text}`)
      .join('\n\n');
    setClassifiedTranscript(revisedTranscript);
    setTranscript(revisedTranscript);
  }

  // Switch to generating phase as soon as speakers are classified
  console.log('[DEBUG] setStatus: generating (Generating prescription...) after speaker classification');
  console.log('[DEBUG] setStatus: generating (Generating prescription...) | Trigger: after speaker classification');
  setStatus({ type: 'generating', message: STATUS_CONFIG.generating.message });
  debugSetIsTranscriptFinalized(true, 'after speaker classification');

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

      console.log('[DEBUG] setStatus: generated (Prescription generated) | Trigger: medical processing complete');
      setStatus({ type: 'generated', message: STATUS_CONFIG.generated.message });
      debugSetIsTranscriptFinalized(true, 'medical processing complete');

      console.log('Medical processing complete:', {
        ir: result.ir,
        soap: result.soap,
        prescription: result.prescription,
      });
    } catch (error) {
      console.error('Error in medical pipeline:', error);
      setStatus({ type: 'error', message: 'Medical processing error: ' + String(error) });
    }
  };


  // Handle recording start - create patient if none exists
  const handleRecordingStart = async () => {
    debugSetIsTranscriptFinalized(false, 'recording start');
    if (!currentPatientRecord) {
      await generateNewPatient();
    }
  };
  
const handleRecordingStateChange = (recordingState: boolean) => {
  console.log("Recording state changed to:", recordingState);
  setIsRecording(recordingState);

  if (recordingState) {
    if (!hasRecordingStarted) setHasRecordingStarted(true);
    setDisplayMode('live');
    setProgressStep('recording');
    if (status.type !== 'recording') {
      setStatus({ type: 'recording', message: 'Recording in progress' });
    }
  } else if (hasRecordingStarted) {
    setDisplayMode('revised');
    setProgressStep('processing');
    // Set status to processing immediately for instant UX feedback
    setStatus({ type: 'processing', message: 'Updating transcript...' });
    // Diarization is now only triggered in onRecordingComplete
  }
};

  // Only expose the mock button in development or if a test flag is set

  return (
    <div className="min-h-screen bg-gradient-to-b from-doctor-light via-white to-doctor-light/20">
      <div className="container py-8 max-w-6xl">
        {hasRecordingStarted && <StatusBanner status={status} />}
        <DocHeader patientInfo={patientInfo} />
        <div className="grid gap-6 md:grid-cols-12">
          <div className="md:col-span-4 space-y-6">
            <VoiceRecorder 
              onTranscriptUpdate={(t) => handleTranscriptUpdate(t, setTranscript, setLiveTranscript)}
              onPatientInfoUpdate={handlePatientInfoUpdate}
              onRecordingStateChange={handleRecordingStateChange}
              onRecordingStart={handleRecordingStart}
              onNewPatient={() => {
                setIsRecording(false);
                setHasRecordingStarted(false);
                setDisplayMode('live');
                setTranscript('');
                setClassifiedTranscript('');
                setDiarizedTranscription(null);
                setLiveTranscript('');
                setDeepgramTranscript('');
                setDeepgramUtterances([]);
                setIr(null);
                setSoap(null);
                setPrescription(null);
                setProgressStep('recording');
                setStatus({ type: 'ready' });
                setSessionId(id => id + 1);
                debugSetIsTranscriptFinalized(false, 'new patient/session');
                generateNewPatient();
              }}
            />
            <HowToUseCard />
          </div>
          <div className="md:col-span-8 space-y-6">
            <TranscriptEditor 
              transcript={transcript} 
              onTranscriptChange={setTranscript}
              isRecording={isRecording}
              mode={displayMode}
              status={status}
            />
            <div ref={prescriptionRef} className="animate-fade-in">
              <PrescriptionGenerator 
                key={sessionId}
                transcript={transcript} 
                patientInfo={patientInfo}
                classifiedTranscript={classifiedTranscript}
                currentPatient={currentPatientRecord}
                sessionId={currentSessionRecord?.id}
                prescription={prescription}
                getFormattedPrescription={(fhirPrescription) => formatPrescriptionString(fhirPrescription, {ir, soap, patientInfo, currentPatient: currentPatientRecord})}
                status={status}
                onGeneratingStart={() => {
                  setProgressStep('generating');
                  setStatus({ type: 'generating', message: 'Generating prescription...' });
                }}
                onGenerated={async (generatedPrescription?: string) => {
                  setProgressStep('generated');
                  setStatus({ type: 'ready', message: STATUS_CONFIG.generated.message });
                  // Update consultation session with transcripts
                  if (currentSessionRecord) {
                    try {
                      // Save the formatted string for the DB, not the FHIR object
                      const formatted = formatPrescriptionString(prescription, {ir, soap, patientInfo, currentPatient: currentPatientRecord});
                      console.log("Saving prescription to database:", formatted);
                      await updateConsultationSession(currentSessionRecord.id, {
                        live_transcript: transcript,
                        updated_transcript: classifiedTranscript,
                        prescription: formatted || '',
                        session_ended_at: new Date().toISOString()
                      });
                      console.log("Consultation session updated successfully");
                    } catch (error) {
                      console.error('Failed to update consultation session:', error);
                    }
                  }
                  prescriptionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              />
            </div>
          </div>
        </div>
        {/* Debug Panel */}
        <div className="mt-8">
          <DebugPanel
            liveTranscript={liveTranscript}
            deepgramTranscript={deepgramTranscript}
            deepgramUtterances={deepgramUtterances}
            correctedUtterances={correctedUtterances}
            ir={ir}
            soap={soap}
            prescription={prescription}
            isRecording={isRecording}
          />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
