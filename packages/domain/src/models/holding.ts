import { Brand } from '@wealthnest/shared';
import { Money } from '../money/money.js';
import { UserId } from './user.js';
import { AssetId } from './asset.js';

export type HoldingId = Brand<string, 'HoldingId'>;

export interface HoldingEntity {
  readonly id: HoldingId;
  readonly userId: UserId;
  readonly assetId: AssetId;
  readonly quantity: number;
  readonly unitCost: Money;
  readonly currentValue: Money;
  readonly updatedAt: string;
}
