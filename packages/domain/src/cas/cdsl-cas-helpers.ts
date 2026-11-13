/**
 * Extracts Demat BO ID / Client ID if present on statement
 */
export function extractDematAccountId(fullText: string): string | undefined {
  const match = fullText.match(
    /\b(?:BO\s*ID|BOID|Client\s*ID|Demat\s*Account\s*No)[^\d:]*[:\s]+([0-9]{8,16})\b/i
  );
  return match ? match[1] : undefined;
}

/**
 * Identifies CDSL Table Headers, Page numbering, and statement meta lines
 */
export function isBoilerplateHeader(text: string): boolean {
  const upper = text.toUpperCase();
  return (
    upper.includes('PAGE ') ||
    upper.includes('STATEMENT AS ON') ||
    upper.includes('CONSOLIDATED ACCOUNT STATEMENT') ||
    upper.includes('CENTRAL DEPOSITORY SERVICES') ||
    upper.includes('BO ID') ||
    upper.includes('EQUITY SHARES / LISTED SECURITIES') ||
    upper.includes('MUTUAL FUND UNITS HELD') ||
    upper.includes('CURRENT BALANCE') ||
    upper.includes('MARKET VALUE') ||
    upper.includes('UNREALISED')
  );
}

/**
 * Extracts Demat equity balance line:
 * Pattern: [Quantity] ... [-- -- --] ... [Quantity] [Price] [Market Value]
 * Mathematical invariant: quantity * price ≈ marketValue
 */
export function extractDematNumericRow(text: string): {
  quantity: number;
  price: number;
  marketValue: number;
} | null {
  const clean = text.trim();
  if (!clean) return null;

  const rawTokens = clean.match(/[\d,]+(?:\.\d+)?/g);
  if (!rawTokens || rawTokens.length < 2) return null;

  const numbers = rawTokens
    .map((t) => parseFloat(t.replace(/,/g, '')))
    .filter((n) => !isNaN(n) && n > 0);

  if (numbers.length < 2) return null;

  // In CDSL Demat lines, the last two numbers are Market Price and Market Value:
  // e.g. "17.000 -- -- -- 17.000 7765.4500 1,32,012.65"
  const marketValue = numbers[numbers.length - 1]!;
  const price = numbers[numbers.length - 2]!;

  // Find quantity: either a preceding number matching marketValue / price, or marketValue / price
  const expectedQty = price > 0 ? marketValue / price : 0;
  let quantity = 0;

  for (let k = 0; k < numbers.length - 2; k++) {
    const candQty = numbers[k]!;
    if (Math.abs(candQty - expectedQty) < 0.05 || Math.abs(candQty * price - marketValue) < 2) {
      quantity = candQty;
      break;
    }
  }

  // In Demat statements, if quantity was not among preceding tokens, require depository dashes
  if (quantity === 0 && (clean.includes('--') || clean.includes('- -'))) {
    quantity =
      Math.abs(expectedQty - Math.round(expectedQty)) < 0.01
        ? Math.round(expectedQty)
        : Math.round(expectedQty * 1000) / 1000;
  }

  if (quantity > 0 && marketValue > 0) {
    return { quantity, price, marketValue };
  }

  return null;
}

/**
 * Fallback for standard 3-column / 2-column or keyword rows
 */
export function extractGenericNumericRow(text: string): {
  quantity: number;
  price: number;
  marketValue: number;
  securityName?: string;
} | null {
  const cleanText = text.trim();
  if (!cleanText) return null;

  // Trailing 3 columns: [Security Name, Quantity/Balance, Market Price/NAV, Market Value]
  const threeColMatch = cleanText.match(
    /^(.*?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)$/
  );
  if (threeColMatch && /[a-zA-Z]/.test(threeColMatch[1]!)) {
    return {
      securityName: threeColMatch[1]?.trim(),
      quantity: parseFloat(threeColMatch[2]!.replace(/,/g, '')),
      price: parseFloat(threeColMatch[3]!.replace(/,/g, '')),
      marketValue: parseFloat(threeColMatch[4]!.replace(/,/g, '')),
    };
  }

  // Trailing 2 columns: [Security Name, Quantity/Balance, Market Value]
  const twoColMatch = cleanText.match(/^(.*?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)$/);
  if (twoColMatch && /[a-zA-Z]/.test(twoColMatch[1]!)) {
    const q = parseFloat(twoColMatch[2]!.replace(/,/g, ''));
    const v = parseFloat(twoColMatch[3]!.replace(/,/g, ''));
    return {
      securityName: twoColMatch[1]?.trim(),
      quantity: q,
      price: q > 0 ? v / q : 0,
      marketValue: v,
    };
  }

  return null;
}

export function extractStatementDate(text: string): string {
  const match =
    text.match(
      /(?:Statement\s+as\s+on\s*:?|Statement\s+Date\s*:?|As\s+on\s*:?)\s*(\d{1,2})[-/ ]([A-Za-z]{3}|\d{1,2})[-/ ](\d{4})/i
    ) || text.match(/(\d{1,2})[-/ ]([A-Za-z]{3}|\d{1,2})[-/ ](\d{4})/);

  if (match) {
    const day = match[1]!.padStart(2, '0');
    const monthRaw = match[2]!;
    const year = match[3]!;
    let month = '01';

    if (isNaN(Number(monthRaw))) {
      const monthNames: Record<string, string> = {
        JAN: '01',
        FEB: '02',
        MAR: '03',
        APR: '04',
        MAY: '05',
        JUN: '06',
        JUL: '07',
        AUG: '08',
        SEP: '09',
        OCT: '10',
        NOV: '11',
        DEC: '12',
      };
      month = monthNames[monthRaw.toUpperCase().slice(0, 3)] || '01';
    } else {
      month = monthRaw.padStart(2, '0');
    }

    return `${year}-${month}-${day}`;
  }

  return new Date().toISOString().split('T')[0]!;
}

