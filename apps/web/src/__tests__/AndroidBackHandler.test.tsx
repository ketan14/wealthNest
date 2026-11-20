import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  dismissTopOpenOverlay,
  handleAndroidBackPress,
  registerBackDismissHandler,
} from '../lib/navigation/android-back';
import { ResponsiveModalShell } from '../components/ui/ResponsiveModalShell';
import { AndroidBackHandler } from '../components/common/AndroidBackHandler';

const addListenerMock = vi.fn().mockResolvedValue({ remove: vi.fn() });
const exitAppMock = vi.fn();
const isNativePlatformMock = vi.fn(() => false);

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (...args: unknown[]) => addListenerMock(...args),
    exitApp: () => exitAppMock(),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatformMock(),
  },
}));

describe('Android Hardware/Gesture Back Handling (Priority 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isNativePlatformMock.mockReturnValue(false);
  });

  it('closes top-most registered modal overlay in LIFO order before navigating', () => {
    const firstClose = vi.fn();
    const secondClose = vi.fn();
    const unregisterFirst = registerBackDismissHandler(firstClose);
    const unregisterSecond = registerBackDismissHandler(secondClose);

    const navigate = vi.fn();
    const showExitHint = vi.fn();
    const onExit = vi.fn();

    handleAndroidBackPress({
      pathname: '/goals',
      historyIdx: 2,
      canGoBack: true,
      nowMs: 1000,
      lastRootBackMs: 0,
      navigate,
      showExitHint,
      onExit,
    });

    expect(secondClose).toHaveBeenCalledTimes(1);
    expect(firstClose).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();

    unregisterSecond();
    unregisterFirst();
  });

  it('falls back to clicking close button inside ResponsiveModalShell dialog when no backdrop callback is provided', () => {
    const onClose = vi.fn();
    render(
      <ResponsiveModalShell
        role="dialog"
        ariaLabel="Test Modal"
        header={
          <button type="button" onClick={onClose} aria-label="Close modal">
            Close
          </button>
        }
      >
        <div>Body</div>
      </ResponsiveModalShell>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(dismissTopOpenOverlay()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('navigates back in router history on sub-routes, or redirects to "/" when no history exists', () => {
    const navigate = vi.fn();
    const showExitHint = vi.fn();
    const onExit = vi.fn();

    // Has prior history -> navigate(-1)
    handleAndroidBackPress({
      pathname: '/portfolio',
      historyIdx: 1,
      canGoBack: true,
      nowMs: 1000,
      lastRootBackMs: 0,
      navigate,
      showExitHint,
      onExit,
    });
    expect(navigate).toHaveBeenCalledWith(-1);

    navigate.mockClear();

    // Deep-linked sub-route with no history -> navigate('/', { replace: true })
    handleAndroidBackPress({
      pathname: '/goals',
      historyIdx: 0,
      canGoBack: false,
      nowMs: 2000,
      lastRootBackMs: 0,
      navigate,
      showExitHint,
      onExit,
    });
    expect(navigate).toHaveBeenCalledWith('/', { replace: true });
    expect(onExit).not.toHaveBeenCalled();
  });

  it('requires double-back within 2000ms to exit from root "/"', () => {
    const navigate = vi.fn();
    const showExitHint = vi.fn();
    const onExit = vi.fn();

    // First back press on "/" shows toast hint
    const firstTapTs = handleAndroidBackPress({
      pathname: '/',
      historyIdx: 0,
      canGoBack: false,
      nowMs: 1000,
      lastRootBackMs: 0,
      navigate,
      showExitHint,
      onExit,
    });
    expect(firstTapTs).toBe(1000);
    expect(showExitHint).toHaveBeenCalledWith('Press back again to exit WealthNest');
    expect(onExit).not.toHaveBeenCalled();

    // Expired > 2000ms -> resets hint instead of exiting
    const secondSlowTapTs = handleAndroidBackPress({
      pathname: '/',
      historyIdx: 0,
      canGoBack: false,
      nowMs: 3500,
      lastRootBackMs: firstTapTs,
      navigate,
      showExitHint,
      onExit,
    });
    expect(secondSlowTapTs).toBe(3500);
    expect(onExit).not.toHaveBeenCalled();

    // Fast second press <= 2000ms -> exits app
    handleAndroidBackPress({
      pathname: '/',
      historyIdx: 0,
      canGoBack: false,
      nowMs: 4500,
      lastRootBackMs: secondSlowTapTs,
      navigate,
      showExitHint,
      onExit,
    });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('subscribes to Capacitor backButton listener only on native platforms', () => {
    // Non-native web browser: no Capacitor listener attached
    render(
      <MemoryRouter>
        <AndroidBackHandler />
      </MemoryRouter>
    );
    expect(addListenerMock).not.toHaveBeenCalled();

    // Native Android platform: listener attached
    isNativePlatformMock.mockReturnValue(true);
    render(
      <MemoryRouter>
        <AndroidBackHandler />
      </MemoryRouter>
    );
    expect(addListenerMock).toHaveBeenCalledWith('backButton', expect.any(Function));
  });
});
