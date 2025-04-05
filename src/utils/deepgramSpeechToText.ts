
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

// Options for real-time streaming transcription
const createDeepgramOptions = () => ({
  model: 'nova-3',
  smart_format: true,
  diarize: true,
  dictation: true,
  punctuate: true,
  filler_words: true,
  measurements: true, 
  punctuation: true,
  redact: true,
  numerals: true,
  sample_rate: 8000,
  paragraphs: true
});

// Options for post-processing with enhanced diarization
const createBatchProcessingOptions = () => ({
  model: 'nova-3',
  smart_format: true,
  diarize: true, 
  dictation: true,
  punctuate: true,
  filler_words: true,
  measurements: true,
  punctuation: true,
  redact: true,
  numerals: true,
  paragraphs: true,
  utterances: true, // Enable utterances for better speaker segmentation
  multichannel: false, // Use false for mono recordings
  detect_topics: true,
  detect_entities: true,
});

// Pre-connect to Deepgram (establishes connection without sending audio)
export const preconnectToDeepgram = (
  apiKey: string,
  onStatusChange?: (status: ConnectionStatus) => void
): { client: any, status: ConnectionStatus } => {
  try {
    const deepgram = createClient(apiKey);
    const client = deepgram.listen.live(createDeepgramOptions());
    
    if (onStatusChange) onStatusChange('connecting');
    
    client.on(LiveTranscriptionEvents.Open, () => {
      console.log('Deepgram connection opened');
      if (onStatusChange) onStatusChange('open');
    });
    
    client.on(LiveTranscriptionEvents.Error, (error) => {
      console.error('Deepgram error:', error);
      if (onStatusChange) onStatusChange('failed');
    });
    
    client.on(LiveTranscriptionEvents.Close, () => {
      console.log('Deepgram connection closed');
      if (onStatusChange) onStatusChange('closed');
    });
    
    return { client, status: 'connecting' };
  } catch (error) {
    console.error('Error pre-connecting to Deepgram:', error);
    return { client: null, status: 'failed' };
  }
};

// Disconnect from Deepgram
export const disconnectDeepgram = (client: any) => {
  if (client) {
    try {
      client.finish();
      console.log('Deepgram connection closed');
    } catch (error) {
      console.error('Error disconnecting from Deepgram:', error);
    }
  }
};

// Stream audio to an existing Deepgram connection
export const streamAudioToDeepgram = (
  stream: MediaStream,
  apiKey: string,
  onResult: (result: DeepgramResult) => void,
  onStatusChange?: (status: ConnectionStatus) => void,
  existingClient?: any
): { stopStreaming: () => void, audioData: { getAudioBlob: () => Promise<Blob | null> } } => {
  console.log('Setting up Deepgram audio streaming');

  let client: LiveClient | null = existingClient || null;
  let audioContext: AudioContext | null = null;
  let processor: ScriptProcessorNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let isOpen = client ? true : false; // Assume connection is open if client exists
  let resultCounter = 0;
  
  // Set up audio recorder
  const audioChunks: Float32Array[] = [];
  let isRecording = false;

  const setupStreaming = async () => {
    try {
      // Initialize audio context and processor
      audioContext = new AudioContext({ latencyHint: 'interactive', sampleRate: 16000 });
      source = audioContext.createMediaStreamSource(stream);
      processor = audioContext.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(audioContext.destination);

      // Initialize Deepgram client if one wasn't provided
      if (!client) {
        console.log('Creating new Deepgram client');
        const deepgram = createClient(apiKey);
        client = deepgram.listen.live(createDeepgramOptions());
        
        if (onStatusChange) onStatusChange('connecting');

        client.on(LiveTranscriptionEvents.Open, () => {
          console.log('Deepgram connection opened');
          isOpen = true;
          if (onStatusChange) onStatusChange('open');
          startSendingAudio();
        });
      } else {
        console.log('Using existing Deepgram client');
        isOpen = true;
        startSendingAudio();
      }

      function startSendingAudio() {
        // Start recording and streaming audio immediately
        isRecording = true;
        
        processor!.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Store audio for potential post-processing
          if (isRecording) {
            // Clone the data to prevent references to reused buffers
            const audioClone = new Float32Array(inputData.length);
            audioClone.set(inputData);
            audioChunks.push(audioClone);
          }
          
          // Send to Deepgram for real-time transcription
          if (client && isOpen) {
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
      }

      // Only set up event listeners if we created a new client
      if (!existingClient) {
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
      } else {
        // For existing clients, set up transcript handling
        const existingHandlers = (existingClient as any)._callbacks;
        
        // Only add a new transcript handler if one doesn't already exist
        if (!existingHandlers || !existingHandlers[LiveTranscriptionEvents.Transcript]) {
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
        }
      }
    } catch (error) {
      console.error('Error setting up Deepgram streaming:', error);
      if (onStatusChange) onStatusChange('failed');
    }
  };

  setupStreaming();
  
  // Helper to get recorded audio as blob
  const getAudioBlob = async (): Promise<Blob | null> => {
    if (!audioContext || audioChunks.length === 0) {
      return null;
    }
    
    try {
      // Concatenate all audio chunks
      const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const audioData = new Float32Array(totalLength);
      
      let offset = 0;
      for (const chunk of audioChunks) {
        audioData.set(chunk, offset);
        offset += chunk.length;
      }
      
      // Convert to 16-bit PCM WAV format
      const wavBuffer = await floatTo16BitPCM(audioData, audioContext.sampleRate);
      return new Blob([wavBuffer], { type: 'audio/wav' });
    } catch (error) {
      console.error('Error creating audio blob:', error);
      return null;
    }
  };

  return {
    stopStreaming: () => {
      // Just stop sending audio and clean up audio resources
      isRecording = false;
      
      if (processor && source) {
        source.disconnect(processor);
        processor.disconnect(audioContext!.destination);
      }
      
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(err => console.error('Error closing audio context:', err));
      }
      
      // Do not close the client - leave it connected
      audioContext = null;
      processor = null;
      source = null;
    },
    audioData: {
      getAudioBlob
    }
  };
};

