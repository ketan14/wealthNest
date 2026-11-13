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

const VAULT_MIME_EXTENSIONS: Readonly<Record<string, readonly string[]>> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
};

function matchesPrefix(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) {
    return false;
  }
  return signature.every((value, idx) => bytes[idx] === value);
}

/**
 * Validates file extension consistency and magic header signatures before uploading to family-vault.
 */
export function validateVaultFileSignature(
  bytes: ArrayBuffer,
  mimeType: string,
  fileName?: string
): string | null {
  const normalizedMime = (mimeType || '').toLowerCase();
  const allowedExts = VAULT_MIME_EXTENSIONS[normalizedMime];
  if (!allowedExts) {
    return `Unsupported vault file MIME type (${mimeType || 'unknown'}).`;
  }

  if (fileName) {
    const trimmedName = fileName.trim().toLowerCase();
    const dotIdx = trimmedName.lastIndexOf('.');
    if (dotIdx !== -1) {
      const ext = trimmedName.slice(dotIdx);
      if (!allowedExts.includes(ext)) {
        return `File extension "${ext}" does not match declared file type (${normalizedMime}).`;
      }
    }
  }

  const header = new Uint8Array(bytes);
  if (header.length === 0) {
    return 'Selected file is empty.';
  }

  switch (normalizedMime) {
    case 'application/pdf':
      return hasPdfMagicHeader(bytes)
        ? null
        : 'File content does not match a valid PDF document signature.';
    case 'image/png':
      return matchesPrefix(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        ? null
        : 'File content does not match a valid PNG image signature.';
    case 'image/jpeg':
      return matchesPrefix(header, [0xff, 0xd8, 0xff])
        ? null
        : 'File content does not match a valid JPEG image signature.';
    case 'image/webp': {
      const hasRiff = matchesPrefix(header, [0x52, 0x49, 0x46, 0x46]);
      const hasWebp =
        header.length >= 12 &&
        header[8] === 0x57 &&
        header[9] === 0x45 &&
        header[10] === 0x42 &&
        header[11] === 0x50;
      return hasRiff && hasWebp
        ? null
        : 'File content does not match a valid WebP image signature.';
    }
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return matchesPrefix(header, [0x50, 0x4b, 0x03, 0x04])
        ? null
        : 'File content does not match a valid .xlsx workbook signature.';
    case 'application/vnd.ms-excel':
      return matchesPrefix(header, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) ||
        matchesPrefix(header, [0x50, 0x4b, 0x03, 0x04])
        ? null
        : 'File content does not match a valid Excel workbook signature.';
    case 'text/csv': {
      // Reject binary executables, PDFs, ZIPs, null bytes, or HTML/script payloads masquerading as CSV
      const isBinary =
        header.includes(0x00) ||
        matchesPrefix(header, [0x4d, 0x5a]) || // PE/EXE "MZ"
        matchesPrefix(header, [0x7f, 0x45, 0x4c, 0x46]) || // ELF
        matchesPrefix(header, [0x50, 0x4b, 0x03, 0x04]) || // ZIP
        hasPdfMagicHeader(bytes);
      if (isBinary) {
        return 'Binary payload cannot be uploaded as a CSV document.';
      }
      const preview = new TextDecoder().decode(header.slice(0, 512)).trimStart().toLowerCase();
      if (
        preview.startsWith('<html') ||
        preview.startsWith('<!doctype') ||
        preview.startsWith('<script')
      ) {
        return 'HTML/script payload cannot be uploaded as a CSV document.';
      }
      return null;
    }
    default:
      return 'Unsupported vault file type.';
  }
}

export async function readBlobHeaderBytes(blob: Blob, maxBytes = 8192): Promise<ArrayBuffer | null> {
  const slice = typeof blob.slice === 'function' ? blob.slice(0, maxBytes) : blob;
  if (typeof slice.arrayBuffer === 'function') {
    return slice.arrayBuffer();
  }
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result instanceof ArrayBuffer ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsArrayBuffer(slice);
    });
  }
  return null;
}

/**
 * Shared async vault file validator reading only the file header slice and checking
 * extension/MIME consistency plus binary magic signatures before upload.
 */
export async function validateVaultFileBlobSignature(
  blob: Blob | Uint8Array | unknown,
  mimeType: string,
  fileName?: string
): Promise<string | null> {
  let headerBytes: ArrayBuffer | null = null;
  if (ArrayBuffer.isView(blob)) {
    const view = new Uint8Array(blob.buffer, blob.byteOffset, Math.min(blob.byteLength, 8192));
    headerBytes = view.slice().buffer;
  } else if (blob instanceof ArrayBuffer) {
    headerBytes = blob.slice(0, 8192);
  } else if (
    blob &&
    typeof blob === 'object' &&
    ((typeof Blob !== 'undefined' && blob instanceof Blob) ||
      typeof (blob as Blob).arrayBuffer === 'function' ||
      typeof (blob as Blob).slice === 'function')
  ) {
    headerBytes = await readBlobHeaderBytes(blob as Blob);
  } else {
    return 'Selected document binary payload is missing or invalid.';
  }
  if (!headerBytes) {
    return 'Unable to inspect document header signature.';
  }
  return validateVaultFileSignature(headerBytes, mimeType, fileName);
}


