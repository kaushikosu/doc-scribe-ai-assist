
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, User } from 'lucide-react';

interface DocHeaderProps {
  patientInfo: {
    name: string;
    time: string;
  };
}

const DocHeader: React.FC<DocHeaderProps> = ({ patientInfo }) => {
  return (
    <div className="flex items-center justify-center mb-6">
      <Card className="bg-doctor-primary text-white w-full">
        <CardContent className="p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">DocScribe AI Assistant</h1>
              <p className="text-doctor-primary-foreground/80">Voice-powered medical documentation</p>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4" />
              <p className="text-sm text-doctor-primary-foreground/80">
                Patient: <span className="font-medium">
                  {patientInfo.name || "New Session"}
                </span>
              </p>
            </div>
            <p className="text-sm text-doctor-primary-foreground/80">
              Date: <span className="font-medium">{new Date().toLocaleDateString()}</span>
              {patientInfo.time && <span> | Time: {patientInfo.time}</span>}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DocHeader;
