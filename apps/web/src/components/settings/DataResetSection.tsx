import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  HouseholdDataResetPreview,
  HouseholdDataResetResult,
  ResettableFinancialCategory,
} from '@wealthnest/application';
import { HouseholdAuditLogEntry } from '@wealthnest/domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ResponsiveModalShell } from '@/components/ui/ResponsiveModalShell';
import { useAuth } from '@/lib/supabase/auth-context';
import { useHousehold } from '@/lib/supabase/household-context';
import { useRepositories } from '@/lib/persistence/repository-context';
import { useSupportSession } from '@/lib/admin/support-session-context';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase/client';
import {
  AlertTriangle,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  History,
  Landmark,
  Loader2,
  Lock,
  Repeat,
  RotateCcw,
  ShieldAlert,
  Target,
  Trash2,
  X,
} from 'lucide-react';

export interface ResetCategoryMetadata {
  readonly id: ResettableFinancialCategory;
  readonly label: string;
  readonly description: string;
  readonly dependencyNote: string;
  readonly icon: React.ReactNode;
}

export const RESET_CATEGORIES: readonly ResetCategoryMetadata[] = [
  {
    id: 'investment_portfolio',
    label: 'Investment Portfolio',
    description: 'Equity, mutual funds, gold and other holdings',
    dependencyNote:
      'Removes holdings, ownership splits, and valuation snapshots. Any goal-holding links will be unlinked automatically.',
    icon: <Briefcase className="w-4 h-4 text-blue-400" />,
  },
  {
    id: 'real_estate',
    label: 'Real Estate',
    description: 'Properties, ownership and property valuations',
    dependencyNote:
      'Removes property records and rental yield overrides. Any linked Home Loans will be unlinked safely without deleting the loans.',
    icon: <Building2 className="w-4 h-4 text-emerald-400" />,
  },
  {
    id: 'loans_liabilities',
    label: 'Loans & Liabilities',
    description: 'Loans, outstanding balances and EMI records',
    dependencyNote:
      'Removes loans, borrower share splits, repayment balance history, EMI records, and property mortgage links.',
    icon: <Landmark className="w-4 h-4 text-amber-400" />,
  },
  {
    id: 'transactions',
    label: 'Transactions',
    description: 'Income, expenses and transfers',
    dependencyNote:
      'Removes historical inflows, outflows, buy/sell trade executions, and inter-account transfers.',
    icon: <Repeat className="w-4 h-4 text-cyan-400" />,
  },
  {
    id: 'financial_goals',
    label: 'Financial Goals',
    description: 'Savings, education and retirement goals',
    dependencyNote:
      'Removes financial milestones, target projections, and linked holding allocation mappings.',
    icon: <Target className="w-4 h-4 text-purple-400" />,
  },
  {
    id: 'documents_vault',
    label: 'Documents Vault',
    description: 'Uploaded statements and financial documents',
    dependencyNote:
      'Permanently deletes vault document metadata and removes encrypted files from household storage.',
    icon: <FileText className="w-4 h-4 text-indigo-400" />,
  },
  {
    id: 'cas_import_history',
    label: 'CAS & Import History',
    description: 'Import batches, reconciliation and import logs',
    dependencyNote:
      'Clears CAS and broker CSV import batch logs while keeping already-imported holdings unless Investment Portfolio is also selected.',
    icon: <FileSpreadsheet className="w-4 h-4 text-teal-400" />,
  },
];

const CONFIRMATION_PHRASE = 'RESET MY DATA';
const DELETE_HOUSEHOLD_PHRASE = 'DELETE HOUSEHOLD';

interface DataResetSectionProps {
  readonly onFullBackupExport: () => void;
  readonly isExporting: boolean;
  readonly lastBackupTime: string | null;
}

