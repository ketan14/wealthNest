import { useState, useEffect } from 'react';

/**
 * Responsive breakpoint hook detecting mobile viewports (< breakpoint px).
 * Defaults to false in SSR / JSDOM environments for server and desktop test parity.
 */
export function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);

    if (mql.addEventListener) {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    } else {
      // Legacy fallback
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }
  }, [breakpoint]);

  return isMobile;
}
