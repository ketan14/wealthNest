import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmActionModal } from '../components/ui/ConfirmActionModal';

describe('Phase 9.2: Accessible Non-Blocking ConfirmActionModal', () => {
  it('TC-9.2-05A: renders nothing when isOpen is false', () => {
    const { container } = render(
      <ConfirmActionModal
        isOpen={false}
        title="Delete Item"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('TC-9.2-05B: renders modal with title, message, and executes onConfirm when confirmed', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmActionModal
        isOpen={true}
        title="Delete Holding"
        message="Delete Reliance Industries from portfolio?"
        confirmLabel="Yes, Delete"
        cancelLabel="No, Keep"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    expect(screen.getByText('Delete Holding')).toBeInTheDocument();
    expect(screen.getByText(/Delete Reliance Industries/i)).toBeInTheDocument();

    const confirmBtn = screen.getByTestId('confirm-modal-button');
    const cancelBtn = screen.getByTestId('cancel-modal-button');

    // Touch target compliance
    expect(confirmBtn.className).toMatch(/min-h-\[44px\]/);
    expect(cancelBtn.className).toMatch(/min-h-\[44px\]/);

    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('TC-9.2-05C: executes onCancel when cancel or close button is clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmActionModal
        isOpen={true}
        title="Discard Changes"
        message="Unsaved changes will be lost."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const cancelBtn = screen.getByTestId('cancel-modal-button');
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('TC-9.2-05D: disables action buttons when isLoading is true', () => {
    render(
      <ConfirmActionModal
        isOpen={true}
        title="Deleting..."
        message="Please wait"
        isLoading={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByTestId('confirm-modal-button')).toBeDisabled();
    expect(screen.getByTestId('cancel-modal-button')).toBeDisabled();
    expect(screen.getByText(/Processing\.\.\./i)).toBeInTheDocument();
  });
});
