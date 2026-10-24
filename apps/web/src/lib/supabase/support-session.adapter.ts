import {
  SupportSession,
  SupportUserSummary,
  SupportHoldingItem,
  SupportLiabilityItem,
  SupportGoalItem,
  SupportTransactionItem,
} from '@wealthnest/domain';
import { SupportSessionPort } from '@wealthnest/application';
import { supabase } from './client';
import { DEMO_ADMIN_USERS } from './admin.adapter';

// In-memory store for demo / offline sessions
const activeDemoSessions = new Map<string, SupportSession>();

export class SupabaseSupportSessionAdapter implements SupportSessionPort {
  async startSession(adminId: string, targetUserId: string, reason: string): Promise<SupportSession> {
    try {
      const { data, error } = await supabase.rpc('admin_start_support_session', {
        p_target_user_id: targetUserId,
        p_reason: reason,
      });

      if (error) {
        throw error;
      }

      if (data) {
        const session: SupportSession = {
          id: data.session_id,
          adminUserId: data.admin_user_id,
          targetUserId: data.target_user_id,
          targetName: data.target_name,
          targetEmail: data.target_email,
          reason: data.reason,
          status: 'active',
          createdAt: data.created_at,
          expiresAt: data.expires_at,
          ttlMinutes: data.ttl_minutes || 15,
        };
        activeDemoSessions.set(session.id, session);
        return session;
      }
    } catch (err) {
      console.warn('Falling back to local support session simulation:', err);
    }

    // Demo / fallback session creation
    const target = DEMO_ADMIN_USERS.find((u) => u.id === targetUserId) || {
      id: targetUserId,
      displayName: 'Target User',
      email: 'user@wealthnest.local',
    };

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 mins
    const session: SupportSession = {
      id: `sess-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`,
      adminUserId: adminId,
      targetUserId,
      targetName: target.displayName,
      targetEmail: target.email,
      reason,
      status: 'active',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      ttlMinutes: 15,
    };

    activeDemoSessions.set(session.id, session);
    return session;
  }

  async endSession(sessionId: string): Promise<{ success: boolean; status: string }> {
    try {
      const { error } = await supabase.rpc('admin_end_support_session', {
        p_session_id: sessionId,
      });

      if (!error) {
        const stored = activeDemoSessions.get(sessionId);
        if (stored) {
          stored.status = 'ended';
          stored.endedAt = new Date().toISOString();
        }
        return { success: true, status: 'ended' };
      }
    } catch (err) {
      console.warn('Falling back to local support session termination:', err);
    }

    const stored = activeDemoSessions.get(sessionId);
    if (stored) {
      stored.status = 'ended';
      stored.endedAt = new Date().toISOString();
    }
    return { success: true, status: 'ended' };
  }

  async getSupportSummary(sessionId: string): Promise<SupportUserSummary> {
    try {
      const { data, error } = await supabase.rpc('support_get_user_summary', {
        p_session_id: sessionId,
      });

      if (!error && data) {
        return {
          userId: data.user_id,
          profile: data.profile,
          holdingsCount: Number(data.holdings_count || 0),
          totalInvestmentPaise: Number(data.total_investment_paise || 0),
          totalCurrentValuePaise: Number(data.total_current_value_paise || 0),
          liabilitiesCount: Number(data.liabilities_count || 0),
          totalDebtPaise: Number(data.total_debt_paise || 0),
          netWorthPaise: Number(data.net_worth_paise || 0),
          goalsCount: Number(data.goals_count || 0),
          transactionsCount: Number(data.transactions_count || 0),
        };
      }
    } catch (err) {
      console.warn('Falling back to local support summary simulation:', err);
    }

    const session = activeDemoSessions.get(sessionId);
    const targetUserId = session?.targetUserId || 'usr-shamalbhai-vaghela-03';
    const target = DEMO_ADMIN_USERS.find((u) => u.id === targetUserId);

    if (targetUserId === 'usr-krisha-vaghela-05') {
      return {
        userId: targetUserId,
        profile: {
          id: targetUserId,
          email: 'krisha.vaghela@wealthnest.local',
          displayName: 'Krisha Vaghela',
          defaultCurrency: 'INR',
        },
        holdingsCount: 3,
        totalInvestmentPaise: 45000000, // ₹4.5 Lakhs
        totalCurrentValuePaise: 58000000, // ₹5.8 Lakhs
        liabilitiesCount: 0,
        totalDebtPaise: 0,
        netWorthPaise: 58000000,
        goalsCount: 2,
        transactionsCount: 8,
      };
    }

    if (targetUserId === 'usr-parul-vaghela-02') {
      return {
        userId: targetUserId,
        profile: {
          id: targetUserId,
          email: 'parul.vaghela@wealthnest.local',
          displayName: 'Parul Vaghela',
          defaultCurrency: 'INR',
        },
        holdingsCount: 4,
        totalInvestmentPaise: 120000000, // ₹12 Lakhs
        totalCurrentValuePaise: 155000000, // ₹15.5 Lakhs
        liabilitiesCount: 1,
        totalDebtPaise: 250000000, // ₹25 Lakhs
        netWorthPaise: -95000000,
        goalsCount: 2,
        transactionsCount: 15,
      };
    }

    // Default: Shamalbhai Vaghela HUF
    return {
      userId: targetUserId,
      profile: {
        id: targetUserId,
        email: target?.email || 'shamalbhai.huf@wealthnest.local',
        displayName: target?.displayName || 'Shamalbhai Vaghela HUF',
        defaultCurrency: 'INR',
      },
      holdingsCount: 4,
      totalInvestmentPaise: 600000000, // ₹60 Lakhs
      totalCurrentValuePaise: 850000000, // ₹85 Lakhs
      liabilitiesCount: 0,
      totalDebtPaise: 0,
      netWorthPaise: 850000000,
      goalsCount: 1,
      transactionsCount: 18,
    };
  }

