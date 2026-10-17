import { CurrencyCode, CURRENCIES } from './currency.js';

/**
 * Immutable Money Value Object
 * Stored internally as integer in the smallest currency unit (e.g., cents)
 * to avoid floating-point rounding errors in financial computations.
 */
export class Money {
  readonly cents: bigint;
  readonly currency: CurrencyCode;

  private constructor(cents: bigint, currency: CurrencyCode) {
    this.cents = cents;
    this.currency = currency;
  }

  static fromCents(cents: number | bigint, currency: CurrencyCode = 'USD'): Money {
    return new Money(BigInt(cents), currency);
  }

  static fromDecimal(amount: number, currency: CurrencyCode = 'USD'): Money {
    const meta = CURRENCIES[currency];
    const factor = Math.pow(10, meta.decimalPlaces);
    const cents = BigInt(Math.round(amount * factor));
    return new Money(cents, currency);
  }

  static zero(currency: CurrencyCode = 'USD'): Money {
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

  equals(other: Money): boolean {
    return this.currency === other.currency && this.cents === other.cents;
  }

  isPositive(): boolean {
    return this.cents > 0n;
  }

  isZero(): boolean {
    return this.cents === 0n;
  }

  format(locale: string = 'en-US'): string {
    const meta = CURRENCIES[this.currency];
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency,
      minimumFractionDigits: meta.decimalPlaces,
      maximumFractionDigits: meta.decimalPlaces,
    }).format(this.toDecimal());
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(
        `Currency mismatch: cannot perform operation between ${this.currency} and ${other.currency}`
      );
    }
  }
}
