// Define types for Deepgram responses
import { Deepgram, LiveTranscriptionResponse, LiveClient, LiveTranscriptionEvent } from "@deepgram/sdk";

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

// Create Deepgram client with options
const createDeepgramOptions = () => {
  return {
    model: "nova-2",
    smart_format: true,
    filler_words: false,
    diarize: true, // Enable diarization
    punctuate: true, // Enable punctuation
    paragraphs: true, // Enable paragraphs
    utterances: true, // Enable utterances
    encoding: "linear16",
    sample_rate: 16000,
    channels: 1,
    topics: "medicine,symptoms,doctor,patient", // Enable topic detection with custom topics
  };
};

// Cache for Deepgram clients
let clientCache: { client: LiveClient | null, apiKey: string } = { client: null, apiKey: '' };

// Function to preconnect to Deepgram - establishes connection early
export const preconnectToDeepgram = (
  apiKey: string,
  onStatusChange?: (status: ConnectionStatus) => void
): { client: LiveClient | null; status: ConnectionStatus } => {
  console.log("Pre-connecting to Deepgram...");
  
  try {
    if (onStatusChange) {
      onStatusChange('connecting');
    }
    
    // Create Deepgram client
    const deepgramClient = new Deepgram(apiKey);

    // Create a live transcription client
    const liveClient = deepgramClient.listen.live(createDeepgramOptions());

    // Set up event listeners
    liveClient.on(LiveTranscriptionEvent.Open, () => {
      console.log("Deepgram connection opened");
      if (onStatusChange) {
        onStatusChange('open');
      }
    });

    liveClient.on(LiveTranscriptionEvent.Error, (error) => {
      console.error("Deepgram error:", error);
      if (onStatusChange) {
        onStatusChange('failed');
      }
    });

    liveClient.on(LiveTranscriptionEvent.Close, () => {
      console.log("Deepgram connection closed");
      if (onStatusChange) {
        onStatusChange('closed');
      }
    });

    // Cache the client for reuse
    clientCache = { client: liveClient, apiKey };
    
    return { client: liveClient, status: 'connecting' };
  } catch (error) {
    console.error("Error pre-connecting to Deepgram:", error);
    if (onStatusChange) {
      onStatusChange('failed');
    }
    return { client: null, status: 'failed' };
  }
};

