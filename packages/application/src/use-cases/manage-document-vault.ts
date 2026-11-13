import { Result, err } from '@wealthnest/shared';
import { validateDocumentUpload } from '@wealthnest/domain';
import {
  DocumentVaultRepositoryPort,
  FamilyDocumentDto,
  UploadFamilyDocumentParams,
} from '../ports/document-vault-repository.port.js';

export class ManageDocumentVaultUseCase {
  constructor(private readonly vaultRepo: DocumentVaultRepositoryPort) {}

  async listDocuments(userId: string): Promise<Result<FamilyDocumentDto[]>> {
    if (!userId || userId.trim().length === 0) {
      return err(new Error('User ID is required to list vault documents.'));
    }
    return this.vaultRepo.listDocumentsByUser(userId);
  }

  async uploadDocument(params: UploadFamilyDocumentParams): Promise<Result<FamilyDocumentDto>> {
    if (!params.userId || params.userId.trim().length === 0) {
      return err(new Error('User ID is required to upload a document.'));
    }

    const validation = validateDocumentUpload({
      title: params.title,
      category: params.category,
      fileName: params.fileName,
      fileSizeBytes: params.fileSizeBytes,
      mimeType: params.mimeType,
    });

    if (!validation.isValid) {
      return err(new Error(validation.error || 'Invalid document upload parameters.'));
    }

    return this.vaultRepo.uploadDocument(params);
  }

  async getDownloadUrl(
    documentId: string,
    storagePath: string,
    userId: string
  ): Promise<Result<string>> {
    if (!documentId || !storagePath || !userId) {
      return err(new Error('Document ID, storage path, and user ID are required.'));
    }
    return this.vaultRepo.getDocumentDownloadUrl(documentId, storagePath, userId);
  }

  async deleteDocument(
    documentId: string,
    storagePath: string,
    userId: string
  ): Promise<Result<void>> {
    if (!documentId || !userId) {
      return err(new Error('Document ID and user ID are required to delete a document.'));
    }
    return this.vaultRepo.deleteDocument(documentId, storagePath, userId);
  }
}
