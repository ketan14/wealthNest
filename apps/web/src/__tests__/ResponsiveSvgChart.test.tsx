import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AnalyticsPage from '../pages/AnalyticsPage';
import { AuthProvider } from '../lib/supabase/auth-context';
import { FamilyProvider } from '../lib/family/family-context';
import { RepositoryProvider } from '../lib/persistence/repository-context';

describe('Phase 9.2: Responsive SVG Chart Layout', () => {
  it('TC-9.2-04A: Analytics SVG chart does not have min-w-[600px] forcing horizontal overflow', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RepositoryProvider>
            <FamilyProvider>
              <MemoryRouter>
                <AnalyticsPage />
              </MemoryRouter>
            </FamilyProvider>
          </RepositoryProvider>
        </AuthProvider>
      </QueryClientProvider>
    );

    const projectionSvg = screen.getByTestId('analytics-trajectory-svg');

    expect(projectionSvg).toBeDefined();
    expect(projectionSvg.getAttribute('class')).not.toContain('min-w-[600px]');
    expect(projectionSvg.getAttribute('class')).toContain('w-full');
    expect(projectionSvg.getAttribute('class')).toContain('max-w-full');
    expect(projectionSvg.getAttribute('role')).toBe('img');
    expect(projectionSvg.getAttribute('aria-label')).toContain('trajectory chart');

    // Toggle accessible data table fallback
    const toggleBtn = screen.getByRole('button', { name: /View Data Table/i });
    fireEvent.click(toggleBtn);
    expect(screen.getByRole('button', { name: /View Chart/i })).toBeInTheDocument();
  });
});