  async getSupportPortfolio(sessionId: string): Promise<SupportHoldingItem[]> {
    try {
      const { data, error } = await supabase.rpc('support_get_user_portfolio', {
        p_session_id: sessionId,
      });

      if (!error && Array.isArray(data)) {
        return data.map((item: any) => ({
          id: item.id,
          symbol: item.symbol,
          assetClass: item.asset_class,
          assetSubClass: item.asset_sub_class,
          quantity: Number(item.quantity),
          averagePricePaise: Number(item.average_price_paise),
          currentNavOrPricePaise: Number(item.current_nav_or_price_paise),
          investedValuePaise: Number(item.invested_value_paise),
          currentValuePaise: Number(item.current_value_paise),
          unrealizedGainPaise: Number(item.unrealized_gain_paise),
          source: item.source || 'verified',
          asOfDate: item.as_of_date || new Date().toISOString().split('T')[0],
        }));
      }
    } catch (err) {
      console.warn('Falling back to local support portfolio simulation:', err);
    }

    const session = activeDemoSessions.get(sessionId);
    const targetUserId = session?.targetUserId || '';

    if (targetUserId === 'usr-krisha-vaghela-05') {
      return [
        {
          id: 'h-k1',
          symbol: 'UTI Nifty 50 Index Fund Direct-Growth',
          assetClass: 'mutual_fund',
          assetSubClass: 'Equity - Large Cap',
          quantity: 2500,
          averagePricePaise: 12000,
          currentNavOrPricePaise: 15200,
          investedValuePaise: 30000000,
          currentValuePaise: 38000000,
          unrealizedGainPaise: 8000000,
          source: 'sip_auto',
          asOfDate: '2026-10-24',
        },
        {
          id: 'h-k2',
          symbol: 'Parag Parikh Flexi Cap Fund Direct-Growth',
          assetClass: 'mutual_fund',
          assetSubClass: 'Equity - Flexi Cap',
          quantity: 1800,
          averagePricePaise: 8333,
          currentNavOrPricePaise: 11111,
          investedValuePaise: 15000000,
          currentValuePaise: 20000000,
          unrealizedGainPaise: 5000000,
          source: 'sip_auto',
          asOfDate: '2026-10-24',
        },
      ];
    }

    // Shamalbhai Vaghela HUF default
    return [
      {
        id: 'h-s1',
        symbol: 'HDFCBANK',
        assetClass: 'equity',
        assetSubClass: 'Private Banking',
        quantity: 1500,
        averagePricePaise: 145000,
        currentNavOrPricePaise: 172000,
        investedValuePaise: 217500000,
        currentValuePaise: 258000000,
        unrealizedGainPaise: 40500000,
        source: 'zerodha_kite',
        asOfDate: '2026-10-24',
      },
      {
        id: 'h-s2',
        symbol: 'INFY',
        assetClass: 'equity',
        assetSubClass: 'IT Services',
        quantity: 1200,
        averagePricePaise: 140000,
        currentNavOrPricePaise: 185000,
        investedValuePaise: 168000000,
        currentValuePaise: 222000000,
        unrealizedGainPaise: 54000000,
        source: 'zerodha_kite',
        asOfDate: '2026-10-24',
      },
      {
        id: 'h-s3',
        symbol: 'SGBMAY29',
        assetClass: 'gold',
        assetSubClass: 'Sovereign Gold Bond',
        quantity: 300,
        averagePricePaise: 480000,
        currentNavOrPricePaise: 750000,
        investedValuePaise: 144000000,
        currentValuePaise: 225000000,
        unrealizedGainPaise: 81000000,
        source: 'rbi_direct',
        asOfDate: '2026-10-24',
      },
      {
        id: 'h-s4',
        symbol: 'SBI Bluechip Fund Direct-Growth',
        assetClass: 'mutual_fund',
        assetSubClass: 'Equity - Large Cap',
        quantity: 18500,
        averagePricePaise: 3810,
        currentNavOrPricePaise: 7837,
        investedValuePaise: 70500000,
        currentValuePaise: 145000000,
        unrealizedGainPaise: 74500000,
        source: 'cams_cas',
        asOfDate: '2026-10-24',
      },
    ];
  }

