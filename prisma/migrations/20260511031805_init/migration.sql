-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "ParseStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "FlagType" AS ENUM ('WARNING', 'ERROR', 'INFO');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'S3', 'GCS', 'AZURE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'TECHNICIAN', 'CLINICIAN', 'VIEWER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATED', 'MODIFIED', 'VALIDATED', 'ACCESSED', 'DELETED');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "LabReport" (
    "id" TEXT NOT NULL,
    "analyzerId" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "patientGender" "Gender",
    "analyzerModel" TEXT NOT NULL,
    "softwareVersion" TEXT,
    "serialNumber" TEXT,
    "testTimestamp" TIMESTAMP(3) NOT NULL,
    "sourceFormat" TEXT NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "parseStatus" "ParseStatus" NOT NULL,
    "parseErrors" JSONB,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT true,
    "encryptionKeyId" TEXT,
    "hipaaCompliant" BOOLEAN NOT NULL DEFAULT true,
    "dataRetentionDays" INTEGER NOT NULL DEFAULT 2555,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LabReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestResult" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "testCode" TEXT NOT NULL,
    "value" DECIMAL(10,3),
    "stringValue" TEXT,
    "unit" TEXT,
    "abnormalFlag" TEXT,
    "referenceMin" DECIMAL(10,3),
    "referenceMax" DECIMAL(10,3),
    "criticalMin" DECIMAL(10,3),
    "criticalMax" DECIMAL(10,3),
    "isAbnormal" BOOLEAN NOT NULL DEFAULT false,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "qualityScore" DOUBLE PRECISION,
    "comments" TEXT,
    "isValidated" BOOLEAN NOT NULL DEFAULT false,
    "validatedBy" TEXT,
    "validationNotes" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageArtifact" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "testCode" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER,
    "fileHash" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "quality" TEXT,
    "storageProvider" "StorageProvider" NOT NULL,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "processingErrors" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityFlag" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "flagType" "FlagType" NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" INTEGER NOT NULL,
    "testCode" TEXT,
    "metadata" JSONB,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "changedFields" JSONB,
    "oldValues" JSONB,
    "newValues" JSONB,
    "reason" TEXT,
    "status" "AuditStatus" NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceRange" (
    "id" TEXT NOT NULL,
    "analyzerId" TEXT NOT NULL,
    "testCode" TEXT NOT NULL,
    "ageMin" INTEGER,
    "ageMax" INTEGER,
    "gender" "Gender",
    "referenceMin" DECIMAL(10,3),
    "referenceMax" DECIMAL(10,3),
    "criticalMin" DECIMAL(10,3),
    "criticalMax" DECIMAL(10,3),
    "unit" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferenceRange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analyzer" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "softwareVersions" JSONB NOT NULL,
    "format" TEXT NOT NULL,
    "delimiter" TEXT NOT NULL DEFAULT '|',
    "fieldDelimiter" TEXT NOT NULL DEFAULT '^',
    "supportedTests" JSONB NOT NULL,
    "defaultUnit" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Analyzer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "permissions" JSONB NOT NULL,
    "allowedAnalyzers" JSONB,
    "passwordHash" TEXT NOT NULL,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "lastLogin" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncryptionKey" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "algorithm" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rotatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EncryptionKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LabReport_sampleId_key" ON "LabReport"("sampleId");

-- CreateIndex
CREATE INDEX "LabReport_sampleId_idx" ON "LabReport"("sampleId");

-- CreateIndex
CREATE INDEX "LabReport_testTimestamp_idx" ON "LabReport"("testTimestamp");

-- CreateIndex
CREATE INDEX "LabReport_deletedAt_idx" ON "LabReport"("deletedAt");

-- CreateIndex
CREATE INDEX "LabReport_analyzerId_idx" ON "LabReport"("analyzerId");

-- CreateIndex
CREATE INDEX "TestResult_testCode_idx" ON "TestResult"("testCode");

-- CreateIndex
CREATE INDEX "TestResult_isAbnormal_idx" ON "TestResult"("isAbnormal");

-- CreateIndex
CREATE INDEX "TestResult_isCritical_idx" ON "TestResult"("isCritical");

-- CreateIndex
CREATE UNIQUE INDEX "TestResult_reportId_testCode_key" ON "TestResult"("reportId", "testCode");

-- CreateIndex
CREATE INDEX "ImageArtifact_reportId_idx" ON "ImageArtifact"("reportId");

-- CreateIndex
CREATE INDEX "ImageArtifact_testCode_idx" ON "ImageArtifact"("testCode");

-- CreateIndex
CREATE INDEX "QualityFlag_flagType_idx" ON "QualityFlag"("flagType");

-- CreateIndex
CREATE INDEX "QualityFlag_isResolved_idx" ON "QualityFlag"("isResolved");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ReferenceRange_testCode_idx" ON "ReferenceRange"("testCode");

-- CreateIndex
CREATE INDEX "ReferenceRange_isActive_idx" ON "ReferenceRange"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Analyzer_model_key" ON "Analyzer"("model");

-- CreateIndex
CREATE INDEX "Analyzer_manufacturer_idx" ON "Analyzer"("manufacturer");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "EncryptionKey_version_key" ON "EncryptionKey"("version");

-- AddForeignKey
ALTER TABLE "LabReport" ADD CONSTRAINT "LabReport_analyzerId_fkey" FOREIGN KEY ("analyzerId") REFERENCES "Analyzer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabReport" ADD CONSTRAINT "LabReport_encryptionKeyId_fkey" FOREIGN KEY ("encryptionKeyId") REFERENCES "EncryptionKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "LabReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageArtifact" ADD CONSTRAINT "ImageArtifact_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "LabReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityFlag" ADD CONSTRAINT "QualityFlag_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "LabReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "LabReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceRange" ADD CONSTRAINT "ReferenceRange_analyzerId_fkey" FOREIGN KEY ("analyzerId") REFERENCES "Analyzer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
