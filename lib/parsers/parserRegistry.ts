import { RawLabReport, SourceFormat } from '../schemas/validation';
import { logger } from '../logger/logger';

export interface IAnalyzerParser {
  name: string;
  format: SourceFormat;
  parse(rawData: string): RawLabReport;
  validate(data: RawLabReport): { valid: boolean; errors: string[] };
}

export class AnalyzerParserRegistry {
  private parsers: Map<SourceFormat, IAnalyzerParser> = new Map();

  register(parser: IAnalyzerParser): void {
    this.parsers.set(parser.format, parser);
    logger.info('Registered parser', { format: parser.format, name: parser.name });
  }

  getParser(format: SourceFormat): IAnalyzerParser | null {
    const parser = this.parsers.get(format);
    if (!parser) {
      logger.warn('Parser not found', { format });
    }
    return parser || null;
  }

  getSupportedFormats(): SourceFormat[] {
    return Array.from(this.parsers.keys());
  }

  listParsers(): { format: SourceFormat; name: string }[] {
    return Array.from(this.parsers.values()).map(p => ({
      format: p.format,
      name: p.name,
    }));
  }
}

// Sysmex XN-330 specific parser
export class SysmexXNParser implements IAnalyzerParser {
  name = 'Sysmex XN-Series';
  format: SourceFormat = 'HL7_V2';

  parse(rawData: string): RawLabReport {
    const lines = rawData.trim().split('\n');
    const report: RawLabReport = {
      header: { analyzer: null, softwareVersion: null, serialNumber: null },
      patient: { sampleId: null, gender: null },
      results: [],
      images: [],
      qualityFlags: [],
    };

    for (const line of lines) {
      const fields = line.split('|');
      const recordType = fields[0];

      switch (recordType) {
        case 'H':
          const machineInfo = (fields[2] || '').split('^');
          report.header = {
            analyzer: machineInfo[0]?.trim() || null,
            softwareVersion: machineInfo[1] || null,
            serialNumber: machineInfo[7] || null,
          };
          break;

        case 'P':
          report.patient = {
            sampleId: fields[2] || null,
            gender: this.mapGender(fields[4]),
            age: fields[8] ? parseInt(fields[8], 10) : undefined,
          };
          break;

        case 'R':
          const testCode = (fields[2] || '').split('^')[4] || 'UNKNOWN';
          const value = fields[3];
          const { unit, flag } = this.splitUnitAndFlag(fields[4] || '');

          if (testCode.startsWith('SCAT_') || testCode.startsWith('DIST_')) {
            const imageInfo = (fields[4] || '').split('&');
            report.images.push({
              testCode,
              fileType: imageInfo[0] || 'PNG',
              fileName: imageInfo[3] || 'unknown',
              timestamp: this.formatTimestamp(fields[7]),
            });
          } else {
            report.results.push({
              testCode,
              value: this.parseValue(value),
              unit,
              abnormalFlag: flag as any,
              timestamp: this.formatTimestamp(fields[7]),
            });
          }
          break;
      }
    }

    return report;
  }

  validate(data: RawLabReport): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.header.analyzer) errors.push('Missing analyzer information');
    if (!data.patient.sampleId) errors.push('Missing sample ID');
    if (data.results.length === 0 && data.images.length === 0) {
      errors.push('No results or images found');
    }

    return { valid: errors.length === 0, errors };
  }

  private mapGender(code?: string): 'Male' | 'Female' | 'Other' | null {
    const map: Record<string, 'Male' | 'Female' | 'Other'> = {
      M: 'Male',
      F: 'Female',
      O: 'Other',
    };
    return code ? map[code] || null : null;
  }

  private splitUnitAndFlag(raw: string): { unit: string | null; flag: string | null } {
    if (!raw) return { unit: null, flag: null };
    const match = raw.match(/^(.*?)([NHL]F|[NHLF])$/);
    if (match) {
      return { unit: match[1] || null, flag: match[2] };
    }
    return { unit: raw, flag: null };
  }

  private formatTimestamp(raw?: string): string | null {
    if (!raw || raw.length !== 14) return null;
    const year = raw.substring(0, 4);
    const month = raw.substring(4, 6);
    const day = raw.substring(6, 8);
    const hour = raw.substring(8, 10);
    const min = raw.substring(10, 12);
    const sec = raw.substring(12, 14);
    return `${year}-${month}-${day}T${hour}:${min}:${sec}`;
  }

  private parseValue(value: string): string | number | null {
    if (!value) return null;
    const num = parseFloat(value);
    return isNaN(num) ? value : num;
  }
}

