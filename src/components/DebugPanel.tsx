import React, { useState, useMemo } from 'react';
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

  // Helper function to format text as paragraphs
  const formatParagraphs = (text: string) => {
    if (!text) return [];
    return text.split('\n').filter(p => p.trim().length > 0);
  };

  // Calculate differences between Deepgram and Claude transcripts
  const claudeWithHighlights = useMemo(() => {
    if (!deepgramTranscript || !claudeTranscript) return formatParagraphs(claudeTranscript);
    
    const deepgramParagraphs = formatParagraphs(deepgramTranscript);
    const claudeParagraphs = formatParagraphs(claudeTranscript);
    
    return claudeParagraphs.map((claudePara, index) => {
      const deepgramPara = deepgramParagraphs[index] || '';
      
      // Extract speaker label and content separately
      const extractSpeakerAndContent = (text: string) => {
        // Match patterns like "Speaker 0:", "[Doctor]:", etc.
        const speakerMatch = text.match(/^(Speaker \d+:|^\[.*?\]:)\s*(.*)/);
        if (speakerMatch) {
          return { speaker: speakerMatch[1], content: speakerMatch[2] };
        }
        return { speaker: '', content: text };
      };
      
      const claudeData = extractSpeakerAndContent(claudePara);
      const deepgramData = extractSpeakerAndContent(deepgramPara);
      
      // Only compare the content part, not the speaker labels
      const claudeWords = claudeData.content.split(' ').filter(w => w.trim());
      const deepgramWords = deepgramData.content.split(' ').filter(w => w.trim());
      
      // Rebuild the full paragraph with speaker label + content
      const result = [];
      
      // Add speaker label (always show, no highlighting since these are expected to change)
      if (claudeData.speaker) {
        result.push({
          word: claudeData.speaker,
          isChanged: false,
          key: `${index}-speaker`
        });
      }
      
      // Add content words with diff highlighting
      claudeWords.forEach((word, wordIndex) => {
        const deepgramWord = deepgramWords[wordIndex] || '';
        const isChanged = word !== deepgramWord;
        
        result.push({
          word,
          isChanged,
          key: `${index}-${wordIndex}`
        });
      });
      
      return result;
    });
  }, [deepgramTranscript, claudeTranscript]);

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
                  {liveTranscript ? (
                    formatParagraphs(liveTranscript).map((paragraph, index) => (
                      <p key={index} className="mb-2 last:mb-0">
                        {paragraph}
                      </p>
                    ))
                  ) : (
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
                  {deepgramTranscript ? (
                    formatParagraphs(deepgramTranscript).map((paragraph, index) => (
                      <p key={index} className="mb-2 last:mb-0">
                        {paragraph}
                      </p>
                    ))
                  ) : (
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
                  {claudeTranscript ? (
                    claudeWithHighlights.map((paragraph, index) => (
                      <p key={index} className="mb-2 last:mb-0">
                        {paragraph.map(({ word, isChanged, key }) => (
                          <span
                            key={key}
                            className={isChanged ? 'bg-yellow-300 dark:bg-yellow-600 px-0.5 rounded' : ''}
                          >
                            {word}{' '}
                          </span>
                        ))}
                      </p>
                    ))
                  ) : (
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