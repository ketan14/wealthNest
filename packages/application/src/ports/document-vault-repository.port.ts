import { Result } from '@wealthnest/shared';
import { DocumentCategory, FamilyDocument, RecordVisibility } from '@wealthnest/domain';

export type FamilyDocumentDto = FamilyDocument;

export interface UploadFamilyDocumentParams {
  readonly userId: string;
  readonly householdId?: string;
  readonly visibility?: RecordVisibility;
  readonly memberId?: string;
  readonly title: string;
  readonly category: DocumentCategory;
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly mimeType: string;
  readonly fileBlob: Blob | Uint8Array;
  readonly documentDate?: string;
  readonly expiryDate?: string;
  readonly notes?: string;
  readonly isEncrypted?: boolean;
  readonly restrictedGranteeUserIds?: readonly string[];
}

export interface DocumentVaultRepositoryPort {
  listDocumentsByUser(scopeId: string): Promise<Result<FamilyDocumentDto[]>>;
  listDocumentsByHousehold?(householdId: string): Promise<Result<FamilyDocumentDto[]>>;
  uploadDocument(params: UploadFamilyDocumentParams): Promise<Result<FamilyDocumentDto>>;
  getDocumentDownloadUrl(
    documentId: string,
    storagePath: string,
    scopeId: string
  ): Promise<Result<string>>;
  deleteDocument(documentId: string, storagePath: string, scopeId: string): Promise<Result<void>>;
}
