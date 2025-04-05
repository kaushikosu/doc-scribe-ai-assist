
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Edit, Save, Copy, AlignJustify } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/lib/toast';

interface TranscriptEditorProps {
  transcript: string;
  onTranscriptChange: (transcript: string) => void;
}

const TranscriptEditor: React.FC<TranscriptEditorProps> = ({ 
  transcript, 
  onTranscriptChange
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(transcript);
    toast.success('Transcript copied to clipboard');
  };

  // Process and format the transcript with improved chunking and no speaker labels
  const formattedTranscript = React.useMemo(() => {
    if (!transcript) return '';
    
    // Remove all speaker labels for a clean transcript
    let cleanTranscript = transcript.replace(/\[(Doctor|Patient|Identifying)\]:\s*/g, '');
    
    // Split by natural breaks - line breaks, periods followed by space, etc.
    const chunks = cleanTranscript
      .split(/(?:\n+|\.\s+|\?\s+|\!\s+)/g)
      .filter(chunk => chunk.trim().length > 0);
    
    // Format each chunk as a separate paragraph
    return chunks
      .map(chunk => {
        // Determine if this is a processing indication
        if (chunk.includes("Processing...") || chunk.includes("Listening...")) {
          return `<div class="processing-indicator"><span class="h-2 w-2 rounded-full bg-doctor-primary animate-pulse"></span> ${chunk}</div>`;
        }
        
        // Return a standard paragraph for regular text
        return `<div class="transcript-paragraph">${chunk.trim()}</div>`;
      })
      .join('');
      
  }, [transcript]);

  // Calculate dynamic height based on content (with min and max constraints)
  const getContentHeight = () => {
    if (!transcript) return 'min-h-[120px]';
    const lineCount = transcript.split(/\n/).length;
    
    // Each line is roughly 24px, add padding
    const estimatedHeight = Math.min(Math.max(lineCount * 24, 120), 240);
    return `h-[${estimatedHeight}px]`;
  };

  return (
    <Card className="border border-doctor-secondary/20 shadow-md">
      <CardHeader className="pb-1 pt-2 px-3 bg-gradient-to-r from-doctor-secondary/10 to-transparent flex flex-row justify-between items-center">
        <div className="flex items-center gap-1.5">
          <AlignJustify className="h-4 w-4 text-doctor-secondary" />
          <CardTitle className="text-base text-doctor-secondary font-medium">Transcript</CardTitle>
        </div>
        <div className="flex gap-1">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={copyToClipboard}
            disabled={!transcript.length}
            className="h-7 text-doctor-primary hover:text-doctor-primary/80 hover:bg-doctor-primary/10"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={isEditing ? handleSave : handleEdit}
            disabled={!transcript.length}
            className="h-7 text-doctor-secondary hover:text-doctor-secondary/80 hover:bg-doctor-secondary/10"
          >
            {isEditing ? <Save className="h-3.5 w-3.5" /> : <Edit className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isEditing ? (
          <Textarea
            value={editableTranscript}
            onChange={handleChange}
            className={`${transcript ? 'h-auto' : 'h-[120px]'} max-h-[240px] min-h-[120px] border-0 rounded-none resize-none focus-visible:ring-doctor-secondary p-2`}
            placeholder="Transcript will appear here..."
          />
        ) : (
          <ScrollArea 
            className={`${transcript ? 'h-auto' : 'h-[120px]'} max-h-[240px] min-h-[120px]`}
            ref={scrollAreaRef}
          >
            <div 
              ref={contentRef} 
              className={`p-2 w-full`}
              style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
              dangerouslySetInnerHTML={{ 
                __html: formattedTranscript || 
                "<div class='text-muted-foreground text-center italic h-full flex items-center justify-center'>Transcript will appear here...</div>"
              }}
            />
          </ScrollArea>
        )}
        <style>
          {`
          .transcript-paragraph {
            margin-bottom: 0.25rem;
            padding-bottom: 0.15rem;
            border-bottom: 1px dotted rgba(0,0,0,0.03);
            line-height: 1.3;
          }
          
          .processing-indicator {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-style: italic;
            color: #6b7280;
            margin-bottom: 0.25rem;
          }
          
          .processing-indicator span {
            display: inline-block;
            width: 0.4rem;
            height: 0.4rem;
          }
          `}
        </style>
      </CardContent>
    </Card>
  );
};

export default TranscriptEditor;
