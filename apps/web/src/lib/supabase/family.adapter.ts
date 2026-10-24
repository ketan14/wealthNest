import { Result, ok, err } from '@wealthnest/shared';
import {
  FamilyRepositoryPort,
  FamilyMemberDto,
  PortfolioAccountDto,
} from '@wealthnest/application';
import { supabase } from './client';

export const DEFAULT_DEMO_MEMBERS: FamilyMemberDto[] = [
  {
    id: 'mem-self',
    userId: 'demo-user-001',
    name: 'Ketan Vaghela',
    relationship: 'self',
    panMasked: 'ABCDE1234F',
    colorHex: '#3b82f6',
    isPrimary: true,
    notes: 'Age 38 — Freelance Contractor (ex-MNC), Primary Demats & Equity Portfolio',
  },
  {
    id: 'mem-spouse',
    userId: 'demo-user-001',
    name: 'Parul Vaghela',
    relationship: 'spouse',
    panMasked: 'BGTYU5678K',
    colorHex: '#ec4899',
    isPrimary: false,
    notes: 'Age 35 — Clerk at Bank of Baroda, Direct Mutual Funds & Demat',
  },
  {
    id: 'mem-child',
    userId: 'demo-user-001',
    name: 'Krisha Vaghela',
    relationship: 'child',
    panMasked: 'MINR90123C',
    colorHex: '#10b981',
    isPrimary: false,
    notes: 'Age 6 (1st Standard) — Long-term Higher Education Compounding & Sukanya/MF Fund',
  },
  {
    id: 'mem-huf',
    userId: 'demo-user-001',
    name: 'Shamalbhai Vaghela HUF',
    relationship: 'huf',
    panMasked: 'AAACH9999H',
    colorHex: '#8b5cf6',
    isPrimary: false,
    notes: 'Karta: Shamalbhai (Age 68, Retired Govt) — Section 112A ₹1.25L Annual LTCG Tax Shield',
  },
  {
    id: 'mem-mother',
    userId: 'demo-user-001',
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
    userId: 'demo-user-001',
    memberId: 'mem-self',
    accountName: 'Zerodha Kite',
    brokerName: 'Zerodha',
    depository: 'CDSL',
    accountNumberMasked: '12081600****1234',
    accountType: 'demat',
  },
  {
    id: 'acc-groww',
    userId: 'demo-user-001',
    memberId: 'mem-spouse',
    accountName: 'Groww / BoB Direct Demat',
    brokerName: 'Groww',
    depository: 'CDSL',
    accountNumberMasked: '12088700****5678',
    accountType: 'demat',
  },
  {
    id: 'acc-icici',
    userId: 'demo-user-001',
    memberId: 'mem-huf',
    accountName: 'ICICI Direct HUF',
    brokerName: 'ICICI Direct',
    depository: 'NSDL',
    accountNumberMasked: 'IN300126****9999',
    accountType: 'demat',
  },
  {
    id: 'acc-cams',
    userId: 'demo-user-001',
    memberId: 'mem-child',
    accountName: 'CAMS / Parag Parikh Folio',
    brokerName: 'CAMS',
    depository: 'CAMS',
    accountNumberMasked: 'MF-FOLIO-****8821',
    accountType: 'mutual_fund_folio',
  },
  {
    id: 'acc-sbi-ppf',
    userId: 'demo-user-001',
    memberId: 'mem-self',
    accountName: 'SBI PPF & Fixed Income',
    brokerName: 'SBI',
    depository: 'OTHER',
    accountNumberMasked: 'SBI-PPF-****4412',
    accountType: 'ppf_epf',
  },
  {
    id: 'acc-bob-fd',
    userId: 'demo-user-001',
    memberId: 'mem-mother',
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

  async getMembers(userId: string): Promise<Result<readonly FamilyMemberDto[]>> {
    try {
      if (!userId || userId.startsWith('demo-')) {
        return ok(this.getLocalMembers());
      }

      const { data, error } = await supabase
        .from('family_members')
        .select('*')
        .eq('user_id', userId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        return ok(this.getLocalMembers());
      }

      if (!data || data.length === 0) {
        // Return default self member if none exist in remote DB
        return ok(this.getLocalMembers());
      }

      const mapped: FamilyMemberDto[] = data.map((r) => ({
        id: r.id,
        userId: r.user_id,
        name: r.name,
        relationship: r.relationship,
        panMasked: r.pan_masked ?? undefined,
        colorHex: r.color_hex ?? '#3b82f6',
        isPrimary: Boolean(r.is_primary),
        notes: r.notes ?? undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));

      return ok(mapped);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to fetch family members'));
    }
  }

  async getMemberById(id: string): Promise<Result<FamilyMemberDto | null>> {
    try {
      const local = this.getLocalMembers().find((m) => m.id === id);
      if (local) return ok(local);

      const { data, error } = await supabase
        .from('family_members')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) return ok(null);

      return ok({
        id: data.id,
        userId: data.user_id,
        name: data.name,
        relationship: data.relationship,
        panMasked: data.pan_masked ?? undefined,
        colorHex: data.color_hex ?? '#3b82f6',
        isPrimary: Boolean(data.is_primary),
        notes: data.notes ?? undefined,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      });
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to fetch family member'));
    }
  }

  async saveMember(member: FamilyMemberDto): Promise<Result<void>> {
    try {
      const current = this.getLocalMembers();
      const existingIdx = current.findIndex((m) => m.id === member.id);
      if (existingIdx >= 0) {
        current[existingIdx] = member;
      } else {
        current.push(member);
      }
      this.saveLocalMembers(current);

      if (!member.userId || member.userId.startsWith('demo-')) {
        return ok(undefined);
      }

      const { error } = await supabase.from('family_members').upsert({
        id: member.id,
        user_id: member.userId,
        name: member.name,
        relationship: member.relationship,
        pan_masked: member.panMasked ?? null,
        color_hex: member.colorHex,
        is_primary: member.isPrimary,
        notes: member.notes ?? null,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.warn('Supabase family member save warning (falling back to local):', error.message);
      }

      return ok(undefined);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to save family member'));
    }
  }

  async deleteMember(id: string): Promise<Result<void>> {
    try {
      const current = this.getLocalMembers().filter((m) => m.id !== id);
      this.saveLocalMembers(current);

      if (id.startsWith('mem-')) {
        return ok(undefined);
      }

      await supabase.from('family_members').delete().eq('id', id);
      return ok(undefined);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to delete family member'));
    }
  }

  async getAccounts(userId: string): Promise<Result<readonly PortfolioAccountDto[]>> {
    try {
      if (!userId || userId.startsWith('demo-')) {
        return ok(this.getLocalAccounts());
      }

      const { data, error } = await supabase
        .from('portfolio_accounts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error || !data || data.length === 0) {
        return ok(this.getLocalAccounts());
      }

      const mapped: PortfolioAccountDto[] = data.map((r) => ({
        id: r.id,
        userId: r.user_id,
        memberId: r.member_id,
        accountName: r.account_name,
        brokerName: r.broker_name,
        depository: r.depository,
        accountNumberMasked: r.account_number_masked ?? undefined,
        accountType: r.account_type,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));

      return ok(mapped);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to fetch accounts'));
    }
  }

  async getAccountById(id: string): Promise<Result<PortfolioAccountDto | null>> {
    try {
      const local = this.getLocalAccounts().find((a) => a.id === id);
      if (local) return ok(local);

      const { data, error } = await supabase
        .from('portfolio_accounts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) return ok(null);

      return ok({
        id: data.id,
        userId: data.user_id,
        memberId: data.member_id,
        accountName: data.account_name,
        brokerName: data.broker_name,
        depository: data.depository,
        accountNumberMasked: data.account_number_masked ?? undefined,
        accountType: data.account_type,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      });
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to fetch account'));
    }
  }

  async saveAccount(account: PortfolioAccountDto): Promise<Result<void>> {
    try {
      const current = this.getLocalAccounts();
      const existingIdx = current.findIndex((a) => a.id === account.id);
      if (existingIdx >= 0) {
        current[existingIdx] = account;
      } else {
        current.push(account);
      }
      this.saveLocalAccounts(current);

      if (!account.userId || account.userId.startsWith('demo-')) {
        return ok(undefined);
      }

      const { error } = await supabase.from('portfolio_accounts').upsert({
        id: account.id,
        user_id: account.userId,
        member_id: account.memberId,
        account_name: account.accountName,
        broker_name: account.brokerName,
        depository: account.depository,
        account_number_masked: account.accountNumberMasked ?? null,
        account_type: account.accountType,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.warn('Supabase account save warning (falling back to local):', error.message);
      }

      return ok(undefined);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to save account'));
    }
  }

  async deleteAccount(id: string): Promise<Result<void>> {
    try {
      const current = this.getLocalAccounts().filter((a) => a.id !== id);
      this.saveLocalAccounts(current);

      if (id.startsWith('acc-')) {
        return ok(undefined);
      }

      await supabase.from('portfolio_accounts').delete().eq('id', id);
      return ok(undefined);
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to delete account'));
    }
  }
}

export const familyAdapter = new SupabaseFamilyAdapter();
