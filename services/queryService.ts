import { PrismaClient } from '@prisma/client';
import { LabReportDatabase, TestResult, ImageArtifact, QualityFlag } from './schemas/validation';
import { logger } from '../lib/logger/logger';

export class DatabaseService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      logger.info('Connected to database');
    } catch (err) {
      logger.fatal('Failed to connect to database', err as Error);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      logger.info('Disconnected from database');
    } catch (err) {
      logger.error('Failed to disconnect from database', err as Error);
    }
  }

  async saveLabReport(report: LabReportDatabase & {
    results: TestResult[];
    imageArtifacts: ImageArtifact[];
    qualityFlags: QualityFlag[];
  }): Promise<string> {
    const startTime = Date.now();
    const reportId = crypto.randomUUID();

    try {
      const created = await this.prisma.labReport.create({
        data: {
          id: reportId,
          analyzerId: report.analyzerId,
          analyzerModel: report.analyzerModel,
          softwareVersion: report.softwareVersion,
          serialNumber: report.serialNumber,
          sampleId: report.sampleId,
          patientGender: report.patientGender,
          testTimestamp: new Date(report.testTimestamp),
          sourceFormat: report.sourceFormat,
          parserVersion: report.parserVersion,
          parseStatus: report.parseStatus,
          parseErrors: report.parseErrors,
          isEncrypted: report.isEncrypted,
          hipaaCompliant: report.hipaaCompliant,
          dataRetentionDays: report.dataRetentionDays,
          
          results: {
            createMany: {
              data: report.results.map(r => ({
                testCode: r.testCode,
                value: typeof r.value === 'number' ? r.value : null,
                stringValue: typeof r.value === 'string' ? r.value : null,
                unit: r.unit,
                abnormalFlag: r.abnormalFlag,
                referenceMin: r.referenceMin,
                referenceMax: r.referenceMax,
                criticalMin: r.criticalMin,
                criticalMax: r.criticalMax,
                isAbnormal: this.isAbnormal(r.abnormalFlag),
                isCritical: this.isCritical(r, report),
                qualityScore: r.qualityScore,
                comments: r.comments,
                timestamp: new Date(r.timestamp || new Date().toISOString()),
              })),
            },
          },

          imageArtifacts: {
            createMany: {
              data: report.imageArtifacts.map(img => ({
                testCode: img.testCode,
                fileType: img.fileType,
                fileName: img.fileName,
                filePath: '', 
                fileSize: img.fileSize,
                fileHash: img.fileHash,
                width: img.width,
                height: img.height,
                quality: img.quality,
                storageProvider: img.storageProvider,
                timestamp: new Date(img.timestamp || new Date().toISOString()),
              })),
            },
          },

          qualityFlags: {
            createMany: {
              data: report.qualityFlags.map(flag => ({
                flagType: flag.flagType,
                code: flag.code,
                message: flag.message,
                severity: flag.severity,
                testCode: flag.testCode,
                metadata: flag.metadata ? JSON.stringify(flag.metadata) : null,
              })),
            },
          },
        },
        include: {
          results: true,
          imageArtifacts: true,
          qualityFlags: true,
        },
      });

      const duration = Date.now() - startTime;
      logger.info('Lab report saved successfully', {
        reportId,
        sampleId: report.sampleId,
        resultCount: report.results.length,
        imageCount: report.imageArtifacts.length,
      }, duration);

      logger.auditLog('REPORT_CREATED', 'SUCCESS', undefined, {
        reportId,
        sampleId: report.sampleId,
      });

      return reportId;
    } catch (err) {
      logger.error('Failed to save lab report', err as Error, {
        sampleId: report.sampleId,
      });

      logger.auditLog('REPORT_CREATED', 'FAILED', undefined, {
        sampleId: report.sampleId,
      }, err as Error);

      throw err;
    }
  }

  async getLabReport(reportId: string) {
    try {
      const report = await this.prisma.labReport.findUnique({
        where: { id: reportId },
        include: {
          results: true,
          imageArtifacts: true,
          qualityFlags: true,
          auditLogs: {
            orderBy: { createdAt: 'desc' },
            take: 100,
          },
        },
      });

      if (!report) {
        logger.warn('Lab report not found', { reportId });
        return null;
      }

      logger.auditLog('REPORT_ACCESSED', 'SUCCESS', undefined, { reportId });

      return report;
    } catch (err) {
      logger.error('Failed to retrieve lab report', err as Error, { reportId });
      logger.auditLog('REPORT_ACCESSED', 'FAILED', undefined, { reportId }, err as Error);
      throw err;
    }
  }

  async getReportsBySampleId(sampleId: string) {
    try {
      const reports = await this.prisma.labReport.findMany({
        where: {
          sampleId,
          deletedAt: null,
        },
        include: {
          results: true,
          qualityFlags: true,
        },
        orderBy: { testTimestamp: 'desc' },
      });

      logger.info('Retrieved reports by sample ID', {
        sampleId,
        count: reports.length,
      });

      return reports;
    } catch (err) {
      logger.error('Failed to retrieve reports by sample ID', err as Error, { sampleId });
      throw err;
    }
  }

  // Search lab reports
  async searchReports(filters: {
    analyzerId?: string;
    startDate?: Date;
    endDate?: Date;
    isAbnormal?: boolean;
    isCritical?: boolean;
    limit?: number;
    offset?: number;
  }) {
    try {
      const where: any = { deletedAt: null };

      if (filters.analyzerId) where.analyzerId = filters.analyzerId;
      if (filters.startDate) where.testTimestamp = { gte: filters.startDate };
      if (filters.endDate) {
        where.testTimestamp = where.testTimestamp || {};
        where.testTimestamp.lte = filters.endDate;
      }

      const results = await this.prisma.labReport.findMany({
        where,
        include: {
          results: {
            where: {
              ...(filters.isAbnormal !== undefined && { isAbnormal: filters.isAbnormal }),
              ...(filters.isCritical !== undefined && { isCritical: filters.isCritical }),
            },
          },
          qualityFlags: true,
        },
        orderBy: { testTimestamp: 'desc' },
        take: filters.limit || 100,
        skip: filters.offset || 0,
      });

      logger.info('Reports searched', {
        filterCount: Object.keys(filters).length,
        resultCount: results.length,
      });

      return results;
    } catch (err) {
      logger.error('Failed to search reports', err as Error, { filters });
      throw err;
    }
  }

  async addAuditLog(reportId: string, action: string, userId?: string, details?: any) {
    try {
      await this.prisma.auditLog.create({
        data: {
          reportId,
          action,
          userId,
          status: 'SUCCESS',
          changedFields: details?.changedFields ? JSON.stringify(details.changedFields) : null,
        },
      });

      logger.auditLog(action, 'SUCCESS', userId, { reportId, ...details });
    } catch (err) {
      logger.error('Failed to add audit log', err as Error, { reportId, action });
    }
  }

  async getTestResults(reportId: string) {
    try {
      return await this.prisma.testResult.findMany({
        where: { reportId },
        orderBy: { testCode: 'asc' },
      });
    } catch (err) {
      logger.error('Failed to retrieve test results', err as Error, { reportId });
      throw err;
    }
  }

  async getAbnormalResults(reportId: string) {
    try {
      return await this.prisma.testResult.findMany({
        where: {
          reportId,
          isAbnormal: true,
        },
        orderBy: { severity: 'desc' },
      });
    } catch (err) {
      logger.error('Failed to retrieve abnormal results', err as Error, { reportId });
      throw err;
    }
  }

  async deleteReport(reportId: string, userId?: string): Promise<void> {
    try {
      await this.prisma.labReport.update({
        where: { id: reportId },
        data: { deletedAt: new Date() },
      });

      logger.info('Report soft deleted', { reportId });
      logger.auditLog('REPORT_DELETED', 'SUCCESS', userId, { reportId });
    } catch (err) {
      logger.error('Failed to delete report', err as Error, { reportId });
      logger.auditLog('REPORT_DELETED', 'FAILED', userId, { reportId }, err as Error);
      throw err;
    }
  }

  async getReferenceRanges(testCode: string, analyzerModel: string) {
    try {
      return await this.prisma.referenceRange.findMany({
        where: {
          testCode,
          analyzerModel,
          isActive: true,
        },
      });
    } catch (err) {
      logger.error('Failed to retrieve reference ranges', err as Error, {
        testCode,
        analyzerModel,
      });
      throw err;
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (err) {
      logger.error('Database health check failed', err as Error);
      return false;
    }
  }

  private isAbnormal(flag: string | null): boolean {
    return flag !== null && flag !== 'N' && flag !== 'NF';
  }

  private isCritical(result: TestResult, report: LabReportDatabase): boolean {
    if (result.criticalMin && typeof result.value === 'number' && result.value < result.criticalMin) {
      return true;
    }
    if (result.criticalMax && typeof result.value === 'number' && result.value > result.criticalMax) {
      return true;
    }

    return result.abnormalFlag?.includes('F') || false;
  }
}

export const db = new DatabaseService();
