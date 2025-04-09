import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import VoiceRecorder from '@/components/VoiceRecorder';
import TranscriptEditor from '@/components/TranscriptEditor';
import PrescriptionGenerator from '@/components/PrescriptionGenerator';
import DocHeader from '@/components/DocHeader';
import { Toaster } from '@/components/ui/sonner';
import { classifyTranscript } from '@/utils/speaker';
import { toast } from '@/lib/toast';
import useAudioRecorder from '@/hooks/useAudioRecorder';
import DiarizedTranscriptView, { AudioPart } from '@/components/DiarizedTranscriptView';
import { getDiarizedTranscription, DiarizedTranscription } from '@/utils/diarizedTranscription';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DiarizedTranscriptionTester from '@/components/DiarizedTranscriptionTester';

const DashboardPage = () => {
  const [transcript, setTranscript] = useState('');
  const [classifiedTranscript, setClassifiedTranscript] = useState('');
  const [patientInfo, setPatientInfo] = useState({
    name: '',
    time: ''
  });
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingTranscript, setIsProcessingTranscript] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  
  const [isDiarizing, setIsDiarizing] = useState(false);
  const [diarizedTranscription, setDiarizedTranscription] = useState<DiarizedTranscription | null>(null);
  const [audioParts, setAudioParts] = useState<AudioPart[]>([]);
  const [showTester, setShowTester] = useState(false);
  
  const lastProcessedTranscriptRef = useRef('');
  const mountedRef = useRef(true);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const audioProcessedRef = useRef<boolean>(false);
  
  const googleApiKey = import.meta.env.VITE_GOOGLE_SPEECH_API_KEY;
  
  const {
    isRecording: isAudioRecording,
    recordingDuration,
    formattedDuration,
    startRecording: startAudioRecording,
    stopRecording: stopAudioRecording,
    audioBlob,
    resetRecording
  } = useAudioRecorder({
    onRecordingComplete: (blob) => {
      console.log("Full audio recording complete:", blob.size, "bytes");
      if (blob.size > 0) {
        processDiarizedTranscription(blob);
      }
    }
  });
  
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    console.log("Transcript updated in DashboardPage:", transcript);
  }, [transcript]);
  
  useEffect(() => {
    if (!isRecording && transcript && transcript !== lastProcessedTranscriptRef.current) {
      console.log("Recording stopped, auto-classifying transcript");
      handleTranscriptClassification();
    }
  }, [isRecording, transcript]);
  
  useEffect(() => {
    if (isRecording) {
      audioProcessedRef.current = false;
      
      if (!isAudioRecording) {
        console.log("Starting full audio recording for diarization");
        startAudioRecording();
      }
    } else if (!isRecording && isAudioRecording) {
      console.log("Stopping full audio recording and processing for diarization");
      stopAudioRecording();
      if (!transcript) {
        setDiarizedTranscription(null);
        setAudioParts([]);
      }
    }
  }, [isRecording, isAudioRecording, startAudioRecording, stopAudioRecording, transcript]);

  useEffect(() => {
    if (isDiarizing && audioParts.length > 0) {
      const allPartsCompleted = audioParts.every(
        part => part.status === 'completed' || part.status === 'error'
      );
      
      if (allPartsCompleted) {
        console.log("All audio parts have been processed, updating status");
        const successfulParts = audioParts.filter(
          part => part.status === 'completed' && part.transcript
        );
        
        if (successfulParts.length > 0) {
          toast.success(`Audio processing complete (${successfulParts.length} parts with speech)`);
          audioProcessedRef.current = true;
        } else {
          toast.info("Audio processing complete, no speech detected");
        }
        
        setTimeout(() => {
          if (mountedRef.current) {
            setIsDiarizing(false);
            setIsProcessingTranscript(false);
            isProcessingRef.current = false;
          }
        }, 1000);
      }
    }
  }, [audioParts, isDiarizing]);

  const handleTranscriptClassification = useCallback(() => {
    if (!transcript || transcript.trim().length === 0 || transcript === lastProcessedTranscriptRef.current) {
      return;
    }
    
    setIsClassifying(true);
    
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }
    
    timeoutIdRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      
      try {
        const classified = classifyTranscript(transcript);
        lastProcessedTranscriptRef.current = transcript;
        
        if (mountedRef.current) {
          setClassifiedTranscript(classified);
          setIsClassifying(false);
          console.log("Transcript classified successfully");
        }
      } catch (error) {
        console.error("Error classifying transcript:", error);
        if (mountedRef.current) {
          setIsClassifying(false);
          toast.error("Failed to classify transcript");
        }
      }
    }, 800);
  }, [transcript]);

  const handlePartProcessing = (part: AudioPart) => {
    if (!mountedRef.current) return;
    
    console.log(`Audio part ${part.id} processing started`);
    setAudioParts(current => {
      const existingPartIndex = current.findIndex(p => p.id === part.id);
      if (existingPartIndex >= 0) {
        const updated = [...current];
        updated[existingPartIndex] = {...part};
        return updated;
      } else {
        return [...current, part];
      }
    });
  };
  
  const handlePartComplete = (part: AudioPart) => {
    if (!mountedRef.current) return;
    
    console.log(`Audio part ${part.id} processing completed`);
    setAudioParts(current => {
      const existingPartIndex = current.findIndex(p => p.id === part.id);
      if (existingPartIndex >= 0) {
        const updated = [...current];
        updated[existingPartIndex] = {...part};
        return updated;
      } else {
        return [...current, part];
      }
    });
    
    if (part.transcript) {
      toast.success(`Part ${part.id} transcription completed`);
    } else {
      toast.info(`Part ${part.id} processed (no speech detected)`);
    }
  };
  
  const handlePartError = (part: AudioPart) => {
    if (!mountedRef.current) return;
    
    console.log(`Audio part ${part.id} processing failed: ${part.error}`);
    setAudioParts(current => {
      const existingPartIndex = current.findIndex(p => p.id === part.id);
      if (existingPartIndex >= 0) {
        const updated = [...current];
        updated[existingPartIndex] = {...part};
        return updated;
      } else {
        return [...current, part];
      }
    });
    
    toast.error(`Part ${part.id} transcription failed: ${part.error}`);
  };
  
  const processDiarizedTranscription = async (audioBlob: Blob) => {
    if (!googleApiKey) {
      console.error("Google Speech API key is missing");
      toast.error("Google Speech API key is not configured");
      return;
    }
    
    if (!audioBlob || audioBlob.size === 0) {
      console.error("No audio data to process");
      toast.error("No audio recorded for diarization");
      return;
    }
    
    console.log("Processing audio blob for diarization:", audioBlob.size, "bytes");
    setIsDiarizing(true);
    setIsProcessingTranscript(true);
    isProcessingRef.current = true;
    setAudioParts([]); // Reset audio parts
    toast.info("Processing full audio for diarized transcription...");
    
    try {
      handlePartProcessing({
        id: 1,
        blob: audioBlob,
        size: audioBlob.size,
        duration: estimateDuration(audioBlob.size),
        status: 'processing'
      });
      
      const result = await getDiarizedTranscription({
        apiKey: googleApiKey,
        audioBlob,
        speakerCount: 2,
        onPartProcessing: handlePartProcessing,
        onPartComplete: handlePartComplete,
        onPartError: handlePartError
      });
      
      if (mountedRef.current) {
        console.log("Diarization complete:", result);
        setDiarizedTranscription(result);
        
        if (result.audioParts) {
          setAudioParts(result.audioParts);
        }
        
        if (result.error) {
          toast.error("Diarization error: " + result.error);
        } else if (result.words.length === 0) {
          const completedParts = result.audioParts?.filter(p => p.status === 'completed') || [];
          const partsWithTranscripts = completedParts.filter(p => p.transcript && p.transcript.trim().length > 0);
          
          if (partsWithTranscripts.length > 0) {
            toast.success(`Diarization complete with ${partsWithTranscripts.length} audio parts transcribed`);
            audioProcessedRef.current = true;
          } else {
            toast.warning("No speech detected in the audio");
          }
          
          console.log(`- Completed parts: ${completedParts.length}`);
          console.log(`- Parts with transcripts: ${partsWithTranscripts.length}`);
        } else {
          toast.success(`Diarized transcription complete (${result.speakerCount} speakers detected)`);
          audioProcessedRef.current = true;
        }
      }
    } catch (error: any) {
      console.error("Error in diarized transcription:", error);
      if (mountedRef.current) {
        setDiarizedTranscription({
          transcript: "",
          words: [],
          speakerCount: 0,
          error: error.message
        });
        toast.error("Failed to process diarized transcription");
      }
    } finally {
      if (mountedRef.current) {
        setTimeout(() => {
          if (mountedRef.current) {
            setIsDiarizing(false);
            setIsProcessingTranscript(false);
            isProcessingRef.current = false;
          }
        }, 1000);
      }
    }
  };
  
  const estimateDuration = (sizeInBytes: number): number => {
    return Math.max(1, Math.round(sizeInBytes / 12000));
  };

  const handleTranscriptUpdate = (newTranscript: string) => {
    console.log("handleTranscriptUpdate called with:", newTranscript?.length);
    if (newTranscript !== undefined) {
      setTranscript(newTranscript);
    }
  };

  const handlePatientInfoUpdate = (newPatientInfo: { name: string; time: string }) => {
    setPatientInfo(newPatientInfo);
  };
  
  const handleRecordingStateChange = (recordingState: boolean) => {
    console.log("Recording state changed to:", recordingState);
    setIsRecording(recordingState);
    
    if (!recordingState && transcript) {
      toast.info('Processing transcript...');
    }
  };
  
  const handleProcessingStateChange = (processingState: boolean) => {
    console.log("Processing state changed to:", processingState);
    setIsProcessingTranscript(processingState);
  };
  
  const handleNewPatient = () => {
    console.log("New patient session initiated, resetting all states");
    
    setTranscript('');
    setClassifiedTranscript('');
    setPatientInfo({ name: '', time: '' });
    setIsClassifying(false);
    setIsDiarizing(false);
    setIsProcessingTranscript(false);
    isProcessingRef.current = false;
    audioProcessedRef.current = false;
    setDiarizedTranscription(null);
    setAudioParts([]);
    
    lastProcessedTranscriptRef.current = '';
    
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    
    if (isAudioRecording) {
      stopAudioRecording();
    }
    resetRecording();
    
    toast.success("Ready for a new patient session");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-doctor-light via-white to-doctor-light/20">
      <div className="container py-8 max-w-6xl">
        <DocHeader patientInfo={patientInfo} />
        
        <div className="grid gap-6 md:grid-cols-12">
          <div className="md:col-span-4 space-y-6">
            <VoiceRecorder 
              onTranscriptUpdate={handleTranscriptUpdate} 
              onPatientInfoUpdate={handlePatientInfoUpdate}
              onRecordingStateChange={handleRecordingStateChange}
              onProcessingStateChange={handleProcessingStateChange}
              onNewPatient={handleNewPatient}
            />
            
            <Tabs defaultValue="instructions">
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="instructions">Instructions</TabsTrigger>
                <TabsTrigger value="testing">Testing Tools</TabsTrigger>
              </TabsList>
              <TabsContent value="instructions">
                <Card className="p-5 border-none shadow-md bg-gradient-to-br from-doctor-primary/20 via-doctor-primary/10 to-transparent rounded-xl">
                  <h2 className="font-semibold text-doctor-primary mb-4 text-lg">How to use DocScribe</h2>
                  <ol className="space-y-3 text-sm">
                    <li className="flex gap-2 items-start">
                      <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">1</span>
                      <span>Click the microphone button to start recording</span>
                    </li>
                    <li className="flex gap-2 items-start">
                      <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">2</span>
                      <span>Say "Hi [patient name]" to begin a new session</span>
                    </li>
                    <li className="flex gap-2 items-start">
                      <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">3</span>
                      <span>Speak naturally about the patient's condition, symptoms, and medications</span>
                    </li>
                    <li className="flex gap-2 items-start">
                      <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">4</span>
                      <span>When you stop recording, the transcript will be classified automatically</span>
                    </li>
                    <li className="flex gap-2 items-start">
                      <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">5</span>
                      <span>A prescription will be automatically generated based on the conversation</span>
                    </li>
                    <li className="flex gap-2 items-start">
                      <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">6</span>
                      <span>Press the "New Patient" button for the next consultation</span>
                    </li>
                  </ol>
                </Card>
              </TabsContent>
              <TabsContent value="testing">
                <DiarizedTranscriptionTester apiKey={googleApiKey} />
              </TabsContent>
            </Tabs>
          </div>
          
          <div className="md:col-span-8 space-y-6">
            <TranscriptEditor 
              transcript={transcript} 
              onTranscriptChange={setTranscript}
              isRecording={isRecording}
            />
            
            <DiarizedTranscriptView 
              diarizedData={diarizedTranscription}
              isProcessing={isDiarizing || isProcessingTranscript}
              recordingDuration={formattedDuration}
              isRecording={isAudioRecording}
              audioBlob={audioBlob}
              audioParts={audioParts}
            />
            
            <PrescriptionGenerator 
              transcript={transcript} 
              patientInfo={patientInfo}
              classifiedTranscript={classifiedTranscript}
              isClassifying={isClassifying}
            />
          </div>
        </div>
      </div>
      
      <Toaster />
    </div>
  );
};

export default DashboardPage;
