
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Edit, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

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
        return `<div class="transcript-paragraph">${chunk}</div>`;
      })
      .join('');
      
  }, [transcript]);

  return (
    <Card className="border-2 border-doctor-secondary/30 shadow-lg h-full">
      <CardHeader className="pb-3 bg-gradient-to-r from-doctor-secondary/20 to-doctor-primary/10">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl text-doctor-secondary font-semibold">Transcript</CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={isEditing ? handleSave : handleEdit}
            disabled={!transcript.length}
            className={cn(
              "border-doctor-secondary text-doctor-secondary",
              isEditing ? "hover:bg-doctor-secondary hover:text-white" : "hover:bg-doctor-secondary/10"
            )}
          >
            {isEditing ? (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            ) : (
              <>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        {isEditing ? (
          <Textarea
            value={editableTranscript}
            onChange={handleChange}
            className="h-[300px] max-h-[300px] resize-none focus-visible:ring-doctor-secondary"
            placeholder="Transcript will appear here..."
          />
        ) : (
          <ScrollArea 
            className="h-[300px] rounded-md" 
            ref={scrollAreaRef}
          >
            <div 
              ref={contentRef} 
              className="bg-muted p-4 rounded-md min-h-full w-full"
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
            margin-bottom: 0.75rem;
            padding-bottom: 0.5rem;
            border-bottom: 1px solid #f0f0f0;
            line-height: 1.5;
          }
          
          .processing-indicator {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-style: italic;
            color: #6b7280;
            margin-bottom: 0.5rem;
          }
          
          .processing-indicator span {
            display: inline-block;
            width: 0.5rem;
            height: 0.5rem;
          }
          `}
        </style>
      </CardContent>
    </Card>
  );
};

export default TranscriptEditor;
