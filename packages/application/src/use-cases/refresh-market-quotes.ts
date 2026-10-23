import { Result, ok, err, isOk } from '@wealthnest/shared';
import { HoldingRepositoryPort } from '../ports/holding-repository.port.js';
import { MarketDataPort, MarketQuoteDto } from '../ports/market-data.port.js';

export interface RefreshedPortfolioValuationDto {
  readonly quotes: readonly MarketQuoteDto[];
  readonly totalUpdatedHoldings: number;
  readonly asOfDate: string;
}

export class RefreshMarketQuotesUseCase {
  constructor(
    private readonly holdingRepo: HoldingRepositoryPort,
    private readonly marketDataPort: MarketDataPort
  ) {}

  async execute(userId: string): Promise<Result<RefreshedPortfolioValuationDto>> {
    try {
      const holdingsRes = await this.holdingRepo.listDetailsByUser(userId);
      const holdings = isOk(holdingsRes) ? holdingsRes.value : [];

      const quotesRes = await this.marketDataPort.refreshPortfolioQuotes(holdings);
      if (!isOk(quotesRes)) {
        return quotesRes;
      }

      const quotes = quotesRes.value;

      return ok({
        quotes,
        totalUpdatedHoldings: quotes.length,
        asOfDate: new Date().toISOString(),
      });
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to refresh market quotes'));
    }
  }
}
