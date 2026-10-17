import { Result } from '@wealthnest/shared';
import { AssetClassDefinition } from '@wealthnest/domain';

export interface AssetClassRepositoryPort {
  listAll(): Promise<Result<AssetClassDefinition[]>>;
}
