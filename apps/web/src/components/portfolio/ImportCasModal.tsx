import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ParseCasPdfUseCase,
  ConfirmCasImportUseCase,
  ImportCasItemDto,
  ImportCasTransactionDto,
  CasPreviewDto,
} from '@wealthnest/application';
import { ImportSummaryResult } from '@wealthnest/domain';
import { PdfJsTextExtractorAdapter } from '@/lib/pdf/pdfjs-extractor.adapter';
import { SupabaseCasImportAdapter } from '@/lib/supabase/cas-import.adapter';
import { useAuth } from '@/lib/supabase/auth-context';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  X,
  FileSpreadsheet,
  Upload,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ArrowRight,
  FileText,
  RotateCcw,
  Users,
  Briefcase,
} from 'lucide-react';
import { useFamily } from '@/lib/family/family-context';

interface ImportCasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (importedItems?: ImportCasItemDto[], memberId?: string, accountId?: string) => void;
}

// Sample sanitized CDSL & NSDL text fixtures for quick testing without personal files
const SANITIZED_CDSL_FIXTURE_PAGES = [
  `Central Depository Services (India) Limited
   Consolidated Account Statement (CDSL e-CAS)
   Statement as on : 31-Mar-2026
   BO ID: 1208160000000000
   Name: QA TEST INVESTOR

   EQUITY SHARES / LISTED SECURITIES:
   ISIN         Security Name                     Current Balance   Market Price    Market Value
   INE002A01018 RELIANCE INDUSTRIES LTD. - EQ     80.000            2950.00         236000.00
   INF209K01164 NIPPON INDIA NIFTY 50 BEES ETF    500.000           280.00          140000.00
   IN0020180017 SOVEREIGN GOLD BOND 2028-29       30.000            7650.00         229500.00`,
];

const SANITIZED_NSDL_FIXTURE_PAGES = [
  `National Securities Depository Limited
   NSDL Consolidated Account Statement (CAS)
   Statement Date : 31/03/2026
   DP ID : IN300000  Client ID : 10000000
   Investor: QA TEST INVESTOR

   Holdings Statement:
   ISIN          Security Description              Balance       Rate (Rs.)    Value (Rs.)
   INE467B01029  TATA CONSULTANCY SERVICES LTD     40.000        4150.00       166000.00
   INE040A01034  HDFC BANK LIMITED                 50.000        1600.00       80000.00`,
];

