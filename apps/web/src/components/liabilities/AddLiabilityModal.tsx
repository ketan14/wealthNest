import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoanType, InterestType, LiabilityStatus } from '@wealthnest/domain';
import {
  LiabilityDto,
  CreateLiabilityParams,
  UpdateLiabilityParams,
} from '@wealthnest/application';
import { useHoldingRepository } from '@/lib/persistence/repository-context';
import { useFamily } from '@/lib/family/family-context';
import { Button } from '@/components/ui/Button';
import { X, Landmark, AlertCircle, Building2, User, Users } from 'lucide-react';

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
  const [memberId, setMemberId] = useState<string>('mem-self');
  const [coBorrowerMemberIds, setCoBorrowerMemberIds] = useState<string[]>([]);
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

  // Query user assets to allow linking collateral (especially Real Estate)
  const { data: userHoldings } = useQuery({
    queryKey: ['holdings-details', userId],
    queryFn: async () => {
      const res = await holdingRepo.listDetailsByUser(userId);
      return res.success ? res.value : [];
    },
    enabled: isOpen && Boolean(userId),
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
      setLinkedAssetId(liabilityToEdit.linkedAssetId || '');
      setMemberId(liabilityToEdit.memberId || 'mem-self');
      setCoBorrowerMemberIds(
        liabilityToEdit.coBorrowerMemberIds ? [...liabilityToEdit.coBorrowerMemberIds] : []
      );
      setNotes(liabilityToEdit.notes || '');
    } else {
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
      setMemberId(
        selectedMemberId && selectedMemberId !== 'all' ? selectedMemberId : 'mem-self'
      );
      setCoBorrowerMemberIds([]);
      setNotes('');
    }
    setErrorMsg(null);
  }, [liabilityToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

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

    const interestRate = parseFloat(interestRateStr);
    if (isNaN(interestRate) || interestRate < 0) {
      setErrorMsg('Please enter a valid interest rate (e.g. 8.5 for 8.50%).');
      return;
    }

    const emiAmount = emiAmountStr ? parseFloat(emiAmountStr) : 0;
    const currentBalance = currentBalanceStr ? parseFloat(currentBalanceStr) : origPrincipal;
    const tenureMonths = tenureMonthsStr ? parseInt(tenureMonthsStr, 10) : undefined;

    setIsSubmitting(true);
    try {
      if (isEditing && liabilityToEdit) {
        await onSave({
          id: liabilityToEdit.id,
          userId,
          name: name.trim(),
          loanType,
          lender: lender.trim(),
          accountNumber: accountNumber.trim() || undefined,
          interestRate,
          interestType,
          tenureMonths,
          emiAmountCents: BigInt(Math.round(emiAmount * 100)),
          status,
          linkedAssetId: linkedAssetId || null,
          memberId: memberId || undefined,
          coBorrowerMemberIds: coBorrowerMemberIds.length > 0 ? coBorrowerMemberIds : undefined,
          notes: notes.trim() || undefined,
        } as UpdateLiabilityParams);
      } else {
        await onSave({
          userId,
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
          memberId: memberId || undefined,
          coBorrowerMemberIds: coBorrowerMemberIds.length > 0 ? coBorrowerMemberIds : undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                {isEditing ? 'Edit Loan / Liability' : 'Add New Loan / Liability'}
              </h2>
              <p className="text-xs text-muted-foreground">
                Track mortgages, vehicle loans, and personal debts integrated with your Net Worth
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Primary Borrower & Co-Borrowers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-border/80 bg-accent/10">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                Primary Borrower
              </label>
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.relationship.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" />
                Joint Co-Borrowers (Optional)
              </label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {members
                  .filter((m) => m.id !== memberId)
                  .map((m) => {
                    const isCoBorrower = coBorrowerMemberIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          if (isCoBorrower) {
                            setCoBorrowerMemberIds((prev) => prev.filter((id) => id !== m.id));
                          } else {
                            setCoBorrowerMemberIds((prev) => [...prev, m.id]);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                          isCoBorrower
                            ? 'bg-primary/10 border-primary text-primary font-semibold'
                            : 'bg-background border-border/60 text-muted-foreground hover:border-border'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.colorHex }} />
                        {m.name}
                      </button>
                    );
                  })}
              </div>
            </div>
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

          {/* Principal & Current Balance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Original Sanctioned Principal (₹) <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                disabled={isEditing}
                value={originalPrincipalStr}
                onChange={(e) => setOriginalPrincipalStr(e.target.value)}
                placeholder="e.g. 5000000 (50 Lakhs)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors font-mono disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                {isEditing
                  ? 'Original principal cannot be changed after creation.'
                  : 'The original amount sanctioned by the bank.'}
              </p>
            </div>

            {!isEditing && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Current Outstanding Principal (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  value={currentBalanceStr}
                  onChange={(e) => setCurrentBalanceStr(e.target.value)}
                  placeholder="Defaults to original principal if new"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors font-mono"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Leave blank if starting at full original principal.
                </p>
              </div>
            )}
          </div>

          {/* Interest Rate & Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Interest Rate (% p.a.) <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={interestRateStr}
                onChange={(e) => setInterestRateStr(e.target.value)}
                placeholder="e.g. 8.50"
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Interest Structure
              </label>
              <select
                value={interestType}
                onChange={(e) => setInterestType(e.target.value as InterestType)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
              >
                <option value="floating">Floating / Repo-Linked</option>
                <option value="fixed">Fixed Rate</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Monthly EMI (₹)
              </label>
              <input
                type="number"
                step="any"
                value={emiAmountStr}
                onChange={(e) => setEmiAmountStr(e.target.value)}
                placeholder="e.g. 43500"
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors font-mono"
              />
            </div>
          </div>

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

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Loan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
