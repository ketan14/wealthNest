import { Result } from '@wealthnest/shared';
import { AssetClassDefinition } from '@wealthnest/domain';
import { AssetClassRepositoryPort } from '../ports/asset-class-repository.port.js';

export class ListAssetClassesUseCase {
  constructor(private readonly repository: AssetClassRepositoryPort) {}

  async execute(): Promise<Result<AssetClassDefinition[]>> {
    return this.repository.listAll();
  }
}
