import { Result } from '@wealthnest/shared';
import { DocumentCategory, FamilyDocument } from '@wealthnest/domain';

export type FamilyDocumentDto = FamilyDocument;

export interface UploadFamilyDocumentParams {
  readonly userId: string;
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
}

export interface DocumentVaultRepositoryPort {
  listDocumentsByUser(userId: string): Promise<Result<FamilyDocumentDto[]>>;
  uploadDocument(params: UploadFamilyDocumentParams): Promise<Result<FamilyDocumentDto>>;
  getDocumentDownloadUrl(
    documentId: string,
    storagePath: string,
    userId: string
  ): Promise<Result<string>>;
  deleteDocument(documentId: string, storagePath: string, userId: string): Promise<Result<void>>;
}

