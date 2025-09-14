
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Edit, Save, Check, MessageSquare, Printer, RotateCw, Settings, MoreHorizontal, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
 // import { MedicalExtraction } from '@/types/medical';

import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';


interface PrescriptionGeneratorProps {
  transcript: string;
  patientInfo: {
    name: string;
    time: string;
  };
  classifiedTranscript?: string;
  isClassifying?: boolean;
  onGeneratingStart?: () => void;
  onGenerated?: (prescription?: string) => void;
  currentPatient?: any;
  sessionId?: string;
  prescription?: string | null;
}

const PrescriptionGenerator: React.FC<PrescriptionGeneratorProps> = ({ 
  transcript, 
  patientInfo,
  classifiedTranscript,
  isClassifying = false,
  onGeneratingStart,
  onGenerated,
  currentPatient,
  sessionId,
  prescription: prescriptionProp
}) => {
  // If prescriptionProp is provided, use it as the displayed prescription
  const [prescription, setPrescription] = useState(prescriptionProp || '');
  const [isEditing, setIsEditing] = useState(false);
  const [editablePrescription, setEditablePrescription] = useState('');
  const [doctorName, setDoctorName] = useState('Dr. Indra Reddy');
  const [hospitalName, setHospitalName] = useState('Arogya General Hospital');
  const [isGenerating, setIsGenerating] = useState(false);
  

  // PM-JAY format toggle and header details (persisted locally)
  const [usePmjayFormat, setUsePmjayFormat] = useState<boolean>(() => {
    const v = localStorage.getItem('usePmjayFormat');
    return v ? v === 'true' : true;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Facility details
  const [hospitalAddress, setHospitalAddress] = useState('Medical Center Road, City - 123456');
  const [hospitalPhone, setHospitalPhone] = useState('(555) 123-4567');
  const [hospitalEmail, setHospitalEmail] = useState('info@citygeneralhospital.com');
  const [empanelmentId, setEmpanelmentId] = useState('');
  const [hfrId, setHfrId] = useState('');

  // Doctor details
  const [doctorRegId, setDoctorRegId] = useState('DCT-12345');
  const [doctorDept, setDoctorDept] = useState('General Medicine');
  const [doctorQualification, setDoctorQualification] = useState('MBBS, MD');

  // Patient identifiers (per visit)
  const [patientBeneficiaryId, setPatientBeneficiaryId] = useState('');
    // Removed: lastProcessedTranscript, medicalExtraction, isExtracting (no longer needed)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pmjayHeader');
      if (stored) {
        const d = JSON.parse(stored);
        setHospitalName(d.hospitalName ?? hospitalName);
        setHospitalAddress(d.hospitalAddress ?? hospitalAddress);
        setHospitalPhone(d.hospitalPhone ?? hospitalPhone);
        setHospitalEmail(d.hospitalEmail ?? hospitalEmail);
        setEmpanelmentId(d.empanelmentId ?? empanelmentId);
        setHfrId(d.hfrId ?? hfrId);
        setDoctorName(d.doctorName ?? doctorName);
        setDoctorRegId(d.doctorRegId ?? doctorRegId);
        setDoctorDept(d.doctorDept ?? doctorDept);
        setDoctorQualification(d.doctorQualification ?? doctorQualification);
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
    // If prescriptionProp changes, update local state
    if (typeof prescriptionProp === 'string') {
      setPrescription(prescriptionProp);
      setEditablePrescription(prescriptionProp);
    }
  }, [prescriptionProp]);

  const generatePrescription = (transcriptText: string): string => {
    // If prescriptionProp is provided, always use it as the source of truth
    if (typeof prescriptionProp === 'string' && prescriptionProp.trim().length > 0) {
      setPrescription(prescriptionProp);
      setEditablePrescription(prescriptionProp);
      return prescriptionProp;
    }
    try {
      if (!transcriptText.trim()) {
        return ''; // Don't generate for empty transcript
      }

      

      const medications = extractMedications(transcriptText);
      const symptoms = extractSymptoms(transcriptText);
      const recommendations = extractRecommendations(transcriptText);

      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Simple diagnosis derivation from symptoms with ICD-10 hints
      const deriveDiagnosis = (syms: string[]) => {
        const map: Record<string, { text: string; icd: string }[]> = {
          'Chest pain': [{ text: 'Chest pain', icd: 'R07.4' }],
          'Cough': [{ text: 'Cough', icd: 'R05' }],
          'Fever': [{ text: 'Fever, unspecified', icd: 'R50.9' }],
          'Shortness of breath': [{ text: 'Dyspnea', icd: 'R06.0' }],
          'Headache': [{ text: 'Headache', icd: 'R51' }],
          'Sore throat': [{ text: 'Acute pharyngitis, unspecified', icd: 'J02.9' }],
          'Diarrhea': [{ text: 'Diarrhea, unspecified', icd: 'R19.7' }],
          'Vomiting': [{ text: 'Nausea and vomiting', icd: 'R11' }],
          'Back pain': [{ text: 'Low back pain', icd: 'M54.5' }],
        };
        const out: { text: string; icd: string }[] = [];
        for (const s of syms) {
          if (map[s]) out.push(...map[s]);
        }
        return out.length ? out : [{ text: 'To be coded', icd: '-' }];
      };

      const diagnosis = deriveDiagnosis(symptoms);

      let generatedPrescription = '';

      if (usePmjayFormat) {
        generatedPrescription = `
${hospitalName.toUpperCase()}
${hospitalAddress}
Phone: ${hospitalPhone}${hospitalEmail ? ` | Email: ${hospitalEmail}` : ''}
${empanelmentId ? `Empanelment ID: ${empanelmentId}` : ''}${empanelmentId && hfrId ? ' | ' : ''}${hfrId ? `HFR ID: ${hfrId}` : ''}
================================================================

Date: ${currentDate}                                  Time: ${patientInfo.time || ''}

PATIENT: ${currentPatient?.name || patientInfo.name || '[Patient Name]'}
Age/Sex: ${currentPatient?.age || '[Age]'}/${currentPatient?.gender || '[Sex]'}
ABHA ID: ${currentPatient?.abha_id || '[ABHA Number]'}

PRESENTING COMPLAINTS:
${symptoms.join(', ') || 'N/A'}

DIAGNOSIS:
${diagnosis.map(d => `${d.text}${d.icd && d.icd !== '-' ? ` (${d.icd})` : ''}`).join('; ') || 'To be coded'}

Rx.
${medications.length ? medications.map((med, idx) => `${idx + 1}. ${med}`).join('\n') : 'None prescribed'}

INVESTIGATIONS:
${recommendations.length ? recommendations.map((rec, idx) => `${idx + 1}. ${rec}`).join('\n') : 'None'}

ADVICE: Rest, adequate hydration, follow medication schedule
FOLLOW-UP: ${recommendations.find(r => r.toLowerCase().includes('follow-up')) || 'As needed'}

Dr. ${doctorName}${doctorQualification ? `, ${doctorQualification}` : ''}
Reg. No: ${doctorRegId} | ${doctorDept}
================================================================
        `.trim();
      } else {
        // Fallback to simple template
        generatedPrescription = `
${hospitalName.toUpperCase()}
------------------------------------------------------------------
Date: ${currentDate}                     Time: ${patientInfo.time || ''}

PATIENT: ${currentPatient?.name || patientInfo.name || '[Patient Name]'}
Age: ${currentPatient?.age || '[Age]'}  Gender: ${currentPatient?.gender || '[Gender]'}

COMPLAINTS: ${symptoms.join(', ') || 'N/A'}

Rx.
${medications.length ? medications.map((med, index) => `${index + 1}. ${med}`).join('\n') : 'N/A'}

INVESTIGATIONS:
${recommendations.length ? recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n') : 'N/A'}

ADVICE: Take medications as directed, follow-up as needed

Dr. ${doctorName}
Registration No: ${doctorRegId}
------------------------------------------------------------------
        `.trim();
      }

      setPrescription(generatedPrescription);
      setEditablePrescription(generatedPrescription);
      
      return generatedPrescription;
    } catch (error) {
      console.error('Error generating prescription:', error);
      return '';
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
    
    // Additional pattern-based detection: capture generic "Name 500 mg ..." forms
    if (medications.size === 0) {
      for (const line of doctorLines) {
        const pattern = /([A-Z][a-zA-Z0-9\-\/]{2,})\s+(\d+)\s*(mg|mcg|g|ml)\b/gi;
        let match;
        while ((match = pattern.exec(line)) !== null) {
          const medName = match[1];
          const dose = `${match[2]} ${match[3]}`;
          // Frequency and schedule detection
          const freqMatch = line.match(/\b(OD|BD|TID|QID|HS|PRN|STAT|once daily|twice daily|thrice daily|three times daily|four times daily|1-0-1|1-1-1|1-0-0|0-1-0|0-0-1)\b/i);
          const freq = freqMatch ? freqMatch[0] : '';
          medications.add(`${medName} - ${dose}${freq ? ' ' + freq : ''}`);
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
    // Only consider patient lines to avoid false positives from doctor questions
    const patientLines = text.split('\n').filter(line => line.trim().startsWith('[Patient]:'));

    // More specific symptom list (avoid generic "pain" to reduce noise)
    const commonSymptoms = [
      'fever', 'headache', 'cough', 'cold', 'nausea', 'dizziness', 'fatigue',
      'weakness', 'sore throat', 'stomach ache', 'vomiting', 'diarrhea',
      'chest pain', 'back pain', 'shortness of breath', 'difficulty breathing',
      'rash', 'itching'
    ];

    for (const rawLine of patientLines) {
      const line = rawLine.replace(/^\s*\[Patient\]:\s*/i, '');
      const lineLower = line.toLowerCase();

      // Chest pain variants
      if (/(chest\s*(pain|discomfort|tightness))|((pain|discomfort|tightness)\s*(in|around)\s*(my\s*)?chest)/i.test(line)) {
        symptoms.add('Chest pain');
      }

      // Generic body part pain e.g., "my lower back hurts"
      const bodyPain = line.match(/(?:my|the)\s+([a-z ]+?)\s+(?:hurts|aches|is\s+(?:painful|sore)|pain)/i);
      if (bodyPain) {
        const part = bodyPain[1].trim();
        const titled = part.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        symptoms.add(`${titled} pain`);
      }

      // Direct mentions while handling negations like "no fever/cough"
      for (const symptom of commonSymptoms) {
        const symPattern = symptom.replace(/\s+/g, '\\s+');
        const negRegex = new RegExp(`\\b(no|not|don't|do not|without|hasn't|haven't|none)\\b[^.]*\\b(${symPattern})\\b`, 'i');
        const posRegex = new RegExp(`\\b(${symPattern})\\b`, 'i');
        if (negRegex.test(lineLower)) continue; // skip negated mentions
        if (posRegex.test(lineLower)) {
          symptoms.add(symptom
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')
          );
        }
      }
    }

    return Array.from(symptoms);
  };

  const extractRecommendations = (text: string): string[] => {
    const recs: Set<string> = new Set();
    const doctorLines = text.split('\n').filter(line => line.trim().startsWith('[Doctor]:'));

    const tests = [
      'ECG', 'EKG', 'ECHO', 'stress test', 'treadmill test', 'X-ray', 'chest X-ray',
      'CT scan', 'MRI', 'ultrasound', 'USG', 'blood test', 'CBC', 'lipid profile',
      'LFT', 'KFT', 'kidney function test', 'liver function test', 'thyroid', 'TSH',
      'T3', 'T4', 'glucose', 'blood sugar', 'CRP', 'D-dimer', 'troponin'
    ];

    for (const rawLine of doctorLines) {
      const line = rawLine.replace(/^\s*\[Doctor\]:\s*/i, '');
      const lower = line.toLowerCase();

      // Detect tests/investigations mentioned with typical action verbs
      const actionRegex = /(order|recommend|suggest|advise|get|schedule|arrange|do|perform|request|take)/i;
      for (const t of tests) {
        if (lower.includes(t.toLowerCase())) {
          // Add the test name in its canonical form
          recs.add(t);
        }
      }

      // Follow-up timing
      const fu = line.match(/follow[- ]?up[^.]*?(?:in|after)\s+(\d+)\s+(days?|weeks?|months?)/i);
      if (fu) {
        recs.add(`Follow-up in ${fu[1]} ${fu[2]}`);
      }

      // Referral detection
      const refer = line.match(/refer(?:\s+you)?\s+to\s+(?:the\s+)?([a-z ]+?)(?:\s+department|\s+clinic)?\b/i);
      if (refer) {
        const dept = refer[1].trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        recs.add(`Referral to ${dept}`);
      }
    }

    return Array.from(recs);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    setPrescription(editablePrescription);
    setIsEditing(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditablePrescription(e.target.value);
  };

  const handleFetchPatientDetails = () => {
  };

const handleGenerateAI = () => {
  if (classifiedTranscript) {
    onGeneratingStart?.();
    setIsGenerating(true);
    
    setTimeout(() => {
      generatePrescription(classifiedTranscript);
      setIsGenerating(false);
      onGenerated?.();
    }, 1500);
  } else if (transcript && !isClassifying) {
    onGeneratingStart?.();
    setIsGenerating(true);
    
    
    setTimeout(() => {
      generatePrescription(transcript);
      setIsGenerating(false);
      onGenerated?.();
    }, 1500);
  } else {
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
      
    }
  };
  
  // Determine if prescription actions should be disabled
  const hasAnyTranscript = Boolean(classifiedTranscript || transcript);
  const isPrescriptionDisabled = isClassifying || isGenerating || !hasAnyTranscript;

  return (
    <Card 
      className={cn("border rounded-lg transition-all bg-transparent shadow-none", isClassifying ? 'opacity-60' : '')}
    >
      <CardHeader className="px-3 py-2 border-b border-doctor-primary/25 bg-doctor-primary/10 shadow-sm">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <CardTitle className="text-lg font-semibold text-foreground">Prescription</CardTitle>

          <div className="flex items-center gap-3 ml-auto">
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogContent className="sm:max-w-[640px]">
                <DialogHeader>
                  <DialogTitle>ABDM Header Details</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Hospital Name</Label>
                    <Input value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Hospital Address</Label>
                    <Input value={hospitalAddress} onChange={(e) => setHospitalAddress(e.target.value)} />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={hospitalPhone} onChange={(e) => setHospitalPhone(e.target.value)} />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input value={hospitalEmail} onChange={(e) => setHospitalEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label>PM-JAY Empanelment ID</Label>
                    <Input value={empanelmentId} onChange={(e) => setEmpanelmentId(e.target.value)} />
                  </div>
                  <div>
                    <Label>HFR ID</Label>
                    <Input value={hfrId} onChange={(e) => setHfrId(e.target.value)} />
                  </div>
                  <div>
                    <Label>Doctor Name</Label>
                    <Input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Doctor Reg./HPR ID</Label>
                    <Input value={doctorRegId} onChange={(e) => setDoctorRegId(e.target.value)} />
                  </div>
                  <div>
                    <Label>Department</Label>
                    <Input value={doctorDept} onChange={(e) => setDoctorDept(e.target.value)} />
                  </div>
                  <div>
                    <Label>Qualification</Label>
                    <Input value={doctorQualification} onChange={(e) => setDoctorQualification(e.target.value)} />
                  </div>

                  <div className="sm:col-span-2 mt-2">
                    <Label className="text-muted-foreground">Patient Identifiers (per visit)</Label>
                  </div>
                  <div>
                    <Label>PM-JAY Beneficiary ID</Label>
                    <Input value={patientBeneficiaryId} onChange={(e) => setPatientBeneficiaryId(e.target.value)} placeholder="e.g., PMJAY-XXXXXXXX" />
                  </div>
                  {/* Removed ABHA and Aadhaar fields as they are not defined in state */}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button>
                  <Button variant="outline" onClick={handleFetchPatientDetails}>Fetch details</Button>
                  {/* Removed Save button as saveHeaderDetails is not defined */}
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="flex gap-2">
              {(!isPrescriptionDisabled && prescription.length > 0) && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  aria-label={isEditing ? "Save prescription" : "Edit prescription"}
                  title={isEditing ? "Save prescription" : "Edit prescription"}
                  onClick={isEditing ? handleSave : handleEdit}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                >
                  {isEditing ? (
                    <Save className="h-4 w-4" />
                  ) : (
                    <Edit className="h-4 w-4" />
                  )}
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="More actions"
                    title="More actions"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleGenerateAI} disabled={isPrescriptionDisabled}>
                    Generate prescription
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                    Header settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={usePmjayFormat}
                    onCheckedChange={(v) => setUsePmjayFormat(Boolean(v))}
                  >
                    ABDM format
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
         {isGenerating ? (
           <div className="min-h-[300px] p-4 rounded-md flex flex-col justify-center items-center">
             <Loader2 className="h-8 w-8 text-doctor-primary animate-spin mb-2" />
             <p className="font-medium text-doctor-primary">
               Generating prescription
             </p>
             <p className="text-muted-foreground text-sm">
               Creating structured prescription...
             </p>
           </div>
         ) : isEditing ? (
          <Textarea
            value={editablePrescription}
            onChange={handleChange}
            className="min-h-[300px] p-4 rounded-md border-0 resize-none focus-visible:ring-primary text-sm font-prescription"
            placeholder="Prescription will be generated here..."
          />
        ) : (
          <div className="p-4 rounded-md min-h-[300px] text-sm whitespace-pre-wrap font-prescription bg-white border border-gray-200">
            {prescription ? (
              prescription
            ) : (
              <span className="font-sans text-muted-foreground block text-center">
                {isClassifying
                  ? "Waiting for transcript classification to complete..."
                  : "Prescription will be generated automatically after transcript is processed..."}
              </span>
            )}
          </div>
        )}
      </CardContent>
      {prescription && !isEditing && !isPrescriptionDisabled && (
        <CardFooter className="pt-0 flex justify-center">
          <Button 
            className="bg-doctor-primary hover:bg-doctor-primary/90 min-w-[140px]"
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
