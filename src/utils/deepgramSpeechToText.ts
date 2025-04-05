import { createClient, LiveClient, LiveTranscriptionEvents } from '@deepgram/sdk';

export interface DeepgramResult {
  transcript: string;
  isFinal: boolean;
  resultIndex: number;
  speakerTag?: number;
  error?: string;
  topics?: string[];
}

export type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'failed';

const createDeepgramOptions = () => ({
  model: 'nova-3',
  smart_format: true,
  diarize: true,
  dictation: true,
  punctuate: true,
  filler_words: true,
  measurements:true, 
  punctuation: true,
  redact: true,
  numerals: true,
  sample_rate: 8000,
  paragraphs: true
});

export const streamAudioToDeepgram = (
  stream: MediaStream,
  apiKey: string,
  onResult: (result: DeepgramResult) => void,
  onStatusChange?: (status: ConnectionStatus) => void
): (() => void) => {
  console.log('Setting up Deepgram streaming with API Key:', apiKey.slice(0, 4) + '...');

  let client: LiveClient | null = null;
  let audioContext: AudioContext | null = null;
  let processor: ScriptProcessorNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let isOpen = false;
  let resultCounter = 0;

  const setupStreaming = async () => {
    try {
      // Initialize audio context and processor
      audioContext = new AudioContext({ latencyHint: 'interactive', sampleRate: 16000 });
      source = audioContext.createMediaStreamSource(stream);
      processor = audioContext.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(audioContext.destination);

      // Initialize Deepgram client
      const deepgram = createClient(apiKey);
      client = deepgram.listen.live(createDeepgramOptions());

      if (onStatusChange) onStatusChange('connecting');

      client.on(LiveTranscriptionEvents.Open, () => {
        console.log('Deepgram connection opened');
        isOpen = true;
        if (onStatusChange) onStatusChange('open');

        // Start sending audio immediately
        processor!.onaudioprocess = (e) => {
          if (client && isOpen) {
            const inputData = e.inputBuffer.getChannelData(0);
            const int16Array = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              int16Array[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32767));
            }
            try {
              client.send(int16Array.buffer);
            } catch (error) {
              console.error('Error sending audio:', error);
            }
          }
        };
      });

      client.on(LiveTranscriptionEvents.Transcript, (data) => {
        if (!data?.channel?.alternatives?.length) return;
        const transcript = data.channel.alternatives[0].transcript;
        if (!transcript.trim()) return;

        const topics = data.channel.alternatives[0].topics?.map((t: any) => t.topic);
        const speakerTag = data.channel.alternatives[0].words?.[0]?.speaker !== undefined
          ? data.channel.alternatives[0].words[0].speaker + 1
          : undefined;

        onResult({
          transcript,
          isFinal: data.is_final || false,
          resultIndex: resultCounter++,
          speakerTag,
          topics,
        });
      });

      client.on(LiveTranscriptionEvents.Error, (error: Event) => {
        console.error('Deepgram error details:', {
          type: error.type,
          target: error.target instanceof WebSocket ? {
            readyState: (error.target as WebSocket).readyState,
            url: (error.target as WebSocket).url,
            protocol: (error.target as WebSocket).protocol,
          } : 'Not a WebSocket',
          isTrusted: error.isTrusted,
        });
        isOpen = false;
        if (onStatusChange) onStatusChange('failed');
      });

      client.on(LiveTranscriptionEvents.Close, (event) => {
        console.log('Deepgram connection closed:', event);
        isOpen = false;
        if (onStatusChange) onStatusChange('closed');
      });
    } catch (error) {
      console.error('Error setting up Deepgram streaming:', error);
      if (onStatusChange) onStatusChange('failed');
    }
  };

  setupStreaming();

  return () => {
    if (processor && source) {
      source.disconnect(processor);
      processor.disconnect(audioContext!.destination);
    }
    if (audioContext && audioContext.state !== 'closed') audioContext.close();
    if (client) {
      client.finish();
      console.log('Deepgram connection closed');
    }
    client = null;
    isOpen = false;
    audioContext = null;
    processor = null;
    source = null;
  };
};

export const getSpeakerLabel = (speakerTag?: number): string => {
  if (speakerTag === undefined) return '';
  return speakerTag === 1 ? 'Doctor' : 'Patient';
};