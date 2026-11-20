import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, AlertCircle } from 'lucide-react';
import {
  DOCUMENT_CATEGORIES,
  DocumentCategory,
  ALLOWED_VAULT_MIME_TYPES,
  MAX_VAULT_FILE_SIZE_BYTES,
  RecordVisibility,
  validateDocumentUpload,
  formatFileSize,
} from '@wealthnest/domain';
import { FamilyMemberDto } from '@wealthnest/application';
import { Button } from '@/components/ui/Button';
import { ResponsiveModalShell } from '@/components/ui/ResponsiveModalShell';
import { VisibilityControl } from '@/components/household/VisibilityControl';
import { useHousehold } from '@/lib/supabase/household-context';
import { validateVaultFileBlobSignature } from '@/lib/validation/import-file';

export interface UploadDocumentFormData {
  file: File;
  title: string;
  category: DocumentCategory;
  memberId?: string;
  documentDate?: string;
  expiryDate?: string;
  notes?: string;
  visibility?: RecordVisibility;
  restrictedGranteeUserIds?: string[];
}

interface UploadDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: UploadDocumentFormData) => Promise<void>;
  members: FamilyMemberDto[];
  defaultMemberId?: string;
}

export function UploadDocumentModal({
  isOpen,
  onClose,
  onSubmit,
  members,
  defaultMemberId,
}: UploadDocumentModalProps) {
  const { canEditFinancials } = useHousehold();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('identity_pan');
  const [memberId, setMemberId] = useState<string>(defaultMemberId || '');
  const [documentDate, setDocumentDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [visibility, setVisibility] = useState<RecordVisibility>('household_shared');
  const [restrictedGranteeUserIds, setRestrictedGranteeUserIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMemberId(
        defaultMemberId && defaultMemberId.toLowerCase() !== 'all' ? defaultMemberId : ''
      );
      setError(null);
    }
  }, [isOpen, defaultMemberId]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setError(null);
    if (selected && !title.trim()) {
      // Strip extension for a clean default document title
      const cleanName = selected.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
      setTitle(cleanName);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!canEditFinancials) {
      setError('Viewers have read-only access and cannot upload vault documents.');
      return;
    }

    if (!file) {
      setError('Please select a document file to upload.');
      return;
    }

    const declaredMime = file.type || 'application/pdf';
    const validation = validateDocumentUpload({
      title,
      category,
      fileName: file.name,
      fileSizeBytes: file.size,
      mimeType: declaredMime,
    });

    if (!validation.isValid) {
      setError(validation.error || 'Invalid document upload details.');
      return;
    }

    const signatureError = await validateVaultFileBlobSignature(file, declaredMime, file.name);
    if (signatureError) {
      setError(signatureError);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        file,
        title: title.trim(),
        category,
        memberId: memberId || undefined,
        documentDate: documentDate || undefined,
        expiryDate: expiryDate || undefined,
        notes: notes.trim() || undefined,
        visibility,
        restrictedGranteeUserIds:
          visibility === 'restricted' ? restrictedGranteeUserIds : undefined,
      });
      // Reset state and close
      setFile(null);
      setTitle('');
      setCategory('identity_pan');
      setDocumentDate('');
      setExpiryDate('');
      setNotes('');
      setVisibility('household_shared');
      setRestrictedGranteeUserIds([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload document.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveModalShell
      portal
      variant="sheet"
      role="dialog"
      ariaLabelledBy="upload-doc-modal-title"
      onBackdropClick={onClose}
      backdropClassName="z-[9999] bg-black/80"
      panelClassName="max-w-lg bg-slate-900 border-slate-800"
      formProps={{ onSubmit: handleSubmit }}
      header={
        <div className="flex items-center justify-between gap-2 px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
              <Upload className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 id="upload-doc-modal-title" className="text-base font-semibold text-white">
                Upload to Family Vault
              </h2>
              <p className="text-xs text-slate-400">
                Max {formatFileSize(MAX_VAULT_FILE_SIZE_BYTES)} · PDF, PNG, JPG, WEBP, CSV, Excel
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      }
      bodyClassName="p-4 sm:p-6 space-y-4"
      footer={
        <div className="flex items-center justify-end gap-2.5 px-4 py-3 sm:px-6 border-t border-slate-800 bg-slate-900">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !canEditFinancials}>
            {isSubmitting ? 'Uploading...' : 'Save to Vault'}
          </Button>
        </div>
      }
    >
      {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* File Picker */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Document File *
            </label>
            <label className="flex flex-col items-center justify-center w-full px-4 py-5 border-2 border-dashed border-slate-700 hover:border-emerald-500/50 rounded-xl cursor-pointer bg-slate-950/50 transition-colors">
              <FileText className="w-6 h-6 text-slate-400 mb-2" />
              {file ? (
                <div className="text-center">
                  <p className="text-sm font-medium text-emerald-400 break-all">{file.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatFileSize(file.size)}</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-slate-300">Click to select a file</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Protected by private household RLS storage
                  </p>
                </div>
              )}
              <input
                type="file"
                accept={ALLOWED_VAULT_MIME_TYPES.join(',')}
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {/* Document Title */}
          <div>
            <label htmlFor="doc-title" className="block text-xs font-medium text-slate-300 mb-1.5">
              Document Title *
            </label>
            <input
              id="doc-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Ketan PAN Card / FY 2025-26 CDSL CAS"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          {/* Category & Family Member */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="doc-category"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Category *
              </label>
              <select
                id="doc-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="doc-member"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Family Member
              </label>
              <select
                id="doc-member"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">Household / Shared</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.relationship})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="doc-date" className="block text-xs font-medium text-slate-300 mb-1.5">
                Document Date
              </label>
              <input
                id="doc-date"
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label
                htmlFor="doc-expiry"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Expiry / Renewal Date
              </label>
              <input
                id="doc-expiry"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="doc-notes" className="block text-xs font-medium text-slate-300 mb-1.5">
              Notes
            </label>
            <textarea
              id="doc-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Policy number, locker location, or password hint..."
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <VisibilityControl
            visibility={visibility}
            onChange={setVisibility}
            granteeUserIds={restrictedGranteeUserIds}
            onGranteeUserIdsChange={setRestrictedGranteeUserIds}
            disabled={!canEditFinancials}
            compact
          />
    </ResponsiveModalShell>
  );
}
