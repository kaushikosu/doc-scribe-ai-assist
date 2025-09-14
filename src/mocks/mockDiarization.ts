import { DiarizedTranscription } from "@/utils/diarizedTranscription";

export const mockTranscript = `Speaker 0: Hello, how are you feeling today?\nSpeaker 1: I've been having headaches and a sore throat.\nSpeaker 0: Any fever or cough?\nSpeaker 1: Yes, mild fever since yesterday.`;


export const mockUtterances = [
  { speaker: 'DOCTOR', ts_start: 0, ts_end: 3, text: 'Hello, how are you feeling today?', asr_conf: 0.98 },
  { speaker: 'PATIENT', ts_start: 3, ts_end: 7, text: "I've been having headaches and a sore throat.", asr_conf: 0.97 },
  { speaker: 'DOCTOR', ts_start: 7, ts_end: 9, text: 'Any fever or cough?', asr_conf: 0.99 },
  { speaker: 'PATIENT', ts_start: 9, ts_end: 13, text: 'Yes, mild fever since yesterday.', asr_conf: 0.96 },
];

export const mockDiarizedTranscription: DiarizedTranscription = {
  transcript: mockTranscript,
  utterances: mockUtterances,
};
