// src/components/HowToUseCard.tsx
import React from 'react';

const HowToUseCard: React.FC = () => (
  <div className="p-5 border rounded-lg shadow-sm">
    <h2 className="text-lg font-semibold text-foreground mb-4">How to use DocScribe</h2>
    <ol className="space-y-3 text-sm">
      <li className="flex gap-2 items-start">
        <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">1</span>
        <span>Click the microphone button to start recording</span>
      </li>
      <li className="flex gap-2 items-start">
        <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">2</span>
        <span>Speak naturally about the patient's condition, symptoms, and medications</span>
      </li>
      <li className="flex gap-2 items-start">
        <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">3</span>
        <span>When you stop recording, a revised transcript will appear</span>
      </li>
      <li className="flex gap-2 items-start">
        <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">4</span>
        <span>A prescription will be automatically generated based on the conversation</span>
      </li>
      <li className="flex gap-2 items-start">
        <span className="flex items-center justify-center bg-doctor-primary text-white rounded-full w-6 h-6 text-xs font-bold flex-shrink-0">5</span>
        <span>Press the "New Patient" button for the next consultation</span>
      </li>
    </ol>
  </div>
);

export default HowToUseCard;
