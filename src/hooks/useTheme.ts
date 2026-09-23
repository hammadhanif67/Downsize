import { useCallback, useEffect, useState } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';

// Must match the key read by the blocking script in index.html. That
// script cannot import from here — it has to be inline and synchronous to
// beat first paint — so this is the one genuinely duplicated string in the
// app. If it changes, change it in both places or the page flashes.
const STORAGE_KEY = 'downsize-theme';

// Written as a map rather than an array plus modular arithmetic: the
// cycle is three fixed steps, and this way the type checker proves every
// choice has a successor instead of the code asserting an index is in
// range.
const NEXT: Record<ThemeChoice, ThemeChoice> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const PAPER: Record<'light' | 'dark', string> = { light: '#FFFFFF', dark: '#0B0D10' };

function readStored(): ThemeChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // Private mode, or storage blocked. System is the right default.
  }
  return 'system';
}

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// The attribute is the whole mechanism: CSS in index.css reads
// :root[data-theme="..."] and swaps the token values. Removing the
// attribute hands control back to the prefers-color-scheme media query,
// which is what "system" means — no listener needed to restyle, the
// browser re-evaluates the query itself.
function applyChoice(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  applyThemeColor(choice);
}

// index.html carries a static pair of media-scoped theme-color tags, which
// is the correct answer for "system" and the only answer with JS off. An
// explicit choice has to beat both, and the HTML spec takes the FIRST
// matching meta in tree order — so the override is inserted at the very
// top of <head>, and removed again when the choice goes back to system.
function applyThemeColor(choice: ThemeChoice) {
  const existing = document.querySelector<HTMLMetaElement>('meta[data-theme-override]');
  if (choice === 'system') {
    existing?.remove();
    return;
  }
  const meta = existing ?? document.createElement('meta');
  meta.setAttribute('name', 'theme-color');
  meta.setAttribute('data-theme-override', '');
  meta.setAttribute('content', PAPER[choice]);
  if (!existing) document.head.prepend(meta);
}

export function useTheme() {
  // Initialised from storage rather than a constant, so the first render
  // already agrees with what the blocking script put on <html>. Starting
  // at 'system' and correcting in an effect would make the toggle icon
  // flicker to the wrong glyph on load.
  const [choice, setChoice] = useState<ThemeChoice>(readStored);
  const [systemDark, setSystemDark] = useState(prefersDark);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Re-applied when the OS flips too, not just on choice: in system mode
  // the CSS follows on its own but the theme-color meta does not.
  useEffect(() => {
    applyChoice(choice);
  }, [choice, systemDark]);

  const cycle = useCallback(() => {
    setChoice((current) => {
      const next = NEXT[current];
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Nothing to do — the choice still applies for this session.
      }
      return next;
    });
  }, []);

  const resolved: 'light' | 'dark' = choice === 'system' ? (systemDark ? 'dark' : 'light') : choice;

  return { choice, resolved, cycle };
}
