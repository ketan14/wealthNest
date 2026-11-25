import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AssetClassDefinition,
  HoldingOwnerShareInput,
  RecordVisibility,
  validateOwnershipShares,
} from '@wealthnest/domain';
import { ListAssetClassesUseCase } from '@wealthnest/application';
import { useAssetClassRepository } from '@/lib/persistence/repository-context';
import { Button } from '@/components/ui/Button';
import { ResponsiveModalShell } from '@/components/ui/ResponsiveModalShell';
import { X, Plus, AlertCircle, Loader2, Users, Briefcase } from 'lucide-react';
import { useFamily } from '@/lib/family/family-context';
import { useHousehold } from '@/lib/supabase/household-context';
import { usePreferences } from '@/lib/preferences/preferences-context';
import { VisibilityControl } from '@/components/household/VisibilityControl';
import { JointOwnershipEditor } from '@/components/household/JointOwnershipEditor';
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
  visibility?: RecordVisibility;
  ownerShares?: HoldingOwnerShareInput[];
  restrictedGranteeUserIds?: string[];
}

interface AddHoldingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: NewHoldingFormValues) => Promise<void>;
  isLoading?: boolean;
  defaultAssetClassId?: string;
}

export function AddHoldingModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  defaultAssetClassId = 'equity',
}: AddHoldingModalProps) {
  const { members, accounts, selectedMemberId, selectedAccountId } = useFamily();
  const { canEditFinancials } = useHousehold();
  const { currencySymbol } = usePreferences();

  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [isin, setIsin] = useState('');
  const [dematAccountId, setDematAccountId] = useState('');
  const [folioNumber, setFolioNumber] = useState('');
  const [amcName, setAmcName] = useState('');
  const [schemePlan, setSchemePlan] = useState('Direct - Growth');
  const [costBasisVerified, setCostBasisVerified] = useState(true);
  const [assetClassId, setAssetClassId] = useState(defaultAssetClassId);
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [currency] = useState('INR');
  const [visibility, setVisibility] = useState<RecordVisibility>('household_shared');
  const [restrictedGranteeUserIds, setRestrictedGranteeUserIds] = useState<string[]>([]);
  const [isJointOwnership, setIsJointOwnership] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAssetClassId(defaultAssetClassId);
    }
  }, [isOpen, defaultAssetClassId]);

  // Entity & Demat Account state
  const [holdingMemberId, setHoldingMemberId] = useState<string>(() => {
    return selectedMemberId !== 'all' ? selectedMemberId : members[0]?.id || 'mem-self';
  });
  const [holdingAccountId, setHoldingAccountId] = useState<string>(() => {
    return selectedAccountId !== 'all' ? selectedAccountId : '';
  });
  const [ownerShares, setOwnerShares] = useState<HoldingOwnerShareInput[]>(() => [
    {
      familyMemberId:
        selectedMemberId !== 'all' ? selectedMemberId : members[0]?.id || 'mem-self',
      ownershipShare: 100,
      isPrimaryOwner: true,
    },
  ]);

  useEffect(() => {
    const fallbackMember =
      selectedMemberId !== 'all' ? selectedMemberId : members[0]?.id || 'mem-self';
    setHoldingMemberId(fallbackMember);
    setOwnerShares((prev) =>
      prev.length <= 1
        ? [{ familyMemberId: fallbackMember, ownershipShare: 100, isPrimaryOwner: true }]
        : prev
    );
    if (selectedAccountId !== 'all') {
      setHoldingAccountId(selectedAccountId);
    }
  }, [members, selectedMemberId, selectedAccountId]);

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

    if (!canEditFinancials) {
      setError('Viewers have read-only access and cannot add holdings.');
      return;
    }

    const effectiveShares: HoldingOwnerShareInput[] =
      isJointOwnership && ownerShares.length > 0
        ? ownerShares
        : holdingMemberId
          ? [{ familyMemberId: holdingMemberId, ownershipShare: 100, isPrimaryOwner: true }]
          : [];

    if (effectiveShares.length > 0) {
      const shareCheck = validateOwnershipShares(
        effectiveShares.map((s) => ({
          familyMemberId: s.familyMemberId,
          sharePercentage: s.ownershipShare,
        }))
      );
      if (!shareCheck.valid) {
        setError(shareCheck.error || 'Ownership shares must total 100%.');
        return;
      }
    }

    const primaryOwner =
      effectiveShares.find((s) => s.isPrimaryOwner)?.familyMemberId ||
      effectiveShares[0]?.familyMemberId ||
      holdingMemberId;

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
        memberId: primaryOwner || undefined,
        accountId: holdingAccountId || undefined,
        visibility,
        ownerShares: effectiveShares.length > 0 ? effectiveShares : undefined,
        restrictedGranteeUserIds:
          visibility === 'restricted' ? restrictedGranteeUserIds : undefined,
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
      setAssetClassId(defaultAssetClassId);
      setQuantity('');
      setUnitCost('');
      setCurrentValue('');
      setVisibility('household_shared');
      setRestrictedGranteeUserIds([]);
      setIsJointOwnership(false);
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
    <ResponsiveModalShell
      variant="sheet"
      role="dialog"
      ariaLabelledBy="add-holding-modal-title"
      backdropClassName="bg-black/70"
      panelClassName="max-w-lg bg-card border-border"
      onDismiss={onClose}
      formProps={{ onSubmit: handleSubmit }}
      header={
        <div className="flex items-center justify-between gap-2 px-4 py-3.5 sm:px-6 sm:py-4 border-b border-border/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Plus className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 id="add-holding-modal-title" className="text-base font-semibold text-foreground">
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
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      }
      bodyClassName="space-y-4 p-4 sm:p-6"
      footer={
        <div className="flex items-center justify-end gap-3 px-4 py-3 sm:px-6 border-t border-border/80 bg-card">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isLoading || !canEditFinancials} className="gap-2">
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save Position
          </Button>
        </div>
      }
    >
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
          <div className="space-y-3 p-3 rounded-xl bg-secondary/20 border border-border/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  Primary Legal Entity / Member
                </label>
                <select
                  value={holdingMemberId}
                  onChange={(e) => {
                    const nextMemberId = e.target.value;
                    setHoldingMemberId(nextMemberId);
                    const firstAcc = accounts.find((a) => a.memberId === nextMemberId);
                    setHoldingAccountId(firstAcc?.id || '');
                    if (!isJointOwnership) {
                      setOwnerShares([
                        { familyMemberId: nextMemberId, ownershipShare: 100, isPrimaryOwner: true },
                      ]);
                    }
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

            {members.length > 1 && (
              <div className="pt-1 border-t border-border/40 space-y-2">
                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isJointOwnership}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setIsJointOwnership(next);
                      if (!next && holdingMemberId) {
                        setOwnerShares([
                          {
                            familyMemberId: holdingMemberId,
                            ownershipShare: 100,
                            isPrimaryOwner: true,
                          },
                        ]);
                      }
                    }}
                    className="rounded border-border accent-primary"
                  />
                  <span>Configure Joint Ownership Split (exact % summing to 100%)</span>
                </label>

                {isJointOwnership && (
                  <JointOwnershipEditor
                    mode="holding"
                    members={members}
                    shares={ownerShares}
                    onChange={setOwnerShares}
                    disabled={!canEditFinancials}
                  />
                )}
              </div>
            )}
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
                inputMode="decimal"
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
                inputMode="decimal"
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
                inputMode="decimal"
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

          <VisibilityControl
            visibility={visibility}
            onChange={setVisibility}
            granteeUserIds={restrictedGranteeUserIds}
            onGranteeUserIdsChange={setRestrictedGranteeUserIds}
            disabled={!canEditFinancials}
            compact
          />

          <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-xs text-muted-foreground space-y-1">
            <p>
              💡 <span className="text-foreground font-medium">India First Integer Precision:</span>{' '}
              Values are stored in exact integer paise (
              <code className="text-primary font-mono">bigint</code>) to eliminate floating-point
              calculation drift.
            </p>
          </div>
    </ResponsiveModalShell>
  );
}
