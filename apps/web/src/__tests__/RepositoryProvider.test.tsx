import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  RepositoryProvider,
  useRepositories,
} from '../lib/persistence/repository-context';
import {
  AuthProvider,
  useAuth,
  OFFLINE_MODE_STORAGE_KEY,
  LOCAL_VAULT_USER_ID,
} from '../lib/supabase/auth-context';
import { HoldingRepositoryPort, SqliteCasImportAdapter } from '@wealthnest/application';
import { ok, err } from '@wealthnest/shared';

function TestConsumer() {
  const { mode, holdingRepo, casImportRepo } = useRepositories();
  const { user, isOfflineUser } = useAuth();
  return (
    <div>
      <span data-testid="repo-mode">{mode}</span>
      <span data-testid="has-holding">{holdingRepo ? 'yes' : 'no'}</span>
      <span data-testid="is-sqlite-cas">
        {casImportRepo instanceof SqliteCasImportAdapter ? 'yes' : 'no'}
      </span>
      <span data-testid="auth-user-id">{user?.id ?? 'none'}</span>
      <span data-testid="auth-user-name">{user?.user_metadata?.full_name ?? 'none'}</span>
      <span data-testid="is-offline-user">{isOfflineUser ? 'yes' : 'no'}</span>
    </div>
  );
}

describe('Phase 9.1: RepositoryProvider Decoupling Layer & Offline Default User', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__TAURI__;
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    window.localStorage.removeItem(OFFLINE_MODE_STORAGE_KEY);
  });

  it('TC-9.1-03A: defaults to Supabase mode in standard web browser and injects all repository ports', () => {
    render(
      <RepositoryProvider>
        <TestConsumer />
      </RepositoryProvider>
    );

    expect(screen.getByTestId('repo-mode').textContent).toBe('supabase');
    expect(screen.getByTestId('has-holding').textContent).toBe('yes');
    expect(screen.getByTestId('is-sqlite-cas').textContent).toBe('no');
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
    expect(screen.getByTestId('is-sqlite-cas').textContent).toBe('yes');
  });

  it('TC-9.1-03C: gracefully falls back to default Supabase bundle when hook is called outside RepositoryProvider', () => {
    render(<TestConsumer />);

    expect(screen.getByTestId('repo-mode').textContent).toBe('supabase');
    expect(screen.getByTestId('has-holding').textContent).toBe('yes');
  });

  it('TC-9.1-03D: automatically bootstraps SQLite repository bundle and offline default user (Ketan Vaghela) when running inside Tauri runtime', () => {
    (window as unknown as Record<string, unknown>).__TAURI__ = {};

    render(
      <AuthProvider>
        <RepositoryProvider>
          <TestConsumer />
        </RepositoryProvider>
      </AuthProvider>
    );

    expect(screen.getByTestId('repo-mode').textContent).toBe('sqlite');
    expect(screen.getByTestId('has-holding').textContent).toBe('yes');
    expect(screen.getByTestId('is-sqlite-cas').textContent).toBe('yes');
    expect(screen.getByTestId('auth-user-id').textContent).toBe(LOCAL_VAULT_USER_ID);
    expect(screen.getByTestId('auth-user-name').textContent).toBe('Ketan Vaghela');
    expect(screen.getByTestId('is-offline-user').textContent).toBe('yes');
  });
});
