
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Edit, Save, UserCircle, UserRound } from 'lucide-react';
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

  // Format transcript for better readability with enhanced speaker distinction
  // Improved to reduce unnecessary spacing
  const formattedTranscript = transcript.replace(
    /\[(Doctor|Patient|Identifying)\]:/g, 
    (match, speaker) => {
      if (speaker === 'Doctor') {
        return `<div class="doctor-message"><div class="speaker-label doctor-label">Doctor:</div><div class="message-content">`;
      } else if (speaker === 'Patient') {
        return `<div class="patient-message"><div class="speaker-label patient-label">Patient:</div><div class="message-content">`;
      } else {
        return `<div class="identifying-message"><div class="speaker-label identifying-label">Identifying:</div><div class="message-content">`;
      }
    }
  ).replace(/\n([^\n<])/g, ' $1') // Handle line breaks within a speaker's text
   .replace(/([^>])\n*<div class="/g, '$1</div></div>\n<div class="') // Close previous message divs
   + (transcript && !transcript.endsWith('</div></div>') ? '</div></div>' : '');

  return (
    <Card className="border-2 border-doctor-secondary/30 shadow-lg">
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
      <CardContent>
        {isEditing ? (
          <Textarea
            value={editableTranscript}
            onChange={handleChange}
            className="min-h-[300px] max-h-[500px] resize-none focus-visible:ring-doctor-secondary"
            placeholder="Transcript will appear here..."
          />
        ) : (
          <ScrollArea 
            className="h-[300px] rounded-md overflow-auto pr-2" 
            ref={scrollAreaRef}
          >
            <div 
              ref={contentRef} 
              className="bg-muted p-4 rounded-md"
              style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
              dangerouslySetInnerHTML={{ 
                __html: formattedTranscript || 
                "<div class='text-muted-foreground text-center italic'>Transcript will appear here...</div>"
              }}
            />
          </ScrollArea>
        )}
        <style>
          {`
          .doctor-message, .patient-message, .identifying-message {
            margin-bottom: 0.75rem;
            position: relative;
            display: flex;
            flex-direction: column;
          }
          
          .speaker-label {
            font-weight: 600;
            margin-bottom: 0.25rem;
            display: inline-block;
          }
          
          .doctor-label {
            color: #2563eb;
          }
          
          .patient-label {
            color: #7c3aed;
          }
          
          .identifying-label {
            color: #6b7280;
            font-style: italic;
          }
          
          .message-content {
            padding-left: 0.5rem;
            margin-left: 0.5rem;
            border-left: 2px solid #e5e7eb;
          }
          
          .identifying-message {
            opacity: 0.85;
          }
          `}
        </style>
      </CardContent>
    </Card>
  );
};

export default TranscriptEditor;
