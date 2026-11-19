import { useState } from 'react';
import { CurrencyCode } from '@wealthnest/domain';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { EditSettingModal } from '@/components/settings/EditSettingModal';
import { Globe, Pencil, Sliders } from 'lucide-react';

interface LocalizationPreferences {
  readonly defaultCurrency: CurrencyCode;
  readonly numberFormat: 'en-IN' | 'en-US';
  readonly fiscalYearStart: '04-01' | '01-01';
  readonly taxRegime: 'new' | 'old';
}

interface LocalizationTaxTabProps {
  readonly preferences: LocalizationPreferences;
  readonly onUpdatePreferences: (partial: Partial<LocalizationPreferences>) => Promise<void> | void;
  readonly formatAmount: (cents: bigint, options?: { compact?: boolean }) => string;
  readonly onResetPreferences: () => Promise<void> | void;
}

type EditingLocalizationField =
  | 'defaultCurrency'
  | 'numberFormat'
  | 'fiscalYearStart'
  | 'taxRegime'
  | null;

const CURRENCY_LABELS: Partial<Record<CurrencyCode, string>> = {
  INR: '₹ INR — Indian Rupee',
  USD: '$ USD — US Dollar',
  EUR: '€ EUR — Euro',
  GBP: '£ GBP — British Pound',
  CAD: 'C$ CAD — Canadian Dollar',
  AUD: 'A$ AUD — Australian Dollar',
  JPY: '¥ JPY — Japanese Yen',
  CHF: 'CHF — Swiss Franc',
};

const NUMBER_FORMAT_LABELS: Record<'en-IN' | 'en-US', string> = {
  'en-IN': 'Indian System (en-IN)',
  'en-US': 'International System (en-US)',
};

const FISCAL_YEAR_LABELS: Record<'04-01' | '01-01', string> = {
  '04-01': 'Indian Fiscal Year (Apr 1 - Mar 31)',
  '01-01': 'Calendar Year (Jan 1 - Dec 31)',
};

const TAX_REGIME_LABELS: Record<'new' | 'old', string> = {
  new: 'New Regime (Sec 115BAC)',
  old: 'Old Regime (Sec 80C / 80D / 24b)',
};

/**
 * Compact Localization & Tax Standards tab:
 * - Clean read-first rows with Pencil edit triggers opening EditSettingModal (select).
 * - Preserves live formatting preview and one-click reset.
 */
