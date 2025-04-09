
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Mic, FileAudio, RotateCw, CheckCircle, Download, FileText, Loader, AlertCircle, Play, Pause } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/lib/toast';
import { DiarizedTranscription, formatDiarizedTranscript, mapSpeakerRoles } from '@/utils/diarizedTranscription';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface DiarizedTranscriptViewProps {
  diarizedData: DiarizedTranscription | null;
  isProcessing: boolean;
  recordingDuration?: string;
  isRecording?: boolean;
  audioBlob?: Blob | null;
  audioParts?: AudioPart[];
}

export interface AudioPart {
  id: number;
  blob: Blob;
  size: number;
  duration: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  transcript?: string;
  error?: string;
}

const DiarizedTranscriptView: React.FC<DiarizedTranscriptViewProps> = ({
  diarizedData,
  isProcessing,
  recordingDuration = "0:00",
  isRecording = false,
  audioBlob = null,
  audioParts = []
}) => {
  const [showMappedRoles, setShowMappedRoles] = useState(true);
  const [expandedParts, setExpandedParts] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  
  // Create audio URL when audio blob changes
  React.useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
    return undefined;
  }, [audioBlob]);

  // Handle play/pause
  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };
  
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
  
  const handleDownloadRecording = (blob: Blob, filename?: string) => {
    if (!blob) {
      toast.error("No recording available to download");
      return;
    }
    
    // Create a URL for the blob
    const url = URL.createObjectURL(blob);
    
    // Create a link element to trigger the download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
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
        description: `Processing ${audioParts.length > 0 ? audioParts.length + ' audio parts' : 'audio'} for diarization...`,
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
      // Check if we have any successful parts with transcripts
      const hasSuccessfulParts = audioParts.some(part => part.status === 'completed' && part.transcript);
      
      if (hasSuccessfulParts) {
        return {
          title: "Processing complete",
          description: "Some audio parts processed successfully",
          icon: <CheckCircle className="h-8 w-8 text-green-500" />
        };
      }
      
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
      // Check if any audio parts have transcripts
      const partTranscripts = audioParts
        .filter(part => part.status === 'completed' && part.transcript)
        .map(part => part.transcript)
        .join("\n\n")
        .trim();

      if (partTranscripts) {
        return (
          <div className="text-gray-800">
            <div className="mb-2 text-sm text-muted-foreground italic">
              Speaker diarization not available, showing raw transcripts:
            </div>
            {partTranscripts.split("\n\n").map((paragraph, idx) => (
              <div key={idx} className="mb-3 pb-2 border-b border-gray-100">{paragraph}</div>
            ))}
          </div>
        );
      }
      
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

  const formatByteSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Get status icon for audio part
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <FileAudio className="h-4 w-4 text-muted-foreground" />;
      case 'processing':
        return <RotateCw className="h-4 w-4 text-amber-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <FileAudio className="h-4 w-4" />;
    }
  };

  const statusMessage = getStatusMessage();
  
  const countCompletedParts = () => {
    return audioParts.filter(part => part.status === 'completed').length;
  };

  const totalParts = audioParts.length;
  const completedParts = countCompletedParts();
  const hasProcessingParts = audioParts.some(part => part.status === 'processing');
  const hasErrorParts = audioParts.some(part => part.status === 'error');
  
  // Check if we have any transcripts in audio parts
  const hasAnyTranscript = audioParts.some(part => part.status === 'completed' && part.transcript);

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
              onClick={() => handleDownloadRecording(audioBlob)}
              className="h-7 text-doctor-secondary hover:text-doctor-secondary/80 hover:bg-doctor-secondary/10 border-doctor-secondary"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Download
            </Button>
          )}
          {(diarizedData?.words.length > 0 || hasAnyTranscript) && (
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
        {/* Audio player section - NEW */}
        {audioBlob && audioUrl && (
          <div className="p-3 border-b border-gray-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-8 h-8 rounded-full p-0 text-doctor-primary"
                onClick={togglePlayback}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <div className="flex-1">
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  controls
                  className="w-full h-8"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                {audioBlob && `${formatByteSize(audioBlob.size)}`}
              </div>
            </div>
          </div>
        )}
        
        {statusMessage ? (
          <div className="p-3 min-h-[120px]">
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              {statusMessage.icon}
              <div className="text-center">
                <p className="font-medium text-doctor-accent">{statusMessage.title}</p>
                <p className="text-muted-foreground text-sm">
                  {statusMessage.description}
                </p>
                {isProcessing && totalParts > 0 && (
                  <p className="text-xs mt-2 text-muted-foreground">
                    {completedParts} of {totalParts} parts processed
                    {hasProcessingParts && " (processing...)"}
                    {hasErrorParts && " (with errors)"}
                  </p>
                )}
                {audioBlob && statusMessage.title === "Recording available" && (
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadRecording(audioBlob)}
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
                    onClick={() => handleDownloadRecording(audioBlob)}
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
          <div className="flex flex-col">
            {/* Audio parts section - Updated to show more details */}
            {audioParts.length > 0 && (
              <div className="border-b border-gray-200 p-2">
                <Accordion 
                  type="single" 
                  collapsible 
                  className="w-full"
                  defaultValue="audio-parts" 
                  value={expandedParts ? "audio-parts" : undefined}
                  onValueChange={(val) => setExpandedParts(val === "audio-parts")}
                >
                  <AccordionItem value="audio-parts">
                    <AccordionTrigger className="py-2 text-sm font-medium">
                      Recording Parts ({audioParts.length}) - {completedParts} completed
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 text-sm">
                        {audioParts.map((part) => (
                          <div key={part.id} className={`flex items-center justify-between p-2 rounded-md ${
                            part.status === 'completed' ? 'bg-green-50' : 
                            part.status === 'processing' ? 'bg-amber-50' : 
                            part.status === 'error' ? 'bg-red-50' : 'bg-muted'
                          }`}>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(part.status)}
                              <span>Part {part.id}</span>
                              <span className="text-xs text-muted-foreground">
                                ({formatByteSize(part.size)}, {formatDuration(part.duration)})
                              </span>
                            </div>
                            <div className="flex gap-2">
                              {part.status === 'processing' && (
                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded flex items-center gap-1">
                                  <RotateCw className="h-2.5 w-2.5 animate-spin" />
                                  Processing...
                                </span>
                              )}
                              {part.status === 'completed' && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded flex items-center gap-1">
                                  <CheckCircle className="h-2.5 w-2.5" />
                                  {part.transcript ? 'Transcribed' : 'No speech detected'}
                                </span>
                              )}
                              {part.status === 'error' && (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded flex items-center gap-1" title={part.error}>
                                  <AlertCircle className="h-2.5 w-2.5" />
                                  Failed
                                </span>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadRecording(part.blob, `recording-part-${part.id}.webm`)}
                                className="h-6 px-2"
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}

            {/* Transcript display */}
            {(formattedTranscript || hasAnyTranscript) && (
              <ScrollArea className="max-h-[400px] min-h-[120px] overflow-auto">
                <div className="p-3">
                  {renderFormattedTranscript()}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DiarizedTranscriptView;