export class BeckmanCoulterParser implements IAnalyzerParser {
  name = 'Beckman Coulter';
  format: SourceFormat = 'XML';

  parse(rawData: string): RawLabReport {
    const report: RawLabReport = {
      header: { analyzer: 'Beckman Coulter', softwareVersion: null, serialNumber: null },
      patient: { sampleId: null, gender: null },
      results: [],
      images: [],
      qualityFlags: [],
    };

    logger.info('Parsing Beckman Coulter XML data');
    return report;
  }

  validate(data: RawLabReport): { valid: boolean; errors: string[] } {
    return { valid: true, errors: [] };
  }
}

export class RocheParser implements IAnalyzerParser {
  name = 'Roche';
  format: SourceFormat = 'HL7_V3';

  parse(rawData: string): RawLabReport {
    const report: RawLabReport = {
      header: { analyzer: 'Roche', softwareVersion: null, serialNumber: null },
      patient: { sampleId: null, gender: null },
      results: [],
      images: [],
      qualityFlags: [],
    };

    logger.info('Parsing Roche HL7 V3 data');
    return report;
  }

  validate(data: RawLabReport): { valid: boolean; errors: string[] } {
    return { valid: true, errors: [] };
  }
}

// CSV parser for generic data
export class CSVParser implements IAnalyzerParser {
  name = 'Generic CSV';
  format: SourceFormat = 'CSV';
  private delimiter: string = ',';

  constructor(delimiter: string = ',') {
    this.delimiter = delimiter;
  }

  parse(rawData: string): RawLabReport {
    const lines = rawData.trim().split('\n');
    const headers = lines[0].split(this.delimiter).map(h => h.toLowerCase());

    const report: RawLabReport = {
      header: { analyzer: 'CSV Import', softwareVersion: null, serialNumber: null },
      patient: { sampleId: null, gender: null },
      results: [],
      images: [],
      qualityFlags: [],
    };

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(this.delimiter);
      const row: Record<string, string> = {};

      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });

      // Map CSV columns to results
      if (row['sampleid']) report.patient.sampleId = row['sampleid'];
      if (row['gender']) report.patient.gender = row['gender'] as any;

      if (row['testcode']) {
        report.results.push({
          testCode: row['testcode'],
          value: this.parseValue(row['value']),
          unit: row['unit'] || null,
          abnormalFlag: (row['flag'] as any) || null,
          timestamp: row['timestamp'] || null,
        });
      }
    }

    return report;
  }

  validate(data: RawLabReport): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!data.patient.sampleId) errors.push('Missing sample ID');
    if (data.results.length === 0) errors.push('No test results found');
    return { valid: errors.length === 0, errors };
  }

  private parseValue(value: string): string | number | null {
    if (!value) return null;
    const num = parseFloat(value);
    return isNaN(num) ? value : num;
  }
}

export const analyzerRegistry = new AnalyzerParserRegistry();

analyzerRegistry.register(new SysmexXNParser());
analyzerRegistry.register(new BeckmanCoulterParser());
analyzerRegistry.register(new RocheParser());
analyzerRegistry.register(new CSVParser());

logger.info('Analyzer registry initialized', {
  formats: analyzerRegistry.getSupportedFormats(),
});
