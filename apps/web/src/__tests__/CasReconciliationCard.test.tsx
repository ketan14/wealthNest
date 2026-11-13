import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HoldingDetailDto } from '@wealthnest/application';
import { CasReconciliationCard } from '../components/analytics/CasReconciliationCard';

describe('CasReconciliationCard (Phase 5 Auto-Reconciliation)', () => {
  const sampleHoldings: HoldingDetailDto[] = [
    {
      holdingId: 'h-1',
      assetId: 'a-1',
      name: 'Reliance Industries Ltd',
      ticker: 'RELIANCE',
      isin: 'INE002A01018',
      assetClassId: 'equity',
      assetClassName: 'Equities & Stocks',
      assetClassColor: '#3b82f6',
      quantity: 80,
      unitCostCents: 250000,
      currentValueCents: 23600000,
      currency: 'INR',
      costBasisVerified: true,
      updatedAt: '2026-04-01T00:00:00Z',
    },
    {
      holdingId: 'h-2',
      assetId: 'a-2',
      name: 'Bandhan Large & Mid Cap Fund',
      ticker: 'BANDHAN-LM',
      isin: 'INF194K01V89',
      assetClassId: 'mutual_fund',
      assetClassName: 'Mutual Funds',
      assetClassColor: '#06b6d4',
      quantity: 1000,
      unitCostCents: 14720,
      currentValueCents: 16600000,
      currency: 'INR',
      costBasisVerified: false,
      updatedAt: '2026-04-01T00:00:00Z',
    },
  ];

  it('renders reconciliation score, matched count, and flags unverified cost-basis positions', () => {
    render(<CasReconciliationCard holdings={sampleHoldings} />);

    expect(screen.getByText('CAS ↔ Broker Tradebook Auto-Reconciliation')).toBeInTheDocument();
    expect(screen.getByText('50% Verified')).toBeInTheDocument();
    expect(screen.getByText('1 Matched')).toBeInTheDocument();
    expect(screen.getByText('1 Unverified Cost Basis')).toBeInTheDocument();
    expect(screen.getByText('Reliance Industries Ltd')).toBeInTheDocument();
    expect(screen.getByText('Bandhan Large & Mid Cap Fund')).toBeInTheDocument();
  });
});
