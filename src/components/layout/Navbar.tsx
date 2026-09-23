import { Menu, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';

interface NavLink {
  id: string;
  label: string;
}

// Anchors into the static article in index.html. React does not own that
// markup, so these ids are a contract with the HTML — see §14.
const LINKS: NavLink[] = [
  { id: 'how-it-works', label: 'How it works' },
  { id: 'formats', label: 'Formats' },
  { id: 'sizes', label: 'Sizes' },
  { id: 'faq', label: 'FAQ' },
];

// The band a heading has to be in to count as the current section: from
// just under the navbar down to 40% of the viewport. A heading above the
// band has been passed; one below it has not been reached.
const SPY_TOP = 100;

// Module-level so the identity is stable: it is a useEffect dependency,
// and `LINKS.map(...)` inline would build a new array every render and
// re-run the observer setup on each one.
const LINK_IDS = LINKS.map((link) => link.id);

// Which section heading is currently at the top of the page.
//
// IntersectionObserver, not a scroll handler, but not one-entry-at-a-time
// either: the callback re-reads all four headings and picks the last one
// that has passed the band. Reacting to individual entries gets the
// in-between states wrong — scroll fast enough and two headings cross the
// band inside one frame, and whichever entry the browser reports second
// wins regardless of which is actually on screen. Reading positions when
// something changes costs one layout on an event that fires a handful of
// times per page, not per frame.
function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const nodes = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (nodes.length === 0) return;

    const recompute = () => {
      let current: string | null = null;
      for (const node of nodes) {
        if (node.getBoundingClientRect().top <= SPY_TOP) current = node.id;
      }
      setActive(current);
    };

    // Plain viewport bounds, no rootMargin band.
    //
    // The observer here is only a "something moved" trigger — recompute
    // reads the real positions itself — so the useful question is how
    // reliably it fires, and a narrow band answers that badly. With a
    // band of, say, 100px to 40% of the viewport, clicking a nav link
    // jumps the target heading straight past it: the heading is outside
    // the band before the jump and outside it after, nothing changes
    // state, no callback is delivered, and the active link never moves.
    // Tested: jumping from Sizes to FAQ left Sizes highlighted.
    //
    // Against the whole viewport that cannot happen, because an anchor
    // jump necessarily brings its target heading into view.
    const observer = new IntersectionObserver(recompute, { threshold: 0 });
    for (const node of nodes) observer.observe(node);
    recompute();

    return () => observer.disconnect();
  }, [ids]);

  return active;
}

const FOCUSABLE = 'a[href], button:not([disabled])';

function Navbar() {
  const { choice, resolved, cycle } = useTheme();
  const active = useActiveSection(LINK_IDS);
  const [open, setOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const [scrolled, setScrolled] = useState(false);

  // A 40px marker pinned to the top of the document. While it is on
  // screen the page is at the top and the navbar shows no bottom border;
  // once it leaves, the border fades in. Two-state question, so an
  // observer rather than a scroll listener recomputing every frame.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) setScrolled(!entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    hamburgerRef.current?.focus();
  }, []);

  // Scroll lock while the panel covers the page.
  useEffect(() => {
    if (!open) return;
    document.body.classList.add('nav-open');
    return () => document.body.classList.remove('nav-open');
  }, [open]);

  // Move focus into the panel when it opens. Without this, focus stays on
  // the hamburger behind a full-screen overlay and the first Tab goes to
  // whatever follows it in the DOM.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [open]);

  // Crossing into desktop width with the panel open would leave a
  // full-screen overlay with no visible way out — the close button is in
  // the panel, but the panel itself is only meant to exist below lg.
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [open]);

  function onPanelKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    // Wrap manually rather than trusting inert/aria-modal: the panel is a
    // sibling of the page content, not a dialog the browser knows about.
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      {/* Not `sticky top-0` on a plain header: the sentinel has to sit at
          document top and stay there while the header travels, so the
          header needs a static parent to be positioned against. */}
      <div ref={sentinelRef} aria-hidden="true" className="absolute top-0 h-10 w-px" />

      <header
        className={`sticky top-0 z-40 bg-paper transition-[border-color] duration-150 ${
          scrolled ? 'border-b border-rule' : 'border-b border-transparent'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 px-4 sm:px-6 lg:grid lg:grid-cols-[1fr_auto_1fr]">
          {/* "#top" with no matching element is defined by the HTML spec
              as the top of the document, so this needs no anchor target.
              h-11 for the same 44px tap target as everything else in the
              bar — it is a link in a phone header, not decoration. */}
          <a href="#top" className="focus-ring flex h-11 items-center gap-2.5 justify-self-start">
            <Logo size={22} />
            <span className="text-h3 font-semibold text-ink">Downsize</span>
          </a>

          <nav aria-label="Sections" className="hidden lg:flex lg:items-center lg:gap-1">
            {LINKS.map((link) => {
              const isActive = active === link.id;
              return (
                <a
                  key={link.id}
                  href={`#${link.id}`}
                  // "location", not "page": these are sections of the
                  // page you are already on, not one page out of a set.
                  aria-current={isActive ? 'location' : undefined}
                  className={`focus-ring flex h-11 items-center border-b-2 px-3 text-body transition-colors duration-[120ms] ${
                    isActive
                      ? 'border-accent text-ink'
                      : 'border-transparent text-ink-muted hover:text-ink'
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>

          <div className="flex items-center justify-self-end">
            <ThemeToggle choice={choice} resolved={resolved} onCycle={cycle} />
            <button
              ref={hamburgerRef}
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-label="Open menu"
              className="focus-ring flex h-11 w-11 items-center justify-center text-ink-muted transition-colors duration-[120ms] hover:text-ink lg:hidden"
            >
              <Menu size={20} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          onKeyDown={onPanelKeyDown}
          className="fixed inset-0 z-50 flex flex-col bg-paper lg:hidden"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            <span className="text-h3 font-semibold text-ink">Downsize</span>
            <button
              type="button"
              onClick={close}
              aria-label="Close menu"
              className="focus-ring flex h-11 w-11 items-center justify-center text-ink-muted transition-colors duration-[120ms] hover:text-ink"
            >
              <X size={20} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          <nav aria-label="Sections" className="flex flex-col px-4 pt-6 sm:px-6">
            {LINKS.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={close}
                className="focus-ring flex min-h-[3.5rem] items-center border-b border-rule text-[20px] text-ink"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}

export default Navbar;
