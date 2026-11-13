import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileText, AlertCircle } from 'lucide-react';
import {
  DOCUMENT_CATEGORIES,
  DocumentCategory,
  ALLOWED_VAULT_MIME_TYPES,
  MAX_VAULT_FILE_SIZE_BYTES,
  validateDocumentUpload,
  formatFileSize,
} from '@wealthnest/domain';
import { FamilyMemberDto } from '@wealthnest/application';
import { Button } from '@/components/ui/Button';

export interface UploadDocumentFormData {
  file: File;
  title: string;
  category: DocumentCategory;
  memberId?: string;
  documentDate?: string;
  expiryDate?: string;
  notes?: string;
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
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('identity_pan');
  const [memberId, setMemberId] = useState<string>(defaultMemberId || '');
  const [documentDate, setDocumentDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
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

    if (!file) {
      setError('Please select a document file to upload.');
      return;
    }

    const validation = validateDocumentUpload({
      title,
      category,
      fileName: file.name,
      fileSizeBytes: file.size,
      mimeType: file.type || 'application/pdf',
    });

    if (!validation.isValid) {
      setError(validation.error || 'Invalid document upload details.');
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
      });
      // Reset state and close
      setFile(null);
      setTitle('');
      setCategory('identity_pan');
      setDocumentDate('');
      setExpiryDate('');
      setNotes('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload document.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-doc-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Upload className="w-4 h-4" />
            </div>
            <div>
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
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
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

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Uploading...' : 'Save to Vault'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
