import { Result, ok, err } from '@wealthnest/shared';
import { FamilyEntityType, RecordVisibility } from '@wealthnest/domain';
import {
  FamilyRepositoryPort,
  FamilyMemberDto,
  PortfolioAccountDto,
} from '@wealthnest/application';
import { supabase } from './client';
import { toValidUuidOrNull } from './uuid-utils';
import { resolveHouseholdIdForWrite } from './household-scope';

export const DEFAULT_DEMO_MEMBERS: FamilyMemberDto[] = [
  {
    id: 'mem-self',
    householdId: 'demo-household-vaghela',
    userId: 'demo-user-001',
    entityType: 'individual',
    name: 'Ketan Vaghela',
    relationship: 'self',
    panMasked: 'ABCDE1234F',
    colorHex: '#3b82f6',
    isPrimary: true,
    notes: 'Age 38 — Freelance Contractor (ex-MNC), Primary Demats & Equity Portfolio',
  },
  {
    id: 'mem-spouse',
    householdId: 'demo-household-vaghela',
    userId: 'demo-user-001',
    entityType: 'individual',
    name: 'Parul Vaghela',
    relationship: 'spouse',
    panMasked: 'BGTYU5678K',
    colorHex: '#ec4899',
    isPrimary: false,
    notes: 'Age 35 — Clerk at Bank of Baroda, Direct Mutual Funds & Demat',
  },
  {
    id: 'mem-child',
    householdId: 'demo-household-vaghela',
    userId: 'demo-user-001',
    entityType: 'minor',
    name: 'Krisha Vaghela',
    relationship: 'child',
    panMasked: 'MINR90123C',
    colorHex: '#10b981',
    isPrimary: false,
    notes: 'Age 6 (1st Standard) — Long-term Higher Education Compounding & Sukanya/MF Fund',
  },
  {
    id: 'mem-huf',
    householdId: 'demo-household-vaghela',
    userId: 'demo-user-001',
    entityType: 'huf',
    name: 'Shamalbhai Vaghela HUF',
    relationship: 'huf',
    panMasked: 'AAACH9999H',
    colorHex: '#8b5cf6',
    isPrimary: false,
    notes: 'Karta: Shamalbhai (Age 68, Retired Govt) — Section 112A ₹1.25L Annual LTCG Tax Shield',
  },
  {
    id: 'mem-mother',
    householdId: 'demo-household-vaghela',
    userId: 'demo-user-001',
    entityType: 'individual',
    name: 'Ramilaben Vaghela',
    relationship: 'parent',
    panMasked: 'PRTYK4321M',
    colorHex: '#f59e0b',
    isPrimary: false,
    notes: 'Age 61 (Housewife) — Senior Citizen FDs & Sovereign Gold Bonds',
  },
];