export function ImportCasModal({ isOpen, onClose, onSuccess }: ImportCasModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { members, accounts, selectedMemberId, selectedAccountId } = useFamily();

  const [step, setStep] = useState<'upload' | 'preview' | 'summary'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<CasPreviewDto | null>(null);
  const [items, setItems] = useState<ImportCasItemDto[]>([]);
  const [transactions, setTransactions] = useState<ImportCasTransactionDto[]>([]);
  const [activeTab, setActiveTab] = useState<'equities' | 'mutual_funds' | 'transactions'>(
    'equities'
  );
  const [importSummary, setImportSummary] = useState<ImportSummaryResult | null>(null);

  // Legal Entity & Demat Account Assignment
  const [importMemberId, setImportMemberId] = useState<string>(() => {
    return selectedMemberId !== 'all' ? selectedMemberId : members[0]?.id || 'mem-self';
  });
  const [importAccountId, setImportAccountId] = useState<string>(() => {
    return selectedAccountId !== 'all' ? selectedAccountId : '';
  });

  useEffect(() => {
    if (selectedMemberId !== 'all') {
      setImportMemberId(selectedMemberId);
    }
    if (selectedAccountId !== 'all') {
      setImportAccountId(selectedAccountId);
    }
  }, [selectedMemberId, selectedAccountId]);

  const relevantAccounts = useMemo(() => {
    return accounts.filter((a) => a.memberId === importMemberId);
  }, [accounts, importMemberId]);

  // Split items into Equities & Mutual Funds
  const equities = useMemo(() => items.filter((i) => i.assetClassId !== 'mutual_fund'), [items]);
  const mutualFunds = useMemo(() => items.filter((i) => i.assetClassId === 'mutual_fund'), [items]);

  const selectedEquities = useMemo(() => equities.filter((e) => e.selected), [equities]);
  const selectedMutualFunds = useMemo(() => mutualFunds.filter((m) => m.selected), [mutualFunds]);
  const selectedTransactions = useMemo(
    () => transactions.filter((t) => t.selected),
    [transactions]
  );

  const equitiesSelectedValueCents = useMemo(
    () => selectedEquities.reduce((s, i) => s + i.currentValueCents, 0),
    [selectedEquities]
  );
  const equitiesTotalValueCents = useMemo(
    () => equities.reduce((s, i) => s + i.currentValueCents, 0),
    [equities]
  );

  const mfSelectedValueCents = useMemo(
    () => selectedMutualFunds.reduce((s, i) => s + i.currentValueCents, 0),
    [selectedMutualFunds]
  );
  const mfTotalValueCents = useMemo(
    () => mutualFunds.reduce((s, i) => s + i.currentValueCents, 0),
    [mutualFunds]
  );

  // Check for schemes held in multiple folios
  const mfFolioCountsByIsin = useMemo(() => {
    const counts = new Map<string, number>();
    for (const mf of mutualFunds) {
      counts.set(mf.isin, (counts.get(mf.isin) || 0) + 1);
    }
    return counts;
  }, [mutualFunds]);

  // Reset state
  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setPassword('');
    setError(null);
    setPreviewData(null);
    setItems([]);
    setTransactions([]);
    setActiveTab('equities');
    setImportSummary(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // Parse Action
  const parseMutation = useMutation({
    mutationFn: async () => {
      setError(null);
      if (!file) throw new Error('Please select a CAS statement PDF file.');

      const arrayBuffer = await file.arrayBuffer();
      const extractor = new PdfJsTextExtractorAdapter();
      const useCase = new ParseCasPdfUseCase(extractor);

      const cleanPassword = password.trim();
      const res = await useCase.execute(arrayBuffer, cleanPassword || undefined);
      if (!res.success) throw res.error;
      return res.value;
    },
    onSuccess: (data) => {
      setPreviewData(data);
      setItems([...data.items]);
      setTransactions([...(data.transactions || [])]);
      setStep('preview');
      const hasEquities = data.items.some((i) => i.assetClassId !== 'mutual_fund');
      setActiveTab(hasEquities ? 'equities' : 'mutual_funds');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to parse CAS statement.');
    },
  });

  // Helper: Test with Mock Sample CDSL or NSDL statement
  const handleLoadSampleFixture = (type: 'CDSL' | 'NSDL') => {
    setError(null);
    const pages = type === 'CDSL' ? SANITIZED_CDSL_FIXTURE_PAGES : SANITIZED_NSDL_FIXTURE_PAGES;

    const mockExtractor = {
      extractPages: async () => ({
        success: true as const,
        value: { pages, totalPageCount: 1 },
      }),
    };

    const useCase = new ParseCasPdfUseCase(mockExtractor);
    useCase.execute(new ArrayBuffer(1024)).then((res) => {
      if (res.success) {
        setPreviewData(res.value);
        setItems([...res.value.items]);
        setTransactions([...(res.value.transactions || [])]);
        setStep('preview');
        const hasEquities = res.value.items.some((i) => i.assetClassId !== 'mutual_fund');
        setActiveTab(hasEquities ? 'equities' : 'mutual_funds');
      } else {
        setError(res.error.message);
      }
    });
  };

  // Confirm Import Action
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!previewData) throw new Error('No preview data found to import.');

      if (user) {
        // Authenticated: Persist into PostgreSQL database
        const adapter = new SupabaseCasImportAdapter();
        const useCase = new ConfirmCasImportUseCase(adapter);

        const res = await useCase.execute({
          userId: user.id,
          provider: previewData.provider,
          statementDate: previewData.statementDate,
          items,
          transactions,
          memberId: importMemberId || undefined,
          accountId: importAccountId || undefined,
        });

        if (!res.success) throw res.error;
        return res.value;
      } else {
        // Demo Mode: Mock summary
        const selectedHoldings = items.filter((i) => i.selected).length;
        const selectedTxs = transactions.filter((t) => t.selected).length;
        const mockSummary: ImportSummaryResult = {
          batchId: `demo-batch-${Date.now()}`,
          total: items.length,
          imported: selectedHoldings,
          updated: 0,
          skipped: items.length - selectedHoldings,
          failed: 0,
          equitiesImported: selectedEquities.length,
          equitiesUpdated: 0,
          mutualFundsImported: selectedMutualFunds.length,
          mutualFundsUpdated: 0,
          transactionsImported: selectedTxs,
        };
        return mockSummary;
      }
    },
    onSuccess: (summary) => {
      setImportSummary(summary);
      setStep('summary');
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['portfolio-summary', user.id] });
        queryClient.invalidateQueries({ queryKey: ['transactions', user.id] });
        queryClient.invalidateQueries({ queryKey: ['cashflow-summary', user.id] });
      }
      if (onSuccess) {
        onSuccess(
          items.filter((i) => i.selected),
          importMemberId || undefined,
          importAccountId || undefined
        );
      }
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Import failed');
    },
  });

  // Toggle selection for holding
  const handleToggleItem = (itemToToggle: ImportCasItemDto) => {
    setItems((prev) =>
      prev.map((item) => (item === itemToToggle ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleSelectAllEquities = (select: boolean) => {
    setItems((prev) =>
      prev.map((item) =>
        item.assetClassId !== 'mutual_fund' ? { ...item, selected: select } : item
      )
    );
  };

  const handleSelectAllMutualFunds = (select: boolean) => {
    setItems((prev) =>
      prev.map((item) =>
        item.assetClassId === 'mutual_fund' ? { ...item, selected: select } : item
      )
    );
  };

  // Toggle selection for transactions
  const handleToggleTransaction = (index: number) => {
    setTransactions((prev) =>
      prev.map((tx, idx) => (idx === index ? { ...tx, selected: !tx.selected } : tx))
    );
  };

  const handleSelectAllTransactions = (select: boolean) => {
    setTransactions((prev) => prev.map((tx) => ({ ...tx, selected: select })));
  };

  const selectedCount = selectedEquities.length + selectedMutualFunds.length;
  const selectedTransactionsCount = selectedTransactions.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl rounded-2xl border border-border bg-card p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                Import Investments from NSDL / CDSL CAS
                <Badge variant="default" className="text-[10px] bg-primary/15 text-primary">
                  Phase 2.1
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground">
                Automated ingestion of Demat shares, mutual fund folios, and SGBs
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Step 1: Upload & Password */}
        {step === 'upload' && (
          <div className="space-y-4 pt-4 overflow-y-auto">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/15 text-destructive border border-destructive/30 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Privacy Guarantee Banner */}
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-muted-foreground flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">
                  Zero-Knowledge Client-Side Extraction
                </p>
                <p className="text-[11px] leading-relaxed mt-0.5">
                  Your PDF and password are processed strictly in-memory inside your local browser
                  environment. They are never sent to third-party services, logged, or saved to
                  disk.
                </p>
              </div>
            </div>

            {/* Drag & Drop File Area */}
            <div
              className={`p-6 border-2 border-dashed rounded-xl text-center transition-colors ${
                file ? 'border-primary bg-primary/5' : 'border-border/80 hover:border-primary/50'
              }`}
            >
              <input
                type="file"
                id="cas-file-input"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setFile(e.target.files[0]);
                    setError(null);
                  }
                }}
              />
              <label htmlFor="cas-file-input" className="cursor-pointer block space-y-2">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mx-auto text-muted-foreground">
                  {file ? (
                    <FileText className="w-5 h-5 text-primary" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                </div>
                {file ? (
                  <div>
                    <p className="text-sm font-semibold text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {(file.size / 1024).toFixed(1)} KB — Ready to parse
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Click to choose or drag-and-drop your CAS PDF
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Supports standard NSDL and CDSL e-CAS statements (up to 25 MB)
                    </p>
                  </div>
                )}
              </label>
            </div>

            {/* Password Input */}
            {(() => {
              const isPasswordError = Boolean(error && error.toLowerCase().includes('password'));
              const hasLowercase = Boolean(password && password !== password.toUpperCase());

              return (
                <div
                  className={`space-y-2 p-3 rounded-xl border transition-all ${
                    isPasswordError
                      ? 'border-amber-500/60 bg-amber-500/10 ring-1 ring-amber-500/30'
                      : 'border-border/60 bg-secondary/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Lock
                        className={`w-3.5 h-3.5 ${
                          isPasswordError ? 'text-amber-400 animate-pulse' : 'text-primary'
                        }`}
                      />
                      Document Password (if encrypted)
                    </label>
                    {hasLowercase && (
                      <button
                        type="button"
                        onClick={() => setPassword((prev) => prev.toUpperCase())}
                        className="text-[10px] text-primary hover:underline font-semibold tracking-wide"
                      >
                        Convert to UPPERCASE
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && file && !parseMutation.isPending) {
                          e.preventDefault();
                          parseMutation.mutate();
                        }
                      }}
                      placeholder="e.g. ABCDE1234F01011990 (PAN + DOB DDMMYYYY)"
                      className="w-full h-9 rounded-lg bg-card border border-border px-3 pr-10 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      autoFocus={isPasswordError}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Tip: CDSL & NSDL PDFs are typically protected with your{' '}
                    <span className="font-semibold text-foreground">10-digit PAN in UPPERCASE</span>{' '}
                    +{' '}
                    <span className="font-semibold text-foreground">Date of Birth (DDMMYYYY)</span>.
                  </p>
                </div>
              );
            })()}

            {/* Sample Fixtures Quick-Test Buttons */}
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 space-y-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Quick QA Testing (No file needed)
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleLoadSampleFixture('CDSL')}
                  className="text-xs font-mono gap-1.5 h-8"
                >
                  Load Sample CDSL CAS (Reliance, Nifty BeES, SGB)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleLoadSampleFixture('NSDL')}
                  className="text-xs font-mono gap-1.5 h-8"
                >
                  Load Sample NSDL CAS (TCS, HDFC Bank)
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/80">
              <Button variant="outline" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!file || parseMutation.isPending}
                onClick={() => parseMutation.mutate()}
                className="gap-2"
              >
                {parseMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Parse Statement
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Wizard Step 2: Verification & Preview Grid */}
        {step === 'preview' && previewData && (
          <div className="space-y-4 pt-4 flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Statement Metadata Summary */}
            <div className="p-3 rounded-xl bg-secondary/40 border border-border/60 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Provider:</span>
                <Badge variant="success" className="font-mono text-xs">
                  {previewData.provider} CAS
                </Badge>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-muted-foreground">Statement Date:</span>
                <span className="font-semibold text-foreground">{previewData.statementDate}</span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-muted-foreground">Reported Value:</span>
                <span className="font-bold text-emerald-400">
                  ₹
                  {(previewData.totalReportedValueCents / 100).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>

            {previewData.warnings.length > 0 && (
              <details className="rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 p-2.5 group">
                <summary className="flex items-center justify-between cursor-pointer font-semibold text-amber-400 select-none">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Statement Parser Notice ({previewData.warnings.length})</span>
                  </div>
                  <span className="text-[10px] text-amber-400/80 group-open:rotate-180 transition-transform">
                    ▼ Click to view
                  </span>
                </summary>
                <div className="mt-2 space-y-1 max-h-24 overflow-y-auto pl-5 pr-2">
                  {previewData.warnings.map((w, i) => (
                    <p key={i} className="text-[11px] text-amber-200/90 leading-relaxed">
                      • {w}
                    </p>
                  ))}
                  <p className="text-[11px] text-muted-foreground pt-0.5">
                    Closed folios with 0 balance can be ignored safely. If you hold units in an
                    unextracted scheme, you can still import the rest of your portfolio now and add
                    that scheme anytime via &quot;Add Holding&quot;.
                  </p>
                </div>
              </details>
            )}

            {/* Phase 6A: Legal Entity & Demat Account Assignment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-secondary/30 border border-border/60">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  Assign To Legal Entity / Member
                </label>
                <select
                  value={importMemberId}
                  onChange={(e) => {
                    setImportMemberId(e.target.value);
                    const firstAcc = accounts.find((a) => a.memberId === e.target.value);
                    setImportAccountId(firstAcc?.id || '');
                  }}
                  className="w-full h-8 rounded-lg bg-secondary/50 border border-border px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id} className="bg-slate-900 text-foreground">
                      {m.name} ({m.relationship.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  Assign Demat / Broker Account
                </label>
                <select
                  value={importAccountId}
                  onChange={(e) => setImportAccountId(e.target.value)}
                  className="w-full h-8 rounded-lg bg-secondary/50 border border-border px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="" className="bg-slate-900 text-foreground">-- Auto / Statement Folios --</option>
                  {relevantAccounts.map((a) => (
                    <option key={a.id} value={a.id} className="bg-slate-900 text-foreground">
                      {a.brokerName}: {a.accountName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tab Navigation: Direct Equities, Mutual Funds, Historical Transactions */}
            <div className="flex items-center gap-2 border-b border-border/80 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('equities')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                  activeTab === 'equities'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Direct Equities & ETFs</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-background/30 text-current font-bold">
                  {equities.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('mutual_funds')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                  activeTab === 'mutual_funds'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Mutual Funds</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-background/30 text-current font-bold">
                  {mutualFunds.length}
                </span>
              </button>

              {transactions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('transactions')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                    activeTab === 'transactions'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>Historical Transactions</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    {transactions.length}
                  </span>
                </button>
              )}
            </div>

            {/* Tab 1: Direct Equities & ETFs Table */}
            {activeTab === 'equities' && (
              <>
                <div className="flex items-center justify-between text-xs bg-blue-500/5 p-2 rounded-lg border border-blue-500/20">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      Found <span className="text-foreground font-semibold">{equities.length}</span>{' '}
                      stocks & ETFs (
                      <span className="text-blue-400 font-semibold">{selectedEquities.length}</span>{' '}
                      selected)
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="font-mono text-foreground font-semibold">
                      Selected: ₹
                      {(equitiesSelectedValueCents / 100).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      (of ₹
                      {(equitiesTotalValueCents / 100).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                      )
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectAllEquities(true)}
                      className="text-primary hover:underline font-semibold"
                    >
                      Select All
                    </button>
                    <span className="text-muted-foreground">•</span>
                    <button
                      type="button"
                      onClick={() => handleSelectAllEquities(false)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="min-h-[300px] max-h-[460px] flex-1 overflow-y-auto border border-border/80 rounded-xl shadow-inner">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-secondary/60 text-muted-foreground sticky top-0 backdrop-blur-md z-10">
                        <th className="py-2.5 px-3 w-10 text-center">Import</th>
                        <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">
                          Security / Ticker
                        </th>
                        <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">ISIN</th>
                        <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">
                          Demat Account
                        </th>
                        <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-right">
                          Shares
                        </th>
                        <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-right">
                          Price
                        </th>
                        <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-right">
                          Reported Value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 font-mono">
                      {equities.map((item: ImportCasItemDto, idx: number) => (
                        <tr
                          key={`${item.isin}-${item.dematAccountId || idx}`}
                          className={`hover:bg-secondary/30 transition-colors ${
                            item.selected ? 'bg-secondary/15' : 'opacity-50'
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => handleToggleItem(item)}
                              className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-sans">
                            <div className="font-semibold text-foreground text-xs flex items-center gap-1.5 flex-wrap">
                              <span>{item.name}</span>
                              {item.ticker && (
                                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold">
                                  {item.ticker}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                            {item.isin}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                            {item.dematAccountId || 'Demat Main'}
                          </td>
                          <td className="py-2.5 px-3 text-right text-foreground font-semibold">
                            {item.quantity.toLocaleString('en-IN', { maximumFractionDigits: 4 })}
                          </td>
                          <td className="py-2.5 px-3 text-right text-muted-foreground">
                            {item.unitCostCents
                              ? `₹${(item.unitCostCents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-foreground">
                            ₹
                            {(item.currentValueCents / 100).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Tab 2: Mutual Funds Table */}
            {activeTab === 'mutual_funds' && (
              <>
                <div className="flex items-center justify-between text-xs bg-cyan-500/5 p-2 rounded-lg border border-cyan-500/20">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      Found{' '}
                      <span className="text-foreground font-semibold">{mutualFunds.length}</span>{' '}
                      mutual fund folios (
                      <span className="text-cyan-400 font-semibold">
                        {selectedMutualFunds.length}
                      </span>{' '}
                      selected)
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="font-mono text-foreground font-semibold">
                      Selected: ₹
                      {(mfSelectedValueCents / 100).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      (of ₹
                      {(mfTotalValueCents / 100).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                      )
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectAllMutualFunds(true)}
                      className="text-primary hover:underline font-semibold"
                    >
                      Select All
                    </button>
                    <span className="text-muted-foreground">•</span>
                    <button
                      type="button"
                      onClick={() => handleSelectAllMutualFunds(false)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="min-h-[300px] max-h-[460px] flex-1 overflow-y-auto border border-border/80 rounded-xl shadow-inner">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-secondary/60 text-muted-foreground sticky top-0 backdrop-blur-md z-10">
                        <th className="py-2.5 px-3 w-10 text-center">Import</th>
                        <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">
                          Scheme / Fund Name
                        </th>
                        <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">
                          AMC / Plan
                        </th>
                        <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">
                          Folio No.
                        </th>
                        <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">ISIN</th>
                        <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-right">
                          Units
                        </th>
                        <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-right">
                          NAV
                        </th>
                        <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-right">
                          Reported Value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 font-mono">
                      {mutualFunds.map((item: ImportCasItemDto, idx: number) => {
                        const hasMultipleFolios = (mfFolioCountsByIsin.get(item.isin) || 0) > 1;

                        return (
                          <tr
                            key={`${item.isin}-${item.folioNumber || idx}`}
                            className={`hover:bg-secondary/30 transition-colors ${
                              item.selected ? 'bg-secondary/15' : 'opacity-50'
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={() => handleToggleItem(item)}
                                className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                              />
                            </td>
                            <td className="py-2.5 px-3 font-sans">
                              <div className="font-semibold text-foreground text-xs flex items-center gap-1.5 flex-wrap">
                                <span>{item.name}</span>
                                {hasMultipleFolios && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/30 px-1 py-0"
                                    title="This scheme is held across multiple distinct folios in your statement."
                                  >
                                    Multiple Folios
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-sans">
                              <div className="text-xs text-foreground font-medium">
                                {item.amcName || 'Mutual Fund'}
                              </div>
                              {item.schemePlan && (
                                <span className="text-[10px] text-muted-foreground">
                                  {item.schemePlan}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-foreground font-semibold">
                              {item.folioNumber || 'Direct'}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[10px] text-muted-foreground">
                              {item.isin}
                            </td>
                            <td className="py-2.5 px-3 text-right text-foreground font-semibold">
                              {item.quantity.toLocaleString('en-IN', { maximumFractionDigits: 4 })}
                            </td>
                            <td className="py-2.5 px-3 text-right text-muted-foreground">
                              {item.unitCostCents
                                ? `₹${(item.unitCostCents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                                : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-foreground">
                              ₹
                              {(item.currentValueCents / 100).toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Tab 3: Transactions Table */}
            {activeTab === 'transactions' && (
              <>
                <div className="flex items-center justify-between text-xs bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/20">
                  <span className="text-muted-foreground">
                    Found{' '}
                    <span className="text-foreground font-semibold">{transactions.length}</span>{' '}
                    historical transactions (
                    <span className="text-emerald-400 font-semibold">
                      {selectedTransactionsCount}
                    </span>{' '}
                    selected)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectAllTransactions(true)}
                      className="text-primary hover:underline font-semibold"
                    >
                      Select All
                    </button>
                    <span className="text-muted-foreground">•</span>
                    <button
                      type="button"
                      onClick={() => handleSelectAllTransactions(false)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="min-h-[300px] max-h-[460px] flex-1 overflow-y-auto border border-border/80 rounded-xl shadow-inner">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-secondary/60 text-muted-foreground sticky top-0 backdrop-blur-md z-10">
                        <th className="py-2.5 px-3 w-10 text-center">Import</th>
                        <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Date</th>
                        <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Type</th>
                        <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">
                          Scheme / Fund Name
                        </th>
                        <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-right">
                          Units
                        </th>
                        <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-right">
                          NAV
                        </th>
                        <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-right">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 font-mono">
                      {transactions.map((tx, idx) => (
                        <tr
                          key={idx}
                          className={`hover:bg-secondary/30 transition-colors ${
                            tx.selected ? 'bg-secondary/15' : 'opacity-50'
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={tx.selected}
                              onChange={() => handleToggleTransaction(idx)}
                              className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-sans text-muted-foreground whitespace-nowrap">
                            {tx.date}
                          </td>
                          <td className="py-2.5 px-3 font-sans">
                            {tx.type === 'sell' ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-rose-500/10 text-rose-400 border-rose-500/30 uppercase font-semibold"
                              >
                                Redemption
                              </Badge>
                            ) : tx.type === 'dividend' ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/30 uppercase font-semibold"
                              >
                                Dividend
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 uppercase font-semibold"
                              >
                                Purchase (SIP)
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-sans">
                            <div className="font-semibold text-foreground text-xs flex items-center gap-1.5 flex-wrap">
                              <span>{tx.schemeName}</span>
                              {tx.ticker && (
                                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-bold">
                                  {tx.ticker}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate max-w-sm mt-0.5">
                              {tx.description}
                            </p>
                          </td>
                          <td className="py-2.5 px-3 text-right text-foreground font-semibold">
                            {tx.type === 'sell' ? '-' : '+'}
                            {tx.units
                              ? tx.units.toLocaleString('en-IN', { maximumFractionDigits: 4 })
                              : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right text-muted-foreground">
                            {tx.navPriceCents
                              ? `₹${(tx.navPriceCents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                              : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-foreground">
                            ₹
                            {(tx.amountCents / 100).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border/80">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep('upload')}
                className="gap-1.5 text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Back to Upload
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={
                    (selectedCount === 0 && selectedTransactionsCount === 0) ||
                    confirmMutation.isPending
                  }
                  onClick={() => confirmMutation.mutate()}
                  className="gap-2"
                >
                  {confirmMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm & Import ({selectedEquities.length} Equities, {selectedMutualFunds.length}{' '}
                  Mutual Funds
                  {selectedTransactionsCount > 0 ? `, ${selectedTransactionsCount} txs` : ''})
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Step 3: Import Summary */}
        {step === 'summary' && importSummary && (
          <div className="space-y-6 pt-6 text-center">
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto ${
                importSummary.failed > 0 &&
                importSummary.imported === 0 &&
                importSummary.updated === 0
                  ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                  : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
              }`}
            >
              {importSummary.failed > 0 &&
              importSummary.imported === 0 &&
              importSummary.updated === 0 ? (
                <AlertCircle className="w-8 h-8" />
              ) : (
                <CheckCircle2 className="w-8 h-8" />
              )}
            </div>

            <div>
              <h4 className="text-lg font-bold text-foreground">
                {importSummary.failed > 0 &&
                importSummary.imported === 0 &&
                importSummary.updated === 0
                  ? 'CAS Import Encountered Issues'
                  : 'CAS Import Completed Successfully!'}
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                {importSummary.failed > 0 &&
                importSummary.imported === 0 &&
                importSummary.updated === 0
                  ? 'Could not save positions to database. Please review the notice below.'
                  : 'Your investment positions have been extracted, validated, and synchronized into distinct investment classes.'}
              </p>
            </div>

            {importSummary.failed > 0 && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-center gap-2 max-w-md mx-auto">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>
                  {importSummary.failed} position{importSummary.failed > 1 ? 's' : ''} encountered
                  an issue during database save.
                </span>
              </div>
            )}

            {/* Summary statistics grid */}
            <div className="grid gap-3 max-w-lg mx-auto grid-cols-2 sm:grid-cols-4">
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <span className="text-2xl font-bold font-mono text-blue-400">
                  {importSummary.equitiesImported ??
                    (importSummary.imported > 0 ? importSummary.imported : 0)}
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">Equities Imported</p>
              </div>

              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                <span className="text-2xl font-bold font-mono text-cyan-400">
                  {importSummary.mutualFundsImported ?? 0}
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">Mutual Funds</p>
              </div>

              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <span className="text-2xl font-bold font-mono text-purple-400">
                  {importSummary.updated}
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">Updated</p>
              </div>

              <div className="p-3 rounded-xl bg-secondary/40 border border-border/50">
                <span className="text-2xl font-bold font-mono text-muted-foreground">
                  {importSummary.skipped}
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">Skipped</p>
              </div>

              {Boolean(importSummary.transactionsImported) && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 col-span-2 sm:col-span-4">
                  <span className="text-xl font-bold font-mono text-emerald-400">
                    +{importSummary.transactionsImported}
                  </span>
                  <p className="text-[11px] text-emerald-200 mt-0.5">
                    Historical Transactions Added to Trade Ledger
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2">
              <Button onClick={handleClose} className="gap-2">
                View Updated Portfolio
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
