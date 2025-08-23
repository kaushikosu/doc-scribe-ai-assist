// Enhanced diarization types with timing and confidence information

export interface DiarizedUtterance {
  speaker: string; // "DOCTOR", "PATIENT", or "SPEAKER_X"
  ts_start: number; // Start time in seconds
  ts_end: number; // End time in seconds  
  text: string; // The utterance text
  asr_conf: number; // ASR confidence score (0.0 to 1.0)
}

export interface DiarizedTranscriptResult {
  utterances: DiarizedUtterance[];
  raw_transcript?: string; // Original transcript for fallback
  error?: string;
}

export interface DiarizedWord {
  word: string;
  speakerTag: number;
  startTime: number;
  endTime: number;
  confidence?: number;
}