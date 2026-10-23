import { Brand, ISODateString } from '@wealthnest/shared';
import { Money } from '../money/money.js';
import { UserId } from './user.js';
import { AssetId } from './asset.js';

export type TransactionId = Brand<string, 'TransactionId'>;

export type TransactionType = 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'dividend' | 'fee';

export interface TransactionEntity {
  readonly id: TransactionId;
  readonly userId: UserId;
  readonly assetId?: AssetId;
  readonly type: TransactionType;
  readonly quantity?: number;
  readonly amount: Money;
  readonly date: ISODateString;
  readonly notes?: string;
  readonly memberId?: string;
  readonly accountId?: string;
}
