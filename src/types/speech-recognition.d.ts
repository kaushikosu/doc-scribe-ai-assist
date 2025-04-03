
interface Window {
  SpeechRecognition: typeof SpeechRecognition;
  webkitSpeechRecognition: typeof SpeechRecognition;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudioend: (ev: Event) => any;
  onaudiostart: (ev: Event) => any;
  onend: (ev: Event) => any;
  onerror: (ev: Event) => any;
  onnomatch: (ev: Event) => any;
  onresult: (ev: SpeechRecognitionEvent) => any;
  onsoundend: (ev: Event) => any;
  onsoundstart: (ev: Event) => any;
  onspeechend: (ev: Event) => any;
  onspeechstart: (ev: Event) => any;
  onstart: (ev: Event) => any;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};
