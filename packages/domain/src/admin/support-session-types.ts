export type SupportSessionStatus = 'active' | 'ended' | 'expired' | 'revoked';

export interface SupportSession {
  id: string;
  adminUserId: string;
  targetUserId: string;
  targetName: string;
  targetEmail: string;
  reason: string;
  status: SupportSessionStatus;
  createdAt: string;
  expiresAt: string;
  endedAt?: string | null;
  ttlMinutes: number;
}

export interface SupportTargetProfile {
  id: string;
  email: string;
  displayName: string;
  defaultCurrency: string;
}

export interface SupportUserSummary {
  userId: string;
  profile: SupportTargetProfile;
  holdingsCount: number;
  totalInvestmentPaise: number;
  totalCurrentValuePaise: number;
  liabilitiesCount: number;
  totalDebtPaise: number;
  netWorthPaise: number;
  goalsCount: number;
  transactionsCount: number;
}

export interface SupportHoldingItem {
  id: string;
  symbol: string;
  assetClass: string;
  assetSubClass?: string;
  quantity: number;
  averagePricePaise: number;
  currentNavOrPricePaise: number;
  investedValuePaise: number;
  currentValuePaise: number;
  unrealizedGainPaise: number;
  source: string;
  asOfDate: string;
}

export interface SupportLiabilityItem {
  id: string;
  name: string;
  liabilityType: string;
  lenderName: string;
  originalAmountPaise: number;
  outstandingBalancePaise: number;
  interestRate: number;
  monthlyPaymentPaise: number;
  startDate: string;
  targetPayoffDate?: string;
}

export interface SupportGoalItem {
  id: string;
  name: string;
  category: string;
  targetAmountPaise: number;
  currentAmountPaise: number;
  targetDate: string;
  status: string;
}

export interface SupportTransactionItem {
  id: string;
  type: string;
  symbol?: string;
  amountPaise: number;
  units?: number;
  pricePaise?: number;
  transactionDate: string;
  notes?: string;
}

export interface ActiveSupportSessionContext {
  session: SupportSession;
  remainingSeconds: number;
  isExpiringSoon: boolean;
  isExpired: boolean;
}
