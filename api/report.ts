import express, { Express, Request, Response, NextFunction } from 'express';
import { LabonakService } from '../services/labornak';
import { HIPAACompliance, DataIntegrityService } from '../lib/security/auth';
import { db } from '../services/queryService';
import { logger } from '../lib/logger/logger';
import { LabReportDatabaseSchema } from '../lib/schemas/validation';
import { referenceValidator } from '../lib/validators/references';

export class LabReportAPI {
  private app: Express;
  private parser: LabonakService;

  constructor(port: number = 3000) {
    this.app = express();
    this.parser = new LabonakService();
    this.setupMiddleware();
    this.setupRoutes();
  };

  private setupMiddleware(): void {
    // Parse JSON
    this.app.use(express.json({ limit: '100mb' }));
    this.app.use(express.urlencoded({ limit: '100mb', extended: true }));
    this.app.use(express.text({ type: ['text/plain',
    'application/octet-stream',
    'application/hl7-v2',
    '*/*',], limit: '100mb' }));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.path}`, {
          status: res.statusCode,
          duration,
          ip: req.ip,
        }, duration);
      });
      next();
    });

    // Error handling
    this.app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      logger.error('API Error', err, {
        path: req.path,
        method: req.method,
        body: req.body,
      });

      res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        timestamp: new Date().toISOString(),
      });
    });
  }

  private setupRoutes(): void {
    const api = express.Router();

    api.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Parse and store lab report
    api.post('/reports/parse', async (req: Request, res: Response) => {
      try {
        let rawData: string | undefined;
        let analyzerId: string | undefined;

        if (typeof req.body === 'string') {
          rawData = req.body;
          analyzerId = req.headers['x-analyzer-id'] as string;
        }

        else if (req.body && typeof req.body === 'object') {
          rawData = req.body.rawData;
          analyzerId = req.body.analyzerId;
        }

        if (!rawData) {
          return res.status(400).json({
            error: 'rawData is required',
            receivedType: typeof req.body,
          });
        }
        const parseResult = this.parser.parse(rawData);

        if (!parseResult.success || !parseResult.data) {
          return res.status(400).json({
            error: 'Parsing failed',
            errors: parseResult.errors,
            warnings: parseResult.warnings,
          });
        }

        const validatedResults =
          referenceValidator.validateResults(
            parseResult.data.results
          );

        const abnormalResults =
          referenceValidator.getAbnormalResults(
            validatedResults
          );

        const report = {
          analyzerId:
            analyzerId ||
            parseResult.data.header.analyzer,

          analyzerModel:
            parseResult.data.header.analyzer ||
            'Unknown',

          softwareVersion:
            parseResult.data.header.softwareVersion,

          serialNumber:
            parseResult.data.header.serialNumber,

          sampleId:
            parseResult.data.patient.sampleId,

          patientGender:
            parseResult.data.patient.gender,

          testTimestamp:
            parseResult.data.results[0]?.timestamp ||
            new Date().toISOString(),

          sourceFormat: 'HL7_V2',
          parserVersion: '2.0.0',
          parseStatus: 'SUCCESS',

          results: validatedResults,
          imageArtifacts: parseResult.data.images,

          qualityFlags: abnormalResults.map((r: any) => ({
            flagType:
              r.status.includes('CRITICAL')
                ? 'ERROR'
                : 'WARNING',

            code: r.status,
            message: `${r.testCode}: ${r.status}`,
            severity:
              r.status.includes('CRITICAL') ? 5 : 3,
            testCode: r.testCode,
          })),
        };

        const reportId = await db.saveLabReport(report as any);

        return res.status(201).json({
          success: true,
          reportId,
          parseTime: parseResult.duration,
          resultsCount: parseResult.data.results.length,
          abnormalCount: abnormalResults.length,
        });

      } catch (err) {
        logger.error('Failed to process report', err as Error);

        return res.status(500).json({
          error: (err as Error).message,
        });
      }
    });

    // Get report by ID
    api.get('/reports/:reportId', async (req: Request, res: Response) => {
      try {
        const { reportId } = req.params;
        const report = await db.getLabReport(reportId);

        if (!report) {
          return res.status(404).json({ error: 'Report not found' });
        }

        res.json(report);
      } catch (err) {
        logger.error('Failed to retrieve report', err as Error);
        res.status(500).json({ error: (err as Error).message });
      }
    });

    // Search reports
    api.get('/reports/search', async (req: Request, res: Response) => {
      try {
        const { analyzerId, startDate, endDate, isAbnormal, limit, offset } = req.query;

        const filters = {
          analyzerId: analyzerId as string,
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
          isAbnormal: isAbnormal === 'true',
          limit: limit ? parseInt(limit as string) : 100,
          offset: offset ? parseInt(offset as string) : 0,
        };

        const results = await db.searchReports(filters);

        res.json({
          count: results.length,
          results,
        });
      } catch (err) {
        logger.error('Search failed', err as Error);
        res.status(500).json({ error: (err as Error).message });
      }
    });

    // Get test results for report
    api.get('/reports/:reportId/results', async (req: Request, res: Response) => {
      try {
        const { reportId } = req.params;
        const results = await db.getTestResults(reportId);

        const validated = referenceValidator.validateResults(results);
        const summary = referenceValidator.generateSummary(validated);

        res.json({
          total: results.length,
          validated: validated.length,
          summary,
          results: validated,
        });
      } catch (err) {
        logger.error('Failed to get results', err as Error);
        res.status(500).json({ error: (err as Error).message });
      }
    });

    // Get all reports
    api.get('/reports', async (req: Request, res: Response) => {
      try {
        const reports = await db.getAllReports();

        res.json({
          count: reports.length,
          reports,
        });
      } catch (err) {
        logger.error('Failed to get reports', err as Error);
        res.status(500).json({ error: (err as Error).message });
      }
    });

    api.get('/reports/:reportId/abnormal', async (req: Request, res: Response) => {
      try {
        const { reportId } = req.params;
        const abnormal = await db.getAbnormalResults(reportId);

        res.json({
          count: abnormal.length,
          results: abnormal,
        });
      } catch (err) {
        logger.error('Failed to get abnormal results', err as Error);
        res.status(500).json({ error: (err as Error).message });
      }
    });

    // Validate data integrity
    api.post('/reports/:reportId/validate', async (req: Request, res: Response) => {
      try {
        const { reportId } = req.params;
        const { checksum } = req.body;

        const report = await db.getLabReport(reportId);
        if (!report) {
          return res.status(404).json({ error: 'Report not found' });
        }

        const isValid = DataIntegrityService.validateDataIntegrity(
          report,
          checksum
        );

        res.json({
          valid: isValid,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        logger.error('Validation failed', err as Error);
        res.status(500).json({ error: (err as Error).message });
      }
    });

    // Delete report (soft delete)
    api.delete('/reports/:reportId', async (req: Request, res: Response) => {
      try {
        const { reportId } = req.params;
        const userId = req.headers['x-user-id'] as string;

        if (!HIPAACompliance.validateAccess(userId, 'ADMIN', 'LabReport', 'DELETE')) {
          return res.status(403).json({ error: 'Access denied' });
        }

        await db.deleteReport(reportId, userId);

        res.json({
          success: true,
          message: 'Report deleted',
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        logger.error('Delete failed', err as Error);
        res.status(500).json({ error: (err as Error).message });
      }
    });

    // Get reference ranges
    api.get('/reference-ranges/:testCode', async (req: Request, res: Response) => {
      try {
        const { testCode } = req.params;
        const { analyzerModel } = req.query;

        const ranges = await db.getReferenceRanges(
          testCode,
          (analyzerModel as string) || 'XN-330'
        );

        res.json({
          testCode,
          analyzerModel,
          ranges,
        });
      } catch (err) {
        logger.error('Failed to get reference ranges', err as Error);
        res.status(500).json({ error: (err as Error).message });
      }
    });

    this.app.use('/api/v1', api);
  }

  public start(port: number = 3000): void {
    this.app.listen(port, () => {
      logger.info(`Lab Report API started on port ${port}`);
    });
  }

  public getApp(): Express {
    return this.app;
  }
}

if (require.main === module) {
  const api = new LabReportAPI();
  api.start(parseInt(process.env.API_PORT || '3000'));
}
