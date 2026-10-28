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
} from '@wealthnest/application';

import { SupabaseHoldingAdapter } from '../supabase/holding.adapter';
import { SupabaseTransactionAdapter } from '../supabase/transaction.adapter';
import { SupabaseLiabilityAdapter } from '../supabase/liability.adapter';
import { SupabaseGoalAdapter } from '../supabase/goal.adapter';
import { SupabaseFamilyAdapter } from '../supabase/family.adapter';
import { SupabaseAssetClassAdapter } from '../supabase/asset-class.adapter';
import { SupabaseBackupAdapter } from '../supabase/backup.adapter';
import { SupabaseCasImportAdapter } from '../supabase/cas-import.adapter';

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

const RepositoryContext = createContext<RepositoryBundle | null>(null);

export interface RepositoryProviderProps {
  readonly children: React.ReactNode;
  readonly customRepositories?: Partial<RepositoryBundle>;
  readonly mode?: 'supabase' | 'sqlite';
}

export function RepositoryProvider({
  children,
  customRepositories,
  mode = 'supabase',
}: RepositoryProviderProps) {
  const bundle = useMemo<RepositoryBundle>(() => {
    return {
      ...defaultSupabaseBundle,
      ...customRepositories,
      mode: customRepositories?.mode ?? mode,
    };
  }, [customRepositories, mode]);

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