// Utility function to convert Float32Array to WAV format
async function floatTo16BitPCM(float32Array: Float32Array, sampleRate: number): Promise<ArrayBuffer> {
  const numSamples = float32Array.length;
  const bytesPerSample = 2; // 16-bit
  const numChannels = 1; // Mono
  
  // Calculate buffer size for WAV file
  const bufferSize = 44 + (numSamples * bytesPerSample); // 44 bytes for header
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);
  
  // Write WAV header
  // "RIFF" chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(view, 8, 'WAVE');
  
  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size (16 for PCM)
  view.setUint16(20, 1, true); // audio format (1 for PCM)
  view.setUint16(22, numChannels, true); // num channels
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // byte rate
  view.setUint16(32, numChannels * bytesPerSample, true); // block align
  view.setUint16(34, bytesPerSample * 8, true); // bits per sample
  
  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, numSamples * bytesPerSample, true);
  
  // Write audio data
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    const value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(offset, value, true);
    offset += bytesPerSample;
  }
  
  return buffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Process a complete audio file with Deepgram for improved diarization
export const processCompleteAudio = async (
  audioBlob: Blob,
  apiKey: string,
): Promise<{transcript: string, error?: string}> => {
  try {
    console.log('Processing complete audio with Deepgram for diarization');
    
    // Convert blob to base64 for API transmission
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBase64 = arrayBufferToBase64(arrayBuffer);
    
    // Create options for batch processing
    const options = createBatchProcessingOptions();
    
    // Create the Deepgram API client
    const deepgram = createClient(apiKey);
    
    // Request for transcription with enhanced diarization
    const response = await deepgram.listen.prerecorded({
      buffer: Buffer.from(arrayBuffer),
      mimetype: 'audio/wav',
    }, options);
    
    // Check if we have results
    if (!response?.results?.channels?.[0]?.alternatives?.[0]) {
      return {
        transcript: '',
        error: 'No transcription results returned'
      };
    }
    
    // Format the transcript with speaker diarization
    const result = response.results;
    const transcription = formatDiarizedTranscript(result);
    
    return {
      transcript: transcription
    };
    
  } catch (error) {
    console.error('Error processing audio with Deepgram:', error);
    return {
      transcript: '',
      error: `Error processing audio: ${error}`
    };
  }
};

// Helper to format diarized transcript from Deepgram response
function formatDiarizedTranscript(result: any): string {
  try {
    if (!result?.utterances) {
      // Fall back to paragraphs if utterances are not available
      return formatParagraphTranscript(result);
    }
    
    // Enhanced formatting with utterances and speaker labels
    const utterances = result.utterances;
    let formattedText = '';
    
    utterances.forEach((utterance: any, index: number) => {
      const speakerLabel = utterance.speaker !== undefined 
        ? `[${getSpeakerLabel(utterance.speaker + 1)}]: `
        : '';
      
      formattedText += speakerLabel + utterance.transcript + '\n\n';
    });
    
    return formattedText.trim();
  } catch (error) {
    console.error('Error formatting diarized transcript:', error);
    return '';
  }
}

// Fallback formatting using paragraphs
function formatParagraphTranscript(result: any): string {
  try {
    const paragraphs = result.channels[0].alternatives[0].paragraphs?.paragraphs || [];
    let formattedText = '';
    
    paragraphs.forEach((para: any) => {
      // Try to determine speaker from the first word
      const firstWord = para.sentences?.[0]?.words?.[0];
      const speakerLabel = firstWord?.speaker !== undefined 
        ? `[${getSpeakerLabel(firstWord.speaker + 1)}]: `
        : '';
      
      formattedText += speakerLabel + para.text + '\n\n';
    });
    
    return formattedText.trim() || result.channels[0].alternatives[0].transcript;
  } catch (error) {
    console.error('Error formatting paragraph transcript:', error);
    
    // Last resort: just return the plain transcript
    try {
      return result.channels[0].alternatives[0].transcript;
    } catch {
      return '';
    }
  }
}

// Convert ArrayBuffer to base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  return btoa(binary);
}

export const getSpeakerLabel = (speakerTag?: number): string => {
  if (speakerTag === undefined) return '';
  return speakerTag === 1 ? 'Doctor' : 'Patient';
};
