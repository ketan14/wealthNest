import { LiabilityDto } from '@wealthnest/application';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Landmark,
  Plus,
  Building2,
  CheckCircle2,
  Edit2,
  Trash2,
  History,
  Car,
  GraduationCap,
  CreditCard,
  CircleDollarSign,
  Briefcase,
  User,
  Users,
} from 'lucide-react';

export interface LoanPortfolioMember {
  readonly id: string;
  readonly name: string;
  readonly colorHex?: string;
}

interface LoanPortfolioSectionProps {
  readonly statusFilter: 'active' | 'closed' | 'all';
  readonly onStatusFilterChange: (filter: 'active' | 'closed' | 'all') => void;
  readonly effectiveLiabilities: readonly LiabilityDto[];
  readonly filteredLiabilities: readonly LiabilityDto[];
  readonly members: readonly LoanPortfolioMember[];
  readonly currencySymbol: string;
  readonly locale: string;
  readonly onAddFirstLoan: () => void;
  readonly onPayEmi: (liability: LiabilityDto) => void;
  readonly onUpdateBalance: (liability: LiabilityDto) => void;
  readonly onEditLiability: (liability: LiabilityDto) => void;
  readonly onDeleteLiability: (liability: LiabilityDto) => void;
}

function getLoanIcon(type: string) {
  switch (type) {
    case 'home_loan':
      return <Building2 className="w-4 h-4 text-amber-400" />;
    case 'vehicle_loan':
      return <Car className="w-4 h-4 text-blue-400" />;
    case 'education_loan':
      return <GraduationCap className="w-4 h-4 text-emerald-400" />;
    case 'credit_card':
      return <CreditCard className="w-4 h-4 text-rose-400" />;
    case 'gold_loan':
      return <CircleDollarSign className="w-4 h-4 text-yellow-400" />;
    case 'business_loan':
      return <Briefcase className="w-4 h-4 text-indigo-400" />;
    default:
      return <Landmark className="w-4 h-4 text-muted-foreground" />;
  }
}

/**
 * Renders the Loan Portfolio & Balances section with status filtering,
 * borrower/co-borrower attribution, collateral details, and loan action controls.
 */
