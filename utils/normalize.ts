export class Normalizer {

  static splitUnitAndFlag(raw: string): { unit: string | null; flag: string | null } {
    if (!raw) return { unit: null, flag: null };

    const match = raw.match(/^(.*?)([NHL]F|[NHLF])$/);
    if (match) {
      return { unit: match[1] || null, flag: match[2] || '' };
    }
    return { unit: raw, flag: null };
  }

  static formatTimestamp(raw: string): string | null {
    if (!raw || raw.length !== 14) return null;
    
    const year = raw.substring(0, 4);
    const month = raw.substring(4, 6);
    const day = raw.substring(6, 8);
    const hour = raw.substring(8, 10);
    const min = raw.substring(10, 12);
    const sec = raw.substring(12, 14);

    return `${year}-${month}-${day}T${hour}:${min}:${sec}`;
  }

  static parseNumeric(value: string | undefined): number | null {
    if (!value) return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  static mapGender(code: string | undefined): 'Male' | 'Female' | 'Other' | null {
    const map: Record<string, 'Male' | 'Female' | 'Other'> = {
      M: 'Male', F: 'Female', O: 'Other'
    };
    return code ? map[code] || 'Other' : null;
  }
}
