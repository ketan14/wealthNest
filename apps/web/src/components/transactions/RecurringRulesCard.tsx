import { useMemo, useState } from 'react';
import {
  Money,
  RecurringFrequency,
  RecurringRuleCategory,
  RecurringTransactionRule,
  advanceRecurringRuleAfterPost,
  evaluateRecurringRuleStatus,
  summarizeRecurringCommitments,
} from '@wealthnest/domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { NewTransactionFormValues } from '@/components/transactions/RecordTransactionModal';
import { CalendarClock, CheckCircle2, Plus, Repeat, Trash2 } from 'lucide-react';

interface RecurringRulesCardProps {
  readonly onPostTransaction: (values: NewTransactionFormValues) => Promise<void>;
  readonly isPosting?: boolean;
  readonly selectedMemberId?: string;
}

const DEFAULT_RULES: RecurringTransactionRule[] = [
  {
    id: 'rule-ppfas-sip',
    name: 'Parag Parikh Flexi Cap SIP',
    category: 'sip',
    transactionType: 'buy',
    amount: Money.fromDecimal(25000, 'INR'),
    frequency: 'monthly',
    dayOfMonth: 5,
    nextDueDate: '2026-11-05',
    memberId: 'mem-self',
    accountId: 'acc-groww',
    notes: 'Monthly Mutual Fund SIP auto-rule',
    isActive: true,
  },
  {
    id: 'rule-sbi-emi',
    name: 'SBI Home Loan EMI',
    category: 'emi',
    transactionType: 'withdrawal',
    amount: Money.fromDecimal(43391, 'INR'),
    frequency: 'monthly',
    dayOfMonth: 10,
    nextDueDate: '2026-11-10',
    memberId: 'mem-self',
    notes: 'Monthly Housing Loan EMI auto-rule',
    isActive: true,
  },
  {
    id: 'rule-parul-sip',
    name: 'Nippon India Small Cap SIP',
    category: 'sip',
    transactionType: 'buy',
    amount: Money.fromDecimal(15000, 'INR'),
    frequency: 'monthly',
    dayOfMonth: 15,
    nextDueDate: '2026-11-15',
    memberId: 'mem-spouse',
    accountId: 'acc-groww',
    notes: 'Monthly Mutual Fund SIP auto-rule (Parul)',
    isActive: true,
  },
];

