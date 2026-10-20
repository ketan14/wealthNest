import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AssetClassDefinition } from '@wealthnest/domain';
import { ListAssetClassesUseCase } from '@wealthnest/application';
import { SupabaseAssetClassAdapter } from '@/lib/supabase/asset-class.adapter';
import { Button } from '@/components/ui/Button';
import { X, Plus, AlertCircle, Loader2 } from 'lucide-react';

export interface NewHoldingFormValues {
  name: string;
  ticker?: string;
  assetClassId: string;
  quantity: number;
  unitCost: number; // in INR
  currentValue: number; // in INR
  currency: string;
  // Specific structured fields
  isin?: string;
  dematAccountId?: string;
  folioNumber?: string;
  amcName?: string;
  schemePlan?: string;
  costBasisVerified?: boolean;
}

interface AddHoldingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: NewHoldingFormValues) => Promise<void>;
  isLoading?: boolean;
}

const FALLBACK_ASSET_CLASSES: AssetClassDefinition[] = [
  {
    id: 'equity',
    name: 'Equities & Stocks',
    colorHex: '#3b82f6',
    displayOrder: 1,
    description: 'Listed shares and Demat equities',
  },
  {
    id: 'mutual_fund',
    name: 'Mutual Funds',
    colorHex: '#06b6d4',
    displayOrder: 2,
    description: 'Direct and regular mutual fund folios & SIPs',
  },
  {
    id: 'fixed_income',
    name: 'Fixed Income & Debt',
    colorHex: '#8b5cf6',
    displayOrder: 3,
    description: '',
  },
  {
    id: 'commodity',
    name: 'Gold & Precious Metals',
    colorHex: '#eab308',
    displayOrder: 4,
    description: '',
  },
  {
    id: 'real_estate',
    name: 'Real Estate & Land',
    colorHex: '#f59e0b',
    displayOrder: 5,
    description: '',
  },
  {
    id: 'cash',
    name: 'Cash & Liquid Savings',
    colorHex: '#10b981',
    displayOrder: 6,
    description: '',
  },
  {
    id: 'crypto',
    name: 'Digital Assets & Crypto',
    colorHex: '#ec4899',
    displayOrder: 7,
    description: '',
  },
  {
    id: 'alternative',
    name: 'Alternative & Startups',
    colorHex: '#6366f1',
    displayOrder: 8,
    description: '',
  },
];

