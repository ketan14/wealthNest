import React, { useState } from 'react';
import { useFamily } from '@/lib/family/family-context';
import { useHousehold } from '@/lib/supabase/household-context';
import { PortfolioAccountDto } from '@wealthnest/application';
import { RecordVisibility, evaluatePlanQuota } from '@wealthnest/domain';
import { Plus, Trash2, Building, Lock, Globe } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PlanQuotaBadge } from '@/components/plans/PlanQuotaBadge';
import { PlanLimitModal } from '@/components/plans/PlanLimitModal';

const BROKER_OPTIONS = [
  'Zerodha',
  'Groww',
  'Upstox',
  'ICICI Direct',
  'HDFC Securities',
  'Kotak Securities',
  'Angel One',
  'CAMS',
  'KFintech',
  'SBI',
  'RBI Retail Direct',
  'Other',
];

/**
 * Accounts tab inside ManageFamilyModal for viewing, toggling visibility,
 * creating, and deleting demat/MF folio/bank accounts across family members.
 */
export function ManageFamilyAccountsTab() {
  const { canEditFinancials, planTier, customLimits } = useHousehold();
  const {
    members,
    accounts,
    createAccount,
    updateAccount,
    deleteAccount,
    getAccountVisibility,
    setAccountVisibility,
  } = useFamily();

  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [isPlanLimitOpen, setIsPlanLimitOpen] = useState(false);
  const accountQuota = evaluatePlanQuota(planTier, 'accounts', accounts.length, 1, customLimits);
  const [newAccMemberId, setNewAccMemberId] = useState(members[0]?.id || '');
  const [newAccName, setNewAccName] = useState('');
  const [newAccBroker, setNewAccBroker] = useState('Zerodha');
  const [newAccDepository, setNewAccDepository] =
    useState<PortfolioAccountDto['depository']>('CDSL');
  const [newAccType, setNewAccType] = useState<PortfolioAccountDto['accountType']>('demat');
  const [newAccNumber, setNewAccNumber] = useState('');
  const [newAccVisibility, setNewAccVisibility] =
    useState<RecordVisibility>('household_shared');

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditFinancials || !newAccName.trim()) return;

    const defaultMemberId = newAccMemberId || members[0]?.id || 'mem-self';
    await createAccount({
      memberId: defaultMemberId,
      accountName: newAccName.trim(),
      brokerName: newAccBroker,
      depository: newAccDepository,
      accountType: newAccType,
      accountNumberMasked: newAccNumber.trim() || undefined,
      visibility: newAccVisibility,
    });

    setNewAccName('');
    setNewAccNumber('');
    setNewAccVisibility('household_shared');
    setIsAddingAccount(false);
  };

  return (
    <div className="space-y-4">
      {/* Accounts List */}
      <div className="space-y-2">
        {accounts.map((acc) => {
          const parentMember = members.find((m) => m.id === acc.memberId);
          return (
            <div
              key={acc.id}
              className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 hover:border-slate-600 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                  <Building className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-100 flex flex-wrap items-center gap-2">
                    <span>{acc.accountName}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                      {acc.depository}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                    <span className="font-medium text-blue-400">{acc.brokerName}</span>
                    <span>•</span>
                    <span>
                      Belongs to:{' '}
                      <strong className="text-slate-300">{parentMember?.name || 'Self'}</strong>
                    </span>
                    {acc.accountNumberMasked && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-slate-400">{acc.accountNumberMasked}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {(() => {
                  const isOwnerOnly =
                    acc.visibility === 'owner_only' ||
                    (!acc.visibility && getAccountVisibility(acc.id) === 'owner_only');
                  return (
                    <button
                      type="button"
                      disabled={!canEditFinancials}
                      onClick={() => {
                        if (!canEditFinancials) return;
                        const nextIsPrivate = !isOwnerOnly;
                        setAccountVisibility(
                          acc.id,
                          nextIsPrivate ? 'owner_only' : 'shared_family'
                        );
                        void updateAccount({
                          ...acc,
                          visibility: nextIsPrivate ? 'owner_only' : 'household_shared',
                        });
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-colors disabled:opacity-50 ${
                        isOwnerOnly
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                      }`}
                      title="Toggle account visibility between Shared Household and Owner-Only"
                    >
                      {isOwnerOnly ? (
                        <>
                          <Lock className="w-3 h-3" />
                          Owner Only
                        </>
                      ) : (
                        <>
                          <Globe className="w-3 h-3" />
                          Shared
                        </>
                      )}
                    </button>
                  );
                })()}

                {canEditFinancials && accounts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => deleteAccount(acc.id)}
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete account"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Account Form / Button */}
      {isAddingAccount ? (
        <form
          onSubmit={handleCreateAccount}
          className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-3"
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Add New Demat or Folio Account
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Belongs to Family Member *
              </label>
              <select
                value={newAccMemberId}
                onChange={(e) => setNewAccMemberId(e.target.value)}
                className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.relationship})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Broker / Institution Name *
              </label>
              <select
                value={newAccBroker}
                onChange={(e) => setNewAccBroker(e.target.value)}
                className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {BROKER_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Account Friendly Name *
              </label>
              <input
                type="text"
                required
                value={newAccName}
                onChange={(e) => setNewAccName(e.target.value)}
                placeholder="e.g. Zerodha Primary or Groww MF"
                className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Depository / Platform
              </label>
              <select
                value={newAccDepository}
                onChange={(e) =>
                  setNewAccDepository(e.target.value as PortfolioAccountDto['depository'])
                }
                className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="CDSL">CDSL (Central Depository)</option>
                <option value="NSDL">NSDL (National Securities)</option>
                <option value="CAMS">CAMS (Mutual Funds)</option>
                <option value="KFINTECH">KFintech (Mutual Funds)</option>
                <option value="RBI">RBI Retail Direct</option>
                <option value="OTHER">Other Bank / Post Office</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Account Type</label>
              <select
                value={newAccType}
                onChange={(e) =>
                  setNewAccType(e.target.value as PortfolioAccountDto['accountType'])
                }
                className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="demat">Demat & Trading Account</option>
                <option value="mutual_fund_folio">Mutual Fund Folio</option>
                <option value="savings_bank">Savings Bank Account</option>
                <option value="ppf_epf">PPF / EPF Account</option>
                <option value="nps">NPS Tier 1 / Tier 2</option>
                <option value="other">Other Account</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Demat / Folio ID (Optional Masked)
              </label>
              <input
                type="text"
                value={newAccNumber}
                onChange={(e) => setNewAccNumber(e.target.value)}
                placeholder="e.g. 12081600****5678"
                className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Account Visibility
              </label>
              <select
                value={newAccVisibility}
                onChange={(e) => setNewAccVisibility(e.target.value as RecordVisibility)}
                className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="household_shared">
                  Household Shared — Visible to active household members
                </option>
                <option value="owner_only">
                  Owner Only — Private to account creator &amp; owner
                </option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddingAccount(false)}
              className="text-xs border-slate-700"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" className="text-xs bg-blue-600 hover:bg-blue-500">
              Save Account
            </Button>
          </div>
        </form>
      ) : canEditFinancials ? (
        <div className="space-y-2">
          <div className="flex items-center justify-end">
            <PlanQuotaBadge
              resource="accounts"
              currentCount={accounts.length}
              onLimitClick={() => setIsPlanLimitOpen(true)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (!accountQuota.allowed) {
                setIsPlanLimitOpen(true);
                return;
              }
              setIsAddingAccount(true);
            }}
            className="w-full text-xs border-dashed border-slate-700 hover:border-slate-600 text-slate-300 py-2.5"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Demat, MF Folio, or Bank Account
          </Button>
        </div>
      ) : null}

      <PlanLimitModal
        isOpen={isPlanLimitOpen}
        onClose={() => setIsPlanLimitOpen(false)}
        resource="accounts"
        currentCount={accounts.length}
      />
    </div>
  );
}
