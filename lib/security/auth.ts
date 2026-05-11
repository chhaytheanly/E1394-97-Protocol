import * as crypto from 'crypto';
import { logger } from '../logger/logger';

export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private encoding: BufferEncoding = 'hex';

  encrypt(data: string, key: Buffer): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      let encrypted = cipher.update(data, 'utf8', this.encoding);
      encrypted += cipher.final(this.encoding);

      const authTag = cipher.getAuthTag();

      const result = iv.toString(this.encoding) + ':' + authTag.toString(this.encoding) + ':' + encrypted;

      logger.debug('Data encrypted successfully');
      return result;
    } catch (err) {
      logger.error('Encryption failed', err as Error);
      throw err;
    }
  }

  decrypt(encrypted: string, key: Buffer): string {
    try {
      const parts = encrypted.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], this.encoding);
      const authTag = Buffer.from(parts[1], this.encoding);
      const encryptedData = parts[2];

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedData, this.encoding, 'utf8');
      decrypted += decipher.final('utf8');

      logger.debug('Data decrypted successfully');
      return decrypted;
    } catch (err) {
      logger.error('Decryption failed', err as Error);
      throw err;
    }
  }

  generateKey(): Buffer {
    return crypto.randomBytes(32); // 256-bit key
  }


  hash(data: string, algorithm: string = 'sha256'): string {
    return crypto.createHash(algorithm).update(data).digest('hex');
  }


  verifyFileHash(fileContent: Buffer, expectedHash: string): boolean {
    const actualHash = crypto.createHash('sha256').update(fileContent).digest('hex');
    return actualHash === expectedHash;
  }
}

export class HIPAACompliance {
  static anonymizePatientData(data: any): any {
    const anonymized = { ...data };

    // Mask or remove PII
    if (anonymized.patient) {
      anonymized.patient = {
        ...anonymized.patient,
        sampleId: this.maskIdentifier(anonymized.patient.sampleId),
        patientId: this.maskIdentifier(anonymized.patient.patientId),
        age: anonymized.patient.age ? this.aggregateAge(anonymized.patient.age) : null,
      };
    }

    logger.info('Patient data anonymized');
    return anonymized;
  }


  private static maskIdentifier(id: string): string {
    if (!id || id.length < 3) return '***';
    return id[0] + '*'.repeat(id.length - 2) + id[id.length - 1];
  }


  private static aggregateAge(age: number): string | number {
    if (age > 89) return '>89';
    return age;
  }


  static createAuditTrailEntry(
    action: string,
    userId: string,
    resourceId: string,
    details?: any
  ): any {
    return {
      timestamp: new Date().toISOString(),
      action,
      userId,
      resourceId,
      ipAddress: process.env.REQUEST_IP || 'unknown',
      details,
      success: true,
    };
  }

  static calculateRetentionExpiry(retentionDays: number = 2555): Date {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + retentionDays);
    return expiryDate;
  }

  static shouldPurgeData(createdAt: Date, retentionDays: number = 2555): boolean {
    const now = new Date();
    const expiryDate = new Date(createdAt);
    expiryDate.setDate(expiryDate.getDate() + retentionDays);
    return now > expiryDate;
  }

  static validateAccess(
    userId: string,
    role: string,
    resourceType: string,
    action: string
  ): boolean {
    const permissions: Record<string, Record<string, string[]>> = {
      ADMIN: {
        LabReport: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
        AuditLog: ['READ'],
        User: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
      },
      TECHNICIAN: {
        LabReport: ['CREATE', 'READ'],
        User: ['READ'],
      },
      CLINICIAN: {
        LabReport: ['READ'],
        User: ['READ'],
      },
      VIEWER: {
        LabReport: ['READ'],
      },
    };

    const allowed = permissions[role]?.[resourceType] || [];
    return allowed.includes(action);
  }
}

export class DataIntegrityService {

  static validateDataIntegrity(
    data: any,
    expectedHash: string,
    algorithm: string = 'sha256'
  ): boolean {
    const encryption = new EncryptionService();
    const actualHash = encryption.hash(JSON.stringify(data), algorithm);
    const isValid = actualHash === expectedHash;

    if (!isValid) {
      logger.warn('Data integrity check failed', { expectedHash, actualHash });
    }

    return isValid;
  }

  /**
   * Create checksum for data verification
   */
  static createChecksum(data: any, algorithm: string = 'sha256'): string {
    const encryption = new EncryptionService();
    return encryption.hash(JSON.stringify(data), algorithm);
  }

  /**
   * Detect anomalies in test results
   */
  static detectAnomalies(results: any[]): Array<{
    index: number;
    testCode: string;
    anomaly: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }> {
    const anomalies: any[] = [];

    results.forEach((result, index) => {
      // Check for missing critical fields
      if (!result.testCode) {
        anomalies.push({
          index,
          testCode: 'UNKNOWN',
          anomaly: 'Missing test code',
          severity: 'HIGH',
        });
      }

      // Check for impossible values (e.g., negative where not allowed)
      if (typeof result.value === 'number' && result.value < 0) {
        if (!['pH', 'Potential'].includes(result.testCode)) {
          anomalies.push({
            index,
            testCode: result.testCode,
            anomaly: 'Negative value for test that should be positive',
            severity: 'MEDIUM',
          });
        }
      }

      // Check for extreme outliers
      if (typeof result.value === 'number' && Math.abs(result.value) > 10000) {
        anomalies.push({
          index,
          testCode: result.testCode,
          anomaly: 'Extreme outlier value',
          severity: 'HIGH',
        });
      }

      // Check for invalid units
      if (result.unit && result.unit.length > 50) {
        anomalies.push({
          index,
          testCode: result.testCode,
          anomaly: 'Invalid or corrupted unit',
          severity: 'MEDIUM',
        });
      }
    });

    if (anomalies.length > 0) {
      logger.warn('Anomalies detected', { count: anomalies.length });
    }

    return anomalies;
  }
}

export const encryption = new EncryptionService();
