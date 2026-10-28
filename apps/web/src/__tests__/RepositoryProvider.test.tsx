import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  RepositoryProvider,
  useRepositories,
} from '../lib/persistence/repository-context';
import { HoldingRepositoryPort } from '@wealthnest/application';
import { ok, err } from '@wealthnest/shared';

function TestConsumer() {
  const { mode, holdingRepo } = useRepositories();
  return (
    <div>
      <span data-testid="repo-mode">{mode}</span>
      <span data-testid="has-holding">{holdingRepo ? 'yes' : 'no'}</span>
    </div>
  );
}

describe('Phase 9.1: RepositoryProvider Decoupling Layer', () => {
  it('TC-9.1-03A: defaults to Supabase mode and injects all repository ports', () => {
    render(
      <RepositoryProvider>
        <TestConsumer />
      </RepositoryProvider>
    );

    expect(screen.getByTestId('repo-mode').textContent).toBe('supabase');
    expect(screen.getByTestId('has-holding').textContent).toBe('yes');
  });

  it('TC-9.1-03B: supports dynamic injection of SQLite / custom adapters without consumer code changes', () => {
    const mockHoldingRepo: HoldingRepositoryPort = {
      listDetailsByUser: async () => ok([]),
      createHoldingWithAsset: async () => err(new Error('mock')),
      deleteHolding: async () => ok(undefined),
    };

    render(
      <RepositoryProvider
        mode="sqlite"
        customRepositories={{
          holdingRepo: mockHoldingRepo,
        }}
      >
        <TestConsumer />
      </RepositoryProvider>
    );

    expect(screen.getByTestId('repo-mode').textContent).toBe('sqlite');
    expect(screen.getByTestId('has-holding').textContent).toBe('yes');
  });

  it('TC-9.1-03C: gracefully falls back to default Supabase bundle when hook is called outside RepositoryProvider', () => {
    render(<TestConsumer />);

    expect(screen.getByTestId('repo-mode').textContent).toBe('supabase');
    expect(screen.getByTestId('has-holding').textContent).toBe('yes');
  });
});