  async getSupportLiabilities(sessionId: string): Promise<SupportLiabilityItem[]> {
    try {
      const { data, error } = await supabase.rpc('support_get_user_liabilities', {
        p_session_id: sessionId,
      });

      if (!error && Array.isArray(data)) {
        return data.map((item: any) => ({
          id: item.id,
          name: item.name,
          liabilityType: item.liability_type,
          lenderName: item.lender_name,
          originalAmountPaise: Number(item.original_amount_paise),
          outstandingBalancePaise: Number(item.outstanding_balance_paise),
          interestRate: Number(item.interest_rate),
          monthlyPaymentPaise: Number(item.monthly_payment_paise || 0),
          startDate: item.start_date,
          targetPayoffDate: item.target_payoff_date,
        }));
      }
    } catch (err) {
      console.warn('Falling back to local support liabilities simulation:', err);
    }

    const session = activeDemoSessions.get(sessionId);
    const targetUserId = session?.targetUserId || '';

    if (targetUserId === 'usr-parul-vaghela-02') {
      return [
        {
          id: 'liab-p1',
          name: 'Home Loan (Bank of Baroda Staff Rate)',
          liabilityType: 'home_loan',
          lenderName: 'Bank of Baroda',
          originalAmountPaise: 400000000,
          outstandingBalancePaise: 250000000,
          interestRate: 6.85,
          monthlyPaymentPaise: 3500000,
          startDate: '2021-04-01',
          targetPayoffDate: '2036-03-31',
        },
      ];
    }

    return [];
  }

  async getSupportGoals(sessionId: string): Promise<SupportGoalItem[]> {
    try {
      const { data, error } = await supabase.rpc('support_get_user_goals', {
        p_session_id: sessionId,
      });

      if (!error && Array.isArray(data)) {
        return data.map((item: any) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          targetAmountPaise: Number(item.target_amount_paise),
          currentAmountPaise: Number(item.current_amount_paise),
          targetDate: item.target_date,
          status: item.status,
        }));
      }
    } catch (err) {
      console.warn('Falling back to local support goals simulation:', err);
    }

    const session = activeDemoSessions.get(sessionId);
    const targetUserId = session?.targetUserId || '';

    if (targetUserId === 'usr-krisha-vaghela-05') {
      return [
        {
          id: 'g-k1',
          name: "Krisha's Higher Education",
          category: 'education',
          targetAmountPaise: 250000000, // ₹2.5 Cr
          currentAmountPaise: 58000000,
          targetDate: '2037-06-30',
          status: 'on_track',
        },
      ];
    }

    return [
      {
        id: 'g-s1',
        name: 'Section 112A Annual LTCG Tax Shield (₹1.25L Tax Free)',
        category: 'tax_planning',
        targetAmountPaise: 12500000, // ₹1.25 Lakhs
        currentAmountPaise: 11000000,
        targetDate: '2027-03-31',
        status: 'on_track',
      },
    ];
  }

  async getSupportTransactions(sessionId: string, limit: number = 50): Promise<SupportTransactionItem[]> {
    try {
      const { data, error } = await supabase.rpc('support_get_user_transactions', {
        p_session_id: sessionId,
        p_limit: limit,
      });

      if (!error && Array.isArray(data)) {
        return data.map((item: any) => ({
          id: item.id,
          type: item.type,
          symbol: item.symbol,
          amountPaise: Number(item.amount_paise),
          units: item.units ? Number(item.units) : undefined,
          pricePaise: item.price_paise ? Number(item.price_paise) : undefined,
          transactionDate: item.transaction_date,
          notes: item.notes,
        }));
      }
    } catch (err) {
      console.warn('Falling back to local support transactions simulation:', err);
    }

    return [
      {
        id: 'tx-s1',
        type: 'BUY',
        symbol: 'HDFCBANK',
        amountPaise: 15000000,
        units: 100,
        pricePaise: 150000,
        transactionDate: '2026-10-15',
        notes: 'Zerodha Kite regular allocation',
      },
      {
        id: 'tx-s2',
        type: 'BUY',
        symbol: 'UTI Nifty 50 Index Fund Direct-Growth',
        amountPaise: 2500000,
        units: 164.47,
        pricePaise: 15200,
        transactionDate: '2026-10-10',
        notes: 'Monthly SIP installment',
      },
    ];
  }
}

export const supportSessionAdapter = new SupabaseSupportSessionAdapter();
