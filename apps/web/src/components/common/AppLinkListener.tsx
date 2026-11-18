import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp, URLOpenListenerEvent } from '@capacitor/app';

/**
 * Handles incoming native Android App Links & Custom URL schemes.
 * When a user taps an email verification, password reset, or household invite link
 * in their email client, Android routes the intent to WealthNest.
 * This listener catches the URL and seamlessly routes React Router to the target path.
 */
export function AppLinkListener() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const handleAppUrlOpen = (event: URLOpenListenerEvent) => {
      try {
        const url = new URL(event.url);
        // Extracts pathname + search + hash (e.g. /reset-password#access_token=... or /invite?token=...)
        const targetPath = `${url.pathname}${url.search}${url.hash}`;
        if (targetPath && targetPath !== '/') {
          navigate(targetPath, { replace: true });
        }
      } catch (err) {
        console.error('Error handling native App Link URL:', err);
      }
    };

    const listenerPromise = CapApp.addListener('appUrlOpen', handleAppUrlOpen);

    return () => {
      listenerPromise.then((handle) => handle.remove()).catch(() => {});
    };
  }, [navigate]);

  return null;
}
