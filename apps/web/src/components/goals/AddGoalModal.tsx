import { useState } from 'react';
import { GoalCategory, GoalPriority, Money } from '@wealthnest/domain';
import { CreateGoalParams } from '@wealthnest/application';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
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
} from 'lucide-react';

interface AddGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: Omit<CreateGoalParams, 'userId'>) => Promise<void>;
  isSubmitting?: boolean;
}

const CATEGORY_OPTIONS: { id: GoalCategory; label: string; icon: any; defaultReturn: number; defaultInflation: number }[] = [
  { id: 'emergency_fund', label: 'Emergency Fund', icon: ShieldAlert, defaultReturn: 6.5, defaultInflation: 0 },
  { id: 'retirement', label: 'Retirement / FIRE', icon: Target, defaultReturn: 12.0, defaultInflation: 6.0 },
  { id: 'home_purchase', label: 'Home Down Payment', icon: Building2, defaultReturn: 10.0, defaultInflation: 6.0 },
  { id: 'education', label: 'Child Education', icon: GraduationCap, defaultReturn: 11.0, defaultInflation: 9.0 },
  { id: 'wealth_creation', label: 'Wealth Creation', icon: Sparkles, defaultReturn: 13.0, defaultInflation: 6.0 },
  { id: 'vehicle', label: 'Vehicle Purchase', icon: Car, defaultReturn: 8.0, defaultInflation: 5.0 },
  { id: 'vacation', label: 'Annual Vacation', icon: Plane, defaultReturn: 7.0, defaultInflation: 5.0 },
  { id: 'other', label: 'Custom Milestone', icon: HeartHandshake, defaultReturn: 10.0, defaultInflation: 6.0 },
];

export function AddGoalModal({ isOpen, onClose, onSubmit, isSubmitting = false }: AddGoalModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<GoalCategory>('wealth_creation');
  const [targetAmountRupees, setTargetAmountRupees] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>('2029-12-31');
  const [initialSavedRupees, setInitialSavedRupees] = useState<string>('');
  const [monthlyContributionRupees, setMonthlyContributionRupees] = useState<string>('');
  const [expectedReturnRate, setExpectedReturnRate] = useState<number>(12.0);
  const [inflationRate, setInflationRate] = useState<number>(6.0);
  const [priority, setPriority] = useState<GoalPriority>('high');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCategorySelect = (catId: GoalCategory) => {
    setCategory(catId);
    const preset = CATEGORY_OPTIONS.find((c) => c.id === catId);
    if (preset) {
      setExpectedReturnRate(preset.defaultReturn);
      setInflationRate(preset.defaultInflation);
      if (!name || CATEGORY_OPTIONS.some((c) => c.label === name)) {
        setName(preset.label);
      }
    }
  };

  // Indian Rupee formatting previews
  const targetCents = Math.round((parseFloat(targetAmountRupees) || 0) * 100);
  const targetPreviewMoney = Money.fromCents(BigInt(targetCents), 'INR');

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

    const initVal = parseFloat(initialSavedRupees) || 0;
    const monthlyVal = parseFloat(monthlyContributionRupees) || 0;

    try {
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
      });

      // Reset and close
      setName('');
      setTargetAmountRupees('');
      setInitialSavedRupees('');
      setMonthlyContributionRupees('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create goal');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="p-5 border-b border-border/70 flex items-center justify-between bg-accent/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground">Create Financial Goal</h3>
              <p className="text-xs text-muted-foreground">Target corpus math, inflation adjustments & SIP planning</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
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
              placeholder="e.g. Retirement 2040, Mumbai Apartment Down Payment"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-background border border-border/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Target Amount & Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span>Target Corpus (₹ INR)</span>
                {targetCents > 0 && (
                  <Badge variant="outline" className="text-[10px] text-emerald-400 font-mono border-emerald-500/30">
                    {targetPreviewMoney.formatIndianCompact()}
                  </Badge>
                )}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-mono">₹</span>
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
              <label className="text-xs font-semibold text-muted-foreground">Target Maturity Date</label>
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
              <label className="text-xs font-semibold text-muted-foreground">Already Saved (Optional)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-mono">₹</span>
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
              <label className="text-xs font-semibold text-muted-foreground">Committed Monthly SIP</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-mono">₹</span>
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
              <span className="font-mono font-bold text-primary">{expectedReturnRate.toFixed(1)}%</span>
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
              <span className="font-semibold text-foreground">Assumed Annual Inflation (% p.a.)</span>
              <span className="font-mono font-bold text-amber-400">{inflationRate.toFixed(1)}%</span>
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

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Notes / Strategy (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Linking to Parag Parikh Flexi Cap SIP"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-background border border-border/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2 shadow-md">
              <Target className="w-4 h-4" />
              {isSubmitting ? 'Creating Goal...' : 'Save Financial Goal'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
export default AddGoalModal;
