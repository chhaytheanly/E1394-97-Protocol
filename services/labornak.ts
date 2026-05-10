import { RawLabReportSchema, TestResult, ImageArtifact, QualityFlag, ParseError } from '../lib/schemas/validation';
import { Normalizer } from '../utils/normalize';
import { logger } from '../lib/logger/logger';

export interface ParseResult {
  success: boolean;
  data?: any;
  errors: ParseError[];
  warnings: string[];
  duration: number;
}

export class LabonakService {
  private parserVersion = '2.0.0';
  private errors: ParseError[] = [];
  private warnings: string[] = [];
  private startTime: number = 0;

  public parse(rawData: string): ParseResult {
    this.startTime = Date.now();
    this.errors = [];
    this.warnings = [];

    const startTime = Date.now();
    logger.debug('Starting HL7 parsing', { dataLength: rawData.length });

    try {
      const report = {
        header: { analyzer: null, softwareVersion: null, serialNumber: null },
        patient: { sampleId: null, gender: null },
        results: [] as TestResult[],
        images: [] as ImageArtifact[],
        qualityFlags: [] as QualityFlag[],
      };

      const lines = rawData.trim().split('\n');
      
      if (lines.length === 0) {
        this.addError(0, 'EMPTY', '', 'No data to parse', 'ERROR');
        return this.createParseResult(false, null, Date.now() - startTime);
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const fields = line.split('|');
        const recordType = fields[0];

        try {
          switch (recordType) {
            case 'H':
              report.header = this.parseHeader(fields, i);
              break;
            case 'P':
              report.patient = this.parsePatient(fields, i);
              break;
            case 'R':
              this.parseResultRecord(fields, i, report);
              break;
            case 'C':
            case 'O':
            case 'L':
              // Comment, Order, Terminator - skip but validate
              break;
            default:
              this.addWarning(`Unknown record type: ${recordType} at line ${i + 1}`);
          }
        } catch (err) {
          this.addError(
            i,
            recordType,
            line,
            (err as Error).message,
            'ERROR'
          );
          logger.warn(`Failed to parse line ${i + 1}`, { line }, err as Error);
        }
      }

      const validationResult = this.validateReport(report);
      if (!validationResult.valid) {
        validationResult.issues.forEach(issue => {
          this.addWarning(issue);
        });
      }

      const duration = Date.now() - startTime;

      // logger.info('Parsing completed', {
      //   recordCount: lines.length,
      //   errorCount: this.errors.length,
      //   warningCount: this.warnings.length,
      //   resultCount: report.results.length,
      //   imageCount: report.images.length,
      // }, duration);

      return this.createParseResult(
        this.errors.length === 0,
        report,
        duration
      );
    } catch (err) {
      const duration = Date.now() - startTime;
      logger.fatal('Parser crashed', err as Error, { dataLength: rawData.length });
      this.addError(0, 'PARSER', '', (err as Error).message, 'FATAL');
      return this.createParseResult(false, null, duration);
    }
  }

  private parseHeader(fields: string[], lineNumber: number) {
    try {
      const machineInfo = (fields[2] || '').split('^');
      const header = {
        analyzer: machineInfo[0]?.trim() || null,
        softwareVersion: machineInfo[1] || null,
        serialNumber: machineInfo[7] || null,
      };

      if (!header.analyzer) {
        this.addWarning(`No analyzer ID found in header at line ${lineNumber + 1}`);
      }

      return header;
    } catch (err) {
      this.addError(lineNumber, 'H', fields.join('|'), (err as Error).message, 'ERROR');
      throw err;
    }
  }

  private parsePatient(fields: string[], lineNumber: number) {
    try {
      const patient = {
        sampleId: fields[2] || null,
        gender: Normalizer.mapGender(fields[4]),
        age: fields[8] ? parseInt(fields[8], 10) : undefined,
      };

      if (!patient.sampleId) {
        this.addError(lineNumber, 'P', fields.join('|'), 'No sample ID', 'WARN');
      }

      return patient;
    } catch (err) {
      this.addError(lineNumber, 'P', fields.join('|'), (err as Error).message, 'ERROR');
      throw err;
    }
  }

  private parseResultRecord(fields: string[], lineNumber: number, report: any): void {
    try {
      const testCodeRaw = (fields[2] || '').split('^');
      const testCode = testCodeRaw[4] || 'UNKNOWN';

      if (testCode === 'UNKNOWN') {
        this.addWarning(`Unknown test code at line ${lineNumber + 1}`);
        return;
      }

      const rawValue = fields[3];
      const numericValue = Normalizer.parseNumeric(rawValue);
      const value: string | number | null = numericValue !== null ? numericValue : rawValue || null;

      const { unit, flag } = Normalizer.splitUnitAndFlag(fields[4] || '');
      const rawTimestamp = fields[7];
      const timestamp = Normalizer.formatTimestamp(rawTimestamp);

      if (rawTimestamp && !timestamp) {
        this.addWarning(`Invalid timestamp at line ${lineNumber + 1}: ${rawTimestamp}`);
      }

      const result: TestResult = {
        testCode,
        value,
        unit,
        abnormalFlag: flag as any,
        timestamp: timestamp || new Date().toISOString(),
      };

      if (testCode.startsWith('SCAT_') || testCode.startsWith('DIST_')) {
        const imageInfo = (fields[4] || '').split('&');
        const image: ImageArtifact = {
          testCode,
          fileType: imageInfo[0] || 'unknown',
          fileName: imageInfo[3] || 'unknown',
          timestamp: timestamp || new Date().toISOString(),
        };
        report.images.push(image);
      } else {
        report.results.push(result);
      }
    } catch (err) {
      this.addError(lineNumber, 'R', fields.join('|'), (err as Error).message, 'ERROR');
      throw err;
    }
  }

  private validateReport(report: any): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!report.header.analyzer) {
      issues.push('Missing analyzer information');
    }

    if (!report.patient.sampleId) {
      issues.push('Missing sample ID');
    }

    if (report.results.length === 0 && report.images.length === 0) {
      issues.push('No test results or images found');
    }

    report.results.forEach((result: TestResult, idx: number) => {
      if (!result.testCode) {
        issues.push(`Result ${idx} missing test code`);
      }
      if (result.value === null && !result.timestamp) {
        issues.push(`Result ${idx} has no value or timestamp`);
      }
    });

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  private addError(
    lineNumber: number,
    recordType: string,
    rawLine: string,
    error: string,
    severity: 'INFO' | 'WARN' | 'ERROR' | 'FATAL' = 'ERROR'
  ): void {
    const parseError: ParseError = {
      lineNumber: lineNumber + 1,
      recordType,
      rawLine: rawLine.substring(0, 200), 
      error,
      severity: severity as any,
    };

    this.errors.push(parseError);
  }

  private addWarning(message: string): void {
    this.warnings.push(message);
  }

  private createParseResult(success: boolean, data: any, duration: number): ParseResult {
    return {
      success,
      data: success ? data : null,
      errors: this.errors,
      warnings: this.warnings,
      duration,
    };
  }
}

export const parser = new LabonakService();
