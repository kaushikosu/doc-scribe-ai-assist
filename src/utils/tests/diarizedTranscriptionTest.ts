
import { toast } from "@/lib/toast";
import { processMediaStream } from "@/utils/googleSpeechToText";
import { getDiarizedTranscription, DiarizedTranscription } from "@/utils/diarizedTranscription";
import { AudioPart } from "@/components/DiarizedTranscriptView";

// Test configuration
interface TestConfig {
  apiKey: string;
  testFilePath: string;
  expectedDuration: number; // in seconds
  speakerCount?: number;
  onComplete?: (result: DiarizedTranscription) => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: number) => void;
  onPartStatusUpdate?: (parts: AudioPart[]) => void;
}

/**
 * Load an audio file from the given path and return it as a Blob
 */
export const loadAudioFile = (filePath: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    fetch(filePath)
      .then((response) => {
        if (!response.ok) {
          reject(new Error(`Failed to load audio file: ${response.status} ${response.statusText}`));
          return;
        }
        return response.blob();
      })
      .then((blob) => {
        if (!blob) {
          reject(new Error("Failed to convert response to blob"));
          return;
        }
        resolve(blob);
      })
      .catch(reject);
  });
};

/**
 * Run a diarized transcription test with the specified configuration
 */
export const runDiarizedTranscriptionTest = async (config: TestConfig): Promise<DiarizedTranscription> => {
  const {
    apiKey,
    testFilePath,
    expectedDuration,
    speakerCount = 2,
    onComplete,
    onError,
    onProgress,
    onPartStatusUpdate
  } = config;

  if (!apiKey) {
    const error = new Error("API key is required for testing");
    if (onError) onError(error);
    toast.error("API key is required for testing");
    throw error;
  }

  console.log(`Starting test with audio file: ${testFilePath}`);
  console.log(`Expected duration: ${expectedDuration} seconds`);
  
  // Choose appropriate API based on duration
  const useLongRunningAPI = expectedDuration > 60;
  console.log(`Using ${useLongRunningAPI ? 'LongRunningRecognize' : 'Synchronous'} API based on expected duration`);

  try {
    // Load the test audio file
    console.log("Loading test audio file...");
    const audioBlob = await loadAudioFile(testFilePath);
    console.log(`Loaded audio file: ${audioBlob.size} bytes, type: ${audioBlob.type}`);

    // Keep track of audio parts for monitoring
    const parts: AudioPart[] = [];
    
    // Process the audio file with diarization
    const result = await getDiarizedTranscription({
      apiKey,
      audioBlob,
      speakerCount,
      onPartProcessing: (part) => {
        console.log(`[Test] Processing part ${part.id}: ${part.size} bytes, status: ${part.status}`);
        
        // Update or add the part to our tracking array
        const existingIndex = parts.findIndex(p => p.id === part.id);
        if (existingIndex >= 0) {
          parts[existingIndex] = part;
        } else {
          parts.push(part);
        }
        
        if (onPartStatusUpdate) {
          onPartStatusUpdate([...parts]);
        }
        
        const processedParts = parts.filter(p => p.status !== 'pending').length;
        if (onProgress) onProgress(processedParts / parts.length);
      },
      onPartComplete: (part) => {
        console.log(`[Test] Part ${part.id} completed: ${part.transcript ? 'Has transcript' : 'No transcript'}`);
        
        // Update the part status in our tracking array
        const existingIndex = parts.findIndex(p => p.id === part.id);
        if (existingIndex >= 0) {
          parts[existingIndex] = part;
        }
        
        if (onPartStatusUpdate) {
          onPartStatusUpdate([...parts]);
        }
      },
      onPartError: (part) => {
        console.error(`[Test] Error in part ${part.id}: ${part.error}`);
        
        // Update the part status in our tracking array
        const existingIndex = parts.findIndex(p => p.id === part.id);
        if (existingIndex >= 0) {
          parts[existingIndex] = part;
        }
        
        if (onPartStatusUpdate) {
          onPartStatusUpdate([...parts]);
        }
      }
    });

    console.log("Test completed successfully!");
    console.log(`Transcript length: ${result.transcript?.length || 0} characters`);
    console.log(`Words detected: ${result.words?.length || 0}`);
    console.log(`Speaker count: ${result.speakerCount}`);
    
    if (result.audioParts) {
      console.log(`Audio parts: ${result.audioParts.length}`);
      const completedParts = result.audioParts.filter(part => part.status === 'completed').length;
      const errorParts = result.audioParts.filter(part => part.status === 'error').length;
      console.log(`Completed parts: ${completedParts}, Error parts: ${errorParts}`);
    }

    if (result.error) {
      console.error("Test completed with error:", result.error);
    }

    if (onComplete) {
      onComplete(result);
    }

    return result;
  } catch (error) {
    console.error("Test failed:", error);
    if (onError && error instanceof Error) {
      onError(error);
    }
    throw error;
  }
};

/**
 * Run a direct Google Speech API test on a single audio blob
 */
export const testDirectGoogleSpeechAPI = async (
  audioBlob: Blob, 
  apiKey: string
): Promise<boolean> => {
  try {
    console.log(`Testing direct Google Speech API with ${audioBlob.size} bytes`);
    const results = await processMediaStream(audioBlob, apiKey);
    
    console.log(`Direct API test results: ${results.length} items`);
    results.forEach((result, index) => {
      console.log(`Result ${index + 1}: ${result.transcript ? 'Has transcript' : 'No transcript'}`);
      if (result.error) {
        console.error(`Error in result ${index + 1}: ${result.error}`);
      }
    });

    const success = results.some(result => result.transcript && !result.error);
    console.log(`Direct API test ${success ? 'succeeded' : 'failed'}`);
    return success;
  } catch (error) {
    console.error("Direct API test failed:", error);
    return false;
  }
};