export function LocalizationTaxTab({
  preferences,
  onUpdatePreferences,
  formatAmount,
  onResetPreferences,
}: LocalizationTaxTabProps) {
  const { showToast } = useToast();
  const [editingField, setEditingField] = useState<EditingLocalizationField>(null);

  const modalConfig = (() => {
    switch (editingField) {
      case 'defaultCurrency':
        return {
          title: 'Edit Default Base Currency',
          label: 'Base Currency',
          initialValue: preferences.defaultCurrency,
          options: [
            { value: 'INR', label: '₹ INR — Indian Rupee' },
            { value: 'USD', label: '$ USD — US Dollar' },
            { value: 'EUR', label: '€ EUR — Euro' },
            { value: 'GBP', label: '£ GBP — British Pound' },
          ],
          onSave: async (val: string) => {
            await onUpdatePreferences({ defaultCurrency: val as CurrencyCode });
            showToast(`Base currency set to ${val}`, 'success');
          },
        };
      case 'numberFormat':
        return {
          title: 'Edit System of Numeration',
          label: 'Number Format',
          initialValue: preferences.numberFormat,
          options: [
            { value: 'en-IN', label: 'Indian System (en-IN)', hint: 'Lakhs & Crores' },
            { value: 'en-US', label: 'International System (en-US)', hint: 'Millions & Billions' },
          ],
          onSave: async (val: string) => {
            await onUpdatePreferences({ numberFormat: val as 'en-IN' | 'en-US' });
            showToast(`Numeration set to ${val}`, 'success');
          },
        };
      case 'fiscalYearStart':
        return {
          title: 'Edit Financial Year Cycle',
          label: 'Fiscal Year',
          initialValue: preferences.fiscalYearStart,
          options: [
            { value: '04-01', label: 'Indian Fiscal Year (Apr 1 - Mar 31)' },
            { value: '01-01', label: 'Calendar Year (Jan 1 - Dec 31)' },
          ],
          onSave: async (val: string) => {
            await onUpdatePreferences({ fiscalYearStart: val as '04-01' | '01-01' });
            showToast('Fiscal year cycle updated', 'success');
          },
        };
      case 'taxRegime':
        return {
          title: 'Edit Income Tax Regime',
          label: 'Tax Regime',
          initialValue: preferences.taxRegime,
          options: [
            { value: 'new', label: 'New Regime (Sec 115BAC)', hint: 'Recommended' },
            { value: 'old', label: 'Old Regime', hint: '80C / 80D / 24b' },
          ],
          onSave: async (val: string) => {
            await onUpdatePreferences({ taxRegime: val as 'new' | 'old' });
            showToast(`Tax regime updated`, 'success');
          },
        };
      default:
        return null;
    }
  })();

  const rows: {
    id: Exclude<EditingLocalizationField, null>;
    label: string;
    value: string;
    hint?: string;
  }[] = [
    {
      id: 'defaultCurrency',
      label: 'Default Base Currency',
      value: CURRENCY_LABELS[preferences.defaultCurrency] || preferences.defaultCurrency,
    },
    {
      id: 'numberFormat',
      label: 'System of Numeration',
      value: NUMBER_FORMAT_LABELS[preferences.numberFormat],
      hint: preferences.numberFormat === 'en-IN' ? '2,2,3 Lakhs & Crores' : '3,3,3 Millions',
    },
    {
      id: 'fiscalYearStart',
      label: 'Financial Year Cycle',
      value: FISCAL_YEAR_LABELS[preferences.fiscalYearStart],
    },
    {
      id: 'taxRegime',
      label: 'Income Tax Regime',
      value: TAX_REGIME_LABELS[preferences.taxRegime],
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-400" />
              Currency &amp; Regional Standards
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 divide-y divide-slate-800/80">
            {rows.map((row) => (
              <div
                key={row.id}
                className="py-2.5 first:pt-1 last:pb-0 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wider font-medium text-slate-400">
                    {row.label}
                  </div>
                  <div className="text-sm font-medium text-white truncate mt-0.5">
                    {row.value}
                    {row.hint && (
                      <span className="text-xs font-normal text-slate-400 ml-2">({row.hint})</span>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingField(row.id)}
                  aria-label={`Edit ${row.label}`}
                  title={`Edit ${row.label}`}
                  className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Compact Live Format Preview */}
      <div>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              Live Formatting Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-2.5">
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">Portfolio Valuation (Full)</span>
              <span className="text-sm font-bold text-white font-mono">
                {formatAmount(2450000000n)}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">Portfolio Valuation (Compact)</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                {formatAmount(2450000000n, { compact: true })}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">Monthly SIP Contribution</span>
              <span className="text-sm font-semibold text-white font-mono">
                {formatAmount(5000000n)}
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                await onResetPreferences();
                showToast('Reset to India-First defaults', 'info');
              }}
              className="w-full h-8 border-slate-800 hover:bg-slate-800 text-xs text-slate-400 mt-1"
            >
              Reset to India-First Defaults
            </Button>
          </CardContent>
        </Card>
      </div>

      {modalConfig && (
        <EditSettingModal
          isOpen={Boolean(editingField)}
          title={modalConfig.title}
          label={modalConfig.label}
          type="select"
          initialValue={modalConfig.initialValue}
          options={modalConfig.options}
          onClose={() => setEditingField(null)}
          onSave={modalConfig.onSave}
        />
      )}
    </div>
  );
}
