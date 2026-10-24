import { ParsedBrokerCsvResult } from './broker-csv-types.js';
import { isZerodhaCsv, parseZerodhaCsv } from './zerodha-csv-parser.js';
import { isGrowwCsv, parseGrowwCsv } from './groww-csv-parser.js';

/**
 * Automatically sniffs CSV structure and dispatches to the correct broker parser.
 */
export function detectAndParseBrokerCsv(
  csvContent: string,
  preferredBroker?: 'ZERODHA' | 'GROWW'
): ParsedBrokerCsvResult {
  if (!csvContent || typeof csvContent !== 'string') {
    return {
      provider: 'GENERIC_CSV',
      csvType: 'HOLDINGS',
      holdings: [],
      trades: [],
      totalRecords: 0,
      warnings: ['Empty CSV content received'],
    };
  }

  if (preferredBroker === 'ZERODHA') {
    return parseZerodhaCsv(csvContent);
  }

  if (preferredBroker === 'GROWW') {
    return parseGrowwCsv(csvContent);
  }

  // Auto-detection based on header contents
  if (isZerodhaCsv(csvContent)) {
    return parseZerodhaCsv(csvContent);
  }

  if (isGrowwCsv(csvContent)) {
    return parseGrowwCsv(csvContent);
  }

  // Fallback: try Zerodha parser first, then Groww parser
  const zerodhaResult = parseZerodhaCsv(csvContent);
  if (zerodhaResult.totalRecords > 0) {
    return zerodhaResult;
  }

  return parseGrowwCsv(csvContent);
}
