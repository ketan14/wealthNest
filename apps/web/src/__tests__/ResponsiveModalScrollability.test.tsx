import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/supabase/auth-context';
import { PreferencesProvider } from '@/lib/preferences/preferences-context';
import { FamilyProvider } from '@/lib/family/family-context';
import { ResponsiveModalShell } from '@/components/ui/ResponsiveModalShell';
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal';
import { ImportCasModal } from '@/components/portfolio/ImportCasModal';
import { AddHoldingModal } from '@/components/portfolio/AddHoldingModal';
import { ManageFamilyModal } from '@/components/family/ManageFamilyModal';
import { GlobalQuickAddModal } from '@/components/layout/GlobalQuickAddModal';

function renderWithAppProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PreferencesProvider>
          <FamilyProvider>
            <MemoryRouter>{ui}</MemoryRouter>
          </FamilyProvider>
        </PreferencesProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function buildZerodhaHoldingsCsv(rowCount: number): string {
  const header = 'Instrument,Qty.,Avg. cost,LTP,Cur. val,P&L,Net chg.,Day chg.';
  const rows = Array.from({ length: rowCount }, (_, idx) => {
    const seq = String(idx + 1).padStart(2, '0');
    return `TESTEQ${seq},10,100.00,110.00,1100.00,100.00,10.00,0.50`;
  });
  return [header, ...rows].join('\n');
}

