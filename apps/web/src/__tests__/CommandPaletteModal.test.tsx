import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CommandPaletteModal } from '../components/layout/CommandPaletteModal';

describe('CommandPaletteModal (DESK-01)', () => {
  it('filters routes and actions by keyword and closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <CommandPaletteModal isOpen={true} onClose={onClose} />
      </MemoryRouter>
    );

    expect(screen.getByTestId('command-palette-modal')).toBeInTheDocument();
    expect(screen.getByText('Real Estate Equity & LTV')).toBeInTheDocument();
    expect(screen.getByText('Family Document Vault')).toBeInTheDocument();

    const searchInput = screen.getByLabelText('Search commands and routes');
    fireEvent.change(searchInput, { target: { value: '112a' } });

    expect(screen.getByText('Analytics & Section 112A Tax Shield')).toBeInTheDocument();
    expect(screen.queryByText('Real Estate Equity & LTV')).not.toBeInTheDocument();

    fireEvent.keyDown(searchInput, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
