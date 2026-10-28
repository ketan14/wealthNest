import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DesktopTitlebar } from '../components/layout/DesktopTitlebar';

describe('Phase 10: Desktop Titlebar & Window Chrome', () => {
  const originalTauri = (window as unknown as { __TAURI__?: unknown }).__TAURI__;
  const originalUserAgent = navigator.userAgent;

  beforeEach(() => {
    delete (window as unknown as { __TAURI__?: unknown }).__TAURI__;
  });

  afterEach(() => {
    if (originalTauri) {
      (window as unknown as { __TAURI__?: unknown }).__TAURI__ = originalTauri;
    } else {
      delete (window as unknown as { __TAURI__?: unknown }).__TAURI__;
    }

    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
  });

  it('TC-10-04A: renders nothing when running in web browser', () => {
    const { container } = render(<DesktopTitlebar />);
    expect(container.firstChild).toBeNull();
  });

  it('TC-10-04B: renders custom titlebar and controls when running in Tauri Desktop', () => {
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {
      window: {
        getCurrentWindow: () => ({
          minimize: vi.fn(),
          toggleMaximize: vi.fn(),
          close: vi.fn(),
        }),
      },
    };

    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      configurable: true,
    });

    render(<DesktopTitlebar />);

    expect(screen.getByTestId('desktop-titlebar')).toBeInTheDocument();
    expect(screen.getByText('WealthNest')).toBeInTheDocument();
    expect(screen.getByText('Desktop')).toBeInTheDocument();
    expect(screen.getByTestId('titlebar-minimize')).toBeInTheDocument();
    expect(screen.getByTestId('titlebar-maximize')).toBeInTheDocument();
    expect(screen.getByTestId('titlebar-close')).toBeInTheDocument();
  });

  it('TC-10-04C: invokes minimize, maximize, and close window operations on click', async () => {
    const minimizeMock = vi.fn().mockResolvedValue(undefined);
    const toggleMaximizeMock = vi.fn().mockResolvedValue(undefined);
    const closeMock = vi.fn().mockResolvedValue(undefined);

    (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {
      window: {
        getCurrentWindow: () => ({
          minimize: minimizeMock,
          toggleMaximize: toggleMaximizeMock,
          close: closeMock,
        }),
      },
    };

    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      configurable: true,
    });

    render(<DesktopTitlebar />);

    fireEvent.click(screen.getByTestId('titlebar-minimize'));
    expect(minimizeMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('titlebar-maximize'));
    expect(toggleMaximizeMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('titlebar-close'));
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
