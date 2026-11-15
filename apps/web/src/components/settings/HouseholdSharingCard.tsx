import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  UserPlus,
  Shield,
  Copy,
  Check,
  Mail,
  Trash2,
  Home,
  Crown,
  Unlink,
  RefreshCw,
  History,
  Plus,
  Edit3,
  RotateCcw,
  UserX,
} from 'lucide-react';
import { isOk } from '@wealthnest/shared';
import {
  HouseholdAccessMember,
  HouseholdAuditLogEntry,
  HouseholdInvitation,
  HouseholdRole,
} from '@wealthnest/domain';
import { useAuth } from '@/lib/supabase/auth-context';
import { useHousehold } from '@/lib/supabase/household-context';
import { useFamily } from '@/lib/family/family-context';
import { useRepositories } from '@/lib/persistence/repository-context';

function formatRoleLabel(role: HouseholdRole): string {
  switch (role) {
    case 'primary_owner':
      return 'Primary Owner';
    case 'admin':
      return 'Admin';
    case 'member':
      return 'Member';
    case 'viewer':
      return 'Viewer';
  }
}

function getRoleBadgeClass(role: HouseholdRole): string {
  switch (role) {
    case 'primary_owner':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'admin':
      return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
    case 'member':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'viewer':
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  }
}

