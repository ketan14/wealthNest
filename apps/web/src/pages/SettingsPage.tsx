import { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ExportPortfolioDataUseCase,
  ValidateAndParseBackupUseCase,
  RestorePortfolioFromBackupUseCase,
  ParsedBackupPreview,
  GetSystemStatusUseCase,
  SystemStatusDto,
} from '@wealthnest/application';
import { usePreferences } from '@/lib/preferences/preferences-context';
import { useAuth } from '@/lib/supabase/auth-context';
import { useHousehold } from '@/lib/supabase/household-context';
import { useRepositories } from '@/lib/persistence/repository-context';
import { userAdapter } from '@/lib/supabase/user.adapter';
import { Button } from '@/components/ui/Button';
import {
  User,
  Globe,
  Download,
  Database,
  Shield,
  Server,
  HardDrive,
  Users,
  ChevronRight,
} from 'lucide-react';
import { useFamily } from '@/lib/family/family-context';
import { ManageFamilyModal } from '@/components/family/ManageFamilyModal';
import { ServerConnectionSettings } from '@/components/settings/ServerConnectionSettings';
import { ProfileSecurityTab } from '@/components/settings/ProfileSecurityTab';
import { FamilyDematsTab } from '@/components/settings/FamilyDematsTab';
import { LocalizationTaxTab } from '@/components/settings/LocalizationTaxTab';
import { DataPortabilityTab } from '@/components/settings/DataPortabilityTab';
import { SystemDiagnosticsTab } from '@/components/settings/SystemDiagnosticsTab';
import { saveTextFile, openTextFile } from '@/lib/tauri/tauri-file-dialog';
import { isTauri } from '@/lib/tauri/tauri-runtime';
import { useToast } from '@/components/ui/Toast';

type SettingsTab = 'profile' | 'family' | 'connection' | 'localization' | 'data' | 'system';

