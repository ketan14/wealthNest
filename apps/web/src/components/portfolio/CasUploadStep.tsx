import { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  ShieldCheck,
  Upload,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  SANITIZED_ZERODHA_HOLDINGS_CSV,
  SANITIZED_ZERODHA_TRADEBOOK_CSV,
  SANITIZED_GROWW_HOLDINGS_CSV,
  SANITIZED_GROWW_ORDERS_CSV,
} from '@/components/portfolio/cas-import-fixtures';

interface CasUploadStepProps {
  importSource: 'cas_pdf' | 'zerodha_csv' | 'groww_csv';
  file: File | null;
  password: string;
  error: string | null;
  isParsing: boolean;
  onSelectSource: (source: 'cas_pdf' | 'zerodha_csv' | 'groww_csv') => void;
  onFileChange: (file: File | null) => void;
  onPasswordChange: (password: string) => void;
  onClearError: () => void;
  onParse: () => void;
  onLoadSampleFixture: (type: 'CDSL' | 'NSDL' | 'CAMS_KFIN') => void;
  onParseBrokerCsvText: (csvContent: string, preferredBroker?: 'ZERODHA' | 'GROWW') => void;
  onClose: () => void;
}

export function CasUploadStep({
  importSource,
  file,
  password,
  error,
  isParsing,
  onSelectSource,
  onFileChange,
  onPasswordChange,
  onClearError,
  onParse,
  onLoadSampleFixture,
  onParseBrokerCsvText,
  onClose,
}: CasUploadStepProps) {
  const [showPassword, setShowPassword] = useState(false);

  const isPasswordError = Boolean(error && error.toLowerCase().includes('password'));
  const hasLowercase = Boolean(password && password !== password.toUpperCase());

  return (
    <div className="space-y-4 pt-4 overflow-y-auto">
      {error && (
        <div className="p-3 rounded-lg bg-destructive/15 text-destructive border border-destructive/30 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Import Source Selector */}
      <div className="flex items-center gap-2 p-1 bg-secondary/50 rounded-xl border border-border/80">
        <button
          type="button"
          onClick={() => onSelectSource('cas_pdf')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
            importSource === 'cas_pdf'
              ? 'bg-card text-foreground shadow border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-primary" />
          <span>CAS Statement (PDF)</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectSource('zerodha_csv')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
            importSource === 'zerodha_csv'
              ? 'bg-card text-foreground shadow border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
          <span>Zerodha Kite (CSV)</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectSource('groww_csv')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
            importSource === 'groww_csv'
              ? 'bg-card text-foreground shadow border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
          <span>Groww (CSV)</span>
        </button>
      </div>

      {/* Privacy Guarantee Banner */}
      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-muted-foreground flex items-start gap-2.5">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-foreground">Zero-Knowledge Client-Side Extraction</p>
          <p className="text-[11px] leading-relaxed mt-0.5">
            Your files (PDF or CSV) and data are parsed strictly in-memory inside your local browser
            environment. They are never sent to third-party tracking services or logged.
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
          accept={importSource === 'cas_pdf' ? '.pdf' : '.csv,text/csv'}
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              onFileChange(e.target.files[0]);
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
                {importSource === 'cas_pdf'
                  ? 'Click to choose or drag-and-drop your CAS PDF'
                  : importSource === 'zerodha_csv'
                    ? 'Click to choose or drag-and-drop your Zerodha Holdings or Tradebook CSV'
                    : 'Click to choose or drag-and-drop your Groww Holdings or Orders CSV'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {importSource === 'cas_pdf'
                  ? 'Supports NSDL, CDSL, and CAMS / KFintech Consolidated Account Statements (up to 25 MB)'
                  : importSource === 'zerodha_csv'
                    ? 'Supports Kite Holdings CSV (holdings.csv) and Console Tradebook CSV (tradebook.csv)'
                    : 'Supports Groww Holdings CSV (Holdings.csv) and Orders History CSV (Orders.csv)'}
              </p>
            </div>
          )}
        </label>
      </div>

      {/* Password Input or Plain Text Notice */}
      {importSource === 'cas_pdf' ? (
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
                onClick={() => onPasswordChange(password.toUpperCase())}
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
                onPasswordChange(e.target.value);
                if (error) onClearError();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && file && !isParsing) {
                  e.preventDefault();
                  onParse();
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
            <span className="font-semibold text-foreground">10-digit PAN in UPPERCASE</span> +{' '}
            <span className="font-semibold text-foreground">Date of Birth (DDMMYYYY)</span>.
          </p>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-200">No Document Password Required</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Broker CSV files exported from Zerodha Kite Console or Groww are unencrypted plain
              text. They will be parsed completely client-side in your browser.
            </p>
          </div>
        </div>
      )}

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
            onClick={() => onLoadSampleFixture('CDSL')}
            className="text-xs font-mono gap-1.5 h-8"
          >
            Load Sample CDSL CAS (Reliance, Nifty BeES, SGB)
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onLoadSampleFixture('NSDL')}
            className="text-xs font-mono gap-1.5 h-8"
          >
            Load Sample NSDL CAS (TCS, HDFC Bank)
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onLoadSampleFixture('CAMS_KFIN')}
            className="text-xs font-mono gap-1.5 h-8 border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-300"
          >
            Load Sample CAMS / KFintech CAS (Bandhan, DSP, Nippon MF)
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onParseBrokerCsvText(SANITIZED_ZERODHA_HOLDINGS_CSV, 'ZERODHA')}
            className="text-xs font-mono gap-1.5 h-8 border-blue-500/30 hover:bg-blue-500/10 text-blue-300"
          >
            Load Sample Zerodha Holdings CSV (Reliance, TCS, Gold BeES)
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onParseBrokerCsvText(SANITIZED_ZERODHA_TRADEBOOK_CSV, 'ZERODHA')}
            className="text-xs font-mono gap-1.5 h-8 border-blue-500/30 hover:bg-blue-500/10 text-blue-300"
          >
            Load Sample Zerodha Tradebook CSV (Buy/Sell Executions)
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onParseBrokerCsvText(SANITIZED_GROWW_HOLDINGS_CSV, 'GROWW')}
            className="text-xs font-mono gap-1.5 h-8 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-300"
          >
            Load Sample Groww Holdings CSV (Equities & PPFAS Mutual Fund)
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onParseBrokerCsvText(SANITIZED_GROWW_ORDERS_CSV, 'GROWW')}
            className="text-xs font-mono gap-1.5 h-8 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-300"
          >
            Load Sample Groww Orders CSV (Orders History)
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/80">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" disabled={!file || isParsing} onClick={onParse} className="gap-2">
          {isParsing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Parse Statement
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

