/**
 * AMFI (Association of Mutual Funds in India) Daily NAV Feed Parser
 * Parses official daily NAV records (semicolon-delimited format)
 */

export interface AmfiNavRecord {
  readonly schemeCode: string;
  readonly isinGrowth?: string;
  readonly isinReinvestment?: string;
  readonly schemeName: string;
  readonly nav: number;
  readonly navPaise: bigint;
  readonly date: string; // DD-Mon-YYYY
}

/**
 * Parses the official AMFI text feed (e.g. from NAVAll.txt).
 * Returns a lookup map indexing each record by both Scheme Code and ISIN.
 */
export function parseAmfiNavFeed(feedContent: string): Map<string, AmfiNavRecord> {
  const map = new Map<string, AmfiNavRecord>();
  if (!feedContent || typeof feedContent !== 'string') return map;

  const lines = feedContent.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('Scheme Code') || trimmed.startsWith('Open Ended') || trimmed.startsWith('Close Ended')) {
      continue;
    }

    const parts = trimmed.split(';');
    if (parts.length >= 6) {
      const schemeCode = parts[0]?.trim();
      const isinGrowth = parts[1]?.trim() || undefined;
      const isinReinvestment = parts[2]?.trim() || undefined;
      const schemeName = parts[3]?.trim();
      const navStr = parts[4]?.trim() ?? '';
      const date = parts[5]?.trim() ?? '';

      const nav = parseFloat(navStr);
      if (!isNaN(nav) && schemeCode && schemeName && date) {
        const navPaise = BigInt(Math.round(nav * 100));
        const record: AmfiNavRecord = {
          schemeCode,
          isinGrowth,
          isinReinvestment,
          schemeName,
          nav,
          navPaise,
          date,
        };

        map.set(schemeCode, record);
        if (isinGrowth && isinGrowth !== '-') {
          map.set(isinGrowth, record);
        }
        if (isinReinvestment && isinReinvestment !== '-') {
          map.set(isinReinvestment, record);
        }
      }
    }
  }

  return map;
}

/**
 * High-performance lookup helper matching by ISIN first, then Scheme Code, then normalized Scheme Name.
 */
export function matchHoldingToAmfiNav(
  lookupMap: Map<string, AmfiNavRecord>,
  identifier: { isin?: string; schemeCode?: string; name?: string }
): AmfiNavRecord | null {
  if (identifier.isin && lookupMap.has(identifier.isin)) {
    return lookupMap.get(identifier.isin)!;
  }
  if (identifier.schemeCode && lookupMap.has(identifier.schemeCode)) {
    return lookupMap.get(identifier.schemeCode)!;
  }
  return null;
}
