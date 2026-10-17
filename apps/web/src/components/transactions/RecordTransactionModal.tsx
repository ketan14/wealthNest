import React, { useState } from 'react';
import { TransactionType } from '@wealthnest/domain';
import { Button } from '@/components/ui/Button';
import { X, Plus, AlertCircle, Loader2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export interface NewTransactionFormValues {
  type: TransactionType;
  assetId?: string;
  assetName?: string;
  assetTicker?: string;
  quantity?: number;
  amount: number; // in rupees
  currency: string;
  transactionDate: string;
  notes?: string;
}

interface RecordTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: NewTransactionFormValues) => Promise<void>;
  isLoading?: boolean;
  availableAssets?: Array<{ id: string; name: string; ticker?: string }>;
}

const TRANSACTION_TYPES: Array<{
  id: TransactionType;
  label: string;
  category: 'inflow' | 'outflow';
  description: string;
}> = [
  { id: 'deposit', label: 'Deposit (Inflow)', category: 'inflow', description: 'Salary savings, fund injection' },
  { id: 'buy', label: 'Buy Asset (Outflow)', category: 'outflow', description: 'Stock, ETF, SGB purchase' },
  { id: 'sell', label: 'Sell Asset (Inflow)', category: 'inflow', description: 'Liquidation, profit booking' },
  { id: 'dividend', label: 'Dividend / Interest (Inflow)', category: 'inflow', description: 'Stock dividend, SGB/FD interest' },
  { id: 'withdrawal', label: 'Withdrawal (Outflow)', category: 'outflow', description: 'Personal draw, large expense' },
  { id: 'fee', label: 'Charges & Taxes (Outflow)', category: 'outflow', description: 'Brokerage, STT, GST, AMC fee' },
];

export function RecordTransactionModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  availableAssets = [],
}: RecordTransactionModalProps) {
  const [type, setType] = useState<TransactionType>('buy');
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [customAssetName, setCustomAssetName] = useState('');
  const [customAssetTicker, setCustomAssetTicker] = useState('');
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    const parsedQuantity = quantity ? parseFloat(quantity) : undefined;

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Transaction amount must be a positive number.');
      return;
    }

    if (parsedQuantity !== undefined && (isNaN(parsedQuantity) || parsedQuantity <= 0)) {
      setError('Quantity must be greater than zero when specified.');
      return;
    }

    const matchedAsset = availableAssets.find((a) => a.id === selectedAssetId);
    const resolvedName = matchedAsset?.name || customAssetName.trim() || undefined;
    const resolvedTicker = matchedAsset?.ticker || (customAssetTicker.trim() ? customAssetTicker.trim().toUpperCase() : undefined);

    try {
      await onSubmit({
        type,
        assetId: selectedAssetId || undefined,
        assetName: resolvedName,
        assetTicker: resolvedTicker,
        amount: parsedAmount,
        quantity: parsedQuantity,
        currency: 'INR',
        transactionDate: new Date(transactionDate || Date.now()).toISOString(),
        notes: notes.trim() || undefined,
      });

      // Reset form
      setType('buy');
      setSelectedAssetId('');
      setCustomAssetName('');
      setCustomAssetTicker('');
      setAmount('');
      setQuantity('');
      setNotes('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record transaction');
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
              <h3 className="text-base font-semibold text-foreground">Record Transaction</h3>
              <p className="text-xs text-muted-foreground">
                Audit cashflow inflows, outflows, trades, and payouts
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

          {/* Transaction Type Selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              Transaction Type <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TRANSACTION_TYPES.map((t) => {
                const isSelected = type === t.id;
                const isInflow = t.category === 'inflow';
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setType(t.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      isSelected
                        ? isInflow
                          ? 'border-emerald-500 bg-emerald-500/15 text-foreground shadow-sm'
                          : 'border-rose-500 bg-rose-500/15 text-foreground shadow-sm'
                        : 'border-border/60 bg-secondary/30 text-muted-foreground hover:border-border hover:bg-secondary/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {isInflow ? (
                        <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      <span className="text-xs font-semibold truncate text-foreground">{t.label.split(' ')[0]}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{t.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Asset Selection (for Buy/Sell/Dividend) */}
          {(type === 'buy' || type === 'sell' || type === 'dividend') && (
            <div className="space-y-2 p-3 rounded-lg bg-secondary/20 border border-border/50">
              <label className="text-xs font-medium text-muted-foreground block">
                Associated Asset (Optional)
              </label>
              {availableAssets.length > 0 && (
                <select
                  value={selectedAssetId}
                  onChange={(e) => {
                    setSelectedAssetId(e.target.value);
                    if (e.target.value) {
                      setCustomAssetName('');
                      setCustomAssetTicker('');
                    }
                  }}
                  className="w-full h-8 rounded-lg bg-secondary/50 border border-border px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Select from your holdings or enter custom below --</option>
                  {availableAssets.map((asset) => (
                    <option key={asset.id} value={asset.id} className="bg-slate-900 text-foreground">
                      {asset.name} {asset.ticker ? `(${asset.ticker})` : ''}
                    </option>
                  ))}
                </select>
              )}

              {!selectedAssetId && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={customAssetName}
                      onChange={(e) => setCustomAssetName(e.target.value)}
                      placeholder="Asset Name (e.g. Reliance, TCS, SGB)"
                      className="w-full h-8 rounded-lg bg-secondary/50 border border-border px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={customAssetTicker}
                      onChange={(e) => setCustomAssetTicker(e.target.value)}
                      placeholder="Ticker (RELIANCE)"
                      className="w-full h-8 rounded-lg bg-secondary/50 border border-border px-3 text-xs uppercase font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Amount and Quantity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Amount (INR ₹) <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="25000.00"
                className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Quantity {type === 'buy' || type === 'sell' ? '(Units / Shares)' : '(Optional)'}
              </label>
              <input
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="10"
                className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Date and Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Transaction Date <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                required
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Notes / Audit Description
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Monthly SIP auto-debit, quarterly dividend payout"
                className="w-full h-9 rounded-lg bg-secondary/50 border border-border px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-xs text-muted-foreground space-y-1">
            <p>
              💡 <span className="text-foreground font-medium">Audit Integrity:</span> Transactions are
              stored in exact integer paise (<code className="text-primary font-mono">bigint</code>) to ensure audit trail precision.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/80">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isLoading} className="gap-2">
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Transaction
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
