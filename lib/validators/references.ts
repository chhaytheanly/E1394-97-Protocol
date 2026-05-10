import { TestResult, ReferenceRange } from '../schemas/validation';
import { logger } from '../logger/logger';
import type { TestAbnormality } from '../types/types';

export class ReferenceRangeValidator {
  private defaultRanges: Record<string, any> = {
    WBC: {
      unit: '10*3/uL',
      referenceMin: 4.5,
      referenceMax: 11.0,
      criticalMin: 2.0,
      criticalMax: 30.0,
      age: 'Adult',
      gender: 'B', // Both
    },
    // Red Blood Cell count
    RBC: {
      unit: '10*6/uL',
      referenceMin: 4.5,
      referenceMax: 5.9,
      criticalMin: 2.0,
      criticalMax: 10.0,
      age: 'Adult M',
      gender: 'M',
    },
    RBC_F: {
      unit: '10*6/uL',
      referenceMin: 4.1,
      referenceMax: 5.1,
      criticalMin: 2.0,
      criticalMax: 10.0,
      age: 'Adult F',
      gender: 'F',
    },
    // Hemoglobin
    HGB: {
      unit: 'g/dL',
      referenceMin: 13.5,
      referenceMax: 17.5,
      criticalMin: 7.0,
      criticalMax: 20.0,
      age: 'Adult M',
      gender: 'M',
    },
    HGB_F: {
      unit: 'g/dL',
      referenceMin: 12.0,
      referenceMax: 15.5,
      criticalMin: 7.0,
      criticalMax: 20.0,
      age: 'Adult F',
      gender: 'F',
    },
    // Hematocrit
    HCT: {
      unit: '%',
      referenceMin: 41.0,
      referenceMax: 53.0,
      criticalMin: 15.0,
      criticalMax: 60.0,
      age: 'Adult M',
      gender: 'M',
    },
    HCT_F: {
      unit: '%',
      referenceMin: 36.0,
      referenceMax: 46.0,
      criticalMin: 15.0,
      criticalMax: 60.0,
      age: 'Adult F',
      gender: 'F',
    },
    // Mean Corpuscular Volume
    MCV: {
      unit: 'fL',
      referenceMin: 80.0,
      referenceMax: 100.0,
      criticalMin: 50.0,
      criticalMax: 150.0,
    },
    // Mean Corpuscular Hemoglobin
    MCH: {
      unit: 'pg',
      referenceMin: 27.0,
      referenceMax: 33.0,
      criticalMin: 10.0,
      criticalMax: 50.0,
    },
    // Mean Corpuscular Hemoglobin Concentration
    MCHC: {
      unit: 'g/dL',
      referenceMin: 32.0,
      referenceMax: 36.0,
      criticalMin: 20.0,
      criticalMax: 45.0,
    },
    // Platelet count
    PLT: {
      unit: '10*3/uL',
      referenceMin: 150.0,
      referenceMax: 400.0,
      criticalMin: 20.0,
      criticalMax: 2000.0,
    },
    // Red cell distribution width - SD
    'RDW-SD': {
      unit: 'fL',
      referenceMin: 39.0,
      referenceMax: 46.0,
      criticalMin: 20.0,
      criticalMax: 100.0,
    },
    // Red cell distribution width - CV
    'RDW-CV': {
      unit: '%',
      referenceMin: 11.5,
      referenceMax: 14.5,
      criticalMin: 5.0,
      criticalMax: 50.0,
    },
    // Neutrophil percentage
    'NEUT%': {
      unit: '%',
      referenceMin: 40.0,
      referenceMax: 75.0,
      criticalMin: 0.0,
      criticalMax: 100.0,
    },
    // Lymphocyte percentage
    'LYMPH%': {
      unit: '%',
      referenceMin: 20.0,
      referenceMax: 45.0,
      criticalMin: 0.0,
      criticalMax: 100.0,
    },
    // Monocyte percentage
    'MONO%': {
      unit: '%',
      referenceMin: 2.0,
      referenceMax: 12.0,
      criticalMin: 0.0,
      criticalMax: 100.0,
    },
    // Eosinophil percentage
    'EO%': {
      unit: '%',
      referenceMin: 0.0,
      referenceMax: 5.0,
      criticalMin: 0.0,
      criticalMax: 100.0,
    },
    // Basophil percentage
    'BASO%': {
      unit: '%',
      referenceMin: 0.0,
      referenceMax: 2.0,
      criticalMin: 0.0,
      criticalMax: 100.0,
    },
  };

