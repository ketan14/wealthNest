import { CurrencyCode } from '../money/currency.js';
import { Money } from '../money/money.js';

export type LoanType =
  | 'home_loan'
  | 'vehicle_loan'
  | 'personal_loan'
  | 'education_loan'
  | 'credit_card'
  | 'gold_loan'
  | 'business_loan'
  | 'other';

export type InterestType = 'fixed' | 'floating';

export type LiabilityStatus = 'active' | 'closed' | 'refinanced' | 'defaulted';

export type AssetLiabilityLinkType =
  'mortgage' | 'collateral' | 'pledge' | 'hypothecation' | 'unsecured';

export interface LiabilityEntity {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly loanType: LoanType;
  readonly lender: string;
  readonly accountNumber?: string;
  readonly originalPrincipal: Money;
  readonly interestRate: number; // e.g. 8.5 for 8.50%
  readonly interestType: InterestType;
  readonly tenureMonths?: number;
  readonly emiAmount: Money;
  readonly currency: CurrencyCode;
  readonly startDate?: string; // YYYY-MM-DD
  readonly endDate?: string; // YYYY-MM-DD
  readonly status: LiabilityStatus;
  readonly linkedAssetId?: string;
  readonly notes?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LiabilityBalanceEntity {
  readonly id: string;
  readonly liabilityId: string;
  readonly userId: string;
  readonly balance: Money;
  readonly asOfDate: string; // YYYY-MM-DD
  readonly source: string;
  readonly notes?: string;
  readonly createdAt: string;
}

export interface AssetLiabilityLinkEntity {
  readonly id: string;
  readonly userId: string;
  readonly assetId: string;
  readonly liabilityId: string;
  readonly linkType: AssetLiabilityLinkType;
  readonly ownershipSharePercentage: number;
  readonly createdAt: string;
}

export interface LoanPaymentEntity {
  readonly id: string;
  readonly liabilityId: string;
  readonly userId: string;
  readonly paymentDate: string; // YYYY-MM-DD
  readonly totalPayment: Money;
  readonly principalPaid: Money;
  readonly interestPaid: Money;
  readonly extraPayment: Money;
  readonly currency: CurrencyCode;
  readonly transactionId?: string;
  readonly notes?: string;
  readonly createdAt: string;
}
