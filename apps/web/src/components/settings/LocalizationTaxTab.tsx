import { CurrencyCode } from '@wealthnest/domain';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Globe, Sliders } from 'lucide-react';

interface LocalizationPreferences {
  readonly defaultCurrency: CurrencyCode;
  readonly numberFormat: 'en-IN' | 'en-US';
  readonly fiscalYearStart: '04-01' | '01-01';
  readonly taxRegime: 'new' | 'old';
}

interface LocalizationTaxTabProps {
  readonly preferences: LocalizationPreferences;
  readonly onUpdatePreferences: (partial: Partial<LocalizationPreferences>) => void;
  readonly formatAmount: (cents: bigint, options?: { compact?: boolean }) => string;
  readonly onResetPreferences: () => void;
}

/**
 * Renders the Localization & Tax Standards tab in Settings with live Indian/US formatting preview.
 */
export function LocalizationTaxTab({
  preferences,
  onUpdatePreferences,
  formatAmount,
  onResetPreferences,
}: LocalizationTaxTabProps) {
  return (
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
                      onClick={() =>
                        onUpdatePreferences({ defaultCurrency: curr.code as CurrencyCode })
                      }
                      className={`p-3 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-500/10 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-lg font-bold text-white mb-0.5">
                        {curr.symbol} {curr.code}
                      </div>
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
                  onClick={() => onUpdatePreferences({ numberFormat: 'en-IN' })}
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
                  onClick={() => onUpdatePreferences({ numberFormat: 'en-US' })}
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
                  onClick={() => onUpdatePreferences({ fiscalYearStart: '04-01' })}
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
                  onClick={() => onUpdatePreferences({ fiscalYearStart: '01-01' })}
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
                  onClick={() => onUpdatePreferences({ taxRegime: 'new' })}
                  className={`p-3.5 rounded-lg border text-left transition-all ${
                    preferences.taxRegime === 'new'
                      ? 'border-indigo-500 bg-indigo-500/10 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-white text-sm">
                      New Regime (Sec 115BAC)
                    </span>
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
                  onClick={() => onUpdatePreferences({ taxRegime: 'old' })}
                  className={`p-3.5 rounded-lg border text-left transition-all ${
                    preferences.taxRegime === 'old'
                      ? 'border-indigo-500 bg-indigo-500/10 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold text-white text-sm mb-1">Old Regime</div>
                  <div className="text-xs text-slate-400">
                    Supports 80C (PPF/ELSS up to ₹1.5L), 80D (health insurance), home loan interest
                    (Sec 24b).
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
                onClick={onResetPreferences}
                className="w-full border-slate-800 hover:bg-slate-800 text-xs text-slate-400"
              >
                Reset to India-First Defaults
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

