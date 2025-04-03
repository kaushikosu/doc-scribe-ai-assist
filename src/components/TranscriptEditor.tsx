
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

  // Process and format the transcript for better readability with clear speaker distinction
  const formattedTranscript = transcript
    .replace(/\[(Doctor|Patient|Identifying)\]:\s*([^\n]*)/g, (match, speaker, content) => {
      if (speaker === 'Doctor') {
        return `<div class="message doctor-message"><div class="speaker-icon doctor-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-circle"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/></svg></div><div class="speaker-label doctor-label">Doctor</div><div class="message-content">${content}</div></div>`;
      } else if (speaker === 'Patient') {
        return `<div class="message patient-message"><div class="speaker-icon patient-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/></svg></div><div class="speaker-label patient-label">Patient</div><div class="message-content">${content}</div></div>`;
      } else {
        return `<div class="message identifying-message"><div class="speaker-label identifying-label">Listening...</div><div class="message-content">${content}</div></div>`;
      }
    });

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
          .message {
            margin-bottom: 1rem;
            display: grid;
            grid-template-columns: auto 1fr;
            grid-template-rows: auto 1fr;
            grid-template-areas:
              "icon label"
              "content content";
            gap: 0.25rem 0.5rem;
          }
          
          .speaker-icon {
            grid-area: icon;
            width: 1.25rem;
            height: 1.25rem;
            display: flex;
            align-items: center;
          }
          
          .speaker-label {
            grid-area: label;
            font-weight: 600;
            font-size: 0.9rem;
            display: flex;
            align-items: center;
          }
          
          .message-content {
            grid-area: content;
            padding-left: 0.5rem;
            margin-top: 0.25rem;
            border-left: 2px solid #e5e7eb;
            line-height: 1.5;
          }
          
          .doctor-message .speaker-icon,
          .doctor-label {
            color: #2563eb;
          }
          
          .patient-message .speaker-icon,
          .patient-label {
            color: #7c3aed;
          }
          
          .identifying-label {
            color: #6b7280;
            font-style: italic;
            grid-column: span 2;
          }
          
          .identifying-message {
            opacity: 0.85;
          }
          
          .identifying-message .message-content {
            font-style: italic;
          }
          `}
        </style>
      </CardContent>
    </Card>
  );
};

export default TranscriptEditor;
