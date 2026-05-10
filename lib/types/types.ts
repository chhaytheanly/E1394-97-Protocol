export type AbnormalFlag = 'N' | 'H' | 'L' | 'NF' | 'HF' | 'LF' | 'F' | null;

export interface LabReport {
  header: HeaderInfo;
  patient: PatientInfo;
  results: TestResult[];
  images: ImageArtifact[];
}

export interface HeaderInfo {
  analyzer: string | null;
  softwareVersion: string | null;
  serialNumber: string | null;
}

export interface PatientInfo {
  sampleId: string | null;
  gender: 'Male' | 'Female' | 'Other' | null;
}

export interface TestResult {
  testCode: string;
  value: number | string | null;
  unit: string | null;
  abnormalFlag: AbnormalFlag;
  timestamp: string | null; 
}

export interface ImageArtifact {
  testCode: string;
  fileType: string;
  fileName: string;
  timestamp: string | null;
}

export interface TestAbnormality {
  testCode: string;
  value: number;
  status: 'NORMAL' | 'LOW' | 'HIGH' | 'CRITICAL_LOW' | 'CRITICAL_HIGH';
  referenceMin?: number;
  referenceMax?: number;
  criticalMin?: number;
  criticalMax?: number;
  deviation?: number; 
}
