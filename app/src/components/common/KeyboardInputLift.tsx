'use client';

import { useEffect } from 'react';

const TEXT_INPUT_TYPES = new Set([
  'text', 'email', 'tel', 'number', 'password', 'search', 'url', 'date', 'time', 'datetime-local', '',
]);

function isTypingField(el: Element | null): el is HTMLElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has((el.type || '').toLowerCase());
  return el instanceof HTMLElement && el.isContentEditable;
}

/**
 * Mobile web: when a field (name, email, OTP, phone, address…) is focused and the on-screen keyboard
 * opens, scroll that field into the middle of the visible area so it sits above the keyboard.
 * Works for page content and for fields inside fixed pop-ups (scrollIntoView scrolls every scrollable
 * ancestor). Touch devices only; desktop is untouched.
 */
export function KeyboardInputLift() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia || !window.matchMedia('(pointer: coarse)').matches) return;

    const vv = window.visualViewport;
    let timers: number[] = [];

    const liftIfHidden = () => {
      const el = document.activeElement;
      if (!isTypingField(el)) return;
      const rect = el.getBoundingClientRect();
      const visibleTop = vv ? vv.offsetTop : 0;
      const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const margin = 16;
      if (rect.bottom > visibleBottom - margin || rect.top < visibleTop + margin) {
        el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      }
    };

    const schedule = () => {
      timers.forEach((t) => window.clearTimeout(t));
      // The keyboard animates in over ~250–400ms; check again once it has settled.
      timers = [80, 320, 650].map((ms) => window.setTimeout(liftIfHidden, ms));
    };

    const onFocusIn = (e: FocusEvent) => {
      if (isTypingField(e.target as Element)) schedule();
    };

    document.addEventListener('focusin', onFocusIn);
    vv?.addEventListener('resize', schedule);
    window.addEventListener('resize', schedule);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      document.removeEventListener('focusin', onFocusIn);
      vv?.removeEventListener('resize', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return null;
}
