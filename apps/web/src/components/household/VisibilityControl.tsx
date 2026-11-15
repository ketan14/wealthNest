import { useEffect, useState } from 'react';
import {
  HouseholdAccessMember,
  RECORD_VISIBILITY_OPTIONS,
  RecordVisibility,
} from '@wealthnest/domain';
import { isOk } from '@wealthnest/shared';
import { Lock, Users, UserCheck } from 'lucide-react';
import { useAuth } from '@/lib/supabase/auth-context';
import { useHousehold } from '@/lib/supabase/household-context';
import { useRepositories } from '@/lib/persistence/repository-context';
import { toValidUuidOrNull } from '@/lib/supabase/uuid-utils';

interface VisibilityControlProps {
  readonly visibility: RecordVisibility;
  readonly onChange: (visibility: RecordVisibility) => void;
  readonly granteeUserIds?: readonly string[];
  readonly onGranteeUserIdsChange?: (userIds: string[]) => void;
  readonly disabled?: boolean;
  readonly compact?: boolean;
}

export function VisibilityControl({
  visibility,
  onChange,
  granteeUserIds = [],
  onGranteeUserIdsChange,
  disabled = false,
  compact = false,
}: VisibilityControlProps) {
  const { user } = useAuth();
  const { activeHouseholdId } = useHousehold();
  const { householdRepo } = useRepositories();
  const [accessMembers, setAccessMembers] = useState<readonly HouseholdAccessMember[]>([]);

  useEffect(() => {
    let active = true;
    const validHouseholdId = toValidUuidOrNull(activeHouseholdId);
    if (visibility !== 'restricted' || !validHouseholdId) {
      setAccessMembers([]);
      return;
    }

    householdRepo.listAccessMembers(validHouseholdId).then((res) => {
      if (!active || !isOk(res)) return;
      setAccessMembers(
        res.value.filter((m) => m.status === 'active' && m.userId !== user?.id)
      );
    });

    return () => {
      active = false;
    };
  }, [activeHouseholdId, householdRepo, user?.id, visibility]);

  const toggleGrantee = (targetUserId: string) => {
    if (!onGranteeUserIdsChange) return;
    if (granteeUserIds.includes(targetUserId)) {
      onGranteeUserIdsChange(granteeUserIds.filter((id) => id !== targetUserId));
    } else {
      onGranteeUserIdsChange([...granteeUserIds, targetUserId]);
    }
  };

  return (
    <div className="space-y-2.5 p-3 rounded-xl bg-secondary/25 border border-border/60">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          {visibility === 'owner_only' ? (
            <Lock className="w-3.5 h-3.5 text-amber-400" />
          ) : visibility === 'restricted' ? (
            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
          ) : (
            <Users className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span>Record Visibility &amp; Privacy</span>
        </label>
        <span className="text-[10px] text-muted-foreground font-mono uppercase">
          RLS Enforced
        </span>
      </div>

      <div className={compact ? 'grid grid-cols-1 sm:grid-cols-3 gap-2' : 'space-y-1.5'}>
        {RECORD_VISIBILITY_OPTIONS.map((opt) => {
          const selected = visibility === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={`text-left p-2.5 rounded-lg border transition-all ${
                selected
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border/60 bg-background/50 text-muted-foreground hover:text-foreground hover:border-border'
              } disabled:opacity-50`}
            >
              <div className="text-xs font-semibold">{opt.label}</div>
              {!compact && (
                <div className="text-[11px] opacity-85 mt-0.5 leading-snug">{opt.description}</div>
              )}
            </button>
          );
        })}
      </div>

      {visibility === 'restricted' && onGranteeUserIdsChange && (
        <div className="pt-1.5 border-t border-border/50 space-y-1.5">
          <div className="text-[11px] font-medium text-muted-foreground">
            Grant access to specific household logins (admins cannot see unless selected):
          </div>
          {accessMembers.length === 0 ? (
            <div className="text-[11px] text-muted-foreground italic">
              No other active logins in this household yet. Only you and linked owners will have access.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {accessMembers.map((member) => {
                const checked = granteeUserIds.includes(member.userId);
                return (
                  <button
                    key={member.userId}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleGrantee(member.userId)}
                    className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                      checked
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 font-medium'
                        : 'bg-background/60 border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {member.displayName || member.email || 'Member'}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
