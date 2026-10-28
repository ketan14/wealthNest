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
  private static readonly SUPPORTED_VERSIONS = new Set(['1.0.0']);
  private static readonly SUPPORTED_SCHEMA = 'wealthnest-portfolio-v1';
  private static readonly VALID_TRANSACTION_TYPES = new Set([
    'buy',
    'sell',
    'deposit',
    'withdrawal',
    'dividend',
    'fee',
  ]);

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

      // 1. Version and schema validation
      if (!parsed.version) {
        errors.push('Missing backup schema version');
      } else if (!ValidateAndParseBackupUseCase.SUPPORTED_VERSIONS.has(parsed.version)) {
        errors.push(`Unsupported backup version: ${parsed.version}. Supported versions: 1.0.0`);
      }

      if (!parsed.schema) {
        errors.push('Missing backup schema type');
      } else if (parsed.schema !== ValidateAndParseBackupUseCase.SUPPORTED_SCHEMA) {
        errors.push(
          `Unsupported schema type: ${parsed.schema}. Expected: ${ValidateAndParseBackupUseCase.SUPPORTED_SCHEMA}`
        );
      }

      // 2. Collection array structural validation
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

      const holdings = Array.isArray(parsed.holdings) ? parsed.holdings : [];
      const transactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];
      const liabilities = Array.isArray(parsed.liabilities) ? parsed.liabilities : [];
      const goals = Array.isArray(parsed.goals) ? parsed.goals : [];

      // 3. Deep Record & Duplicate ID Validation
      const holdingIds = new Set<string>();
      const assetIds = new Set<string>();

      for (let i = 0; i < holdings.length; i++) {
        const h = holdings[i];
        const hId = h.holdingId || h.id;
        if (!hId || typeof hId !== 'string') {
          errors.push(`Holding at index ${i} is missing a valid 'holdingId' or 'id'`);
        } else if (holdingIds.has(hId)) {
          errors.push(`Duplicate holding ID detected: '${hId}'`);
        } else {
          holdingIds.add(hId);
        }

        if (h.assetId) {
          assetIds.add(h.assetId);
        }

        if (typeof h.quantity === 'number' && h.quantity < 0) {
          errors.push(`Holding '${hId || i}' has negative quantity: ${h.quantity}`);
        }
        if (typeof h.unitCostCents === 'number' && h.unitCostCents < 0) {
          errors.push(`Holding '${hId || i}' has negative unit cost: ${h.unitCostCents}`);
        }
        if (typeof h.currentValueCents === 'number' && h.currentValueCents < 0) {
          errors.push(`Holding '${hId || i}' has negative current value: ${h.currentValueCents}`);
        }
      }

      const transactionIds = new Set<string>();
      for (let i = 0; i < transactions.length; i++) {
        const t = transactions[i];
        const tId = t.id || t.transactionId;
        if (!tId || typeof tId !== 'string') {
          errors.push(`Transaction at index ${i} is missing a valid 'id'`);
        } else if (transactionIds.has(tId)) {
          errors.push(`Duplicate transaction ID detected: '${tId}'`);
        } else {
          transactionIds.add(tId);
        }

        if (t.type && !ValidateAndParseBackupUseCase.VALID_TRANSACTION_TYPES.has(t.type)) {
          errors.push(`Transaction '${tId || i}' has invalid type: '${t.type}'`);
        }
        if (typeof t.amountCents === 'number' && t.amountCents < 0) {
          errors.push(`Transaction '${tId || i}' has negative amount: ${t.amountCents}`);
        }
        if (t.transactionDate && isNaN(Date.parse(t.transactionDate))) {
          errors.push(`Transaction '${tId || i}' has invalid date format: '${t.transactionDate}'`);
        }
        // Relationship check: if assetId is specified, ensure it matches a known holding asset
        if (t.assetId && assetIds.size > 0 && !assetIds.has(t.assetId)) {
          errors.push(`Transaction '${tId || i}' references unknown asset ID: '${t.assetId}'`);
        }
      }

      const liabilityIds = new Set<string>();
      for (let i = 0; i < liabilities.length; i++) {
        const l = liabilities[i];
        const lId = l.id || l.liabilityId;
        if (!lId || typeof lId !== 'string') {
          errors.push(`Liability at index ${i} is missing a valid 'id'`);
        } else if (liabilityIds.has(lId)) {
          errors.push(`Duplicate liability ID detected: '${lId}'`);
        } else {
          liabilityIds.add(lId);
        }

        if (l.originalPrincipalCents !== undefined && Number(l.originalPrincipalCents) <= 0) {
          errors.push(
            `Liability '${lId || i}' has non-positive original principal: ${l.originalPrincipalCents}`
          );
        }
        if (l.currentBalanceCents !== undefined && Number(l.currentBalanceCents) < 0) {
          errors.push(
            `Liability '${lId || i}' has negative current balance: ${l.currentBalanceCents}`
          );
        }
        // Relationship check: if linked to asset, ensure asset exists
        if (l.linkedAssetId && assetIds.size > 0 && !assetIds.has(l.linkedAssetId)) {
          errors.push(`Liability '${lId || i}' links to unknown asset ID: '${l.linkedAssetId}'`);
        }
      }

      const goalIds = new Set<string>();
      for (let i = 0; i < goals.length; i++) {
        const g = goals[i];
        const gId = g.id || g.goalId;
        if (!gId || typeof gId !== 'string') {
          errors.push(`Goal at index ${i} is missing a valid 'id'`);
        } else if (goalIds.has(gId)) {
          errors.push(`Duplicate goal ID detected: '${gId}'`);
        } else {
          goalIds.add(gId);
        }

        if (g.targetAmountCents !== undefined && Number(g.targetAmountCents) <= 0) {
          errors.push(
            `Goal '${gId || i}' has non-positive target amount: ${g.targetAmountCents}`
          );
        }
      }

      const isValid = errors.length === 0;

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
