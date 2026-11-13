/**
 * Client-side resource bounds and signature validation for financial file imports
 * (CAS PDF statements and Zerodha/Groww broker CSVs).
 */

export const MAX_CAS_PDF_BYTES = 20 * 1024 * 1024; // 20 MiB
export const MAX_BROKER_CSV_BYTES = 5 * 1024 * 1024; // 5 MiB
export const MAX_CAS_PDF_PAGES = 100;
export const MAX_CSV_ROWS = 25_000;

export function hasPdfMagicHeader(bytes: ArrayBuffer): boolean {
  if (!bytes || bytes.byteLength < 5) {
    return false;
  }
  const header = new Uint8Array(bytes, 0, 5);
  // "%PDF-"
  return (
    header[0] === 0x25 &&
    header[1] === 0x50 &&
    header[2] === 0x44 &&
    header[3] === 0x46 &&
    header[4] === 0x2d
  );
}

export function validateFinancialImportFile(
  file: Pick<File, 'name' | 'size' | 'type'>,
  expectedKind: 'pdf' | 'csv'
): string | null {
  if (!file || typeof file.size !== 'number' || file.size <= 0) {
    return 'Selected file is empty.';
  }

  const lowerName = (file.name || '').toLowerCase();
  const lowerType = (file.type || '').toLowerCase();

  if (expectedKind === 'pdf') {
    if (file.size > MAX_CAS_PDF_BYTES) {
      return 'CAS PDF exceeds the 20 MiB maximum file size limit.';
    }
    const validName = lowerName.endsWith('.pdf');
    const validType = !lowerType || lowerType === 'application/pdf';
    if (!validName && lowerType !== 'application/pdf') {
      return 'Please select a valid .pdf CAS statement file.';
    }
    if (lowerType && !validType) {
      return 'Unsupported MIME type for CAS statement. Expected application/pdf.';
    }
    return null;
  }

  if (file.size > MAX_BROKER_CSV_BYTES) {
    return 'Broker CSV exceeds the 5 MiB maximum file size limit.';
  }
  const allowedCsvMimeTypes = new Set([
    'text/csv',
    'text/plain',
    'application/csv',
    'application/vnd.ms-excel',
  ]);
  const validName = lowerName.endsWith('.csv');
  const validType = !lowerType || allowedCsvMimeTypes.has(lowerType);
  if (!validName && (!lowerType || !allowedCsvMimeTypes.has(lowerType))) {
    return 'Please select a valid .csv broker statement file.';
  }
  if (lowerType && !validType) {
    return 'Unsupported MIME type for broker import. Expected a CSV file.';
  }
  return null;
}

export function validateCsvTextBounds(text: string): string | null {
  if (!text || !text.trim()) {
    return 'CSV file contains no readable data.';
  }
  if (text.length > MAX_BROKER_CSV_BYTES) {
    return 'CSV text content exceeds maximum allowed size.';
  }
  const lineCount = text.split(/\r?\n/).length;
  if (lineCount > MAX_CSV_ROWS) {
    return `CSV exceeds maximum supported limit of ${MAX_CSV_ROWS.toLocaleString()} rows.`;
  }
  return null;
}