export function RecurringRulesCard({
  onPostTransaction,
  isPosting = false,
  selectedMemberId = 'all',
}: RecurringRulesCardProps) {
  const [rules, setRules] = useState<RecurringTransactionRule[]>(DEFAULT_RULES);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<RecurringRuleCategory>('sip');
  const [amountRupees, setAmountRupees] = useState('10000');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [dayOfMonth, setDayOfMonth] = useState('5');
  const [postingRuleId, setPostingRuleId] = useState<string | null>(null);

  const scopedRules = useMemo(() => {
    if (selectedMemberId === 'all') return rules;
    return rules.filter((r) => !r.memberId || r.memberId === selectedMemberId);
  }, [rules, selectedMemberId]);

  const summary = useMemo(() => summarizeRecurringCommitments(scopedRules, 'INR'), [scopedRules]);

  const handlePostRule = async (rule: RecurringTransactionRule) => {
    const todayIso = new Date().toISOString().slice(0, 10);
    setPostingRuleId(rule.id);
    try {
      await onPostTransaction({
        type: rule.transactionType,
        amount: rule.amount.toDecimal(),
        currency: rule.amount.currency,
        transactionDate: `${todayIso}T09:00:00Z`,
        notes: `${rule.name} (${rule.frequency} ${rule.category.toUpperCase()})`,
        memberId: rule.memberId,
        accountId: rule.accountId,
      });
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? advanceRecurringRuleAfterPost(r, todayIso) : r))
      );
    } finally {
      setPostingRuleId(null);
    }
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amountRupees);
    if (!name.trim() || Number.isNaN(numericAmount) || numericAmount <= 0) return;

    const clampedDay = Math.min(28, Math.max(1, Number(dayOfMonth) || 1));
    const now = new Date();
    const nextDue = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), clampedDay))
      .toISOString()
      .slice(0, 10);

    const txType = category === 'sip' ? 'buy' : category === 'salary' ? 'deposit' : 'withdrawal';

    const newRule: RecurringTransactionRule = {
      id: `rule-${Date.now()}`,
      name: name.trim(),
      category,
      transactionType: txType,
      amount: Money.fromDecimal(numericAmount, 'INR'),
      frequency,
      dayOfMonth: clampedDay,
      nextDueDate: nextDue,
      memberId: selectedMemberId !== 'all' ? selectedMemberId : undefined,
      isActive: true,
    };

    setRules((prev) => [newRule, ...prev]);
    setName('');
    setShowAddForm(false);
  };

  return (
    <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Repeat className="w-4 h-4 text-cyan-400" />
              Recurring SIP & EMI Rules
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              1-click post scheduled Mutual Fund SIPs, loan EMIs, and recurring cashflows
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[11px] border-cyan-500/30 text-cyan-300">
              SIPs: {summary.totalMonthlySip.formatIndianCompact()}/mo
            </Badge>
            <Badge variant="outline" className="text-[11px] border-amber-500/30 text-amber-300">
              EMIs: {summary.totalMonthlyEmi.formatIndianCompact()}/mo
            </Badge>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1"
              onClick={() => setShowAddForm((v) => !v)}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Rule
            </Button>
          </div>
        </div>

        {showAddForm && (
          <form
            onSubmit={handleAddRule}
            className="mt-3 p-3 rounded-xl border border-border/70 bg-secondary/30 grid grid-cols-1 sm:grid-cols-6 gap-2.5 items-end"
          >
            <div className="sm:col-span-2">
              <label className="text-[11px] text-muted-foreground block mb-1">Rule Name</label>
              <input
                type="text"
                required
                placeholder="e.g. HDFC Midcap SIP"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-8 rounded-lg border border-border/80 bg-background px-2.5 text-xs text-foreground"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as RecurringRuleCategory)}
                className="w-full h-8 rounded-lg border border-border/80 bg-background px-2 text-xs text-foreground"
              >
                <option value="sip">SIP</option>
                <option value="emi">EMI</option>
                <option value="utility">Utility</option>
                <option value="salary">Salary</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Amount (₹)</label>
              <input
                type="number"
                required
                min="1"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                className="w-full h-8 rounded-lg border border-border/80 bg-background px-2.5 text-xs text-foreground"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                className="w-full h-8 rounded-lg border border-border/80 bg-background px-2 text-xs text-foreground"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-16">
                <label className="text-[11px] text-muted-foreground block mb-1">Day</label>
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                  className="w-full h-8 rounded-lg border border-border/80 bg-background px-2 text-xs text-foreground"
                />
              </div>
              <Button type="submit" size="sm" className="h-8 text-xs mt-4">
                Save
              </Button>
            </div>
          </form>
        )}
      </CardHeader>

      <CardContent>
        {scopedRules.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No recurring rules configured for the selected member.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {scopedRules.map((rule) => {
              const status = evaluateRecurringRuleStatus(rule);
              const isBusy = isPosting && postingRuleId === rule.id;
              return (
                <div
                  key={rule.id}
                  className="p-3 rounded-xl border border-border/70 bg-secondary/30 flex flex-col justify-between gap-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-foreground">{rule.name}</p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <CalendarClock className="w-3 h-3" />
                        Next: {rule.nextDueDate} · {rule.frequency}
                      </p>
                    </div>
                    <Badge
                      variant={
                        status.isOverdue ? 'destructive' : status.isDue ? 'secondary' : 'outline'
                      }
                      className="text-[10px] uppercase"
                    >
                      {status.isOverdue ? 'Overdue' : status.isDue ? 'Due Today' : rule.category}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border/40">
                    <span className="text-sm font-bold font-mono text-foreground">
                      {rule.amount.formatIndianCompact()}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => handlePostRule(rule)}
                        className="h-7 text-[11px] gap-1 px-2 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/15"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {isBusy ? 'Posting...' : 'Post Now'}
                      </Button>
                      <button
                        type="button"
                        onClick={() => setRules((prev) => prev.filter((r) => r.id !== rule.id))}
                        title="Remove recurring rule"
                        className="p-1.5 rounded-md text-muted-foreground hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
