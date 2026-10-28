import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  FamilyMemberDto,
  PortfolioAccountDto,
  GetFamilyPortfolioSummaryUseCase,
  ManageFamilyMembersUseCase,
  ManagePortfolioAccountsUseCase,
} from '@wealthnest/application';
import { FamilyPortfolioSummary, calculateFamilyPortfolioSummary } from '@wealthnest/domain';
import { isOk } from '@wealthnest/shared';
import { useAuth } from '../supabase/auth-context';
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
  }) => Promise<PortfolioAccountDto | null>;
  updateAccount: (account: PortfolioAccountDto) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
}

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
});

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id || 'demo-user-001';

  const [members, setMembers] = useState<FamilyMemberDto[]>(DEFAULT_DEMO_MEMBERS);
  const [accounts, setAccounts] = useState<PortfolioAccountDto[]>(DEFAULT_DEMO_ACCOUNTS);
  const [selectedMemberId, setSelectedMemberId] = useState<string | 'all'>('all');
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all');
  const [familySummary, setFamilySummary] = useState<FamilyPortfolioSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const { holdingRepo, familyRepo } = useRepositories();

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

  const refreshFamilyData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [membersRes, accountsRes] = await Promise.all([
        familyRepo.getMembers(userId),
        familyRepo.getAccounts(userId),
      ]);

      let currentMembers = DEFAULT_DEMO_MEMBERS;
      let currentAccounts = DEFAULT_DEMO_ACCOUNTS;

      if (isOk(membersRes)) {
        currentMembers = [...membersRes.value];
        setMembers(currentMembers);
      }
      if (isOk(accountsRes)) {
        currentAccounts = [...accountsRes.value];
        setAccounts(currentAccounts);
      }

      if (!userId || userId.startsWith('demo-')) {
        const summary = calculateFamilyPortfolioSummary(
          currentMembers,
          currentAccounts,
          DEFAULT_DEMO_HOLDINGS_FAMILY
        );
        setFamilySummary(summary);
      } else {
        const summaryRes = await getSummaryUseCase.execute(userId);
        if (isOk(summaryRes)) {
          setFamilySummary(summaryRes.value);
        }
      }
    } catch (e) {
      console.error('Failed to load family portfolio data', e);
    } finally {
      setIsLoading(false);
    }
  }, [userId, getSummaryUseCase]);

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
    () => (selectedMemberId === 'all' ? null : members.find((m) => m.id === selectedMemberId) || null),
    [selectedMemberId, members]
  );

  const activeAccount = useMemo(
    () => (selectedAccountId === 'all' ? null : accounts.find((a) => a.id === selectedAccountId) || null),
    [selectedAccountId, accounts]
  );

  const createMember = async (params: {
    name: string;
    relationship: FamilyMemberDto['relationship'];
    panMasked?: string;
    colorHex?: string;
    isPrimary?: boolean;
    notes?: string;
  }) => {
    const res = await manageMembersUseCase.createMember({ ...params, userId });
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
  }) => {
    const res = await manageAccountsUseCase.createAccount({ ...params, userId });
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
