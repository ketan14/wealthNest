import React, { useState, useEffect } from 'react';
import { HoldingDetailDto } from '@wealthnest/application';
import { Button } from '@/components/ui/Button';
import { usePreferences } from '@/lib/preferences/preferences-context';
import { X, AlertCircle } from 'lucide-react';

export interface UpdateHoldingFormValues {
  holdingId: string;
  quantity: number;
  unitCost: number; // in rupees
  currentValue: number; // in rupees
  valuationDate?: string;
  notes?: string;
}

interface EditHoldingModalProps {
  isOpen: boolean;
  holding: HoldingDetailDto | null;
  onClose: () => void;
  onSubmit: (values: UpdateHoldingFormValues) => Promise<void>;
  isLoading?: boolean;
}

export function EditHoldingModal({
  isOpen,
  holding,
  onClose,
  onSubmit,
  isLoading = false,
}: EditHoldingModalProps) {
  const { currencySymbol, preferences } = usePreferences();
  const locale = preferences.numberFormat || 'en-IN';

  const [quantity, setQuantity] = useState<string>('1');
  const [unitCost, setUnitCost] = useState<string>('0');
  const [currentValue, setCurrentValue] = useState<string>('0');
  const [valuationDate, setValuationDate] = useState<string>(
    new Date().toISOString().split('T')[0]!
  );
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const isRealEstate = holding?.assetClassId === 'real_estate';
  const isCommodityOrAlt =
    holding?.assetClassId === 'gold' ||
    holding?.assetClassId === 'alternative' ||
    holding?.assetClassId === 'fixed_income';
  const isAppraisalAsset = isRealEstate || isCommodityOrAlt;

  useEffect(() => {
    if (holding) {
      setQuantity(holding.quantity.toString());
      setUnitCost((holding.unitCostCents / 100).toString());
      setCurrentValue((holding.currentValueCents / 100).toString());
      setValuationDate(new Date().toISOString().split('T')[0]!);
      setNotes('');
      setError(null);
    }
  }, [holding, isOpen]);

  if (!isOpen || !holding) return null;

  const parsedQty = parseFloat(quantity) || 0;
  const parsedUnitCost = parseFloat(unitCost) || 0;
  const parsedCurrentVal = parseFloat(currentValue) || 0;

  const totalCost = parsedQty * parsedUnitCost;
  const gainLoss = parsedCurrentVal - totalCost;
  const returnPct = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;
  const isGain = gainLoss >= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (parsedQty <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }

    if (parsedUnitCost < 0 || parsedCurrentVal < 0) {
      setError('Valuation and cost amounts cannot be negative.');
      return;
    }

    try {
      await onSubmit({
        holdingId: holding.holdingId,
        quantity: parsedQty,
        unitCost: parsedUnitCost,
        currentValue: parsedCurrentVal,
        valuationDate,
        notes,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update holding valuation.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">
                {isAppraisalAsset ? 'Update Appraisal Valuation' : 'Edit Holding & Valuation'}
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary border border-primary/20">
                {holding.assetClassName || holding.assetClassId}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
              {holding.name} {holding.ticker ? `(${holding.ticker})` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {/* Real Estate / Appraisal Asset Special Card */}
          {isAppraisalAsset && (
            <div className="p-3.5 rounded-xl bg-accent/40 border border-border/80 text-xs space-y-2">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Original Purchase Cost:</span>
                <span className="font-mono font-semibold text-foreground">
                  {currencySymbol}
                  {totalCost.toLocaleString(locale, { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Appraised Gain / Loss:</span>
                <span
                  className={`font-mono font-bold ${isGain ? 'text-emerald-400' : 'text-rose-400'}`}
                >
                  {isGain ? '+' : '-'}
                  {currencySymbol}
                  {Math.abs(gainLoss).toLocaleString(locale, { maximumFractionDigits: 2 })} (
                  {isGain ? '+' : ''}
                  {returnPct.toFixed(2)}%)
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Quantity */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                {isRealEstate ? 'Units / Sq. Ft.' : 'Quantity / Units'}{' '}
                <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                required
                min="0.000001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Unit Purchase Cost */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Unit Purchase Cost ({currencySymbol}) <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                required
                min="0"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Current Total Appraised Market Value */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              {isAppraisalAsset
                ? `New Appraised Property / Market Valuation (${currencySymbol})`
                : `Total Current Market Value (${currencySymbol})`}{' '}
              <span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              required
              min="0"
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              placeholder="e.g. 8500000"
              className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm font-mono font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {isAppraisalAsset && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Enter the updated fair market value or latest circle rate appraisal.
              </p>
            )}
          </div>

          {/* Appraisal Date & Audit Note */}
          {isAppraisalAsset && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Valuation / As-of Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={valuationDate}
                    onChange={(e) => setValuationDate(e.target.value)}
                    className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Valuation Source / Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Oct 2026 Registry Appraisal"
                  className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/80">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading}
              className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            >
              {isLoading ? 'Updating...' : 'Save Updated Valuation'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
