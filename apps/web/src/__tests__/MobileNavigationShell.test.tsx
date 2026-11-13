import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomNavigationBar } from '../components/layout/BottomNavigationBar';
import { Sidebar } from '../components/layout/Sidebar';
import { AdminProvider } from '../lib/admin/admin-context';

describe('Phase 9.2: Mobile Navigation Shell & Ergonomics', () => {
  it('TC-9.2-01A: renders BottomNavigationBar with primary touch tabs and elevated Quick-Add button', () => {
    render(
      <MemoryRouter initialEntries={['/portfolio']}>
        <AdminProvider>
          <BottomNavigationBar />
        </AdminProvider>
      </MemoryRouter>
    );

    const bottomNav = screen.getByTestId('bottom-nav-bar');
    expect(bottomNav).toBeInTheDocument();
    expect(bottomNav).toHaveClass('md:hidden');
    expect(bottomNav).toHaveClass('fixed');
    expect(bottomNav).toHaveClass('bottom-0');

    // 5 primary tabs
    expect(screen.getByTestId('bottom-nav-overview')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav-portfolio')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav-liabilities')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav-cashflow')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav-settings')).toBeInTheDocument();

    // Center Quick-Add action button
    const quickAddButton = screen.getByTestId('bottom-nav-quick-add');
    expect(quickAddButton).toBeInTheDocument();

    // Verify minimum touch target classes
    const tabs = screen.getAllByRole('link');
    tabs.forEach((tab) => {
      expect(tab.className).toMatch(/min-h-\[44px\]/);
      expect(tab.className).toMatch(/min-w-\[44px\]/);
    });

    // Clicking Quick-Add opens GlobalQuickAddModal
    fireEvent.click(quickAddButton);
    expect(screen.getByTestId('global-quick-add-modal')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-transaction')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-holding')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-liability')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-goal')).toBeInTheDocument();
  });

  it('TC-9.2-01B: Sidebar is responsive and hidden on mobile screens', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AdminProvider>
          <Sidebar />
        </AdminProvider>
      </MemoryRouter>
    );

    const sidebar = screen.getByTestId('desktop-sidebar');
    expect(sidebar).toBeInTheDocument();
    expect(sidebar).toHaveClass('hidden');
    expect(sidebar).toHaveClass('md:flex');
    expect(sidebar).toHaveClass('md:w-64');
  });
});
