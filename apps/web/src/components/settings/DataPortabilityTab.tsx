import type { ChangeEvent, MouseEvent, RefObject } from 'react';
import { ParsedBackupPreview } from '@wealthnest/application';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileJson,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';

interface DataPortabilityTabProps {
  readonly exportSuccessMessage: string | null;
  readonly isExporting: boolean;
  readonly onFullBackupExport: () => void;
  readonly onExportCsv: (entity: 'holdings' | 'transactions' | 'liabilities' | 'goals') => void;
  readonly fileInputRef: RefObject<HTMLInputElement>;
  readonly onBackupFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  readonly onNativeBackupOpen: (e: MouseEvent) => void;
  readonly restoreError: string | null;
  readonly backupPreview: ParsedBackupPreview | null;
  readonly formatAmount: (cents: number | bigint) => string;
  readonly onExecuteRestore: () => void;
  readonly isRestoring: boolean;
  readonly restoreSuccess: boolean;
}

/**
 * Renders the Data Portability & Backup tab in Settings: JSON/CSV export and backup validation/restore.
 */
export function DataPortabilityTab({
  exportSuccessMessage,
  isExporting,
  onFullBackupExport,
  onExportCsv,
  fileInputRef,
  onBackupFileUpload,
  onNativeBackupOpen,
  restoreError,
  backupPreview,
  formatAmount,
  onExecuteRestore,
  isRestoring,
  restoreSuccess,
}: DataPortabilityTabProps) {
  return (
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
                onClick={onFullBackupExport}
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
                  onClick={() => onExportCsv('holdings')}
                  disabled={isExporting}
                  className="border-slate-800 hover:bg-slate-800 text-xs text-slate-200 justify-start"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 mr-2" />
                  Holdings & Valuations (.csv)
                </Button>

                <Button
                  variant="outline"
                  onClick={() => onExportCsv('transactions')}
                  disabled={isExporting}
                  className="border-slate-800 hover:bg-slate-800 text-xs text-slate-200 justify-start"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400 mr-2" />
                  Transactions Log (.csv)
                </Button>

                <Button
                  variant="outline"
                  onClick={() => onExportCsv('liabilities')}
                  disabled={isExporting}
                  className="border-slate-800 hover:bg-slate-800 text-xs text-slate-200 justify-start"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400 mr-2" />
                  Loans & EMIs (.csv)
                </Button>

                <Button
                  variant="outline"
                  onClick={() => onExportCsv('goals')}
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
                onChange={onBackupFileUpload}
                className="hidden"
                id="backup-file-input"
              />
              <label
                htmlFor="backup-file-input"
                onClick={onNativeBackupOpen}
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
                  onClick={onExecuteRestore}
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
  );
}
