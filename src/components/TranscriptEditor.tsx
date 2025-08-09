
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Edit, Save, Copy, AlignJustify } from 'lucide-react';
import { cn } from '@/lib/utils';

import { toast } from '@/lib/toast';

interface TranscriptEditorProps {
  transcript: string;
  onTranscriptChange: (transcript: string) => void;
  isRecording: boolean;
  mode?: 'live' | 'revised';
  status?: { type: 'idle' | 'recording' | 'processing' | 'updated' | 'generating' | 'ready' | 'error'; message?: string };
}

const TranscriptEditor: React.FC<TranscriptEditorProps> = ({ 
  transcript, 
  onTranscriptChange,
  isRecording,
  mode,
  status
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editableTranscript, setEditableTranscript] = useState(transcript);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const prevRecordingRef = useRef<boolean>(isRecording);
  const [showStopped, setShowStopped] = useState(false);

  useEffect(() => {
    setEditableTranscript(transcript);
    
    // Scroll to bottom immediately when transcript updates
    if (scrollAreaRef.current && contentRef.current) {
      const scrollContainer = scrollAreaRef.current;
      scrollContainer.scrollTop = contentRef.current.scrollHeight;
    }
  }, [transcript]);
  
  // Show 'Recording stopped' briefly when recording ends
  useEffect(() => {
    if (prevRecordingRef.current && !isRecording) {
      setShowStopped(true);
      const t = setTimeout(() => setShowStopped(false), 900);
      return () => clearTimeout(t);
    }
    prevRecordingRef.current = isRecording;
  }, [isRecording]);
  
  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    onTranscriptChange(editableTranscript);
    setIsEditing(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditableTranscript(e.target.value);
  };

  const copyToClipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text);
    toast.success(message);
  };


  // Process and format the transcript with improved chunking and speaker labels
  const formattedTranscript = React.useMemo(() => {
    if (!transcript) return '';
    
    // Split transcript into paragraphs for better visualization
    const paragraphs = transcript
      .split(/\n+/)
      .filter(p => p.trim().length > 0);
    
    if (paragraphs.length === 0) {
      return '<div class="text-muted-foreground text-center italic h-full flex items-center justify-center">Transcript will appear here...</div>';
    }
    
    // Process transcript to highlight speaker labels if they exist
    const processedTranscript = paragraphs.map(paragraph => {
      const speakerMatch = paragraph.match(/^\[(Doctor|Patient|Identifying)\]:/);
      
      if (speakerMatch) {
        const speaker = speakerMatch[1];
        const content = paragraph.replace(/^\[(Doctor|Patient|Identifying)\]:/, '').trim();
        
        // Apply different styling based on speaker
        const speakerClass = speaker === 'Doctor' ? 'text-doctor-primary font-semibold' : 
                            (speaker === 'Patient' ? 'text-doctor-accent font-semibold' : 
                            'text-muted-foreground font-semibold');
        
        return `<div class="transcript-paragraph">
          <span class="${speakerClass}">[${speaker}]:</span> ${content}
        </div>`;
      }
      
      // Regular paragraph without speaker label
      return `<div class="transcript-paragraph">${paragraph}</div>`;
    }).join('');
    
    return processedTranscript;
  }, [transcript]);

  const overlayMsg = showStopped ? "Recording stopped" : (status?.type === 'processing' ? 'Revising transcription' : null);

  return (
    <>
      <Card className={cn("border-2 transition-all", mode === 'revised' ? "border-doctor-secondary/30" : "border-doctor-primary/50 ring-1 ring-doctor-primary/30")}>
        <CardHeader className="pb-1 pt-2 px-3 bg-gradient-to-r from-doctor-secondary/10 to-transparent flex flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <AlignJustify className="h-4 w-4 text-doctor-secondary" />
            <CardTitle className="text-base text-doctor-secondary font-medium">Transcript</CardTitle>
            <Badge variant="outline" className="h-5 px-2 text-[11px] text-doctor-secondary border-doctor-secondary/50 flex items-center gap-1">
              {mode === 'revised' ? 'Revised' : (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-doctor-secondary pulse" />
                  Live
                </>
              )}
            </Badge>
          </div>
          <div className="flex gap-1">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => copyToClipboard(transcript, 'Transcript copied to clipboard')}
              disabled={!transcript.length}
              className="h-7 text-doctor-primary hover:text-doctor-primary/80 hover:bg-doctor-primary/10 border-doctor-primary"
            >
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copy
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={isEditing ? handleSave : handleEdit}
              disabled={!transcript.length}
              className={cn(
                "h-7 border-doctor-secondary text-doctor-secondary",
                isEditing ? "hover:bg-doctor-secondary hover:text-white" : "hover:bg-doctor-secondary/10"
              )}
            >
              {isEditing ? (
                <>
                  <Save className="h-3.5 w-3.5 mr-1" />
                  Save
                </>
              ) : (
                <>
                  <Edit className="h-3.5 w-3.5 mr-1" />
                  Edit
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isEditing ? (
            <Textarea
              value={editableTranscript}
              onChange={handleChange}
              className={`${transcript ? 'h-auto' : 'h-[120px]'} max-h-[400px] min-h-[120px] border-0 rounded-none resize-none focus-visible:ring-doctor-secondary p-2 bg-muted`}
              placeholder="Transcript will appear here..."
            />
          ) : (
            <div 
              className={`${transcript ? 'h-auto' : 'h-[120px]'} relative max-h-[70vh] min-h-[120px] overflow-y-auto`}
              ref={scrollAreaRef}
            >
              <div 
                ref={contentRef} 
                className={cn(
                  "p-3 w-full bg-muted rounded-md whitespace-pre-wrap break-words transition-opacity duration-300 animate-fade-in",
                  overlayMsg ? "opacity-50" : "opacity-100"
                )}
              >
                {transcript ? (
                  transcript
                ) : (
                  <div className="text-muted-foreground text-center italic h-full flex items-center justify-center">
                    Transcript will appear here...
                  </div>
                )}
              </div>
              {overlayMsg && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/70 backdrop-blur-sm rounded-md" aria-live="polite">
                  {overlayMsg === 'Revising transcription' && (
                    <span className="h-5 w-5 rounded-full border-2 border-doctor-secondary border-t-transparent animate-spin mb-2" />
                  )}
                  <p className="text-doctor-secondary font-medium">{overlayMsg}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <style>
        {`
        .transcript-paragraph {
          margin-bottom: 0.75rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px dotted rgba(0,0,0,0.05);
          line-height: 1.5;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-fade-in {
          animation: fadeIn 0.5s ease forwards;
        }
        `}
      </style>
    </>
  );
};

export default TranscriptEditor;
