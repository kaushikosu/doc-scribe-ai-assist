
// Define types for Deepgram responses
export interface DeepgramResult {
  transcript: string;
  isFinal: boolean;
  resultIndex: number;
  speakerTag?: number;
  error?: string;
}

// WebSocket connection status
export type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'failed';

// Main function to stream audio to Deepgram
export const streamAudioToDeepgram = (
  stream: MediaStream, 
  apiKey: string,
  onResult: (result: DeepgramResult) => void,
  onStatusChange?: (status: ConnectionStatus) => void
): (() => void) => {
  console.log("Setting up Deepgram connection...");
  
  // Create Deepgram WebSocket URL with options
  const deepgramUrl = "wss://api.deepgram.com/v1/listen?" + 
    "encoding=linear16&" +
    "sample_rate=16000&" +
    "channels=1&" +
    "model=nova-2&" +
    "smart_format=true&" +
    "filler_words=false&" +
    "diarize=true"; // Enable diarization
    
  // Create WebSocket connection
  let socket: WebSocket | null = new WebSocket(deepgramUrl);
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  let reconnectTimeout: NodeJS.Timeout | null = null;
  
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

  // Function to handle reconnection
  const reconnect = () => {
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.error("Maximum reconnection attempts reached");
      onStatusChange?.('failed');
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
      
      socket = new WebSocket(deepgramUrl);
      setupSocketHandlers();
      onStatusChange?.('connecting');
    }, 1000 * Math.min(reconnectAttempts, 3)); // Exponential backoff up to 3 seconds
  };
  
  // Setup socket event handlers
  const setupSocketHandlers = () => {
    if (!socket) return;
    
    // Set authorization header once the socket is open
    socket.onopen = () => {
      socket?.send(JSON.stringify({
        "token": apiKey
      }));
      
      console.log("Deepgram WebSocket connected");
      reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      onStatusChange?.('open');
    };
    
    // Handle socket messages (transcription results)
    socket.onmessage = (event) => {
      try {
        // Parse result from Deepgram
        const result = JSON.parse(event.data);
        
        // Check for valid transcription
        if (result.channel && result.channel.alternatives && result.channel.alternatives.length > 0) {
          const transcript = result.channel.alternatives[0].transcript;
          
          if (transcript.trim() === '') {
            return; // Skip empty results
          }
          
          // Determine speaker if diarization is available
          let speakerTag: number | undefined;
          if (result.channel.alternatives[0].words && result.channel.alternatives[0].words.length > 0) {
            const firstWord = result.channel.alternatives[0].words[0];
            if (firstWord.speaker !== undefined) {
              speakerTag = parseInt(firstWord.speaker) + 1; // We add 1 to match our expected speaker numbering
            }
          }
          
          // Send result to callback
          onResult({
            transcript,
            isFinal: result.is_final || false,
            resultIndex: Date.now(), // Use timestamp as unique ID
            speakerTag
          });
        }
      } catch (error) {
        console.error("Error parsing Deepgram response:", error);
      }
    };
    
    // Handle errors
    socket.onerror = (error) => {
      console.error("Deepgram WebSocket error:", error);
      // Don't immediately fail - try to reconnect
      reconnect();
    };
    
    // Handle socket closure
    socket.onclose = (event) => {
      console.log("Deepgram WebSocket closed", event.code, event.reason);
      onStatusChange?.('closed');
      
      // Don't reconnect if it was a normal closure
      if (event.code !== 1000) {
        reconnect();
      }
    };
  };
  
  // Set up socket handlers initially
  setupSocketHandlers();
  onStatusChange?.('connecting');
  
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
        socket.close();
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
