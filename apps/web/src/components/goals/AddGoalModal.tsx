import { useEffect, useState } from 'react';
import { GoalCategory, GoalPriority, RecordVisibility } from '@wealthnest/domain';
import { CreateGoalParams, GoalDetailDto, UpdateGoalParams } from '@wealthnest/application';
import { formatInr } from '@/utils/formatInr';
import { useFamily } from '@/lib/family/family-context';
import { useHousehold } from '@/lib/supabase/household-context';
import { usePreferences } from '@/lib/preferences/preferences-context';
import { VisibilityControl } from '@/components/household/VisibilityControl';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ResponsiveModalShell } from '@/components/ui/ResponsiveModalShell';
import {
  X,
  Target,
  ShieldAlert,
  Building2,
  GraduationCap,
  Sparkles,
  Car,
  Plane,
  HeartHandshake,
  Users,
} from 'lucide-react';

interface AddGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: Omit<CreateGoalParams, 'userId'>) => Promise<void>;
  onUpdate?: (params: Omit<UpdateGoalParams, 'userId'>) => Promise<void>;
  initialGoal?: GoalDetailDto | null;
  isSubmitting?: boolean;
}

const CATEGORY_OPTIONS: {
  id: GoalCategory;
  label: string;
  icon: any;
  defaultReturn: number;
  defaultInflation: number;
}[] = [
  {
    id: 'emergency_fund',
    label: 'Emergency Fund',
    icon: ShieldAlert,
    defaultReturn: 6.5,
    defaultInflation: 0,
  },
  {
    id: 'retirement',
    label: 'Retirement / FIRE',
    icon: Target,
    defaultReturn: 12.0,
    defaultInflation: 6.0,
  },
  {
    id: 'home_purchase',
    label: 'Home Down Payment',
    icon: Building2,
    defaultReturn: 10.0,
    defaultInflation: 6.0,
  },
  {
    id: 'education',
    label: 'Child Education',
    icon: GraduationCap,
    defaultReturn: 11.0,
    defaultInflation: 9.0,
  },
  {
    id: 'wealth_creation',
    label: 'Wealth Creation',
    icon: Sparkles,
    defaultReturn: 13.0,
    defaultInflation: 6.0,
  },
  {
    id: 'vehicle',
    label: 'Vehicle Purchase',
    icon: Car,
    defaultReturn: 8.0,
    defaultInflation: 5.0,
  },
  {
    id: 'vacation',
    label: 'Annual Vacation',
    icon: Plane,
    defaultReturn: 7.0,
    defaultInflation: 5.0,
  },
  {
    id: 'other',
    label: 'Custom Milestone',
    icon: HeartHandshake,
    defaultReturn: 10.0,
    defaultInflation: 6.0,
  },
];

