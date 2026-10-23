import { Result, ok, err } from '@wealthnest/shared';
import { PortfolioBackupData } from '../ports/backup.port.js';

export interface ParsedBackupPreview {
  readonly isValid: boolean;
  readonly data?: PortfolioBackupData;
  readonly version: string;
  readonly exportedAt: string;
  readonly userEmail: string;
  readonly holdingsCount: number;
  readonly transactionsCount: number;
  readonly liabilitiesCount: number;
  readonly goalsCount: number;
  readonly totalAssetsCents: number;
  readonly totalLiabilitiesCents: number;
  readonly netWorthCents: number;
  readonly errors: readonly string[];
}

export class ValidateAndParseBackupUseCase {
  execute(jsonContent: string): Result<ParsedBackupPreview> {
    try {
      if (!jsonContent || typeof jsonContent !== 'string') {
        return err(new Error('Backup file is empty or not a valid text file'));
      }

      let parsed: any;
      try {
        parsed = JSON.parse(jsonContent);
      } catch (_jsonErr) {
        return ok({
          isValid: false,
          version: 'unknown',
          exportedAt: '',
          userEmail: '',
          holdingsCount: 0,
          transactionsCount: 0,
          liabilitiesCount: 0,
          goalsCount: 0,
          totalAssetsCents: 0,
          totalLiabilitiesCents: 0,
          netWorthCents: 0,
          errors: ['Invalid JSON syntax: could not parse file'],
        });
      }

      const errors: string[] = [];

      if (!parsed.version) {
        errors.push('Missing backup schema version');
      }
      if (parsed.schema && parsed.schema !== 'wealthnest-portfolio-v1') {
        errors.push(`Unsupported schema type: ${parsed.schema}`);
      }
      if (!Array.isArray(parsed.holdings)) {
        errors.push('Missing or invalid "holdings" array');
      }
      if (!Array.isArray(parsed.transactions)) {
        errors.push('Missing or invalid "transactions" array');
      }
      if (!Array.isArray(parsed.liabilities)) {
        errors.push('Missing or invalid "liabilities" array');
      }
      if (!Array.isArray(parsed.goals)) {
        errors.push('Missing or invalid "goals" array');
      }

      const isValid = errors.length === 0;

      const holdings = Array.isArray(parsed.holdings) ? parsed.holdings : [];
      const transactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];
      const liabilities = Array.isArray(parsed.liabilities) ? parsed.liabilities : [];
      const goals = Array.isArray(parsed.goals) ? parsed.goals : [];

      const totalAssetsCents = holdings.reduce(
        (sum: number, h: any) => sum + Number(h.currentValueCents || 0),
        0
      );
      const totalLiabilitiesCents = liabilities.reduce(
        (sum: number, l: any) => sum + Number(l.currentBalanceCents || 0),
        0
      );
      const netWorthCents = totalAssetsCents - totalLiabilitiesCents;

      return ok({
        isValid,
        data: isValid ? (parsed as PortfolioBackupData) : undefined,
        version: String(parsed.version || 'unknown'),
        exportedAt: String(parsed.exportedAt || new Date().toISOString()),
        userEmail: String(parsed.user?.email || 'unknown'),
        holdingsCount: holdings.length,
        transactionsCount: transactions.length,
        liabilitiesCount: liabilities.length,
        goalsCount: goals.length,
        totalAssetsCents,
        totalLiabilitiesCents,
        netWorthCents,
        errors,
      });
    } catch (e: any) {
      return err(new Error(e?.message || 'Error parsing backup'));
    }
  }
}
