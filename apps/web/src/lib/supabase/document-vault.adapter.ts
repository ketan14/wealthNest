import { Result, ok, err } from '@wealthnest/shared';
import { DocumentCategory, buildVaultStoragePath } from '@wealthnest/domain';
import {
  DocumentVaultRepositoryPort,
  FamilyDocumentDto,
  UploadFamilyDocumentParams,
} from '@wealthnest/application';
import { supabase } from './client';

const VAULT_BUCKET = 'family-vault';

interface FamilyDocumentRow {
  id: string;
  user_id: string;
  member_id: string | null;
  title: string;
  category: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  storage_path: string;
  document_date: string | null;
  expiry_date: string | null;
  notes: string | null;
  is_encrypted: boolean;
  created_at: string;
  updated_at: string;
}

function mapRowToDto(row: FamilyDocumentRow): FamilyDocumentDto {
  return {
    id: row.id,
    userId: row.user_id,
    memberId: row.member_id || undefined,
    title: row.title,
    category: row.category as DocumentCategory,
    fileName: row.file_name,
    fileSizeBytes: Number(row.file_size_bytes),
    mimeType: row.mime_type,
    storagePath: row.storage_path,
    documentDate: row.document_date || undefined,
    expiryDate: row.expiry_date || undefined,
    notes: row.notes || undefined,
    isEncrypted: Boolean(row.is_encrypted),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseDocumentVaultAdapter implements DocumentVaultRepositoryPort {
  async listDocumentsByUser(userId: string): Promise<Result<FamilyDocumentDto[]>> {
    try {
      const { data, error } = await supabase
        .from('family_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return err(new Error(`Failed to fetch family documents: ${error.message}`));
      }

      const rows = (data || []) as FamilyDocumentRow[];
      // RLS enforces household scoping; filter if needed for explicit user view
      const filtered = userId ? rows : rows;
      return ok(filtered.map(mapRowToDto));
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async uploadDocument(params: UploadFamilyDocumentParams): Promise<Result<FamilyDocumentDto>> {
    try {
      const docId = crypto.randomUUID();
      const storagePath = buildVaultStoragePath(params.userId, docId, params.fileName);

      // 1. Upload binary object to private 'family-vault' Supabase Storage bucket
      const { error: uploadError } = await supabase.storage
        .from(VAULT_BUCKET)
        .upload(storagePath, params.fileBlob, {
          contentType: params.mimeType,
          upsert: false,
        });

      if (uploadError) {
        return err(new Error(`Storage upload failed: ${uploadError.message}`));
      }

      // 2. Insert metadata record into public.family_documents
      const { data, error: insertError } = await supabase
        .from('family_documents')
        .insert({
          id: docId,
          user_id: params.userId,
          member_id: params.memberId || null,
          title: params.title,
          category: params.category,
          file_name: params.fileName,
          file_size_bytes: params.fileSizeBytes,
          mime_type: params.mimeType,
          storage_path: storagePath,
          document_date: params.documentDate || null,
          expiry_date: params.expiryDate || null,
          notes: params.notes || null,
          is_encrypted: Boolean(params.isEncrypted),
        })
        .select('*')
        .single();

      if (insertError || !data) {
        // Best-effort rollback of orphaned storage object
        await supabase.storage.from(VAULT_BUCKET).remove([storagePath]);
        return err(
          new Error(`Failed to save document metadata: ${insertError?.message || 'Unknown error'}`)
        );
      }

      return ok(mapRowToDto(data as FamilyDocumentRow));
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async getDocumentDownloadUrl(
    _documentId: string,
    storagePath: string,
    _userId: string
  ): Promise<Result<string>> {
    try {
      const { data, error } = await supabase.storage
        .from(VAULT_BUCKET)
        .createSignedUrl(storagePath, 120); // 2-minute ephemeral signed URL

      if (error || !data?.signedUrl) {
        return err(new Error(`Failed to generate signed URL: ${error?.message || 'No URL'}`));
      }

      return ok(data.signedUrl);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async deleteDocument(
    documentId: string,
    storagePath: string,
    _userId: string
  ): Promise<Result<void>> {
    try {
      // 1. Delete metadata row (RLS enforces editor permission)
      const { error: dbError } = await supabase
        .from('family_documents')
        .delete()
        .eq('id', documentId);

      if (dbError) {
        return err(new Error(`Failed to delete document record: ${dbError.message}`));
      }

      // 2. Remove binary object from storage bucket
      if (storagePath) {
        await supabase.storage.from(VAULT_BUCKET).remove([storagePath]);
      }

      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

