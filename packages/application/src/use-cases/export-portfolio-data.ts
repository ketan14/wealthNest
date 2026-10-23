import { Result, ok, err, isOk } from '@wealthnest/shared';
import { DEFAULT_USER_PREFERENCES } from '@wealthnest/domain';
import { HoldingRepositoryPort, HoldingDetailDto } from '../ports/holding-repository.port.js';
import { TransactionRepositoryPort, TransactionDetailDto } from '../ports/transaction-repository.port.js';
import { LiabilityRepositoryPort, LiabilityDto } from '../ports/liability-repository.port.js';
import { GoalRepositoryPort, GoalDetailDto } from '../ports/goal-repository.port.js';
import { UserRepositoryPort } from '../ports/user-repository.port.js';
import { PortfolioBackupData } from '../ports/backup.port.js';

export interface ExportedPortfolioFiles {
  readonly backupJson: PortfolioBackupData;
  readonly backupJsonString: string;
  readonly holdingsCsv: string;
  readonly transactionsCsv: string;
  readonly liabilitiesCsv: string;
  readonly goalsCsv: string;
  readonly summaryFilename: string;
}

export class ExportPortfolioDataUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly holdingRepo: HoldingRepositoryPort,
    private readonly transactionRepo: TransactionRepositoryPort,
    private readonly liabilityRepo: LiabilityRepositoryPort,
    private readonly goalRepo: GoalRepositoryPort
  ) {}

  async execute(userId: string): Promise<Result<ExportedPortfolioFiles>> {
    try {
      // 1. Fetch user profile
      const userRes = await this.userRepo.getById(userId as any);
      const userProfile = isOk(userRes) && userRes.value ? userRes.value : {
        id: userId as any,
        email: 'user@wealthnest.local',
        displayName: 'WealthNest User',
        defaultCurrency: 'INR',
        preferences: DEFAULT_USER_PREFERENCES,
        createdAt: new Date().toISOString(),
      };

      // 2. Fetch all modules in parallel
      const [holdingsRes, transactionsRes, liabilitiesRes, goalsRes] = await Promise.all([
        this.holdingRepo.listDetailsByUser(userId),
        this.transactionRepo.listByUser(userId),
        this.liabilityRepo.listLiabilitiesByUser(userId),
        this.goalRepo.listGoalsByUser(userId),
      ]);

      const holdings = isOk(holdingsRes) ? holdingsRes.value : [];
      const transactions = isOk(transactionsRes) ? transactionsRes.value : [];
      const liabilities = isOk(liabilitiesRes) ? liabilitiesRes.value : [];
      const goals = isOk(goalsRes) ? goalsRes.value : [];

      // Calculate totals
      const totalAssetsCents = holdings.reduce(
        (sum: number, h: HoldingDetailDto) => sum + Number(h.currentValueCents || 0),
        0
      );
      const totalLiabilitiesCents = liabilities.reduce(
        (sum: number, l: LiabilityDto) => sum + Number(l.currentBalanceCents || 0n),
        0
      );
      const netWorthCents = totalAssetsCents - totalLiabilitiesCents;

      const backupJson: PortfolioBackupData = {
        version: '1.0.0',
        schema: 'wealthnest-portfolio-v1',
        exportedAt: new Date().toISOString(),
        user: {
          id: userId,
          email: userProfile.email,
          displayName: userProfile.displayName,
          defaultCurrency: userProfile.defaultCurrency || 'INR',
          preferences: userProfile.preferences || DEFAULT_USER_PREFERENCES,
        },
        holdings,
        transactions,
        liabilities,
        goals,
        metrics: {
          totalAssetsCents,
          totalLiabilitiesCents,
          netWorthCents,
          totalHoldings: holdings.length,
          totalTransactions: transactions.length,
          totalLiabilities: liabilities.length,
          totalGoals: goals.length,
        },
      };

      const backupJsonString = JSON.stringify(
        backupJson,
        (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
        2
      );
      const holdingsCsv = this.generateHoldingsCsv(holdings);
      const transactionsCsv = this.generateTransactionsCsv(transactions);
      const liabilitiesCsv = this.generateLiabilitiesCsv(liabilities);
      const goalsCsv = this.generateGoalsCsv(goals);

      const dateStr = new Date().toISOString().split('T')[0];
      const summaryFilename = `wealthnest_portfolio_backup_${dateStr}.json`;

      return ok({
        backupJson,
        backupJsonString,
        holdingsCsv,
        transactionsCsv,
        liabilitiesCsv,
        goalsCsv,
        summaryFilename,
      });
    } catch (error: any) {
      return err(new Error(error?.message || 'Failed to export portfolio data'));
    }
  }

  private escapeCsvCell(val: string | number | undefined | null): string {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  generateHoldingsCsv(holdings: readonly HoldingDetailDto[]): string {
    const headers = [
      'Holding ID',
      'Asset Name',
      'Ticker',
      'ISIN',
      'Asset Class',
      'Quantity',
      'Unit Cost (₹)',
      'Current Value (₹)',
      'Unrealized Gain/Loss (₹)',
      'Currency',
      'AMC / Issuer',
      'Folio Number',
      'Updated At',
    ];

    const rows = holdings.map((h) => {
      const unitCost = (h.unitCostCents / 100).toFixed(2);
      const currentVal = (h.currentValueCents / 100).toFixed(2);
      const totalCost = (h.quantity * (h.unitCostCents / 100));
      const gainLoss = ((h.currentValueCents / 100) - totalCost).toFixed(2);

      return [
        this.escapeCsvCell(h.holdingId),
        this.escapeCsvCell(h.name),
        this.escapeCsvCell(h.ticker || ''),
        this.escapeCsvCell(h.isin || ''),
        this.escapeCsvCell(h.assetClassName),
        this.escapeCsvCell(h.quantity),
        this.escapeCsvCell(unitCost),
        this.escapeCsvCell(currentVal),
        this.escapeCsvCell(gainLoss),
        this.escapeCsvCell(h.currency),
        this.escapeCsvCell(h.amcName || ''),
        this.escapeCsvCell(h.folioNumber || ''),
        this.escapeCsvCell(h.updatedAt),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  generateTransactionsCsv(transactions: readonly TransactionDetailDto[]): string {
    const headers = [
      'Transaction ID',
      'Date',
      'Type',
      'Asset Name',
      'Ticker',
      'Quantity',
      'Amount (₹)',
      'Currency',
      'Notes',
    ];

    const rows = transactions.map((t) => [
      this.escapeCsvCell(t.id),
      this.escapeCsvCell(t.transactionDate),
      this.escapeCsvCell(t.type),
      this.escapeCsvCell(t.assetName || ''),
      this.escapeCsvCell(t.assetTicker || ''),
      this.escapeCsvCell(t.quantity || ''),
      this.escapeCsvCell((t.amountCents / 100).toFixed(2)),
      this.escapeCsvCell(t.currency),
      this.escapeCsvCell(t.notes || ''),
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  generateLiabilitiesCsv(liabilities: readonly LiabilityDto[]): string {
    const headers = [
      'Liability ID',
      'Loan Name',
      'Loan Type',
      'Lender / Bank',
      'Original Principal (₹)',
      'Current Balance (₹)',
      'Interest Rate (%)',
      'Interest Type',
      'Monthly EMI (₹)',
      'Status',
      'Start Date',
      'End Date',
    ];

    const rows = liabilities.map((l) => [
      this.escapeCsvCell(l.id),
      this.escapeCsvCell(l.name),
      this.escapeCsvCell(l.loanType),
      this.escapeCsvCell(l.lender),
      this.escapeCsvCell((Number(l.originalPrincipalCents) / 100).toFixed(2)),
      this.escapeCsvCell((Number(l.currentBalanceCents) / 100).toFixed(2)),
      this.escapeCsvCell(l.interestRate),
      this.escapeCsvCell(l.interestType),
      this.escapeCsvCell((Number(l.emiAmountCents) / 100).toFixed(2)),
      this.escapeCsvCell(l.status),
      this.escapeCsvCell(l.startDate || ''),
      this.escapeCsvCell(l.endDate || ''),
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  generateGoalsCsv(goals: readonly GoalDetailDto[]): string {
    const headers = [
      'Goal ID',
      'Goal Name',
      'Category',
      'Target Amount (₹)',
      'Target Date',
      'Initial Saved (₹)',
      'Monthly Contribution (₹)',
      'Expected Return (%)',
      'Inflation Rate (%)',
      'Priority',
      'Linked Holdings Count',
    ];

    const rows = goals.map((g) => [
      this.escapeCsvCell(g.id),
      this.escapeCsvCell(g.name),
      this.escapeCsvCell(g.category),
      this.escapeCsvCell((g.targetAmountCents / 100).toFixed(2)),
      this.escapeCsvCell(g.targetDate),
      this.escapeCsvCell((g.initialSavedCents / 100).toFixed(2)),
      this.escapeCsvCell((g.monthlyContributionCents / 100).toFixed(2)),
      this.escapeCsvCell(g.expectedReturnRate),
      this.escapeCsvCell(g.inflationRate),
      this.escapeCsvCell(g.priority),
      this.escapeCsvCell(g.linkedHoldings?.length || 0),
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }
}
