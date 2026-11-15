import { Brand, ISODateString } from '@wealthnest/shared';
import { Money } from '../money/money.js';
import { UserId } from './user.js';
import { AssetId } from './asset.js';
import type { RecordVisibility } from '../household/household-types.js';

export type TransactionId = Brand<string, 'TransactionId'>;

export type TransactionType =
  'buy' | 'sell' | 'deposit' | 'withdrawal' | 'dividend' | 'fee' | 'transfer';

export interface TransactionEntity {
  readonly id: TransactionId;
  readonly householdId?: string;
  readonly userId: UserId;
  readonly assetId?: AssetId;
  readonly visibility?: RecordVisibility;
  readonly type: TransactionType;
  readonly quantity?: number;
  readonly amount: Money;
  readonly date: ISODateString;
  readonly notes?: string;
  readonly memberId?: string;
  readonly accountId?: string; // Source account (or primary account)
  readonly destinationAccountId?: string; // Target account for transfers
}
