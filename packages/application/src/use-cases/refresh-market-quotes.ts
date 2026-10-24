import { Result, ok, err, isOk } from '@wealthnest/shared';
import { HoldingRepositoryPort } from '../ports/holding-repository.port.js';
import { MarketDataPort, MarketQuoteDto, MarketSessionDto } from '../ports/market-data.port.js';

export interface RefreshedPortfolioValuationDto {
  readonly quotes: readonly MarketQuoteDto[];
  readonly totalUpdatedHoldings: number;
  readonly equitiesCount: number;
  readonly mutualFundsCount: number;
  readonly marketSession?: MarketSessionDto;
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
      const equitiesCount = quotes.filter(
        (q) => q.source === 'NSE' || q.source === 'BSE'
      ).length;
      const mutualFundsCount = quotes.filter((q) => q.source === 'AMFI').length;
      const marketSession = this.marketDataPort.getMarketSession
        ? this.marketDataPort.getMarketSession()
        : undefined;

      return ok({
        quotes,
        totalUpdatedHoldings: quotes.length,
        equitiesCount,
        mutualFundsCount,
        marketSession,
        asOfDate: new Date().toISOString(),
      });
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to refresh market quotes'));
    }
  }
}
