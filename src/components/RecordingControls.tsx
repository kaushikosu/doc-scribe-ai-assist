
import React from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecordingControlsProps {
  isRecording: boolean;
  isProcessing: boolean;
  onToggleRecording: () => void;
  onNewPatient: () => void;
}

const RecordingControls: React.FC<RecordingControlsProps> = ({
  isRecording,
  isProcessing,
  onToggleRecording,
  onNewPatient
}) => {
  return (
    <div className="flex space-x-4">
      <Button 
        onClick={onToggleRecording}
        className={cn(
          "w-16 h-16 rounded-full flex justify-center items-center shadow-lg transition-all",
          isRecording 
            ? "bg-destructive hover:bg-destructive/90" 
            : "bg-doctor-primary hover:bg-doctor-primary/90"
        )}
        disabled={isProcessing}
      >
        {isRecording ? (
          <MicOff className="h-8 w-8" />
        ) : (
          <Mic className="h-8 w-8" />
        )}
      </Button>
      
      <Button
        onClick={onNewPatient}
        className="w-16 h-16 rounded-full flex justify-center items-center bg-doctor-accent hover:bg-doctor-accent/90 shadow-lg transition-all"
        disabled={isRecording || isProcessing}
      >
        <UserPlus className="h-8 w-8" />
      </Button>
    </div>
  );
};

export default RecordingControls;
