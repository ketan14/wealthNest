import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomNavigationBar } from '../components/layout/BottomNavigationBar';
import { Sidebar } from '../components/layout/Sidebar';
import { AdminProvider } from '../lib/admin/admin-context';

describe('Phase 9.2: Mobile Navigation Shell & Ergonomics', () => {
  it('TC-9.2-01A: renders BottomNavigationBar with primary touch tabs and without quick-add FAB', () => {
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

    // Primary tabs + More
    expect(screen.getByTestId('bottom-nav-overview')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav-portfolio')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav-liabilities')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav-cashflow')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav-settings')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav-more')).toBeInTheDocument();

    // Quick-Add FAB removed per Option A
    expect(screen.queryByTestId('bottom-nav-quick-add')).not.toBeInTheDocument();

    // Verify minimum touch target & non-wrapping label classes
    const tabs = screen.getAllByRole('link');
    tabs.forEach((tab) => {
      expect(tab.className).toMatch(/min-h-\[44px\]/);
      expect(tab.className).toMatch(/min-w-\[44px\]/);
      expect(tab.className).toMatch(/whitespace-nowrap/);
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

  it('TC-9.2-01C: enforces touch-action manipulation, callout suppression, and overscroll containment in CSS', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
    expect(css).toContain('touch-action: manipulation;');
    expect(css).toContain('-webkit-touch-callout: none;');
    expect(css).toContain('overscroll-behavior-y: contain;');
    expect(css).toContain('user-select: text;');
  });
});