// Function to disconnect from Deepgram
export const disconnectDeepgram = (client: LiveClient | null): void => {
  if (client) {
    try {
      client.finish();
      console.log("Deepgram connection closed");
    } catch (error) {
      console.error("Error disconnecting from Deepgram:", error);
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
  console.log("Setting up Deepgram streaming...");
  
  // Set up audio processing
  const audioContext = new AudioContext({
    latencyHint: 'interactive',
    sampleRate: 16000
  });
  
  // Get the audio stream
  const source = audioContext.createMediaStreamSource(stream);
  
  // Create processor to handle audio chunks
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  
  // Connect audio nodes
  source.connect(processor);
  processor.connect(audioContext.destination);

  // Use existing client or create a new one
  let client: LiveClient | null = existingClient || null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  let reconnectTimeout: NodeJS.Timeout | null = null;

  const setupNewClient = () => {
    try {
      // If we have a cached client with the same API key, reuse it
      if (clientCache.client && clientCache.apiKey === apiKey) {
        console.log("Reusing cached Deepgram client");
        client = clientCache.client;
      } else {
        // Create a new Deepgram client
        const deepgramClient = new Deepgram(apiKey);
        client = deepgramClient.listen.live(createDeepgramOptions());
        clientCache = { client, apiKey };
      }

      if (onStatusChange) {
        onStatusChange('connecting');
      }

      // Set up client event listeners
      setupClientEventHandlers(client);
      
      return client;
    } catch (error) {
      console.error("Error creating Deepgram client:", error);
      if (onStatusChange) {
        onStatusChange('failed');
      }
      return null;
    }
  };

  const setupClientEventHandlers = (client: LiveClient) => {
    if (!client) return;

    client.removeAllListeners();

    client.on(LiveTranscriptionEvent.Open, () => {
      console.log("Deepgram connection opened");
      if (onStatusChange) {
        onStatusChange('open');
      }
      reconnectAttempts = 0;
    });

    client.on(LiveTranscriptionEvent.Transcript, (data: LiveTranscriptionResponse) => {
      try {
        if (!data?.channel?.alternatives?.length) return;
        
        const transcript = data.channel.alternatives[0].transcript;
        
        // Extract topics if available
        let topics: string[] | undefined;
        if (data.channel.topics && data.channel.topics.topics) {
          topics = data.channel.topics.topics.map((t: any) => t.topic);
        }
        
        if (transcript.trim() === '') {
          return; // Skip empty results
        }
        
        // Determine speaker if diarization is available
        let speakerTag: number | undefined;
        if (data.channel.alternatives[0].words && data.channel.alternatives[0].words.length > 0) {
          const firstWord = data.channel.alternatives[0].words[0];
          if (firstWord.speaker !== undefined) {
            speakerTag = parseInt(firstWord.speaker) + 1; // We add 1 to match our expected speaker numbering
          }
        }
        
        // Send result to callback
        onResult({
          transcript,
          isFinal: data.is_final || false,
          resultIndex: Date.now(), // Use timestamp as unique ID
          speakerTag,
          topics
        });
      } catch (error) {
        console.error("Error processing Deepgram transcript:", error);
      }
    });

    client.on(LiveTranscriptionEvent.Error, (error) => {
      console.error("Deepgram error:", error);
      if (onStatusChange) {
        onStatusChange('failed');
      }
      // Try to reconnect on error
      reconnect();
    });

    client.on(LiveTranscriptionEvent.Close, () => {
      console.log("Deepgram connection closed");
      if (onStatusChange) {
        onStatusChange('closed');
      }
      // Try to reconnect on close unless we're finishing normally
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnect();
      }
    });

    client.on(LiveTranscriptionEvent.Warning, (warning) => {
      console.warn("Deepgram warning:", warning);
    });
  };
  
  // Function to handle reconnection
  const reconnect = () => {
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.error("Maximum reconnection attempts reached");
      if (onStatusChange) {
        onStatusChange('failed');
      }
      return;
    }
    
    reconnectAttempts++;
    console.log(`Attempting to reconnect to Deepgram (attempt ${reconnectAttempts})`);
    
    // Clear any existing timeout
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
    
    reconnectTimeout = setTimeout(() => {
      if (client) {
        try {
          client.finish();
        } catch (e) {
          // Ignore errors when finishing
        }
      }
      
      client = setupNewClient();
    }, 1000 * Math.min(reconnectAttempts, 3)); // Exponential backoff up to 3 seconds
  };
  
  // If no existing client, create one
  if (!client) {
    client = setupNewClient();
  } else {
    console.log("Using existing Deepgram connection");
    // Make sure existing client events are set up correctly
    setupClientEventHandlers(client);
    
    // Check client connection status
    if (client.getReadyState() === 1) { // 1 = OPEN
      if (onStatusChange) {
        onStatusChange('open');
      }
    } else if (client.getReadyState() === 0) { // 0 = CONNECTING
      if (onStatusChange) {
        onStatusChange('connecting');
      }
    } else {
      // If client is in a bad state, create a new one
      try {
        client.finish();
      } catch (e) {
        // Ignore errors when finishing
      }
      client = setupNewClient();
    }
  }
  
  // Audio processing function for sending data to Deepgram
  processor.onaudioprocess = (e) => {
    if (client && client.getReadyState() === 1) { // 1 = OPEN
      // Get audio data
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Convert float32 to int16
      const int16Array = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        int16Array[i] = inputData[i] * 32767;
      }
      
      // Send audio data to Deepgram
      try {
        client.send(int16Array.buffer);
      } catch (error) {
        console.error("Error sending audio data to Deepgram:", error);
      }
    }
  };
  
  // Return cleanup function
  return () => {
    try {
      // Clear reconnect timeout
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      
      // Disconnect audio processing
      if (source && processor) {
        source.disconnect(processor);
        processor.disconnect(audioContext.destination);
      }
      
      // Close audio context
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
      
      // Close Deepgram connection
      if (client) {
        try {
          client.finish();
        } catch (e) {
          // Ignore errors when finishing
        }
      }
      
      client = null;
      console.log("Deepgram connection cleaned up");
    } catch (error) {
      console.error("Error cleaning up Deepgram resources:", error);
    }
  };
};

// Helper function for speaker labels
export const getSpeakerLabel = (speakerTag?: number): string => {
  if (speakerTag === undefined) return '';
  return speakerTag === 1 ? 'Doctor' : 'Patient';
};
