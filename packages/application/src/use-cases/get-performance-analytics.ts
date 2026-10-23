import { Result, ok, err } from '@wealthnest/shared';
import {
  CurrencyCode,
  Money,
  AllocationModelType,
  calculatePortfolioAnalytics,
  AnalyticsInputHolding,
  AnalyticsInputTransaction,
  BenchmarkComparison,
  AllocationDriftItem,
  ConcentrationMetrics,
  TrajectoryDataPoint,
} from '@wealthnest/domain';
import { HoldingRepositoryPort } from '../ports/holding-repository.port.js';
import { TransactionRepositoryPort } from '../ports/transaction-repository.port.js';

export interface GetPerformanceAnalyticsParams {
  readonly userId: string;
  readonly currency?: CurrencyCode;
  readonly modelType?: AllocationModelType;
}

export interface PerformanceAnalyticsDto {
  readonly totalValue: {
    readonly cents: string;
    readonly decimal: number;
    readonly currency: string;
  };
  readonly totalCostBasis: {
    readonly cents: string;
    readonly decimal: number;
    readonly currency: string;
  };
  readonly absoluteGain: {
    readonly cents: string;
    readonly decimal: number;
    readonly currency: string;
  };
  readonly returnPercentage: number;
  readonly xirr: number | null; // e.g. 0.162 (16.2% p.a.)
  readonly cagr: number;
  readonly alphaVsNifty: number;
  readonly isOutperforming: boolean;
  readonly concentration: ConcentrationMetrics;
  readonly drifts: readonly AllocationDriftItem[];
  readonly benchmarks: readonly BenchmarkComparison[];
  readonly trajectory: readonly TrajectoryDataPoint[];
}

export class GetPerformanceAnalyticsUseCase {
  constructor(
    private readonly holdingRepo: HoldingRepositoryPort,
    private readonly transactionRepo: TransactionRepositoryPort
  ) {}

  async execute(params: GetPerformanceAnalyticsParams): Promise<Result<PerformanceAnalyticsDto>> {
    if (!params.userId || params.userId.trim().length === 0) {
      return err(new Error('User ID is required.'));
    }

    const currency: CurrencyCode = params.currency || 'INR';
    const modelType: AllocationModelType = params.modelType || 'balanced';

    // 1. Fetch user holdings
    const holdingsResult = await this.holdingRepo.listDetailsByUser(params.userId);
    if (!holdingsResult.success) {
      return err(holdingsResult.error);
    }

    // 2. Fetch user transactions
    const transactionsResult = await this.transactionRepo.listByUser(params.userId);
    if (!transactionsResult.success) {
      return err(transactionsResult.error);
    }

    // 3. Map holdings to domain analytics inputs
    const domainHoldings: AnalyticsInputHolding[] = holdingsResult.value.map((h) => {
      const hCurrency = (h.currency as CurrencyCode) || currency;
      const totalCostCents = BigInt(Math.round(h.quantity * h.unitCostCents));
      const totalValCents = BigInt(Math.round(h.currentValueCents));

      return {
        holdingId: h.holdingId,
        name: h.name,
        ticker: h.ticker,
        assetClassId: h.assetClassId,
        assetClassName: h.assetClassName,
        colorHex: h.assetClassColor,
        costBasis: Money.fromCents(totalCostCents, hCurrency),
        currentValue: Money.fromCents(totalValCents, hCurrency),
        acquisitionDate: h.updatedAt,
      };
    });

    // 4. Map transactions to domain analytics inputs
    const domainTransactions: AnalyticsInputTransaction[] = transactionsResult.value.map((t) => ({
      date: t.transactionDate,
      type: t.type as 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'dividend',
      amountCents: BigInt(Math.round(t.amountCents)),
      currency: t.currency,
    }));

    // 5. Execute pure domain analytics calculation
    const summary = calculatePortfolioAnalytics(domainHoldings, domainTransactions, currency, modelType);

    // 6. Return serializable DTO
    const dto: PerformanceAnalyticsDto = {
      totalValue: {
        cents: summary.totalValue.cents.toString(),
        decimal: summary.totalValue.toDecimal(),
        currency: summary.totalValue.currency,
      },
      totalCostBasis: {
        cents: summary.totalCostBasis.cents.toString(),
        decimal: summary.totalCostBasis.toDecimal(),
        currency: summary.totalCostBasis.currency,
      },
      absoluteGain: {
        cents: summary.absoluteGain.cents.toString(),
        decimal: summary.absoluteGain.toDecimal(),
        currency: summary.absoluteGain.currency,
      },
      returnPercentage: summary.returnPercentage,
      xirr: summary.xirr,
      cagr: summary.cagr,
      alphaVsNifty: summary.alphaVsNifty,
      isOutperforming: summary.isOutperforming,
      concentration: summary.concentration,
      drifts: summary.drifts,
      benchmarks: summary.benchmarks,
      trajectory: summary.trajectory,
    };

    return ok(dto);
  }
}
