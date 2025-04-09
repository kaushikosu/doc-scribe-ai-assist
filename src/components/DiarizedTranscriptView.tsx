
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Mic, FileAudio, RotateCw, CheckCircle, Download, FileText, Loader } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/lib/toast';
import { DiarizedTranscription, formatDiarizedTranscript, mapSpeakerRoles } from '@/utils/diarizedTranscription';

interface DiarizedTranscriptViewProps {
  diarizedData: DiarizedTranscription | null;
  isProcessing: boolean;
  recordingDuration?: string;
  isRecording?: boolean;
  audioBlob?: Blob | null;
}

const DiarizedTranscriptView: React.FC<DiarizedTranscriptViewProps> = ({
  diarizedData,
  isProcessing,
  recordingDuration = "0:00",
  isRecording = false,
  audioBlob = null
}) => {
  const [showMappedRoles, setShowMappedRoles] = useState(true);
  
  // Format the diarized transcript
  const formattedTranscript = React.useMemo(() => {
    if (!diarizedData || !diarizedData.words.length) return '';
    
    const rawTranscript = formatDiarizedTranscript(diarizedData.words);
    return showMappedRoles ? mapSpeakerRoles(rawTranscript) : rawTranscript;
  }, [diarizedData, showMappedRoles]);

  const handleCopyTranscript = () => {
    if (formattedTranscript) {
      navigator.clipboard.writeText(formattedTranscript);
      toast.success('Diarized transcript copied to clipboard');
    }
  };

  const toggleRoleMapping = () => {
    setShowMappedRoles(prev => !prev);
  };
  
  const handleDownloadRecording = () => {
    if (!audioBlob) {
      toast.error("No recording available to download");
      return;
    }
    
    // Create a URL for the blob
    const url = URL.createObjectURL(audioBlob);
    
    // Create a link element to trigger the download
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Recording download started');
  };

  // Get the appropriate status message
  const getStatusMessage = () => {
    if (isRecording) {
      return {
        title: "Recording audio",
        description: "Recording conversation for later diarization...",
        icon: <Mic className="h-8 w-8 text-doctor-accent animate-pulse" />
      };
    }
    
    if (isProcessing) {
      return {
        title: "Processing audio",
        description: "Identifying speakers with Google diarization...",
        icon: <RotateCw className="h-8 w-8 text-doctor-accent animate-spin" />
      };
    }
    
    if (audioBlob && !isProcessing && !diarizedData) {
      return {
        title: "Recording available",
        description: "Audio captured and ready for transcription",
        icon: <FileAudio className="h-8 w-8 text-doctor-accent" />
      };
    }
    
    if (!audioBlob && !diarizedData) {
      return {
        title: "Waiting for recording",
        description: "Record a conversation to see diarized transcript",
        icon: <FileAudio className="h-8 w-8 text-muted-foreground" />
      };
    }
    
    if (diarizedData && diarizedData.words.length === 0 && !diarizedData.error) {
      return {
        title: "Processing complete",
        description: "No speech detected in the recording",
        icon: <CheckCircle className="h-8 w-8 text-yellow-500" />
      };
    }
    
    return null;
  };

  // Render diarized transcript with speaker formatting
  const renderFormattedTranscript = () => {
    if (!formattedTranscript) {
      return <div className="text-muted-foreground text-center italic">No diarized transcript available</div>;
    }

    const paragraphs = formattedTranscript.split('\n\n');
    
    return paragraphs.map((paragraph, index) => {
      // Identify speaker label
      const match = paragraph.match(/^\[(Doctor|Patient|Speaker \d+)\]:/);
      
      if (match) {
        const speakerLabel = match[1];
        const content = paragraph.substring(paragraph.indexOf(':') + 1).trim();
        
        const labelClass = 
          speakerLabel === 'Doctor' ? 'text-doctor-primary font-semibold' : 
          speakerLabel === 'Patient' ? 'text-doctor-accent font-semibold' : 
          'text-gray-600 font-semibold';
        
        return (
          <div key={index} className="mb-3 pb-2 border-b border-gray-100">
            <span className={labelClass}>[{speakerLabel}]:</span> {content}
          </div>
        );
      }
      
      return <div key={index} className="mb-3">{paragraph}</div>;
    });
  };

  const statusMessage = getStatusMessage();

  return (
    <Card className="border-2 border-doctor-accent/30">
      <CardHeader className="pb-1 pt-2 px-3 bg-gradient-to-r from-doctor-accent/10 to-transparent flex flex-row justify-between items-center">
        <div className="flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-doctor-accent" />
          <CardTitle className="text-base text-doctor-accent font-medium">
            Diarized Transcript {recordingDuration && `(${recordingDuration})`}
          </CardTitle>
        </div>
        <div className="flex gap-1">
          {audioBlob && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadRecording}
              className="h-7 text-doctor-secondary hover:text-doctor-secondary/80 hover:bg-doctor-secondary/10 border-doctor-secondary"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Download
            </Button>
          )}
          {diarizedData && diarizedData.words.length > 0 && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={toggleRoleMapping}
                className="h-7 text-doctor-secondary hover:text-doctor-secondary/80 hover:bg-doctor-secondary/10 border-doctor-secondary"
              >
                {showMappedRoles ? 'Show Speaker Numbers' : 'Show Doctor/Patient'}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleCopyTranscript}
                className="h-7 text-doctor-accent hover:text-doctor-accent/80 hover:bg-doctor-accent/10 border-doctor-accent"
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copy
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {statusMessage ? (
          <div className="p-3 min-h-[120px]">
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              {statusMessage.icon}
              <div className="text-center">
                <p className="font-medium text-doctor-accent">{statusMessage.title}</p>
                <p className="text-muted-foreground text-sm">
                  {statusMessage.description}
                </p>
                {audioBlob && statusMessage.title === "Recording available" && (
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadRecording}
                      className="text-doctor-secondary border-doctor-secondary"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download Recording
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : diarizedData?.error ? (
          <div className="p-3 min-h-[120px] text-center">
            <div className="p-4 rounded-md bg-red-50 text-red-800 my-4">
              <p className="font-medium">Error processing diarized transcript</p>
              <p className="text-sm">{diarizedData.error}</p>
              {audioBlob && (
                <div className="mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadRecording}
                    className="text-doctor-secondary border-doctor-secondary"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download Recording
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px] min-h-[120px] overflow-auto">
            <div className="p-3 w-full bg-muted rounded-md">
              {renderFormattedTranscript()}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default DiarizedTranscriptView;