export function SettingsPage() {
  const { showToast } = useToast();
  const {
    preferences,
    displayName,
    legalName,
    email,
    updatePreferences,
    updateDisplayName,
    updateLegalName,
    formatAmount,
    resetPreferences,
  } = usePreferences();

  const { user, signOut } = useAuth();
  const { activeHousehold, activeHouseholdId, canEditFinancials } = useHousehold();
  const { members, accounts } = useFamily();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const resolvedTab: SettingsTab =
    tabParam === 'family' ||
    tabParam === 'connection' ||
    tabParam === 'localization' ||
    tabParam === 'data' ||
    tabParam === 'system' ||
    tabParam === 'profile'
      ? tabParam
      : 'profile';
  const [activeTab, setActiveTab] = useState<SettingsTab>(resolvedTab);
  const [isManageFamilyOpen, setIsManageFamilyOpen] = useState(false);

  useEffect(() => {
    if (
      tabParam === 'family' ||
      tabParam === 'connection' ||
      tabParam === 'localization' ||
      tabParam === 'data' ||
      tabParam === 'system' ||
      tabParam === 'profile'
    ) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Export states
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem('wealthnest_last_backup_at');
    } catch {
      return null;
    }
  });
  const backupScopeLabel = user?.id ? 'Household Vault JSON' : 'Local Demo JSON';

  // Restore states
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [backupPreview, setBackupPreview] = useState<ParsedBackupPreview | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  // System status
  const systemStatus: SystemStatusDto = useMemo(() => {
    const res = new GetSystemStatusUseCase().execute();
    return res.success
      ? res.value
      : {
          appName: 'WealthNest',
          architecture: 'Clean Monorepo',
          phase: 'Phase 1',
          layers: [],
        };
  }, []);

  const { holdingRepo, transactionRepo, liabilityRepo, goalRepo, backupRepo } = useRepositories();

  // Adapters for export & restore
  const exportUseCase = useMemo(() => {
    return new ExportPortfolioDataUseCase(
      userAdapter,
      holdingRepo,
      transactionRepo,
      liabilityRepo,
      goalRepo
    );
  }, [holdingRepo, transactionRepo, liabilityRepo, goalRepo]);

  const validateBackupUseCase = useMemo(() => {
    return new ValidateAndParseBackupUseCase();
  }, []);

  const restoreUseCase = useMemo(() => {
    return new RestorePortfolioFromBackupUseCase(backupRepo);
  }, [backupRepo]);

  const handleDownloadFile = async (
    content: string,
    filename: string,
    _type: string
  ): Promise<boolean> => {
    const ext = filename.endsWith('.csv') ? 'csv' : 'json';
    const saveRes = await saveTextFile({
      defaultPath: filename,
      content,
      filters: [
        {
          name: ext === 'csv' ? 'CSV Spreadsheet' : 'WealthNest Backup JSON',
          extensions: [ext],
        },
      ],
    });
    return saveRes.success;
  };

  const handleFullBackupExport = async () => {
    setIsExporting(true);
    setExportSuccessMessage(null);
    try {
      const res = await exportUseCase.execute(user?.id || 'demo-user-001', {
        householdId: activeHouseholdId,
        householdName: activeHousehold?.name,
      });
      if (res.success) {
        const saved = await handleDownloadFile(
          res.value.backupJsonString,
          res.value.summaryFilename,
          'application/json'
        );
        if (saved) {
          const timestamp = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
          setLastBackupTime(timestamp);
          try {
            window.localStorage.setItem('wealthnest_last_backup_at', timestamp);
          } catch {
            // ignore storage errors
          }
          setExportSuccessMessage('Full JSON portfolio backup downloaded successfully!');
          showToast('Portfolio backup (.json) downloaded', 'success');
          setTimeout(() => setExportSuccessMessage(null), 4000);
        }
      } else {
        showToast(res.error.message, 'error');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCsv = async (
    moduleType: 'holdings' | 'transactions' | 'liabilities' | 'goals'
  ) => {
    setIsExporting(true);
    try {
      const res = await exportUseCase.execute(user?.id || 'demo-user-001', {
        householdId: activeHouseholdId,
        householdName: activeHousehold?.name,
      });
      if (res.success) {
        const dateStr = new Date().toISOString().split('T')[0];
        let content = '';
        let filename = '';

        switch (moduleType) {
          case 'holdings':
            content = res.value.holdingsCsv;
            filename = `wealthnest_holdings_${dateStr}.csv`;
            break;
          case 'transactions':
            content = res.value.transactionsCsv;
            filename = `wealthnest_transactions_${dateStr}.csv`;
            break;
          case 'liabilities':
            content = res.value.liabilitiesCsv;
            filename = `wealthnest_liabilities_${dateStr}.csv`;
            break;
          case 'goals':
            content = res.value.goalsCsv;
            filename = `wealthnest_goals_${dateStr}.csv`;
            break;
        }

        const saved = await handleDownloadFile(content, filename, 'text/csv');
        if (saved) {
          setExportSuccessMessage(`Downloaded ${filename} successfully!`);
          setTimeout(() => setExportSuccessMessage(null), 4000);
        }
      }
    } finally {
      setIsExporting(false);
    }
  };

  const parseAndPreviewBackupContent = (content: string) => {
    setRestoreError(null);
    setRestoreSuccess(false);
    const res = validateBackupUseCase.execute(content);
    if (res.success) {
      setBackupPreview(res.value);
      if (!res.value.isValid) {
        setRestoreError(res.value.errors.join(', '));
      }
    } else {
      setRestoreError(res.error.message);
    }
  };

  const handleNativeBackupOpen = async (e: React.MouseEvent) => {
    if (!isTauri()) return;
    e.preventDefault();
    const res = await openTextFile({
      filters: [{ name: 'WealthNest Backup JSON', extensions: ['json'] }],
    });
    if (res.success && res.content) {
      parseAndPreviewBackupContent(res.content);
    } else if (res.error && !res.error.toLowerCase().includes('cancel')) {
      setRestoreError(res.error);
    }
  };

  const handleBackupFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      parseAndPreviewBackupContent(content);
    };
    reader.onerror = () => setRestoreError('Failed to read file');
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!backupPreview || !backupPreview.isValid || !backupPreview.data) return;
    if (!canEditFinancials) {
      setRestoreError('Viewers have read-only access and cannot restore backups into this household.');
      return;
    }
    const targetUserId = user?.id || 'usr-local-default';

    setIsRestoring(true);
    setRestoreError(null);

    const res = await restoreUseCase.execute({
      targetUserId,
      householdId: activeHouseholdId,
      backupData: backupPreview.data,
    });

    setIsRestoring(false);

    if (res.success) {
      setRestoreSuccess(true);
      setTimeout(() => {
        setBackupPreview(null);
        setRestoreSuccess(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }, 4000);
    } else {
      setRestoreError(res.error.message);
    }
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Compact Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              System & Preferences
            </span>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-400" />
              Client-Side Privacy Enforced
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Settings & Control Center
          </h1>
          <p className="hidden sm:block text-xs text-slate-400 mt-0.5">
            Account identity, family entities, regional formatting, and encrypted backups.
          </p>
        </div>

        <div className="flex flex-col sm:items-end gap-1 self-start sm:self-auto shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-slate-700 hover:bg-slate-800 text-slate-200 text-xs gap-1.5"
            onClick={handleFullBackupExport}
            disabled={isExporting}
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isExporting ? 'Exporting...' : 'Quick Backup (.json)'}</span>
          </Button>
          <span className="text-[10px] text-slate-400">
            {backupScopeLabel}
            {lastBackupTime ? (
              <span className="text-emerald-400"> · Last saved {lastBackupTime}</span>
            ) : (
              ' · Unencrypted portable export'
            )}
          </span>
        </div>
      </div>

      {/* Mobile-Friendly Horizontal Scroll Tab Bar */}
      <div className="relative -mx-4 px-4 sm:mx-0 sm:px-0">
        <div
          role="tablist"
          aria-label="Settings sections"
          className="flex items-center border-b border-slate-800 gap-1 sm:gap-2 overflow-x-auto no-scrollbar pr-6 sm:pr-0"
        >
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'profile'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Profile & Security</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('family')}
            className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'family'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Family & Demats</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('connection')}
            data-testid="tab-connection"
            className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'connection'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
            <span>Server Connection</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('localization')}
            className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'localization'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Localization & Tax Standards</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('data')}
            className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'data'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Data Portability & Backup</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'system'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Server className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>System Diagnostics</span>
          </button>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none sm:hidden absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-background via-background/85 to-transparent flex items-center justify-end pr-1"
        >
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>

      {/* TAB 1: Profile & Security */}
      {activeTab === 'profile' && (
        <ProfileSecurityTab
          displayName={displayName}
          legalName={legalName}
          email={email}
          userEmail={user?.email}
          onUpdateDisplayName={updateDisplayName}
          onUpdateLegalName={updateLegalName}
          onSignOut={() => signOut()}
        />
      )}

      {/* TAB: Family & Demats */}
      {activeTab === 'family' && (
        <FamilyDematsTab
          members={members}
          accounts={accounts}
          onOpenManageFamily={() => setIsManageFamilyOpen(true)}
        />
      )}

      {/* TAB: Server Connection */}
      {activeTab === 'connection' && <ServerConnectionSettings />}

      {/* TAB 2: Localization & Tax Standards */}
      {activeTab === 'localization' && (
        <LocalizationTaxTab
          preferences={preferences}
          onUpdatePreferences={updatePreferences}
          formatAmount={formatAmount}
          onResetPreferences={resetPreferences}
        />
      )}

      {/* TAB 3: Data Portability & Backup */}
      {activeTab === 'data' && (
        <DataPortabilityTab
          exportSuccessMessage={exportSuccessMessage}
          isExporting={isExporting}
          lastBackupTime={lastBackupTime}
          onFullBackupExport={handleFullBackupExport}
          onExportCsv={handleExportCsv}
          fileInputRef={fileInputRef}
          onBackupFileUpload={handleBackupFileUpload}
          onNativeBackupOpen={handleNativeBackupOpen}
          restoreError={restoreError}
          backupPreview={backupPreview}
          formatAmount={formatAmount}
          onExecuteRestore={handleExecuteRestore}
          isRestoring={isRestoring}
          restoreSuccess={restoreSuccess}
        />
      )}

      {/* TAB 4: System Diagnostics */}
      {activeTab === 'system' && <SystemDiagnosticsTab systemStatus={systemStatus} />}

      <ManageFamilyModal isOpen={isManageFamilyOpen} onClose={() => setIsManageFamilyOpen(false)} />
    </div>
  );
}
