
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Stethoscope, FileText, User, Building } from 'lucide-react';

interface DocHeaderProps {
  patientInfo: {
    name: string;
    time: string;
  };
}

const DocHeader: React.FC<DocHeaderProps> = ({ patientInfo }) => {
  const doctorName = "Dr. Sarah Johnson";
  const hospitalName = "City General Hospital";

  return (
    <div className="flex flex-col gap-2 mb-6">
      <Card className="bg-doctor-primary text-white w-full">
        <CardContent className="p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-8 w-8" />
              <FileText className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">DocScribe AI Assistant</h1>
              <p className="text-doctor-primary-foreground/80">Voice-powered medical documentation</p>
            </div>
          </div>
          <div className="hidden md:flex flex-col items-end">
            <div className="flex items-center gap-2 mb-1">
              <Building className="h-4 w-4" />
              <p className="text-sm font-medium text-doctor-primary-foreground/90">
                {hospitalName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <p className="text-sm text-doctor-primary-foreground/90">
                Logged in: <span className="font-medium">{doctorName}</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      {patientInfo.name && (
        <div className="bg-doctor-secondary/10 p-2 rounded-md">
          <p className="text-sm text-doctor-secondary font-medium">
            Current patient: {patientInfo.name} | Session started: {patientInfo.time} | {new Date().toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
};

export default DocHeader;
