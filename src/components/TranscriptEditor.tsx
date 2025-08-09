
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Edit, Save, Copy } from 'lucide-react';
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

  return (
    <>
      <Card className={cn("border rounded-lg transition-all")}>
        <CardHeader className="px-3 py-2 border-b flex flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold text-foreground">Transcript</CardTitle>
            {status?.type === 'processing' ? null : (
              <Badge variant="outline" className="h-5 px-2 text-[11px] text-muted-foreground border-muted flex items-center gap-1">
                {mode === 'revised' ? 'Revised' : (
                  <>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary pulse" />
                    Live
                  </>
                )}
              </Badge>
            )}
          </div>
          <div className="flex gap-1">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => copyToClipboard(transcript, 'Transcript copied to clipboard')}
              disabled={!transcript.length}
              className="h-7 text-foreground hover:text-foreground hover:bg-muted border-muted"
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={isEditing ? handleSave : handleEdit}
              disabled={!transcript.length}
              className={cn(
                "h-7 border-muted text-foreground",
                isEditing ? "hover:bg-primary hover:text-primary-foreground" : "hover:bg-muted"
              )}
            >
              {isEditing ? (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4 mr-1" />
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
              className={`${transcript ? 'h-auto' : 'h-[120px]'} max-h-[400px] min-h-[120px] border-0 rounded-none resize-none focus-visible:ring-primary p-2 bg-muted`}
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
                  mode === 'revised' ? (
                    <div dangerouslySetInnerHTML={{ __html: formattedTranscript }} />
                  ) : (
                    transcript
                  )
                ) : (
                  <div className="text-muted-foreground text-center italic h-full flex items-center justify-center">
                    Transcript will appear here...
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
