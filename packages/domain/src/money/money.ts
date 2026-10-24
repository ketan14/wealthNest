import { CurrencyCode, CURRENCIES, BASE_FX_RATES_TO_INR } from './currency.js';

/**
 * Immutable Money Value Object
 * Stored internally as integer in the smallest currency unit (e.g., paise / cents)
 * to avoid floating-point rounding errors in financial computations.
 * Default currency is set to Indian Rupee (INR) with en-IN formatting.
 */
export class Money {
  readonly cents: bigint;
  readonly currency: CurrencyCode;

  private constructor(cents: bigint, currency: CurrencyCode) {
    this.cents = cents;
    this.currency = currency;
  }

  static fromCents(cents: number | bigint, currency: CurrencyCode = 'INR'): Money {
    return new Money(BigInt(cents), currency);
  }

  static fromDecimal(amount: number, currency: CurrencyCode = 'INR'): Money {
    const meta = CURRENCIES[currency];
    const factor = Math.pow(10, meta.decimalPlaces);
    const cents = BigInt(Math.round(amount * factor));
    return new Money(cents, currency);
  }

  static zero(currency: CurrencyCode = 'INR'): Money {
    return new Money(0n, currency);
  }

  toDecimal(): number {
    const meta = CURRENCIES[this.currency];
    const factor = Math.pow(10, meta.decimalPlaces);
    return Number(this.cents) / factor;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.cents + other.cents, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.cents - other.cents, this.currency);
  }

  multiply(factor: number): Money {
    const newCents = BigInt(Math.round(Number(this.cents) * factor));
    return new Money(newCents, this.currency);
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.cents === other.cents;
  }

  isPositive(): boolean {
    return this.cents > 0n;
  }

  isZero(): boolean {
    return this.cents === 0n;
  }

  /**
   * Converts money into another currency using baseline or provided exchange rate.
   */
  convertTo(targetCurrency: CurrencyCode, customRate?: number): Money {
    if (this.currency === targetCurrency) return this;

    const rateFrom = BASE_FX_RATES_TO_INR[this.currency] ?? 1;
    const rateTo = BASE_FX_RATES_TO_INR[targetCurrency] ?? 1;
    const effectiveRate = customRate ?? rateFrom / rateTo;

    const fromDecimal = this.toDecimal();
    const convertedDecimal = fromDecimal * effectiveRate;
    return Money.fromDecimal(convertedDecimal, targetCurrency);
  }

  format(locale?: string): string {
    const effectiveLocale = locale ?? (this.currency === 'INR' ? 'en-IN' : 'en-US');
    const meta = CURRENCIES[this.currency];
    return new Intl.NumberFormat(effectiveLocale, {
      style: 'currency',
      currency: this.currency,
      minimumFractionDigits: meta.decimalPlaces,
      maximumFractionDigits: meta.decimalPlaces,
    }).format(this.toDecimal());
  }

  /**
   * Formats Indian Rupee amounts using standard Lakh (L) and Crore (Cr) denominations.
   * e.g., ₹1,50,00,000 -> "₹1.50 Cr", ₹15,00,000 -> "₹15.00 L", ₹45,000 -> "₹45.00 K"
   */
  formatIndianCompact(): string {
    if (this.currency !== 'INR') {
      return this.format();
    }

    const isNegative = this.cents < 0n;
    const absCents = isNegative ? -this.cents : this.cents;
    const prefix = isNegative ? '-₹' : '₹';

    // 1 Crore = 1,00,00,000 Rupees = 1,000,000,000 paise
    if (absCents >= 1_000_000_000n) {
      const crVal = Number(absCents) / 1_000_000_000;
      return `${prefix}${crVal.toFixed(2)} Cr`;
    }

    // 1 Lakh = 1,00,000 Rupees = 10,000,000 paise
    if (absCents >= 10_000_000n) {
      const lVal = Number(absCents) / 10_000_000;
      return `${prefix}${lVal.toFixed(2)} L`;
    }

    // 1 Thousand = 1,000 Rupees = 100,000 paise
    if (absCents >= 100_000n) {
      const kVal = Number(absCents) / 100_000;
      return `${prefix}${kVal.toFixed(2)} K`;
    }

    return this.format('en-IN');
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(
        `Currency mismatch: cannot perform operation between ${this.currency} and ${other.currency}`
      );
    }
  }
}
