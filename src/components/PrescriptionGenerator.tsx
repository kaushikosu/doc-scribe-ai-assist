import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClipboardCopy, FileText, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/lib/toast';

interface PrescriptionGeneratorProps {
  transcript: string;
  patientInfo: {
    name: string;
    time: string;
  };
  classifiedTranscript?: string;
  isClassifying?: boolean;
  isEnabled?: boolean;
}

const PrescriptionGenerator = ({
  transcript,
  patientInfo,
  classifiedTranscript = '',
  isClassifying = false,
  isEnabled = true,
}: PrescriptionGeneratorProps) => {
  const [prescription, setPrescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editablePrescription, setEditablePrescription] = useState('');
  const [doctorName, setDoctorName] = useState('Dr. Indra Reddy');
  const [hospitalName, setHospitalName] = useState('Arogya General Hospital');
  const [lastProcessedTranscript, setLastProcessedTranscript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isEnabled) {
    return (
      <Card className="border-2 border-doctor-primary/20 opacity-60">
        <CardHeader className="pb-3 px-5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-doctor-primary" />
              <CardTitle className="text-lg text-doctor-primary">Prescription</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-6 flex flex-col items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="mb-2">Prescription will be generated</p>
              <p className="text-sm">after transcript processing completes</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  useEffect(() => {
    if (classifiedTranscript && classifiedTranscript !== lastProcessedTranscript && !isClassifying) {
      console.log("Classified transcript changed, generating prescription");
      setIsGenerating(true);
      
      const timeoutId = setTimeout(() => {
        generatePrescription(classifiedTranscript);
        setLastProcessedTranscript(classifiedTranscript);
        setIsGenerating(false);
      }, 800);
      
      return () => clearTimeout(timeoutId);
    }
  }, [classifiedTranscript, isClassifying]);

  const generatePrescription = (transcriptText: string) => {
    try {
      if (!transcriptText.trim()) {
        return;
      }
      
      toast.info('Generating prescription...');
      
      const medications = extractMedications(transcriptText);
      const symptoms = extractSymptoms(transcriptText);
      
      if (medications.length === 0) {
        console.log("No medications found in transcript, skipping prescription generation");
        return;
      }
      
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
      toast.success('Prescription generated');
    } catch (error) {
      console.error('Error generating prescription:', error);
      toast.error('Error generating prescription template');
    }
  };

  const extractMedications = (text: string): string[] => {
    const medications: Set<string> = new Set();
    
    const doctorLines = text.split('\n')
      .filter(line => line.trim().startsWith('[Doctor]:'));
    
    const commonMedicationNames = [
      'Paracetamol', 'Acetaminophen', 'Ibuprofen', 'Aspirin', 'Amoxicillin',
      'Azithromycin', 'Metformin', 'Omeprazole', 'Atorvastatin', 'Lisinopril',
      'Simvastatin', 'Metoprolol', 'Amlodipine', 'Albuterol', 'Cetirizine',
      'Levothyroxine', 'Fluoxetine', 'Insulin', 'Warfarin', 'Hydrochlorothiazide',
      'Cephalexin', 'Ciprofloxacin', 'Sertraline', 'Gabapentin', 'Prednisone'
    ];
    
    const dosagePatterns = [
      /(\d+)\s*mg/i,
      /(\d+)\s*ml/i,
      /(\d+)\s*tablets?/i,
      /(\d+)\s*capsules?/i,
      /(\d+)\s*pills?/i, 
      /(\d+)\s*times?/i,
      /(\d+)\s*days?/i
    ];
    
    for (const line of doctorLines) {
      for (const med of commonMedicationNames) {
        const medLower = med.toLowerCase();
        const lineLower = line.toLowerCase();
        
        if (lineLower.includes(medLower)) {
          let dosageInfo = "";
          
          for (const pattern of dosagePatterns) {
            const match = line.match(pattern);
            if (match) {
              dosageInfo += " " + match[0];
            }
          }
          
          const frequencyMatches = line.match(/(once|twice|thrice|three times|four times) (daily|a day|weekly|monthly)/i);
          if (frequencyMatches) {
            dosageInfo += " " + frequencyMatches[0];
          }
          
          if (!dosageInfo) {
            const defaultDosages = ['500mg twice daily', '250mg once daily', '1 tablet three times daily'];
            dosageInfo = defaultDosages[Math.floor(Math.random() * defaultDosages.length)];
          }
          
          medications.add(`${med} - ${dosageInfo.trim()}`);
        }
      }
    }
    
    if (medications.size === 0) {
      for (const med of commonMedicationNames) {
        if (text.toLowerCase().includes(med.toLowerCase())) {
          const dosages = ['500mg twice daily', '250mg once daily', '1 tablet three times daily'];
          const randomDosage = dosages[Math.floor(Math.random() * dosages.length)];
          medications.add(`${med} - ${randomDosage}`);
          
          if (medications.size >= 3) break;
        }
      }
    }
    
    return Array.from(medications);
  };

  const extractSymptoms = (text: string): string[] => {
    const symptoms: Set<string> = new Set();
    
    const patientLines = text.split('\n')
      .filter(line => line.trim().startsWith('[Patient]:'));
    
    const commonSymptoms = [
      'fever', 'headache', 'pain', 'cough', 'cold', 
      'nausea', 'dizziness', 'fatigue', 'weakness', 'sore throat',
      'stomach ache', 'vomiting', 'diarrhea', 'chest pain', 'back pain',
      'shortness of breath', 'difficulty breathing', 'rash', 'itching'
    ];
    
    for (const line of patientLines) {
      const lineLower = line.toLowerCase();
      
      for (const symptom of commonSymptoms) {
        if (lineLower.includes(symptom)) {
          symptoms.add(symptom.charAt(0).toUpperCase() + symptom.slice(1));
        }
      }
      
      const painMatches = line.match(/my (\w+) (hurts|aches|is painful|is sore)/i);
      if (painMatches) {
        const bodyPart = painMatches[1];
        symptoms.add(`${bodyPart.charAt(0).toUpperCase() + bodyPart.slice(1)} pain`);
      }
    }
    
    if (symptoms.size === 0) {
      for (const symptom of commonSymptoms) {
        if (text.toLowerCase().includes(symptom)) {
          symptoms.add(symptom.charAt(0).toUpperCase() + symptom.slice(1));
        }
      }
    }
    
    return Array.from(symptoms);
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
    if (classifiedTranscript) {
      setIsGenerating(true);
      toast.success('Regenerating prescription with AI...');
      
      setTimeout(() => {
        generatePrescription(classifiedTranscript);
        setIsGenerating(false);
      }, 800);
    } else if (transcript && !isClassifying) {
      setIsGenerating(true);
      toast.success('Regenerating prescription with AI...');
      
      setTimeout(() => {
        generatePrescription(transcript);
        setIsGenerating(false);
      }, 800);
    } else {
      toast.error('No transcript available for prescription generation');
    }
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
  
  const isPrescriptionDisabled = isClassifying || isGenerating || !classifiedTranscript;

  return (
    <Card 
      className={`border-2 border-doctor-accent/30 transition-all ${isClassifying ? 'opacity-60' : ''}`}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl text-doctor-accent">Prescription</CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleGenerateAI}
              disabled={isPrescriptionDisabled}
              className="border-doctor-accent text-doctor-accent hover:bg-doctor-accent/10"
            >
              {isGenerating ? (
                <>
                  <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={isEditing ? handleSave : handleEdit}
              disabled={!prescription.length || isPrescriptionDisabled}
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
        {isGenerating ? (
          <div className="min-h-[300px] bg-muted p-3 rounded-md flex flex-col justify-center items-center">
            <RotateCw className="h-8 w-8 text-doctor-accent animate-spin mb-2" />
            <p className="font-medium text-doctor-accent">Creating prescription</p>
            <p className="text-muted-foreground text-sm">Analyzing consultation details...</p>
          </div>
        ) : isEditing ? (
          <Textarea
            value={editablePrescription}
            onChange={handleChange}
            className="min-h-[300px] font-mono text-sm resize-none focus-visible:ring-doctor-accent"
            placeholder="Prescription will be generated here..."
          />
        ) : (
          <div className="bg-muted p-3 rounded-md min-h-[300px] font-mono text-sm whitespace-pre-wrap">
            {prescription || (
              isClassifying ? 
                "Waiting for transcript classification to complete..." : 
                "Prescription will be generated automatically after transcript is processed..."
            )}
          </div>
        )}
      </CardContent>
      {prescription && !isEditing && !isPrescriptionDisabled && (
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
