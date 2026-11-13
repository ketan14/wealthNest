import { Result, ok, err } from '@wealthnest/shared';
import { DocumentCategory, buildVaultStoragePath } from '@wealthnest/domain';
import { SqliteDatabase } from './sqlite-connection.js';
import {
  DocumentVaultRepositoryPort,
  FamilyDocumentDto,
  UploadFamilyDocumentParams,
} from '../../ports/document-vault-repository.port.js';
import { generateId } from './sqlite-utils.js';

export class SqliteDocumentVaultAdapter implements DocumentVaultRepositoryPort {
  constructor(private readonly db: SqliteDatabase) {}

  async listDocumentsByUser(userId: string): Promise<Result<FamilyDocumentDto[]>> {
    try {
      const rows = this.db
        .prepare<{
          id: string;
          userId: string;
          memberId: string | null;
          title: string;
          category: string;
          fileName: string;
          fileSizeBytes: number;
          mimeType: string;
          storagePath: string;
          documentDate: string | null;
          expiryDate: string | null;
          notes: string | null;
          isEncrypted: number;
          createdAt: string;
          updatedAt: string;
        }>(
          `SELECT
             id,
             user_id as userId,
             member_id as memberId,
             title,
             category,
             file_name as fileName,
             file_size_bytes as fileSizeBytes,
             mime_type as mimeType,
             storage_path as storagePath,
             document_date as documentDate,
             expiry_date as expiryDate,
             notes,
             is_encrypted as isEncrypted,
             created_at as createdAt,
             updated_at as updatedAt
           FROM family_documents
           WHERE user_id = ?
           ORDER BY created_at DESC;`
        )
        .all(userId);

      const docs: FamilyDocumentDto[] = rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        memberId: r.memberId || undefined,
        title: r.title,
        category: r.category as DocumentCategory,
        fileName: r.fileName,
        fileSizeBytes: r.fileSizeBytes,
        mimeType: r.mimeType,
        storagePath: r.storagePath,
        documentDate: r.documentDate || undefined,
        expiryDate: r.expiryDate || undefined,
        notes: r.notes || undefined,
        isEncrypted: Boolean(r.isEncrypted),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));

      return ok(docs);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async uploadDocument(params: UploadFamilyDocumentParams): Promise<Result<FamilyDocumentDto>> {
    try {
      const id = generateId('doc');
      const storagePath = buildVaultStoragePath(params.userId, id, params.fileName);
      const now = new Date().toISOString();

      let dataUrl: string | null = null;
      if (
        typeof Blob !== 'undefined' &&
        params.fileBlob instanceof Blob &&
        typeof FileReader !== 'undefined'
      ) {
        dataUrl = await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(params.fileBlob as Blob);
        });
      }

      this.db
        .prepare(
          `INSERT INTO family_documents (
             id, user_id, member_id, title, category, file_name,
             file_size_bytes, mime_type, storage_path, document_date,
             expiry_date, notes, is_encrypted, local_data_url, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
        )
        .run(
          id,
          params.userId,
          params.memberId || null,
          params.title,
          params.category,
          params.fileName,
          params.fileSizeBytes,
          params.mimeType,
          storagePath,
          params.documentDate || null,
          params.expiryDate || null,
          params.notes || null,
          params.isEncrypted ? 1 : 0,
          dataUrl,
          now,
          now
        );

      return ok({
        id,
        userId: params.userId,
        memberId: params.memberId,
        title: params.title,
        category: params.category,
        fileName: params.fileName,
        fileSizeBytes: params.fileSizeBytes,
        mimeType: params.mimeType,
        storagePath,
        documentDate: params.documentDate,
        expiryDate: params.expiryDate,
        notes: params.notes,
        isEncrypted: Boolean(params.isEncrypted),
        createdAt: now,
        updatedAt: now,
      });
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async getDocumentDownloadUrl(
    documentId: string,
    _storagePath: string,
    userId: string
  ): Promise<Result<string>> {
    try {
      const row = this.db
        .prepare<{ localDataUrl: string | null }>(
          `SELECT local_data_url as localDataUrl FROM family_documents WHERE id = ? AND user_id = ?;`
        )
        .get(documentId, userId);

      if (!row || !row.localDataUrl) {
        return err(new Error('Document binary not found in local SQLite vault.'));
      }
      return ok(row.localDataUrl);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }

  async deleteDocument(
    documentId: string,
    _storagePath: string,
    userId: string
  ): Promise<Result<void>> {
    try {
      this.db
        .prepare(`DELETE FROM family_documents WHERE id = ? AND user_id = ?;`)
        .run(documentId, userId);
      return ok(undefined);
    } catch (errEx) {
      return err(errEx instanceof Error ? errEx : new Error(String(errEx)));
    }
  }
}
