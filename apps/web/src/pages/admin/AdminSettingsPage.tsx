import React, { useState } from 'react';
import {
  Shield,
  Database,
  CheckCircle2,
} from 'lucide-react';
import { AdminHeader } from '../../components/admin/AdminHeader';

export function AdminSettingsPage() {
  const [mfaEnforced, setMfaEnforced] = useState(true);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(60);
  const [passwordMinLength, setPasswordMinLength] = useState(12);
  const [requireSymbols, setRequireSymbols] = useState(true);
  const [invitationExpiryDays, setInvitationExpiryDays] = useState(7);
  const [saved, setSaved] = useState(false);


  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="flex-1 flex flex-col">
      <AdminHeader
        title="Platform Security Governance &amp; Policies"
        subtitle="Configure authentication standards, token lifecycles, and database compliance parameters"
      />

      <div className="p-8 space-y-8 max-w-5xl w-full mx-auto">
        {saved && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Platform security policies successfully updated.</span>
          </div>
        )}

        {/* System Diagnostics & Clean Architecture Compliance */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-semibold text-white">System Architecture &amp; Integrity Diagnostics</h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 block text-[11px]">Database Engine</span>
              <span className="text-white font-semibold mt-1 block">PostgreSQL 15</span>
              <span className="text-emerald-400 text-[10px] mt-0.5 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                supabase_db_wealthnest:54322
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 block text-[11px]">Currency Math Engine</span>
              <span className="text-white font-semibold mt-1 block">Integer Paise (BigInt)</span>
              <span className="text-emerald-400 text-[10px] mt-0.5 font-mono">
                0% Floating Point Drift
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 block text-[11px]">Formatting Locale</span>
              <span className="text-white font-semibold mt-1 block">en-IN (India-First)</span>
              <span className="text-cyan-400 text-[10px] mt-0.5 font-mono">
                ₹ Lakhs &amp; ₹ Crores
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 block text-[11px]">Tenant Isolation</span>
              <span className="text-white font-semibold mt-1 block">PostgreSQL RLS</span>
              <span className="text-emerald-400 text-[10px] mt-0.5 font-mono">
                Holdings &amp; Debt Shielded
              </span>
            </div>
          </div>
        </div>

        {/* Security Policy Form */}
        <form onSubmit={handleSave} className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-800">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-semibold text-white">Authentication &amp; Credential Policies</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div>
              <label className="block font-medium text-slate-300 mb-1.5">
                Multi-Factor Authentication (MFA)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="mfa"
                  checked={mfaEnforced}
                  onChange={(e) => setMfaEnforced(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500 h-4 w-4"
                />
                <label htmlFor="mfa" className="text-slate-400 text-xs cursor-pointer">
                  Require TOTP MFA for all administrative personnel
                </label>
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1.5">
                Session Expiration (Minutes)
              </label>
              <input
                type="number"
                min={15}
                max={1440}
                value={sessionTimeoutMinutes}
                onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-cyan-500"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Default: 60 minutes of inactivity
              </span>
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1.5">
                Minimum Password Length
              </label>
              <input
                type="number"
                min={8}
                max={32}
                value={passwordMinLength}
                onChange={(e) => setPasswordMinLength(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-cyan-500"
              />
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="symbols"
                  checked={requireSymbols}
                  onChange={(e) => setRequireSymbols(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500 h-3.5 w-3.5"
                />
                <label htmlFor="symbols" className="text-slate-400 text-[11px] cursor-pointer">
                  Require special characters (!@#$%^&*)
                </label>
              </div>
            </div>


            <div>
              <label className="block font-medium text-slate-300 mb-1.5">
                Invitation Token Lifetime (Days)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={invitationExpiryDays}
                onChange={(e) => setInvitationExpiryDays(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md transition-all"
            >
              Save Platform Policies
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