export function AddHoldingModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: AddHoldingModalProps) {
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [isin, setIsin] = useState('');
  const [dematAccountId, setDematAccountId] = useState('');
  const [folioNumber, setFolioNumber] = useState('');
  const [amcName, setAmcName] = useState('');
  const [schemePlan, setSchemePlan] = useState('Direct - Growth');
  const [costBasisVerified, setCostBasisVerified] = useState(true);
  const [assetClassId, setAssetClassId] = useState('equity');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [currency] = useState('INR');
  const [error, setError] = useState<string | null>(null);

  // Fetch asset classes from database adapter
  const { data: dbAssetClasses } = useQuery<AssetClassDefinition[]>({
    queryKey: ['asset-classes'],
    queryFn: async () => {
      const adapter = new SupabaseAssetClassAdapter();
      const useCase = new ListAssetClassesUseCase(adapter);
      const res = await useCase.execute();
      return res.success ? res.value : FALLBACK_ASSET_CLASSES;
    },
  });

  const assetClasses =
    dbAssetClasses && dbAssetClasses.length > 0 ? dbAssetClasses : FALLBACK_ASSET_CLASSES;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedQty = parseFloat(quantity);
    const parsedUnitCost = parseFloat(unitCost);
    const parsedCurrentValue = currentValue ? parseFloat(currentValue) : parsedQty * parsedUnitCost;

    if (!name.trim()) {
      setError(
        assetClassId === 'mutual_fund'
          ? 'Please provide the mutual fund scheme name.'
          : 'Please provide an asset/security name.'
      );
      return;
    }

    if (isNaN(parsedQty) || parsedQty <= 0) {
      setError(
        assetClassId === 'mutual_fund'
          ? 'Units must be a positive number.'
          : 'Quantity must be a positive number.'
      );
      return;
    }

    if (isNaN(parsedUnitCost) || parsedUnitCost < 0) {
      setError(
        assetClassId === 'mutual_fund'
          ? 'NAV/cost per unit cannot be negative.'
          : 'Unit cost cannot be negative.'
      );
      return;
    }

    if (isNaN(parsedCurrentValue) || parsedCurrentValue < 0) {
      setError('Current value cannot be negative.');
      return;
    }

    try {
      await onSubmit({
        name: name.trim(),
        ticker: ticker.trim() ? ticker.trim().toUpperCase() : undefined,
        assetClassId,
        quantity: parsedQty,
        unitCost: parsedUnitCost,
        currentValue: parsedCurrentValue,
        currency,
        isin: isin.trim() ? isin.trim().toUpperCase() : undefined,
        dematAccountId:
          assetClassId === 'equity' && dematAccountId.trim() ? dematAccountId.trim() : undefined,
        folioNumber:
          assetClassId === 'mutual_fund' && folioNumber.trim() ? folioNumber.trim() : undefined,
        amcName: assetClassId === 'mutual_fund' && amcName.trim() ? amcName.trim() : undefined,
        schemePlan:
          assetClassId === 'mutual_fund' && schemePlan.trim() ? schemePlan.trim() : undefined,
        costBasisVerified: assetClassId === 'mutual_fund' ? costBasisVerified : true,
      });

      // Reset form
      setName('');
      setTicker('');
      setIsin('');
      setDematAccountId('');
      setFolioNumber('');
      setAmcName('');
      setSchemePlan('Direct - Growth');
      setCostBasisVerified(true);
      setAssetClassId('equity');
      setQuantity('');
      setUnitCost('');
      setCurrentValue('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add holding');
    }
  };

  // Auto-calculate suggested current value if not manually overridden
  const handleUnitCostChange = (val: string) => {
    setUnitCost(val);
    const q = parseFloat(quantity);
    const u = parseFloat(val);
    if (!isNaN(q) && !isNaN(u) && !currentValue) {
      setCurrentValue((q * u).toFixed(2));
    }
  };

  const isEquity = assetClassId === 'equity';
  const isMutualFund = assetClassId === 'mutual_fund';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {isEquity
                  ? 'Add Direct Equity / Stock'
                  : isMutualFund
                    ? 'Add Mutual Fund Folio'
                    : 'Add New Holding'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isEquity
                  ? 'Register a listed stock or exchange-traded position'
                  : isMutualFund
                    ? 'Register a mutual fund folio with AMC & scheme details'
                    : 'Register an asset position into your portfolio'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/15 text-destructive border border-destructive/30 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Asset Class Selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Investment Class <span className="text-destructive">*</span>
            </label>
            <select
              value={assetClassId}
              onChange={(e) => setAssetClassId(e.target.value)}
              className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {assetClasses.map((ac) => (
                <option key={ac.id} value={ac.id} className="bg-slate-900 text-foreground">
                  {ac.name}
                </option>
              ))}
            </select>
          </div>

          {/* Conditional Fields: Mutual Fund vs Equity vs Other */}
          {isMutualFund ? (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Scheme / Fund Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Bandhan Large & Mid Cap Fund"
                  className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    AMC Name
                  </label>
                  <input
                    type="text"
                    value={amcName}
                    onChange={(e) => setAmcName(e.target.value)}
                    placeholder="e.g. Bandhan Mutual Fund"
                    className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Folio Number
                  </label>
                  <input
                    type="text"
                    value={folioNumber}
                    onChange={(e) => setFolioNumber(e.target.value)}
                    placeholder="e.g. 209928335/70"
                    className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Plan / Option
                  </label>
                  <select
                    value={schemePlan}
                    onChange={(e) => setSchemePlan(e.target.value)}
                    className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="Direct - Growth">Direct - Growth</option>
                    <option value="Direct - IDCW">Direct - IDCW</option>
                    <option value="Regular - Growth">Regular - Growth</option>
                    <option value="Regular - IDCW">Regular - IDCW</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    ISIN
                  </label>
                  <input
                    type="text"
                    value={isin}
                    onChange={(e) => setIsin(e.target.value)}
                    placeholder="INF194K01V89"
                    className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm uppercase font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </>
          ) : isEquity ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Company / Security Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Reliance Industries Limited"
                    className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    NSE/BSE Ticker
                  </label>
                  <input
                    type="text"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value)}
                    placeholder="RELIANCE"
                    className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm uppercase font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    ISIN
                  </label>
                  <input
                    type="text"
                    value={isin}
                    onChange={(e) => setIsin(e.target.value)}
                    placeholder="INE002A01018"
                    className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm uppercase font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Demat Account ID / DP
                  </label>
                  <input
                    type="text"
                    value={dematAccountId}
                    onChange={(e) => setDematAccountId(e.target.value)}
                    placeholder="e.g. 1208160000000000"
                    className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Asset Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sovereign Gold Bond, PPF, Real Estate"
                  className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Ticker / Code
                </label>
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  placeholder="CODE"
                  className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm uppercase font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          )}

          {/* Quantities & Pricing */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                {isMutualFund ? 'Units Held' : isEquity ? 'Number of Shares' : 'Quantity'}{' '}
                <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={isMutualFund ? '150.250' : '10'}
                className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                {isMutualFund ? 'Purchase NAV (₹)' : isEquity ? 'Buy Price (₹)' : 'Unit Cost (₹)'}{' '}
                <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                value={unitCost}
                onChange={(e) => handleUnitCostChange(e.target.value)}
                placeholder="2500.00"
                className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Current Total Value (₹)
              </label>
              <input
                type="number"
                step="any"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                placeholder="28000.00"
                className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {isMutualFund && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="costBasisVerified"
                checked={costBasisVerified}
                onChange={(e) => setCostBasisVerified(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
              />
              <label
                htmlFor="costBasisVerified"
                className="text-xs text-muted-foreground cursor-pointer"
              >
                Cost basis is verified from statement or transaction history
              </label>
            </div>
          )}

          <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-xs text-muted-foreground space-y-1">
            <p>
              💡 <span className="text-foreground font-medium">India First Integer Precision:</span>{' '}
              Values are stored in exact integer paise (
              <code className="text-primary font-mono">bigint</code>) to eliminate floating-point
              calculation drift.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/80">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isLoading} className="gap-2">
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Position
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
