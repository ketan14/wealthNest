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
  unitCost: number; // in dollars
  currentValue: number; // in dollars
  currency: string;
}

interface AddHoldingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: NewHoldingFormValues) => Promise<void>;
  isLoading?: boolean;
}

const FALLBACK_ASSET_CLASSES: AssetClassDefinition[] = [
  { id: 'equity', name: 'Equities & Stocks', colorHex: '#3b82f6', displayOrder: 1, description: '' },
  { id: 'fixed_income', name: 'Fixed Income & Bonds', colorHex: '#8b5cf6', displayOrder: 2, description: '' },
  { id: 'real_estate', name: 'Real Estate', colorHex: '#f59e0b', displayOrder: 3, description: '' },
  { id: 'crypto', name: 'Digital Assets & Crypto', colorHex: '#ec4899', displayOrder: 4, description: '' },
  { id: 'cash', name: 'Cash & Equivalents', colorHex: '#10b981', displayOrder: 5, description: '' },
  { id: 'commodity', name: 'Commodities', colorHex: '#eab308', displayOrder: 6, description: '' },
  { id: 'alternative', name: 'Alternative Assets', colorHex: '#6366f1', displayOrder: 7, description: '' },
];

export function AddHoldingModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: AddHoldingModalProps) {
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [assetClassId, setAssetClassId] = useState('equity');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [currency] = useState('USD');
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

  const assetClasses = dbAssetClasses && dbAssetClasses.length > 0 ? dbAssetClasses : FALLBACK_ASSET_CLASSES;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedQty = parseFloat(quantity);
    const parsedUnitCost = parseFloat(unitCost);
    const parsedCurrentValue = currentValue ? parseFloat(currentValue) : parsedQty * parsedUnitCost;

    if (!name.trim()) {
      setError('Please provide an asset name.');
      return;
    }

    if (isNaN(parsedQty) || parsedQty <= 0) {
      setError('Quantity must be a positive number.');
      return;
    }

    if (isNaN(parsedUnitCost) || parsedUnitCost < 0) {
      setError('Unit cost cannot be negative.');
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
      });

      // Reset form
      setName('');
      setTicker('');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Add New Holding</h3>
              <p className="text-xs text-muted-foreground">
                Register an asset position into your portfolio
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
                placeholder="e.g. Apple Inc. or Vanguard S&P 500"
                className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Ticker Symbol
              </label>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="AAPL"
                className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm uppercase font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Asset Class <span className="text-destructive">*</span>
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Quantity <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="10"
                className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Unit Cost (USD) <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                value={unitCost}
                onChange={(e) => handleUnitCostChange(e.target.value)}
                placeholder="150.00"
                className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Current Total Value
              </label>
              <input
                type="number"
                step="any"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                placeholder="1750.00"
                className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-xs text-muted-foreground space-y-1">
            <p>
              💡 <span className="text-foreground font-medium">Integer Precision:</span> Values will
              be stored as exact integer cents (<code className="text-primary font-mono">bigint</code>
              ) to prevent floating-point calculation drift.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/80">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isLoading} className="gap-2">
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Holding
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
