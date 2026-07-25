"use client";

import { useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY } from '@/lib/theme';

// The `dark` class on <html> is the source of truth — it is set by the inline
// script in the document head before first paint. Subscribing to it (rather than
// mirroring it into state) keeps the button correct even if the class is changed
// from elsewhere, and avoids a cascading render on mount.
const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
};

const getSnapshot = () => document.documentElement.classList.contains('dark');

// No DOM on the server; the real value resolves immediately after hydration.
const getServerSnapshot = () => false;

export default function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = () => {
    const next = isDark ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', next === 'dark');
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private browsing can refuse storage; the toggle still works for this session.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex items-center gap-2 bg-surface-sunken hover:bg-surface border border-edge text-ink rounded-lg px-3 py-2 transition-colors shrink-0"
    >
      {/* Decorative: the accessible name lives on the button itself. */}
      <span aria-hidden="true" className="text-sm leading-none">{isDark ? '☀' : '☾'}</span>
      <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">
        {isDark ? 'Light' : 'Dark'}
      </span>
    </button>
  );
}
