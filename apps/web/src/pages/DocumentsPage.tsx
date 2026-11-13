import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FolderLock,
  Upload,
  Search,
  Download,
  Trash2,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Calendar,
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
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal';
import { FamilyFilterBar } from '@/components/family/FamilyFilterBar';
import { ManageFamilyModal } from '@/components/family/ManageFamilyModal';
import {
  UploadDocumentModal,
  UploadDocumentFormData,
} from '@/components/vault/UploadDocumentModal';

const DEMO_DOCUMENTS: FamilyDocumentDto[] = [
  {
    id: 'demo-doc-1',
    userId: 'demo-user',
    memberId: 'mem-self',
    title: 'Ketan Vaghela — PAN Card',
    category: 'identity_pan',
    fileName: 'ketan_pan_card.pdf',
    fileSizeBytes: 248_400,
    mimeType: 'application/pdf',
    storagePath: 'demo-user/demo-doc-1/ketan_pan_card.pdf',
    documentDate: '2016-04-12',
    notes: 'Original e-PAN verified with Income Tax portal.',
    isEncrypted: false,
    createdAt: '2026-01-10T10:00:00Z',
    updatedAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'demo-doc-2',
    userId: 'demo-user',
    memberId: 'mem-huf',
    title: 'Shamalbhai Vaghela HUF — Formation Deed & PAN',
    category: 'huf_deed',
    fileName: 'shamalbhai_huf_deed.pdf',
    fileSizeBytes: 1_420_000,
    mimeType: 'application/pdf',
    storagePath: 'demo-user/demo-doc-2/shamalbhai_huf_deed.pdf',
    documentDate: '2019-07-01',
    notes: 'Used for Section 112A LTCG tax shield & HUF demat KYC.',
    isEncrypted: false,
    createdAt: '2026-01-15T11:30:00Z',
    updatedAt: '2026-01-15T11:30:00Z',
  },
  {
    id: 'demo-doc-3',
    userId: 'demo-user',
    memberId: 'mem-spouse',
    title: 'Parul & Ketan — Family Floater Health Insurance',
    category: 'insurance_policy',
    fileName: 'hdfc_ergo_optima_secure_2026.pdf',
    fileSizeBytes: 890_500,
    mimeType: 'application/pdf',
    storagePath: 'demo-user/demo-doc-3/hdfc_ergo_optima_secure_2026.pdf',
    documentDate: '2025-12-01',
    expiryDate: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    notes: '₹15L base + ₹15L restore cover. Renewal due soon.',
    isEncrypted: false,
    createdAt: '2026-02-01T09:15:00Z',
    updatedAt: '2026-02-01T09:15:00Z',
  },
  {
    id: 'demo-doc-4',
    userId: 'demo-user',
    memberId: 'mem-self',
    title: 'CDSL & CAMS Consolidated Account Statement (CAS)',
    category: 'cas_statement',
    fileName: 'vaghela_household_cas_fy26.pdf',
    fileSizeBytes: 3_250_000,
    mimeType: 'application/pdf',
    storagePath: 'demo-user/demo-doc-4/vaghela_household_cas_fy26.pdf',
    documentDate: '2026-03-31',
    notes: 'Covers Equity, Mutual Funds, and SGB holdings.',
    isEncrypted: false,
    createdAt: '2026-04-02T14:20:00Z',
    updatedAt: '2026-04-02T14:20:00Z',
  },
  {
    id: 'demo-doc-5',
    userId: 'demo-user',
    memberId: 'mem-mother',
    title: 'Ramilaben Vaghela — SGB Tranche Certificates',
    category: 'property_deed',
    fileName: 'ramilaben_sgb_certificates.pdf',
    fileSizeBytes: 640_000,
    mimeType: 'application/pdf',
    storagePath: 'demo-user/demo-doc-5/ramilaben_sgb_certificates.pdf',
    documentDate: '2023-09-20',
    notes: 'RBI Sovereign Gold Bond 2023-24 Series II holding certificate.',
    isEncrypted: false,
    createdAt: '2026-02-12T16:45:00Z',
    updatedAt: '2026-02-12T16:45:00Z',
  },
  {
    id: 'demo-doc-6',
    userId: 'demo-user',
    memberId: 'mem-child',
    title: 'Krisha Vaghela — Birth Certificate & Aadhaar',
    category: 'identity_pan',
    fileName: 'krisha_identity_docs.pdf',
    fileSizeBytes: 512_000,
    mimeType: 'application/pdf',
    storagePath: 'demo-user/demo-doc-6/krisha_identity_docs.pdf',
    documentDate: '2020-05-14',
    notes: 'Needed for Sukanya Samriddhi & Minor Mutual Fund folio.',
    isEncrypted: false,
    createdAt: '2026-02-20T08:10:00Z',
    updatedAt: '2026-02-20T08:10:00Z',
  },
];

function getCategoryLabel(category: DocumentCategory): string {
  return DOCUMENT_CATEGORIES.find((c) => c.id === category)?.label || category;
}

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
      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-slate-400">
            Loading Family Document Vault...
          </CardContent>
        </Card>
      ) : filteredDocs.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <FolderLock className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="text-base font-medium text-slate-200">No documents found</div>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Upload PAN cards, HUF deeds, CAS statements, or insurance policies to keep your
              family records organized and protected.
            </p>
            <Button
              onClick={() => setIsUploadModalOpen(true)}
              disabled={isSupportModeActive}
              className="mt-2"
            >
              Upload First Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDocs.map((doc) => {
            const memberName = doc.memberId ? memberNameMap.get(doc.memberId) : undefined;
            const expiryMs = doc.expiryDate ? new Date(doc.expiryDate).getTime() : null;
            const isExpired = expiryMs !== null && !Number.isNaN(expiryMs) && expiryMs < nowMs;
            const isExpiringSoon =
              expiryMs !== null &&
              !Number.isNaN(expiryMs) &&
              expiryMs >= nowMs &&
              expiryMs - nowMs <= thirtyDaysMs;

            return (
              <Card key={doc.id} className="hover:border-slate-700 transition-colors">
                <CardContent className="p-5 flex flex-col justify-between gap-4 h-full">
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2.5 rounded-xl bg-slate-800 text-emerald-400 shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-white truncate">{doc.title}</h3>
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {doc.fileName} · {formatFileSize(doc.fileSizeBytes)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="default">{getCategoryLabel(doc.category)}</Badge>
                      {memberName && <Badge variant="secondary">{memberName}</Badge>}
                      {!memberName && <Badge variant="default">Household</Badge>}
                      {isExpired && <Badge variant="destructive">Expired</Badge>}
                      {isExpiringSoon && <Badge variant="outline">Renewal Soon</Badge>}
                    </div>

                    {doc.notes && (
                      <p className="text-xs text-slate-400 line-clamp-2">{doc.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs text-slate-500">
                    <div className="flex items-center gap-3">
                      {doc.documentDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {doc.documentDate}
                        </span>
                      )}
                      {doc.expiryDate && (
                        <span className={isExpired ? 'text-rose-400' : isExpiringSoon ? 'text-amber-400' : ''}>
                          Exp: {doc.expiryDate}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownload(doc)}
                        aria-label={`Download ${doc.title}`}
                        className="h-8 px-2.5 text-xs"
                      >
                        <Download className="w-3.5 h-3.5 mr-1" />
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isSupportModeActive}
                        onClick={() => setDocPendingDelete(doc)}
                        aria-label={`Delete ${doc.title}`}
                        className="h-8 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
