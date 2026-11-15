import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  FamilyMemberDto,
  PortfolioAccountDto,
  GetFamilyPortfolioSummaryUseCase,
  ManageFamilyMembersUseCase,
  ManagePortfolioAccountsUseCase,
} from '@wealthnest/application';
import {
  AccountVisibilityScope,
  FamilyPortfolioSummary,
  HouseholdPrivacySummary,
  calculateFamilyPortfolioSummary,
  summarizeHouseholdPrivacy,
} from '@wealthnest/domain';
import { isOk } from '@wealthnest/shared';
import { useAuth } from '../supabase/auth-context';
import { useHousehold, DEMO_HOUSEHOLD_SUMMARY } from '../supabase/household-context';
import {
  DEFAULT_DEMO_MEMBERS,
  DEFAULT_DEMO_ACCOUNTS,
  DEFAULT_DEMO_HOLDINGS_FAMILY,
} from '../supabase/family.adapter';
import { useRepositories } from '../persistence/repository-context';

interface FamilyContextType {
  members: FamilyMemberDto[];
  accounts: PortfolioAccountDto[];
  selectedMemberId: string | 'all';
  selectedAccountId: string | 'all';
  setSelectedMemberId: (id: string | 'all') => void;
  setSelectedAccountId: (id: string | 'all') => void;
  activeMember: FamilyMemberDto | null;
  activeAccount: PortfolioAccountDto | null;
  familySummary: FamilyPortfolioSummary | null;
  isLoading: boolean;
  refreshFamilyData: () => Promise<void>;
  createMember: (params: {
    name: string;
    relationship: FamilyMemberDto['relationship'];
    email?: string;
    entityType?: FamilyMemberDto['entityType'];
    panMasked?: string;
    colorHex?: string;
    isPrimary?: boolean;
    notes?: string;
  }) => Promise<FamilyMemberDto | null>;
  updateMember: (member: FamilyMemberDto) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  createAccount: (params: {
    memberId: string;
    accountName: string;
    brokerName: string;
    depository?: PortfolioAccountDto['depository'];
    accountNumberMasked?: string;
    accountType?: PortfolioAccountDto['accountType'];
    visibility?: PortfolioAccountDto['visibility'];
  }) => Promise<PortfolioAccountDto | null>;
  updateAccount: (account: PortfolioAccountDto) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  privacyRules: Record<string, AccountVisibilityScope>;
  privacySummary: HouseholdPrivacySummary;
  setAccountVisibility: (accountId: string, visibility: AccountVisibilityScope) => void;
  getAccountVisibility: (accountId: string) => AccountVisibilityScope;
}

const PRIVACY_STORAGE_KEY = 'wealthnest_family_privacy_rules';

