import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  PieChart,
  Landmark,
  ArrowLeftRight,
  Target,
  Sparkles,
  ChevronRight,
  TrendingUp,
  FolderLock,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickActionItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  action: () => void;
}

export function GlobalQuickAddModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const actions: QuickActionItem[] = [
    {
      id: 'transaction',
      title: 'Record Cash Transaction',
      description: 'Log salary, household expense, or account transfer',
      icon: ArrowLeftRight,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/15 border-emerald-500/30',
      action: () => {
        onClose();
        navigate('/transactions?action=new');
      },
    },
    {
      id: 'holding',
      title: 'Add Asset / Investment',
      description: 'Add equity, mutual fund, gold, or fixed deposit',
      icon: PieChart,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/15 border-blue-500/30',
      action: () => {
        onClose();
        navigate('/portfolio?action=new');
      },
    },
    {
      id: 'liability',
      title: 'Add Loan or Mortgage',
      description: 'Register a home loan, vehicle debt, or track EMI',
      icon: Landmark,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/15 border-amber-500/30',
      action: () => {
        onClose();
        navigate('/liabilities?action=new');
      },
    },
    {
      id: 'goal',
      title: 'Set Financial Goal',
      description: 'Create child education, retirement, or emergency milestone',
      icon: Target,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/15 border-purple-500/30',
      action: () => {
        onClose();
        navigate('/goals?action=new');
      },
    },
    {
      id: 'analytics',
      title: 'View Tax & Returns Radar',
      description: 'Inspect Section 112A LTCG tax shield & portfolio XIRR',
      icon: TrendingUp,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/15 border-cyan-500/30',
      action: () => {
        onClose();
        navigate('/analytics');
      },
    },
    {
      id: 'document',
      title: 'Upload to Document Vault',
      description: 'Store PAN, HUF deed, CAS PDF, or insurance policy',
      icon: FolderLock,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/15 border-emerald-500/30',
      action: () => {
        onClose();
        navigate('/documents?action=new');
      },
    },
    {
      id: 'real-estate',
      title: 'Real Estate Equity & LTV',
      description: 'Track property valuation, linked home loan & rental yield',
      icon: Building2,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/15 border-amber-500/30',
      action: () => {
        onClose();
        navigate('/real-estate');
      },
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-add-title"
      data-testid="global-quick-add-modal"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-card border border-border sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom duration-250"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/80 bg-secondary/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-primary">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 id="quick-add-title" className="text-base font-bold text-foreground">
                Quick Action
              </h2>
              <p className="text-xs text-muted-foreground">Select an operation to perform</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action List */}
        <div className="p-4 space-y-2.5 overflow-y-auto">
          {actions.map((act) => {
            const Icon = act.icon;
            return (
              <button
                key={act.id}
                onClick={act.action}
                data-testid={`quick-action-${act.id}`}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-card/60 hover:bg-secondary/50 hover:border-border transition-all text-left group active:scale-[0.99]"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center border shrink-0',
                      act.bgColor,
                      act.color
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {act.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">{act.description}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </button>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-border/60 bg-secondary/20 text-center text-[11px] text-muted-foreground">
          WealthNest India-First Family Finance
        </div>
      </div>
    </div>
  );
}
