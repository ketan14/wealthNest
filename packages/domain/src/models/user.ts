import { Brand, ISODateString } from '@wealthnest/shared';

export type UserId = Brand<string, 'UserId'>;

export interface UserProfile {
  readonly id: UserId;
  readonly email: string;
  readonly displayName?: string;
  readonly defaultCurrency: string;
  readonly createdAt: ISODateString;
}
