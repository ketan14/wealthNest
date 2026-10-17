import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ParseCasPdfUseCase,
  ConfirmCasImportUseCase,
  ImportCasItemDto,
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
} from 'lucide-react';

interface ImportCasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
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

  const [step, setStep] = useState<'upload' | 'preview' | 'summary'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<CasPreviewDto | null>(null);
  const [items, setItems] = useState<ImportCasItemDto[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummaryResult | null>(null);

  // Reset state
  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setPassword('');
    setError(null);
    setPreviewData(null);
    setItems([]);
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

      const res = await useCase.execute(arrayBuffer, password || undefined);
      if (!res.success) throw res.error;
      return res.value;
    },
    onSuccess: (data) => {
      setPreviewData(data);
      setItems([...data.items]);
      setStep('preview');
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
        setStep('preview');
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
        });

        if (!res.success) throw res.error;
        return res.value;
      } else {
        // Demo Mode: Mock summary
        const selectedCount = items.filter((i) => i.selected).length;
        const mockSummary: ImportSummaryResult = {
          batchId: `demo-batch-${Date.now()}`,
          total: items.length,
          imported: selectedCount,
          updated: 0,
          skipped: items.length - selectedCount,
          failed: 0,
        };
        return mockSummary;
      }
    },
    onSuccess: (summary) => {
      setImportSummary(summary);
      setStep('summary');
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['portfolio-summary', user.id] });
      }
      if (onSuccess) onSuccess();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Import failed');
    },
  });

  // Toggle selection
  const handleToggleSelect = (index: number) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleSelectAll = (select: boolean) => {
    setItems((prev) => prev.map((item) => ({ ...item, selected: select })));
  };

  const selectedCount = items.filter((i) => i.selected).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
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
                <p className="font-semibold text-foreground">Zero-Knowledge Client-Side Extraction</p>
                <p className="text-[11px] leading-relaxed mt-0.5">
                  Your PDF and password are processed strictly in-memory inside your local browser
                  environment. They are never sent to third-party services, logged, or saved to disk.
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
                  {file ? <FileText className="w-5 h-5 text-primary" /> : <Upload className="w-5 h-5" />}
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
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-primary" />
                Document Password (if encrypted)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="e.g. ABCDE1234F01011990 (PAN + DOB DDMMYYYY)"
                  className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 pr-10 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Tip: CDSL & NSDL PDFs are typically protected with your 10-digit PAN in uppercase + Date of Birth (DDMMYYYY).
              </p>
            </div>

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
                  ₹{(previewData.totalReportedValueCents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {previewData.warnings.length > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-400 space-y-1">
                {previewData.warnings.map((w, i) => (
                  <p key={i}>⚠️ {w}</p>
                ))}
              </div>
            )}

            {/* Select controls */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Found <span className="text-foreground font-semibold">{items.length}</span> holdings (
                <span className="text-primary font-semibold">{selectedCount}</span> selected)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  className="text-primary hover:underline"
                >
                  Select All
                </button>
                <span className="text-muted-foreground">•</span>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Preview Table */}
            <div className="flex-1 overflow-y-auto border border-border/80 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-secondary/40 text-muted-foreground sticky top-0 backdrop-blur-sm">
                    <th className="py-2.5 px-3 w-10 text-center">Import</th>
                    <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Security / ISIN</th>
                    <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Asset Class</th>
                    <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-right">Units</th>
                    <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-right">Reported Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 font-mono">
                  {items.map((item, idx) => (
                    <tr
                      key={item.isin || idx}
                      className={`hover:bg-secondary/30 transition-colors ${
                        item.selected ? 'bg-secondary/15' : 'opacity-60'
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => handleToggleSelect(idx)}
                          className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <p className="font-semibold text-foreground text-xs">{item.name}</p>
                        <span className="font-mono text-[10px] text-muted-foreground">{item.isin}</span>
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <Badge variant="secondary" className="capitalize text-[10px]">
                          {item.assetClassId.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right text-foreground">
                        {item.quantity.toLocaleString('en-IN', { maximumFractionDigits: 4 })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-foreground">
                        ₹{(item.currentValueCents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border/80">
              <Button variant="ghost" size="sm" onClick={() => setStep('upload')} className="gap-1.5 text-xs">
                <RotateCcw className="w-3.5 h-3.5" />
                Back to Upload
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={selectedCount === 0 || confirmMutation.isPending}
                  onClick={() => confirmMutation.mutate()}
                  className="gap-2"
                >
                  {confirmMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm & Import ({selectedCount})
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Step 3: Import Summary */}
        {step === 'summary' && importSummary && (
          <div className="space-y-6 pt-6 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h4 className="text-lg font-bold text-foreground">CAS Import Completed Successfully!</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Your investment positions have been extracted, validated, and synchronized.
              </p>
            </div>

            {/* Summary statistics grid */}
            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-2xl font-bold font-mono text-emerald-400">
                  {importSummary.imported}
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">New Positions</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <span className="text-2xl font-bold font-mono text-blue-400">
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
