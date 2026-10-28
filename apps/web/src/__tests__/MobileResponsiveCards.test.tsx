import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HoldingCard } from '../components/portfolio/HoldingCard';
import { TransactionCard } from '../components/transactions/TransactionCard';
import { HoldingDetailDto, TransactionDetailDto } from '@wealthnest/application';

describe('Phase 9.2: Mobile Responsive Card Presentations', () => {
  const sampleHolding: HoldingDetailDto & { memberName?: string; brokerName?: string } = {
    holdingId: 'h-101',
    assetId: 'ast-101',
    name: 'HDFC Bank Ltd',
    ticker: 'HDFCBANK',
    isin: 'INE040A01034',
    assetClassId: 'equity',
    assetClassName: 'Equities & Stocks',
    assetClassColor: '#3b82f6',
    quantity: 50,
    unitCostCents: 150000, // ₹1,500
    currentValueCents: 8500000, // ₹85,000 (Cost = ₹75,000, Gain = ₹10,000)
    currency: 'INR',
    updatedAt: '2026-10-28T00:00:00Z',
    memberName: 'Ketan Vaghela',
    brokerName: 'Zerodha',
  };

  const sampleTransaction: TransactionDetailDto & { taxCategory?: string } = {
    id: 'tx-201',
    userId: 'usr-1',
    assetName: 'HDFC Mid-Cap Opportunities Fund',
    type: 'deposit',
    amountCents: 5000000, // ₹50,000
    currency: 'INR',
    transactionDate: '2026-10-28',
    notes: 'Monthly SIP allocation from Bank of Baroda',
    createdAt: '2026-10-28T00:00:00Z',
  };

  it('TC-9.2-02A: HoldingCard renders essential data, gain indicators, and touch-sized delete button', () => {
    const onDelete = vi.fn();

    render(<HoldingCard holding={sampleHolding} onDelete={onDelete} />);

    const card = screen.getByTestId('holding-card');
    expect(card).toBeInTheDocument();

    expect(screen.getByText('HDFC Bank Ltd')).toBeInTheDocument();
    expect(screen.getByText('HDFCBANK')).toBeInTheDocument();
    expect(screen.getByText('Ketan Vaghela')).toBeInTheDocument();
    expect(screen.getByText('Zerodha')).toBeInTheDocument();

    // Verify gain formatting
    expect(screen.getByText(/\+₹10,000/)).toBeInTheDocument();

    // Verify touch target on delete button
    const deleteBtn = screen.getByRole('button', { name: /delete hdfc bank/i });
    expect(deleteBtn.className).toMatch(/min-h-\[44px\]/);
    expect(deleteBtn.className).toMatch(/min-w-\[44px\]/);

    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith(sampleHolding);
  });

  it('TC-9.2-02B: TransactionCard renders type badge, formatted amount, and delete action', () => {
    const onDelete = vi.fn();

    render(<TransactionCard transaction={sampleTransaction} onDelete={onDelete} />);

    const card = screen.getByTestId('transaction-card');
    expect(card).toBeInTheDocument();

    expect(screen.getByText('HDFC Mid-Cap Opportunities Fund')).toBeInTheDocument();
    expect(screen.getByText(/Monthly SIP allocation/i)).toBeInTheDocument();
    expect(screen.getByText(/\+₹50,000/)).toBeInTheDocument();

    const deleteBtn = screen.getByRole('button', { name: /delete transaction/i });
    expect(deleteBtn.className).toMatch(/min-h-\[44px\]/);
    expect(deleteBtn.className).toMatch(/min-w-\[44px\]/);

    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith(sampleTransaction);
  });
});
