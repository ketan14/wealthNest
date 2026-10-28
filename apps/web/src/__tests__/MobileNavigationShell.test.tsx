import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomNavigationBar } from '../components/layout/BottomNavigationBar';
import { Sidebar } from '../components/layout/Sidebar';
import { AdminProvider } from '../lib/admin/admin-context';

describe('Phase 9.2: Mobile Navigation Shell & Ergonomics', () => {
  it('TC-9.2-01A: renders BottomNavigationBar with 5 primary touch tabs', () => {
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

    // Verify minimum touch target classes
    const tabs = screen.getAllByRole('link');
    tabs.forEach((tab) => {
      expect(tab.className).toMatch(/min-h-\[44px\]/);
      expect(tab.className).toMatch(/min-w-\[44px\]/);
    });
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
