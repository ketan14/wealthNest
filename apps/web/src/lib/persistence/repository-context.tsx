import React, { createContext, useContext, useMemo } from 'react';
import {
  HoldingRepositoryPort,
  TransactionRepositoryPort,
  LiabilityRepositoryPort,
  GoalRepositoryPort,
  FamilyRepositoryPort,
  AssetClassRepositoryPort,
  BackupPort,
  CasImportRepositoryPort,
  SqliteDatabase,
  SqliteHoldingAdapter,
  SqliteTransactionAdapter,
  SqliteLiabilityAdapter,
  SqliteGoalAdapter,
  SqliteFamilyAdapter,
  SqliteAssetClassAdapter,
  SqliteBackupAdapter,
  SqliteCasImportAdapter,
} from '@wealthnest/application';

import { SupabaseHoldingAdapter } from '../supabase/holding.adapter';
import { SupabaseTransactionAdapter } from '../supabase/transaction.adapter';
import { SupabaseLiabilityAdapter } from '../supabase/liability.adapter';
import { SupabaseGoalAdapter } from '../supabase/goal.adapter';
import { SupabaseFamilyAdapter } from '../supabase/family.adapter';
import { SupabaseAssetClassAdapter } from '../supabase/asset-class.adapter';
import { SupabaseBackupAdapter } from '../supabase/backup.adapter';
import { SupabaseCasImportAdapter } from '../supabase/cas-import.adapter';
import { isTauri } from '../tauri/tauri-runtime';
import { TauriSqliteAdapter } from '../tauri/tauri-sqlite-adapter';
import { isOfflineLocalActive } from '../supabase/auth-context';

export interface RepositoryBundle {
  readonly holdingRepo: HoldingRepositoryPort;
  readonly transactionRepo: TransactionRepositoryPort;
  readonly liabilityRepo: LiabilityRepositoryPort;
  readonly goalRepo: GoalRepositoryPort;
  readonly familyRepo: FamilyRepositoryPort;
  readonly assetClassRepo: AssetClassRepositoryPort;
  readonly backupRepo: BackupPort;
  readonly casImportRepo: CasImportRepositoryPort;
  readonly mode: 'supabase' | 'sqlite';
}

export const defaultSupabaseBundle: RepositoryBundle = {
  holdingRepo: new SupabaseHoldingAdapter(),
  transactionRepo: new SupabaseTransactionAdapter(),
  liabilityRepo: new SupabaseLiabilityAdapter(),
  goalRepo: new SupabaseGoalAdapter(),
  familyRepo: new SupabaseFamilyAdapter(),
  assetClassRepo: new SupabaseAssetClassAdapter(),
  backupRepo: new SupabaseBackupAdapter(),
  casImportRepo: new SupabaseCasImportAdapter(),
  mode: 'supabase',
};

export function createSqliteRepositoryBundle(db?: SqliteDatabase): RepositoryBundle {
  const sqliteDb =
    db ??
    (() => {
      const adapter = new TauriSqliteAdapter();
      adapter.initialize();
      return adapter;
    })();

  const holdingRepo = new SqliteHoldingAdapter(sqliteDb);
  const transactionRepo = new SqliteTransactionAdapter(sqliteDb);
  const liabilityRepo = new SqliteLiabilityAdapter(sqliteDb);
  const goalRepo = new SqliteGoalAdapter(sqliteDb);
  const familyRepo = new SqliteFamilyAdapter(sqliteDb);
  const assetClassRepo = new SqliteAssetClassAdapter(sqliteDb);
  const backupRepo = new SqliteBackupAdapter(
    sqliteDb,
    holdingRepo,
    transactionRepo,
    liabilityRepo,
    goalRepo
  );
  const casImportRepo = new SqliteCasImportAdapter(sqliteDb);

  return {
    holdingRepo,
    transactionRepo,
    liabilityRepo,
    goalRepo,
    familyRepo,
    assetClassRepo,
    backupRepo,
    casImportRepo,
    mode: 'sqlite',
  };
}

const RepositoryContext = createContext<RepositoryBundle | null>(null);

export interface RepositoryProviderProps {
  readonly children: React.ReactNode;
  readonly customRepositories?: Partial<RepositoryBundle>;
  readonly mode?: 'supabase' | 'sqlite';
  readonly sqliteDb?: SqliteDatabase;
}

export function RepositoryProvider({
  children,
  customRepositories,
  mode,
  sqliteDb,
}: RepositoryProviderProps) {
  const bundle = useMemo<RepositoryBundle>(() => {
    const resolvedMode =
      customRepositories?.mode ??
      mode ??
      (isTauri() || isOfflineLocalActive() ? 'sqlite' : 'supabase');
    const baseBundle =
      resolvedMode === 'sqlite'
        ? createSqliteRepositoryBundle(sqliteDb)
        : defaultSupabaseBundle;

    return {
      ...baseBundle,
      ...customRepositories,
      mode: resolvedMode,
    };
  }, [customRepositories, mode, sqliteDb]);

  return (
    <RepositoryContext.Provider value={bundle}>
      {children}
    </RepositoryContext.Provider>
  );
}

export function useRepositories(): RepositoryBundle {
  const context = useContext(RepositoryContext);
  return context ?? defaultSupabaseBundle;
}

export function useHoldingRepository(): HoldingRepositoryPort {
  return useRepositories().holdingRepo;
}

export function useTransactionRepository(): TransactionRepositoryPort {
  return useRepositories().transactionRepo;
}

export function useLiabilityRepository(): LiabilityRepositoryPort {
  return useRepositories().liabilityRepo;
}

export function useGoalRepository(): GoalRepositoryPort {
  return useRepositories().goalRepo;
}

export function useFamilyRepository(): FamilyRepositoryPort {
  return useRepositories().familyRepo;
}

export function useAssetClassRepository(): AssetClassRepositoryPort {
  return useRepositories().assetClassRepo;
}

export function useBackupRepository(): BackupPort {
  return useRepositories().backupRepo;
}

export function useCasImportRepository(): CasImportRepositoryPort {
  return useRepositories().casImportRepo;
}
