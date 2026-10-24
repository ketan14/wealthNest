import {
  SupportSession,
  SupportUserSummary,
  SupportHoldingItem,
  SupportLiabilityItem,
  SupportGoalItem,
  SupportTransactionItem,
} from '@wealthnest/domain';

export interface SupportSessionPort {
  startSession(adminId: string, targetUserId: string, reason: string): Promise<SupportSession>;
  endSession(sessionId: string): Promise<{ success: boolean; status: string }>;
  getSupportSummary(sessionId: string): Promise<SupportUserSummary>;
  getSupportPortfolio(sessionId: string): Promise<SupportHoldingItem[]>;
  getSupportLiabilities(sessionId: string): Promise<SupportLiabilityItem[]>;
  getSupportGoals(sessionId: string): Promise<SupportGoalItem[]>;
  getSupportTransactions(sessionId: string, limit?: number): Promise<SupportTransactionItem[]>;
}
