import { useEffect, useRef, useState } from 'react';

const NON_KEYBOARD_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

/**
 * Returns true if the focused DOM element summons an on-screen soft keyboard on mobile.
 */
export function isTextEditableElement(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  if (tag === 'textarea') {
    return !target.hasAttribute('readonly') && !target.hasAttribute('disabled');
  }
  if (target.isContentEditable) {
    return true;
  }
  if (tag === 'input') {
    const input = target as HTMLInputElement;
    if (input.readOnly || input.disabled) return false;
    const inputType = (input.type || 'text').toLowerCase();
    return !NON_KEYBOARD_INPUT_TYPES.has(inputType);
  }
  return false;
}

/**
 * Detects soft/virtual keyboard visibility on mobile viewports (< 768px) using both:
 * 1) `focusin`/`focusout` on text-editable fields (reliable under Android `adjustResize`)
 * 2) `visualViewport` shrink > 120px vs baseline viewport height (reliable on Chrome/iOS overlays)
 *
 * Also gently scrolls newly focused inputs into view above the keyboard after resize settles.
 */
export function useVirtualKeyboard(): boolean {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const baselineHeightRef = useRef<number>(
    typeof window !== 'undefined' ? window.innerHeight : 0
  );
  const inputFocusedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const isMobileViewport = () => window.innerWidth < 768;

    const recomputeState = () => {
      if (!isMobileViewport()) {
        setIsKeyboardOpen(false);
        return;
      }

      const currentHeight = window.visualViewport?.height ?? window.innerHeight;
      if (!inputFocusedRef.current && currentHeight > baselineHeightRef.current) {
        baselineHeightRef.current = currentHeight;
      }

      const shrunkByViewport = baselineHeightRef.current - currentHeight > 120;
      const shrunkByOverlay = window.visualViewport
        ? window.innerHeight - window.visualViewport.height > 120
        : false;

      setIsKeyboardOpen(inputFocusedRef.current || shrunkByViewport || shrunkByOverlay);
    };

    let scrollTimer: number | undefined;

    const handleFocusIn = (e: FocusEvent) => {
      if (!isMobileViewport()) return;
      if (!isTextEditableElement(e.target)) return;

      inputFocusedRef.current = true;
      recomputeState();

      const targetEl = e.target;
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        if (typeof targetEl.scrollIntoView === 'function') {
          targetEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }, 150);
    };

    const handleFocusOut = () => {
      if (!isMobileViewport()) return;
      // Delay slightly so moving focus between two inputs doesn't flash the bottom bar
      window.setTimeout(() => {
        inputFocusedRef.current = isTextEditableElement(document.activeElement);
        recomputeState();
      }, 60);
    };

    const handleViewportResize = () => {
      if (!isMobileViewport()) {
        setIsKeyboardOpen(false);
        return;
      }
      if (!inputFocusedRef.current) {
        baselineHeightRef.current = Math.max(
          baselineHeightRef.current,
          window.visualViewport?.height ?? window.innerHeight
        );
      }
      recomputeState();
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    window.addEventListener('resize', handleViewportResize);
    window.visualViewport?.addEventListener('resize', handleViewportResize);

    return () => {
      window.clearTimeout(scrollTimer);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      window.removeEventListener('resize', handleViewportResize);
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, []);

  return isKeyboardOpen;
}
