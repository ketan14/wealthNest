import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecurringRulesCard } from '../components/transactions/RecurringRulesCard';

describe('RecurringRulesCard', () => {
  it('renders recurring SIP & EMI rules and posts a transaction on 1-click Post Now', async () => {
    const onPostTransaction = vi.fn().mockResolvedValue(undefined);

    render(<RecurringRulesCard onPostTransaction={onPostTransaction} />);

    expect(screen.getByText('Recurring SIP & EMI Rules')).toBeInTheDocument();
    expect(screen.getByText('Parag Parikh Flexi Cap SIP')).toBeInTheDocument();
    expect(screen.getByText('SBI Home Loan EMI')).toBeInTheDocument();

    const postButtons = screen.getAllByRole('button', { name: /Post Now/i });
    fireEvent.click(postButtons[0]!);

    await waitFor(() => {
      expect(onPostTransaction).toHaveBeenCalledTimes(1);
    });
    expect(onPostTransaction.mock.calls[0]?.[0]).toMatchObject({
      type: 'buy',
      amount: 25000,
      currency: 'INR',
    });
  });

  it('allows adding a new recurring rule via the inline form', () => {
    const onPostTransaction = vi.fn().mockResolvedValue(undefined);
    render(<RecurringRulesCard onPostTransaction={onPostTransaction} />);

    fireEvent.click(screen.getByRole('button', { name: /Add Rule/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. HDFC Midcap SIP'), {
      target: { value: 'HDFC Midcap Opportunities SIP' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('HDFC Midcap Opportunities SIP')).toBeInTheDocument();
  });
});
