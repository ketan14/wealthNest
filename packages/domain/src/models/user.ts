import { Brand, ISODateString } from '@wealthnest/shared';
import { CurrencyCode } from '../money/currency.js';

export type UserId = Brand<string, 'UserId'>;

export interface UserPreferences {
  readonly defaultCurrency: CurrencyCode;
  readonly numberFormat: 'en-IN' | 'en-US';
  readonly fiscalYearStart: '04-01' | '01-01';
  readonly taxRegime: 'new' | 'old';
  readonly theme: 'dark' | 'light' | 'system';
  readonly autoRefreshMarketData: boolean;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  defaultCurrency: 'INR',
  numberFormat: 'en-IN',
  fiscalYearStart: '04-01',
  taxRegime: 'new',
  theme: 'dark',
  autoRefreshMarketData: true,
};

export interface UserProfile {
  readonly id: UserId;
  readonly email: string;
  readonly displayName?: string;
  readonly defaultCurrency: string;
  readonly preferences?: UserPreferences;
  readonly createdAt: ISODateString;
  readonly updatedAt?: ISODateString;
}
