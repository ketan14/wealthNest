import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../components/ui/Button';

describe('Phase 9.2: Touch Target Ergonomics Invariant (>= 44x44px)', () => {
  it('TC-9.2-03A: default Button size enforces min-h-[44px]', () => {
    render(<Button>Default Action</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/min-h-\[44px\]/);
  });

  it('TC-9.2-03B: sm Button size provides touch-target hit expansion', () => {
    render(<Button size="sm">Compact Action</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/before:-inset-1\.5/);
  });

  it('TC-9.2-03C: icon Button enforces min-h-[44px] and min-w-[44px]', () => {
    render(
      <Button size="icon" aria-label="Icon Action">
        <span>+</span>
      </Button>
    );
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/min-h-\[44px\]/);
    expect(btn.className).toMatch(/min-w-\[44px\]/);
  });

  it('TC-9.2-03D: lg Button enforces min-h-[48px]', () => {
    render(<Button size="lg">Large Action</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/min-h-\[48px\]/);
  });
});
