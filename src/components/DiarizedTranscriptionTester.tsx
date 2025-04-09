
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  FileAudio, 
  RotateCw, 
  Download 
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { 
  runDiarizedTranscriptionTest, 
  loadAudioFile, 
  testDirectGoogleSpeechAPI 
} from '@/utils/tests/diarizedTranscriptionTest';
import { formatDiarizedTranscript } from '@/utils/diarizedTranscription';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

// Sample test cases with 2-minute audio files
// These would need to be actual files in your public directory
const TEST_CASES = [
  {
    name: "Short recording (15s)",
    file: "/test-audio/short-recording.webm",
    duration: 15
  },
  {
    name: "Medium recording (1 min)",
    file: "/test-audio/medium-recording.webm",
    duration: 60
  },
  {
    name: "Long recording (2 min)",
    file: "/test-audio/long-recording.webm",
    duration: 120
  }
];

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  transcript?: string;
  error?: string;
  words?: number;
  speakers?: number;
  parts?: number;
  progress: number;
  duration?: number;
}

interface DiarizedTranscriptionTesterProps {
  apiKey: string;
}

const DiarizedTranscriptionTester: React.FC<DiarizedTranscriptionTesterProps> = ({ apiKey }) => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [useRealMicrophone, setUseRealMicrophone] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(30); // Default 30 seconds

  // Generate blob from microphone recording
  const recordAudio = async (duration: number): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });
        const audioChunks: Blob[] = [];
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          
          // Stop all tracks
          stream.getTracks().forEach(track => track.stop());
          
          if (audioBlob.size === 0) {
            reject(new Error("No audio data was recorded"));
          } else {
            resolve(audioBlob);
          }
        };
        
        // Start recording
        mediaRecorder.start(1000);
        toast.success(`Recording for ${duration} seconds...`);
        
        // Stop after duration
        setTimeout(() => {
          if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
        }, duration * 1000);
      } catch (error) {
        toast.error("Failed to access microphone");
        reject(error);
      }
    });
  };

  // Run a single test
  const runSingleTest = async (test: typeof TEST_CASES[0]) => {
    if (!apiKey) {
      toast.error("Please enter your Google API key first");
      return;
    }

    // Update test status to running
    setTestResults(prev => [
      ...prev,
      {
        name: test.name,
        status: 'running',
        progress: 0
      }
    ]);

    try {
      let audioBlob: Blob;
      
      if (useRealMicrophone) {
        // Record from microphone
        toast.info(`Recording test audio (${recordingDuration}s)...`);
        audioBlob = await recordAudio(recordingDuration);
        toast.success("Recording complete");
      } else {
        // Load test file
        audioBlob = await loadAudioFile(test.file);
      }

      // Update progress
      const updateTestProgress = (progress: number) => {
        setTestResults(prev => 
          prev.map(result => 
            result.name === test.name 
              ? { ...result, progress } 
              : result
          )
        );
      };

      // Run the test
      const result = await runDiarizedTranscriptionTest({
        apiKey,
        testFilePath: test.file,
        expectedDuration: test.duration,
        onProgress: updateTestProgress,
        onError: (error) => {
          setTestResults(prev => 
            prev.map(result => 
              result.name === test.name 
                ? { 
                    ...result, 
                    status: 'error',
                    error: error.message,
                    progress: 1
                  } 
                : result
            )
          );
        }
      });

      // Update with results
      setTestResults(prev => 
        prev.map(testResult => 
          testResult.name === test.name 
            ? { 
                ...testResult, 
                status: result.error ? 'error' : 'success',
                transcript: result.transcript,
                error: result.error,
                words: result.words?.length || 0,
                speakers: result.speakerCount,
                parts: result.audioParts?.length || 0,
                progress: 1,
                duration: useRealMicrophone ? recordingDuration : test.duration
              } 
            : testResult
        )
      );
      
      if (result.error) {
        toast.error(`Test "${test.name}" completed with errors`);
      } else {
        toast.success(`Test "${test.name}" completed successfully`);
      }
      
    } catch (error: any) {
      console.error("Test failed:", error);
      setTestResults(prev => 
        prev.map(result => 
          result.name === test.name 
            ? { 
                ...result, 
                status: 'error',
                error: error.message,
                progress: 1
              } 
            : result
        )
      );
      toast.error(`Test "${test.name}" failed: ${error.message}`);
    }
  };

  // Run all tests sequentially
  const runAllTests = async () => {
    if (!apiKey) {
      toast.error("Please enter your Google API key first");
      return;
    }

    setIsRunningTests(true);
    setTestResults([]);

    try {
      if (useRealMicrophone) {
        // Just run one test with microphone
        await runSingleTest({
          name: `Live microphone test (${recordingDuration}s)`,
          file: "", // Not used
          duration: recordingDuration
        });
      } else {
        // Run each test sequentially
        for (const test of TEST_CASES) {
          await runSingleTest(test);
        }
      }
    } finally {
      setIsRunningTests(false);
    }
  };

  const downloadTestRecording = () => {
    if (useRealMicrophone) {
      recordAudio(recordingDuration).then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `test-recording-${recordingDuration}s.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Test recording saved (${blob.size} bytes)`);
      }).catch(error => {
        toast.error(`Failed to record: ${error.message}`);
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <div className="text-doctor-primary">Diarized Transcription Tester</div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              disabled={isRunningTests}
              onClick={() => setUseRealMicrophone(!useRealMicrophone)}
            >
              {useRealMicrophone ? 'Use Test Files' : 'Use Microphone'}
            </Button>
            <Button 
              size="sm" 
              onClick={runAllTests} 
              disabled={isRunningTests || !apiKey}
              className="bg-doctor-primary text-white"
            >
              {isRunningTests ? (
                <>
                  <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : 'Run Tests'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!apiKey && (
          <Alert className="mb-4 border-amber-400 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <AlertTitle>API Key Required</AlertTitle>
            <AlertDescription>
              Please set your Google Speech API key to run tests.
            </AlertDescription>
          </Alert>
        )}
        
        {useRealMicrophone && (
          <div className="mb-4 flex flex-col gap-2">
            <label className="font-medium">Test Recording Duration (seconds):</label>
            <div className="flex gap-2 items-center">
              <input 
                type="range" 
                min="5" 
                max="120" 
                value={recordingDuration} 
                onChange={(e) => setRecordingDuration(parseInt(e.target.value))} 
                className="w-full"
              />
              <div className="w-12 text-right">{recordingDuration}s</div>
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={downloadTestRecording} 
                disabled={isRunningTests}
              >
                <Download className="h-4 w-4 mr-2" />
                Test Recording
              </Button>
            </div>
          </div>
        )}
        
        <div className="space-y-4">
          {testResults.length === 0 && !isRunningTests ? (
            <div className="p-4 text-center text-muted-foreground">
              No tests have been run yet. Click "Run Tests" to start testing.
            </div>
          ) : (
            testResults.map((result, index) => (
              <div key={index} className="border rounded-md p-3">
                <div className="flex justify-between items-center mb-2">
                  <div className="font-medium flex items-center gap-2">
                    {result.status === 'pending' && <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                    {result.status === 'running' && <RotateCw className="h-4 w-4 text-amber-500 animate-spin" />}
                    {result.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {result.status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                    {result.name}
                    {result.duration && <span className="text-xs text-muted-foreground">({result.duration}s)</span>}
                  </div>
                  <div className="text-sm">
                    {result.status === 'success' && (
                      <span className="text-green-500 font-medium">Success</span>
                    )}
                    {result.status === 'error' && (
                      <span className="text-red-500 font-medium">Failed</span>
                    )}
                    {(result.status === 'pending' || result.status === 'running') && (
                      <span className="text-amber-500 font-medium">
                        {result.status === 'pending' ? 'Pending' : 'Running'}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Progress bar */}
                <Progress value={result.progress * 100} className="h-2 mb-2" />
                
                {/* Results */}
                {result.status === 'success' || result.status === 'error' ? (
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="results">
                      <AccordionTrigger className="text-sm font-normal">
                        View Results
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3">
                          {result.status === 'error' && result.error && (
                            <Alert variant="destructive" className="mb-2">
                              <AlertCircle className="h-4 w-4" />
                              <AlertTitle>Error</AlertTitle>
                              <AlertDescription>{result.error}</AlertDescription>
                            </Alert>
                          )}
                          
                          {result.status === 'success' && (
                            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                              <div><strong>Words:</strong> {result.words}</div>
                              <div><strong>Speakers:</strong> {result.speakers}</div>
                              <div><strong>Audio Parts:</strong> {result.parts}</div>
                              {result.transcript !== undefined && (
                                <div><strong>Transcript Length:</strong> {result.transcript.length} chars</div>
                              )}
                            </div>
                          )}
                          
                          {result.transcript && (
                            <div>
                              <div className="font-medium mb-1 text-sm">Transcript:</div>
                              <div className="p-2 bg-gray-50 rounded text-sm overflow-auto max-h-40">
                                {result.transcript.split('\n').map((line, i) => (
                                  <div key={i}>{line}</div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                ) : null}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DiarizedTranscriptionTester;
