import React from 'react';
import { useFamily } from '@/lib/family/family-context';
import { Users, User, Shield, Briefcase, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface FamilyFilterBarProps {
  onOpenManageModal?: () => void;
  showAccountSelector?: boolean;
}

export function FamilyFilterBar({
  onOpenManageModal,
  showAccountSelector = true,
}: FamilyFilterBarProps) {
  const {
    members,
    accounts,
    selectedMemberId,
    selectedAccountId,
    setSelectedMemberId,
    setSelectedAccountId,
  } = useFamily();

  // Filter accounts belonging to selected member, or all accounts if 'all'
  const relevantAccounts = React.useMemo(() => {
    if (selectedMemberId === 'all') return accounts;
    return accounts.filter((a) => a.memberId === selectedMemberId);
  }, [accounts, selectedMemberId]);

  const getRelationshipIcon = (rel: string) => {
    switch (rel) {
      case 'self':
        return <User className="w-3.5 h-3.5" />;
      case 'spouse':
        return <Users className="w-3.5 h-3.5" />;
      case 'huf':
        return <Shield className="w-3.5 h-3.5 text-purple-400" />;
      case 'child':
        return <User className="w-3.5 h-3.5 text-emerald-400" />;
      case 'parent':
        return <User className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Briefcase className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-sm">
      {/* Left: Family Member Pills */}
      <div className="flex items-center flex-wrap gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-blue-400" />
          Entity:
        </span>

        {/* All Family Option */}
        <button
          type="button"
          onClick={() => setSelectedMemberId('all')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            selectedMemberId === 'all'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 border border-slate-700/50'
          }`}
        >
          <span>👨‍👩‍👧‍👦</span>
          <span>Combined Family</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950/40 text-slate-200">
            {members.length}
          </span>
        </button>

        {/* Member Pills */}
        {members.map((member) => {
          const isSelected = selectedMemberId === member.id;
          return (
            <button
              key={member.id}
              type="button"
              onClick={() => setSelectedMemberId(member.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isSelected
                  ? 'text-white shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 border border-slate-700/50'
              }`}
              style={{
                backgroundColor: isSelected ? member.colorHex : undefined,
                boxShadow: isSelected ? `0 4px 12px ${member.colorHex}33` : undefined,
              }}
            >
              {getRelationshipIcon(member.relationship)}
              <span>{member.name}</span>
              {member.relationship === 'huf' && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-1 rounded bg-purple-950/80 text-purple-300 border border-purple-800/50">
                  HUF PAN
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Right: Demat / Broker Selector & Management Button */}
      <div className="flex items-center gap-2">
        {showAccountSelector && relevantAccounts.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              aria-label="Filter by Demat or Broker Account"
              className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">
                All Demats / Folios ({relevantAccounts.length})
              </option>
              {relevantAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.brokerName}: {acc.accountName} ({acc.depository})
                </option>
              ))}
            </select>
          </div>
        )}

        {onOpenManageModal && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenManageModal}
            className="h-8 text-xs gap-1.5 border-slate-700 hover:border-slate-600 bg-slate-800/60"
          >
            <SlidersHorizontal className="w-3 h-3 text-slate-400" />
            <span>Manage Entities</span>
          </Button>
        )}
      </div>
    </div>
  );
}
