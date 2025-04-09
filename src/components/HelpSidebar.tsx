
import React from 'react';
import { Card } from '@/components/ui/card';

const HelpSidebar = () => {
  return (
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
  );
};

export default HelpSidebar;
