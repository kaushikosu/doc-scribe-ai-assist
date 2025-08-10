import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Bug, ChevronDown, ChevronUp } from 'lucide-react';

interface DebugPanelProps {
  liveTranscript: string;
  deepgramTranscript: string;
  claudeTranscript: string;
  isRecording: boolean;
}

const DebugPanel: React.FC<DebugPanelProps> = ({
  liveTranscript,
  deepgramTranscript,
  claudeTranscript,
  isRecording
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between bg-muted/50 border-dashed"
          >
            <div className="flex items-center gap-2">
              <Bug size={16} />
              Debug Transcription Pipeline
            </div>
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Live Transcript */}
            <Card className="h-64">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-muted'}`} />
                  1. Live Transcript
                </CardTitle>
                <p className="text-xs text-muted-foreground">Web Speech API (Real-time)</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-40 overflow-y-auto bg-muted/50 p-3 rounded text-xs leading-relaxed">
                  {liveTranscript || (
                    <span className="text-muted-foreground italic">
                      {isRecording ? 'Listening...' : 'No live transcript yet'}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Deepgram Transcript */}
            <Card className="h-64">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${deepgramTranscript ? 'bg-blue-500' : 'bg-muted'}`} />
                  2. Deepgram Diarized
                </CardTitle>
                <p className="text-xs text-muted-foreground">Post-processing with speaker labels</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-40 overflow-y-auto bg-muted/50 p-3 rounded text-xs leading-relaxed">
                  {deepgramTranscript || (
                    <span className="text-muted-foreground italic">
                      Waiting for audio processing...
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Claude Corrected */}
            <Card className="h-64">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${claudeTranscript ? 'bg-green-500' : 'bg-muted'}`} />
                  3. Claude Corrected
                </CardTitle>
                <p className="text-xs text-muted-foreground">AI-enhanced speaker identification</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-40 overflow-y-auto bg-muted/50 p-3 rounded text-xs leading-relaxed">
                  {claudeTranscript || (
                    <span className="text-muted-foreground italic">
                      Waiting for AI correction...
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="mt-4 text-xs text-muted-foreground">
            <p>This debug panel shows the three stages of transcript processing:</p>
            <ul className="mt-2 space-y-1 ml-4">
              <li>• <strong>Live:</strong> Real-time Web Speech API output</li>
              <li>• <strong>Deepgram:</strong> Post-processed audio with speaker diarization</li>
              <li>• <strong>Claude:</strong> AI-enhanced speaker role identification (Doctor/Patient)</li>
            </ul>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default DebugPanel;