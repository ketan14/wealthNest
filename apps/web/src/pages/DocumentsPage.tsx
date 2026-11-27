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
  evaluatePlanQuota,
} from '@wealthnest/domain';
import { ManageDocumentVaultUseCase, FamilyDocumentDto } from '@wealthnest/application';
import { useAuth } from '@/lib/supabase/auth-context';
import { useHousehold } from '@/lib/supabase/household-context';
import { useFamily } from '@/lib/family/family-context';
import { useSupportSession } from '@/lib/admin/support-session-context';
import {
  useDocumentVaultRepository,
  useRepositories,
} from '@/lib/persistence/repository-context';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal';
import { ManageFamilyModal } from '@/components/family/ManageFamilyModal';
import {
  UploadDocumentModal,
  UploadDocumentFormData,
} from '@/components/vault/UploadDocumentModal';
import { DEMO_DOCUMENTS } from '@/components/vault/documents-demo-data';
import { shouldAllowDemoData } from '@/lib/config/mobile-runtime';
import { DocumentVaultList } from '@/components/vault/DocumentVaultList';
import { PlanQuotaBadge } from '@/components/plans/PlanQuotaBadge';
import { PlanLimitModal } from '@/components/plans/PlanLimitModal';

export function DocumentsPage() {
  const { user } = useAuth();
  const { activeHouseholdId, canEditFinancials, planTier, customLimits } = useHousehold();
  const { mode } = useRepositories();
  const { members, selectedMemberId, setSelectedMemberId } = useFamily();
  const { isSupportModeActive } = useSupportSession();
  const vaultRepo = useDocumentVaultRepository();
  const [searchParams, setSearchParams] = useSearchParams();

  const isDemoMode = mode === 'supabase' && (!user?.id || user.id.startsWith('demo-'));
  const hasLiveBackend = !isDemoMode && Boolean(activeHouseholdId || user?.id);
  const scopeId = activeHouseholdId || user?.id || '';

  const useCase = useMemo(() => new ManageDocumentVaultUseCase(vaultRepo), [vaultRepo]);

  const [documents, setDocuments] = useState<FamilyDocumentDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isPlanLimitOpen, setIsPlanLimitOpen] = useState(false);
  const [isManageFamilyOpen, setIsManageFamilyOpen] = useState(false);
  const [docPendingDelete, setDocPendingDelete] = useState<FamilyDocumentDto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    if (!hasLiveBackend || !scopeId) {
      setDocuments(shouldAllowDemoData(isDemoMode) ? DEMO_DOCUMENTS : []);
      setIsLoading(false);
      return;
    }

    const res = await useCase.listDocuments(scopeId);
    if (res.success) {
      setDocuments(res.value);
    } else {
      setErrorMessage(res.error.message);
    }
    setIsLoading(false);
  }, [hasLiveBackend, isDemoMode, scopeId, useCase]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

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
        const memberName = doc.memberId
          ? (memberNameMap.get(doc.memberId) || '').toLowerCase()
          : '';
        const haystack =
          `${doc.title} ${doc.fileName} ${doc.notes || ''} ${memberName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [memberFilteredDocs, selectedCategory, searchQuery, memberNameMap]);

  const handleUpload = async (formData: UploadDocumentFormData) => {
    if (hasLiveBackend && !canEditFinancials) {
      throw new Error('View-only household role cannot upload documents.');
    }
    if (!hasLiveBackend) {
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
      userId: user?.id || scopeId || 'local-user',
      householdId: activeHouseholdId || undefined,
      visibility: formData.visibility,
      restrictedGranteeUserIds: formData.restrictedGranteeUserIds,
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
    if (!hasLiveBackend || doc.id.startsWith('demo-')) {
      setStatusMessage(
        `Demo preview: "${doc.fileName}" (${formatFileSize(doc.fileSizeBytes)}) is stored in private household RLS path ${doc.storagePath}.`
      );
      return;
    }

    const res = await useCase.getDownloadUrl(
      doc.id,
      doc.storagePath,
      scopeId || user?.id || ''
    );
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

    if (!hasLiveBackend || docPendingDelete.id.startsWith('demo-')) {
      setDocuments((prev) => prev.filter((d) => d.id !== docPendingDelete.id));
      setStatusMessage(`Removed "${docPendingDelete.title}" from demo vault.`);
      setDocPendingDelete(null);
      setIsDeleting(false);
      return;
    }

    if (!canEditFinancials) {
      setErrorMessage('View-only household role cannot delete documents.');
      setDocPendingDelete(null);
      setIsDeleting(false);
      return;
    }

    const res = await useCase.deleteDocument(
      docPendingDelete.id,
      docPendingDelete.storagePath,
      scopeId || user?.id || ''
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

  const documentQuota = useMemo(
    () => evaluatePlanQuota(planTier, 'documents', documents.length, 1, customLimits),
    [planTier, documents.length, customLimits]
  );

  useEffect(() => {
    if (searchParams.get('action') !== 'new') return;
    if (isLoading) return;
    if (canEditFinancials && !isSupportModeActive) {
      if (!documentQuota.allowed) {
        setIsPlanLimitOpen(true);
      } else {
        setIsUploadModalOpen(true);
      }
    }
    const next = new URLSearchParams(searchParams);
    next.delete('action');
    setSearchParams(next, { replace: true });
  }, [
    searchParams,
    setSearchParams,
    canEditFinancials,
    isSupportModeActive,
    isLoading,
    documentQuota.allowed,
  ]);

  const handleOpenUploadModal = () => {
    if (!canEditFinancials || isSupportModeActive) return;
    if (!documentQuota.allowed) {
      setIsPlanLimitOpen(true);
      return;
    }
    setIsUploadModalOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-5 pb-20 md:pb-8">
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="hidden sm:flex p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
            <FolderLock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
              Family Document Vault
            </h1>
            <p className="hidden sm:block text-xs text-slate-400">
              Encrypted household records — PAN, HUF deeds, CAS statements &amp; property
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <PlanQuotaBadge
            resource="documents"
            currentCount={documents.length}
            onLimitClick={() => setIsPlanLimitOpen(true)}
          />
        <Button
          size="sm"
          onClick={handleOpenUploadModal}
          disabled={isSupportModeActive || !canEditFinancials}
          title={
            isSupportModeActive
              ? 'Disabled in Support Impersonation Mode (Read-Only)'
              : !canEditFinancials
                ? 'View-only household role cannot upload documents'
                : undefined
          }
          className="h-8 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs gap-1.5 shrink-0 shadow-sm"
        >
          <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Upload Document</span>
        </Button>
        </div>
      </div>

      {/* Compact Single-Row "MY FAMILY" Chip Strip */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground sm:hidden">
          <span className="font-semibold uppercase tracking-wider text-slate-400 text-[11px]">
            My Family
          </span>
          <button
            type="button"
            onClick={() => setIsManageFamilyOpen(true)}
            className="text-[10px] text-primary hover:underline"
          >
            Manage
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setSelectedMemberId('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
              selectedMemberId === 'all'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-secondary/60 text-muted-foreground hover:bg-secondary border border-border/60'
            }`}
          >
            All Members
          </button>

          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedMemberId(m.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                selectedMemberId === m.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary/60 text-muted-foreground hover:bg-secondary border border-border/60'
              }`}
            >
              {m.name}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setIsManageFamilyOpen(true)}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground bg-secondary/40 hover:bg-secondary border border-border/60 whitespace-nowrap shrink-0"
          >
            <span>+ Manage</span>
          </button>
        </div>
      </div>

      {/* Banners */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-xs underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {statusMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="text-xs underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Compact 2x2 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <Card className="border-border/80 bg-card/60">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between text-slate-400 text-[11px] sm:text-xs mb-1">
              <span className="truncate">Vault Documents</span>
              <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            </div>
            <div className="text-lg sm:text-2xl font-bold text-white">{summary.totalDocuments}</div>
            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 truncate">
              {selectedMemberId.toLowerCase() === 'all' ? 'All members' : 'Selected member'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between text-slate-400 text-[11px] sm:text-xs mb-1">
              <span className="truncate">Storage Used</span>
              <HardDrive className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            </div>
            <div className="text-lg sm:text-2xl font-bold text-white truncate">
              {formatFileSize(summary.totalSizeBytes)}
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 truncate">
              Private bucket
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between text-slate-400 text-[11px] sm:text-xs mb-1">
              <span className="truncate">Expiring / Renewals</span>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            </div>
            <div className="text-lg sm:text-2xl font-bold text-white">
              {summary.expiringSoonCount + summary.expiredCount}
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 truncate">
              {summary.expiredCount} expired · {summary.expiringSoonCount} due 30d
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between text-slate-400 text-[11px] sm:text-xs mb-1">
              <span className="truncate">Access Policy</span>
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            </div>
            <div className="text-base sm:text-xl font-bold text-white whitespace-nowrap truncate">
              Household RLS
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 truncate">
              Signed URLs · 20 MB
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Compact Search & Single-Row Horizontal Category Strip */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents, filenames, member..."
            className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-900 border border-slate-800 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="relative -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pr-6 sm:pr-0 py-0.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border whitespace-nowrap shrink-0 ${
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
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border whitespace-nowrap shrink-0 ${
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
          <div
            aria-hidden="true"
            className="pointer-events-none sm:hidden absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent"
          />
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
        canEditFinancials={canEditFinancials}
        onOpenUploadModal={handleOpenUploadModal}
        onDownload={handleDownload}
        onRequestDelete={(doc) => {
          if (canEditFinancials && !isSupportModeActive) setDocPendingDelete(doc);
        }}
      />

      {/* Modals */}
      <UploadDocumentModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSubmit={handleUpload}
        members={members}
        defaultMemberId={selectedMemberId}
      />

      <ManageFamilyModal isOpen={isManageFamilyOpen} onClose={() => setIsManageFamilyOpen(false)} />

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

      <PlanLimitModal
        isOpen={isPlanLimitOpen}
        onClose={() => setIsPlanLimitOpen(false)}
        resource="documents"
        currentCount={documents.length}
      />
    </div>
  );
}
