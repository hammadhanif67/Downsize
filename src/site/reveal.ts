// Scroll reveals for the static article in index.html.
//
// Not a React component: that markup is outside #root and React never
// touches it (spec §11.1). This is a plain module, imported once from
// main.tsx, that finds the elements and animates them.
//
// The contract, in order of importance:
//
//  1. Every element is already visible. Nothing here sets opacity 0 in a
//     stylesheet. `.reveal-armed` — the class that makes an element
//     hidden-and-animatable — is only ever added by this file, at
//     runtime, and only to elements that are below the fold at that
//     moment. If this module never runs, the page is complete.
//  2. Nothing above the fold is armed, so the H1 and the tool are never
//     animated and the LCP element paints on first frame.
//  3. Reduced motion means this file does nothing at all.
//  4. Each element fires once and is unobserved.

interface Pattern {
  from: string;
  duration: number;
  delay?: number;
}

const HEADING: Pattern = { from: 'translateY(20px)', duration: 400 };
const ROW: Pattern = { from: 'translateY(12px)', duration: 400 };

// Paragraph blocks alternate in document order. ±24px, which is enough to
// read as a direction and small enough that the text is never far from
// where it lands.
const PARA_OFFSET = 24;
const PARA_DURATION = 450;

// Rows stagger 40ms apart, but the stagger stops after this many: a
// twelve-row table would otherwise leave the last row waiting 440ms after
// the first, which reads as a slow load rather than a flourish.
const ROW_STAGGER = 40;
const ROW_STAGGER_CAP = 8;

const THRESHOLD = 0.15;

function arm(el: HTMLElement, pattern: Pattern) {
  el.style.setProperty('--reveal-from', pattern.from);
  el.style.setProperty('--reveal-duration', `${pattern.duration}ms`);
  if (pattern.delay) el.style.setProperty('--reveal-delay', `${pattern.delay}ms`);
  el.classList.add('reveal-armed');
}

export function initReveal() {
  if (typeof window === 'undefined') return;
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const root = document.querySelector<HTMLElement>('.page-content');
  if (!root) return;

  const targets: Array<[HTMLElement, Pattern]> = [];

  for (const el of root.querySelectorAll<HTMLElement>('h2, h3')) {
    targets.push([el, HEADING]);
  }

  // The footer is excluded: it already has its own entrance, and the
  // name inside it animates on a timer rather than on scroll.
  let paraIndex = 0;
  for (const el of root.querySelectorAll<HTMLElement>('p, ol')) {
    if (el.closest('footer')) continue;
    const from = paraIndex % 2 === 0 ? `translateX(-${PARA_OFFSET}px)` : `translateX(${PARA_OFFSET}px)`;
    paraIndex += 1;
    targets.push([el, { from, duration: PARA_DURATION }]);
  }

  // The CELLS are animated, not the <tr>.
  //
  // A table row ignores both opacity and transform — an inline
  // `opacity: 0.25` on a <tr> computes back to 1, and a translateY
  // computes to the identity matrix. Blink does not give table-row boxes
  // their own paint layer, with or without border-collapse. Arming the
  // rows produced twelve elements that were observed, unobserved and
  // animated exactly nothing, and it looks identical to working code in
  // a screenshot.
  //
  // Cells do honour both. Every cell in a row carries that row's delay,
  // so the row still moves as one piece.
  const rows = root.querySelectorAll<HTMLElement>('tbody tr');
  rows.forEach((row, i) => {
    const delay = Math.min(i, ROW_STAGGER_CAP - 1) * ROW_STAGGER;
    for (const cell of row.querySelectorAll<HTMLElement>('td')) {
      targets.push([cell, { ...ROW, delay }]);
    }
  });

  // Elements still waiting. Tracked separately from the observer because
  // some of them have to be resolved without ever having intersected —
  // see the sweep below.
  const pending = new Set<HTMLElement>();

  function settle(el: HTMLElement, animate: boolean) {
    if (animate) {
      el.classList.add('reveal-in');
    } else {
      // Disarm outright rather than animating: the element is off the top
      // of the screen, so there is nothing to watch, and leaving the
      // animation to play means it fires later when the reader scrolls
      // back up to something they have already passed.
      el.classList.remove('reveal-armed');
      el.style.removeProperty('--reveal-from');
      el.style.removeProperty('--reveal-duration');
      el.style.removeProperty('--reveal-delay');
    }
    observer.unobserve(el);
    pending.delete(el);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      // An instant scroll — a nav anchor, a fragment URL, Home/End, a
      // restored scroll position — moves the page between two rendered
      // frames. Everything it skips is never intersecting at any moment
      // the browser samples, so no entry is ever delivered for it, and
      // it sits at opacity 0 above the viewport for good. Measured:
      // jumping to the bottom of the page left 54 elements blank.
      //
      // So each callback first clears out anything that is now fully
      // above the viewport, whether or not it was ever reported. This
      // only reads rects for elements still waiting, and that set only
      // shrinks.
      for (const el of pending) {
        if (el.getBoundingClientRect().bottom < 0) settle(el, false);
      }
      for (const entry of entries) {
        if (entry.isIntersecting) settle(entry.target as HTMLElement, true);
      }
    },
    { threshold: THRESHOLD },
  );

  const fold = window.innerHeight;
  for (const [el, pattern] of targets) {
    // Already on screen: leave it exactly as the browser rendered it.
    // Arming it here is what would cause a visible flash — the element
    // would drop to opacity 0 and fade back in for no reason. This is
    // also what keeps the H1 and the tool, the LCP candidates, off the
    // animation path entirely.
    if (el.getBoundingClientRect().top < fold) continue;
    arm(el, pattern);
    pending.add(el);
    observer.observe(el);
  }
}
