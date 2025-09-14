import { DiarizedUtterance } from "@/types/diarization";

// Converts DiarizedUtterance[] to the format expected by processWithMedicalPipeline and deepgramUtterances state
export function mapDiarizedUtterancesToPipeline(utterances: DiarizedUtterance[]) {
  return utterances.map(u => ({
    speaker: u.speaker,
    start: u.ts_start ?? 0,
    end: u.ts_end ?? 0,
    transcript: u.text,
    confidence: u.asr_conf ?? 1
  }));
}