export const DEFAULT_DEMO_ACCOUNTS: PortfolioAccountDto[] = [
  {
    id: 'acc-zerodha',
    householdId: 'demo-household-vaghela',
    userId: 'demo-user-001',
    memberId: 'mem-self',
    visibility: 'household_shared',
    accountName: 'Zerodha Kite',
    brokerName: 'Zerodha',
    depository: 'CDSL',
    accountNumberMasked: '12081600****1234',
    accountType: 'demat',
  },
  {
    id: 'acc-groww',
    householdId: 'demo-household-vaghela',
    userId: 'demo-user-001',
    memberId: 'mem-spouse',
    visibility: 'household_shared',
    accountName: 'Groww / BoB Direct Demat',
    brokerName: 'Groww',
    depository: 'CDSL',
    accountNumberMasked: '12088700****5678',
    accountType: 'demat',
  },
  {
    id: 'acc-icici',
    householdId: 'demo-household-vaghela',
    userId: 'demo-user-001',
    memberId: 'mem-huf',
    visibility: 'household_shared',
    accountName: 'ICICI Direct HUF',
    brokerName: 'ICICI Direct',
    depository: 'NSDL',
    accountNumberMasked: 'IN300126****9999',
    accountType: 'demat',
  },
  {
    id: 'acc-cams',
    householdId: 'demo-household-vaghela',
    userId: 'demo-user-001',
    memberId: 'mem-child',
    visibility: 'household_shared',
    accountName: 'CAMS / Parag Parikh Folio',
    brokerName: 'CAMS',
    depository: 'CAMS',
    accountNumberMasked: 'MF-FOLIO-****8821',
    accountType: 'mutual_fund_folio',
  },
  {
    id: 'acc-sbi-ppf',
    householdId: 'demo-household-vaghela',
    userId: 'demo-user-001',
    memberId: 'mem-self',
    visibility: 'household_shared',
    accountName: 'SBI PPF & Fixed Income',
    brokerName: 'SBI',
    depository: 'OTHER',
    accountNumberMasked: 'SBI-PPF-****4412',
    accountType: 'ppf_epf',
  },
  {
    id: 'acc-bob-fd',
    householdId: 'demo-household-vaghela',
    userId: 'demo-user-001',
    memberId: 'mem-mother',
    visibility: 'household_shared',
    accountName: 'Bank of Baroda Senior Citizen Deposit',
    brokerName: 'Bank of Baroda',
    depository: 'OTHER',
    accountNumberMasked: 'BOB-FD-****7109',
    accountType: 'savings_bank',
  },
];

export const DEFAULT_DEMO_HOLDINGS_FAMILY = [
  {
    id: 'demo-1',
    memberId: 'mem-self',
    accountId: 'acc-zerodha',
    currentValuePaise: 27500000n,
    costBasisPaise: 24000000n,
    holdingPeriodDays: 450,
    isEquityOrMutualFund: true,
  },
  {
    id: 'demo-2',
    memberId: 'mem-spouse',
    accountId: 'acc-groww',
    currentValuePaise: 11000000n,
    costBasisPaise: 8250000n,
    holdingPeriodDays: 380,
    isEquityOrMutualFund: true,
  },
  {
    id: 'demo-3',
    memberId: 'mem-huf',
    accountId: 'acc-icici',
    currentValuePaise: 16600000n,
    costBasisPaise: 14400000n,
    holdingPeriodDays: 520,
    isEquityOrMutualFund: true,
  },
  {
    id: 'demo-4',
    memberId: 'mem-self',
    accountId: 'acc-zerodha',
    currentValuePaise: 22950000n,
    costBasisPaise: 17400000n,
    holdingPeriodDays: 400,
    isEquityOrMutualFund: false,
  },
  {
    id: 'demo-5',
    memberId: 'mem-child',
    accountId: 'acc-cams',
    currentValuePaise: 12250000n,
    costBasisPaise: 10000000n,
    holdingPeriodDays: 300,
    isEquityOrMutualFund: true,
  },
  {
    id: 'demo-6-mother',
    memberId: 'mem-mother',
    accountId: 'acc-bob-fd',
    currentValuePaise: 15000000n,
    costBasisPaise: 15000000n,
    holdingPeriodDays: 365,
    isEquityOrMutualFund: false,
  },
];

const LOCAL_STORAGE_MEMBERS_KEY = 'wealthnest_family_members';
const LOCAL_STORAGE_ACCOUNTS_KEY = 'wealthnest_family_accounts';

