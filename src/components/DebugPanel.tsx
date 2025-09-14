import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Bug, ChevronDown, ChevronUp } from 'lucide-react';

interface DebugPanelProps {
  liveTranscript: string;
  deepgramTranscript: string;
    deepgramUtterances?: Array<
      | { speaker: string; ts_start: number; ts_end: number; text: string }
      | { speaker: string; start: number; end: number; transcript: string; confidence: number }
    >;
  correctedUtterances?: Array<{
    speaker: string;
    text: string;
    start?: number;
    end?: number;
  }>;
  ir?: any;
  soap?: any;
  prescription?: any;
  isRecording: boolean;
}

const DebugPanel: React.FC<DebugPanelProps> = ({
  liveTranscript,
  deepgramTranscript,
  deepgramUtterances = [],
  correctedUtterances = [],
  ir,
  soap,
  prescription,
  isRecording
}) => {
  // Format corrected utterances for display
  const formatCorrectedUtterances = (utterances: Array<{speaker: string, text: string, start?: number, end?: number}>) => {
    return utterances.map(u =>
      `${u.speaker}${typeof u.start === 'number' && typeof u.end === 'number' ? ` (${u.start}s-${u.end}s)` : ''}: ${u.text}`
    ).join('\n\n');
  };
            {/* Corrected Speakers */}
            <Card className="h-64">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${correctedUtterances.length > 0 ? 'bg-pink-500' : 'bg-muted'}`} />
                  3. Corrected Speakers
                </CardTitle>
                <p className="text-xs text-muted-foreground">Doctor/Patient roles</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-40 overflow-y-auto bg-muted/50 p-3 rounded text-xs leading-relaxed">
                  {correctedUtterances.length > 0 ? (
                    correctedUtterances.map((utterance, index) => (
                      <div key={index} className="mb-3 last:mb-0 border-b border-muted pb-2 last:border-b-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-primary">{utterance.speaker}</span>
                          {typeof utterance.start === 'number' && typeof utterance.end === 'number' && (
                            <span className="text-muted-foreground text-xs">
                              {utterance.start}s - {utterance.end}s
                            </span>
                          )}
                        </div>
                        <p className="text-foreground">{utterance.text}</p>
                      </div>
                    ))
                  ) : (
                    <span className="text-muted-foreground italic">
                      Waiting for speaker correction...
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
  const [isOpen, setIsOpen] = useState(false);

  // Helper function to format text as paragraphs
  const formatParagraphs = (text: string) => {
    if (!text) return [];
    return text.split('\n').filter(p => p.trim().length > 0);
  };

  // Format utterances for display
  const formatUtterances = (utterances: Array<{speaker: string, ts_start: number, ts_end: number, text: string}>) => {
    return utterances.map(u => 
      `${u.speaker} (${u.ts_start}s-${u.ts_end}s): ${u.text}`
    ).join('\n\n');
  };

  return (
    <div className="w-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between bg-muted/50 border-dashed"
          >
            <div className="flex items-center gap-2">
              <Bug size={16} />
              Debug Transcription Pipeline
            </div>
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Live Transcript */}
            <Card className="h-64">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-muted'}`} />
                  1. Live Transcript
                </CardTitle>
                <p className="text-xs text-muted-foreground">Web Speech API (Real-time)</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-40 overflow-y-auto bg-muted/50 p-3 rounded text-xs leading-relaxed">
                  {liveTranscript ? (
                    formatParagraphs(liveTranscript).map((paragraph, index) => (
                      <p key={index} className="mb-2 last:mb-0">
                        {paragraph}
                      </p>
                    ))
                  ) : (
                    <span className="text-muted-foreground italic">
                      {isRecording ? 'Listening...' : 'No live transcript yet'}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Deepgram Transcript */}
            <Card className="h-64">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${deepgramUtterances.length > 0 ? 'bg-blue-500' : 'bg-muted'}`} />
                  2. Deepgram Diarized
                </CardTitle>
                <p className="text-xs text-muted-foreground">Speaker, timing & transcript</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-40 overflow-y-auto bg-muted/50 p-3 rounded text-xs leading-relaxed">
                  {deepgramUtterances.length > 0 ? (
                    deepgramUtterances.map((utterance, index) => {
                      // Type guard for ts_start/text shape
                      const isTs = 'ts_start' in utterance && 'ts_end' in utterance && 'text' in utterance;
                      return (
                        <div key={index} className="mb-3 last:mb-0 border-b border-muted pb-2 last:border-b-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-primary">{utterance.speaker}</span>
                            <span className="text-muted-foreground text-xs">
                              {isTs
                                ? `${utterance.ts_start}s - ${utterance.ts_end}s`
                                : `${'start' in utterance && 'end' in utterance ? `${utterance.start}s - ${utterance.end}s` : ''}`}
                            </span>
                          </div>
                          <p className="text-foreground">
                            {isTs
                              ? utterance.text
                              : 'transcript' in utterance
                                ? utterance.transcript
                                : ''}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-muted-foreground italic">
                      Waiting for audio processing...
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* IR */}
            <Card className="h-64">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${ir ? 'bg-purple-500' : 'bg-muted'}`} />
                  3. IR
                </CardTitle>
                <p className="text-xs text-muted-foreground">Intermediate Representation</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-40 overflow-y-auto bg-muted/50 p-3 rounded text-xs leading-relaxed">
                  {ir ? (
                    <div className="space-y-2">
                      {ir.chief_complaint && (
                        <div>
                          <span className="font-semibold text-primary">Chief Complaint:</span>
                          <p className="ml-2">{ir.chief_complaint}</p>
                        </div>
                      )}
                      {ir.assessment && (
                        <div>
                          <span className="font-semibold text-primary">Assessment:</span>
                          <p className="ml-2">{ir.assessment}</p>
                        </div>
                      )}
                      {ir.plan && (
                        <div>
                          <span className="font-semibold text-primary">Plan:</span>
                          <p className="ml-2">{ir.plan}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic">
                      Waiting for IR processing...
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* SOAP */}
            <Card className="h-64">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${soap ? 'bg-green-500' : 'bg-muted'}`} />
                  4. SOAP
                </CardTitle>
                <p className="text-xs text-muted-foreground">Clinical note format</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-40 overflow-y-auto bg-muted/50 p-3 rounded text-xs leading-relaxed">
                  {soap ? (
                    <div className="space-y-2">
                      {soap.subjective && (
                        <div>
                          <span className="font-semibold text-primary">S:</span>
                          <p className="ml-2">{soap.subjective}</p>
                        </div>
                      )}
                      {soap.objective && (
                        <div>
                          <span className="font-semibold text-primary">O:</span>
                          <p className="ml-2">{soap.objective}</p>
                        </div>
                      )}
                      {soap.assessment && (
                        <div>
                          <span className="font-semibold text-primary">A:</span>
                          <p className="ml-2">{soap.assessment}</p>
                        </div>
                      )}
                      {soap.plan && (
                        <div>
                          <span className="font-semibold text-primary">P:</span>
                          <p className="ml-2">{soap.plan}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic">
                      Waiting for SOAP processing...
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Prescription */}
            <Card className="h-64">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${prescription ? 'bg-orange-500' : 'bg-muted'}`} />
                  5. Prescription
                </CardTitle>
                <p className="text-xs text-muted-foreground">FHIR MedicationRequest</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-40 overflow-y-auto bg-muted/50 p-3 rounded text-xs leading-relaxed">
                  {prescription ? (
                    <div className="space-y-2">
                      {prescription.entry?.length > 0 ? (
                        prescription.entry.map((entry: any, index: number) => (
                          <div key={index} className="border-b border-muted pb-2 last:border-b-0">
                            <span className="font-semibold text-primary">
                              {entry.resource?.medicationCodeableConcept?.text}
                            </span>
                            {entry.resource?.dosageInstruction?.[0] && (
                              <p className="ml-2 text-xs">
                                {entry.resource.dosageInstruction[0].text}
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        <span className="text-muted-foreground italic">No medications prescribed</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic">
                      Waiting for prescription processing...
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="mt-4 text-xs text-muted-foreground">
            <p>This debug panel shows the medical transcript processing pipeline:</p>
            <ul className="mt-2 space-y-1 ml-4">
              <li>• <strong>Live:</strong> Real-time Web Speech API output</li>
              <li>• <strong>Deepgram:</strong> Post-processed diarized transcript with speaker labels & timing</li>
              <li>• <strong>IR:</strong> Intermediate Representation - structured medical data extraction</li>
              <li>• <strong>SOAP:</strong> Clinical note in standard SOAP format</li>
              <li>• <strong>Prescription:</strong> FHIR-compliant medication requests</li>
            </ul>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default DebugPanel;