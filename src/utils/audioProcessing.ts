// src/utils/audioProcessing.ts
import { processCompleteAudio } from '@/utils/deepgramSpeechToText';

export async function processDiarizedTranscription(audioBlob: Blob, deepgramApiKey: string, setDeepgramTranscript: (t: string) => void, setDeepgramUtterances: (u: any[]) => void, setDiarizedTranscription: (d: any) => void, setStatus: (s: any) => void, setIsDiarizing: (b: boolean) => void, setTranscript: (t: string) => void, setClassifiedTranscript: (t: string) => void, setDisplayMode: (m: string) => void, setProgressStep: (s: string) => void, setLiveTranscript: (t: string) => void, setCurrentSessionRecord: (s: any) => void, uploadSessionAudio: any, currentSessionRecord: any, patientInfo: any, currentPatient: any, processWithMedicalPipeline: any) {
  if (!audioBlob || audioBlob.size === 0) {
    console.error("No audio data to process");
    setStatus({ type: 'error', message: 'No audio recorded for diarization' });
    return;
  }
  setIsDiarizing(true);
  setStatus({ type: 'processing', message: 'Updating transcript...' });
  try {
    const { transcript: diarizedText, utterances, error } = await processCompleteAudio(audioBlob, deepgramApiKey);
    if (diarizedText) {
      setDeepgramTranscript(diarizedText);
    }
    if (Array.isArray(utterances) && utterances.length > 0) {
      setDeepgramUtterances(
        utterances.map(u => ({
          speaker: u.speaker,
          start: u.ts_start,
          end: u.ts_end,
          transcript: u.text,
          confidence: u.asr_conf
        }))
      );
      await processWithMedicalPipeline(utterances, currentPatient, patientInfo, setStatus, () => {}, () => {}, () => {}, () => {});
    } else if (diarizedText && diarizedText.trim() && diarizedText.trim().length > 0) {
      const fallbackUtterances = diarizedText.split(/\n+/).map((line) => {
        const m1 = line.match(/^\s*Speaker\s+(\d+):\s*(.*)$/i);
        const m2 = line.match(/^\s*\[(Doctor|Patient|Speaker\s*\d+)\]:\s*(.*)$/i);
        let speaker = 'SPEAKER_0';
        let text = line.trim();
        if (m1) {
          const sp = parseInt(m1[1], 10);
          speaker = `Speaker ${sp}`;
          text = m1[2];
        } else if (m2) {
          const role = m2[1];
          speaker = role;
          text = m2[2];
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
        await processWithMedicalPipeline(fallbackUtterances, currentPatient, patientInfo, setStatus, () => {}, () => {}, () => {}, () => {});
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
}
