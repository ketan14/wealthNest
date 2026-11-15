import {
  HoldingOwnerShareInput,
  LiabilityPartyRole,
  LiabilityPartyShareInput,
  validateOwnershipShares,
} from '@wealthnest/domain';
import { FamilyMemberDto } from '@wealthnest/application';
import { CheckCircle2, AlertTriangle, Plus, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface HoldingJointEditorProps {
  readonly mode: 'holding';
  readonly members: readonly FamilyMemberDto[];
  readonly shares: readonly HoldingOwnerShareInput[];
  readonly onChange: (shares: HoldingOwnerShareInput[]) => void;
  readonly disabled?: boolean;
}

interface LiabilityJointEditorProps {
  readonly mode: 'liability';
  readonly members: readonly FamilyMemberDto[];
  readonly shares: readonly LiabilityPartyShareInput[];
  readonly onChange: (shares: LiabilityPartyShareInput[]) => void;
  readonly disabled?: boolean;
}

type JointOwnershipEditorProps = HoldingJointEditorProps | LiabilityJointEditorProps;

export function JointOwnershipEditor(props: JointOwnershipEditorProps) {
  const { members, disabled = false } = props;

  if (members.length === 0) {
    return (
      <div className="p-3 rounded-xl bg-secondary/20 border border-border/50 text-xs text-muted-foreground">
        No family members configured yet.
      </div>
    );
  }

  const normalizedPercentages =
    props.mode === 'holding'
      ? props.shares.map((s) => ({
          familyMemberId: s.familyMemberId,
          sharePercentage: s.ownershipShare,
        }))
      : props.shares.map((s) => ({
          familyMemberId: s.familyMemberId,
          sharePercentage: s.liabilityShare,
        }));

  const validation = validateOwnershipShares(normalizedPercentages);
  const totalPct = normalizedPercentages.reduce(
    (sum, item) => sum + Number(item.sharePercentage || 0),
    0
  );

  const usedMemberIds = new Set(normalizedPercentages.map((s) => s.familyMemberId));
  const availableMembers = members.filter((m) => !usedMemberIds.has(m.id));

  const handleEvenSplit = () => {
    const count = props.shares.length;
    if (count === 0) return;
    const base = Math.floor((100 / count) * 100) / 100;
    const firstShare = Number((100 - base * (count - 1)).toFixed(2));

    if (props.mode === 'holding') {
      props.onChange(
        props.shares.map((item, idx) => ({
          ...item,
          ownershipShare: idx === 0 ? firstShare : base,
          isPrimaryOwner: idx === 0 ? true : Boolean(item.isPrimaryOwner),
        }))
      );
    } else {
      props.onChange(
        props.shares.map((item, idx) => ({
          ...item,
          liabilityShare: idx === 0 ? firstShare : base,
        }))
      );
    }
  };

  const handleAddRow = () => {
    const nextMember = availableMembers[0];
    if (!nextMember) return;

    if (props.mode === 'holding') {
      const nextList = [
        ...props.shares,
        { familyMemberId: nextMember.id, ownershipShare: 0, isPrimaryOwner: props.shares.length === 0 },
      ];
      props.onChange(nextList);
    } else {
      const nextList: LiabilityPartyShareInput[] = [
        ...props.shares,
        {
          familyMemberId: nextMember.id,
          partyRole: props.shares.length === 0 ? 'primary_borrower' : 'co_borrower',
          liabilityShare: 0,
        },
      ];
      props.onChange(nextList);
    }
  };

  const handleRemoveRow = (idx: number) => {
    if (props.shares.length <= 1) return;
    if (props.mode === 'holding') {
      const filtered = props.shares.filter((_, i) => i !== idx);
      if (filtered.length === 1 && filtered[0]) {
        props.onChange([{ ...filtered[0], ownershipShare: 100, isPrimaryOwner: true }]);
      } else {
        props.onChange(filtered);
      }
    } else {
      const filtered = props.shares.filter((_, i) => i !== idx);
      if (filtered.length === 1 && filtered[0]) {
        props.onChange([{ ...filtered[0], partyRole: 'primary_borrower', liabilityShare: 100 }]);
      } else {
        props.onChange(filtered);
      }
    }
  };

  return (
    <div className="space-y-2.5 p-3 rounded-xl bg-secondary/25 border border-border/60">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Users className="w-3.5 h-3.5 text-primary" />
          <span>
            {props.mode === 'holding'
              ? 'Legal Owners & Joint Share (%)'
              : 'Borrowers & Liability Split (%)'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {props.shares.length > 1 && (
            <button
              type="button"
              disabled={disabled}
              onClick={handleEvenSplit}
              className="text-[11px] font-medium text-primary hover:underline disabled:opacity-50"
            >
              Split Evenly
            </button>
          )}
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full border ${
              validation.valid
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            {validation.valid ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <AlertTriangle className="w-3 h-3" />
            )}
            <span>Total {totalPct.toFixed(totalPct % 1 === 0 ? 0 : 2)}%</span>
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {props.mode === 'holding'
          ? props.shares.map((share, idx) => (
              <div key={`${share.familyMemberId}-${idx}`} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-6 sm:col-span-6">
                  <select
                    disabled={disabled}
                    value={share.familyMemberId}
                    onChange={(e) => {
                      const updated = [...props.shares];
                      updated[idx] = { ...share, familyMemberId: e.target.value };
                      props.onChange(updated);
                    }}
                    className="w-full h-8 px-2.5 text-xs rounded-lg border border-input bg-background text-foreground"
                  >
                    {members.map((m) => (
                      <option
                        key={m.id}
                        value={m.id}
                        disabled={m.id !== share.familyMemberId && usedMemberIds.has(m.id)}
                      >
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-3 sm:col-span-3">
                  <div className="relative">
                    <input
                      type="number"
                      min="0.01"
                      max="100"
                      step="0.01"
                      disabled={disabled}
                      value={share.ownershipShare}
                      onChange={(e) => {
                        const updated = [...props.shares];
                        updated[idx] = {
                          ...share,
                          ownershipShare: Number(e.target.value) || 0,
                        };
                        props.onChange(updated);
                      }}
                      className="w-full h-8 pl-2.5 pr-6 text-xs rounded-lg border border-input bg-background text-foreground font-mono"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>

                <div className="col-span-3 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      props.onChange(
                        props.shares.map((item, i) => ({
                          ...item,
                          isPrimaryOwner: i === idx,
                        }))
                      );
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${
                      share.isPrimaryOwner
                        ? 'bg-primary/15 border-primary/40 text-primary'
                        : 'bg-background/50 border-border text-muted-foreground hover:text-foreground'
                    }`}
                    title="Set as primary owner"
                  >
                    Primary
                  </button>
                  {props.shares.length > 1 && (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleRemoveRow(idx)}
                      className="p-1 text-muted-foreground hover:text-destructive"
                      title="Remove owner"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          : props.shares.map((party, idx) => (
              <div key={`${party.familyMemberId}-${idx}`} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <select
                    disabled={disabled}
                    value={party.familyMemberId}
                    onChange={(e) => {
                      const updated = [...props.shares];
                      updated[idx] = { ...party, familyMemberId: e.target.value };
                      props.onChange(updated);
                    }}
                    className="w-full h-8 px-2.5 text-xs rounded-lg border border-input bg-background text-foreground"
                  >
                    {members.map((m) => (
                      <option
                        key={m.id}
                        value={m.id}
                        disabled={m.id !== party.familyMemberId && usedMemberIds.has(m.id)}
                      >
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-4">
                  <select
                    disabled={disabled}
                    value={party.partyRole}
                    onChange={(e) => {
                      const updated = [...props.shares];
                      updated[idx] = { ...party, partyRole: e.target.value as LiabilityPartyRole };
                      props.onChange(updated);
                    }}
                    className="w-full h-8 px-2 text-xs rounded-lg border border-input bg-background text-foreground"
                  >
                    <option value="primary_borrower">Primary Borrower</option>
                    <option value="co_borrower">Co-Borrower</option>
                    <option value="guarantor">Guarantor</option>
                  </select>
                </div>

                <div className="col-span-3 flex items-center gap-1">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      disabled={disabled}
                      value={party.liabilityShare}
                      onChange={(e) => {
                        const updated = [...props.shares];
                        updated[idx] = {
                          ...party,
                          liabilityShare: Number(e.target.value) || 0,
                        };
                        props.onChange(updated);
                      }}
                      className="w-full h-8 pl-2 pr-5 text-xs rounded-lg border border-input bg-background text-foreground font-mono"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                      %
                    </span>
                  </div>
                  {props.shares.length > 1 && (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleRemoveRow(idx)}
                      className="p-1 text-muted-foreground hover:text-destructive shrink-0"
                      title="Remove party"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
      </div>

      {!validation.valid && validation.error && (
        <p className="text-[11px] text-amber-300 font-medium">{validation.error}</p>
      )}

      {availableMembers.length > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={handleAddRow}
          className="h-7 text-[11px] gap-1 border-dashed border-border"
        >
          <Plus className="w-3 h-3" />
          <span>{props.mode === 'holding' ? 'Add Joint Co-Owner' : 'Add Co-Borrower'}</span>
        </Button>
      )}
    </div>
  );
}
