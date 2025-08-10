import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { User, Clock, Phone, MapPin, Heart, AlertTriangle } from 'lucide-react';
import { MockPatientData } from '@/utils/mockPatientData';

interface PatientInfoBarProps {
  patientData: MockPatientData | null;
}

const PatientInfoBar: React.FC<PatientInfoBarProps> = ({ patientData }) => {
  if (!patientData) return null;

  return (
    <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 mb-4">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Patient Basic Info */}
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold text-sm">{patientData.name}</p>
              <p className="text-xs text-muted-foreground">
                {patientData.age} years, {patientData.gender}
              </p>
            </div>
          </div>

          {/* Session Info */}
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Session Started</p>
              <p className="text-xs text-muted-foreground">{patientData.sessionStartTime}</p>
            </div>
          </div>

          {/* Contact Info */}
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Contact</p>
              <p className="text-xs text-muted-foreground">{patientData.phone}</p>
            </div>
          </div>

          {/* Critical Info */}
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">{patientData.bloodGroup}</p>
              <p className="text-xs text-muted-foreground">
                {patientData.allergies !== 'None known' ? (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                    {patientData.allergies}
                  </span>
                ) : (
                  'No allergies'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* ABHA ID */}
        <div className="mt-3 pt-3 border-t border-primary/20">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">ABHA ID:</span> {patientData.abhaId}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PatientInfoBar;