describe('Phase 18A: Responsive Modal Scrollability & Pinned Footers', () => {
  describe('ResponsiveModalShell Layout Invariants', () => {
    it('enforces bounded dvh height, middle scroll region, overscroll containment, and shrink-0 header/footer', () => {
      render(
        <ResponsiveModalShell
          role="dialog"
          ariaLabel="Shell Test Modal"
          testId="shell-test-modal"
          header={<div>Fixed Modal Header</div>}
          footer={
            <div>
              <button type="button">Cancel</button>
              <button type="button">Confirm Action</button>
            </div>
          }
        >
          <div data-testid="tall-body-content">Scrollable Body Content</div>
        </ResponsiveModalShell>
      );

      const backdrop = screen.getByTestId('shell-test-modal');
      expect(backdrop).toHaveClass('fixed', 'inset-0', 'overscroll-contain');

      const panel = backdrop.firstElementChild as HTMLElement;
      expect(panel).toHaveClass('flex', 'flex-col', 'overflow-hidden', 'max-h-[90dvh]');

      const headerWrapper = screen.getByText('Fixed Modal Header').parentElement as HTMLElement;
      expect(headerWrapper).toHaveClass('shrink-0');

      const bodyWrapper = screen.getByTestId('tall-body-content').parentElement as HTMLElement;
      expect(bodyWrapper).toHaveClass('flex-1', 'min-h-0', 'overflow-y-auto', 'overscroll-contain');

      const footerWrapper = screen.getByText('Confirm Action').parentElement
        ?.parentElement as HTMLElement;
      expect(footerWrapper).toHaveClass('shrink-0');
      expect(bodyWrapper.contains(footerWrapper)).toBe(false);
    });

    it('submits formProps across scrollable body and pinned footer submit button', () => {
      const handleSubmit = vi.fn((e: React.FormEvent) => {
        e.preventDefault();
      });

      render(
        <ResponsiveModalShell
          role="dialog"
          ariaLabel="Form Shell"
          testId="form-shell-modal"
          header={<div>Form Title</div>}
          formProps={{ onSubmit: handleSubmit }}
          footer={<button type="submit">Submit Form</button>}
        >
          <input aria-label="Test Input" defaultValue="Sample" required />
        </ResponsiveModalShell>
      );

      const submitBtn = screen.getByRole('button', { name: 'Submit Form' });
      const bodyWrapper = screen.getByLabelText('Test Input').parentElement as HTMLElement;
      const footerWrapper = submitBtn.parentElement as HTMLElement;

      expect(bodyWrapper).toHaveClass('flex-1', 'min-h-0', 'overflow-y-auto');
      expect(footerWrapper).toHaveClass('shrink-0');
      expect(submitBtn.closest('form')).not.toBeNull();

      fireEvent.click(submitBtn);
      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    it('supports bottom-sheet variant with safe-area padding, top palette height, and React portal rendering', () => {
      const { rerender } = render(
        <ResponsiveModalShell
          portal
          variant="sheet"
          role="dialog"
          ariaLabel="Sheet Shell"
          testId="variant-shell-modal"
        >
          <div>Sheet Body</div>
        </ResponsiveModalShell>
      );

      const sheetBackdrop = screen.getByTestId('variant-shell-modal');
      expect(sheetBackdrop.parentElement).toBe(document.body);
      expect(sheetBackdrop).toHaveClass('items-end', 'sm:items-center');
      const sheetPanel = sheetBackdrop.firstElementChild as HTMLElement;
      expect(sheetPanel).toHaveClass('max-h-[90dvh]', 'pb-[env(safe-area-inset-bottom)]');

      rerender(
        <ResponsiveModalShell
          variant="top"
          scrollableBody={false}
          role="dialog"
          ariaLabel="Top Shell"
          testId="variant-shell-modal"
        >
          <div data-testid="custom-step-container">Custom Step Body</div>
        </ResponsiveModalShell>
      );

      const topBackdrop = screen.getByTestId('variant-shell-modal');
      const topPanel = topBackdrop.firstElementChild as HTMLElement;
      expect(topPanel).toHaveClass('max-h-[82dvh]');
      expect(screen.getByTestId('custom-step-container').parentElement).toHaveClass(
        'flex-1',
        'min-h-0',
        'flex',
        'flex-col',
        'overflow-hidden'
      );
    });
  });

  describe('Priority 0: ImportCasModal + CasPreviewStep with 55 Equities', () => {
    it('keeps Confirm & Import pinned outside the scrollable preview body for 55 parsed rows and completes import', async () => {
      const handleClose = vi.fn();
      const handleSuccess = vi.fn();

      renderWithAppProviders(
        <ImportCasModal isOpen onClose={handleClose} onSuccess={handleSuccess} />
      );

      const dialog = screen.getByTestId('import-cas-modal');
      const dialogPanel = dialog.firstElementChild as HTMLElement;
      expect(dialogPanel).toHaveClass('max-h-[90dvh]', 'flex', 'flex-col', 'overflow-hidden');

      // Switch to Zerodha Kite (CSV) and upload a 55-row holdings statement
      fireEvent.click(screen.getByRole('button', { name: /Zerodha Kite \(CSV\)/i }));

      const csvContent = buildZerodhaHoldingsCsv(55);
      const csvFile = new File([csvContent], 'holdings-55.csv', { type: 'text/csv' });
      if (typeof csvFile.text !== 'function') {
        Object.defineProperty(csvFile, 'text', {
          value: async () => csvContent,
        });
      }

      const fileInput = document.getElementById('cas-file-input') as HTMLInputElement;
      expect(fileInput).not.toBeNull();
      fireEvent.change(fileInput, { target: { files: [csvFile] } });

      fireEvent.click(screen.getByRole('button', { name: /Parse Statement/i }));

      await waitFor(() => {
        expect(screen.getByText('TESTEQ55')).toBeInTheDocument();
      });

      const scrollBody = screen.getByTestId('cas-preview-scroll-body');
      const actionsFooter = screen.getByTestId('cas-preview-actions-footer');

      // Critical layout invariant: scroll body scrolls independently and never wraps actions footer
      expect(scrollBody).toHaveClass('flex-1', 'min-h-0', 'overflow-y-auto', 'overscroll-contain');
      expect(actionsFooter).toHaveClass('shrink-0', 'flex-wrap');
      expect(scrollBody.contains(actionsFooter)).toBe(false);

      // Horizontal table wrapper + minimum width prevent narrow-screen column crushing
      const lastRowCell = screen.getByText('TESTEQ55');
      const tableEl = lastRowCell.closest('table') as HTMLElement;
      expect(tableEl).toHaveClass('min-w-[600px]');
      const tableScrollBox = tableEl.parentElement as HTMLElement;
      expect(tableScrollBox).toHaveClass('overflow-auto', 'overscroll-contain');

      // Single Confirm & Import button inside pinned footer with mobile-first ordering
      const confirmButtons = screen.getAllByRole('button', {
        name: /Confirm & Import \(55 Equities, 0 Mutual Funds\)/i,
      });
      expect(confirmButtons).toHaveLength(1);
      expect(actionsFooter.contains(confirmButtons[0]!)).toBe(true);
      expect(confirmButtons[0]).toHaveClass('order-1', 'sm:order-3');

      // Clicking Confirm & Import completes workflow and shows pinned summary action
      fireEvent.click(confirmButtons[0]!);

      await waitFor(() => {
        expect(screen.getByText(/CAS Import Completed Successfully!/i)).toBeInTheDocument();
      });

      const viewPortfolioBtn = screen.getByRole('button', { name: /View Updated Portfolio/i });
      expect(viewPortfolioBtn.parentElement).toHaveClass('shrink-0');
    });
  });

  describe('Group A / B / C Standardized Modal Contracts', () => {
    it('renders ConfirmActionModal via ResponsiveModalShell portal and preserves callback wiring', () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      render(
        <ConfirmActionModal
          isOpen
          title="Delete Holding"
          message="Are you sure?"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      const modal = screen.getByTestId('confirm-modal');
      expect(modal.parentElement).toBe(document.body);
      expect(modal.firstElementChild).toHaveClass('max-h-[90dvh]', 'flex', 'flex-col');

      fireEvent.click(screen.getByTestId('confirm-modal-button'));
      expect(onConfirm).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId('cancel-modal-button'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('renders ManageFamilyModal with scrollable body and pinned Close footer', () => {
      const onClose = vi.fn();
      renderWithAppProviders(<ManageFamilyModal isOpen onClose={onClose} />);

      expect(screen.getByText(/Family Entities & Demat Accounts/i)).toBeInTheDocument();
      const closeBtn = screen.getByRole('button', { name: /^Close$/i });
      const footerWrapper = closeBtn.parentElement?.parentElement as HTMLElement;
      expect(footerWrapper).toHaveClass('shrink-0');

      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renders GlobalQuickAddModal as responsive bottom sheet with safe-area padding', () => {
      renderWithAppProviders(<GlobalQuickAddModal isOpen onClose={vi.fn()} />);

      const quickAdd = screen.getByTestId('global-quick-add-modal');
      expect(quickAdd).toHaveClass('items-end', 'sm:items-center');
      const panel = quickAdd.firstElementChild as HTMLElement;
      expect(panel).toHaveClass('max-h-[90dvh]', 'pb-[env(safe-area-inset-bottom)]');
    });

    it('renders AddHoldingModal with form-wrapped scrollable fields and pinned Save Position button', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      renderWithAppProviders(
        <AddHoldingModal isOpen onClose={vi.fn()} onSubmit={onSubmit} />
      );

      const saveBtn = screen.getByRole('button', { name: /Save Position/i });
      const footerWrapper = saveBtn.parentElement?.parentElement as HTMLElement;
      expect(footerWrapper).toHaveClass('shrink-0');
      expect(saveBtn.closest('form')).not.toBeNull();

      fireEvent.change(screen.getByPlaceholderText(/e\.g\. Reliance Industries Limited/i), {
        target: { value: 'Infosys Limited' },
      });
      fireEvent.change(screen.getByPlaceholderText('10'), { target: { value: '5' } });
      fireEvent.change(screen.getByPlaceholderText('2500.00'), { target: { value: '1400' } });
      fireEvent.change(screen.getByPlaceholderText('28000.00'), { target: { value: '7500' } });

      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });
      expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
        name: 'Infosys Limited',
        quantity: 5,
        unitCost: 1400,
        currentValue: 7500,
      });
    });
  });
});
