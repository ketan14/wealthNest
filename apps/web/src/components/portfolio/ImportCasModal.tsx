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
import { useCasImportRepository } from '@/lib/persistence/repository-context';
import { useAuth } from '@/lib/supabase/auth-context';
import { Badge } from '@/components/ui/Badge';
import { X, FileSpreadsheet } from 'lucide-react';
import { useFamily } from '@/lib/family/family-context';
import {
  SANITIZED_CDSL_FIXTURE_PAGES,
  SANITIZED_NSDL_FIXTURE_PAGES,
  SANITIZED_CAMS_KFIN_FIXTURE_PAGES,
  buildBrokerCsvPreview,
} from '@/components/portfolio/cas-import-fixtures';
import { CasUploadStep } from '@/components/portfolio/CasUploadStep';
import { CasPreviewStep } from '@/components/portfolio/CasPreviewStep';
import { CasSummaryStep } from '@/components/portfolio/CasSummaryStep';

interface ImportCasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (importedItems?: ImportCasItemDto[], memberId?: string, accountId?: string) => void;
}

export function ImportCasModal({ isOpen, onClose, onSuccess }: ImportCasModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { members, accounts, selectedMemberId, selectedAccountId } = useFamily();
  const casImportRepo = useCasImportRepository();

  const [importSource, setImportSource] = useState<'cas_pdf' | 'zerodha_csv' | 'groww_csv'>(
    'cas_pdf'
  );
  const [step, setStep] = useState<'upload' | 'preview' | 'summary'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
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

  // Helper: Parse broker CSV text directly
  const handleParseBrokerCsvText = (csvContent: string, preferredBroker?: 'ZERODHA' | 'GROWW') => {
    setError(null);
    try {
      const result = buildBrokerCsvPreview(csvContent, preferredBroker);
      if ('error' in result) {
        setError(result.error);
        return;
      }

      const { preview } = result;
      setPreviewData(preview);
      setItems([...preview.items]);
      setTransactions([...(preview.transactions || [])]);
      setStep('preview');

      if (preview.items.length > 0) {
        const hasEquities = preview.items.some((i) => i.assetClassId !== 'mutual_fund');
        setActiveTab(hasEquities ? 'equities' : 'mutual_funds');
      } else if (preview.transactions && preview.transactions.length > 0) {
        setActiveTab('transactions');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to parse broker CSV.');
    }
  };

  // Parse Action
  const parseMutation = useMutation({
    mutationFn: async () => {
      setError(null);
      if (!file) throw new Error('Please select a statement or CSV file.');

      const isCsv =
        file.name.endsWith('.csv') || file.type.includes('csv') || importSource !== 'cas_pdf';

      if (isCsv) {
        const text = await file.text();
        const preferredBroker: 'ZERODHA' | 'GROWW' | undefined =
          importSource === 'zerodha_csv'
            ? 'ZERODHA'
            : importSource === 'groww_csv'
              ? 'GROWW'
              : undefined;
        handleParseBrokerCsvText(text, preferredBroker);
        return null;
      }

      const arrayBuffer = await file.arrayBuffer();
      const extractor = new PdfJsTextExtractorAdapter();
      const useCase = new ParseCasPdfUseCase(extractor);

      const cleanPassword = password.trim();
      const res = await useCase.execute(arrayBuffer, cleanPassword || undefined);
      if (!res.success) throw res.error;
      return res.value;
    },
    onSuccess: (data) => {
      if (!data) return; // Handled directly in CSV parser
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

  // Helper: Test with Mock Sample CDSL, NSDL or CAMS/KFin statement
  const handleLoadSampleFixture = (type: 'CDSL' | 'NSDL' | 'CAMS_KFIN') => {
    setError(null);
    const pages =
      type === 'CDSL'
        ? SANITIZED_CDSL_FIXTURE_PAGES
        : type === 'NSDL'
          ? SANITIZED_NSDL_FIXTURE_PAGES
          : SANITIZED_CAMS_KFIN_FIXTURE_PAGES;

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
        // Authenticated: Persist into database via repository port
        const useCase = new ConfirmCasImportUseCase(casImportRepo);

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
                Import Investments from NSDL / CDSL / CAMS CAS
                <Badge variant="default" className="text-[10px] bg-primary/15 text-primary">
                  Phase 2.1 & CAMS
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground">
                Automated ingestion of Demat shares, CAMS / KFintech mutual fund folios, and SGBs
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
          <CasUploadStep
            importSource={importSource}
            file={file}
            password={password}
            error={error}
            isParsing={parseMutation.isPending}
            onSelectSource={(source) => {
              setImportSource(source);
              setFile(null);
              setError(null);
            }}
            onFileChange={(selectedFile) => {
              setFile(selectedFile);
              setError(null);
              if (
                selectedFile &&
                selectedFile.name.endsWith('.csv') &&
                importSource === 'cas_pdf'
              ) {
                setImportSource('zerodha_csv');
              }
            }}
            onPasswordChange={setPassword}
            onClearError={() => setError(null)}
            onParse={() => parseMutation.mutate()}
            onLoadSampleFixture={handleLoadSampleFixture}
            onParseBrokerCsvText={handleParseBrokerCsvText}
            onClose={handleClose}
          />
        )}

        {/* Wizard Step 2: Verification & Preview Grid */}
        {step === 'preview' && previewData && (
          <CasPreviewStep
            previewData={previewData}
            members={members}
            accounts={accounts}
            relevantAccounts={relevantAccounts}
            importMemberId={importMemberId}
            importAccountId={importAccountId}
            activeTab={activeTab}
            equities={equities}
            selectedEquities={selectedEquities}
            equitiesSelectedValueCents={equitiesSelectedValueCents}
            equitiesTotalValueCents={equitiesTotalValueCents}
            mutualFunds={mutualFunds}
            selectedMutualFunds={selectedMutualFunds}
            mfSelectedValueCents={mfSelectedValueCents}
            mfTotalValueCents={mfTotalValueCents}
            mfFolioCountsByIsin={mfFolioCountsByIsin}
            transactions={transactions}
            selectedCount={selectedCount}
            selectedTransactionsCount={selectedTransactionsCount}
            isConfirmPending={confirmMutation.isPending}
            onMemberChange={(memberId, firstAccountId) => {
              setImportMemberId(memberId);
              setImportAccountId(firstAccountId);
            }}
            onAccountChange={setImportAccountId}
            onTabChange={setActiveTab}
            onToggleItem={handleToggleItem}
            onSelectAllEquities={handleSelectAllEquities}
            onSelectAllMutualFunds={handleSelectAllMutualFunds}
            onToggleTransaction={handleToggleTransaction}
            onSelectAllTransactions={handleSelectAllTransactions}
            onBack={() => setStep('upload')}
            onClose={handleClose}
            onConfirm={() => confirmMutation.mutate()}
          />
        )}

        {/* Wizard Step 3: Import Summary */}
        {step === 'summary' && importSummary && (
          <CasSummaryStep importSummary={importSummary} onClose={handleClose} />
        )}
      </div>
    </div>
  );
}
