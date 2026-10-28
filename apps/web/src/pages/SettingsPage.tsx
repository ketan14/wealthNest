import { useState, useMemo, useRef } from 'react';
import { CurrencyCode } from '@wealthnest/domain';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  User,
  Globe,
  Download,
  Upload,
  Database,
  Shield,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileJson,
  Layers,
  Sparkles,
  Server,
  Key,
  HardDrive,
  Sliders,
  Users,
  Briefcase,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { useFamily } from '@/lib/family/family-context';
import { FamilyDistributionWidget } from '@/components/family/FamilyDistributionWidget';
import { ManageFamilyModal } from '@/components/family/ManageFamilyModal';
import { saveTextFile, openTextFile } from '@/lib/tauri/tauri-file-dialog';
import { isTauri } from '@/lib/tauri/tauri-runtime';

type SettingsTab = 'profile' | 'family' | 'localization' | 'data' | 'system';

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

  const handleDownloadFile = async (content: string, filename: string, _type: string): Promise<boolean> => {
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

  const handleExportCsv = async (moduleType: 'holdings' | 'transactions' | 'liabilities' | 'goals') => {
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
            Manage your account, customize India-First localization standards, export offline backups, and monitor system health.
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-indigo-400" />
                  User Profile Information
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Update your identity details. These are stored locally and synced to your Supabase RLS vault.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Full Display Name
                    </label>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="e.g. Ketan Vaghela"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Primary Email Address
                    </label>
                    <div className="flex items-center justify-between bg-slate-950 border border-slate-800/80 rounded-lg px-3.5 py-2 text-sm text-slate-400">
                      <span>{email}</span>
                      <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        Verified
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Email authentication is handled via Supabase Auth magic link and password flows.
                    </p>
                  </div>

                  <div className="pt-2 flex items-center gap-3">
                    <Button
                      type="submit"
                      disabled={isSavingName || !nameInput.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm"
                    >
                      {isSavingName ? 'Saving...' : 'Save Profile Changes'}
                    </Button>
                    {nameSavedSuccess && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium animate-fade-in">
                        <CheckCircle2 className="w-4 h-4" />
                        Profile updated successfully!
                      </span>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-amber-400" />
                  Security & Access Credentials
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Manage cryptographic tokens, sessions, and authentication security.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium text-white flex items-center gap-2">
                      <span>Row-Level Security (RLS)</span>
                      <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                        Active
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-400">
                      Multi-tenant PostgreSQL policies guarantee that only your user UUID can access holdings and logs.
                    </div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium text-white">Active Session</div>
                    <div className="text-xs text-slate-400">
                      {user ? `Authenticated as ${user.email}` : 'Demo Local Session Mode'}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => signOut()}
                    className="border-rose-900/40 text-rose-400 hover:bg-rose-950 text-xs"
                  >
                    Sign Out
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border-indigo-900/30">
              <CardHeader>
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  Account Tier
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-lg">
                    {displayName.slice(0, 2).toUpperCase() || 'WN'}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{displayName}</div>
                    <div className="text-xs text-indigo-300">Self-Hosted Private Vault</div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800 text-xs text-slate-300">
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Environment</span>
                    <span className="font-mono text-emerald-400">Localhost / Docker</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Encryption</span>
                    <span className="font-mono text-slate-200">AES-256 + TLS 1.3</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">CAS Parser</span>
                    <span className="font-mono text-indigo-300">CDSL / NSDL Enabled</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Data Isolation</span>
                    <span className="font-mono text-emerald-400">100% Client-Side</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB: Family & Demats */}
      {activeTab === 'family' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                Family Members & Demat Folios
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Manage household legal entities (Individual PAN, HUF, Minor) and link Zerodha, Groww, Angel One, or CAMS accounts.
              </p>
            </div>
            <Button
              onClick={() => setIsManageFamilyOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 self-start sm:self-auto shrink-0 shadow-lg shadow-indigo-600/20"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Manage Entities & Accounts
            </Button>
          </div>

          {/* Family Wealth & Multi-PAN Distribution Widget */}
          <FamilyDistributionWidget />

          {/* Two-Column Grid: Registered Members and Connected Demats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Registered Family Entities */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    Family Entities ({members.length})
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Separate PANs entitled to independent ₹1.25L Sec 112A exemptions
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsManageFamilyOpen(true)}
                  className="h-8 text-xs border-slate-700 hover:bg-slate-800 text-slate-300 gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-400" />
                  Add Member
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {members.map((member) => {
                  const linkedAccounts = accounts.filter((a) => a.memberId === member.id);
                  const isHuf = member.relationship === 'huf';

                  return (
                    <div
                      key={member.id}
                      className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/80 hover:border-slate-700/80 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border"
                          style={{
                            backgroundColor: `${member.colorHex}20`,
                            borderColor: `${member.colorHex}60`,
                            color: member.colorHex,
                          }}
                        >
                          {member.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-white truncate">
                              {member.name}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase font-semibold ${
                                isHuf
                                  ? 'border-purple-500/40 text-purple-300 bg-purple-500/10'
                                  : 'border-slate-700 text-slate-300 bg-slate-800/50'
                              }`}
                            >
                              {member.relationship}
                            </Badge>
                            {member.isPrimary && (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                              >
                                Primary
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                            <span>PAN: <span className="font-mono text-slate-300">{member.panMasked || 'Not provided'}</span></span>
                            <span>•</span>
                            <span>{linkedAccounts.length} Demat/MF {linkedAccounts.length === 1 ? 'account' : 'accounts'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <Badge
                          variant="outline"
                          className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/5 hidden sm:inline-flex"
                        >
                          ₹1.25L 112A Exempt
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Connected Demat & Folio Accounts */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-emerald-400" />
                    Demat & Folio Accounts ({accounts.length})
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Depository and broker accounts linked to family members
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsManageFamilyOpen(true)}
                  className="h-8 text-xs border-slate-700 hover:bg-slate-800 text-slate-300 gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  Add Account
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {accounts.map((account) => {
                  const owner = members.find((m) => m.id === account.memberId);

                  return (
                    <div
                      key={account.id}
                      className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/80 hover:border-slate-700/80 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-white">
                            {account.accountName}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] border-blue-500/30 text-blue-400 bg-blue-500/10 font-semibold"
                          >
                            {account.brokerName}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[10px] border-slate-700 text-slate-400 bg-slate-800/40"
                          >
                            {account.accountType}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          {owner && (
                            <span className="flex items-center gap-1.5 text-slate-300">
                              <span
                                className="w-2 h-2 rounded-full inline-block"
                                style={{ backgroundColor: owner.colorHex }}
                              />
                              {owner.name} ({owner.relationship})
                            </span>
                          )}
                          {account.accountNumberMasked && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-slate-400">
                                Acc: {account.accountNumberMasked}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/5"
                        >
                          Active
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Tax Advisory Card */}
          <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-start gap-3">
            <Shield className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 leading-relaxed">
              <span className="font-semibold text-purple-300">Indian Section 112A Tax Advantage:</span>{' '}
              By allocating long-term capital assets across distinct PAN entities (e.g., Self, Spouse, HUF), your household unlocks multiple independent ₹1,25,000 annual LTCG exemption limits under Finance Act (No. 2) 2024. Tax savings are automatically calculated and reflected in your analytics.
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Localization & Tax Standards */}
      {activeTab === 'localization' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-indigo-400" />
                  Currency & Regional Standards
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Configure default base currency and Indian institutional number formatting.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Base Currency Selection */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    Default Base Currency
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
                      { code: 'USD', symbol: '$', name: 'US Dollar' },
                      { code: 'EUR', symbol: '€', name: 'Euro' },
                      { code: 'GBP', symbol: '£', name: 'British Pound' },
                    ].map((curr) => {
                      const isSelected = preferences.defaultCurrency === curr.code;
                      return (
                        <button
                          key={curr.code}
                          type="button"
                          onClick={() => updatePreferences({ defaultCurrency: curr.code as CurrencyCode })}
                          className={`p-3 rounded-lg border text-left transition-all ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-500/10 text-white'
                              : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="text-lg font-bold text-white mb-0.5">{curr.symbol} {curr.code}</div>
                          <div className="text-xs text-slate-400">{curr.name}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* System of Numeration */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    System of Numeration
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => updatePreferences({ numberFormat: 'en-IN' })}
                      className={`p-3.5 rounded-lg border text-left transition-all ${
                        preferences.numberFormat === 'en-IN'
                          ? 'border-indigo-500 bg-indigo-500/10 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-semibold text-white text-sm mb-1">
                        Indian System (en-IN)
                      </div>
                      <div className="text-xs text-slate-400 mb-2">
                        Lakhs & Crores grouping (2,2,3 grouping)
                      </div>
                      <div className="text-xs font-mono text-emerald-400 bg-slate-900 px-2 py-1 rounded inline-block">
                        ₹ 1,50,00,000 (₹ 1.50 Cr)
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => updatePreferences({ numberFormat: 'en-US' })}
                      className={`p-3.5 rounded-lg border text-left transition-all ${
                        preferences.numberFormat === 'en-US'
                          ? 'border-indigo-500 bg-indigo-500/10 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-semibold text-white text-sm mb-1">
                        International System (en-US)
                      </div>
                      <div className="text-xs text-slate-400 mb-2">
                        Millions & Billions grouping (3,3,3 grouping)
                      </div>
                      <div className="text-xs font-mono text-slate-300 bg-slate-900 px-2 py-1 rounded inline-block">
                        $ 15,000,000 ($ 15.00 M)
                      </div>
                    </button>
                  </div>
                </div>

                {/* Financial Year Cycle */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    Financial Year Cycle
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => updatePreferences({ fiscalYearStart: '04-01' })}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        preferences.fiscalYearStart === '04-01'
                          ? 'border-indigo-500 bg-indigo-500/10 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-semibold text-white text-sm mb-0.5">
                        Indian Fiscal Year (Apr 1 - Mar 31)
                      </div>
                      <div className="text-xs text-slate-400">
                        Default for Indian IT Act filing, advance tax, and capital gains tracking.
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => updatePreferences({ fiscalYearStart: '01-01' })}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        preferences.fiscalYearStart === '01-01'
                          ? 'border-indigo-500 bg-indigo-500/10 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-semibold text-white text-sm mb-0.5">
                        Calendar Year (Jan 1 - Dec 31)
                      </div>
                      <div className="text-xs text-slate-400">
                        Standard Western calendar year for international portfolios.
                      </div>
                    </button>
                  </div>
                </div>

                {/* Indian Income Tax Regime Preference */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    Income Tax Regime for Projections
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => updatePreferences({ taxRegime: 'new' })}
                      className={`p-3.5 rounded-lg border text-left transition-all ${
                        preferences.taxRegime === 'new'
                          ? 'border-indigo-500 bg-indigo-500/10 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-white text-sm">New Regime (Sec 115BAC)</span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-medium">
                          Recommended
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        Lower slab rates, ₹75,000 standard deduction, no exemption overhead.
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => updatePreferences({ taxRegime: 'old' })}
                      className={`p-3.5 rounded-lg border text-left transition-all ${
                        preferences.taxRegime === 'old'
                          ? 'border-indigo-500 bg-indigo-500/10 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-semibold text-white text-sm mb-1">Old Regime</div>
                      <div className="text-xs text-slate-400">
                        Supports 80C (PPF/ELSS up to ₹1.5L), 80D (health insurance), home loan interest (Sec 24b).
                      </div>
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Interactive Live Format Preview */}
          <div className="space-y-6">
            <Card className="bg-slate-900 border-slate-800 sticky top-6">
              <CardHeader>
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  Live Formatting Preview
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Instant visual demonstration of your current localization rules.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-xs text-slate-400 mb-1">Portfolio Valuation (Full)</div>
                  <div className="text-lg font-bold text-white font-mono">
                    {formatAmount(2450000000n)}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-xs text-slate-400 mb-1">Portfolio Valuation (Compact)</div>
                  <div className="text-xl font-bold text-emerald-400 font-mono">
                    {formatAmount(2450000000n, { compact: true })}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-xs text-slate-400 mb-1">Monthly SIP Contribution</div>
                  <div className="text-base font-semibold text-white font-mono">
                    {formatAmount(5000000n)}
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    variant="outline"
                    onClick={resetPreferences}
                    className="w-full border-slate-800 hover:bg-slate-800 text-xs text-slate-400"
                  >
                    Reset to India-First Defaults
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 3: Data Portability & Backup */}
      {activeTab === 'data' && (
        <div className="space-y-6">
          {exportSuccessMessage && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              {exportSuccessMessage}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Export Section */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Download className="w-5 h-5 text-indigo-400" />
                  Export & Data Portability
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Download full offline copies of your assets, liabilities, transactions, and goals.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-white flex items-center gap-2">
                      <FileJson className="w-4 h-4 text-indigo-400" />
                      Complete JSON Backup
                    </div>
                    <div className="text-xs text-slate-400">
                      Standard WealthNest v1.0.0 schema including all metadata, cost bases, and loans.
                    </div>
                  </div>
                  <Button
                    onClick={handleFullBackupExport}
                    disabled={isExporting}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Download JSON
                  </Button>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Spreadsheet CSV Reports
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleExportCsv('holdings')}
                      disabled={isExporting}
                      className="border-slate-800 hover:bg-slate-800 text-xs text-slate-200 justify-start"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 mr-2" />
                      Holdings & Valuations (.csv)
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => handleExportCsv('transactions')}
                      disabled={isExporting}
                      className="border-slate-800 hover:bg-slate-800 text-xs text-slate-200 justify-start"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400 mr-2" />
                      Transactions Log (.csv)
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => handleExportCsv('liabilities')}
                      disabled={isExporting}
                      className="border-slate-800 hover:bg-slate-800 text-xs text-slate-200 justify-start"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400 mr-2" />
                      Loans & EMIs (.csv)
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => handleExportCsv('goals')}
                      disabled={isExporting}
                      className="border-slate-800 hover:bg-slate-800 text-xs text-slate-200 justify-start"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-purple-400 mr-2" />
                      Goals & Runway (.csv)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Restore Section */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Upload className="w-5 h-5 text-emerald-400" />
                  Restore from Backup
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Upload and verify a previously exported WealthNest JSON backup file.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl p-6 text-center transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleBackupFileUpload}
                    className="hidden"
                    id="backup-file-input"
                  />
                  <label
                    htmlFor="backup-file-input"
                    onClick={handleNativeBackupOpen}
                    className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
                      <Upload className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="text-sm font-medium text-white">
                      Click to select WealthNest backup JSON
                    </div>
                    <div className="text-xs text-slate-500">
                      Supports wealthnest-portfolio-v1 schema format
                    </div>
                  </label>
                </div>

                {restoreError && (
                  <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    {restoreError}
                  </div>
                )}

                {backupPreview && backupPreview.isValid && (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                      <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Valid Backup (v{backupPreview.version})
                      </span>
                      <span className="text-slate-400">
                        Exported: {backupPreview.exportedAt.slice(0, 10)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-900/60 p-2 rounded">
                        <span className="text-slate-400">Holdings:</span>{' '}
                        <strong className="text-white">{backupPreview.holdingsCount}</strong>
                      </div>
                      <div className="bg-slate-900/60 p-2 rounded">
                        <span className="text-slate-400">Transactions:</span>{' '}
                        <strong className="text-white">{backupPreview.transactionsCount}</strong>
                      </div>
                      <div className="bg-slate-900/60 p-2 rounded">
                        <span className="text-slate-400">Liabilities:</span>{' '}
                        <strong className="text-white">{backupPreview.liabilitiesCount}</strong>
                      </div>
                      <div className="bg-slate-900/60 p-2 rounded">
                        <span className="text-slate-400">Goals:</span>{' '}
                        <strong className="text-white">{backupPreview.goalsCount}</strong>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-xs text-slate-400">Net Worth in Backup:</span>
                      <span className="font-mono text-sm font-bold text-white">
                        {formatAmount(backupPreview.netWorthCents)}
                      </span>
                    </div>

                    <Button
                      onClick={handleExecuteRestore}
                      disabled={isRestoring}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs mt-2"
                    >
                      {isRestoring ? 'Restoring Portfolio...' : 'Confirm & Restore Portfolio'}
                    </Button>
                  </div>
                )}

                {restoreSuccess && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Portfolio data successfully verified and restored into your local environment!
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 4: System Diagnostics */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">Monorepo Layers</span>
                  <Layers className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-2xl font-bold text-white">{systemStatus.layers.length}</div>
                <div className="text-xs text-emerald-400 mt-1">100% Initialized</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">Database Engine</span>
                  <Database className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-white">PostgreSQL</div>
                <div className="text-xs text-slate-400 mt-1">Supabase + RLS</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">Client Memory Cache</span>
                  <HardDrive className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-white">Reactive</div>
                <div className="text-xs text-slate-400 mt-1">localStorage synced</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">Architecture</span>
                  <Server className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-white">Clean Arch</div>
                <div className="text-xs text-slate-400 mt-1">Zero domain dependencies</div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                Architectural Layer Verification
              </CardTitle>
              <CardDescription className="text-slate-400">
                WealthNest Clean Architecture enforces strict dependency inversion principles across all packages.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {systemStatus.layers.map((layer, index) => (
                  <div
                    key={index}
                    className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between"
                  >
                    <div className="space-y-0.5">
                      <div className="text-sm font-semibold text-white flex items-center gap-2">
                        <span>{layer.name}</span>
                        <Badge variant="outline" className="text-emerald-400 border-emerald-500/20 bg-emerald-500/10">
                          {layer.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-400">{layer.description}</div>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ManageFamilyModal
        isOpen={isManageFamilyOpen}
        onClose={() => setIsManageFamilyOpen(false)}
      />
    </div>
  );
}