export function HouseholdSharingCard() {
  const { user } = useAuth();
  const {
    households,
    activeHousehold,
    activeHouseholdId,
    householdRole,
    canManageMembers,
    canManageAdminsOrTransfer,
    refreshHouseholds,
    createHousehold,
    renameHousehold,
    switchHousehold,
  } = useHousehold();
  const { members: familyMembers, refreshFamilyData } = useFamily();
  const { householdRepo, mode } = useRepositories();

  const isDemoMode = mode === 'supabase' && (!user?.id || user.id.startsWith('demo-'));

  const [accessMembers, setAccessMembers] = useState<readonly HouseholdAccessMember[]>([]);
  const [invitations, setInvitations] = useState<readonly HouseholdInvitation[]>([]);
  const [auditLogs, setAuditLogs] = useState<readonly HouseholdAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Household rename / create state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [isCreatingHousehold, setIsCreatingHousehold] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<HouseholdRole, 'primary_owner'>>('member');
  const [inviteFamilyMemberId, setInviteFamilyMemberId] = useState<string>('');
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Two-step inline confirmation for ownership transfer
  const [confirmTransferUserId, setConfirmTransferUserId] = useState<string | null>(null);

  const unlinkedFamilyMembers = useMemo(
    () => familyMembers.filter((m) => !m.linkedUserId),
    [familyMembers]
  );

  const loadGovernanceData = useCallback(async () => {
    if (!activeHouseholdId || isDemoMode) {
      setAccessMembers([]);
      setInvitations([]);
      setAuditLogs([]);
      return;
    }

    setLoading(true);
    try {
      const [membersRes, invitesRes, logsRes] = await Promise.all([
        householdRepo.listAccessMembers(activeHouseholdId),
        householdRepo.listInvitations(activeHouseholdId),
        canManageMembers
          ? householdRepo.listAuditLogs(activeHouseholdId, 20)
          : Promise.resolve(null),
      ]);

      if (isOk(membersRes)) {
        setAccessMembers(membersRes.value);
      }
      if (isOk(invitesRes)) {
        setInvitations(invitesRes.value);
      }
      if (logsRes && isOk(logsRes)) {
        setAuditLogs(logsRes.value);
      }
    } catch (e: any) {
      setFeedback({ type: 'error', text: e?.message || 'Failed to load household governance.' });
    } finally {
      setLoading(false);
    }
  }, [activeHouseholdId, canManageMembers, householdRepo, isDemoMode]);

  useEffect(() => {
    setConfirmTransferUserId(null);
    setLatestInviteUrl(null);
    setFeedback(null);
    setIsRenaming(false);
    loadGovernanceData();
  }, [loadGovernanceData]);

  // Keep inviteRole valid if user loses admin grant permission
  useEffect(() => {
    if (!canManageAdminsOrTransfer && inviteRole === 'admin') {
      setInviteRole('member');
    }
  }, [canManageAdminsOrTransfer, inviteRole]);

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHouseholdId || !renameDraft.trim()) return;
    setBusyAction('rename');
    setFeedback(null);
    const okRenamed = await renameHousehold(activeHouseholdId, renameDraft.trim());
    setBusyAction(null);
    if (okRenamed) {
      setIsRenaming(false);
      setFeedback({ type: 'success', text: 'Household name updated.' });
      await loadGovernanceData();
    } else {
      setFeedback({ type: 'error', text: 'Unable to rename household.' });
    }
  };

  const handleCreateHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHouseholdName.trim()) return;
    setBusyAction('create-household');
    setFeedback(null);
    const created = await createHousehold(newHouseholdName.trim());
    setBusyAction(null);
    if (created) {
      setNewHouseholdName('');
      setIsCreatingHousehold(false);
      switchHousehold(created.id);
      setFeedback({ type: 'success', text: `Created and switched to "${created.name}".` });
    } else {
      setFeedback({ type: 'error', text: 'Unable to create household.' });
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHouseholdId || !inviteEmail.trim()) return;
    setBusyAction('invite');
    setFeedback(null);
    setLatestInviteUrl(null);

    const res = await householdRepo.createInvitation({
      householdId: activeHouseholdId,
      invitedEmail: inviteEmail.trim(),
      role: inviteRole,
      familyMemberId: inviteFamilyMemberId || undefined,
    });
    setBusyAction(null);

    if (!isOk(res)) {
      setFeedback({ type: 'error', text: res.error.message });
      return;
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteUrl = `${origin}/invite?token=${encodeURIComponent(res.value.inviteToken)}`;
    setLatestInviteUrl(inviteUrl);
    setInviteEmail('');
    setInviteFamilyMemberId('');
    setFeedback({
      type: 'success',
      text: `Invitation generated for ${res.value.invitedEmail}. Share the one-time link below.`,
    });
    await loadGovernanceData();
  };

  const handleCopyInvite = async () => {
    if (!latestInviteUrl || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(latestInviteUrl);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      setFeedback({ type: 'error', text: 'Clipboard copy failed. Copy the link manually.' });
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    setBusyAction(`revoke-inv-${invitationId}`);
    setFeedback(null);
    const res = await householdRepo.revokeInvitation(invitationId);
    setBusyAction(null);
    if (!isOk(res)) {
      setFeedback({ type: 'error', text: res.error.message });
      return;
    }
    await loadGovernanceData();
  };

  const handleSetMemberRole = async (
    targetUserId: string,
    nextRole: Exclude<HouseholdRole, 'primary_owner'>
  ) => {
    if (!activeHouseholdId) return;
    setBusyAction(`role-${targetUserId}`);
    setFeedback(null);
    const res = await householdRepo.setMemberRole(activeHouseholdId, targetUserId, nextRole);
    setBusyAction(null);
    if (!isOk(res)) {
      setFeedback({ type: 'error', text: res.error.message });
      return;
    }
    await loadGovernanceData();
  };

  const handleAppointAdmin = async (targetUserId: string, grant: boolean) => {
    if (!activeHouseholdId) return;
    setBusyAction(`admin-${targetUserId}`);
    setFeedback(null);
    const res = await householdRepo.appointAdmin(activeHouseholdId, targetUserId, grant);
    setBusyAction(null);
    if (!isOk(res)) {
      setFeedback({ type: 'error', text: res.error.message });
      return;
    }
    setFeedback({
      type: 'success',
      text: grant ? 'Member appointed as Household Admin.' : 'Admin privilege removed.',
    });
    await loadGovernanceData();
  };

  const handleRevokeOrRestore = async (member: HouseholdAccessMember) => {
    if (!activeHouseholdId) return;
    const nextStatus = member.status === 'active' ? 'revoked' : 'active';
    setBusyAction(`status-${member.userId}`);
    setFeedback(null);
    const res = await householdRepo.revokeOrRestoreMember(
      activeHouseholdId,
      member.userId,
      nextStatus
    );
    setBusyAction(null);
    if (!isOk(res)) {
      setFeedback({ type: 'error', text: res.error.message });
      return;
    }
    await loadGovernanceData();
  };

  const handleTransferOwnership = async (newOwnerUserId: string) => {
    if (!activeHouseholdId) return;
    setBusyAction(`transfer-${newOwnerUserId}`);
    setFeedback(null);
    const res = await householdRepo.transferPrimaryOwner(activeHouseholdId, newOwnerUserId);
    setBusyAction(null);
    setConfirmTransferUserId(null);
    if (!isOk(res)) {
      setFeedback({ type: 'error', text: res.error.message });
      return;
    }
    setFeedback({
      type: 'success',
      text: 'Primary ownership transferred. Your role is now Household Admin.',
    });
    await Promise.all([refreshHouseholds(activeHouseholdId), loadGovernanceData()]);
  };

  const handleUnlinkFamilyMember = async (familyMemberId: string) => {
    if (!activeHouseholdId) return;
    setBusyAction(`unlink-${familyMemberId}`);
    setFeedback(null);
    const res = await householdRepo.unlinkFamilyMemberAccount(activeHouseholdId, familyMemberId);
    setBusyAction(null);
    if (!isOk(res)) {
      setFeedback({ type: 'error', text: res.error.message });
      return;
    }
    setFeedback({ type: 'success', text: 'Login unlinked from family financial profile.' });
    await Promise.all([loadGovernanceData(), refreshFamilyData()]);
  };

  return (
    <Card className="border-indigo-500/20">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="w-5 h-5 text-indigo-400" />
              Household Access Control &amp; Multi-User Governance
            </CardTitle>
            <CardDescription className="mt-1">
              Manage active household workspaces, invite family logins, assign Admins/Viewers, and
              enforce Postgres RLS record privacy.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {householdRole && (
              <Badge variant="outline" className={getRoleBadgeClass(householdRole)}>
                {formatRoleLabel(householdRole)}
              </Badge>
            )}
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
            >
              RLS Enforced
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {feedback && (
          <div
            className={`px-3 py-2.5 rounded-lg text-xs border ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Active Household Selector & Management */}
        <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/70 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Home className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">
                  {activeHousehold?.name || 'No Household Selected'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {households.length} household{households.length === 1 ? '' : 's'} accessible on
                  this account
                </div>
              </div>
            </div>

            {!isDemoMode && (
              <div className="flex flex-wrap items-center gap-2">
                {canManageMembers && activeHousehold && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRenameDraft(activeHousehold.name);
                      setIsRenaming((prev) => !prev);
                    }}
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                    Rename
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreatingHousehold((prev) => !prev)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  New Household
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadGovernanceData}
                  disabled={loading}
                  title="Refresh access list"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            )}
          </div>

          {households.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-muted-foreground mr-1">Switch workspace:</span>
              {households.map((hh) => (
                <button
                  key={hh.id}
                  type="button"
                  onClick={() => switchHousehold(hh.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    hh.id === activeHouseholdId
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                      : 'bg-background/60 text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  {hh.name} ({formatRoleLabel(hh.role)})
                </button>
              ))}
            </div>
          )}

          {isRenaming && (
            <form onSubmit={handleRenameSubmit} className="flex flex-wrap items-center gap-2 pt-2">
              <input
                type="text"
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                placeholder="Household name"
                className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg bg-background border border-border text-sm"
                required
              />
              <Button type="submit" size="sm" disabled={busyAction === 'rename'}>
                Save Name
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsRenaming(false)}
              >
                Cancel
              </Button>
            </form>
          )}

          {isCreatingHousehold && (
            <form
              onSubmit={handleCreateHousehold}
              className="flex flex-wrap items-center gap-2 pt-2"
            >
              <input
                type="text"
                value={newHouseholdName}
                onChange={(e) => setNewHouseholdName(e.target.value)}
                placeholder="e.g., Shinde Parental Household"
                className="flex-1 min-w-[220px] px-3 py-1.5 rounded-lg bg-background border border-border text-sm"
                required
              />
              <Button type="submit" size="sm" disabled={busyAction === 'create-household'}>
                Create Household
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsCreatingHousehold(false)}
              >
                Cancel
              </Button>
            </form>
          )}
        </div>

        {isDemoMode ? (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs text-amber-200">
            <p className="font-semibold text-amber-300">
              Demo Preview Active — Sign in to manage real household governance
            </p>
            <p className="text-amber-200/80">
              When authenticated, Primary Owners can appoint or remove Admins, transfer ownership,
              issue signed one-time invitations linked to existing family profiles (keeping unlinked
              members like Parents, Children, or HUFs intact without logins), and audit changes.
            </p>
          </div>
        ) : (
          <>
            {/* Authorized Login Accounts */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Authorized Logins ({accessMembers.length})
                </h4>
                <span className="text-[11px] text-muted-foreground">
                  Only Primary Owners can appoint Admins or transfer ownership
                </span>
              </div>

              {loading && accessMembers.length === 0 ? (
                <div className="text-xs text-muted-foreground py-4">Loading access members...</div>
              ) : accessMembers.length === 0 ? (
                <div className="text-xs text-muted-foreground py-4">
                  No active user logins loaded for this household.
                </div>
              ) : (
                <div className="space-y-2">
                  {accessMembers.map((member) => {
                    const isSelf = member.userId === user?.id;
                    const isPrimaryOwner = member.householdRole === 'primary_owner';
                    const isAdminTarget = member.householdRole === 'admin';
                    const canChangeRoleOrRevoke =
                      canManageMembers &&
                      !isSelf &&
                      !isPrimaryOwner &&
                      (!isAdminTarget || canManageAdminsOrTransfer);

                    return (
                      <div
                        key={member.id}
                        className="p-3 rounded-lg bg-secondary/30 border border-border/50 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-semibold text-xs shrink-0">
                              {(member.displayName || member.email || 'U')
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-sm font-medium truncate">
                                  {member.displayName || member.email || member.userId.slice(0, 8)}
                                </span>
                                {isSelf && (
                                  <span className="text-[10px] text-indigo-400">(You)</span>
                                )}
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${getRoleBadgeClass(member.householdRole)}`}
                                >
                                  {formatRoleLabel(member.householdRole)}
                                </Badge>
                                {member.status === 'revoked' && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] bg-red-500/10 text-red-400 border-red-500/30"
                                  >
                                    Revoked
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-0.5">
                                {member.email && <span>{member.email}</span>}
                                {member.linkedFamilyMemberName && (
                                  <span className="text-emerald-400/90">
                                    • Profile: {member.linkedFamilyMemberName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {canManageMembers && member.linkedFamilyMemberId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-muted-foreground hover:text-amber-300"
                                disabled={busyAction === `unlink-${member.linkedFamilyMemberId}`}
                                onClick={() =>
                                  handleUnlinkFamilyMember(member.linkedFamilyMemberId!)
                                }
                                title="Detach login from family member financial profile"
                              >
                                <Unlink className="w-3.5 h-3.5 mr-1" />
                                Unlink Profile
                              </Button>
                            )}

                            {canChangeRoleOrRevoke &&
                              member.status === 'active' &&
                              !isAdminTarget && (
                                <select
                                  aria-label={`Role for ${member.email || member.displayName || member.userId}`}
                                  value={member.householdRole === 'viewer' ? 'viewer' : 'member'}
                                  disabled={busyAction === `role-${member.userId}`}
                                  onChange={(e) =>
                                    handleSetMemberRole(
                                      member.userId,
                                      e.target.value as 'member' | 'viewer'
                                    )
                                  }
                                  className="h-7 px-2 rounded bg-background border border-border text-xs"
                                >
                                  <option value="member">Member</option>
                                  <option value="viewer">Viewer</option>
                                </select>
                              )}

                            {canManageAdminsOrTransfer && !isSelf && !isPrimaryOwner && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={busyAction === `admin-${member.userId}`}
                                onClick={() =>
                                  handleAppointAdmin(member.userId, !isAdminTarget)
                                }
                              >
                                <Shield className="w-3 h-3 mr-1" />
                                {isAdminTarget ? 'Remove Admin' : 'Make Admin'}
                              </Button>
                            )}

                            {canManageAdminsOrTransfer &&
                              !isSelf &&
                              !isPrimaryOwner &&
                              member.status === 'active' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                                  onClick={() => setConfirmTransferUserId(member.userId)}
                                >
                                  <Crown className="w-3 h-3 mr-1" />
                                  Transfer Owner
                                </Button>
                              )}

                            {canChangeRoleOrRevoke && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-7 text-xs ${
                                  member.status === 'active'
                                    ? 'text-red-400 hover:bg-red-500/10'
                                    : 'text-emerald-400 hover:bg-emerald-500/10'
                                }`}
                                disabled={busyAction === `status-${member.userId}`}
                                onClick={() => handleRevokeOrRestore(member)}
                              >
                                {member.status === 'active' ? (
                                  <>
                                    <UserX className="w-3.5 h-3.5 mr-1" />
                                    Revoke
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                    Restore
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>

                        {confirmTransferUserId === member.userId && (
                          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="text-amber-200">
                              Transfer Primary Ownership of{' '}
                              <strong>{activeHousehold?.name}</strong> to{' '}
                              <strong>{member.displayName || member.email}</strong>? You will become
                              an Admin.
                            </span>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                className="h-7 bg-amber-600 hover:bg-amber-700 text-white"
                                disabled={busyAction === `transfer-${member.userId}`}
                                onClick={() => handleTransferOwnership(member.userId)}
                              >
                                Confirm Transfer
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7"
                                onClick={() => setConfirmTransferUserId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Invite New Member */}
            {canManageMembers && (
              <div className="space-y-3 pt-2 border-t border-border/50">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                  Invite Family Member / Advisor
                </h4>
                <form
                  onSubmit={handleSendInvite}
                  className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center"
                >
                  <div className="md:col-span-5 relative">
                    <Mail className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="family.member@example.com"
                      className="w-full pl-8 pr-3 py-2 text-xs rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <select
                      aria-label="Invitation role"
                      value={inviteRole}
                      onChange={(e) =>
                        setInviteRole(e.target.value as Exclude<HouseholdRole, 'primary_owner'>)
                      }
                      className="w-full px-2.5 py-2 text-xs rounded-lg bg-background border border-border"
                    >
                      {canManageAdminsOrTransfer && <option value="admin">Admin</option>}
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <select
                      aria-label="Link existing family profile"
                      value={inviteFamilyMemberId}
                      onChange={(e) => setInviteFamilyMemberId(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs rounded-lg bg-background border border-border"
                    >
                      <option value="">Auto / New Profile</option>
                      {unlinkedFamilyMembers.map((fm) => (
                        <option key={fm.id} value={fm.id}>
                          Link: {fm.name} ({fm.relationship})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={busyAction === 'invite'}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      Create Invite
                    </Button>
                  </div>
                </form>

                {latestInviteUrl && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                    <div className="text-xs font-medium text-emerald-300">
                      One-Time Invitation Link Ready (requires verified matching email):
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-[11px] bg-background/80 px-2.5 py-1.5 rounded border border-border/50 truncate text-muted-foreground">
                        {latestInviteUrl}
                      </code>
                      <Button variant="outline" size="sm" onClick={handleCopyInvite}>
                        {copiedInvite ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span className="ml-1.5 text-xs">
                          {copiedInvite ? 'Copied' : 'Copy Link'}
                        </span>
                      </Button>
                    </div>
                  </div>
                )}

                {invitations.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-medium text-muted-foreground">
                      Invitations ({invitations.length})
                    </div>
                    {invitations.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-secondary/20 border border-border/40 text-xs"
                      >
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span className="font-medium truncate">{inv.invitedEmail}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {formatRoleLabel(inv.householdRole)}
                          </Badge>
                          {inv.familyMemberName && (
                            <span className="text-muted-foreground">
                              → {inv.familyMemberName}
                            </span>
                          )}
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              inv.status === 'pending'
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                : inv.status === 'accepted'
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                  : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                            }`}
                          >
                            {inv.status}
                          </Badge>
                        </div>
                        {inv.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[11px] text-red-400 hover:bg-red-500/10"
                            disabled={busyAction === `revoke-inv-${inv.id}`}
                            onClick={() => handleRevokeInvitation(inv.id)}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Revoke
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Governance Audit Log */}
            {canManageMembers && auditLogs.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/50">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <History className="w-3.5 h-3.5 text-indigo-400" />
                  Recent Governance Audit Log
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                  {auditLogs.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-secondary/20 text-[11px]"
                    >
                      <span className="font-mono text-foreground">{entry.action}</span>
                      <span className="text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
