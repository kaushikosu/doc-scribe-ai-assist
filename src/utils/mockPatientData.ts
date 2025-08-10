// Mock patient data generator for ABDM compliance
export interface MockPatientData {
  name: string;
  abhaId: string;
  age: number;
  gender: string;
  phone: string;
  address: string;
  emergencyContact: string;
  medicalHistory: string;
  bloodGroup: string;
  allergies: string;
  sessionStartTime: string;
}

const firstNames = [
  'Arjun', 'Priya', 'Rohit', 'Sneha', 'Amit', 'Kavya', 'Vikram', 'Ananya',
  'Rajesh', 'Meera', 'Suresh', 'Divya', 'Kiran', 'Pooja', 'Manoj', 'Shruti',
  'Ramesh', 'Neha', 'Anil', 'Ritu', 'Deepak', 'Swati', 'Rakesh', 'Nisha'
];

const lastNames = [
  'Sharma', 'Patel', 'Kumar', 'Singh', 'Gupta', 'Jain', 'Agarwal', 'Verma',
  'Yadav', 'Mishra', 'Reddy', 'Nair', 'Chopra', 'Bansal', 'Tiwari', 'Shah'
];

const cities = [
  'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad',
  'Pune', 'Ahmedabad', 'Surat', 'Jaipur', 'Lucknow', 'Kanpur'
];

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const commonAllergies = [
  'None known', 'Penicillin', 'Dust mites', 'Pollen', 'Shellfish',
  'Nuts', 'Dairy products', 'Latex', 'Aspirin'
];

const medicalHistories = [
  'No significant medical history',
  'Hypertension, well controlled',
  'Type 2 Diabetes Mellitus',
  'Asthma since childhood',
  'Previous surgery for appendicitis',
  'Migraine headaches',
  'Thyroid disorder',
  'Heart disease, stable'
];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateABHAId(): string {
  // ABHA ID format: XX-XXXX-XXXX-XXXX (14 digits)
  const digits = Array.from({ length: 14 }, () => Math.floor(Math.random() * 10)).join('');
  return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10, 14)}`;
}

function generatePhoneNumber(): string {
  // Indian mobile format: +91-XXXXX-XXXXX
  const number = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
  return `+91-${number.slice(0, 5)}-${number.slice(5, 10)}`;
}

export function generateMockPatient(): MockPatientData {
  const firstName = getRandomElement(firstNames);
  const lastName = getRandomElement(lastNames);
  const city = getRandomElement(cities);
  const age = Math.floor(Math.random() * 60) + 20; // Age between 20-80
  
  return {
    name: `${firstName} ${lastName}`,
    abhaId: generateABHAId(),
    age,
    gender: Math.random() > 0.5 ? 'Male' : 'Female',
    phone: generatePhoneNumber(),
    address: `${Math.floor(Math.random() * 999) + 1}, ${getRandomElement(['MG Road', 'Park Street', 'Mall Road', 'Gandhi Nagar'])}, ${city}`,
    emergencyContact: generatePhoneNumber(),
    medicalHistory: getRandomElement(medicalHistories),
    bloodGroup: getRandomElement(bloodGroups),
    allergies: getRandomElement(commonAllergies),
    sessionStartTime: new Date().toLocaleString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  };
}