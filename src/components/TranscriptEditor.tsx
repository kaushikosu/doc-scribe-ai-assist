
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Edit, Save, Copy, AlignJustify, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/lib/toast';
import { processMediaStream } from '@/utils/googleSpeechToText';

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
  const [isDiarizing, setIsDiarizing] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const audioDataRef = useRef<Blob | null>(null);

  useEffect(() => {
    setEditableTranscript(transcript);
    
    // Scroll to bottom immediately when transcript updates
    if (scrollAreaRef.current && contentRef.current) {
      const scrollContainer = scrollAreaRef.current;
      scrollContainer.scrollTop = contentRef.current.scrollHeight;
    }
  }, [transcript]);

  // Effect to capture audio for diarization
  useEffect(() => {
    // Set up audio recording when component mounts
    const setupAudioRecording = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const audioChunks: BlobPart[] = [];
        
        mediaRecorder.addEventListener("dataavailable", event => {
          audioChunks.push(event.data);
        });
        
        mediaRecorder.addEventListener("stop", () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          audioDataRef.current = audioBlob;
        });
        
        // Start recording
        mediaRecorder.start();
        
        // Cleanup function to stop recording when component unmounts
        return () => {
          mediaRecorder.stop();
          stream.getTracks().forEach(track => track.stop());
        };
      } catch (error) {
        console.error("Error setting up audio recording:", error);
      }
    };
    
    setupAudioRecording();
  }, []);

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

  const handleDiarize = async () => {
    if (!audioDataRef.current) {
      toast.error('No audio data available for diarization');
      return;
    }
    
    try {
      setIsDiarizing(true);
      toast.info('Processing audio for speaker diarization...');
      
      const apiKey = import.meta.env.VITE_GOOGLE_SPEECH_API_KEY;
      if (!apiKey) {
        toast.error('Google Speech API key not configured');
        setIsDiarizing(false);
        return;
      }
      
      // Process the audio data with Google Speech API
      const results = await processMediaStream(audioDataRef.current, apiKey);
      
      if (results && results.length > 0) {
        // Format results with speaker labels
        let diarizedText = '';
        const speakerMap = new Map<number, string>();
        
        results.forEach(result => {
          if (result.speakerTag !== undefined) {
            const speakerLabel = result.speakerTag === 1 ? 'Doctor' : 'Patient';
            speakerMap.set(result.speakerTag, speakerLabel);
            
            diarizedText += `[${speakerLabel}]: ${result.transcript}\n\n`;
          } else {
            // No speaker tag, just add the transcript
            diarizedText += `${result.transcript}\n\n`;
          }
        });
        
        onTranscriptChange(diarizedText);
        toast.success('Diarization completed successfully');
      } else {
        toast.warning('No diarization results were returned');
      }
    } catch (error) {
      console.error('Error during diarization:', error);
      toast.error('Failed to diarize transcript');
    } finally {
      setIsDiarizing(false);
    }
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
    const estimatedHeight = Math.min(Math.max(lineCount * 24, 120), 400);
    return `h-[${estimatedHeight}px]`;
  };

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
            onClick={handleDiarize}
            disabled={!transcript.length || isDiarizing}
            className="h-7 text-doctor-accent hover:text-doctor-accent/80 hover:bg-doctor-accent/10 border-doctor-accent"
          >
            <Users className="h-3.5 w-3.5 mr-1" />
            {isDiarizing ? "Processing..." : "Diarize"}
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
