
import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    console.log("Transcript updated in DashboardPage:", transcript);
  }, [transcript]);
  
  useEffect(() => {
    // Only run this effect if recording has stopped and we have new transcript content
    if (!isRecording && transcript && transcript !== lastProcessedTranscript) {
      console.log("Recording stopped, auto-classifying transcript");
      setIsClassifying(true);
      setPrescriptionEnabled(false); // Disable prescription until classification is done
      
      toast.info('Enhancing transcript with speaker identification...', {
        duration: 3000,
      });
      
      // Store current transcript value in a local variable to avoid stale closures
      const currentTranscript = transcript;
      
      // Wrap the timeout in a function to avoid stale closures
      const timeoutId = setTimeout(() => {
        try {
          if (currentTranscript && currentTranscript.trim().length > 0) {
            const classified = classifyTranscript(currentTranscript);
            setClassifiedTranscript(classified);
            setLastProcessedTranscript(currentTranscript);
            setShowClassifiedView(true); // Show the classified view
            setPrescriptionEnabled(true); // Enable prescription generation
            console.log("Transcript auto-classified");
            toast.success("Transcript enhanced with speaker identification");
          } else {
            setPrescriptionEnabled(true); // Enable prescription if no transcript to classify
          }
        } catch (error) {
          console.error("Error classifying transcript:", error);
          toast.error("Failed to enhance transcript");
          setPrescriptionEnabled(true); // Enable prescription even if classification fails
        } finally {
          setIsClassifying(false);
        }
      }, 1200);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isRecording, transcript, lastProcessedTranscript]);

  const handleTranscriptUpdate = (newTranscript: string) => {
    console.log("handleTranscriptUpdate called with:", newTranscript?.length);
    if (newTranscript !== undefined) {
      setTranscript(newTranscript);
      
      if (isRecording && showClassifiedView) {
        setShowClassifiedView(false);
      }
    }
  };

  const handlePatientInfoUpdate = (newPatientInfo: { name: string; time: string }) => {
    setPatientInfo(newPatientInfo);
  };
  
  const handleRecordingStateChange = (recordingState: boolean) => {
    setIsRecording(recordingState);
    
    if (recordingState && showClassifiedView) {
      setShowClassifiedView(false);
    }
    
    if (!recordingState && transcript) {
      toast.info('Processing transcript with enhanced speaker detection...');
    }
  };
  
  const handleToggleView = () => {
    if (classifiedTranscript && !isRecording) {
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
