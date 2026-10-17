import { describe, it, expect } from 'vitest';
import { GetSystemStatusUseCase } from '../use-cases/get-system-status.js';

describe('GetSystemStatusUseCase', () => {
  it('returns clean architecture system status', () => {
    const useCase = new GetSystemStatusUseCase();
    const result = useCase.execute();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.appName).toBe('WealthNest');
      expect(result.value.layers).toHaveLength(4);
      expect(result.value.layers.every((l) => l.status === 'initialized')).toBe(true);
    }
  });
});
