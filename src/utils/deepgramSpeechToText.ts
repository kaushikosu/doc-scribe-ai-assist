
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

// Create Deepgram WebSocket URL with options
const createDeepgramUrl = () => {
  return "wss://api.deepgram.com/v1/listen?" + 
    "encoding=linear16&" +
    "sample_rate=16000&" +
    "channels=1&" +
    "model=nova-2&" +
    "smart_format=true&" +
    "filler_words=false&" +
    "diarize=true&" + // Enable diarization
    "punctuate=true&" + // Enable punctuation
    "paragraphs=true&" + // Enable paragraphs
    "utterances=true&" + // Enable utterances
    "topics=medicine,symptoms,doctor,patient"; // Enable topic detection with custom topics
};

// Function to preconnect to Deepgram - establishes connection early
export const preconnectToDeepgram = (
  apiKey: string,
  onStatusChange?: (status: ConnectionStatus) => void
): { socket: WebSocket | null; status: ConnectionStatus } => {
  console.log("Pre-connecting to Deepgram...");
  
  try {
    // Create a socket
    const deepgramUrl = createDeepgramUrl();
    const socket = new WebSocket(deepgramUrl);
    
    if (onStatusChange) {
      onStatusChange('connecting');
    }
    
    socket.onopen = () => {
      console.log("Deepgram WebSocket opened, sending API key");
      
      // Send authentication message
      socket.send(JSON.stringify({
        type: "Authorization",
        token: apiKey
      }));
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Check if this is a connection confirmation
        if (data.type === "ConnectionEstablished") {
          console.log("Deepgram preconnected successfully");
          if (onStatusChange) {
            onStatusChange('open');
          }
          return;
        }
      } catch (error) {
        console.error("Error parsing Deepgram response:", error);
      }
    };
    
    socket.onerror = (error) => {
      console.error("Deepgram WebSocket error:", error);
      if (onStatusChange) {
        onStatusChange('failed');
      }
    };
    
    socket.onclose = (event) => {
      console.log(`Deepgram WebSocket closed: ${event.code} - ${event.reason}`);
      if (onStatusChange) {
        onStatusChange('closed');
      }
    };
    
    return { socket, status: 'connecting' };
  } catch (error) {
    console.error("Error pre-connecting to Deepgram:", error);
    if (onStatusChange) {
      onStatusChange('failed');
    }
    return { socket: null, status: 'failed' };
  }
};

// Function to disconnect from Deepgram
export const disconnectDeepgram = (socket: WebSocket): void => {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    socket.close(1000, "User ended session");
    console.log("Deepgram connection closed");
  }
};

// Main function to stream audio to Deepgram
export const streamAudioToDeepgram = (
  stream: MediaStream, 
  apiKey: string,
  onResult: (result: DeepgramResult) => void,
  onStatusChange?: (status: ConnectionStatus) => void,
  existingSocket?: WebSocket | null
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

  // Use existing socket or create a new one
  let socket: WebSocket | null = existingSocket || null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  let reconnectTimeout: NodeJS.Timeout | null = null;

  // Function to create socket if we don't have an existing one
  const setupNewSocket = () => {
    try {
      // Create WebSocket URL
      const deepgramUrl = createDeepgramUrl();
      
      // Create a new WebSocket
      const ws = new WebSocket(deepgramUrl);
      
      if (onStatusChange) {
        onStatusChange('connecting');
      }
      
      // Set up socket event handlers
      ws.onopen = () => {
        console.log("Deepgram WebSocket opened, sending API key");
        
        // Send authentication message after connection is established
        ws.send(JSON.stringify({
          type: "Authorization",
          token: apiKey
        }));
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Check if this is a connection confirmation
          if (data.type === "ConnectionEstablished") {
            console.log("Deepgram authenticated successfully");
            if (onStatusChange) {
              onStatusChange('open');
            }
            reconnectAttempts = 0;
            return;
          }
          
          // Process transcriptions
          if (data.channel && data.channel.alternatives && data.channel.alternatives.length > 0) {
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
          }
        } catch (error) {
          console.error("Error parsing Deepgram response:", error);
        }
      };
      
      // Handle errors
      ws.onerror = (error) => {
        console.error("Deepgram WebSocket error:", error);
        if (onStatusChange) {
          onStatusChange('failed');
        }
      };
      
      // Handle socket closure
      ws.onclose = (event) => {
        console.log("Deepgram WebSocket closed", event.code, event.reason);
        if (onStatusChange) {
          onStatusChange('closed');
        }
        
        // Don't reconnect if it was a normal closure (code 1000)
        if (event.code !== 1000) {
          reconnect();
        }
      };
      
      return ws;
    } catch (error) {
      console.error("Error creating WebSocket:", error);
      if (onStatusChange) {
        onStatusChange('failed');
      }
      return null;
    }
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
      if (socket) {
        socket.close();
      }
      
      socket = setupNewSocket();
    }, 1000 * Math.min(reconnectAttempts, 3)); // Exponential backoff up to 3 seconds
  };
  
  // If no existing socket, create one
  if (!socket) {
    socket = setupNewSocket();
  } else {
    console.log("Using existing Deepgram connection");
    // Make sure existing socket is ready for audio
    if (socket.readyState === WebSocket.OPEN) {
      if (onStatusChange) {
        onStatusChange('open');
      }
    } else if (socket.readyState === WebSocket.CONNECTING) {
      if (onStatusChange) {
        onStatusChange('connecting');
      }
    } else {
      // If socket is in a bad state, create a new one
      socket.close();
      socket = setupNewSocket();
    }
  }
  
  // Audio processing function for sending data to Deepgram
  processor.onaudioprocess = (e) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      // Get audio data
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Convert float32 to int16
      const int16Array = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        int16Array[i] = inputData[i] * 32767;
      }
      
      // Send audio data to Deepgram
      socket.send(int16Array.buffer);
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
      
      // Close WebSocket
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close(1000, "User ended session"); // Use code 1000 for normal closure
      }
      
      socket = null;
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
