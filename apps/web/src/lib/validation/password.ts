/**
 * Shared password policy and CSPRNG password generator for client-side forms.
 * Mirrors the server-side complexity rules enforced in admin-create-user Edge Function
 * and supabase/config.toml.
 */

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_POLICY_HINT = 'Min 12 chars (A-Z, a-z, 0-9, symbol)';

const UPPERCASE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWERCASE_CHARS = 'abcdefghjkmnpqrstuvwxyz';
const NUMERIC_CHARS = '23456789';
const SYMBOL_CHARS = '!@#$%^&*()-_=+';
const ALL_CHARS = UPPERCASE_CHARS + LOWERCASE_CHARS + NUMERIC_CHARS + SYMBOL_CHARS;

export function validatePasswordComplexity(password: string): string | null {
  if (!password) {
    return 'Password is required';
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must not exceed ${PASSWORD_MAX_LENGTH} characters`;
  }
  if (
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    return 'Password must include uppercase, lowercase, a number, and a special character';
  }
  return null;
}

function getSecureRandomInt(maxExclusive: number): number {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.getRandomValues) {
    throw new Error('Cryptographically secure random generator is unavailable');
  }
  const range = 0x100000000;
  const limit = range - (range % maxExclusive);
  const buffer = new Uint32Array(1);
  let value: number;
  do {
    cryptoObj.getRandomValues(buffer);
    value = buffer[0]!;
  } while (value >= limit);
  return value % maxExclusive;
}

function pickRandomChar(alphabet: string): string {
  return alphabet.charAt(getSecureRandomInt(alphabet.length));
}

/**
 * Generates a cryptographically random password containing at least one character
 * from each required character class.
 */
export function generateStrongPassword(length = 16): string {
  const safeLength = Math.max(length, PASSWORD_MIN_LENGTH);
  const chars: string[] = [
    pickRandomChar(UPPERCASE_CHARS),
    pickRandomChar(LOWERCASE_CHARS),
    pickRandomChar(NUMERIC_CHARS),
    pickRandomChar(SYMBOL_CHARS),
  ];

  while (chars.length < safeLength) {
    chars.push(pickRandomChar(ALL_CHARS));
  }

  // Fisher-Yates shuffle with unbiased CSPRNG indices
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = getSecureRandomInt(i + 1);
    const tmp = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = tmp;
  }

  return chars.join('');
}

export interface PasswordChangeErrors {
  password?: string;
  confirmPassword?: string;
}

/**
 * Validates new password complexity and confirmation match for reset/change forms.
 */
export function validatePasswordChange(
  password: string,
  confirmPassword: string
): PasswordChangeErrors {
  const errors: PasswordChangeErrors = {};
  const complexityError = validatePasswordComplexity(password);
  if (complexityError) {
    errors.password = complexityError;
  }
  if (!confirmPassword) {
    errors.confirmPassword = 'Please confirm your new password';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }
  return errors;
}


