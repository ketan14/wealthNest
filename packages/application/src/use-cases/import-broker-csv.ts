import { Result, ok, err, isOk } from '@wealthnest/shared';
import {
  BrokerProvider,
  BrokerCsvType,
  ParsedBrokerHolding,
  ParsedBrokerTrade,
  detectAndParseBrokerCsv,
} from '@wealthnest/domain';
import { HoldingRepositoryPort } from '../ports/holding-repository.port.js';
import { TransactionRepositoryPort } from '../ports/transaction-repository.port.js';

export interface ImportBrokerCsvParams {
  readonly csvContent: string;
  readonly userId: string;
  readonly preferredBroker?: BrokerProvider;
  readonly targetMemberId?: string;
  readonly targetAccountId?: string;
}

export interface ImportBrokerCsvResultDto {
  readonly provider: BrokerProvider;
  readonly csvType: BrokerCsvType;
  readonly totalParsed: number;
  readonly holdingsImported: number;
  readonly tradesImported: number;
  readonly parsedHoldings: readonly ParsedBrokerHolding[];
  readonly parsedTrades: readonly ParsedBrokerTrade[];
  readonly warnings: readonly string[];
}

export class ImportBrokerCsvUseCase {
  constructor(
    private readonly holdingRepo?: HoldingRepositoryPort,
    private readonly transactionRepo?: TransactionRepositoryPort
  ) {}

  async execute(params: ImportBrokerCsvParams): Promise<Result<ImportBrokerCsvResultDto>> {
    try {
      const parsed = detectAndParseBrokerCsv(params.csvContent, params.preferredBroker as any);

      let holdingsImported = 0;
      let tradesImported = 0;

      // Import Holdings
      if (parsed.holdings.length > 0 && this.holdingRepo) {
        for (const h of parsed.holdings) {
          const createRes = await this.holdingRepo.createHoldingWithAsset({
            userId: params.userId,
            name: h.name,
            ticker: h.symbol,
            isin: h.isin,
            assetClassId:
              h.assetType === 'mutual_fund'
                ? 'mutual_fund'
                : h.assetType === 'commodity'
                ? 'commodity'
                : 'equity',
            currency: 'INR',
            quantity: h.quantity,
            unitCostCents: Number(h.unitCost.cents),
            currentValueCents: Number(h.currentValue?.cents ?? h.unitCost.multiply(h.quantity).cents),
            costBasisVerified: true,
            memberId: params.targetMemberId,
            accountId: params.targetAccountId,
          });

          if (isOk(createRes)) {
            holdingsImported++;
          }
        }
      }

      // Import Trades / Orders
      if (parsed.trades.length > 0 && this.transactionRepo) {
        for (const t of parsed.trades) {
          const createTxRes = await this.transactionRepo.createTransaction({
            userId: params.userId,
            type: t.tradeType.toLowerCase() as any,
            quantity: t.quantity,
            amountCents: Number(t.totalAmount.cents),
            currency: 'INR',
            transactionDate: t.tradeDate,
            notes: `${t.rawBroker} ${t.tradeType} ${t.symbol}${t.tradeId ? ` [Trade #${t.tradeId}]` : ''}`,
            memberId: params.targetMemberId,
            accountId: params.targetAccountId,
          });

          if (isOk(createTxRes)) {
            tradesImported++;
          }
        }
      }

      return ok({
        provider: parsed.provider,
        csvType: parsed.csvType,
        totalParsed: parsed.totalRecords,
        holdingsImported,
        tradesImported,
        parsedHoldings: parsed.holdings,
        parsedTrades: parsed.trades,
        warnings: parsed.warnings,
      });
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to parse and import broker CSV'));
    }
  }
}
