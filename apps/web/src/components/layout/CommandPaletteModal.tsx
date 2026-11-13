import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  PieChart,
  Building2,
  Landmark,
  ArrowLeftRight,
  TrendingUp,
  Target,
  FolderLock,
  Settings,
  PlusCircle,
  X,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  category: 'Navigate' | 'Quick Action';
  keywords: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const COMMAND_ITEMS: CommandItem[] = [
  {
    id: 'nav-overview',
    label: 'System Overview',
    category: 'Navigate',
    keywords: 'home dashboard net worth summary',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    id: 'nav-portfolio',
    label: 'Portfolio Holdings',
    category: 'Navigate',
    keywords: 'stocks mutual funds equity sgb cas demat',
    href: '/portfolio',
    icon: PieChart,
  },
  {
    id: 'nav-real-estate',
    label: 'Real Estate Equity & LTV',
    category: 'Navigate',
    keywords: 'property home rental yield ltv mortgage reit',
    href: '/real-estate',
    icon: Building2,
  },
  {
    id: 'nav-liabilities',
    label: 'Loans & Liabilities',
    category: 'Navigate',
    keywords: 'emi home loan debt amortization',
    href: '/liabilities',
    icon: Landmark,
  },
  {
    id: 'nav-transactions',
    label: 'Transactions & Cashflow',
    category: 'Navigate',
    keywords: 'income expense transfer ledger',
    href: '/transactions',
    icon: ArrowLeftRight,
  },
  {
    id: 'nav-analytics',
    label: 'Analytics & Section 112A Tax Shield',
    category: 'Navigate',
    keywords: 'xirr cagr nifty rebalance tax harvesting 112a',
    href: '/analytics',
    icon: TrendingUp,
  },
  {
    id: 'nav-goals',
    label: 'Goals & Emergency Runway',
    category: 'Navigate',
    keywords: 'retirement krisha education sip runway',
    href: '/goals',
    icon: Target,
  },
  {
    id: 'nav-documents',
    label: 'Family Document Vault',
    category: 'Navigate',
    keywords: 'pan huf deed insurance cas pdf vault',
    href: '/documents',
    icon: FolderLock,
  },
  {
    id: 'nav-settings',
    label: 'Settings & Family Preferences',
    category: 'Navigate',
    keywords: 'currency backup restore server lan',
    href: '/settings',
    icon: Settings,
  },
  {
    id: 'act-transaction',
    label: 'Record Cash Transaction',
    category: 'Quick Action',
    keywords: 'new add expense income transfer',
    href: '/transactions?action=new',
    icon: PlusCircle,
  },
  {
    id: 'act-holding',
    label: 'Add Asset / Investment',
    category: 'Quick Action',
    keywords: 'new buy equity mutual fund fd',
    href: '/portfolio?action=new',
    icon: PlusCircle,
  },
  {
    id: 'act-document',
    label: 'Upload to Document Vault',
    category: 'Quick Action',
    keywords: 'new upload pan deed cas pdf',
    href: '/documents?action=new',
    icon: PlusCircle,
  },
];

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPaletteModal({ isOpen, onClose }: CommandPaletteModalProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMAND_ITEMS;
    return COMMAND_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.keywords.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const handleSelect = (item: CommandItem) => {
    onClose();
    navigate(item.href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (filtered.length > 0 ? (prev + 1) % filtered.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : 0
      );
    } else if (e.key === 'Enter' && filtered[activeIndex]) {
      e.preventDefault();
      handleSelect(filtered[activeIndex]);
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global Command Palette"
      data-testid="command-palette-modal"
      onClick={onClose}
      className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-start justify-center pt-[15vh] p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-800">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to page or action (e.g. Real Estate, 112A, Vault)..."
            aria-label="Search commands and routes"
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close command palette"
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No matching pages or actions found.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === activeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm transition-colors ${
                    isSelected
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'text-slate-300 hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate font-medium">{item.label}</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
                    {item.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-500">
          <span>↑↓ Navigate · ↵ Open · Esc Close</span>
          <span>Ctrl+K / ⌘K</span>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

