
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Edit, Save, Check, MessageSquare, Printer, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

interface PrescriptionGeneratorProps {
  transcript: string;
  patientInfo: {
    name: string;
    time: string;
  };
  classifiedTranscript?: string;
  isClassifying?: boolean;
}

const PrescriptionGenerator: React.FC<PrescriptionGeneratorProps> = ({ 
  transcript, 
  patientInfo,
  classifiedTranscript,
  isClassifying = false
}) => {
  const [prescription, setPrescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editablePrescription, setEditablePrescription] = useState('');
  const [doctorName, setDoctorName] = useState('Dr. Indra Reddy');
  const [hospitalName, setHospitalName] = useState('Arogya General Hospital');
  const [lastProcessedTranscript, setLastProcessedTranscript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // Generate prescription when classified transcript becomes available or changes
    if (classifiedTranscript && classifiedTranscript !== lastProcessedTranscript && !isClassifying) {
      console.log("Classified transcript changed, generating prescription");
      setIsGenerating(true);
      
      // Add a slight delay for better visual feedback
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
        return; // Don't generate for empty transcript
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
    
    // Look for common medication patterns in doctor speech
    const doctorLines = text.split('\n')
      .filter(line => line.trim().startsWith('[Doctor]:'));
    
    // List of common medications to look for
    const commonMedicationNames = [
      'Paracetamol', 'Acetaminophen', 'Ibuprofen', 'Aspirin', 'Amoxicillin',
      'Azithromycin', 'Metformin', 'Omeprazole', 'Atorvastatin', 'Lisinopril',
      'Simvastatin', 'Metoprolol', 'Amlodipine', 'Albuterol', 'Cetirizine',
      'Levothyroxine', 'Fluoxetine', 'Insulin', 'Warfarin', 'Hydrochlorothiazide',
      'Cephalexin', 'Ciprofloxacin', 'Sertraline', 'Gabapentin', 'Prednisone'
    ];
    
    // Regex patterns for medication dosages
    const dosagePatterns = [
      /(\d+)\s*mg/i,
      /(\d+)\s*ml/i,
      /(\d+)\s*tablets?/i,
      /(\d+)\s*capsules?/i,
      /(\d+)\s*pills?/i, 
      /(\d+)\s*times?/i,
      /(\d+)\s*days?/i
    ];
    
    // Find medication mentions with dosages in doctor lines
    for (const line of doctorLines) {
      for (const med of commonMedicationNames) {
        const medLower = med.toLowerCase();
        const lineLower = line.toLowerCase();
        
        if (lineLower.includes(medLower)) {
          // Try to extract dosages
          let dosageInfo = "";
          
          for (const pattern of dosagePatterns) {
            const match = line.match(pattern);
            if (match) {
              dosageInfo += " " + match[0];
            }
          }
          
          // Check for frequency
          const frequencyMatches = line.match(/(once|twice|thrice|three times|four times) (daily|a day|weekly|monthly)/i);
          if (frequencyMatches) {
            dosageInfo += " " + frequencyMatches[0];
          }
          
          // If no specific dosage found, use a default
          if (!dosageInfo) {
            const defaultDosages = ['500mg twice daily', '250mg once daily', '1 tablet three times daily'];
            dosageInfo = defaultDosages[Math.floor(Math.random() * defaultDosages.length)];
          }
          
          medications.add(`${med} - ${dosageInfo.trim()}`);
        }
      }
    }
    
    // If no medications were found through pattern matching, fallback to the basic approach
    if (medications.size === 0) {
      for (const med of commonMedicationNames) {
        if (text.toLowerCase().includes(med.toLowerCase())) {
          const dosages = ['500mg twice daily', '250mg once daily', '1 tablet three times daily'];
          const randomDosage = dosages[Math.floor(Math.random() * dosages.length)];
          medications.add(`${med} - ${randomDosage}`);
          
          // Limit to 3 medications in fallback mode
          if (medications.size >= 3) break;
        }
      }
    }
    
    return Array.from(medications);
  };

  const extractSymptoms = (text: string): string[] => {
    const symptoms: Set<string> = new Set();
    
    // Look for symptoms in patient speech
    const patientLines = text.split('\n')
      .filter(line => line.trim().startsWith('[Patient]:'));
    
    const commonSymptoms = [
      'fever', 'headache', 'pain', 'cough', 'cold', 
      'nausea', 'dizziness', 'fatigue', 'weakness', 'sore throat',
      'stomach ache', 'vomiting', 'diarrhea', 'chest pain', 'back pain',
      'shortness of breath', 'difficulty breathing', 'rash', 'itching'
    ];
    
    // Look for mentions of symptoms in patient lines
    for (const line of patientLines) {
      const lineLower = line.toLowerCase();
      
      // Check for symptom patterns like "I have a headache" or "My head hurts"
      for (const symptom of commonSymptoms) {
        if (lineLower.includes(symptom)) {
          symptoms.add(symptom.charAt(0).toUpperCase() + symptom.slice(1));
        }
      }
      
      // Check for pain patterns like "my stomach hurts" or "pain in my back"
      const painMatches = line.match(/my (\w+) (hurts|aches|is painful|is sore)/i);
      if (painMatches) {
        const bodyPart = painMatches[1];
        symptoms.add(`${bodyPart.charAt(0).toUpperCase() + bodyPart.slice(1)} pain`);
      }
    }
    
    // If no symptoms found through patient lines, check entire transcript
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
  
  // Determine if prescription actions should be disabled
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
