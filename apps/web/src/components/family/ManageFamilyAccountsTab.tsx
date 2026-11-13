import React, { useState } from 'react';
import { useFamily } from '@/lib/family/family-context';
import { PortfolioAccountDto } from '@wealthnest/application';
import { Plus, Trash2, Building, Lock, Globe } from 'lucide-react';
import { Button } from '@/components/ui/Button';

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
  const {
    members,
    accounts,
    createAccount,
    deleteAccount,
    getAccountVisibility,
    setAccountVisibility,
  } = useFamily();

  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccMemberId, setNewAccMemberId] = useState(members[0]?.id || '');
  const [newAccName, setNewAccName] = useState('');
  const [newAccBroker, setNewAccBroker] = useState('Zerodha');
  const [newAccDepository, setNewAccDepository] =
    useState<PortfolioAccountDto['depository']>('CDSL');
  const [newAccType, setNewAccType] = useState<PortfolioAccountDto['accountType']>('demat');
  const [newAccNumber, setNewAccNumber] = useState('');

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;

    const defaultMemberId = newAccMemberId || members[0]?.id || 'mem-self';
    await createAccount({
      memberId: defaultMemberId,
      accountName: newAccName.trim(),
      brokerName: newAccBroker,
      depository: newAccDepository,
      accountType: newAccType,
      accountNumberMasked: newAccNumber.trim() || undefined,
    });

    setNewAccName('');
    setNewAccNumber('');
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
              className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 hover:border-slate-600 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    {acc.accountName}
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {acc.depository}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
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
                <button
                  type="button"
                  onClick={() => {
                    const current = getAccountVisibility(acc.id);
                    setAccountVisibility(
                      acc.id,
                      current === 'shared_family' ? 'owner_only' : 'shared_family'
                    );
                  }}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${
                    getAccountVisibility(acc.id) === 'owner_only'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                  }`}
                  title="Toggle account visibility between Shared Family and Owner-Only"
                >
                  {getAccountVisibility(acc.id) === 'owner_only' ? (
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

                {accounts.length > 1 && (
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
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsAddingAccount(true)}
          className="w-full text-xs border-dashed border-slate-700 hover:border-slate-600 text-slate-300 py-2.5"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Demat, MF Folio, or Bank Account
        </Button>
      )}
    </div>
  );
}
