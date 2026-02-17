/**
 * Filename Parser for Company Folder Documents
 *
 * Parses filenames in the format: {policy#}{doctype}{series#}{date}.{ext}
 * Examples:
 *   ca12135endo060225.pdf -> policy: ca12135, doctype: endo, series: null, date: 060225
 *   GALIMO0001811mvr2060225.jpeg -> policy: GALIMO0001811, doctype: mvr, series: 2, date: 060225
 *   gal0086drv060225.jpeg -> policy: gal0086, doctype: drv, series: null, date: 060225
 */

export interface ParsedFilename {
  original: string;
  policyNumber: string | null;
  documentType: string | null;
  documentTypeLabel: string | null;
  seriesNumber: string | null;
  dateCode: string | null;
  dateFormatted: string | null;  // YYYY-MM-DD format
  extension: string;
  parseSuccess: boolean;
  parseError?: string;
}

// Document type abbreviations and their full labels
const DOC_TYPE_MAP: Record<string, string> = {
  'endo': 'Endorsement',
  'mvr': 'MVR',
  'coi': 'CERT OF LIABILITY',
  'noloss': 'NO LOSS',
  'drv': 'Vehicle Picture',   // Driver side photo
  'frt': 'Vehicle Picture',   // Front photo
  'pass': 'Vehicle Picture',  // Passenger side photo
  'rear': 'Vehicle Picture',  // Rear photo
  'vin': 'Vehicle Picture',   // VIN photo
  'dl': 'MVR',                // Driver's license
  'pic': 'Vehicle Picture',
  'pics': 'Vehicle Picture',
  'forme': 'AUTHORIZATION',   // Form E
  'vehreg': 'Vehicle Picture', // Vehicle registration
  'canc': 'Cancellation notice',
  'cancel': 'Cancellation notice',
  'app': 'Appraisal',
  'appr': 'Appraisal',
  'claim': 'CLAIM FILE',
  'corr': 'Correspondence',
  'letter': 'AGENCY LETTER',
  'auth': 'AUTHORIZATION',
  'bill': 'Bill of Sale',
  'certcomp': 'CERTIFICATE OF COMPLETION',
  'chargeback': 'CHARGE BACK',
  'bidem': 'BI Demand',
  'buslic': 'BUSINESS LICENSE',
  'aceoff': 'ACE Offer',
  'addrchg': 'ADDRESS CHANGE',
  'autodec': 'AUTO DECLARATION',
  'log': 'Letter of Guarantee',
};

// Policy number patterns
const POLICY_PATTERNS = [
  // New format: GALIMO0001862, GATAXI0002309, GALC0001624
  /^(GALIMO\d{7})/i,
  /^(GATAXI\d{7})/i,
  /^(GALC\d{7})/i,

  // Short format: gal0086, ca12135, ca6116
  /^(gal\d{4})/i,
  /^(ca\d{4,5})/i,

  // Old format with hyphen: 8789-GALC-1234
  /^(\d{4}-[A-Z]{2,4}-\d{4})/i,
];

// Document type patterns (case insensitive)
const DOC_TYPE_PATTERN = /(endo|mvr|coi|noloss|drv|frt|pass|rear|vin|dl|pics?|forme|vehreg|canc(?:el)?|appr?|claim|corr|letter|auth|bill|certcomp|chargeback|bidem|buslic|aceoff|addrchg|autodec|log)(\d)?/i;

// Date pattern: 6 digits MMDDYY
const DATE_PATTERN = /(\d{6})\.[a-z0-9]+$/i;

/**
 * Parse a date code in MMDDYY format to YYYY-MM-DD
 */
function parseDateCode(dateCode: string): string | null {
  if (!dateCode || dateCode.length !== 6) return null;

  const mm = dateCode.substring(0, 2);
  const dd = dateCode.substring(2, 4);
  const yy = dateCode.substring(4, 6);

  // Determine century: 00-30 = 2000s, 31-99 = 1900s
  const yyNum = parseInt(yy, 10);
  const century = yyNum <= 30 ? '20' : '19';

  return `${century}${yy}-${mm}-${dd}`;
}

/**
 * Parse a filename to extract policy number, document type, series, and date
 */
export function parseFilename(filename: string): ParsedFilename {
  const result: ParsedFilename = {
    original: filename,
    policyNumber: null,
    documentType: null,
    documentTypeLabel: null,
    seriesNumber: null,
    dateCode: null,
    dateFormatted: null,
    extension: '',
    parseSuccess: false,
  };

  // Extract extension
  const extMatch = filename.match(/\.([a-z0-9]+)$/i);
  if (extMatch) {
    result.extension = extMatch[1].toLowerCase();
  }

  // Get filename without extension for parsing
  const nameOnly = filename.replace(/\.[^.]+$/, '');

  // Try to extract policy number
  let remainingName = nameOnly;
  for (const pattern of POLICY_PATTERNS) {
    const match = nameOnly.match(pattern);
    if (match) {
      result.policyNumber = match[1].toUpperCase();
      remainingName = nameOnly.substring(match[1].length);
      break;
    }
  }

  // Try to extract document type and optional series number
  const docMatch = remainingName.match(DOC_TYPE_PATTERN);
  if (docMatch) {
    result.documentType = docMatch[1].toLowerCase();
    result.documentTypeLabel = DOC_TYPE_MAP[result.documentType] || result.documentType.toUpperCase();
    if (docMatch[2]) {
      result.seriesNumber = docMatch[2];
    }
  }

  // Try to extract date
  const dateMatch = filename.match(DATE_PATTERN);
  if (dateMatch) {
    result.dateCode = dateMatch[1];
    result.dateFormatted = parseDateCode(dateMatch[1]);
  }

  // Determine if parse was successful (at minimum need policy number)
  if (result.policyNumber) {
    result.parseSuccess = true;
  } else {
    result.parseError = 'Could not extract policy number from filename';
  }

  return result;
}

/**
 * Generate a standardized filename for storage
 */
export function generateStorageFilename(parsed: ParsedFilename): string {
  if (!parsed.policyNumber) {
    return parsed.original;
  }

  let name = parsed.policyNumber.toLowerCase();

  if (parsed.documentType) {
    name += parsed.documentType;
  }

  if (parsed.seriesNumber) {
    name += parsed.seriesNumber;
  }

  if (parsed.dateCode) {
    name += parsed.dateCode;
  }

  name += '.' + (parsed.extension || 'pdf');

  return name;
}

/**
 * Batch test - parse multiple filenames and return results
 */
export function testParser(filenames: string[]): ParsedFilename[] {
  return filenames.map(parseFilename);
}
