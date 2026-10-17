import { Brand } from '@wealthnest/shared';
import { Money } from '../money/money.js';

export type AssetId = Brand<string, 'AssetId'>;

export type AssetClass =
  'cash' | 'equity' | 'fixed_income' | 'real_estate' | 'crypto' | 'commodity' | 'alternative';

/**
 * Domain entity contract for an asset holding scaffold
 */
export interface AssetHolding {
  readonly id: AssetId;
  readonly name: string;
  readonly assetClass: AssetClass;
  readonly currentValue: Money;
  readonly updatedAt: string;
}
