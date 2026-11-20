import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomNavigationBar } from '../components/layout/BottomNavigationBar';
import { AdminProvider } from '../lib/admin/admin-context';
import { isTextEditableElement } from '../lib/mobile/use-virtual-keyboard';

describe('Priority 2: Virtual Keyboard & Bottom Bar Ergonomics', () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 390,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    });
  });

  it('correctly distinguishes text-editable inputs from range/checkbox/button controls', () => {
    const textInput = document.createElement('input');
    textInput.type = 'text';
    const numberInput = document.createElement('input');
    numberInput.type = 'number';
    const rangeInput = document.createElement('input');
    rangeInput.type = 'range';
    const checkboxInput = document.createElement('input');
    checkboxInput.type = 'checkbox';
    const readonlyInput = document.createElement('input');
    readonlyInput.type = 'text';
    readonlyInput.readOnly = true;
    const textarea = document.createElement('textarea');

    expect(isTextEditableElement(textInput)).toBe(true);
    expect(isTextEditableElement(numberInput)).toBe(true);
    expect(isTextEditableElement(textarea)).toBe(true);
    expect(isTextEditableElement(rangeInput)).toBe(false);
    expect(isTextEditableElement(checkboxInput)).toBe(false);
    expect(isTextEditableElement(readonlyInput)).toBe(false);
  });

  it('hides BottomNavigationBar on mobile while a text input is focused and restores it on blur', () => {
    render(
      <MemoryRouter initialEntries={['/goals']}>
        <AdminProvider>
          <BottomNavigationBar />
          <input aria-label="Goal Name" type="text" />
        </AdminProvider>
      </MemoryRouter>
    );

    const nav = screen.getByTestId('bottom-nav-bar');
    const input = screen.getByLabelText('Goal Name');
    input.scrollIntoView = vi.fn();

    expect(nav.getAttribute('data-keyboard-open')).toBe('false');
    expect(nav.className).not.toContain('translate-y-full');

    // Focus text input -> bottom bar hides & scrolls focused input into view
    act(() => {
      input.focus();
      fireEvent.focusIn(input);
      vi.advanceTimersByTime(200);
    });

    expect(nav.getAttribute('data-keyboard-open')).toBe('true');
    expect(nav.className).toContain('translate-y-full');
    expect(input.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });

    // Blur text input -> bottom bar restores cleanly
    act(() => {
      input.blur();
      fireEvent.focusOut(input);
      vi.advanceTimersByTime(100);
    });

    expect(nav.getAttribute('data-keyboard-open')).toBe('false');
    expect(nav.className).not.toContain('translate-y-full');
  });

  it('keeps BottomNavigationBar visible when interacting with a slider (range input)', () => {
    render(
      <MemoryRouter initialEntries={['/goals']}>
        <AdminProvider>
          <BottomNavigationBar />
          <input aria-label="Monthly Burn" type="range" />
        </AdminProvider>
      </MemoryRouter>
    );

    const nav = screen.getByTestId('bottom-nav-bar');
    const slider = screen.getByLabelText('Monthly Burn');

    act(() => {
      slider.focus();
      fireEvent.focusIn(slider);
      vi.advanceTimersByTime(200);
    });

    expect(nav.getAttribute('data-keyboard-open')).toBe('false');
  });
});
