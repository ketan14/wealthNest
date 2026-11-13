import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AssetClassDefinition } from '@wealthnest/domain';
import { ListAssetClassesUseCase } from '@wealthnest/application';
import { useAssetClassRepository } from '@/lib/persistence/repository-context';
import { Button } from '@/components/ui/Button';
import { X, Plus, AlertCircle, Loader2, Users, Briefcase } from 'lucide-react';
import { useFamily } from '@/lib/family/family-context';
import { usePreferences } from '@/lib/preferences/preferences-context';
import { FALLBACK_ASSET_CLASSES, HoldingMetadataFields } from './HoldingMetadataFields';

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
  memberId?: string;
  accountId?: string;
}

interface AddHoldingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: NewHoldingFormValues) => Promise<void>;
  isLoading?: boolean;
}

export function AddHoldingModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: AddHoldingModalProps) {
  const { members, accounts, selectedMemberId, selectedAccountId } = useFamily();
  const { currencySymbol } = usePreferences();

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

  // Entity & Demat Account state
  const [holdingMemberId, setHoldingMemberId] = useState<string>(() => {
    return selectedMemberId !== 'all' ? selectedMemberId : members[0]?.id || 'mem-self';
  });
  const [holdingAccountId, setHoldingAccountId] = useState<string>(() => {
    return selectedAccountId !== 'all' ? selectedAccountId : '';
  });

  useEffect(() => {
    if (selectedMemberId !== 'all') {
      setHoldingMemberId(selectedMemberId);
    }
    if (selectedAccountId !== 'all') {
      setHoldingAccountId(selectedAccountId);
    }
  }, [selectedMemberId, selectedAccountId]);

  const relevantAccounts = useMemo(() => {
    return accounts.filter((a) => a.memberId === holdingMemberId);
  }, [accounts, holdingMemberId]);

  const assetClassRepo = useAssetClassRepository();

  // Fetch asset classes from database adapter
  const { data: dbAssetClasses } = useQuery<AssetClassDefinition[]>({
    queryKey: ['asset-classes'],
    queryFn: async () => {
      const useCase = new ListAssetClassesUseCase(assetClassRepo);
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
        memberId: holdingMemberId || undefined,
        accountId: holdingAccountId || undefined,
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

          {/* Legal Entity & Demat Account Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-secondary/20 border border-border/50">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                Legal Entity / Member
              </label>
              <select
                value={holdingMemberId}
                onChange={(e) => {
                  setHoldingMemberId(e.target.value);
                  const firstAcc = accounts.find((a) => a.memberId === e.target.value);
                  setHoldingAccountId(firstAcc?.id || '');
                }}
                className="w-full h-8 rounded-lg bg-secondary/50 border border-border px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id} className="bg-slate-900 text-foreground">
                    {m.name} ({m.relationship.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                Demat / Broker / Folio
              </label>
              <select
                value={holdingAccountId}
                onChange={(e) => setHoldingAccountId(e.target.value)}
                className="w-full h-8 rounded-lg bg-secondary/50 border border-border px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="" className="bg-slate-900 text-foreground">
                  -- None / General --
                </option>
                {relevantAccounts.map((a) => (
                  <option key={a.id} value={a.id} className="bg-slate-900 text-foreground">
                    {a.brokerName}: {a.accountName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <HoldingMetadataFields
            isMutualFund={isMutualFund}
            isEquity={isEquity}
            name={name}
            onNameChange={setName}
            ticker={ticker}
            onTickerChange={setTicker}
            isin={isin}
            onIsinChange={setIsin}
            amcName={amcName}
            onAmcNameChange={setAmcName}
            folioNumber={folioNumber}
            onFolioNumberChange={setFolioNumber}
            schemePlan={schemePlan}
            onSchemePlanChange={setSchemePlan}
            dematAccountId={dematAccountId}
            onDematAccountIdChange={setDematAccountId}
          />

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
                {isMutualFund
                  ? `Purchase NAV (${currencySymbol})`
                  : isEquity
                    ? `Buy Price (${currencySymbol})`
                    : `Unit Cost (${currencySymbol})`}{' '}
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
                Current Total Value ({currencySymbol})
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
