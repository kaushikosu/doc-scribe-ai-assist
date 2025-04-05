import { createClient, LiveClient, LiveTranscriptionEvents } from '@deepgram/sdk';

// Define types for Deepgram responses
export interface DeepgramResult {
  transcript: string;
  isFinal: boolean;
  resultIndex: number;
  speakerTag?: number;
  error?: string;
  topics?: string[];
}

// WebSocket connection status
export type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'failed';

// Create Deepgram options
const createDeepgramOptions = () => ({
  model: 'nova-2',
  smartFormat: true,
  fillerWords: false,
  diarize: true,
  punctuate: true,
  paragraphs: true,
  utterances: true,
  detectTopics: true, // Corrected to use Deepgram's topic detection
  encoding: 'linear16',
  sampleRate: 16000,
  channels: 1,
});

// Function to preconnect to Deepgram
export const preconnectToDeepgram = (
  apiKey: string,
  onStatusChange?: (status: ConnectionStatus) => void
): { client: LiveClient | null; status: ConnectionStatus } => {
  console.log('Pre-connecting to Deepgram...');

  try {
    if (onStatusChange) onStatusChange('connecting');

    const deepgram = createClient(apiKey);
    const liveClient = deepgram.listen.live(createDeepgramOptions());

    liveClient.on(LiveTranscriptionEvents.Open, () => {
      console.log('Deepgram connection opened');
      if (onStatusChange) onStatusChange('open');
    });

    liveClient.on(LiveTranscriptionEvents.Error, (error) => {
      console.error('Deepgram error:', error);
      if (onStatusChange) onStatusChange('failed');
    });

    liveClient.on(LiveTranscriptionEvents.Close, () => {
      console.log('Deepgram connection closed');
      if (onStatusChange) onStatusChange('closed');
    });

    return { client: liveClient, status: 'connecting' };
  } catch (error) {
    console.error('Error pre-connecting to Deepgram:', error);
    if (onStatusChange) onStatusChange('failed');
    return { client: null, status: 'failed' };
  }
};

// Function to disconnect from Deepgram
export const disconnectDeepgram = (client: LiveClient | null): void => {
  if (client) {
    try {
      client.finish();
      console.log('Deepgram connection closed');
    } catch (error) {
      console.error('Error disconnecting from Deepgram:', error);
    }
  }
};

// Main function to stream audio to Deepgram
export const streamAudioToDeepgram = (
  stream: MediaStream,
  apiKey: string,
  onResult: (result: DeepgramResult) => void,
  onStatusChange?: (status: ConnectionStatus) => void,
  existingClient?: LiveClient | null
): (() => void) => {
  console.log('Setting up Deepgram streaming...');

  const audioContext = new AudioContext({
    latencyHint: 'interactive',
    sampleRate: 16000,
  });
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  source.connect(processor);
  processor.connect(audioContext.destination);

  let client: LiveClient | null = existingClient || null;
  let isOpen = false; // Track connection state manually
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let resultCounter = 0; // Unique result index

  const setupNewClient = (): LiveClient | null => {
    try {
      const deepgram = createClient(apiKey);
      const newClient = deepgram.listen.live(createDeepgramOptions());

      if (onStatusChange) onStatusChange('connecting');

      newClient.on(LiveTranscriptionEvents.Open, () => {
        console.log('Deepgram connection opened');
        isOpen = true;
        if (onStatusChange) onStatusChange('open');
        reconnectAttempts = 0;
      });

      newClient.on(LiveTranscriptionEvents.Transcript, (data) => {
        try {
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
        } catch (error) {
          console.error('Error processing Deepgram transcript:', error);
          onResult({ transcript: '', isFinal: false, resultIndex: resultCounter++, error: String(error) });
        }
      });

      newClient.on(LiveTranscriptionEvents.Error, (error) => {
        console.error('Deepgram error:', error);
        isOpen = false;
        if (onStatusChange) onStatusChange('failed');
        reconnect();
      });

      newClient.on(LiveTranscriptionEvents.Close, () => {
        console.log('Deepgram connection closed');
        isOpen = false;
        if (onStatusChange) onStatusChange('closed');
        if (reconnectAttempts < maxReconnectAttempts) reconnect();
      });

      return newClient;
    } catch (error) {
      console.error('Error creating Deepgram client:', error);
      if (onStatusChange) onStatusChange('failed');
      return null;
    }
  };

  const reconnect = () => {
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.error('Maximum reconnection attempts reached');
      if (onStatusChange) onStatusChange('failed');
      return;
    }

    reconnectAttempts++;
    console.log(`Reconnecting to Deepgram (attempt ${reconnectAttempts})`);

    if (reconnectTimeout) clearTimeout(reconnectTimeout);

    reconnectTimeout = setTimeout(() => {
      if (client) disconnectDeepgram(client);
      client = setupNewClient();
    }, 1000 * Math.min(reconnectAttempts, 3));
  };

  if (!client) {
    client = setupNewClient();
  } else {
    console.log('Using existing Deepgram connection');
    client.on(LiveTranscriptionEvents.Open, () => {
      isOpen = true;
      if (onStatusChange) onStatusChange('open');
    });
    if (isOpen) {
      if (onStatusChange) onStatusChange('open');
    } else {
      disconnectDeepgram(client);
      client = setupNewClient();
    }
  }

  processor.onaudioprocess = (e) => {
    if (client && isOpen) {
      const inputData = e.inputBuffer.getChannelData(0);
      const int16Array = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        int16Array[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32767));
      }
      try {
        client.send(int16Array.buffer);
      } catch (error) {
        console.error('Error sending audio data to Deepgram:', error);
      }
    }
  };

  return () => {
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    if (source && processor) {
      source.disconnect(processor);
      processor.disconnect(audioContext.destination);
    }
    if (audioContext.state !== 'closed') audioContext.close();
    disconnectDeepgram(client);
    client = null;
    isOpen = false;
    console.log('Deepgram connection cleaned up');
  };
};

// Helper function for speaker labels
export const getSpeakerLabel = (speakerTag?: number): string => {
  if (speakerTag === undefined) return '';
  return speakerTag === 1 ? 'Doctor' : 'Patient';
};