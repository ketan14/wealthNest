import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LoanType,
  InterestType,
  LiabilityStatus,
  LiabilityPartyShareInput,
  RecordVisibility,
  validateOwnershipShares,
} from '@wealthnest/domain';
import {
  LiabilityDto,
  CreateLiabilityParams,
  UpdateLiabilityParams,
} from '@wealthnest/application';
import { useHoldingRepository } from '@/lib/persistence/repository-context';
import { useFamily } from '@/lib/family/family-context';
import { useHousehold } from '@/lib/supabase/household-context';
import { usePreferences } from '@/lib/preferences/preferences-context';
import { VisibilityControl } from '@/components/household/VisibilityControl';
import { JointOwnershipEditor } from '@/components/household/JointOwnershipEditor';
import { Button } from '@/components/ui/Button';
import { ResponsiveModalShell } from '@/components/ui/ResponsiveModalShell';
import { X, Landmark, AlertCircle, Building2, User } from 'lucide-react';
import { LiabilityPrincipalInterestSection } from './LiabilityPrincipalInterestSection';

interface AddLiabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (params: CreateLiabilityParams | UpdateLiabilityParams) => Promise<void>;
  userId: string;
  liabilityToEdit?: LiabilityDto | null;
}

const LOAN_TYPES: { value: LoanType; label: string; description: string }[] = [
  {
    value: 'home_loan',
    label: 'Home Loan',
    description: 'Mortgage for primary residence, apartment, or plot',
  },
  { value: 'vehicle_loan', label: 'Vehicle / Auto Loan', description: 'Car or two-wheeler loan' },
  { value: 'personal_loan', label: 'Personal Loan', description: 'Unsecured bank loan' },
  { value: 'education_loan', label: 'Education Loan', description: 'Higher education financing' },
  { value: 'gold_loan', label: 'Gold Loan', description: 'Loan secured against gold assets' },
  {
    value: 'business_loan',
    label: 'Business / MSME Loan',
    description: 'Commercial or enterprise credit',
  },
  { value: 'credit_card', label: 'Credit Card Debt', description: 'Revolving credit card balance' },
  { value: 'other', label: 'Other Debt', description: 'Informal loan or custom obligation' },
];

