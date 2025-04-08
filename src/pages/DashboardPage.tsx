import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import VoiceRecorder from '@/components/VoiceRecorder';
import TranscriptEditor from '@/components/TranscriptEditor';
import PrescriptionGenerator from '@/components/PrescriptionGenerator';
import DocHeader from '@/components/DocHeader';
import { Toaster } from '@/components/ui/sonner';
import { classifyTranscript } from '@/utils/speaker';
import { toast } from '@/lib/toast';

const DashboardPage = () => {
  const [transcript, setTranscript] = useState('');
  const [classifiedTranscript, setClassifiedTranscript] = useState('');
  const [patientInfo, setPatientInfo] = useState({
    name: '',
    time: ''
  });
  const [isRecording, setIsRecording] = useState(false);
  const [lastProcessedTranscript, setLastProcessedTranscript] = useState('');
  const [isClassifying, setIsClassifying] = useState(false);
  const [showClassifiedView, setShowClassifiedView] = useState(false);
  const [prescriptionEnabled, setPrescriptionEnabled] = useState(false);
  
  // Refs to track component mount state and timeouts
  const isMountedRef = useRef(true);
  const classificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Set up mounted ref for safe async operations and proper cleanup
  useEffect(() => {
    // Initialize mount status
    isMountedRef.current = true;
    
    // Cleanup function runs when component unmounts
    return () => {
      // Mark component as unmounted
      isMountedRef.current = false;
      
      // Clear any pending timeouts
      if (classificationTimeoutRef.current) {
        clearTimeout(classificationTimeoutRef.current);
        classificationTimeoutRef.current = null;
      }
    };
  }, []);
  
  useEffect(() => {
    console.log("Transcript updated in DashboardPage:", transcript);
  }, [transcript]);
  
  // Handle transcript classification - simplified and made more robust
  const handleTranscriptClassification = useCallback(() => {
    // Skip processing if component is unmounted or transcript is empty
    if (!isMountedRef.current || !transcript || transcript.trim() === '') {
      return;
    }
    
    try {
      const classified = classifyTranscript(transcript);
      
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setClassifiedTranscript(classified);
        setLastProcessedTranscript(transcript);
        setShowClassifiedView(true);
        setPrescriptionEnabled(true);
        console.log("Transcript auto-classified");
        toast.success("Transcript enhanced with speaker identification");
      }
    } catch (error) {
      // Only show error if component is still mounted
      if (isMountedRef.current) {
        console.error("Error classifying transcript:", error);
        toast.error("Failed to enhance transcript");
        setPrescriptionEnabled(true);
      }
    } finally {
      // Final state update only if component is still mounted
      if (isMountedRef.current) {
        setIsClassifying(false);
      }
    }
  }, [transcript]);
  
  // Effect to trigger classification when recording stops with new content
  useEffect(() => {
    // Only run this effect if recording has stopped and we have new transcript content
    if (!isRecording && transcript && transcript !== lastProcessedTranscript) {
      console.log("Recording stopped, auto-classifying transcript");
      
      // Cancel any existing timeout
      if (classificationTimeoutRef.current) {
        clearTimeout(classificationTimeoutRef.current);
        classificationTimeoutRef.current = null;
      }
      
      // Update classification state
      if (isMountedRef.current) {
        setIsClassifying(true);
        setPrescriptionEnabled(false);
      }
      
      // Show toast notification only if component is mounted
      if (isMountedRef.current) {
        toast.info('Enhancing transcript with speaker identification...', {
          duration: 3000,
        });
      }
      
      // Schedule classification with timeout, keeping reference for cleanup
      classificationTimeoutRef.current = setTimeout(() => {
        // Skip if component was unmounted during the timeout
        if (isMountedRef.current) {
          handleTranscriptClassification();
        }
        // Clear timeout reference
        classificationTimeoutRef.current = null;
      }, 1200);
      
      // Cleanup function to clear timeout if effect runs again or component unmounts
      return () => {
        if (classificationTimeoutRef.current) {
          clearTimeout(classificationTimeoutRef.current);
          classificationTimeoutRef.current = null;
        }
      };
    }
  }, [isRecording, transcript, lastProcessedTranscript, handleTranscriptClassification]);

  const handleTranscriptUpdate = (newTranscript: string) => {
    console.log("handleTranscriptUpdate called with:", newTranscript?.length);
    if (newTranscript !== undefined && isMountedRef.current) {
      setTranscript(newTranscript);
      
      if (isRecording && showClassifiedView) {
        setShowClassifiedView(false);
      }
    }
  };

  const handlePatientInfoUpdate = (newPatientInfo: { name: string; time: string }) => {
    if (isMountedRef.current) {
      setPatientInfo(newPatientInfo);
    }
  };
  
  const handleRecordingStateChange = (recordingState: boolean) => {
    if (isMountedRef.current) {
      setIsRecording(recordingState);
      
      if (recordingState && showClassifiedView) {
        setShowClassifiedView(false);
      }
      
      if (!recordingState && transcript) {
        toast.info('Processing transcript with enhanced speaker detection...');
      }
    }
  };
  
  const handleToggleView = () => {
    if (classifiedTranscript && !isRecording && isMountedRef.current) {
      setShowClassifiedView(!showClassifiedView);
    }
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
            />
            
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
                  <span>When you stop recording, the transcript will be enhanced automatically</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">5</span>
                  <span>A prescription will be generated based on the enhanced conversation</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">6</span>
                  <span>Press the "New Patient" button for the next consultation</span>
                </li>
              </ol>
            </Card>
          </div>
          
          <div className="md:col-span-8 space-y-6">
            <TranscriptEditor 
              transcript={transcript} 
              onTranscriptChange={setTranscript}
              isRecording={isRecording}
              isClassifying={isClassifying}
              classifiedTranscript={classifiedTranscript}
              showClassifiedView={showClassifiedView}
              onToggleView={handleToggleView}
              setIsClassifying={setIsClassifying}
            />
            
            <PrescriptionGenerator 
              transcript={transcript} 
              patientInfo={patientInfo}
              classifiedTranscript={classifiedTranscript}
              isClassifying={isClassifying}
              isEnabled={prescriptionEnabled}
            />
          </div>
        </div>
      </div>
      
      <Toaster />
    </div>
  );
};

export default DashboardPage;
