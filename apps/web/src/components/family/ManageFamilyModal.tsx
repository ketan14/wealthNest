import React, { useState } from 'react';
import { useFamily } from '@/lib/family/family-context';
import { useHousehold } from '@/lib/supabase/household-context';
import { FamilyMemberDto } from '@wealthnest/application';
import { FamilyEntityType } from '@wealthnest/domain';
import { X, Users, Shield, Briefcase, Plus, Trash2, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ResponsiveModalShell } from '@/components/ui/ResponsiveModalShell';
import { ManageFamilyAccountsTab } from './ManageFamilyAccountsTab';

interface ManageFamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COLOR_PRESETS = [
  '#3b82f6',
  '#ec4899',
  '#8b5cf6',
  '#10b981',
  '#f59e0b',
  '#06b6d4',
  '#6366f1',
];

export function ManageFamilyModal({ isOpen, onClose }: ManageFamilyModalProps) {
  const { members, accounts, createMember, deleteMember } = useFamily();
  const { canEditFinancials, activeHousehold } = useHousehold();

  const [activeTab, setActiveTab] = useState<'members' | 'accounts'>('members');
  const [isAddingMember, setIsAddingMember] = useState(false);

  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRel, setNewMemberRel] = useState<FamilyMemberDto['relationship']>('spouse');
  const [newMemberEntityType, setNewMemberEntityType] = useState<FamilyEntityType>('individual');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPan, setNewMemberPan] = useState('');
  const [newMemberColor, setNewMemberColor] = useState('#ec4899');
  const [newMemberPrimary, setNewMemberPrimary] = useState(false);

  if (!isOpen) return null;

  const handleRelationshipChange = (rel: FamilyMemberDto['relationship']) => {
    setNewMemberRel(rel);
    if (rel === 'huf') {
      setNewMemberEntityType('huf');
    } else if (rel === 'child' && newMemberEntityType === 'huf') {
      setNewMemberEntityType('minor');
    } else if (newMemberEntityType === 'huf') {
      setNewMemberEntityType('individual');
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !canEditFinancials) return;

    await createMember({
      name: newMemberName.trim(),
      relationship: newMemberRel,
      entityType: newMemberEntityType,
      email: newMemberEmail.trim() || undefined,
      panMasked: newMemberPan.trim().toUpperCase() || undefined,
      colorHex: newMemberColor,
      isPrimary: newMemberPrimary,
    });

    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberPan('');
    setNewMemberPrimary(false);
    setIsAddingMember(false);
  };

  return (
    <ResponsiveModalShell
      variant="sheet"
      role="dialog"
      ariaLabelledBy="manage-family-title"
      panelClassName="max-w-2xl bg-slate-900 border-slate-800"
      onDismiss={onClose}
      header={
        <div className="flex items-center justify-between gap-2 px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="manage-family-title" className="text-base font-semibold text-white">
                Family Entities &amp; Demat Accounts
              </h2>
              <p className="text-xs text-slate-400 truncate">
                {activeHousehold?.name || 'Household'} — organize family members, HUF entities, and
                broker folios
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      }
      subHeader={
        <div className="flex overflow-x-auto border-b border-slate-800 bg-slate-950/40 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'members'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>Family Entities ({members.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('accounts')}
            className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'accounts'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Briefcase className="w-4 h-4 shrink-0" />
            <span>Demat &amp; Folio Accounts ({accounts.length})</span>
          </button>
        </div>
      }
      bodyClassName="p-4 sm:p-6 space-y-4"
      footer={
        <div className="px-4 py-3 sm:px-6 border-t border-slate-800 bg-slate-950/40 flex justify-end">
          <Button
            onClick={onClose}
            size="sm"
            className="text-xs bg-slate-800 hover:bg-slate-700 text-white"
          >
            Close
          </Button>
        </div>
      }
    >
      {activeTab === 'members' ? (
        <div className="space-y-4">
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 hover:border-slate-600 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: member.colorHex }}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-100 flex flex-wrap items-center gap-2">
                      <span>{member.name}</span>
                      {member.isPrimary && (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50">
                          Primary
                        </span>
                      )}
                      {(member.entityType === 'huf' || member.relationship === 'huf') && (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-300 border border-purple-700/50 flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          HUF
                        </span>
                      )}
                      {member.entityType === 'minor' && (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-teal-900/60 text-teal-300 border border-teal-700/50">
                          Minor
                        </span>
                      )}
                      {member.linkedUserId ? (
                        <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-emerald-900/50 text-emerald-300 border border-emerald-700/40 flex items-center gap-1">
                          <Link2 className="w-2.5 h-2.5" />
                          Login Linked
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          Profile Only
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="capitalize">{member.relationship}</span>
                      {member.panMasked && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-slate-300">
                            PAN: {member.panMasked}
                          </span>
                        </>
                      )}
                      {member.email && (
                        <>
                          <span>•</span>
                          <span className="text-slate-300">{member.email}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {canEditFinancials && !member.isPrimary && members.length > 1 && (
                  <button
                    type="button"
                    onClick={() => deleteMember(member.id)}
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                    title="Delete member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {canEditFinancials &&
            (isAddingMember ? (
              <form
                onSubmit={handleCreateMember}
                className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-3"
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Add New Family Member / Entity
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Legal Entity / Member Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      placeholder="e.g. Parul Vaghela or Vaghela HUF"
                      className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Relationship
                    </label>
                    <select
                      value={newMemberRel}
                      onChange={(e) => handleRelationshipChange(e.target.value as any)}
                      className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="spouse">Spouse</option>
                      <option value="huf">HUF (Hindu Undivided Family)</option>
                      <option value="child">Child</option>
                      <option value="parent">Parent / Senior Citizen</option>
                      <option value="other">Other Entity</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Entity Kind
                    </label>
                    <select
                      value={newMemberEntityType}
                      onChange={(e) => setNewMemberEntityType(e.target.value as FamilyEntityType)}
                      className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="individual">Individual (Adult)</option>
                      <option value="minor">Minor</option>
                      <option value="huf">HUF Entity</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Email (Optional — for future login invite)
                    </label>
                    <input
                      type="email"
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      placeholder="optional@family.com"
                      className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      PAN Card (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      value={newMemberPan}
                      onChange={(e) => setNewMemberPan(e.target.value.toUpperCase())}
                      placeholder="e.g. ABCDE1234F"
                      className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Display Color
                    </label>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {COLOR_PRESETS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewMemberColor(color)}
                          className="w-6 h-6 rounded-full border-2 transition-transform"
                          style={{
                            backgroundColor: color,
                            borderColor: newMemberColor === color ? '#ffffff' : 'transparent',
                            transform: newMemberColor === color ? 'scale(1.15)' : 'scale(1)',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="newMemberPrimaryCheck"
                      checked={newMemberPrimary}
                      onChange={(e) => setNewMemberPrimary(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500 w-4 h-4"
                    />
                    <label htmlFor="newMemberPrimaryCheck" className="text-xs text-slate-300">
                      Set as primary legal entity for unassigned folios
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddingMember(false)}
                    className="text-xs border-slate-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="text-xs bg-blue-600 hover:bg-blue-500"
                  >
                    Save Entity
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddingMember(true)}
                className="w-full text-xs border-dashed border-slate-700 hover:border-slate-600 text-slate-300 py-2.5"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Family Member or HUF Entity
              </Button>
            ))}
        </div>
      ) : (
        <ManageFamilyAccountsTab />
      )}
    </ResponsiveModalShell>
  );
}