export function AddLiabilityModal({
  isOpen,
  onClose,
  onSave,
  userId,
  liabilityToEdit,
}: AddLiabilityModalProps) {
  const isEditing = Boolean(liabilityToEdit);

  const { members, selectedMemberId } = useFamily();
  const { activeHouseholdId, canEditFinancials } = useHousehold();
  const { currencySymbol } = usePreferences();
  const [memberId, setMemberId] = useState<string>('mem-self');
  const [parties, setParties] = useState<LiabilityPartyShareInput[]>([
    { familyMemberId: 'mem-self', partyRole: 'primary_borrower', liabilityShare: 100 },
  ]);
  const [isJointBorrowers, setIsJointBorrowers] = useState(false);
  const [visibility, setVisibility] = useState<RecordVisibility>('household_shared');
  const [restrictedGranteeUserIds, setRestrictedGranteeUserIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [loanType, setLoanType] = useState<LoanType>('home_loan');
  const [lender, setLender] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [originalPrincipalStr, setOriginalPrincipalStr] = useState('');
  const [currentBalanceStr, setCurrentBalanceStr] = useState('');
  const [interestRateStr, setInterestRateStr] = useState('8.50');
  const [interestType, setInterestType] = useState<InterestType>('floating');
  const [tenureMonthsStr, setTenureMonthsStr] = useState('');
  const [emiAmountStr, setEmiAmountStr] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<LiabilityStatus>('active');
  const [linkedAssetId, setLinkedAssetId] = useState<string>('');
  const [notes, setNotes] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const holdingRepo = useHoldingRepository();

  const scopeId = activeHouseholdId || userId;

  // Query household assets to allow linking collateral (especially Real Estate)
  const { data: userHoldings } = useQuery({
    queryKey: ['holdings-details', scopeId],
    queryFn: async () => {
      const res = await (holdingRepo.listDetailsByHousehold
        ? holdingRepo.listDetailsByHousehold(scopeId)
        : holdingRepo.listDetailsByUser(scopeId));
      return res.success ? res.value : [];
    },
    enabled: isOpen && Boolean(scopeId),
  });

  useEffect(() => {
    if (liabilityToEdit) {
      setName(liabilityToEdit.name);
      setLoanType(liabilityToEdit.loanType);
      setLender(liabilityToEdit.lender);
      setAccountNumber(liabilityToEdit.accountNumber || '');
      setOriginalPrincipalStr((Number(liabilityToEdit.originalPrincipalCents) / 100).toString());
      setCurrentBalanceStr((Number(liabilityToEdit.currentBalanceCents) / 100).toString());
      setInterestRateStr(liabilityToEdit.interestRate.toString());
      setInterestType(liabilityToEdit.interestType);
      setTenureMonthsStr(liabilityToEdit.tenureMonths?.toString() || '');
      setEmiAmountStr(
        liabilityToEdit.emiAmountCents > 0n
          ? (Number(liabilityToEdit.emiAmountCents) / 100).toString()
          : ''
      );
      setStartDate(liabilityToEdit.startDate || '');
      setEndDate(liabilityToEdit.endDate || '');
      setStatus(liabilityToEdit.status);
      setLinkedAssetId(liabilityToEdit.linkedAssetId || '');
      const editPrimaryId = liabilityToEdit.memberId || members[0]?.id || 'mem-self';
      setMemberId(editPrimaryId);
      setVisibility(liabilityToEdit.visibility || 'household_shared');
      setRestrictedGranteeUserIds([]);
      if (liabilityToEdit.parties && liabilityToEdit.parties.length > 0) {
        setParties([...liabilityToEdit.parties]);
        setIsJointBorrowers(liabilityToEdit.parties.length > 1);
      } else {
        setParties([
          { familyMemberId: editPrimaryId, partyRole: 'primary_borrower', liabilityShare: 100 },
        ]);
        setIsJointBorrowers(false);
      }
      setNotes(liabilityToEdit.notes || '');
    } else {
      const defaultMemberId =
        selectedMemberId && selectedMemberId !== 'all'
          ? selectedMemberId
          : members[0]?.id || 'mem-self';
      setName('');
      setLoanType('home_loan');
      setLender('');
      setAccountNumber('');
      setOriginalPrincipalStr('');
      setCurrentBalanceStr('');
      setInterestRateStr('8.50');
      setInterestType('floating');
      setTenureMonthsStr('240');
      setEmiAmountStr('');
      setStartDate(new Date().toISOString().split('T')[0]!);
      setEndDate('');
      setStatus('active');
      setLinkedAssetId('');
      setMemberId(defaultMemberId);
      setParties([
        { familyMemberId: defaultMemberId, partyRole: 'primary_borrower', liabilityShare: 100 },
      ]);
      setIsJointBorrowers(false);
      setVisibility('household_shared');
      setRestrictedGranteeUserIds([]);
      setNotes('');
    }
    setErrorMsg(null);
  }, [liabilityToEdit, isOpen, members, selectedMemberId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!canEditFinancials) {
      setErrorMsg('Viewers have read-only access and cannot create or edit liabilities.');
      return;
    }

    const origPrincipal = parseFloat(originalPrincipalStr);
    if (!name.trim()) {
      setErrorMsg('Please enter a loan or liability title.');
      return;
    }
    if (!lender.trim()) {
      setErrorMsg('Please enter the lender/bank name (e.g. HDFC Bank, SBI).');
      return;
    }
    if (isNaN(origPrincipal) || origPrincipal <= 0) {
      setErrorMsg('Please enter a valid original principal amount greater than 0.');
      return;
    }

    if (currentBalanceStr.trim() !== '') {
      const parsedCurrentBalance = parseFloat(currentBalanceStr);
      if (isNaN(parsedCurrentBalance) || parsedCurrentBalance < 0) {
        setErrorMsg('Please enter a valid current outstanding balance (0 or greater).');
        return;
      }
    }

    const interestRate = parseFloat(interestRateStr);
    if (isNaN(interestRate) || interestRate < 0) {
      setErrorMsg('Please enter a valid interest rate (e.g. 8.5 for 8.50%).');
      return;
    }

    const effectiveParties: LiabilityPartyShareInput[] =
      isJointBorrowers && parties.length > 0
        ? parties
        : memberId
          ? [{ familyMemberId: memberId, partyRole: 'primary_borrower', liabilityShare: 100 }]
          : [];

    if (effectiveParties.length > 0) {
      const shareCheck = validateOwnershipShares(
        effectiveParties.map((p) => ({
          familyMemberId: p.familyMemberId,
          sharePercentage: p.liabilityShare,
        }))
      );
      if (!shareCheck.valid) {
        setErrorMsg(shareCheck.error || 'Borrower shares must total 100%.');
        return;
      }
    }

    const resolvedPrimaryMemberId =
      effectiveParties.find((p) => p.partyRole === 'primary_borrower')?.familyMemberId ||
      effectiveParties[0]?.familyMemberId ||
      memberId;
    const resolvedCoBorrowers = effectiveParties
      .filter((p) => p.familyMemberId !== resolvedPrimaryMemberId)
      .map((p) => p.familyMemberId);

    const emiAmount = emiAmountStr ? parseFloat(emiAmountStr) : 0;
    const currentBalance =
      currentBalanceStr.trim() !== '' ? parseFloat(currentBalanceStr) : origPrincipal;
    const tenureMonths = tenureMonthsStr ? parseInt(tenureMonthsStr, 10) : undefined;

    setIsSubmitting(true);
    try {
      if (isEditing && liabilityToEdit) {
        await onSave({
          id: liabilityToEdit.id,
          userId,
          householdId: activeHouseholdId,
          visibility,
          name: name.trim(),
          loanType,
          lender: lender.trim(),
          accountNumber: accountNumber.trim() || undefined,
          originalPrincipalCents: BigInt(Math.round(origPrincipal * 100)),
          currentBalanceCents:
            currentBalanceStr.trim() !== ''
              ? BigInt(Math.round(currentBalance * 100))
              : undefined,
          interestRate,
          interestType,
          tenureMonths,
          emiAmountCents: BigInt(Math.round(emiAmount * 100)),
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          status,
          linkedAssetId: linkedAssetId || null,
          memberId: resolvedPrimaryMemberId || undefined,
          coBorrowerMemberIds: resolvedCoBorrowers.length > 0 ? resolvedCoBorrowers : undefined,
          parties: effectiveParties.length > 0 ? effectiveParties : undefined,
          notes: notes.trim() || undefined,
        } as UpdateLiabilityParams);
      } else {
        await onSave({
          userId,
          householdId: activeHouseholdId,
          visibility,
          name: name.trim(),
          loanType,
          lender: lender.trim(),
          accountNumber: accountNumber.trim() || undefined,
          originalPrincipalCents: BigInt(Math.round(origPrincipal * 100)),
          initialBalanceCents: BigInt(Math.round(currentBalance * 100)),
          interestRate,
          interestType,
          tenureMonths,
          emiAmountCents: BigInt(Math.round(emiAmount * 100)),
          currency: 'INR',
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          status,
          linkedAssetId: linkedAssetId || undefined,
          memberId: resolvedPrimaryMemberId || undefined,
          coBorrowerMemberIds: resolvedCoBorrowers.length > 0 ? resolvedCoBorrowers : undefined,
          parties: effectiveParties.length > 0 ? effectiveParties : undefined,
          restrictedGranteeUserIds:
            visibility === 'restricted' ? restrictedGranteeUserIds : undefined,
          notes: notes.trim() || undefined,
        } as CreateLiabilityParams);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save loan. Please check inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveModalShell
      variant="sheet"
      role="dialog"
      ariaLabelledBy="add-liability-title"
      backdropClassName="bg-black/70"
      panelClassName="max-w-2xl bg-card border-border"
      onDismiss={onClose}
      formProps={{ onSubmit: handleSubmit }}
      header={
        <div className="flex items-center justify-between gap-2 px-4 py-3.5 sm:px-6 sm:py-4 md:px-8 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="add-liability-title" className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                {isEditing ? 'Edit Loan / Liability' : 'Add New Loan / Liability'}
              </h2>
              <p className="text-xs text-muted-foreground">
                Track mortgages, vehicle loans, and personal debts integrated with your Net Worth
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      }
      bodyClassName="p-4 sm:p-6 md:p-8 space-y-6"
      footer={
        <div className="flex items-center justify-end gap-3 px-4 py-3 sm:px-6 md:px-8 border-t border-border bg-card">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !canEditFinancials} className="min-w-[120px]">
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Loan'}
          </Button>
        </div>
      }
    >
      {errorMsg && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="space-y-6">
        {/* Primary Borrower & Joint Borrowers */}
          <div className="space-y-3 p-4 rounded-xl border border-border/80 bg-accent/10">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                Primary Borrower
              </label>
              <select
                value={memberId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setMemberId(nextId);
                  if (!isJointBorrowers) {
                    setParties([
                      { familyMemberId: nextId, partyRole: 'primary_borrower', liabilityShare: 100 },
                    ]);
                  }
                }}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.relationship.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {members.length > 1 && (
              <div className="pt-2 border-t border-border/40 space-y-2">
                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isJointBorrowers}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setIsJointBorrowers(next);
                      if (!next && memberId) {
                        setParties([
                          {
                            familyMemberId: memberId,
                            partyRole: 'primary_borrower',
                            liabilityShare: 100,
                          },
                        ]);
                      }
                    }}
                    className="rounded border-border accent-primary"
                  />
                  <span>Configure Joint Borrowers / Guarantors &amp; Share Split</span>
                </label>

                {isJointBorrowers && (
                  <JointOwnershipEditor
                    mode="liability"
                    members={members}
                    shares={parties}
                    onChange={setParties}
                    disabled={!canEditFinancials}
                  />
                )}
              </div>
            )}
          </div>

          {/* Loan Title & Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Loan Title <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. HDFC Home Loan - Vejalpur Apt"
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Loan Category <span className="text-destructive">*</span>
              </label>
              <select
                value={loanType}
                onChange={(e) => setLoanType(e.target.value as LoanType)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              >
                {LOAN_TYPES.map((lt) => (
                  <option key={lt.value} value={lt.value}>
                    {lt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Lender & Account Number */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Lender / Bank <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                required
                value={lender}
                onChange={(e) => setLender(e.target.value)}
                placeholder="e.g. HDFC Bank, SBI, ICICI"
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Loan Account No. (Optional)
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="e.g. 6049281923"
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors font-mono"
              />
            </div>
          </div>

          <LiabilityPrincipalInterestSection
            currencySymbol={currencySymbol}
            isEditing={isEditing}
            originalPrincipalStr={originalPrincipalStr}
            onOriginalPrincipalChange={setOriginalPrincipalStr}
            currentBalanceStr={currentBalanceStr}
            onCurrentBalanceChange={setCurrentBalanceStr}
            interestRateStr={interestRateStr}
            onInterestRateChange={setInterestRateStr}
            interestType={interestType}
            onInterestTypeChange={setInterestType}
            emiAmountStr={emiAmountStr}
            onEmiAmountChange={setEmiAmountStr}
          />

          {/* Linked Property / Collateral Asset */}
          <div className="p-4 rounded-xl bg-accent/40 border border-border/80 space-y-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-400" />
              <label className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Linked Collateral / Secured Property
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Link this loan to a property (e.g. apartment or land) to calculate Property Equity and
              Loan-to-Value (LTV) ratio. Multiple loans can be linked to the same property.
            </p>
            <select
              value={linkedAssetId}
              onChange={(e) => setLinkedAssetId(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors mt-1"
            >
              <option value="">-- No Linked Asset (Unsecured / General Debt) --</option>
              {(userHoldings || []).map((h) => (
                <option key={h.assetId} value={h.assetId}>
                  {h.name} ({h.assetClassName})
                </option>
              ))}
            </select>
          </div>

          {/* Dates & Tenure */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Start / Sanction Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Tenure (Months)
              </label>
              <input
                type="number"
                value={tenureMonthsStr}
                onChange={(e) => setTenureMonthsStr(e.target.value)}
                placeholder="e.g. 240 (20 Years)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Loan Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LiabilityStatus)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              >
                <option value="active">Active (Ongoing EMI)</option>
                <option value="closed">Closed / Fully Paid</option>
                <option value="refinanced">Refinanced</option>
                <option value="defaulted">Defaulted</option>
              </select>
            </div>
          </div>

          <VisibilityControl
            visibility={visibility}
            onChange={setVisibility}
            granteeUserIds={restrictedGranteeUserIds}
            onGranteeUserIdsChange={setRestrictedGranteeUserIds}
            disabled={!canEditFinancials}
            compact
          />

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Notes / Prepayment terms
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Floating rate reset every quarter, zero penalty on part-prepayment."
              className="w-full px-3.5 py-2 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors resize-none"
            />
          </div>
      </div>
    </ResponsiveModalShell>
  );
}
