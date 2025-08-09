
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Edit, Save, Copy, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

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

  useEffect(() => {
    setEditableTranscript(transcript);
    
    // Scroll to bottom immediately when transcript updates
    if (scrollAreaRef.current && contentRef.current) {
      const scrollContainer = scrollAreaRef.current;
      scrollContainer.scrollTop = contentRef.current.scrollHeight;
    }
  }, [transcript]);
  
  
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
        const speakerMatch = paragraph.match(/^\s*\[(Doctor|Patient|Identifying)\]\s*:/i);
        
        if (speakerMatch) {
          const speaker = (speakerMatch[1] || '').toLowerCase();
          const content = paragraph.replace(/^\s*\[(Doctor|Patient|Identifying)\]\s*:/i, '').trim();
          
          const rowClass = speaker === 'doctor'
            ? 'text-foreground border-l-2 border-doctor-primary/25 bg-doctor-primary/5 rounded-sm'
            : speaker === 'patient'
            ? 'text-foreground border-l-2 border-doctor-accent/25 bg-doctor-accent/5 rounded-sm'
            : 'text-muted-foreground';
          const labelClass = speaker === 'identifying' ? 'text-muted-foreground' : 'text-foreground';
          const speakerLabel = speaker.charAt(0).toUpperCase() + speaker.slice(1);
          
          return `<div class="transcript-row ${rowClass}">
            <span class="transcript-label ${labelClass}">${speakerLabel}:</span>
            <span class="transcript-content">${content}</span>
          </div>`;
        }
        
        return `<div class=\"transcript-row\"><span class=\"transcript-content\">${paragraph.trim()}</span></div>`;
      }).join('');
    
    return processedTranscript;
  }, [transcript]);

  const overlayMsg = (status?.type === 'processing' && mode !== 'revised') ? 'Revising transcription' : null;

  const placeholderText = isRecording
    ? 'Capturing live transcript...'
    : (status?.type === 'processing'
        ? 'Revised transcript will appear here...'
        : 'Press Record to start capturing the conversation.');

  return (
    <>
      <Card className={cn("border rounded-lg transition-all")}>
        <CardHeader className="px-3 py-2 border-b border-border bg-secondary shadow-sm flex flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold text-foreground">Transcript</CardTitle>
            {status?.type === 'processing' ? null : (
              <Badge variant="outline" className="h-5 px-2 text-[11px] flex items-center gap-1 border-doctor-primary text-doctor-primary bg-doctor-primary/5">
                {mode === 'revised' ? 'Revised' : (
                  <>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-doctor-primary animate-pulse-recording" />
                    Live
                  </>
                )}
              </Badge>
            )}
          </div>
          {transcript.length > 0 && (
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Transcript actions"
                    title="Transcript actions"
                    className="h-8 w-8 p-0 border-doctor-primary text-doctor-primary hover:bg-doctor-primary/10"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={isEditing ? handleSave : handleEdit}>
                    {isEditing ? 'Save transcript' : 'Edit transcript'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => copyToClipboard(transcript, 'Transcript copied to clipboard')}>
                    Copy transcript
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-3">
          {isEditing ? (
            <Textarea
              value={editableTranscript}
              onChange={handleChange}
              className="min-h-[300px] bg-muted p-3 rounded-md border-0 resize-none focus-visible:ring-primary text-sm"
               placeholder={placeholderText}
            />
          ) : (
            <div 
              className={`${transcript ? 'h-auto' : 'h-[120px]'} relative max-h-[70vh] min-h-[120px] overflow-y-auto`}
              ref={scrollAreaRef}
            >
              <div 
                ref={contentRef} 
                className={cn(
                  "p-3 w-full bg-muted rounded-md min-h-[300px] whitespace-pre-wrap break-words text-sm transition-opacity duration-300 animate-fade-in",
                  overlayMsg ? "opacity-50" : "opacity-100"
                )}
              >
                {transcript ? (
                  mode === 'revised' ? (
                    <div dangerouslySetInnerHTML={{ __html: formattedTranscript }} />
                  ) : (
                    transcript
                  )
                ) : (
                  <div className="text-muted-foreground text-center italic h-full flex items-center justify-center">
                    {placeholderText}
                  </div>
                )}
              </div>
              {overlayMsg && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/70 backdrop-blur-sm rounded-md" aria-live="polite">
                  {overlayMsg === 'Revising transcription' && (
                    <span className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin mb-2" />
                  )}
                  <p className="text-foreground font-medium">{overlayMsg}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <style>
        {`
        .transcript-row {
          display: grid;
          grid-template-columns: auto 1fr;
          column-gap: 0.5rem;
          padding: 0.125rem 0; /* tighter spacing */
          margin: 0;
          line-height: 1.45;
        }
        .transcript-label {
          font-weight: 400;
          white-space: nowrap;
        }
        .transcript-content {
          white-space: pre-wrap;
          word-break: break-word;
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
