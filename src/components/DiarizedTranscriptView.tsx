import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Mic, FileAudio, RotateCw, CheckCircle, Download, FileText, Clock } from 'lucide-react';
import { toast } from '@/lib/toast';
import { DiarizedTranscription } from '@/utils/diarizedTranscription';
import { DiarizedUtterance } from '@/types/diarization';

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
  
  
  // Format the diarized transcript - use transcript directly from diarizedData
  const formattedTranscript = React.useMemo(() => {
    if (!diarizedData || !diarizedData.transcript) return '';
    return diarizedData.transcript;
  }, [diarizedData]);

  const handleCopyTranscript = () => {
    if (formattedTranscript) {
      navigator.clipboard.writeText(formattedTranscript);
      toast.success('Revised transcript copied to clipboard');
    }
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
        title: "Processing full audio",
        description: "Identifying speakers with Deepgram diarization...",
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
    
    if (diarizedData && !diarizedData.transcript && !diarizedData.error) {
      return {
        title: "Processing complete",
        description: "No speech detected in the recording",
        icon: <CheckCircle className="h-8 w-8 text-yellow-500" />
      };
    }
    
    return null;
  };

  // Render utterances in structured format or fallback to formatted transcript
  const renderTranscriptContent = () => {
    if (!diarizedData) {
      return <div className="text-muted-foreground text-center italic">No diarized transcript available</div>;
    }

    // If we have structured utterances, render them
    if (diarizedData.utterances && diarizedData.utterances.length > 0) {
      return renderStructuredUtterances(diarizedData.utterances);
    }

    // Fallback to formatted transcript
    if (formattedTranscript) {
      return renderFormattedTranscript();
    }

    return <div className="text-muted-foreground text-center italic">No diarized transcript available</div>;
  };

  // Render structured utterances with timing and confidence
  const renderStructuredUtterances = (utterances: any[]) => {
    return utterances.map((utterance, index) => {
      const speakerNormalized = utterance.speaker?.toUpperCase?.() || '';
      const roleColor = speakerNormalized === 'DOCTOR' 
        ? 'text-blue-600 font-semibold' 
        : speakerNormalized === 'PATIENT'
        ? 'text-green-600 font-semibold'
        : 'text-purple-600 font-semibold';

      const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(1);
        return `${mins}:${secs.padStart(4, '0')}`;
      };

      // Check if timing information is available
      const hasTiming = utterance.ts_start !== undefined && utterance.ts_end !== undefined;
      const hasConfidence = utterance.asr_conf !== undefined;

      return (
        <div key={index} className="mb-4 p-3 rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-2">
            <span className={`${roleColor} text-sm font-medium`}>
              [{utterance.speaker}]
            </span>
            {hasTiming && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime(utterance.ts_start)} - {formatTime(utterance.ts_end)}
                </span>
                {hasConfidence && (
                  <span className="text-xs">
                    {Math.round(utterance.asr_conf * 100)}% conf
                  </span>
                )}
              </div>
            )}
          </div>
          <p className="text-sm leading-relaxed text-gray-700">{utterance.text}</p>
        </div>
      );
    });
  };

  // Render diarized transcript with speaker formatting (fallback)
  const renderFormattedTranscript = () => {
    if (!formattedTranscript) {
      return <div className="text-muted-foreground text-center italic">No diarized transcript available</div>;
    }

    const lines = formattedTranscript.split('\n');
    
    return lines.map((line, index) => {
      // Identify speaker label
      const match = line.match(/^\s*Speaker\s+(\d+):/);
      
      if (match) {
        const sp = parseInt(match[1], 10);
        const role = sp === 0 ? 'Doctor' : sp === 1 ? 'Patient' : `Speaker ${sp}`;
        const content = line.substring(line.indexOf(':') + 1).trim();
        
        // Styling for speaker labels using design tokens
        const labelClass = 'text-muted-foreground font-semibold'; 
        
        return (
          <div key={index} className="mb-3 pb-2 border-b border-gray-100">
            <span className={labelClass}>[{role}]:</span> {content}
          </div>
        );
      }
      
      return <div key={index} className="mb-3">{line}</div>;
    });
  };

  const statusMessage = getStatusMessage();

  return (
    <Card className="border-2 border-doctor-accent/30">
      <CardHeader className="pb-1 pt-2 px-3 bg-gradient-to-r from-doctor-accent/10 to-transparent flex flex-row justify-between items-center">
        <div className="flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-doctor-accent" />
          <CardTitle className="text-base text-doctor-accent font-medium">
            Revised Transcript {recordingDuration && `(${recordingDuration})`}
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
          {diarizedData && diarizedData.transcript && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleCopyTranscript}
              className="h-7 text-doctor-accent hover:text-doctor-accent/80 hover:bg-doctor-accent/10 border-doctor-accent"
            >
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copy
            </Button>
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
            </div>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px] min-h-[120px] overflow-auto">
            <div className="p-3 w-full bg-muted rounded-md">
              {renderTranscriptContent()}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default DiarizedTranscriptView;
