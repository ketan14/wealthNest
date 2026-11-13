export type DocumentCategory =
  | 'identity_pan'
  | 'property_deed'
  | 'cas_statement'
  | 'insurance_policy'
  | 'huf_deed'
  | 'tax_itr'
  | 'loan_agreement'
  | 'other';

export const DOCUMENT_CATEGORIES: readonly {
  readonly id: DocumentCategory;
  readonly label: string;
  readonly description: string;
}[] = [
  {
    id: 'identity_pan',
    label: 'PAN & Identity',
    description: 'PAN cards, Aadhaar, Passport, and KYC proofs',
  },
  {
    id: 'property_deed',
    label: 'Property Deeds',
    description: 'Sale deeds, Index II, society share certificates',
  },
  {
    id: 'cas_statement',
    label: 'CAS & Statements',
    description: 'CDSL/NSDL/CAMS/KFintech consolidated account statements',
  },
  {
    id: 'insurance_policy',
    label: 'Insurance Policies',
    description: 'Term life, health floater, and motor policies',
  },
  {
    id: 'huf_deed',
    label: 'HUF Deed & Records',
    description: 'HUF formation deed, PAN, and Karta resolutions',
  },
  {
    id: 'tax_itr',
    label: 'Tax & ITR',
    description: 'Income Tax Returns, Form 16, AIS/TIS, capital gains reports',
  },
  {
    id: 'loan_agreement',
    label: 'Loan Agreements',
    description: 'Home loan sanction letters, amortization schedules, NOCs',
  },
  {
    id: 'other',
    label: 'Other Documents',
    description: 'Wills, nominations, and miscellaneous records',
  },
] as const;

export const MAX_VAULT_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export const ALLOWED_VAULT_MIME_TYPES: readonly string[] = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

export interface FamilyDocument {
  readonly id: string;
  readonly userId: string;
  readonly memberId?: string;
  readonly title: string;
  readonly category: DocumentCategory;
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly mimeType: string;
  readonly storagePath: string;
  readonly documentDate?: string;
  readonly expiryDate?: string;
  readonly notes?: string;
  readonly isEncrypted: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DocumentUploadValidationInput {
  readonly title: string;
  readonly category: string;
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly mimeType: string;
}

export interface DocumentUploadValidationResult {
  readonly isValid: boolean;
  readonly error?: string;
}

const VALID_CATEGORY_SET = new Set<string>(DOCUMENT_CATEGORIES.map((c) => c.id));

/**
 * Pure domain validation for uploading a family document into the vault.
 */
export function validateDocumentUpload(
  input: DocumentUploadValidationInput
): DocumentUploadValidationResult {
  if (!input.title || input.title.trim().length < 2) {
    return { isValid: false, error: 'Document title must be at least 2 characters.' };
  }

  if (!VALID_CATEGORY_SET.has(input.category)) {
    return { isValid: false, error: `Invalid document category: "${input.category}".` };
  }

  if (!input.fileName || input.fileName.trim().length === 0) {
    return { isValid: false, error: 'File name is required.' };
  }

  if (input.fileSizeBytes <= 0) {
    return { isValid: false, error: 'File cannot be empty (0 bytes).' };
  }

  if (input.fileSizeBytes > MAX_VAULT_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      error: `File exceeds maximum allowed vault size of ${Math.round(MAX_VAULT_FILE_SIZE_BYTES / (1024 * 1024))} MB.`,
    };
  }

  if (!ALLOWED_VAULT_MIME_TYPES.includes(input.mimeType)) {
    return {
      isValid: false,
      error: `Unsupported file format (${input.mimeType || 'unknown'}). Allowed: PDF, PNG, JPEG, WebP, CSV, Excel.`,
    };
  }

  return { isValid: true };
}

/**
 * Builds the canonical RLS-enforced storage path:
 * <owner_user_id>/<document_id>/<sanitized_file_name>
 */
export function buildVaultStoragePath(
  userId: string,
  documentId: string,
  fileName: string
): string {
  const safeUserId = userId.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const safeDocId = documentId.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const safeFileName = fileName
    .trim()
    .replace(/[/\\]/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_');

  return `${safeUserId}/${safeDocId}/${safeFileName || 'document.pdf'}`;
}

export interface DocumentVaultSummary {
  readonly totalDocuments: number;
  readonly totalSizeBytes: number;
  readonly countsByCategory: Record<DocumentCategory, number>;
  readonly expiringSoonCount: number; // Within 30 days
  readonly expiredCount: number;
}

/**
 * Computes summary metrics for the Family Document Vault.
 */
export function summarizeDocumentVault(
  documents: readonly FamilyDocument[],
  referenceDate: Date = new Date()
): DocumentVaultSummary {
  const countsByCategory: Record<DocumentCategory, number> = {
    identity_pan: 0,
    property_deed: 0,
    cas_statement: 0,
    insurance_policy: 0,
    huf_deed: 0,
    tax_itr: 0,
    loan_agreement: 0,
    other: 0,
  };

  let totalSizeBytes = 0;
  let expiringSoonCount = 0;
  let expiredCount = 0;

  const refMs = referenceDate.getTime();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  for (const doc of documents) {
    totalSizeBytes += doc.fileSizeBytes;
    if (doc.category in countsByCategory) {
      countsByCategory[doc.category] += 1;
    }

    if (doc.expiryDate) {
      const expMs = new Date(doc.expiryDate).getTime();
      if (!Number.isNaN(expMs)) {
        if (expMs < refMs) {
          expiredCount += 1;
        } else if (expMs - refMs <= thirtyDaysMs) {
          expiringSoonCount += 1;
        }
      }
    }
  }

  return {
    totalDocuments: documents.length,
    totalSizeBytes,
    countsByCategory,
    expiringSoonCount,
    expiredCount,
  };
}

/**
 * Formats byte count into human-readable KB/MB.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
