import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { isNativeMobileApp } from '@/lib/config/mobile-runtime';
import { handleAndroidBackPress } from '@/lib/navigation/android-back';
import { useToast } from '@/components/ui/Toast';

/**
 * Wires Capacitor's native Android hardware/gesture `backButton` event to:
 * - Close open bottom sheets / dialogs first
 * - Navigate back through React Router history cleanly
 * - Require a double-tap toast confirmation before exiting from `/`
 */
export function AndroidBackHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const lastRootBackMsRef = useRef<number>(0);
  const pathnameRef = useRef<string>(location.pathname);

  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (!isNativeMobileApp()) {
      return;
    }

    const listenerPromise = CapApp.addListener('backButton', ({ canGoBack }) => {
      const historyIdx =
        typeof window !== 'undefined' &&
        typeof window.history.state?.idx === 'number'
          ? window.history.state.idx
          : 0;

      lastRootBackMsRef.current = handleAndroidBackPress({
        pathname: pathnameRef.current,
        historyIdx,
        canGoBack,
        nowMs: Date.now(),
        lastRootBackMs: lastRootBackMsRef.current,
        navigate: (to, opts) => {
          if (typeof to === 'number') {
            navigate(to);
          } else {
            navigate(to, opts);
          }
        },
        showExitHint: (msg) => showToast(msg, 'info', 2000),
        onExit: () => {
          void CapApp.exitApp();
        },
      });
    });

    return () => {
      listenerPromise.then((handle) => handle.remove()).catch(() => {});
    };
  }, [navigate, showToast]);

  return null;
}
