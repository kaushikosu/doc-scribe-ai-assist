import React from 'react';
import { User, Clock, Calendar } from 'lucide-react';
import { Patient } from '@/integrations/supabase/patients';

interface PatientSessionBarProps {
  patient: Patient | null;
  sessionStartTime?: string;
}

const PatientSessionBar: React.FC<PatientSessionBarProps> = ({ 
  patient, 
  sessionStartTime 
}) => {
  if (!patient) return null;

  const formatSessionTime = (timeString?: string) => {
    if (!timeString) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return timeString;
  };

  const getCurrentDate = () => {
    return new Date().toLocaleDateString([], { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className="bg-white border-b border-border shadow-sm">
      <div className="container max-w-6xl">
        <div className="flex items-center justify-between py-3">
          {/* Patient Info */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-semibold text-lg text-foreground">
                  {patient.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {patient.age ? `${patient.age} years` : 'Age not specified'} • {patient.gender || 'Gender not specified'}
                </p>
              </div>
            </div>

            {patient.abha_id && (
              <div className="hidden md:block">
                <p className="text-sm font-medium text-foreground">ABHA ID</p>
                <p className="text-sm text-muted-foreground">{patient.abha_id}</p>
              </div>
            )}
          </div>

          {/* Session Info */}
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end">
                <Calendar className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium text-foreground">{getCurrentDate()}</p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end">
                <Clock className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">Session Started</p>
                  <p className="text-sm text-muted-foreground">{formatSessionTime(sessionStartTime)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientSessionBar;