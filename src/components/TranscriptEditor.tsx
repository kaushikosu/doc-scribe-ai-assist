import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Edit, Save, Copy, AlignJustify, MessageSquare, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/lib/toast';
import { classifyTranscript } from '@/utils/speaker';
import { Skeleton } from '@/components/ui/skeleton';

interface TranscriptEditorProps {
  transcript: string;
  onTranscriptChange: (transcript: string) => void;
  isRecording: boolean;
}

const TranscriptEditor: React.FC<TranscriptEditorProps> = ({ 
  transcript, 
  onTranscriptChange,
  isRecording
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editableTranscript, setEditableTranscript] = useState(transcript);
  const [classifiedText, setClassifiedText] = useState("");
  const [showClassified, setShowClassified] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [lastProcessedTranscript, setLastProcessedTranscript] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const classifiedScrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditableTranscript(transcript);
    
    // Reset classified transcript view when transcript is empty
    if (!transcript) {
      setClassifiedText("");
      setShowClassified(false);
      setLastProcessedTranscript("");
    }
    
    // Scroll to bottom immediately when transcript updates
    if (scrollAreaRef.current && contentRef.current) {
      const scrollContainer = scrollAreaRef.current;
      scrollContainer.scrollTop = contentRef.current.scrollHeight;
    }
  }, [transcript]);
  
  // Auto-classify transcript when recording stops and transcript changes
  useEffect(() => {
    // Only process if not recording, transcript exists and has changed
    if (!isRecording && transcript && transcript !== lastProcessedTranscript && transcript.trim().length > 0) {
      setIsClassifying(true);
      // Add a small delay to simulate processing and provide visual feedback
      const timeoutId = setTimeout(() => {
        classifyTranscriptText();
        setLastProcessedTranscript(transcript);
      }, 800);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isRecording, transcript]);
  
  // Scroll classified transcript into view when it appears
  useEffect(() => {
    if (showClassified && classifiedScrollAreaRef.current) {
      classifiedScrollAreaRef.current.scrollTop = 0;
    }
  }, [showClassified]);

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

  const classifyTranscriptText = () => {
    try {
      if (!transcript.trim()) {
        toast.warning('No content to classify');
        setIsClassifying(false);
        return;
      }

      // Use the utility function to classify the transcript
      const classified = classifyTranscript(transcript);
      
      // Set the classified text
      setClassifiedText(classified);
      setShowClassified(true);
      setIsClassifying(false);
      toast.success('Speaker classification completed');
      
    } catch (error) {
      console.error('Error during speaker classification:', error);
      toast.error('Failed to classify speakers');
      setIsClassifying(false);
    }
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

  // Format the classified transcript with speaker labels
  const formattedClassifiedTranscript = React.useMemo(() => {
    if (!classifiedText) return '';
    
    // Split into paragraphs for better visualization
    const paragraphs = classifiedText
      .split(/\n+/)
      .filter(p => p.trim().length > 0);
    
    if (paragraphs.length === 0) {
      return '<div class="text-muted-foreground text-center italic">No classified content yet</div>';
    }
    
    // Process transcript to highlight speaker labels
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
  }, [classifiedText]);

  return (
    <>
      {/* Original transcript - hidden when classified version is available */}
      {!showClassified && (
        <Card className={`border-2 border-doctor-secondary/30 transition-all ${isClassifying ? 'opacity-60' : ''}`}>
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
                disabled={!transcript.length || isClassifying}
                className="h-7 text-doctor-primary hover:text-doctor-primary/80 hover:bg-doctor-primary/10 border-doctor-primary"
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copy
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={classifyTranscriptText}
                disabled={!transcript.length || isClassifying}
                className="h-7 text-doctor-accent hover:text-doctor-accent/80 hover:bg-doctor-accent/10 border-doctor-accent"
              >
                {isClassifying ? (
                  <>
                    <RotateCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-3.5 w-3.5 mr-1" />
                    Classify
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={isEditing ? handleSave : handleEdit}
                disabled={!transcript.length || isClassifying}
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
            {isClassifying ? (
              <div className="p-3 min-h-[120px]">
                <div className="flex flex-col items-center justify-center gap-2 py-8">
                  <RotateCw className="h-8 w-8 text-doctor-accent animate-spin" />
                  <div className="text-center">
                    <p className="font-medium text-doctor-accent">Enhancing transcript clarity</p>
                    <p className="text-muted-foreground text-sm">Identifying speakers and formatting content...</p>
                  </div>
                </div>
              </div>
            ) : isEditing ? (
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
        </Card>
      )}

      {/* Classified Transcript Box - Show with animation when available */}
      {(showClassified || isClassifying) && (
        <Card 
          className={`border-2 border-doctor-accent/30 ${showClassified ? 'animate-fade-in' : 'animate-pulse'} ${!showClassified && isClassifying ? 'opacity-60' : ''}`}
        >
          <CardHeader className="pb-1 pt-2 px-3 bg-gradient-to-r from-doctor-accent/10 to-transparent flex flex-row justify-between items-center">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-doctor-accent" />
              <CardTitle className="text-base text-doctor-accent font-medium">
                {isClassifying ? "Processing Transcript" : "Classified Transcript"}
              </CardTitle>
            </div>
            {showClassified && !isClassifying && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => copyToClipboard(classifiedText, 'Classified transcript copied')}
                className="h-7 text-doctor-accent hover:text-doctor-accent/80 hover:bg-doctor-accent/10 border-doctor-accent"
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copy
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {isClassifying && !showClassified ? (
              <div className="p-3 min-h-[120px]">
                <div className="space-y-2 p-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              </div>
            ) : (
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
                    "<div class='text-muted-foreground text-center italic'>Processing transcript...</div>"
                  }}
                />
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

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
