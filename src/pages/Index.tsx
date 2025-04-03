
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import VoiceRecorder from '@/components/VoiceRecorder';
import TranscriptEditor from '@/components/TranscriptEditor';
import PrescriptionGenerator from '@/components/PrescriptionGenerator';
import DocHeader from '@/components/DocHeader';
import { Toaster } from '@/components/ui/sonner';

const Index = () => {
  const [transcript, setTranscript] = useState('');

  const handleTranscriptUpdate = (newTranscript: string) => {
    setTranscript(newTranscript);
  };

  return (
    <div className="min-h-screen bg-doctor-light">
      <div className="container py-8 max-w-6xl">
        <DocHeader />
        
        <div className="grid gap-6 md:grid-cols-12">
          {/* Voice Recorder Column */}
          <div className="md:col-span-4">
            <VoiceRecorder onTranscriptUpdate={handleTranscriptUpdate} />
            
            <Card className="mt-6 p-4 border-none bg-doctor-primary/5">
              <h2 className="font-semibold text-doctor-primary mb-3">How to use DocScribe</h2>
              <ol className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="font-bold">1.</span>
                  <span>Press the microphone button to start a new session</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">2.</span>
                  <span>Speak naturally about the patient's condition, symptoms, and medications</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">3.</span>
                  <span>The transcript will appear in real-time and can be edited if needed</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">4.</span>
                  <span>A prescription will be automatically generated based on the conversation</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">5.</span>
                  <span>Review, edit if necessary, and save the prescription to patient records</span>
                </li>
              </ol>
            </Card>
          </div>
          
          {/* Main Content Column */}
          <div className="md:col-span-8 space-y-6">
            <TranscriptEditor 
              transcript={transcript} 
              onTranscriptChange={setTranscript} 
            />
            
            <PrescriptionGenerator transcript={transcript} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
