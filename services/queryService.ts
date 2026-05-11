import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { logger } from "../lib/logger/logger";
import type { ImageArtifact, LabReportDatabase, QualityFlag, TestResult } from "../lib/schemas/validation";
import { Decimal } from "@prisma/client/runtime/client";


const connectionString = process.env.DATABASE_URL!;

const pool = new pg.Pool({
  connectionString,
  max: parseInt(process.env.DATABASE_POOL_SIZE || "10"),
  idleTimeoutMillis: parseInt(
    process.env.DATABASE_TIMEOUT || "30000"
  ),
});

const adapter = new PrismaPg(pool);

export class DatabaseService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      adapter,
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "warn", "error"]
          : ["warn", "error"],
    });
  }


  async connect(): Promise<void> {
    try {
      await this.prisma.$connect();

      logger.info("Connected to database");
    } catch (err) {
      logger.fatal(
        "Failed to connect to database",
        err as Error
      );

      throw err;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      await pool.end();

      logger.info("Disconnected from database");
    } catch (err) {
      logger.error(
        "Failed to disconnect from database",
        err as Error
      );
    }
  }


  async saveLabReport(
    report: LabReportDatabase & {
      results: TestResult[];
      imageArtifacts: ImageArtifact[];
      qualityFlags: QualityFlag[];
    }
  ): Promise<string> {
    const startTime = Date.now();

    try {
      const created = await this.prisma.labReport.create({
        data: {
          analyzerId: report.analyzerId,

          analyzerModel: report.analyzerModel,

          softwareVersion:
            report.softwareVersion ?? undefined,

          serialNumber:
            report.serialNumber ?? undefined,

          sampleId: report.sampleId,

          patientGender:
            report.patientGender ?? undefined,

          testTimestamp: new Date(
            report.testTimestamp
          ),

          sourceFormat: report.sourceFormat,

          parserVersion: report.parserVersion,

          parseStatus: report.parseStatus,

          parseErrors:
            report.parseErrors ?? undefined,

          isEncrypted:
            report.isEncrypted ?? true,

          hipaaCompliant:
            report.hipaaCompliant ?? true,

          dataRetentionDays:
            report.dataRetentionDays ?? 2555,

          results: {
            create: report.results.map((r) => ({
              testCode: r.testCode,

              value:
                typeof r.value === "number"
                  ? new Decimal(r.value)
                  : null,

              stringValue:
                typeof r.value === "string"
                  ? r.value
                  : null,

              unit: r.unit ?? undefined,

              abnormalFlag:
                r.abnormalFlag ?? undefined,

              referenceMin:
                typeof r.referenceMin === "number"
                  ? new Decimal(r.referenceMin)
                  : null,

              referenceMax:
                typeof r.referenceMax === "number"
                  ? new Decimal(r.referenceMax)
                  : null,

              criticalMin:
                typeof r.criticalMin === "number"
                  ? new Decimal(r.criticalMin)
                  : null,

              criticalMax:
                typeof r.criticalMax === "number"
                  ? new Decimal(r.criticalMax)
                  : null,

              isAbnormal: this.isAbnormal(
                r.abnormalFlag
              ),

              isCritical: this.isCritical(
                r,
                report
              ),

              qualityScore:
                r.qualityScore ?? undefined,

              comments: r.comments ?? undefined,

              timestamp: new Date(
                r.timestamp ||
                  new Date().toISOString()
              ),
            })),
          },


          imageArtifacts: {
            create: report.imageArtifacts.map(
              (img) => ({
                testCode: img.testCode,

                fileType: img.fileType,

                fileName: img.fileName,

                filePath:
                  img.filePath || "",

                fileSize:
                  img.fileSize ?? undefined,

                fileHash:
                  img.fileHash ?? undefined,

                width:
                  img.width ?? undefined,

                height:
                  img.height ?? undefined,

                quality:
                  img.quality ?? undefined,

                storageProvider:
                  img.storageProvider,

                processingErrors:
                  img.processingErrors ??
                  undefined,

                timestamp: new Date(
                  img.timestamp ||
                    new Date().toISOString()
                ),
              })
            ),
          },


          qualityFlags: {
            create: report.qualityFlags.map(
              (flag) => ({
                flagType: flag.flagType,

                code: flag.code,

                message: flag.message,

                severity: flag.severity,

                testCode:
                  flag.testCode ?? undefined,

                metadata:
                  flag.metadata ?? undefined,
              })
            ),
          },
        },

        include: {
          results: true,
          imageArtifacts: true,
          qualityFlags: true,
        },
      });

      const duration = Date.now() - startTime;

      logger.info(
        "Lab report saved successfully",
        {
          reportId: created.id,
          sampleId: report.sampleId,
          resultCount: report.results.length,
          imageCount:
            report.imageArtifacts.length,
        },
        duration
      );

      logger.auditLog(
        "REPORT_CREATED",
        "SUCCESS",
        undefined,
        {
          reportId: created.id,
          sampleId: report.sampleId,
        }
      );

      return created.id;
    } catch (err) {
      logger.error(
        "Failed to save lab report",
        err as Error,
        {
          sampleId: report.sampleId,
        }
      );

      logger.auditLog(
        "REPORT_CREATED",
        "FAILED",
        undefined,
        {
          sampleId: report.sampleId,
        },
        err as Error
      );

      throw err;
    }
  }

  async getLabReport(reportId: string) {
    try {
      const report =
        await this.prisma.labReport.findUnique({
          where: {
            id: reportId,
          },

          include: {
            results: true,

            imageArtifacts: true,

            qualityFlags: true,

            auditLogs: {
              orderBy: {
                createdAt: "desc",
              },

              take: 100,
            },
          },
        });

      if (!report) {
        logger.warn(
          "Lab report not found",
          {
            reportId,
          }
        );

        return null;
      }

      logger.auditLog(
        "REPORT_ACCESSED",
        "SUCCESS",
        undefined,
        { reportId }
      );

      return report;
    } catch (err) {
      logger.error(
        "Failed to retrieve lab report",
        err as Error,
        { reportId }
      );

      throw err;
    }
  }

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
      const where: any = {
        deletedAt: null,
      };

      if (filters.analyzerId) {
        where.analyzerId =
          filters.analyzerId;
      }

      if (
        filters.startDate ||
        filters.endDate
      ) {
        where.testTimestamp = {};

        if (filters.startDate) {
          where.testTimestamp.gte =
            filters.startDate;
        }

        if (filters.endDate) {
          where.testTimestamp.lte =
            filters.endDate;
        }
      }

      const reports =
        await this.prisma.labReport.findMany({
          where,

          include: {
            results: {
              where: {
                ...(filters.isAbnormal !==
                  undefined && {
                  isAbnormal:
                    filters.isAbnormal,
                }),

                ...(filters.isCritical !==
                  undefined && {
                  isCritical:
                    filters.isCritical,
                }),
              },
            },

            qualityFlags: true,
          },

          orderBy: {
            testTimestamp: "desc",
          },

          take: filters.limit || 100,

          skip: filters.offset || 0,
        });

      logger.info("Reports searched", {
        resultCount: reports.length,
      });

      return reports;
    } catch (err) {
      logger.error(
        "Failed to search reports",
        err as Error,
        { filters }
      );

      throw err;
    }
  }

  async getTestResults(reportId: string) {
    try {
      return await this.prisma.testResult.findMany(
        {
          where: {
            reportId,
          },

          orderBy: {
            testCode: "asc",
          },
        }
      );
    } catch (err) {
      logger.error(
        "Failed to retrieve test results",
        err as Error,
        { reportId }
      );

      throw err;
    }
  }

  async getAbnormalResults(reportId: string) {
    try {
      return await this.prisma.testResult.findMany(
        {
          where: {
            reportId,
            isAbnormal: true,
          },

          orderBy: {
            createdAt: "desc",
          },
        }
      );
    } catch (err) {
      logger.error(
        "Failed to retrieve abnormal results",
        err as Error,
        { reportId }
      );

      throw err;
    }
  }

  async getReferenceRanges(
    testCode: string,
    analyzerId: string
  ) {
    try {
      return await this.prisma.referenceRange.findMany(
        {
          where: {
            testCode,
            analyzerId,
            isActive: true,
          },
        }
      );
    } catch (err) {
      logger.error(
        "Failed to retrieve reference ranges",
        err as Error,
        {
          testCode,
          analyzerId,
        }
      );

      throw err;
    }
  }

  async addAuditLog(
    reportId: string,
    action: any,
    userId?: string,
    details?: any
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          reportId,

          action,

          userId,

          status: "SUCCESS",

          changedFields:
            details?.changedFields ??
            undefined,

          oldValues:
            details?.oldValues ??
            undefined,

          newValues:
            details?.newValues ??
            undefined,

          reason:
            details?.reason ??
            undefined,
        },
      });

      logger.auditLog(
        action,
        "SUCCESS",
        userId,
        {
          reportId,
          ...details,
        }
      );
    } catch (err) {
      logger.error(
        "Failed to add audit log",
        err as Error,
        {
          reportId,
          action,
        }
      );
    }
  }

  async deleteReport(
    reportId: string,
    userId?: string
  ): Promise<void> {
    try {
      await this.prisma.labReport.update({
        where: {
          id: reportId,
        },

        data: {
          deletedAt: new Date(),
        },
      });

      logger.info(
        "Report soft deleted",
        {
          reportId,
        }
      );

      logger.auditLog(
        "REPORT_DELETED",
        "SUCCESS",
        userId,
        {
          reportId,
        }
      );
    } catch (err) {
      logger.error(
        "Failed to delete report",
        err as Error,
        { reportId }
      );

      throw err;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return true;
    } catch (err) {
      logger.error(
        "Database health check failed",
        err as Error
      );

      return false;
    }
  }

  private isAbnormal(
    flag: string | null | undefined
  ): boolean {
    return (
      flag !== null &&
      flag !== undefined &&
      flag !== "N" &&
      flag !== "NF"
    );
  }

  private isCritical(
    result: TestResult,
    _report: LabReportDatabase
  ): boolean {
    if (
      result.criticalMin &&
      typeof result.value === "number" &&
      result.value < result.criticalMin
    ) {
      return true;
    }

    if (
      result.criticalMax &&
      typeof result.value === "number" &&
      result.value > result.criticalMax
    ) {
      return true;
    }

    return (
      result.abnormalFlag?.includes("F") ??
      false
    );
  }
}

declare global {
  var __db__: DatabaseService | undefined;
}

export const db =
  globalThis.__db__ ??
  (globalThis.__db__ =
    new DatabaseService());