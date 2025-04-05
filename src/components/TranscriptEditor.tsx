import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Edit, Save, Copy, AlignJustify, Users, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/lib/toast';
import { detectSpeaker, ConversationContext } from '@/utils/speaker';

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
  const [isClassifying, setIsClassifying] = useState(false);
  const [classifiedText, setClassifiedText] = useState("");
  const [showClassified, setShowClassified] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const classifiedScrollAreaRef = useRef<HTMLDivElement>(null);

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

  const classifySpeakers = () => {
    try {
      setIsClassifying(true);
      toast.info('Classifying speakers in transcript...');
      
      // Split the transcript into paragraphs/sentences
      const paragraphs = transcript
        .split(/\n+/)
        .filter(p => p.trim().length > 0);
      
      if (paragraphs.length === 0) {
        toast.warning('No content to classify');
        setIsClassifying(false);
        return;
      }

      // Initialize conversation context
      let context: ConversationContext = {
        isPatientDescribingSymptoms: false,
        doctorAskedQuestion: false,
        patientResponded: false,
        isPrescribing: false,
        isGreeting: false,
        lastSpeaker: 'Doctor', // Starting assumption
        isFirstInteraction: true,
        turnCount: 0
      };

      // Process each paragraph to determine speaker
      let classified = '';
      
      paragraphs.forEach((paragraph, index) => {
        // Skip already classified paragraphs
        if (paragraph.match(/^\[(Doctor|Patient|Identifying)\]:/)) {
          classified += paragraph + '\n\n';
          
          // Update context based on existing classification
          const speakerMatch = paragraph.match(/^\[(Doctor|Patient|Identifying)\]:/);
          if (speakerMatch && speakerMatch[1]) {
            context.lastSpeaker = speakerMatch[1] as 'Doctor' | 'Patient' | 'Identifying';
          }
          
          return;
        }
        
        // Detect speaker for this paragraph
        const speaker = detectSpeaker(paragraph, context);
        
        // Add speaker label to the paragraph
        classified += `[${speaker}]: ${paragraph}\n\n`;
        
        // Update context for next iteration
        context.lastSpeaker = speaker;
        context.isFirstInteraction = false;
        context.turnCount++;
        
        // Update other context flags based on content
        context.doctorAskedQuestion = paragraph.includes('?') && speaker === 'Doctor';
        context.isPatientDescribingSymptoms = 
          speaker === 'Patient' && 
          (/pain|hurt|feel|symptom|problem|issue/i.test(paragraph));
        context.isPrescribing = 
          speaker === 'Doctor' && 
          (/prescribe|take|medicine|medication|treatment|therapy|dose/i.test(paragraph));
      });
      
      // Set the classified text
      setClassifiedText(classified.trim());
      setShowClassified(true);
      toast.success('Speaker classification completed');
      
    } catch (error) {
      console.error('Error during speaker classification:', error);
      toast.error('Failed to classify speakers');
    } finally {
      setIsClassifying(false);
    }
  };

  // Process and format the transcript with improved chunking and speaker labels
  const formattedTranscript = React.useMemo(() => {
    if (!transcript) return '';
    
    // Process transcript to highlight speaker labels
    const processedTranscript = transcript.split('\n\n').map(paragraph => {
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
    
    // Process transcript to highlight speaker labels
    const processedTranscript = classifiedText.split('\n\n').map(paragraph => {
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

  // Calculate dynamic height based on content (with min and max constraints)
  const getContentHeight = () => {
    if (!transcript) return 'min-h-[120px]';
    const lineCount = transcript.split(/\n/).length;
    
    // Each line is roughly 24px, add padding
    const estimatedHeight = Math.min(Math.max(lineCount * 24, 120), 400);
    return `h-[${estimatedHeight}px]`;
  };

  return (
    <>
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
              onClick={copyToClipboard}
              disabled={!transcript.length}
              className="h-7 text-doctor-primary hover:text-doctor-primary/80 hover:bg-doctor-primary/10 border-doctor-primary"
            >
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={classifySpeakers}
              disabled={!transcript.length || isClassifying}
              className="h-7 text-doctor-accent hover:text-doctor-accent/80 hover:bg-doctor-accent/10 border-doctor-accent"
            >
              <Users className="h-3.5 w-3.5 mr-1" />
              {isClassifying ? "Processing..." : "Classify"}
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
            <ScrollArea 
              className={`${transcript ? 'h-auto' : 'h-[120px]'} max-h-[400px] min-h-[120px] overflow-auto`}
              ref={scrollAreaRef}
              scrollHideDelay={0}
            >
              <div 
                ref={contentRef} 
                className={`p-3 w-full bg-muted rounded-md`}
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

      {/* Classified Transcript Box */}
      {showClassified && classifiedText && (
        <Card className="border-2 border-doctor-accent/30 mt-4">
          <CardHeader className="pb-1 pt-2 px-3 bg-gradient-to-r from-doctor-accent/10 to-transparent flex flex-row justify-between items-center">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-doctor-accent" />
              <CardTitle className="text-base text-doctor-accent font-medium">Classified Transcript</CardTitle>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(classifiedText);
                toast.success('Classified transcript copied');
              }}
              className="h-7 text-doctor-accent hover:text-doctor-accent/80 hover:bg-doctor-accent/10 border-doctor-accent"
            >
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copy
            </Button>
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
                  "<div class='text-muted-foreground text-center italic'>No classified content yet</div>"
                }}
              />
            </ScrollArea>
          </CardContent>
        </Card>
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
    </>
  );
};

export default TranscriptEditor;