export function LoanPortfolioSection({
  statusFilter,
  onStatusFilterChange,
  effectiveLiabilities,
  filteredLiabilities,
  members,
  currencySymbol,
  locale,
  onAddFirstLoan,
  onPayEmi,
  onUpdateBalance,
  onEditLiability,
  onDeleteLiability,
}: LoanPortfolioSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Landmark className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            Loan Portfolio & Balances
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filter:</span>
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
            <button
              onClick={() => onStatusFilterChange('active')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'active'
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Active ({effectiveLiabilities.filter((l) => l.status === 'active').length})
            </button>
            <button
              onClick={() => onStatusFilterChange('closed')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'closed'
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Closed ({effectiveLiabilities.filter((l) => l.status === 'closed').length})
            </button>
            <button
              onClick={() => onStatusFilterChange('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'all'
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({effectiveLiabilities.length})
            </button>
          </div>
        </div>
      </div>

      {filteredLiabilities.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card/40 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              {statusFilter === 'closed'
                ? 'No closed loans found'
                : 'Debt Free / No Loans Recorded'}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {statusFilter === 'closed'
                ? 'Closed and fully paid loans will appear here.'
                : 'Add home loans, car loans, education debt, or credit lines to keep an accurate, reconciled net-worth balance.'}
            </p>
          </div>
          <Button onClick={onAddFirstLoan} className="gap-2 text-xs">
            <Plus className="w-4 h-4" />
            Add First Loan
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                  <th className="py-3 px-4">Loan & Lender</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Original Principal</th>
                  <th className="py-3 px-4 text-right">Outstanding Balance</th>
                  <th className="py-3 px-4 text-right">Interest Rate</th>
                  <th className="py-3 px-4 text-right">Monthly EMI</th>
                  <th className="py-3 px-4">Linked Collateral</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredLiabilities.map((l) => {
                  const origPrincipal = Number(l.originalPrincipalCents) / 100;
                  const currentBal = Number(l.currentBalanceCents) / 100;
                  const emi = Number(l.emiAmountCents) / 100;

                  return (
                    <tr key={l.id} className="hover:bg-accent/30 transition-colors">
                      {/* Name & Lender */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-accent border border-border/80">
                            {getLoanIcon(l.loanType)}
                          </div>
                          <div>
                            <span className="font-semibold text-foreground text-sm block">
                              {l.name}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] text-muted-foreground">
                                {l.lender}
                                {l.accountNumber ? ` • #${l.accountNumber}` : ''}
                              </span>
                              {l.memberId && (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                                  style={{
                                    backgroundColor: `${members.find((m) => m.id === l.memberId)?.colorHex || '#3b82f6'}15`,
                                    color:
                                      members.find((m) => m.id === l.memberId)?.colorHex ||
                                      '#3b82f6',
                                    borderColor: `${members.find((m) => m.id === l.memberId)?.colorHex || '#3b82f6'}30`,
                                  }}
                                >
                                  <User className="w-2.5 h-2.5" />
                                  {members.find((m) => m.id === l.memberId)?.name || 'Borrower'}
                                </span>
                              )}
                              {l.coBorrowerMemberIds && l.coBorrowerMemberIds.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-accent/40 px-1.5 py-0.5 rounded-md border border-border/50">
                                  <Users className="w-2.5 h-2.5" />
                                  Joint:{' '}
                                  {l.coBorrowerMemberIds
                                    .map((id) => members.find((m) => m.id === id)?.name)
                                    .filter(Boolean)
                                    .join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Loan Type */}
                      <td className="py-3.5 px-4">
                        <Badge variant="secondary" className="capitalize text-[10px]">
                          {l.loanType.replace('_', ' ')}
                        </Badge>
                      </td>

                      {/* Original Principal */}
                      <td className="py-3.5 px-4 text-right font-mono text-muted-foreground">
                        {currencySymbol}
                        {origPrincipal.toLocaleString(locale, { maximumFractionDigits: 0 })}
                      </td>

                      {/* Current Outstanding */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-mono font-bold text-foreground">
                          {currencySymbol}
                          {currentBal.toLocaleString(locale, { maximumFractionDigits: 0 })}
                        </div>
                        {l.lastBalanceDate && (
                          <span className="text-[10px] text-muted-foreground font-sans">
                            as of {l.lastBalanceDate}
                          </span>
                        )}
                      </td>

                      {/* Interest Rate */}
                      <td className="py-3.5 px-4 text-right font-mono">
                        <span className="font-semibold text-foreground">{l.interestRate}%</span>
                        <span className="text-[10px] text-muted-foreground block uppercase">
                          {l.interestType}
                        </span>
                      </td>

                      {/* Monthly EMI */}
                      <td className="py-3.5 px-4 text-right font-mono">
                        {emi > 0 ? (
                          <span className="font-medium text-foreground">
                            {currencySymbol}
                            {emi.toLocaleString(locale, { maximumFractionDigits: 0 })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Linked Collateral */}
                      <td className="py-3.5 px-4">
                        {l.linkedAssetName ? (
                          <div className="flex items-center gap-1.5 text-amber-400">
                            <Building2 className="w-3.5 h-3.5" />
                            <span className="font-medium text-foreground text-[11px]">
                              {l.linkedAssetName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Unsecured</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="default"
                            size="sm"
                            className="h-7 text-[11px] gap-1 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                            onClick={() => onPayEmi(l)}
                            title="Record monthly EMI and interest split"
                          >
                            <Landmark className="w-3 h-3" />
                            Pay EMI
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 text-[11px] gap-1 px-2.5"
                            onClick={() => onUpdateBalance(l)}
                            title="Record a new outstanding balance"
                          >
                            <History className="w-3 h-3 text-primary" />
                            Bal
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => onEditLiability(l)}
                            title="Edit loan details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => onDeleteLiability(l)}
                            title="Delete loan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
