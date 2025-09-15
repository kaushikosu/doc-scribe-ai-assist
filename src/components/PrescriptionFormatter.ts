// src/components/PrescriptionFormatter.ts
import React from 'react';

export function formatPrescriptionString(prescription: any, context: {ir?: any, soap?: any, patientInfo?: any, currentPatient?: any}) {
  if (!prescription || typeof prescription !== 'object' || prescription.resourceType !== 'Bundle') return '';
  const entries = prescription.entry || [];
  // Patient details from app state
  const patientName = context.currentPatient?.name || context.patientInfo?.name || '[Patient Name]';
  const patientAge = context.currentPatient?.age || '[Age]';
  const patientSex = context.currentPatient?.gender || '[Sex]';
  const abhaId = context.currentPatient?.abhaId || '[ABHA Number]';
  // Doctor details from app state
  const doctorName = 'Dr. Indra Reddy';
  const doctorRegId = 'DCT-12345';
  const doctorDept = 'General Medicine';
  const doctorQualification = 'MBBS, MD';
  const hospitalName = 'Arogya General Hospital';
  const hospitalAddress = 'Medical Center Road, City - 123456';
  const hospitalPhone = '(555) 123-4567';
  const hospitalEmail = 'info@citygeneralhospital.com';
  // Visit/clinical context from app state
  const currentDate = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  const currentTime = context.patientInfo?.time || '';
  const assessment = context.ir?.assessment || context.soap?.assessment || '';
  const subjective = context.ir?.chief_complaint || context.soap?.subjective || '';
  const hpi = context.ir?.history_present_illness || '';
  const allergies = context.ir?.allergies || '';
  const objective = context.ir?.physical_exam || context.soap?.objective || '';
  const vitals = context.ir?.vitals || {};
  const vitalsArr = [];
  if (vitals.blood_pressure) vitalsArr.push(`BP: ${vitals.blood_pressure}`);
  if (vitals.heart_rate) vitalsArr.push(`HR: ${vitals.heart_rate}`);
  if (vitals.temperature) vitalsArr.push(`Temp: ${vitals.temperature}`);
  if (vitals.respiratory_rate) vitalsArr.push(`RR: ${vitals.respiratory_rate}`);
  const investigations = context.ir?.investigations || '';
  const plan = context.ir?.plan || context.soap?.plan || '';
  // Compose output
  let prescriptionLines = [];
  prescriptionLines.push(`Dr. ${doctorName}${doctorQualification ? `, ${doctorQualification}` : ''}`);
  prescriptionLines.push(`Reg. No: ${doctorRegId} | ${doctorDept}`);
  prescriptionLines.push(`${hospitalName.toUpperCase()}`);
  prescriptionLines.push(`${hospitalAddress}`);
  prescriptionLines.push(`Phone: ${hospitalPhone}${hospitalEmail ? ` | Email: ${hospitalEmail}` : ''}`);
  prescriptionLines.push('================================================================');
  prescriptionLines.push(`Date: ${currentDate}                                  Time: ${currentTime}`);
  prescriptionLines.push('');
  prescriptionLines.push(`PATIENT: ${patientName}`);
  prescriptionLines.push(`Age/Sex: ${patientAge}/${patientSex}`);
  prescriptionLines.push(`ABHA ID: ${abhaId}`);
  prescriptionLines.push('');
  if (subjective) prescriptionLines.push(`Symptoms: ${subjective}`);
  if (hpi) prescriptionLines.push(`History of Present Illness: ${hpi}`);
  if (allergies) prescriptionLines.push(`Allergies: ${allergies}`);
  if (objective) prescriptionLines.push(`Objective: ${objective}`);
  if (Array.isArray(vitalsArr) && vitalsArr.length) prescriptionLines.push(`Vitals: ${vitalsArr.join(', ')}`);
  if (investigations) prescriptionLines.push(`Investigations: ${investigations}`);
  prescriptionLines.push('');
  if (assessment) prescriptionLines.push(`Assessment: ${assessment}`);
  prescriptionLines.push('');
  prescriptionLines.push('Rx.');
  if (!Array.isArray(entries) || entries.length === 0) {
    prescriptionLines.push('  None prescribed');
  } else {
    entries.forEach((entry: any, idx: number) => {
      const med = entry.resource?.medicationCodeableConcept?.text || 'Medication';
      const dose = entry.resource?.dosageInstruction?.[0]?.text || '';
      prescriptionLines.push(`  ${idx + 1}. ${med}${dose ? ' - ' + dose : ''}`);
    });
  }
  prescriptionLines.push('');
  if (plan) prescriptionLines.push(`Plan / Further Evaluation: ${plan}`);
  if (Array.isArray(context.ir?.warnings) && context.ir.warnings.length > 0) {
    prescriptionLines.push('');
    prescriptionLines.push('Notes:');
    context.ir.warnings.forEach((w: string) => prescriptionLines.push(`- ${w}`));
  }
  prescriptionLines.push('================================================================');
  return prescriptionLines.join('\n');
}