const FamilyContext = createContext<FamilyContextType>({
  members: DEFAULT_DEMO_MEMBERS,
  accounts: DEFAULT_DEMO_ACCOUNTS,
  selectedMemberId: 'all',
  selectedAccountId: 'all',
  setSelectedMemberId: () => {},
  setSelectedAccountId: () => {},
  activeMember: null,
  activeAccount: null,
  familySummary: null,
  isLoading: false,
  refreshFamilyData: async () => {},
  createMember: async () => null,
  updateMember: async () => {},
  deleteMember: async () => {},
  createAccount: async () => null,
  updateAccount: async () => {},
  deleteAccount: async () => {},
  privacyRules: {},
  privacySummary: { totalAccounts: 0, sharedCount: 0, privateCount: 0, privateAccountIds: [] },
  setAccountVisibility: () => {},
  getAccountVisibility: () => 'shared_family',
});

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeHouseholdId, isLoading: householdLoading } = useHousehold();
  const { holdingRepo, familyRepo, mode } = useRepositories();
  const userId = user?.id || 'demo-user-001';
  const isDemoUser = mode === 'supabase' && (!user?.id || user.id.startsWith('demo-'));
  const scopeId = activeHouseholdId || (isDemoUser ? DEMO_HOUSEHOLD_SUMMARY.id : undefined);

  const [members, setMembers] = useState<FamilyMemberDto[]>(() =>
    isDemoUser ? DEFAULT_DEMO_MEMBERS : []
  );
  const [accounts, setAccounts] = useState<PortfolioAccountDto[]>(() =>
    isDemoUser ? DEFAULT_DEMO_ACCOUNTS : []
  );
  const [selectedMemberId, setSelectedMemberId] = useState<string | 'all'>('all');
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all');
  const [familySummary, setFamilySummary] = useState<FamilyPortfolioSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [privacyRules, setPrivacyRules] = useState<Record<string, AccountVisibilityScope>>(() => {
    try {
      const raw =
        typeof window !== 'undefined' ? window.localStorage.getItem(PRIVACY_STORAGE_KEY) : null;
      return raw ? (JSON.parse(raw) as Record<string, AccountVisibilityScope>) : {};
    } catch {
      return {};
    }
  });

  const getSummaryUseCase = useMemo(
    () => new GetFamilyPortfolioSummaryUseCase(familyRepo, holdingRepo),
    [familyRepo, holdingRepo]
  );
  const manageMembersUseCase = useMemo(
    () => new ManageFamilyMembersUseCase(familyRepo),
    [familyRepo]
  );
  const manageAccountsUseCase = useMemo(
    () => new ManagePortfolioAccountsUseCase(familyRepo),
    [familyRepo]
  );

  // Reset active member/account filters when switching households to prevent cross-household stale selection
  useEffect(() => {
    setSelectedMemberId('all');
    setSelectedAccountId('all');
  }, [activeHouseholdId]);

  const refreshFamilyData = useCallback(async () => {
    if (householdLoading) {
      return;
    }
    if (!scopeId) {
      setMembers([]);
      setAccounts([]);
      setFamilySummary(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const [membersRes, accountsRes] = await Promise.all([
        familyRepo.getMembersByHousehold
          ? familyRepo.getMembersByHousehold(scopeId)
          : familyRepo.getMembers(scopeId),
        familyRepo.getAccountsByHousehold
          ? familyRepo.getAccountsByHousehold(scopeId)
          : familyRepo.getAccounts(scopeId),
      ]);

      let currentMembers: FamilyMemberDto[] = isDemoUser ? DEFAULT_DEMO_MEMBERS : [];
      let currentAccounts: PortfolioAccountDto[] = isDemoUser ? DEFAULT_DEMO_ACCOUNTS : [];

      if (isOk(membersRes)) {
        currentMembers = [...membersRes.value];
        setMembers(currentMembers);
      } else if (!isDemoUser) {
        setMembers([]);
      }

      if (isOk(accountsRes)) {
        currentAccounts = [...accountsRes.value];
        setAccounts(currentAccounts);
      } else if (!isDemoUser) {
        setAccounts([]);
      }

      if (isDemoUser) {
        const summary = calculateFamilyPortfolioSummary(
          currentMembers,
          currentAccounts,
          DEFAULT_DEMO_HOLDINGS_FAMILY
        );
        setFamilySummary(summary);
      } else {
        const summaryRes = await getSummaryUseCase.execute(scopeId);
        if (isOk(summaryRes)) {
          setFamilySummary(summaryRes.value);
        } else {
          setFamilySummary(null);
        }
      }
    } catch (e) {
      console.error('Failed to load family portfolio data', e);
    } finally {
      setIsLoading(false);
    }
  }, [familyRepo, getSummaryUseCase, householdLoading, isDemoUser, scopeId]);

  useEffect(() => {
    refreshFamilyData();
  }, [refreshFamilyData]);

  // If member filter changes, reset account filter if selected account does not belong to member
  const handleSelectMember = (id: string | 'all') => {
    setSelectedMemberId(id);
    if (id !== 'all' && selectedAccountId !== 'all') {
      const acc = accounts.find((a) => a.id === selectedAccountId);
      if (acc && acc.memberId !== id) {
        setSelectedAccountId('all');
      }
    }
  };

  const activeMember = useMemo(
    () =>
      selectedMemberId === 'all' ? null : members.find((m) => m.id === selectedMemberId) || null,
    [selectedMemberId, members]
  );

  const activeAccount = useMemo(
    () =>
      selectedAccountId === 'all' ? null : accounts.find((a) => a.id === selectedAccountId) || null,
    [selectedAccountId, accounts]
  );

  const createMember = async (params: {
    name: string;
    relationship: FamilyMemberDto['relationship'];
    email?: string;
    entityType?: FamilyMemberDto['entityType'];
    panMasked?: string;
    colorHex?: string;
    isPrimary?: boolean;
    notes?: string;
  }) => {
    const res = await manageMembersUseCase.createMember({
      ...params,
      userId,
      householdId: scopeId,
    });
    if (isOk(res)) {
      await refreshFamilyData();
      return res.value;
    }
    return null;
  };

  const updateMember = async (member: FamilyMemberDto) => {
    const res = await manageMembersUseCase.updateMember(member);
    if (isOk(res)) {
      await refreshFamilyData();
    }
  };

  const deleteMember = async (id: string) => {
    const res = await manageMembersUseCase.deleteMember(id);
    if (isOk(res)) {
      if (selectedMemberId === id) setSelectedMemberId('all');
      await refreshFamilyData();
    }
  };

  const createAccount = async (params: {
    memberId: string;
    accountName: string;
    brokerName: string;
    depository?: PortfolioAccountDto['depository'];
    accountNumberMasked?: string;
    accountType?: PortfolioAccountDto['accountType'];
    visibility?: PortfolioAccountDto['visibility'];
  }) => {
    const res = await manageAccountsUseCase.createAccount({
      ...params,
      userId,
      householdId: scopeId,
    });
    if (isOk(res)) {
      await refreshFamilyData();
      return res.value;
    }
    return null;
  };

  const updateAccount = async (account: PortfolioAccountDto) => {
    const res = await manageAccountsUseCase.updateAccount(account);
    if (isOk(res)) {
      await refreshFamilyData();
    }
  };

  const deleteAccount = async (id: string) => {
    const res = await manageAccountsUseCase.deleteAccount(id);
    if (isOk(res)) {
      if (selectedAccountId === id) setSelectedAccountId('all');
      await refreshFamilyData();
    }
  };

  const setAccountVisibility = useCallback(
    (accountId: string, visibility: AccountVisibilityScope) => {
      setPrivacyRules((prev) => {
        const next = { ...prev, [accountId]: visibility };
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(next));
          }
        } catch {
          // Ignore storage quota errors
        }
        return next;
      });
    },
    []
  );

  const getAccountVisibility = useCallback(
    (accountId: string): AccountVisibilityScope => privacyRules[accountId] ?? 'shared_family',
    [privacyRules]
  );

  const privacySummary = useMemo(
    () => summarizeHouseholdPrivacy(accounts, privacyRules),
    [accounts, privacyRules]
  );

  return (
    <FamilyContext.Provider
      value={{
        members,
        accounts,
        selectedMemberId,
        selectedAccountId,
        setSelectedMemberId: handleSelectMember,
        setSelectedAccountId,
        activeMember,
        activeAccount,
        familySummary,
        isLoading,
        refreshFamilyData,
        createMember,
        updateMember,
        deleteMember,
        createAccount,
        updateAccount,
        deleteAccount,
        privacyRules,
        privacySummary,
        setAccountVisibility,
        getAccountVisibility,
      }}
    >
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const context = useContext(FamilyContext);
  if (!context) {
    throw new Error('useFamily must be used within a FamilyProvider');
  }
  return context;
}