  /**
   * Validate test result against reference ranges
   */
  validateResult(
    result: TestResult,
    referenceRanges?: ReferenceRange[]
  ): TestAbnormality | null {
    // Skip non-numeric values
    if (typeof result.value !== 'number') {
      return null;
    }

    // Get reference range
    const range = referenceRanges
      ? this.selectApplicableRange(result.testCode, referenceRanges)
      : this.defaultRanges[result.testCode];

    if (!range) {
      logger.debug('No reference range found', { testCode: result.testCode });
      return null;
    }

    // Validate unit match
    if (range.unit && result.unit && range.unit !== result.unit) {
      logger.warn('Unit mismatch', {
        testCode: result.testCode,
        expected: range.unit,
        actual: result.unit,
      });
    }

    const value = result.value;

    // Check critical ranges first
    if (range.criticalMin !== undefined && value < range.criticalMin) {
      const deviation = this.calculateDeviation(value, range.criticalMin);
      return {
        testCode: result.testCode,
        value,
        status: 'CRITICAL_LOW',
        referenceMin: range.referenceMin,
        referenceMax: range.referenceMax,
        criticalMin: range.criticalMin,
        criticalMax: range.criticalMax,
        deviation,
      };
    }

    if (range.criticalMax !== undefined && value > range.criticalMax) {
      const deviation = this.calculateDeviation(value, range.criticalMax);
      return {
        testCode: result.testCode,
        value,
        status: 'CRITICAL_HIGH',
        referenceMin: range.referenceMin,
        referenceMax: range.referenceMax,
        criticalMin: range.criticalMin,
        criticalMax: range.criticalMax,
        deviation,
      };
    }

    // Check reference ranges
    if (range.referenceMin !== undefined && value < range.referenceMin) {
      const deviation = this.calculateDeviation(value, range.referenceMin);
      return {
        testCode: result.testCode,
        value,
        status: 'LOW',
        referenceMin: range.referenceMin,
        referenceMax: range.referenceMax,
        criticalMin: range.criticalMin,
        criticalMax: range.criticalMax,
        deviation,
      };
    }

    if (range.referenceMax !== undefined && value > range.referenceMax) {
      const deviation = this.calculateDeviation(value, range.referenceMax);
      return {
        testCode: result.testCode,
        value,
        status: 'HIGH',
        referenceMin: range.referenceMin,
        referenceMax: range.referenceMax,
        criticalMin: range.criticalMin,
        criticalMax: range.criticalMax,
        deviation,
      };
    }

    return {
      testCode: result.testCode,
      value,
      status: 'NORMAL',
      referenceMin: range.referenceMin,
      referenceMax: range.referenceMax,
      criticalMin: range.criticalMin,
      criticalMax: range.criticalMax,
    };
  }

  /**
   * Validate multiple results
   */
  validateResults(
    results: TestResult[],
    referenceRanges?: ReferenceRange[]
  ): TestAbnormality[] {
    return results
      .map(r => this.validateResult(r, referenceRanges))
      .filter((r): r is TestAbnormality => r !== null);
  }

  /**
   * Get abnormal results only
   */
  getAbnormalResults(validatedResults: TestAbnormality[]): TestAbnormality[] {
    return validatedResults.filter(r => r.status !== 'NORMAL');
  }

  /**
   * Get critical results
   */
  getCriticalResults(validatedResults: TestAbnormality[]): TestAbnormality[] {
    return validatedResults.filter(r =>
      r.status === 'CRITICAL_LOW' || r.status === 'CRITICAL_HIGH'
    );
  }

  /**
   * Calculate delta check (comparison with previous results)
   */
  calculateDeltaCheck(
    currentValue: number,
    previousValue: number,
    testCode: string
  ): { hasDelta: boolean; percentChange: number; severity: 'LOW' | 'MEDIUM' | 'HIGH' } {
    const percentChange = ((currentValue - previousValue) / previousValue) * 100;

    // Define delta check thresholds for common tests
    const thresholds: Record<string, number> = {
      WBC: 50,       // 50% change is significant
      HGB: 20,       // 20% change is significant
      PLT: 25,       // 25% change is significant
      'NEUT#': 30,   // 30% change is significant
    };

    const threshold = thresholds[testCode] || 30;
    const hasDelta = Math.abs(percentChange) > threshold;

    let severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (Math.abs(percentChange) > threshold * 2) severity = 'HIGH';
    else if (Math.abs(percentChange) > threshold) severity = 'MEDIUM';

    return { hasDelta, percentChange, severity };
  }

  /**
   * Select reference range based on age and gender
   */
  private selectApplicableRange(testCode: string, ranges: ReferenceRange[]): any {
    // Simple selection - in production, include age/gender matching
    const applicable = ranges.filter(r =>
      r.testCode === testCode && r.isActive !== false
    );

    return applicable[0] || null;
  }

  /**
   * Calculate deviation from reference range
   */
  private calculateDeviation(value: number, referencePoint: number): number {
    if (referencePoint === 0) return 0;
    return ((value - referencePoint) / Math.abs(referencePoint)) * 100;
  }

  /**
   * Generate reference range summary
   */
  generateSummary(validatedResults: TestAbnormality[]): {
    totalTests: number;
    normalCount: number;
    abnormalCount: number;
    criticalCount: number;
    compliancePercentage: number;
  } {
    const total = validatedResults.length;
    const normal = validatedResults.filter(r => r.status === 'NORMAL').length;
    const abnormal = validatedResults.filter(r =>
      r.status === 'LOW' || r.status === 'HIGH'
    ).length;
    const critical = validatedResults.filter(r =>
      r.status === 'CRITICAL_LOW' || r.status === 'CRITICAL_HIGH'
    ).length;

    return {
      totalTests: total,
      normalCount: normal,
      abnormalCount: abnormal,
      criticalCount: critical,
      compliancePercentage: (normal / total) * 100,
    };
  }
}

export const referenceValidator = new ReferenceRangeValidator();
