import { useState, useMemo, useRef } from 'react';
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
import { useRepositories } from '@/lib/persistence/repository-context';
import { userAdapter } from '@/lib/supabase/user.adapter';
import { Button } from '@/components/ui/Button';
import { User, Globe, Download, Database, Shield, Server, HardDrive, Users } from 'lucide-react';
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

type SettingsTab = 'profile' | 'family' | 'connection' | 'localization' | 'data' | 'system';

export function SettingsPage() {
  const {
    preferences,
    displayName,
    email,
    updatePreferences,
    updateDisplayName,
    formatAmount,
    resetPreferences,
  } = usePreferences();

  const { user, signOut } = useAuth();
  const { members, accounts } = useFamily();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [isManageFamilyOpen, setIsManageFamilyOpen] = useState(false);

  // Profile edit states
  const [nameInput, setNameInput] = useState(displayName);
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSavedSuccess, setNameSavedSuccess] = useState(false);

  // Export states
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setIsSavingName(true);
    await updateDisplayName(nameInput.trim());
    setIsSavingName(false);
    setNameSavedSuccess(true);
    setTimeout(() => setNameSavedSuccess(false), 3000);
  };

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
      const res = await exportUseCase.execute(user?.id || 'demo-user-001');
      if (res.success) {
        const saved = await handleDownloadFile(
          res.value.backupJsonString,
          res.value.summaryFilename,
          'application/json'
        );
        if (saved) {
          setExportSuccessMessage('Full JSON portfolio backup downloaded successfully!');
          setTimeout(() => setExportSuccessMessage(null), 4000);
        }
      } else {
        alert(res.error.message);
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
      const res = await exportUseCase.execute(user?.id || 'demo-user-001');
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
    const targetUserId = user?.id || 'usr-local-default';

    setIsRestoring(true);
    setRestoreError(null);

    const res = await restoreUseCase.execute({
      targetUserId,
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
    <div className="space-y-8 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              System & Preferences
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              Client-Side Privacy Enforced
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            Settings & Control Center
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your account, customize India-First localization standards, export offline
            backups, and monitor system health.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-slate-700 hover:bg-slate-800 text-slate-200 text-sm gap-2"
            onClick={handleFullBackupExport}
            disabled={isExporting}
          >
            <Download className="w-4 h-4 text-emerald-400" />
            Quick Backup (.json)
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-800 space-x-1 sm:space-x-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
            activeTab === 'profile'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <User className="w-4 h-4" />
          Profile & Security
        </button>

        <button
          onClick={() => setActiveTab('family')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
            activeTab === 'family'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          Family & Demats
        </button>

        <button
          onClick={() => setActiveTab('connection')}
          data-testid="tab-connection"
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
            activeTab === 'connection'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <HardDrive className="w-4 h-4 text-emerald-400" />
          Server Connection
        </button>

        <button
          onClick={() => setActiveTab('localization')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
            activeTab === 'localization'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Globe className="w-4 h-4" />
          Localization & Tax Standards
        </button>

        <button
          onClick={() => setActiveTab('data')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
            activeTab === 'data'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Database className="w-4 h-4" />
          Data Portability & Backup
        </button>

        <button
          onClick={() => setActiveTab('system')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
            activeTab === 'system'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Server className="w-4 h-4" />
          System Diagnostics
        </button>
      </div>

      {/* TAB 1: Profile & Security */}
      {activeTab === 'profile' && (
        <ProfileSecurityTab
          displayName={displayName}
          email={email}
          userEmail={user?.email}
          nameInput={nameInput}
          onNameInputChange={setNameInput}
          isSavingName={isSavingName}
          nameSavedSuccess={nameSavedSuccess}
          onSaveProfile={handleSaveProfile}
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