export function AddGoalModal({
  isOpen,
  onClose,
  onSubmit,
  onUpdate,
  initialGoal = null,
  isSubmitting = false,
}: AddGoalModalProps) {
  const { members, selectedMemberId } = useFamily();
  const { canEditFinancials } = useHousehold();
  const { currencySymbol, currencyCode } = usePreferences();
  const isEditing = Boolean(initialGoal);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<GoalCategory>('wealth_creation');
  const [memberId, setMemberId] = useState<string>(
    selectedMemberId && selectedMemberId !== 'all' ? selectedMemberId : 'mem-self'
  );
  const [targetAmountRupees, setTargetAmountRupees] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>('2029-12-31');
  const [initialSavedRupees, setInitialSavedRupees] = useState<string>('');
  const [monthlyContributionRupees, setMonthlyContributionRupees] = useState<string>('');
  const [expectedReturnRate, setExpectedReturnRate] = useState<number>(12.0);
  const [inflationRate, setInflationRate] = useState<number>(6.0);
  const [priority, setPriority] = useState<GoalPriority>('high');
  const [visibility, setVisibility] = useState<RecordVisibility>('household_shared');
  const [restrictedGranteeUserIds, setRestrictedGranteeUserIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (initialGoal) {
      setName(initialGoal.name);
      setCategory(initialGoal.category);
      setMemberId(
        initialGoal.memberId ||
          (selectedMemberId && selectedMemberId !== 'all' ? selectedMemberId : 'mem-self')
      );
      setTargetAmountRupees(String(Math.round(initialGoal.targetAmountCents / 100)));
      const normalizedDate = String(initialGoal.targetDate).includes('T')
        ? String(initialGoal.targetDate).split('T')[0]!
        : String(initialGoal.targetDate);
      setTargetDate(normalizedDate || '2029-12-31');
      setInitialSavedRupees(String(Math.round(initialGoal.initialSavedCents / 100)));
      setMonthlyContributionRupees(
        String(Math.round(initialGoal.monthlyContributionCents / 100))
      );
      setExpectedReturnRate(initialGoal.expectedReturnRate);
      setInflationRate(initialGoal.inflationRate);
      setPriority(initialGoal.priority);
      setVisibility(initialGoal.visibility ?? 'household_shared');
      setRestrictedGranteeUserIds([]);
      setNotes(initialGoal.notes || '');
      return;
    }

    setName('');
    setCategory('wealth_creation');
    setMemberId(selectedMemberId && selectedMemberId !== 'all' ? selectedMemberId : 'mem-self');
    setTargetAmountRupees('');
    setTargetDate('2029-12-31');
    setInitialSavedRupees('');
    setMonthlyContributionRupees('');
    setExpectedReturnRate(12.0);
    setInflationRate(6.0);
    setPriority('high');
    setVisibility('household_shared');
    setRestrictedGranteeUserIds([]);
    setNotes('');
  }, [isOpen, initialGoal, selectedMemberId]);

  if (!isOpen) return null;

  const handleCategorySelect = (catId: GoalCategory) => {
    setCategory(catId);
    const preset = CATEGORY_OPTIONS.find((c) => c.id === catId);
    if (preset) {
      setExpectedReturnRate(preset.defaultReturn);
      setInflationRate(preset.defaultInflation);
      if (!isEditing && (!name || CATEGORY_OPTIONS.some((c) => c.label === name))) {
        setName(preset.label);
      }
    }
  };

  // Indian Rupee formatting previews
  const targetRupees = parseFloat(targetAmountRupees) || 0;
  const targetCents = Math.round(targetRupees * 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter a goal title.');
      return;
    }

    const targetVal = parseFloat(targetAmountRupees);
    if (isNaN(targetVal) || targetVal <= 0) {
      setError('Target corpus must be greater than zero.');
      return;
    }

    if (!targetDate) {
      setError('Please specify a target maturity date.');
      return;
    }

    if (!canEditFinancials) {
      setError(
        `Viewers have read-only access and cannot ${isEditing ? 'update' : 'create'} goals.`
      );
      return;
    }

    const initVal = parseFloat(initialSavedRupees) || 0;
    const monthlyVal = parseFloat(monthlyContributionRupees) || 0;

    try {
      if (initialGoal && onUpdate) {
        await onUpdate({
          goalId: initialGoal.id,
          name: name.trim(),
          category,
          targetAmountCents: Math.round(targetVal * 100),
          targetDate,
          initialSavedCents: Math.round(initVal * 100),
          monthlyContributionCents: Math.round(monthlyVal * 100),
          expectedReturnRate,
          inflationRate,
          priority,
          notes: notes.trim() || undefined,
          memberId: memberId || undefined,
          visibility,
        });
      } else {
        await onSubmit({
          name: name.trim(),
          category,
          targetAmountCents: Math.round(targetVal * 100),
          targetDate,
          initialSavedCents: Math.round(initVal * 100),
          monthlyContributionCents: Math.round(monthlyVal * 100),
          expectedReturnRate,
          inflationRate,
          priority,
          currency: 'INR',
          notes: notes.trim() || undefined,
          memberId: memberId || undefined,
          visibility,
          restrictedGranteeUserIds:
            visibility === 'restricted' ? restrictedGranteeUserIds : undefined,
        });
      }

      onClose();
    } catch (err: any) {
      setError(err?.message || `Failed to ${isEditing ? 'update' : 'create'} goal`);
    }
  };

  return (
    <ResponsiveModalShell
      role="dialog"
      ariaLabelledBy="add-goal-modal-title"
      backdropClassName="bg-background/80"
      panelClassName="max-w-xl bg-card border-border/80 animate-in fade-in zoom-in-95 duration-200"
      formProps={{ onSubmit: handleSubmit }}
      header={
        <div className="p-4 sm:p-5 border-b border-border/70 flex items-center justify-between gap-2 bg-accent/20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 id="add-goal-modal-title" className="font-bold text-base sm:text-lg text-foreground">
                {isEditing ? 'Edit Financial Goal' : 'Create Financial Goal'}
              </h3>
              <p className="text-xs text-muted-foreground">
                Target corpus math, inflation adjustments & SIP planning
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      }
      bodyClassName="p-4 sm:p-6 space-y-5"
      footer={
        <div className="flex items-center justify-end gap-3 px-4 py-3 sm:px-6 border-t border-border/60 bg-card">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !canEditFinancials} className="gap-2 shadow-md">
            <Target className="w-4 h-4" />
            {isSubmitting
              ? isEditing
                ? 'Updating Goal...'
                : 'Creating Goal...'
              : isEditing
                ? 'Update Goal'
                : 'Save Financial Goal'}
          </Button>
        </div>
      }
    >
      {error && (
            <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg">
              {error}
            </div>
          )}

          {/* Goal Category Pills */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Goal Archetype
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CATEGORY_OPTIONS.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategorySelect(cat.id)}
                    className={`p-2.5 rounded-xl border text-left flex flex-col items-start gap-1.5 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-border/60 hover:border-border hover:bg-accent/30 text-muted-foreground'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-medium leading-tight">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Goal Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Retirement 2040, Krisha University Corpus"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-background border border-border/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Family Beneficiary Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-primary" />
              Goal Beneficiary / Family Entity
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {members.map((m) => {
                const isSelected = memberId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMemberId(m.id)}
                    className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all text-xs font-medium ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                        : 'border-border/60 hover:border-border hover:bg-accent/30 text-muted-foreground'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: m.colorHex }}
                    />
                    <span className="truncate">{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Amount & Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span>
                  Target Corpus ({currencySymbol} {currencyCode})
                </span>
                {targetCents > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-emerald-400 font-mono border-emerald-500/30"
                  >
                    {formatInr(targetRupees, { compact: true })}
                  </Badge>
                )}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-mono">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  required
                  step="any"
                  placeholder="e.g. 5000000"
                  value={targetAmountRupees}
                  onChange={(e) => setTargetAmountRupees(e.target.value)}
                  className="w-full pl-8 pr-3.5 py-2.5 bg-background border border-border/80 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            {/* Target Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Target Maturity Date
              </label>
              <input
                type="date"
                required
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-background border border-border/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          {/* Initial Saved & Monthly SIP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Already Saved (Optional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-mono">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  step="any"
                  placeholder="0"
                  value={initialSavedRupees}
                  onChange={(e) => setInitialSavedRupees(e.target.value)}
                  className="w-full pl-8 pr-3.5 py-2.5 bg-background border border-border/80 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Committed Monthly SIP
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-mono">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 25000"
                  value={monthlyContributionRupees}
                  onChange={(e) => setMonthlyContributionRupees(e.target.value)}
                  className="w-full pl-8 pr-3.5 py-2.5 bg-background border border-border/80 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          </div>

          {/* Rates: Expected Return & Inflation Sliders */}
          <div className="p-4 rounded-xl bg-accent/20 border border-border/60 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">Expected Annual CAGR (% p.a.)</span>
              <span className="font-mono font-bold text-primary">
                {expectedReturnRate.toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min="4.0"
              max="20.0"
              step="0.5"
              value={expectedReturnRate}
              onChange={(e) => setExpectedReturnRate(parseFloat(e.target.value))}
              className="w-full accent-primary h-1.5 bg-secondary rounded-lg cursor-pointer"
            />

            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
              <span className="font-semibold text-foreground">
                Assumed Annual Inflation (% p.a.)
              </span>
              <span className="font-mono font-bold text-amber-400">
                {inflationRate.toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="12.0"
              step="0.5"
              value={inflationRate}
              onChange={(e) => setInflationRate(parseFloat(e.target.value))}
              className="w-full accent-amber-400 h-1.5 bg-secondary rounded-lg cursor-pointer"
            />
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Goal Priority</label>
            <div className="flex items-center gap-2">
              {(['low', 'medium', 'high', 'critical'] as GoalPriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all border ${
                    priority === p
                      ? 'bg-primary/20 text-primary border-primary/40 shadow-sm'
                      : 'border-border/60 text-muted-foreground hover:bg-accent/40'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Visibility & Privacy */}
          <VisibilityControl
            visibility={visibility}
            onChange={setVisibility}
            granteeUserIds={restrictedGranteeUserIds}
            onGranteeUserIdsChange={setRestrictedGranteeUserIds}
            disabled={!canEditFinancials}
            compact
          />

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Notes / Strategy (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Linking to Parag Parikh Flexi Cap SIP"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-background border border-border/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
    </ResponsiveModalShell>
  );
}
export default AddGoalModal;
