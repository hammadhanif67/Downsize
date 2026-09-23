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

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).classList.add('reveal-in');
        observer.unobserve(entry.target);
      }
    },
    { threshold: THRESHOLD },
  );

  const fold = window.innerHeight;
  const armed: HTMLElement[] = [];
  for (const [el, pattern] of targets) {
    // Already on screen: leave it exactly as the browser rendered it.
    // Arming it here is what would cause a visible flash — the element
    // would drop to opacity 0 and fade back in for no reason.
    if (el.getBoundingClientRect().top < fold) continue;
    arm(el, pattern);
    armed.push(el);
  }

  // Commit opacity: 0 BEFORE the transition exists. Without this the
  // browser sees the new opacity and the new transition in one recalc and
  // animates the element out over 400ms — the reveal would be preceded by
  // a fade to nothing. One forced reflow for the whole page, not one per
  // element.
  void root.offsetHeight;

  for (const el of armed) {
    el.classList.add('reveal-ready');
    observer.observe(el);
  }
}
