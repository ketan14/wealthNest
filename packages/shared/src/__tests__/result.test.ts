import { describe, it, expect } from 'vitest';
import { ok, err, isOk, isErr } from '../types/result.js';

describe('Result utility', () => {
  it('creates an Ok result', () => {
    const res = ok(42);
    expect(res.success).toBe(true);
    expect(res.value).toBe(42);
    expect(isOk(res)).toBe(true);
    expect(isErr(res)).toBe(false);
  });

  it('creates an Err result', () => {
    const res = err(new Error('Something failed'));
    expect(res.success).toBe(false);
    expect(res.error.message).toBe('Something failed');
    expect(isOk(res)).toBe(false);
    expect(isErr(res)).toBe(true);
  });
});
