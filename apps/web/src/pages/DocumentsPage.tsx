import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FolderLock,
  Upload,
  Search,
  FileText,
  ShieldCheck,
  AlertTriangle,
  HardDrive,
} from 'lucide-react';
import {
  DOCUMENT_CATEGORIES,
  DocumentCategory,
  FamilyDocument,
  summarizeDocumentVault,
  formatFileSize,
} from '@wealthnest/domain';
import { ManageDocumentVaultUseCase, FamilyDocumentDto } from '@wealthnest/application';
import { useAuth } from '@/lib/supabase/auth-context';
import { useFamily } from '@/lib/family/family-context';
import { useSupportSession } from '@/lib/admin/support-session-context';
import { useDocumentVaultRepository } from '@/lib/persistence/repository-context';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal';
import { FamilyFilterBar } from '@/components/family/FamilyFilterBar';
import { ManageFamilyModal } from '@/components/family/ManageFamilyModal';
import {
  UploadDocumentModal,
  UploadDocumentFormData,
} from '@/components/vault/UploadDocumentModal';
import { DEMO_DOCUMENTS } from '@/components/vault/documents-demo-data';
import { DocumentVaultList } from '@/components/vault/DocumentVaultList';

export function DocumentsPage() {
  const { user } = useAuth();
  const { members, selectedMemberId } = useFamily();
  const { isSupportModeActive } = useSupportSession();
  const vaultRepo = useDocumentVaultRepository();
  const [searchParams, setSearchParams] = useSearchParams();

  const useCase = useMemo(() => new ManageDocumentVaultUseCase(vaultRepo), [vaultRepo]);

  const [documents, setDocuments] = useState<FamilyDocumentDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isManageFamilyOpen, setIsManageFamilyOpen] = useState(false);
  const [docPendingDelete, setDocPendingDelete] = useState<FamilyDocumentDto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    if (!user) {
      setDocuments(DEMO_DOCUMENTS);
      setIsLoading(false);
      return;
    }

    const res = await useCase.listDocuments(user.id);
    if (res.success) {
      setDocuments(res.value);
    } else {
      setErrorMessage(res.error.message);
    }
    setIsLoading(false);
  }, [user, useCase]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (searchParams.get('action') === 'new' && !isSupportModeActive) {
      setIsUploadModalOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, isSupportModeActive]);

  const memberNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) {
      map.set(m.id, m.name);
    }
    return map;
  }, [members]);

  // Filter by family member first for member-scoped summary + list
  const memberFilteredDocs = useMemo(() => {
    if (!selectedMemberId || selectedMemberId.toLowerCase() === 'all') return documents;
    return documents.filter((d) => d.memberId === selectedMemberId);
  }, [documents, selectedMemberId]);

  const summary = useMemo(() => {
    const domainDocs: FamilyDocument[] = memberFilteredDocs.map((d) => ({ ...d }));
    return summarizeDocumentVault(domainDocs);
  }, [memberFilteredDocs]);

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return memberFilteredDocs.filter((doc) => {
      if (selectedCategory !== 'ALL' && doc.category !== selectedCategory) {
        return false;
      }
      if (q) {
        const memberName = doc.memberId ? (memberNameMap.get(doc.memberId) || '').toLowerCase() : '';
        const haystack = `${doc.title} ${doc.fileName} ${doc.notes || ''} ${memberName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [memberFilteredDocs, selectedCategory, searchQuery, memberNameMap]);

  const handleUpload = async (formData: UploadDocumentFormData) => {
    if (!user) {
      // Demo mode: append locally so users can test the flow interactively
      const now = new Date().toISOString();
      const newDemoDoc: FamilyDocumentDto = {
        id: `demo-doc-${Date.now()}`,
        userId: 'demo-user',
        memberId: formData.memberId,
        title: formData.title,
        category: formData.category,
        fileName: formData.file.name,
        fileSizeBytes: formData.file.size,
        mimeType: formData.file.type || 'application/pdf',
        storagePath: `demo-user/demo-doc-${Date.now()}/${formData.file.name}`,
        documentDate: formData.documentDate,
        expiryDate: formData.expiryDate,
        notes: formData.notes,
        isEncrypted: false,
        createdAt: now,
        updatedAt: now,
      };
      setDocuments((prev) => [newDemoDoc, ...prev]);
      setStatusMessage(`Uploaded "${formData.title}" to demo vault.`);
      return;
    }

    const res = await useCase.uploadDocument({
      userId: user.id,
      memberId: formData.memberId,
      title: formData.title,
      category: formData.category,
      fileName: formData.file.name,
      fileSizeBytes: formData.file.size,
      mimeType: formData.file.type || 'application/pdf',
      fileBlob: formData.file,
      documentDate: formData.documentDate,
      expiryDate: formData.expiryDate,
      notes: formData.notes,
    });

    if (!res.success) {
      throw res.error;
    }

    setDocuments((prev) => [res.value, ...prev]);
    setStatusMessage(`Uploaded "${res.value.title}" securely.`);
  };

  const handleDownload = async (doc: FamilyDocumentDto) => {
    setErrorMessage(null);
    if (!user) {
      setStatusMessage(
        `Demo preview: "${doc.fileName}" (${formatFileSize(doc.fileSizeBytes)}) is stored in private household RLS path ${doc.storagePath}.`
      );
      return;
    }

    const res = await useCase.getDownloadUrl(doc.id, doc.storagePath, user.id);
    if (!res.success) {
      setErrorMessage(res.error.message);
      return;
    }
    window.open(res.value, '_blank', 'noopener,noreferrer');
  };

  const handleConfirmDelete = async () => {
    if (!docPendingDelete) return;
    setIsDeleting(true);
    setErrorMessage(null);

    if (!user) {
      setDocuments((prev) => prev.filter((d) => d.id !== docPendingDelete.id));
      setStatusMessage(`Removed "${docPendingDelete.title}" from demo vault.`);
      setDocPendingDelete(null);
      setIsDeleting(false);
      return;
    }

    const res = await useCase.deleteDocument(
      docPendingDelete.id,
      docPendingDelete.storagePath,
      user.id
    );
    if (res.success) {
      setDocuments((prev) => prev.filter((d) => d.id !== docPendingDelete.id));
      setStatusMessage(`Deleted "${docPendingDelete.title}".`);
    } else {
      setErrorMessage(res.error.message);
    }
    setDocPendingDelete(null);
    setIsDeleting(false);
  };

  const nowMs = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FolderLock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Family Document Vault
              </h1>
              <p className="text-sm text-slate-400">
                Encrypted household records — PAN, HUF deeds, CAS statements, insurance & property
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={() => setIsUploadModalOpen(true)}
          disabled={isSupportModeActive}
          className="flex items-center gap-2 self-start sm:self-auto"
        >
          <Upload className="w-4 h-4" />
          Upload Document
        </Button>
      </div>

      {/* Family Filter Bar */}
      <FamilyFilterBar
        onOpenManageModal={() => setIsManageFamilyOpen(true)}
        showAccountSelector={false}
      />

      {/* Banners */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-xs underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {statusMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center justify-between">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="text-xs underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Vault Documents</span>
              <FileText className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white">{summary.totalDocuments}</div>
            <p className="text-xs text-slate-500 mt-1">
              {selectedMemberId.toLowerCase() === 'all' ? 'Across all household members' : 'For selected member'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Storage Used</span>
              <HardDrive className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {formatFileSize(summary.totalSizeBytes)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Private household bucket</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Expiring / Renewals</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {summary.expiringSoonCount + summary.expiredCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {summary.expiredCount} expired · {summary.expiringSoonCount} due within 30d
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Access Policy</span>
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white">Household RLS</div>
            <p className="text-xs text-slate-500 mt-1">Signed URLs · 20 MB limit</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Category Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by document title, filename, member, or notes..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              selectedCategory === 'ALL'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            All ({summary.totalDocuments})
          </button>
          {DOCUMENT_CATEGORIES.map((cat) => {
            const count = summary.countsByCategory[cat.id] || 0;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Document List */}
      <DocumentVaultList
        isLoading={isLoading}
        filteredDocs={filteredDocs}
        memberNameMap={memberNameMap}
        nowMs={nowMs}
        thirtyDaysMs={thirtyDaysMs}
        isSupportModeActive={isSupportModeActive}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        onDownload={handleDownload}
        onRequestDelete={setDocPendingDelete}
      />

      {/* Modals */}
      <UploadDocumentModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSubmit={handleUpload}
        members={members}
        defaultMemberId={selectedMemberId}
      />

      <ManageFamilyModal
        isOpen={isManageFamilyOpen}
        onClose={() => setIsManageFamilyOpen(false)}
      />

      <ConfirmActionModal
        isOpen={Boolean(docPendingDelete)}
        title="Delete Vault Document"
        message={
          docPendingDelete
            ? `Are you sure you want to permanently delete "${docPendingDelete.title}"? This will remove both the metadata record and encrypted file.`
            : ''
        }
        confirmLabel="Delete Document"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDocPendingDelete(null)}
      />
    </div>
  );
}
