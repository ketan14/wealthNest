import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FamilyDistributionWidget } from '@/components/family/FamilyDistributionWidget';
import { HouseholdSharingCard } from '@/components/settings/HouseholdSharingCard';
import { Briefcase, Plus, Shield, SlidersHorizontal, Users } from 'lucide-react';

interface FamilyMemberItem {
  readonly id: string;
  readonly name: string;
  readonly relationship: string;
  readonly colorHex: string;
  readonly isPrimary?: boolean;
  readonly panMasked?: string;
}

interface FamilyAccountItem {
  readonly id: string;
  readonly memberId: string;
  readonly accountName: string;
  readonly brokerName: string;
  readonly accountType: string;
  readonly accountNumberMasked?: string;
}

interface FamilyDematsTabProps {
  readonly members: readonly FamilyMemberItem[];
  readonly accounts: readonly FamilyAccountItem[];
  readonly onOpenManageFamily: () => void;
}

/**
 * Renders the Family & Demats tab in Settings: multi-PAN distribution, household sharing,
 * registered family entities, connected demat/folio accounts, and Section 112A advisory.
 */
export function FamilyDematsTab({ members, accounts, onOpenManageFamily }: FamilyDematsTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            Family Members & Demat Folios
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Manage household legal entities (Individual PAN, HUF, Minor) and link Zerodha, Groww,
            Angel One, or CAMS accounts.
          </p>
        </div>
        <Button
          onClick={onOpenManageFamily}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 self-start sm:self-auto shrink-0 shadow-lg shadow-indigo-600/20"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Manage Entities & Accounts
        </Button>
      </div>

      {/* Family Wealth & Multi-PAN Distribution Widget */}
      <FamilyDistributionWidget />

      {/* Phase 14: Multi-User Household Collaboration & Login Sharing */}
      <HouseholdSharingCard />

      {/* Two-Column Grid: Registered Members and Connected Demats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registered Family Entities */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                Family Entities ({members.length})
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Separate PANs entitled to independent ₹1.25L Sec 112A exemptions
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenManageFamily}
              className="h-8 text-xs border-slate-700 hover:bg-slate-800 text-slate-300 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
              Add Member
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {members.map((member) => {
              const linkedAccounts = accounts.filter((a) => a.memberId === member.id);
              const isHuf = member.relationship === 'huf';

              return (
                <div
                  key={member.id}
                  className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/80 hover:border-slate-700/80 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border"
                      style={{
                        backgroundColor: `${member.colorHex}20`,
                        borderColor: `${member.colorHex}60`,
                        color: member.colorHex,
                      }}
                    >
                      {member.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-white truncate">
                          {member.name}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase font-semibold ${
                            isHuf
                              ? 'border-purple-500/40 text-purple-300 bg-purple-500/10'
                              : 'border-slate-700 text-slate-300 bg-slate-800/50'
                          }`}
                        >
                          {member.relationship}
                        </Badge>
                        {member.isPrimary && (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                          >
                            Primary
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span>
                          PAN:{' '}
                          <span className="font-mono text-slate-300">
                            {member.panMasked || 'Not provided'}
                          </span>
                        </span>
                        <span>•</span>
                        <span>
                          {linkedAccounts.length} Demat/MF{' '}
                          {linkedAccounts.length === 1 ? 'account' : 'accounts'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <Badge
                      variant="outline"
                      className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/5 hidden sm:inline-flex"
                    >
                      ₹1.25L 112A Exempt
                    </Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Connected Demat & Folio Accounts */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-emerald-400" />
                Demat & Folio Accounts ({accounts.length})
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Depository and broker accounts linked to family members
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenManageFamily}
              className="h-8 text-xs border-slate-700 hover:bg-slate-800 text-slate-300 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              Add Account
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {accounts.map((account) => {
              const owner = members.find((m) => m.id === account.memberId);

              return (
                <div
                  key={account.id}
                  className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/80 hover:border-slate-700/80 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-white">{account.accountName}</span>
                      <Badge
                        variant="outline"
                        className="text-[10px] border-blue-500/30 text-blue-400 bg-blue-500/10 font-semibold"
                      >
                        {account.brokerName}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] border-slate-700 text-slate-400 bg-slate-800/40"
                      >
                        {account.accountType}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      {owner && (
                        <span className="flex items-center gap-1.5 text-slate-300">
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ backgroundColor: owner.colorHex }}
                          />
                          {owner.name} ({owner.relationship})
                        </span>
                      )}
                      {account.accountNumberMasked && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-slate-400">
                            Acc: {account.accountNumberMasked}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/5"
                    >
                      Active
                    </Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Tax Advisory Card */}
      <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-start gap-3">
        <Shield className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <span className="font-semibold text-purple-300">Indian Section 112A Tax Advantage:</span>{' '}
          By allocating long-term capital assets across distinct PAN entities (e.g., Self, Spouse,
          HUF), your household unlocks multiple independent ₹1,25,000 annual LTCG exemption limits
          under Finance Act (No. 2) 2024. Tax savings are automatically calculated and reflected in
          your analytics.
        </div>
      </div>
    </div>
  );
}
