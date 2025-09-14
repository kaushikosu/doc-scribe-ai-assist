import React from 'react';
import { DiarizedUtterance } from '@/types/diarization';
import { Clock, Mic } from 'lucide-react';

interface UtteranceViewProps {
  utterances: DiarizedUtterance[];
  showTimestamps?: boolean;
  showConfidence?: boolean;
}

const UtteranceView: React.FC<UtteranceViewProps> = ({ 
  utterances, 
  showTimestamps = true, 
  showConfidence = true 
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  const getSpeakerColor = (speaker: string) => {
    const normalized = speaker.trim().toLowerCase();
    if (normalized === 'doctor') return 'text-blue-600 bg-blue-50 border-blue-200';
    if (normalized === 'patient') return 'text-green-600 bg-green-50 border-green-200';
    return 'text-purple-600 bg-purple-50 border-purple-200';
  };

  if (utterances.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <Mic className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No utterances found in this conversation.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {utterances.map((utterance, index) => (
        <div 
          key={index} 
          className={`p-4 rounded-lg border ${getSpeakerColor(utterance.speaker)}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm">
              [{utterance.speaker}]
            </span>
            {(showTimestamps || showConfidence) && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {showTimestamps && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(utterance.ts_start)} - {formatTime(utterance.ts_end)}
                  </span>
                )}
                {showConfidence && (
                  <span className="bg-background px-2 py-0.5 rounded border">
                    Confidence: {(utterance.asr_conf * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            )}
          </div>
          <p className="text-foreground leading-relaxed">{utterance.text}</p>
        </div>
      ))}
    </div>
  );
};

export default UtteranceView;