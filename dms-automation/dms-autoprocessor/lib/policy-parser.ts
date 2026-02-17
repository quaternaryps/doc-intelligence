// Policy number patterns (in priority order)
const POLICY_PATTERNS = [
  // Old format: 8789-GALC-1234
  /(\d{4}-[A-Z]{2}[A-Z]{2,4}-\d{4})/,

  // New format: GALIMO0001862, GATAXI0002309, etc.
  /([A-Z]{2}(?:LIM|LIMO|TAXI|LC)\d{7,10})/,

  // Variations with spaces
  /([A-Z]{2}\s*(?:LIM|LIMO|TAXI|LC)\s*\d{7,10})/,

  // Catch-all: State code + alphanumeric
  /((?:GA|TN)[A-Z]{2,6}\d{4,10})/,

  // Simple 7+ digit number (like 0000050, 0000084)
  /(\d{7,})/,
];

/**
 * Try to extract a policy/claim number from the filename alone.
 * Underwriters embed policy numbers in filenames for Company folder documents.
 */
function extractFromFilename(fileName: string): string | null {
  // Strip the file extension before matching
  const nameOnly = fileName.replace(/\.[^.]+$/, "").toUpperCase();

  for (const pattern of POLICY_PATTERNS) {
    const match = nameOnly.match(pattern);
    if (match) {
      return match[1].replace(/\s+/g, "");
    }
  }

  // Looser filename pattern: alphanumeric sequences with 4+ digits
  const looseMatch = nameOnly.match(/([A-Z]*\d{4,10})/i);
  if (looseMatch) {
    return looseMatch[1].toUpperCase();
  }

  return null;
}

/**
 * Try to extract a policy/claim number from OCR text content.
 */
function extractFromOcrText(ocrText: string): string | null {
  const text = ocrText.toUpperCase();

  for (const pattern of POLICY_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[1].replace(/\s+/g, "");
    }
  }

  return null;
}

export function extractPolicyNumber(ocrText: string, fileName: string): string | null {
  // PRIORITY 1: Try filename first — underwriters embed policy # in the filename
  const fromFilename = extractFromFilename(fileName);
  if (fromFilename) {
    console.log(`     Policy source: FILENAME ("${fileName}")`);
    return fromFilename;
  }

  // PRIORITY 2: Fall back to OCR text from the document front page
  const fromOcr = extractFromOcrText(ocrText);
  if (fromOcr) {
    console.log(`     Policy source: OCR content`);
    return fromOcr;
  }

  return null;
}

export function parseStateCode(policyNumber: string): string {
  const upper = policyNumber.toUpperCase();
  if (upper.startsWith("GA")) return "Georgia";
  if (upper.startsWith("TN")) return "Tennessee";
  return "Unknown";
}

export function parseLineOfBusiness(policyNumber: string): string {
  const upper = policyNumber.toUpperCase();
  if (upper.includes("LIM") || upper.includes("LIMO")) return "Limo";
  if (upper.includes("TAXI")) return "Taxi";
  if (upper.includes("LC")) return "Light Commercial";
  return "Unknown";
}
