
import React from 'react';
import { RotateCw, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecordingStatusProps {
  isRecording: boolean;
  isProcessing: boolean;
  detectedLanguage?: string;
  isNewSession: boolean;
  showPatientIdentified: boolean;
}

const RecordingStatus: React.FC<RecordingStatusProps> = ({
  isRecording,
  isProcessing,
  detectedLanguage = "default",
  isNewSession,
  showPatientIdentified
}) => {
  // Get connection status display info
  const getConnectionStatusInfo = () => {
    if (isProcessing) {
      return {
        color: "bg-blue-500",
        text: "Processing",
        subtext: "Processing transcript...",
        icon: <RotateCw className="h-4 w-4 animate-spin" />
      };
    }

    if (isRecording) {
      return {
        color: "bg-green-500",
        text: "Recording",
        subtext: `Using ${detectedLanguage} language`,
        icon: <Globe className="h-4 w-4" />
      };
    } else {
      return {
        color: "bg-slate-400",
        text: "Ready",
        subtext: "Press record to start",
        icon: <Globe className="h-4 w-4" />
      };
    }
  };

  const statusInfo = getConnectionStatusInfo();

  return (
    <>
      <div className="text-center">
        {isRecording ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full animate-pulse bg-destructive"></span>
              <span className="font-medium">Recording</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Using Web Speech Recognition ({detectedLanguage})
            </div>
          </div>
        ) : isProcessing ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-blue-500 animate-pulse"></span>
              <span className="font-medium">Processing</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Processing transcript...
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">
            {isNewSession ? 
              "Start with 'Hello [patient name]' or 'Hi [patient name]'" : 
              "Press to resume recording"
            }
          </span>
        )}
      </div>
      
      {/* Patient identified animation - only shows temporarily */}
      {showPatientIdentified && (
        <div className="animate-fade-in text-sm font-medium text-doctor-accent">
          Patient identified!
        </div>
      )}
      
      {/* Connection status indicator */}
      <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-gray-50">
        <div className={cn("h-3 w-3 rounded-full", statusInfo.color)}></div>
        <div className="flex flex-col">
          <div className="text-sm font-medium flex items-center gap-1">
            {statusInfo.icon}
            <span>{statusInfo.text}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {statusInfo.subtext}
          </div>
        </div>
      </div>
    </>
  );
};

export default RecordingStatus;
