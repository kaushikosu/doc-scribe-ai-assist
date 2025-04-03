import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Edit, Save, Check, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

interface PrescriptionGeneratorProps {
  transcript: string;
}

const PrescriptionGenerator: React.FC<PrescriptionGeneratorProps> = ({ transcript }) => {
  const [prescription, setPrescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editablePrescription, setEditablePrescription] = useState('');

  useEffect(() => {
    if (transcript.length > 0) {
      generatePrescription(transcript);
    } else {
      setPrescription('');
      setEditablePrescription('');
    }
  }, [transcript]);

  const generatePrescription = (transcriptText: string) => {
    // This is a simple prescription template generator
    // In a real application, this would use more sophisticated NLP/AI
    try {
      // Extract potential medications (just a simple demo extraction)
      const medications = extractMedications(transcriptText);
      const symptoms = extractSymptoms(transcriptText);
      
      // Create a prescription template
      const generatedPrescription = `
PRESCRIPTION

Date: ${new Date().toLocaleDateString()}

Patient presenting with: ${symptoms.join(', ')}

MEDICATIONS:
${medications.map((med, index) => `${index + 1}. ${med}`).join('\n')}

INSTRUCTIONS:
- Take medications as directed
- Return for follow-up in 2 weeks
- Contact immediately if symptoms worsen

Dr. [Doctor Name]
      `.trim();
      
      setPrescription(generatedPrescription);
      setEditablePrescription(generatedPrescription);
    } catch (error) {
      console.error('Error generating prescription:', error);
      toast.error('Error generating prescription template');
    }
  };

  const extractMedications = (text: string): string[] => {
    // This is a very simple extraction for demo purposes
    // A real implementation would use medical NLP/AI models
    const commonMedications = [
      'Paracetamol', 'Ibuprofen', 'Aspirin', 'Amoxicillin',
      'Azithromycin', 'Metformin', 'Omeprazole', 'Atorvastatin'
    ];
    
    return commonMedications
      .filter(med => text.toLowerCase().includes(med.toLowerCase()))
      .map(med => {
        // Add some random dosing info for demo purposes
        const dosages = ['500mg twice daily', '250mg once daily', '1 tablet three times daily'];
        const randomDosage = dosages[Math.floor(Math.random() * dosages.length)];
        return `${med} - ${randomDosage}`;
      });
  };

  const extractSymptoms = (text: string): string[] => {
    // Simple extraction for demo
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
              disabled={!transcript.length}
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
            {prescription || "Prescription will be generated here..."}
          </div>
        )}
      </CardContent>
      {prescription && !isEditing && (
        <CardFooter className="pt-0">
          <Button 
            className="mt-2 w-full bg-doctor-accent hover:bg-doctor-accent/90"
            onClick={() => {
              toast.success('Prescription saved to patient records');
            }}
          >
            <Check className="h-4 w-4 mr-2" />
            Save to Patient Records
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default PrescriptionGenerator;
