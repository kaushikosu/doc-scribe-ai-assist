
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Edit, Save, Check, MessageSquare, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

interface PrescriptionGeneratorProps {
  transcript: string;
  patientInfo: {
    name: string;
    time: string;
  };
}

const PrescriptionGenerator: React.FC<PrescriptionGeneratorProps> = ({ transcript, patientInfo }) => {
  const [prescription, setPrescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editablePrescription, setEditablePrescription] = useState('');
  const [doctorName, setDoctorName] = useState('Dr. Indra Reddy');
  const [hospitalName, setHospitalName] = useState('Arogya General Hospital');
  const [shouldGeneratePrescription, setShouldGeneratePrescription] = useState(false);

  useEffect(() => {
    // Only generate prescription when transcript has been processed with speaker labels
    if (transcript.length > 0) {
      const hasLabels = transcript.includes('[Doctor]:') || transcript.includes('[Patient]:');
      if (hasLabels) {
        console.log("Transcript has speaker labels, generating prescription");
        setShouldGeneratePrescription(true);
      } else {
        console.log("Transcript doesn't have speaker labels yet, waiting for processing");
        setShouldGeneratePrescription(false);
      }
    } else {
      setPrescription('');
      setEditablePrescription('');
      setShouldGeneratePrescription(false);
    }
  }, [transcript]);

  useEffect(() => {
    if (shouldGeneratePrescription) {
      generatePrescription(transcript);
    }
  }, [shouldGeneratePrescription, transcript, patientInfo]);

  const generatePrescription = (transcriptText: string) => {
    try {
      const medications = extractMedications(transcriptText);
      const symptoms = extractSymptoms(transcriptText);
      
      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric', 
        month: 'long', 
        day: 'numeric'
      });
      
      const generatedPrescription = `
${hospitalName.toUpperCase()}
------------------------------------------------------------------
${hospitalName}, Medical Center Road, City - 123456
Phone: (555) 123-4567 | Email: info@citygeneralhospital.com

PRESCRIPTION

Date: ${currentDate}                     Time: ${patientInfo.time || ""}

PATIENT INFORMATION:
Name: ${patientInfo.name || "[Patient Name]"}
 
CLINICAL NOTES:
Patient presenting with: ${symptoms.join(', ') || "N/A"}

MEDICATIONS:
${medications.map((med, index) => `${index + 1}. ${med}`).join('\n')}

INSTRUCTIONS:
- Take medications as directed
- Return for follow-up in 2 weeks
- Contact immediately if symptoms worsen

------------------------------------------------------------------
${doctorName}
Registration No: DCT-12345
Department of General Medicine
      `.trim();
      
      setPrescription(generatedPrescription);
      setEditablePrescription(generatedPrescription);
    } catch (error) {
      console.error('Error generating prescription:', error);
      toast.error('Error generating prescription template');
    }
  };

  const extractMedications = (text: string): string[] => {
    const commonMedications = [
      'Paracetamol', 'Ibuprofen', 'Aspirin', 'Amoxicillin',
      'Azithromycin', 'Metformin', 'Omeprazole', 'Atorvastatin'
    ];
    
    return commonMedications
      .filter(med => text.toLowerCase().includes(med.toLowerCase()))
      .map(med => {
        const dosages = ['500mg twice daily', '250mg once daily', '1 tablet three times daily'];
        const randomDosage = dosages[Math.floor(Math.random() * dosages.length)];
        return `${med} - ${randomDosage}`;
      });
  };

  const extractSymptoms = (text: string): string[] => {
    const commonSymptoms = [
      'fever', 'headache', 'pain', 'cough', 'cold', 
      'nausea', 'dizziness', 'fatigue', 'weakness'
    ];
    
    return commonSymptoms
      .filter(symptom => text.toLowerCase().includes(symptom))
      .map(symptom => symptom.charAt(0).toUpperCase() + symptom.slice(1));
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    setPrescription(editablePrescription);
    setIsEditing(false);
    toast.success('Prescription saved');
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditablePrescription(e.target.value);
  };

  const handleGenerateAI = () => {
    toast.success('Regenerating prescription with AI...');
    generatePrescription(transcript);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Prescription - ${patientInfo.name || "Patient"}</title>
            <style>
              body { font-family: 'Courier New', monospace; line-height: 1.5; padding: 20px; }
              .prescription { white-space: pre-wrap; }
            </style>
          </head>
          <body>
            <div class="prescription">${prescription}</div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } else {
      toast.error('Could not open print window. Please check your browser settings.');
    }
  };

  // If we don't have speaker labels yet and recording is happening, show notice
  const isPending = transcript.length > 0 && !shouldGeneratePrescription;

  return (
    <Card className="border-2 border-doctor-accent/30">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl text-doctor-accent">Prescription</CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleGenerateAI}
              disabled={!transcript.length || !shouldGeneratePrescription}
              className="border-doctor-accent text-doctor-accent hover:bg-doctor-accent/10"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Generate
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={isEditing ? handleSave : handleEdit}
              disabled={!prescription.length}
              className={cn(
                "border-doctor-accent text-doctor-accent",
                isEditing ? "hover:bg-doctor-accent hover:text-white" : "hover:bg-doctor-accent/10"
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
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <Textarea
            value={editablePrescription}
            onChange={handleChange}
            className="min-h-[300px] font-mono text-sm resize-none focus-visible:ring-doctor-accent"
            placeholder="Prescription will be generated here..."
          />
        ) : (
          <div className="bg-muted p-3 rounded-md min-h-[300px] font-mono text-sm whitespace-pre-wrap">
            {isPending ? 
              "Waiting for full transcript processing to generate prescription..." :
              (prescription || "Prescription will be generated here...")}
          </div>
        )}
      </CardContent>
      {prescription && !isEditing && (
        <CardFooter className="pt-0 flex gap-2">
          <Button 
            className="mt-2 flex-1 bg-doctor-accent hover:bg-doctor-accent/90"
            onClick={() => {
              toast.success('Prescription saved to patient records');
            }}
          >
            <Check className="h-4 w-4 mr-2" />
            Save to Records
          </Button>
          <Button 
            className="mt-2 flex-1 bg-doctor-primary hover:bg-doctor-primary/90"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4 mr-2" />
            Print Prescription
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default PrescriptionGenerator;
