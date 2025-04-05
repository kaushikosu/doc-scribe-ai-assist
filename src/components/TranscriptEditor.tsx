import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeftRight, Copy, Edit, Save, AlignJustify, MessageSquare, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/lib/toast';
import { classifyTranscript } from '@/utils/speaker';
import { Skeleton } from '@/components/ui/skeleton';

interface TranscriptEditorProps {
  transcript: string;
  onTranscriptChange: (transcript: string) => void;
  isRecording: boolean;
  isClassifying?: boolean;
  classifiedTranscript?: string;
  showClassifiedView?: boolean;
  onToggleView?: () => void;
  setIsClassifying?: (isClassifying: boolean) => void;
}

const TranscriptEditor: React.FC<TranscriptEditorProps> = ({ 
  transcript, 
  onTranscriptChange,
  isRecording,
  isClassifying = false,
  classifiedTranscript = "",
  showClassifiedView = false,
  onToggleView,
  setIsClassifying
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editableTranscript, setEditableTranscript] = useState(transcript);
  const [classifyingFeedback, setClassifyingFeedback] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const classifiedScrollAreaRef = useRef<HTMLDivElement>(null);
  
  const processingMessages = [
    "Identifying speakers...",
    "Enhancing transcript clarity...",
    "Analyzing conversation patterns...",
    "Distinguishing doctor and patient speech..."
  ];
  
  useEffect(() => {
    if (isClassifying) {
      let messageIndex = 0;
      const intervalId = setInterval(() => {
        setClassifyingFeedback(processingMessages[messageIndex % processingMessages.length]);
        messageIndex++;
      }, 1500);
      
      return () => clearInterval(intervalId);
    }
  }, [isClassifying]);

  useEffect(() => {
    setEditableTranscript(transcript);
    
    if (scrollAreaRef.current && contentRef.current) {
      const scrollContainer = scrollAreaRef.current;
      scrollContainer.scrollTop = contentRef.current.scrollHeight;
    }
  }, [transcript]);
  
  useEffect(() => {
    if (showClassifiedView && classifiedScrollAreaRef.current) {
      classifiedScrollAreaRef.current.scrollTop = 0;
    }
  }, [showClassifiedView, classifiedTranscript]);

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

  const manualClassifyTranscript = () => {
    try {
      if (!transcript.trim()) {
        toast.warning('No content to classify');
        return;
      }

      if (setIsClassifying) {
        setIsClassifying(true);
      }
      
      setTimeout(() => {
        try {
          const classified = classifyTranscript(transcript);
          
          if (onToggleView) {
            onToggleView();
          }
          toast.success('Speaker classification completed');
        } catch (error) {
          console.error('Error during speaker classification:', error);
          toast.error('Failed to classify speakers');
        } finally {
          if (setIsClassifying) {
            setIsClassifying(false);
          }
        }
      }, 800);
    } catch (error) {
      console.error('Error during speaker classification:', error);
      toast.error('Failed to classify speakers');
      if (setIsClassifying) {
        setIsClassifying(false);
      }
    }
  };

  const formattedTranscript = React.useMemo(() => {
    if (!transcript) return '';
    
    const paragraphs = transcript
      .split(/\n+/)
      .filter(p => p.trim().length > 0);
    
    if (paragraphs.length === 0) {
      return '<div class="text-muted-foreground text-center italic h-full flex items-center justify-center">Transcript will appear here...</div>';
    }
    
    const processedTranscript = paragraphs.map(paragraph => {
      const speakerMatch = paragraph.match(/^\[(Doctor|Patient|Identifying)\]:/);
      
      if (speakerMatch) {
        const speaker = speakerMatch[1];
        const content = paragraph.replace(/^\[(Doctor|Patient|Identifying)\]:/, '').trim();
        
        const speakerClass = speaker === 'Doctor' ? 'text-doctor-primary font-semibold' : 
                            (speaker === 'Patient' ? 'text-doctor-accent font-semibold' : 
                            'text-muted-foreground font-semibold');
        
        return `<div class="transcript-paragraph">
          <span class="${speakerClass}">[${speaker}]:</span> ${content}
        </div>`;
      }
      
      return `<div class="transcript-paragraph">${paragraph}</div>`;
    }).join('');
    
    return processedTranscript;
  }, [transcript]);

  const formattedClassifiedTranscript = React.useMemo(() => {
    if (!classifiedTranscript) return '';
    
    const paragraphs = classifiedTranscript
      .split(/\n+/)
      .filter(p => p.trim().length > 0);
    
    if (paragraphs.length === 0) {
      return '<div class="text-muted-foreground text-center italic">No classified content yet</div>';
    }
    
    const processedTranscript = paragraphs.map(paragraph => {
      const speakerMatch = paragraph.match(/^\[(Doctor|Patient|Identifying)\]:/);
      
      if (speakerMatch) {
        const speaker = speakerMatch[1];
        const content = paragraph.replace(/^\[(Doctor|Patient|Identifying)\]:/, '').trim();
        
        const speakerClass = speaker === 'Doctor' ? 'text-doctor-primary font-semibold' : 
                            (speaker === 'Patient' ? 'text-doctor-accent font-semibold' : 
                            'text-muted-foreground font-semibold');
        
        return `<div class="transcript-paragraph">
          <span class="${speakerClass}">[${speaker}]:</span> ${content}
        </div>`;
      }
      
      return `<div class="transcript-paragraph">${paragraph}</div>`;
    }).join('');
    
    return processedTranscript;
  }, [classifiedTranscript]);
  
  if (isClassifying) {
    return (
      <Card className="border-2 border-doctor-accent/30 animate-pulse">
        <CardHeader className="pb-1 pt-2 px-3 bg-gradient-to-r from-doctor-accent/10 to-transparent flex flex-row justify-between items-center">
          <div className="flex items-center gap-1.5">
            <RotateCw className="h-4 w-4 text-doctor-accent animate-spin" />
            <CardTitle className="text-base text-doctor-accent font-medium">
              Enhancing Transcript
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          <div className="flex flex-col items-center justify-center gap-2 py-8">
            <RotateCw className="h-10 w-10 text-doctor-accent animate-spin" />
            <div className="text-center">
              <p className="font-medium text-doctor-accent text-lg">{classifyingFeedback || 'Enhancing transcript clarity'}</p>
              <p className="text-muted-foreground">Identifying speakers and formatting content...</p>
            </div>
            <div className="w-full max-w-md space-y-3 mt-4">
              <Skeleton className="h-4 w-3/4 bg-doctor-accent/20" />
              <Skeleton className="h-4 w-4/5 bg-doctor-accent/15" />
              <Skeleton className="h-4 w-2/3 bg-doctor-accent/20" />
              <Skeleton className="h-4 w-3/4 bg-doctor-accent/15" />
              <Skeleton className="h-4 w-1/2 bg-doctor-accent/20" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (showClassifiedView && classifiedTranscript) {
    return (
      <Card className="border-2 border-doctor-accent/30 animate-fade-in">
        <CardHeader className="pb-1 pt-2 px-3 bg-gradient-to-r from-doctor-accent/10 to-transparent flex flex-row justify-between items-center">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4 text-doctor-accent" />
            <CardTitle className="text-base text-doctor-accent font-medium">
              Enhanced Transcript
            </CardTitle>
          </div>
          <div className="flex gap-1">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => copyToClipboard(classifiedTranscript, 'Enhanced transcript copied')}
              className="h-7 text-doctor-accent hover:text-doctor-accent/80 hover:bg-doctor-accent/10 border-doctor-accent"
            >
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copy
            </Button>
            {onToggleView && (
              <Button
                variant="outline" 
                size="sm"
                onClick={onToggleView}
                className="h-7 text-doctor-secondary hover:text-doctor-secondary/80 hover:bg-doctor-secondary/10 border-doctor-secondary"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />
                Original
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea 
            className="max-h-[400px] min-h-[120px] overflow-auto"
            ref={classifiedScrollAreaRef}
            scrollHideDelay={0}
          >
            <div 
              className="p-3 w-full bg-muted rounded-md"
              style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
              dangerouslySetInnerHTML={{ 
                __html: formattedClassifiedTranscript || 
                "<div class='text-muted-foreground text-center italic'>No enhanced transcript available</div>"
              }}
            />
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-doctor-secondary/30">
      <CardHeader className="pb-1 pt-2 px-3 bg-gradient-to-r from-doctor-secondary/10 to-transparent flex flex-row justify-between items-center">
        <div className="flex items-center gap-1.5">
          <AlignJustify className="h-4 w-4 text-doctor-secondary" />
          <CardTitle className="text-base text-doctor-secondary font-medium">Transcript</CardTitle>
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
          {classifiedTranscript && onToggleView && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={onToggleView}
              className="h-7 text-doctor-accent hover:text-doctor-accent/80 hover:bg-doctor-accent/10 border-doctor-accent"
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              Enhanced
            </Button>
          )}
          {!classifiedTranscript && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={manualClassifyTranscript}
              disabled={!transcript.length || isRecording}
              className="h-7 text-doctor-accent hover:text-doctor-accent/80 hover:bg-doctor-accent/10 border-doctor-accent"
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              Enhance
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm"
            onClick={isEditing ? handleSave : handleEdit}
            disabled={!transcript.length || isRecording}
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
          <ScrollArea 
            className={`${transcript ? 'h-auto' : 'h-[120px]'} max-h-[400px] min-h-[120px] overflow-auto`}
            ref={scrollAreaRef}
            scrollHideDelay={0}
          >
            <div 
              ref={contentRef} 
              className="p-3 w-full bg-muted rounded-md"
              style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
              dangerouslySetInnerHTML={{ 
                __html: formattedTranscript || 
                "<div class='text-muted-foreground text-center italic h-full flex items-center justify-center'>Transcript will appear here...</div>"
              }}
            />
          </ScrollArea>
        )}
      </CardContent>

      <style>
        {`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-fade-in {
          animation: fadeIn 0.5s ease forwards;
        }
        
        .transcript-paragraph {
          margin-bottom: 0.75rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px dotted rgba(0,0,0,0.05);
          line-height: 1.5;
        }
        `}
      </style>
    </Card>
  );
};

export default TranscriptEditor;
