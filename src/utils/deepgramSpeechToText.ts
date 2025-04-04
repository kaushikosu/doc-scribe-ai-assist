
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
  const socket = new WebSocket(deepgramUrl);
  
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
  
  // Set authorization header once the socket is open
  socket.onopen = () => {
    socket.send(JSON.stringify({
      "token": apiKey
    }));
    
    console.log("Deepgram WebSocket connected");
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
      onResult({
        transcript: "",
        isFinal: true,
        resultIndex: Date.now(),
        error: "Failed to parse transcription result"
      });
    }
  };
  
  // Handle errors
  socket.onerror = (error) => {
    console.error("Deepgram WebSocket error:", error);
    onStatusChange?.('failed');
    onResult({
      transcript: "",
      isFinal: true,
      resultIndex: Date.now(),
      error: "Deepgram connection error"
    });
  };
  
  // Handle socket closure
  socket.onclose = (event) => {
    console.log("Deepgram WebSocket closed", event.code, event.reason);
    onStatusChange?.('closed');
  };
  
  // Audio processing function for sending data to Deepgram
  processor.onaudioprocess = (e) => {
    if (socket.readyState === WebSocket.OPEN) {
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
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
      
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