function mapFamilyMemberRow(r: any): FamilyMemberDto {
  return {
    id: r.id,
    householdId: r.household_id,
    userId: r.linked_user_id || r.created_by || r.household_id,
    linkedUserId: r.linked_user_id ?? undefined,
    email: r.email ?? undefined,
    entityType: (r.entity_type || 'individual') as FamilyEntityType,
    name: r.name,
    relationship: r.relationship,
    panMasked: r.pan_masked ?? undefined,
    colorHex: r.color_hex ?? '#3b82f6',
    isPrimary: Boolean(r.is_primary),
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapPortfolioAccountRow(r: any): PortfolioAccountDto {
  return {
    id: r.id,
    householdId: r.household_id,
    userId: r.created_by || r.household_id,
    memberId: r.member_id,
    visibility: (r.visibility || 'household_shared') as RecordVisibility,
    createdBy: r.created_by ?? undefined,
    accountName: r.account_name,
    brokerName: r.broker_name,
    depository: r.depository,
    accountNumberMasked: r.account_number_masked ?? undefined,
    accountType: r.account_type,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class SupabaseFamilyAdapter implements FamilyRepositoryPort {
  private getLocalMembers(): FamilyMemberDto[] {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_MEMBERS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }
    return DEFAULT_DEMO_MEMBERS;
  }

  private saveLocalMembers(members: FamilyMemberDto[]): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_MEMBERS_KEY, JSON.stringify(members));
    } catch {
      // ignore
    }
  }

  private getLocalAccounts(): PortfolioAccountDto[] {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_ACCOUNTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }
    return DEFAULT_DEMO_ACCOUNTS;
  }

  private saveLocalAccounts(accounts: PortfolioAccountDto[]): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch {
      // ignore
    }
  }

  async getMembersByHousehold(householdId: string): Promise<Result<readonly FamilyMemberDto[]>> {
    try {
      if (!householdId || householdId.startsWith('demo-')) {
        return ok(this.getLocalMembers());
      }

      const validHouseholdId = toValidUuidOrNull(householdId);
      if (!validHouseholdId) {
        return ok([]);
      }

      const { data, error } = await supabase
        .from('family_members')
        .select('*')
        .eq('household_id', validHouseholdId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        return err(new Error(`Failed to fetch family members: ${error.message}`));
      }

      return ok((data || []).map(mapFamilyMemberRow));
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to fetch family members'));
    }
  }

  async getMembers(scopeId: string): Promise<Result<readonly FamilyMemberDto[]>> {
    return this.getMembersByHousehold(scopeId);
  }

  async getMemberById(id: string): Promise<Result<FamilyMemberDto | null>> {
    try {
      if (id.startsWith('mem-')) {
        return ok(this.getLocalMembers().find((m) => m.id === id) || null);
      }

      const validId = toValidUuidOrNull(id);
      if (!validId) return ok(null);

      const { data, error } = await supabase
        .from('family_members')
        .select('*')
        .eq('id', validId)
        .maybeSingle();

      if (error) return err(new Error(error.message));
      if (!data) return ok(null);

      return ok(mapFamilyMemberRow(data));
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to fetch family member'));
    }
  }

  async saveMember(member: FamilyMemberDto): Promise<Result<void>> {
    try {
      const isDemo =
        member.id.startsWith('mem-') ||
        (member.householdId && member.householdId.startsWith('demo-')) ||
        (!member.householdId && (!member.userId || member.userId.startsWith('demo-')));

      if (isDemo) {
        const current = this.getLocalMembers();
        const existingIdx = current.findIndex((m) => m.id === member.id);
        if (existingIdx >= 0) {
          current[existingIdx] = member;
        } else {
          current.push(member);
        }
        this.saveLocalMembers(current);
        return ok(undefined);
      }

      const householdId = await resolveHouseholdIdForWrite(member.householdId, member.userId);
      const actorId = toValidUuidOrNull(member.userId);
      const existingId = toValidUuidOrNull(member.id);

      const { error } = await supabase.from('family_members').upsert({
        ...(existingId ? { id: existingId } : {}),
        household_id: householdId,
        entity_type:
          member.entityType === 'huf' || member.entityType === 'minor'
            ? member.entityType
            : 'individual',
        name: member.name,
        relationship: member.relationship,
        pan_masked: member.panMasked ?? null,
        email: member.email?.trim() || null,
        color_hex: member.colorHex,
        is_primary: member.isPrimary,
        notes: member.notes ?? null,
        ...(actorId ? { created_by: actorId, updated_by: actorId } : {}),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        return err(new Error(`Failed to save family member: ${error.message}`));
      }

      return ok(undefined);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to save family member'));
    }
  }

  async deleteMember(id: string): Promise<Result<void>> {
    try {
      if (id.startsWith('mem-')) {
        const current = this.getLocalMembers().filter((m) => m.id !== id);
        this.saveLocalMembers(current);
        return ok(undefined);
      }

      const { error } = await supabase.from('family_members').delete().eq('id', id);
      if (error) {
        return err(new Error(`Failed to delete family member: ${error.message}`));
      }
      return ok(undefined);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to delete family member'));
    }
  }

  async getAccountsByHousehold(householdId: string): Promise<Result<readonly PortfolioAccountDto[]>> {
    try {
      if (!householdId || householdId.startsWith('demo-')) {
        return ok(this.getLocalAccounts());
      }

      const validHouseholdId = toValidUuidOrNull(householdId);
      if (!validHouseholdId) {
        return ok([]);
      }

      const { data, error } = await supabase
        .from('portfolio_accounts')
        .select('*')
        .eq('household_id', validHouseholdId)
        .order('created_at', { ascending: true });

      if (error) {
        return err(new Error(`Failed to fetch accounts: ${error.message}`));
      }

      return ok((data || []).map(mapPortfolioAccountRow));
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to fetch accounts'));
    }
  }

  async getAccounts(scopeId: string): Promise<Result<readonly PortfolioAccountDto[]>> {
    return this.getAccountsByHousehold(scopeId);
  }

  async getAccountById(id: string): Promise<Result<PortfolioAccountDto | null>> {
    try {
      if (id.startsWith('acc-')) {
        return ok(this.getLocalAccounts().find((a) => a.id === id) || null);
      }

      const validId = toValidUuidOrNull(id);
      if (!validId) return ok(null);

      const { data, error } = await supabase
        .from('portfolio_accounts')
        .select('*')
        .eq('id', validId)
        .maybeSingle();

      if (error) return err(new Error(error.message));
      if (!data) return ok(null);

      return ok(mapPortfolioAccountRow(data));
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to fetch account'));
    }
  }

  async saveAccount(account: PortfolioAccountDto): Promise<Result<void>> {
    try {
      const isDemo =
        account.id.startsWith('acc-') ||
        (account.householdId && account.householdId.startsWith('demo-')) ||
        (!account.householdId && (!account.userId || account.userId.startsWith('demo-')));

      if (isDemo) {
        const current = this.getLocalAccounts();
        const existingIdx = current.findIndex((a) => a.id === account.id);
        if (existingIdx >= 0) {
          current[existingIdx] = account;
        } else {
          current.push(account);
        }
        this.saveLocalAccounts(current);
        return ok(undefined);
      }

      const householdId = await resolveHouseholdIdForWrite(account.householdId, account.userId);
      const actorId = toValidUuidOrNull(account.createdBy || account.userId);
      const existingId = toValidUuidOrNull(account.id);

      const { error } = await supabase.from('portfolio_accounts').upsert({
        ...(existingId ? { id: existingId } : {}),
        household_id: householdId,
        member_id: account.memberId,
        visibility: account.visibility ?? 'household_shared',
        account_name: account.accountName,
        broker_name: account.brokerName,
        depository: account.depository,
        account_number_masked: account.accountNumberMasked ?? null,
        account_type: account.accountType,
        ...(actorId ? { created_by: actorId, updated_by: actorId } : {}),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        return err(new Error(`Failed to save account: ${error.message}`));
      }

      return ok(undefined);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to save account'));
    }
  }

  async deleteAccount(id: string): Promise<Result<void>> {
    try {
      if (id.startsWith('acc-')) {
        const current = this.getLocalAccounts().filter((a) => a.id !== id);
        this.saveLocalAccounts(current);
        return ok(undefined);
      }

      const { error } = await supabase.from('portfolio_accounts').delete().eq('id', id);
      if (error) {
        return err(new Error(`Failed to delete account: ${error.message}`));
      }
      return ok(undefined);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to delete account'));
    }
  }
}

export const familyAdapter = new SupabaseFamilyAdapter();
