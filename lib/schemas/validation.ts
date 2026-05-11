import { z } from 'zod';

export const AbnormalFlagSchema = z.enum(['N', 'H', 'L', 'NF', 'HF', 'LF', 'F']).nullable();
export const GenderSchema = z.enum(['Male', 'Female', 'Other']).nullable();
export const ParseStatusSchema = z.enum(['SUCCESS', 'PARTIAL', 'FAILED']);
export const SourceFormatSchema = z.enum(['HL7_V2', 'HL7_V3', 'XML', 'CSV']);
export const FlagTypeSchema = z.enum(['WARNING', 'ERROR', 'INFO']);
export const AuditActionSchema = z.enum(['CREATED', 'MODIFIED', 'VALIDATED', 'ACCESSED', 'DELETED']);
export const RoleSchema = z.enum(['ADMIN', 'TECHNICIAN', 'CLINICIAN', 'VIEWER']);
export const HeaderInfoSchema = z.object({
  analyzer: z.string().min(1).max(100),
  softwareVersion: z.string().max(50).nullable(),
  serialNumber: z.string().max(50).nullable(),
});


export const PatientInfoSchema = z.object({
  sampleId: z.string().min(1).max(100),
  gender: GenderSchema,
  age: z.number().int().min(0).max(150).optional(),
  patientId: z.string().max(100).optional(),
});


export const TestResultSchema = z.object({
  testCode: z.string().min(1).max(50),
  value: z.union([z.number(), z.string()]).nullable(),
  unit: z.string().max(50).nullable(),
  abnormalFlag: AbnormalFlagSchema,
  timestamp: z.string().datetime().nullable(),
  referenceMin: z.number().optional(),
  referenceMax: z.number().optional(),
  criticalMin: z.number().optional(),
  criticalMax: z.number().optional(),
  qualityScore: z.number().min(0).max(100).optional(),
  comments: z.string().optional(),
});

export const ImageArtifactSchema = z.object({
  testCode: z.string().min(1).max(50),
  fileType: z.string().min(2).max(10),
  fileName: z.string().min(1).max(255),
  timestamp: z.string().datetime().nullable(),
  fileSize: z.number().int().positive().optional(),
  fileHash: z.string().length(64).optional(), // SHA256
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  quality: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  storageProvider: z.enum(['LOCAL', 'S3', 'GCS', 'AZURE']).default('LOCAL'),
});

// Quality flag validation
export const QualityFlagSchema = z.object({
  flagType: FlagTypeSchema,
  code: z.string().min(1).max(50),
  message: z.string().min(1).max(500),
  severity: z.number().int().min(1).max(5),
  testCode: z.string().max(50).optional(),
  metadata: z.record(z.any()).optional(),
});

export const RawLabReportSchema = z.object({
  header: HeaderInfoSchema,
  patient: PatientInfoSchema,
  results: z.array(TestResultSchema).default([]),
  images: z.array(ImageArtifactSchema).default([]),
  qualityFlags: z.array(QualityFlagSchema).default([]),
});

export const LabReportDatabaseSchema = z.object({
  id: z.string().cuid().optional(),
  analyzerId: z.string().min(1).max(100),
  analyzerModel: z.string().min(1).max(100),
  softwareVersion: z.string().max(50).nullable(),
  serialNumber: z.string().max(50).nullable(),
  sampleId: z.string().min(1).max(100),
  patientGender: z.string().max(20).nullable(),
  testTimestamp: z.string().datetime(),
  sourceFormat: SourceFormatSchema,
  parserVersion: z.string().max(20),
  parseStatus: ParseStatusSchema,
  parseErrors: z.string().optional(), 
  isEncrypted: z.boolean().default(true),
  hipaaCompliant: z.boolean().default(true),
  dataRetentionDays: z.number().int().default(2555),
  results: z.array(TestResultSchema),
  imageArtifacts: z.array(ImageArtifactSchema),
  qualityFlags: z.array(QualityFlagSchema),
});

export const ReferenceRangeSchema = z.object({
  testCode: z.string().min(1).max(50),
  analyzerModel: z.string().min(1).max(100),
  ageMin: z.number().int().min(0).max(150).optional(),
  ageMax: z.number().int().min(0).max(150).optional(),
  gender: z.enum(['M', 'F', 'B']).optional(),
  referenceMin: z.number().optional(),
  referenceMax: z.number().optional(),
  criticalMin: z.number().optional(),
  criticalMax: z.number().optional(),
  unit: z.string().min(1).max(50),
  source: z.enum(['MANUFACTURER', 'LOCAL_LAB', 'CLINICAL_GUIDELINE']),
  notes: z.string().optional(),
});

export const AnalyzerSchema = z.object({
  id: z.string().cuid().optional(),
  model: z.string().min(1).max(100),
  manufacturer: z.string().min(1).max(100),
  softwareVersions: z.array(z.string()).default([]),
  format: SourceFormatSchema,
  delimiter: z.string().length(1).default('|'),
  fieldDelimiter: z.string().length(1).default('^'),
  supportedTests: z.array(z.string()).default([]),
  defaultUnit: z.string().optional(),
  notes: z.string().optional(),
});

// User validation
export const UserSchema = z.object({
  id: z.string().cuid().optional(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: RoleSchema,
  permissions: z.array(z.string()).default([]),
  allowedAnalyzers: z.array(z.string()).optional(),
  mfaEnabled: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const UserCreateSchema = UserSchema.extend({
  password: z.string().min(12).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain uppercase, lowercase, number, and special character'
  ),
});

export const AuditLogSchema = z.object({
  action: AuditActionSchema,
  userId: z.string().cuid().optional(),
  ipAddress: z.string().ipv4().optional(),
  userAgent: z.string().optional(),
  changedFields: z.array(z.string()).optional(),
  reason: z.string().optional(),
  status: z.enum(['SUCCESS', 'FAILED']).default('SUCCESS'),
  errorMessage: z.string().optional(),
});

export const ParseErrorSchema = z.object({
  lineNumber: z.number().int().positive(),
  recordType: z.string(),
  rawLine: z.string(),
  error: z.string(),
  severity: FlagTypeSchema,
});

export type AbnormalFlag = z.infer<typeof AbnormalFlagSchema>;
export type Gender = z.infer<typeof GenderSchema>;
export type ParseStatus = z.infer<typeof ParseStatusSchema>;
export type SourceFormat = z.infer<typeof SourceFormatSchema>;
export type FlagType = z.infer<typeof FlagTypeSchema>;
export type AuditAction = z.infer<typeof AuditActionSchema>;
export type Role = z.infer<typeof RoleSchema>;

export type HeaderInfo = z.infer<typeof HeaderInfoSchema>;
export type PatientInfo = z.infer<typeof PatientInfoSchema>;
export type TestResult = z.infer<typeof TestResultSchema>;
export type ImageArtifact = z.infer<typeof ImageArtifactSchema>;
export type QualityFlag = z.infer<typeof QualityFlagSchema>;
export type RawLabReport = z.infer<typeof RawLabReportSchema>;
export type LabReportDatabase = z.infer<typeof LabReportDatabaseSchema>;
export type ReferenceRange = z.infer<typeof ReferenceRangeSchema>;
export type Analyzer = z.infer<typeof AnalyzerSchema>;
export type User = z.infer<typeof UserSchema>;
export type UserCreate = z.infer<typeof UserCreateSchema>;
export type AuditLog = z.infer<typeof AuditLogSchema>;
export type ParseError = z.infer<typeof ParseErrorSchema>;
