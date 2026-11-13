import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { UserPlus, Shield, Copy, Check, Mail, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/supabase/auth-context';

interface HouseholdMember {
  id: string;
  email: string;
  name: string;
  role: 'primary_owner' | 'member' | 'viewer';
  joinedAt: string;
  isSelf: boolean;
}

export function HouseholdSharingCard() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'viewer'>('member');
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Demo active household members in Vaghela Household
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([
    {
      id: 'mem-user-1',
      email: user?.email || 'ketan@wealthnest.local',
      name: 'Ketan Vaghela',
      role: 'primary_owner',
      joinedAt: '2026-01-15',
      isSelf: true,
    },
    {
      id: 'mem-user-2',
      email: 'parul@wealthnest.local',
      name: 'Parul Vaghela',
      role: 'member',
      joinedAt: '2026-02-01',
      isSelf: false,
    },
  ]);

  const inviteLink = `${typeof window !== 'undefined' ? window.location.origin : 'http://wealthnest.local'}/signup?household_invite=vaghela-hhd-${user?.id?.slice(0, 8) || 'family'}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    const newMember: HouseholdMember = {
      id: `mem-user-${Date.now()}`,
      email: inviteEmail.trim(),
      name: inviteEmail.split('@')[0] || 'Member',
      role: inviteRole,
      joinedAt: new Date().toISOString().split('T')[0] || '',
      isSelf: false,
    };

    setHouseholdMembers((prev) => [...prev, newMember]);
    setInviteEmail('');
    setInviteSuccess(true);
    setTimeout(() => setInviteSuccess(false), 3000);
  };

  const handleRemoveMember = (id: string) => {
    setHouseholdMembers((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <Card className="bg-card border-border/80">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <CardTitle className="text-base text-foreground">
              Multi-User Household Collaboration (RLS)
            </CardTitle>
          </div>
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-[10px]">
            Household RLS Active
          </Badge>
        </div>
        <CardDescription>
          Invite spouses or adult family members to securely co-manage household holdings with their own logins.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Active Household Members Table */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Active Household Logins ({householdMembers.length})
          </h4>

          <div className="divide-y divide-border/60 rounded-xl border border-border/70 overflow-hidden bg-secondary/20">
            {householdMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3.5 hover:bg-secondary/40 transition-colors text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <span>{member.name}</span>
                      {member.isSelf && (
                        <span className="text-[10px] text-primary font-mono">(You)</span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{member.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Badge
                    variant={member.role === 'primary_owner' ? 'success' : 'secondary'}
                    className="text-[10px] capitalize"
                  >
                    {member.role === 'primary_owner' ? 'Primary Owner' : member.role === 'member' ? 'Co-Manager' : 'Viewer'}
                  </Badge>

                  {!member.isSelf && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.id)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      title="Revoke household access"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invite Household Member Form */}
        <form onSubmit={handleSendInvite} className="p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <UserPlus className="w-4 h-4 text-primary" />
            <span>Invite Family Member to Household</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <input
                type="email"
                required
                placeholder="spouse@family.com or parent@family.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="member">Co-Manager (Read & Write)</option>
                <option value="viewer">Viewer (Read-Only)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-muted-foreground">
              Invited user will access the same family portfolio via their personal credentials.
            </span>
            <Button type="submit" size="sm" className="gap-1.5 text-xs">
              <Mail className="w-3.5 h-3.5" />
              Send Invite
            </Button>
          </div>

          {inviteSuccess && (
            <div className="text-xs text-emerald-400 flex items-center gap-1.5 pt-1">
              <Check className="w-3.5 h-3.5" />
              <span>Invite generated and added to household permissions.</span>
            </div>
          )}
        </form>

        {/* Shareable Household Invite Link */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Shareable Household Invite Link
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={inviteLink}
              className="flex-1 px-3 py-2 text-xs rounded-lg border border-input bg-secondary/50 font-mono text-muted-foreground truncate"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="gap-1.5 text-xs shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

