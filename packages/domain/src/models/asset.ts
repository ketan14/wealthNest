import { Brand } from '@wealthnest/shared';
import { Money } from '../money/money.js';

export type AssetId = Brand<string, 'AssetId'>;

export type AssetClass =
  | 'cash'
  | 'equity'
  | 'mutual_fund'
  | 'fixed_income'
  | 'real_estate'
  | 'crypto'
  | 'commodity'
  | 'alternative';

export type InstrumentType =
  'equity_share' | 'mutual_fund_scheme' | 'etf' | 'reit' | 'sgb' | 'bond' | 'other';

/**
 * Domain entity contract for an asset holding scaffold
 */
export interface AssetHolding {
  readonly id: AssetId;
  readonly name: string;
  readonly assetClass: AssetClass;
  readonly instrumentType?: InstrumentType;
  readonly isin?: string;
  readonly ticker?: string;
  readonly amcName?: string;
  readonly currentValue: Money;
  readonly updatedAt: string;
}
