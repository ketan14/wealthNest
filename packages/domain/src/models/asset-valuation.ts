import { CurrencyCode } from '../money/currency.js';
import { Money } from '../money/money.js';

export interface AssetValuationEntity {
  readonly id: string;
  readonly userId: string;
  readonly assetId: string;
  readonly valuation: Money;
  readonly currency: CurrencyCode;
  readonly asOfDate: string; // YYYY-MM-DD
  readonly source: string;
  readonly notes?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