export function DataResetSection({
  onFullBackupExport,
  isExporting,
  lastBackupTime,
}: DataResetSectionProps) {
  const { user } = useAuth();
  const {
    households,
    activeHousehold,
    activeHouseholdId,
    householdRole,
    refreshHouseholds,
  } = useHousehold();
  const { isSupportModeActive } = useSupportSession();
  const { backupRepo, householdRepo, mode } = useRepositories();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const isPrimaryOwner = householdRole === 'primary_owner' && !isSupportModeActive;
  const householdDisplayName = activeHousehold?.name || 'Active Household';
  const hasMultipleHouseholds = households.length > 1;
  const requiresPasswordReauth =
    mode === 'supabase' && Boolean(user?.email && !user.id.startsWith('demo-'));

  const [selectedCategories, setSelectedCategories] = useState<Set<ResettableFinancialCategory>>(
    () => new Set()
  );
  const [previewCounts, setPreviewCounts] = useState<HouseholdDataResetPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Reset confirmation modal state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isFullResetMode, setIsFullResetMode] = useState(false);
  const [ackPermanent, setAckPermanent] = useState(false);
  const [ackBackup, setAckBackup] = useState(false);
  const [confirmPhraseInput, setConfirmPhraseInput] = useState('');
  const [reauthPassword, setReauthPassword] = useState('');
  const [isExecutingReset, setIsExecutingReset] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [lastResetResult, setLastResetResult] = useState<HouseholdDataResetResult | null>(null);

  // Delete household modal state (Stage 2 - P1)
  const [isDeleteHouseholdModalOpen, setIsDeleteHouseholdModalOpen] = useState(false);
  const [ackDeleteHouseholdPermanent, setAckDeleteHouseholdPermanent] = useState(false);
  const [ackDeleteHouseholdMembers, setAckDeleteHouseholdMembers] = useState(false);
  const [deleteHouseholdPhraseInput, setDeleteHouseholdPhraseInput] = useState('');
  const [deleteHouseholdPassword, setDeleteHouseholdPassword] = useState('');
  const [isDeletingHousehold, setIsDeletingHousehold] = useState(false);
  const [deleteHouseholdError, setDeleteHouseholdError] = useState<string | null>(null);

  // Reset audit history (Stage 2 - P1)
  const [resetHistoryLogs, setResetHistoryLogs] = useState<readonly HouseholdAuditLogEntry[]>([]);

  const loadPreviewAndHistory = useCallback(async () => {
    setIsLoadingPreview(true);
    try {
      const [previewRes, logsRes] = await Promise.all([
        backupRepo.getDataResetPreview
          ? backupRepo.getDataResetPreview({
              householdId: activeHouseholdId,
              userId: user?.id,
            })
          : Promise.resolve(null),
        activeHouseholdId
          ? householdRepo.listAuditLogs(activeHouseholdId, 25)
          : Promise.resolve(null),
      ]);

      if (previewRes && previewRes.success) {
        setPreviewCounts(previewRes.value);
      }
      if (logsRes && logsRes.success) {
        const filtered = logsRes.value.filter(
          (entry) =>
            entry.action === 'household_financial_data_reset' ||
            entry.action === 'household_deleted'
        );
        setResetHistoryLogs(filtered);
      }
    } finally {
      setIsLoadingPreview(false);
    }
  }, [backupRepo, householdRepo, activeHouseholdId, user?.id]);

  useEffect(() => {
    void loadPreviewAndHistory();
  }, [loadPreviewAndHistory]);

  const toggleCategory = (catId: ResettableFinancialCategory) => {
    if (!isPrimaryOwner) return;
    setLastResetResult(null);
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  const allSelected = selectedCategories.size === RESET_CATEGORIES.length;

  const handleSelectAllToggle = () => {
    if (!isPrimaryOwner) return;
    setLastResetResult(null);
    if (allSelected) {
      setSelectedCategories(new Set());
    } else {
      setSelectedCategories(new Set(RESET_CATEGORIES.map((c) => c.id)));
    }
  };

  const selectedCategoryItems = useMemo(
    () => RESET_CATEGORIES.filter((c) => selectedCategories.has(c.id)),
    [selectedCategories]
  );

  const dependencyWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (
      selectedCategories.has('real_estate') &&
      !selectedCategories.has('loans_liabilities')
    ) {
      warnings.push(
        'Real Estate is selected without Loans & Liabilities: any linked Home Loans will be unlinked from their property records and remain active.'
      );
    }
    if (
      selectedCategories.has('loans_liabilities') &&
      !selectedCategories.has('real_estate')
    ) {
      warnings.push(
        'Loans & Liabilities is selected without Real Estate: property holdings will remain intact and become 100% debt-free (0% LTV).'
      );
    }
    if (
      selectedCategories.has('investment_portfolio') &&
      !selectedCategories.has('financial_goals')
    ) {
      warnings.push(
        'Investment Portfolio is selected without Financial Goals: goal milestones will remain intact, and any linked holding allocations will be unlinked.'
      );
    }
    if (
      selectedCategories.has('investment_portfolio') &&
      !selectedCategories.has('transactions')
    ) {
      warnings.push(
        'Investment Portfolio is selected without Transactions: current holdings will be removed while historical transaction logs are preserved.'
      );
    }
    return warnings;
  }, [selectedCategories]);

  const handleOpenReviewModal = (fullResetPreset = false) => {
    if (!isPrimaryOwner) return;
    if (fullResetPreset) {
      setSelectedCategories(new Set(RESET_CATEGORIES.map((c) => c.id)));
      setIsFullResetMode(true);
    } else {
      if (selectedCategories.size === 0) return;
      setIsFullResetMode(false);
    }
    setAckPermanent(false);
    setAckBackup(false);
    setConfirmPhraseInput('');
    setReauthPassword('');
    setResetError(null);
    setIsConfirmModalOpen(true);
  };

  const handleOpenDeleteHouseholdModal = () => {
    if (!isPrimaryOwner) return;
    setAckDeleteHouseholdPermanent(false);
    setAckDeleteHouseholdMembers(false);
    setDeleteHouseholdPhraseInput('');
    setDeleteHouseholdPassword('');
    setDeleteHouseholdError(null);
    setIsDeleteHouseholdModalOpen(true);
  };

  const verifyFreshAuthenticationIfRequired = async (passwordToVerify: string): Promise<boolean> => {
    if (!requiresPasswordReauth || !user?.email) return true;
    if (!passwordToVerify.trim()) {
      throw new Error('Please enter your account password to verify fresh authentication.');
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: passwordToVerify,
    });
    if (error) {
      throw new Error(`Authentication verification failed: ${error.message}`);
    }
    return true;
  };

  const canConfirmReset =
    isPrimaryOwner &&
    selectedCategories.size > 0 &&
    ackPermanent &&
    ackBackup &&
    confirmPhraseInput.trim() === CONFIRMATION_PHRASE &&
    (!requiresPasswordReauth || !isFullResetMode || reauthPassword.trim().length > 0) &&
    !isExecutingReset;

  const handleExecuteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfirmReset || !backupRepo.resetHouseholdFinancialData) return;

    setIsExecutingReset(true);
    setResetError(null);

    try {
      if (isFullResetMode && requiresPasswordReauth) {
        await verifyFreshAuthenticationIfRequired(reauthPassword);
      }

      const categoriesArray = Array.from(selectedCategories);
      const res = await backupRepo.resetHouseholdFinancialData({
        householdId: activeHouseholdId,
        userId: user?.id,
        categories: categoriesArray,
      });

      if (!res.success) {
        setResetError(res.error.message);
        return;
      }

      if (selectedCategories.has('real_estate') && typeof window !== 'undefined') {
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k && k.startsWith('wealthnest_real_estate_overrides_v1_')) {
              keysToRemove.push(k);
            }
          }
          for (const k of keysToRemove) {
            window.localStorage.removeItem(k);
          }
        } catch {
          // ignore localStorage errors
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['net-worth-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-holdings'] }),
        queryClient.invalidateQueries({ queryKey: ['holdings'] }),
        queryClient.invalidateQueries({ queryKey: ['user-holdings'] }),
        queryClient.invalidateQueries({ queryKey: ['user-liabilities'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions-cashflow'] }),
        queryClient.invalidateQueries({ queryKey: ['cashflow-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['user-goals'] }),
        queryClient.invalidateQueries({ queryKey: ['goals-holdings'] }),
        queryClient.invalidateQueries({ queryKey: ['family-documents'] }),
      ]);

      setLastResetResult(res.value);
      setSelectedCategories(new Set());
      setIsConfirmModalOpen(false);
      showToast('Selected financial data categories have been reset', 'success');
      await loadPreviewAndHistory();
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Failed to execute data reset');
    } finally {
      setIsExecutingReset(false);
    }
  };

  const canConfirmDeleteHousehold =
    isPrimaryOwner &&
    hasMultipleHouseholds &&
    Boolean(activeHouseholdId) &&
    ackDeleteHouseholdPermanent &&
    ackDeleteHouseholdMembers &&
    deleteHouseholdPhraseInput.trim() === DELETE_HOUSEHOLD_PHRASE &&
    (!requiresPasswordReauth || deleteHouseholdPassword.trim().length > 0) &&
    !isDeletingHousehold;

  const handleExecuteDeleteHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfirmDeleteHousehold || !activeHouseholdId || !backupRepo.deleteHousehold) return;

    setIsDeletingHousehold(true);
    setDeleteHouseholdError(null);

    try {
      if (requiresPasswordReauth) {
        await verifyFreshAuthenticationIfRequired(deleteHouseholdPassword);
      }

      const res = await backupRepo.deleteHousehold({
        householdId: activeHouseholdId,
        userId: user?.id,
      });

      if (!res.success) {
        setDeleteHouseholdError(res.error.message);
        return;
      }

      setIsDeleteHouseholdModalOpen(false);
      showToast(`Deleted household "${householdDisplayName}"`, 'success');
      await refreshHouseholds();
    } catch (err) {
      setDeleteHouseholdError(
        err instanceof Error ? err.message : 'Failed to delete household'
      );
    } finally {
      setIsDeletingHousehold(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stage 1 & 2:Selective + Full Financial Data Reset Card */}
      <Card className="bg-slate-900 border-rose-500/30">
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  Reset Selected Financial Data
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] border-rose-500/30 text-rose-300 bg-rose-500/10"
                >
                  Household Owner Only
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-400">
                Select specific financial categories to permanently clear from{' '}
                <strong className="text-slate-200">{householdDisplayName}</strong>. Login accounts,
                household membership, family member profiles, PAN entities, and preferences are
                always preserved.
              </CardDescription>
            </div>

            {isPrimaryOwner && (
              <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAllToggle}
                  className="h-8 text-xs border-slate-700 hover:bg-slate-800 text-slate-200"
                >
                  {allSelected ? 'Deselect All' : 'Select All Categories'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenReviewModal(true)}
                  className="h-8 text-xs border-rose-500/40 text-rose-300 hover:bg-rose-500/15 gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Full Household Reset</span>
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 space-y-4">
          {!isPrimaryOwner && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-300">
                  Restricted to Household Primary Owner:
                </span>{' '}
                {isSupportModeActive
                  ? 'Data reset is disabled during Support Impersonation sessions.'
                  : `Your current role (${householdRole || 'member'}) cannot reset household financial data.`}
              </div>
            </div>
          )}

          {lastResetResult && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Selective Financial Reset Completed</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Cleared records for <strong className="text-white">{householdDisplayName}</strong>
                {lastResetResult.auditLogId
                  ? ` (Audit ID: ${lastResetResult.auditLogId.slice(0, 8)}...)`
                  : ''}
                .
              </p>
            </div>
          )}

          {/* Category Checkboxes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {RESET_CATEGORIES.map((cat) => {
              const isChecked = selectedCategories.has(cat.id);
              const count = previewCounts ? previewCounts[cat.id] : undefined;

              return (
                <label
                  key={cat.id}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                    !isPrimaryOwner
                      ? 'opacity-60 cursor-not-allowed bg-slate-950/50 border-slate-800'
                      : isChecked
                        ? 'cursor-pointer bg-rose-500/10 border-rose-500/40 ring-1 ring-rose-500/20'
                        : 'cursor-pointer bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={!isPrimaryOwner}
                    onChange={() => toggleCategory(cat.id)}
                    aria-label={cat.label}
                    className="mt-1 w-4 h-4 rounded border-slate-700 accent-rose-500 cursor-pointer shrink-0"
                  />

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm font-semibold text-white flex items-center gap-2">
                        {cat.icon}
                        <span>{cat.label}</span>
                      </span>
                      {count !== undefined && (
                        <span
                          className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                            isChecked
                              ? 'bg-rose-500/20 text-rose-200 border-rose-500/30'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}
                        >
                          {isLoadingPreview ? '...' : `${count} ${count === 1 ? 'record' : 'records'}`}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400">{cat.description}</p>

                    {isChecked && (
                      <p className="text-[11px] text-rose-300/90 pt-1 leading-relaxed">
                        {cat.dependencyNote}
                      </p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          {/* Cross-Category Dependency Callouts */}
          {dependencyWarnings.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1.5 text-xs">
              <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Dependent Record Handling</span>
              </div>
              <ul className="space-y-1 text-[11px] text-amber-100/90 pl-5 list-disc">
                {dependencyWarnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer Bar: Count & Review Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
            <div className="text-xs text-slate-400">
              <strong className="text-white font-mono">{selectedCategories.size}</strong>{' '}
              {selectedCategories.size === 1 ? 'category' : 'categories'} selected for{' '}
              <span className="text-slate-200 font-medium">{householdDisplayName}</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onFullBackupExport}
                disabled={isExporting}
                className="h-8 text-xs border-slate-700 hover:bg-slate-800 text-slate-200 gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Download Backup First</span>
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={!isPrimaryOwner || selectedCategories.size === 0}
                onClick={() => handleOpenReviewModal(false)}
                className="h-8 text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Review Selection ({selectedCategories.size})</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stage 2 (P1): Delete Household & Reset Operation History Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Reset History & Operation Audit Trail */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm sm:text-base text-white flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" />
              Reset History & Operation Status
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Immutable audit log of financial data resets executed in {householdDisplayName}.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            {resetHistoryLogs.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-400 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                <span>No data reset operations have been recorded for this household yet.</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {resetHistoryLogs.map((entry) => {
                  const cats = Array.isArray(entry.metadata?.categories)
                    ? (entry.metadata.categories as string[])
                    : [];
                  return (
                    <div
                      key={entry.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-white flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>
                            {entry.action === 'household_deleted'
                              ? 'Household Deleted'
                              : cats.length >= RESET_CATEGORIES.length
                                ? 'Full Household Financial Reset'
                                : 'Selective Financial Reset'}
                          </span>
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {new Date(entry.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {cats.length > 0 && (
                        <p className="text-[11px] text-slate-400">
                          Categories:{' '}
                          <span className="text-slate-300">
                            {cats.map((c) => c.replace(/_/g, ' ')).join(', ')}
                          </span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Household Card (Three Levels of Reset — Level 3) */}
        <Card className="bg-slate-900 border-rose-500/30">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm sm:text-base text-white flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-400" />
                Delete Household Workspace
              </CardTitle>
              <Badge
                variant="outline"
                className="text-[10px] border-rose-500/30 text-rose-300 bg-rose-500/10"
              >
                Level 3 · Permanent
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-400">
              Permanently removes <strong className="text-slate-200">{householdDisplayName}</strong>
              , all its financial data, family member profiles, Demat accounts, and membership
              relationships. Your login account remains active.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-3">
            {!hasMultipleHouseholds ? (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                <strong className="text-slate-200">Safeguard Active:</strong> You cannot delete your
                only active household workspace. To clear all financial data while keeping this
                household, use <strong className="text-rose-300">Full Household Reset</strong>{' '}
                above.
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-200">
                Deleting this household will switch your session to another active household you
                belong to.
              </div>
            )}

            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!isPrimaryOwner || !hasMultipleHouseholds}
                onClick={handleOpenDeleteHouseholdModal}
                className="h-8 text-xs border-rose-500/40 text-rose-300 hover:bg-rose-500/15 disabled:opacity-50 gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Household...</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* High-Safety Confirmation Modal for Selective / Full Financial Reset */}
      {isConfirmModalOpen && (
        <ResponsiveModalShell
          role="dialog"
          ariaLabelledBy="confirm-data-reset-modal-title"
          backdropClassName="bg-black/75"
          panelClassName="max-w-lg bg-slate-900 border-rose-500/40"
          onDismiss={() => {
            if (!isExecutingReset) setIsConfirmModalOpen(false);
          }}
          formProps={{ onSubmit: handleExecuteReset }}
          header={
            <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3
                    id="confirm-data-reset-modal-title"
                    className="text-base font-bold text-white"
                  >
                    {isFullResetMode ? 'Confirm Full Household Financial Reset' : 'Confirm Data Reset'}
                  </h3>
                  <p className="text-xs text-rose-300">Permanent action · Cannot be undone</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isExecutingReset}
                aria-label="Close confirmation modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          }
          bodyClassName="space-y-4 p-4 sm:p-6"
          footer={
            <div className="flex items-center justify-end gap-2.5 px-4 py-3 sm:px-6 border-t border-slate-800 bg-slate-900">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isExecutingReset}
                className="border-slate-700 text-slate-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!canConfirmReset}
                className="bg-rose-600 hover:bg-rose-500 text-white font-semibold gap-1.5 disabled:opacity-50"
              >
                {isExecutingReset && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Permanent Reset</span>
              </Button>
            </div>
          }
        >
          {resetError && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{resetError}</span>
            </div>
          )}

          {/* Target Household Banner */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <p className="text-xs text-slate-400">
              You are about to permanently delete selected financial records from:
            </p>
            <div className="text-sm font-bold text-white flex items-center justify-between gap-2">
              <span>{householdDisplayName}</span>
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-300">
                Isolated to this household
              </Badge>
            </div>
          </div>

          {/* Selected Categories Summary */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Selected Categories ({selectedCategoryItems.length})
            </div>
            <div className="rounded-xl bg-slate-950 border border-slate-800 divide-y divide-slate-800/80 max-h-44 overflow-y-auto">
              {selectedCategoryItems.map((cat) => {
                const count = previewCounts ? previewCounts[cat.id] : undefined;
                return (
                  <div key={cat.id} className="p-2.5 px-3 flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-white flex items-center gap-2">
                      {cat.icon}
                      <span>{cat.label}</span>
                    </span>
                    {count !== undefined && (
                      <span className="font-mono text-[11px] text-rose-300">
                        {count} {count === 1 ? 'record' : 'records'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Backup Helper inside Modal */}
          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-between gap-3">
            <div className="text-xs">
              <div className="font-semibold text-indigo-200">Recommended: Save a JSON Backup</div>
              <div className="text-[11px] text-slate-400">
                {lastBackupTime
                  ? `Last backup downloaded at ${lastBackupTime}`
                  : 'No backup downloaded in this session yet'}
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onFullBackupExport}
              disabled={isExporting}
              className="h-8 text-xs border-indigo-500/40 text-indigo-200 hover:bg-indigo-500/20 shrink-0 gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Exporting...' : 'Backup JSON'}</span>
            </Button>
          </div>

          {/* Mandatory Acknowledgements */}
          <div className="space-y-2.5 pt-1">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Before Continuing
            </div>

            <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer text-xs text-slate-200">
              <input
                type="checkbox"
                checked={ackPermanent}
                onChange={(e) => setAckPermanent(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-700 accent-rose-500 cursor-pointer shrink-0"
              />
              <span>I understand that selected records will be permanently deleted.</span>
            </label>

            <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer text-xs text-slate-200">
              <input
                type="checkbox"
                checked={ackBackup}
                onChange={(e) => setAckBackup(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-700 accent-rose-500 cursor-pointer shrink-0"
              />
              <span>
                I have downloaded a backup or understand that this operation may not be recoverable.
              </span>
            </label>
          </div>

          {/* Fresh Authentication Password Input (for Full Household Reset in live Supabase sessions) */}
          {isFullResetMode && requiresPasswordReauth && (
            <div className="space-y-1.5">
              <label
                htmlFor="confirm-reset-password-input"
                className="text-xs font-medium text-slate-300 flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Verify Account Password (Fresh Authentication)</span>
              </label>
              <input
                id="confirm-reset-password-input"
                type="password"
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full h-9 rounded-lg bg-slate-950 border border-slate-700 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          )}

          {/* Type RESET MY DATA to Confirm */}
          <div className="space-y-1.5">
            <label
              htmlFor="confirm-reset-phrase-input"
              className="text-xs font-medium text-slate-300 block"
            >
              Type <code className="font-mono font-bold text-rose-400">{CONFIRMATION_PHRASE}</code>{' '}
              to confirm
            </label>
            <input
              id="confirm-reset-phrase-input"
              type="text"
              value={confirmPhraseInput}
              onChange={(e) => setConfirmPhraseInput(e.target.value)}
              placeholder={CONFIRMATION_PHRASE}
              autoComplete="off"
              className="w-full h-9 rounded-lg bg-slate-950 border border-slate-700 px-3 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>
        </ResponsiveModalShell>
      )}

      {/* Stage 2 (P1): Delete Household Confirmation Modal */}
      {isDeleteHouseholdModalOpen && (
        <ResponsiveModalShell
          role="dialog"
          ariaLabelledBy="confirm-delete-household-modal-title"
          backdropClassName="bg-black/75"
          panelClassName="max-w-lg bg-slate-900 border-rose-500/40"
          onDismiss={() => {
            if (!isDeletingHousehold) setIsDeleteHouseholdModalOpen(false);
          }}
          formProps={{ onSubmit: handleExecuteDeleteHousehold }}
          header={
            <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3
                    id="confirm-delete-household-modal-title"
                    className="text-base font-bold text-white"
                  >
                    Delete Household Permanently
                  </h3>
                  <p className="text-xs text-rose-300">
                    Removes household workspace, financial data, and memberships
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteHouseholdModalOpen(false)}
                disabled={isDeletingHousehold}
                aria-label="Close delete household modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          }
          bodyClassName="space-y-4 p-4 sm:p-6"
          footer={
            <div className="flex items-center justify-end gap-2.5 px-4 py-3 sm:px-6 border-t border-slate-800 bg-slate-900">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteHouseholdModalOpen(false)}
                disabled={isDeletingHousehold}
                className="border-slate-700 text-slate-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!canConfirmDeleteHousehold}
                className="bg-rose-600 hover:bg-rose-500 text-white font-semibold gap-1.5 disabled:opacity-50"
              >
                {isDeletingHousehold && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Permanently Delete Household</span>
              </Button>
            </div>
          }
        >
          {deleteHouseholdError && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{deleteHouseholdError}</span>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
            <p className="text-slate-400">Target Household to Delete:</p>
            <p className="text-sm font-bold text-white">{householdDisplayName}</p>
            <p className="text-[11px] text-slate-400">
              Your login account and any other households you belong to will not be affected.
            </p>
          </div>

          <div className="space-y-2.5">
            <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer text-xs text-slate-200">
              <input
                type="checkbox"
                checked={ackDeleteHouseholdPermanent}
                onChange={(e) => setAckDeleteHouseholdPermanent(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-700 accent-rose-500 cursor-pointer shrink-0"
              />
              <span>
                I understand that this household and all its financial data will be permanently
                deleted.
              </span>
            </label>

            <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer text-xs text-slate-200">
              <input
                type="checkbox"
                checked={ackDeleteHouseholdMembers}
                onChange={(e) => setAckDeleteHouseholdMembers(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-700 accent-rose-500 cursor-pointer shrink-0"
              />
              <span>
                I confirm removing all family member profiles, PAN entities, and member access
                associations inside this household.
              </span>
            </label>
          </div>

          {requiresPasswordReauth && (
            <div className="space-y-1.5">
              <label
                htmlFor="delete-household-password-input"
                className="text-xs font-medium text-slate-300 flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Verify Account Password (Fresh Authentication)</span>
              </label>
              <input
                id="delete-household-password-input"
                type="password"
                value={deleteHouseholdPassword}
                onChange={(e) => setDeleteHouseholdPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full h-9 rounded-lg bg-slate-950 border border-slate-700 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="delete-household-phrase-input"
              className="text-xs font-medium text-slate-300 block"
            >
              Type{' '}
              <code className="font-mono font-bold text-rose-400">{DELETE_HOUSEHOLD_PHRASE}</code>{' '}
              to confirm
            </label>
            <input
              id="delete-household-phrase-input"
              type="text"
              value={deleteHouseholdPhraseInput}
              onChange={(e) => setDeleteHouseholdPhraseInput(e.target.value)}
              placeholder={DELETE_HOUSEHOLD_PHRASE}
              autoComplete="off"
              className="w-full h-9 rounded-lg bg-slate-950 border border-slate-700 px-3 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>
        </ResponsiveModalShell>
      )}
    </div>
  );
}
