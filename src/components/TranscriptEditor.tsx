
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Edit, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  useEffect(() => {
    setEditableTranscript(transcript);
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

  return (
    <Card className="border-2 border-doctor-secondary/30">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl text-doctor-secondary">Transcript</CardTitle>
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
            className="min-h-[200px] resize-none focus-visible:ring-doctor-secondary"
            placeholder="Transcript will appear here..."
          />
        ) : (
          <div className="bg-muted p-3 rounded-md min-h-[200px] whitespace-pre-wrap">
            {transcript || "Transcript will appear here..."}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TranscriptEditor;
