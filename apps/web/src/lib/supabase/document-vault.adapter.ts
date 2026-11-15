import { Result, ok, err } from '@wealthnest/shared';
import { DocumentCategory, RecordVisibility, buildVaultStoragePath } from '@wealthnest/domain';
import {
  DocumentVaultRepositoryPort,
  FamilyDocumentDto,
  UploadFamilyDocumentParams,
} from '@wealthnest/application';
import { supabase } from './client';
import { validateVaultFileBlobSignature } from '@/lib/validation/import-file';
import { toValidUuidOrNull } from './uuid-utils';
import { resolveHouseholdIdForWrite, syncRestrictedRecordGrants } from './household-scope';

const VAULT_BUCKET = 'family-vault';

interface FamilyDocumentRow {
  id: string;
  household_id: string;
  visibility: RecordVisibility;
  created_by: string | null;
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
    householdId: row.household_id,
    userId: row.created_by || row.household_id,
    visibility: row.visibility,
    createdBy: row.created_by ?? undefined,
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
  async listDocumentsByHousehold(householdId: string): Promise<Result<FamilyDocumentDto[]>> {
    try {
      const validHouseholdId = toValidUuidOrNull(householdId);
      if (!validHouseholdId) {
        return ok([]);
      }

      const { data, error } = await supabase
        .from('family_documents')
        .select('*')
        .eq('household_id', validHouseholdId)
        .order('created_at', { ascending: false });

      if (error) {
        return err(new Error(`Failed to fetch family documents: ${error.message}`));
      }

      const rows = (data || []) as FamilyDocumentRow[];
      return ok(rows.map(mapRowToDto));
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async listDocumentsByUser(scopeId: string): Promise<Result<FamilyDocumentDto[]>> {
    return this.listDocumentsByHousehold(scopeId);
  }

  async uploadDocument(params: UploadFamilyDocumentParams): Promise<Result<FamilyDocumentDto>> {
    try {
      const signatureError = await validateVaultFileBlobSignature(
        params.fileBlob,
        params.mimeType,
        params.fileName
      );
      if (signatureError) {
        return err(new Error(signatureError));
      }

      const householdId = await resolveHouseholdIdForWrite(params.householdId, params.userId);
      const visibility: RecordVisibility = params.visibility ?? 'household_shared';
      const actorId = toValidUuidOrNull(params.userId);
      const docId = crypto.randomUUID();
      const storagePath = buildVaultStoragePath(householdId, docId, params.fileName);

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
          household_id: householdId,
          visibility,
          ...(actorId ? { created_by: actorId, updated_by: actorId } : {}),
          member_id: toValidUuidOrNull(params.memberId),
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
        await supabase.storage.from(VAULT_BUCKET).remove([storagePath]);
        return err(
          new Error(`Failed to save document metadata: ${insertError?.message || 'Unknown error'}`)
        );
      }

      if (visibility === 'restricted' && params.restrictedGranteeUserIds?.length) {
        await syncRestrictedRecordGrants({
          householdId,
          recordType: 'family_document',
          recordId: docId,
          visibility,
          granteeUserIds: params.restrictedGranteeUserIds,
        });
      }

      return ok(mapRowToDto(data as FamilyDocumentRow));
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async getDocumentDownloadUrl(
    _documentId: string,
    storagePath: string,
    _scopeId: string
  ): Promise<Result<string>> {
    try {
      const { data, error } = await supabase.storage
        .from(VAULT_BUCKET)
        .createSignedUrl(storagePath, 120);

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
    _scopeId: string
  ): Promise<Result<void>> {
    try {
      const { error: dbError } = await supabase
        .from('family_documents')
        .delete()
        .eq('id', documentId);

      if (dbError) {
        return err(new Error(`Failed to delete document record: ${dbError.message}`));
      }

      if (storagePath) {
        await supabase.storage.from(VAULT_BUCKET).remove([storagePath]);
      }

      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
