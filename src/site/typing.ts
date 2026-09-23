// The typing line under the H1. One line on the whole site; nothing else
// types, and nothing else should.
//
// The markup in index.html carries the finished sentence twice, on
// purpose:
//
//   <span class="visually-hidden">Resize for Instagram, YouTube,
//     LinkedIn, a blog or email.</span>
//   <span aria-hidden="true">Resize for <span id="type-word">Instagram</span>…
//
// The first is what a screen reader and a crawler get — a whole sentence,
// not a word being assembled a character at a time, which is what an
// aria-live typing effect sounds like. The second is decorative, and is
// seeded with the first word so that with JS off the visible line still
// reads "Resize for Instagram" rather than "Resize for ".

// Typed as a non-empty tuple so WORDS[0] is a string rather than
// string | undefined — the fallback below then costs nothing and the
// module needs no index assertions.
const WORDS: [string, ...string[]] = ['Instagram', 'YouTube', 'LinkedIn', 'a blog', 'email'];

const TYPE_MS = 55;
const DELETE_MS = 35;
const HOLD_MS = 1500;
const BETWEEN_MS = 250;

export function initTyping() {
  if (typeof window === 'undefined') return;

  const word: HTMLElement | null = document.getElementById('type-word');
  if (word === null) return;
  const target: HTMLElement = word;

  // Reduced motion parks on the first word — which is already the one in
  // the HTML, so there is nothing to do but leave it alone.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let wordIndex = 0;
  let charCount = WORDS[0].length;
  let deleting = false;
  let timer: number | undefined;

  function step() {
    const current = WORDS[wordIndex] ?? WORDS[0];

    if (!deleting && charCount === current.length) {
      deleting = true;
      schedule(HOLD_MS);
      return;
    }

    if (deleting && charCount === 0) {
      deleting = false;
      wordIndex = (wordIndex + 1) % WORDS.length;
      schedule(BETWEEN_MS);
      return;
    }

    charCount += deleting ? -1 : 1;
    // textContent, never innerHTML: the words are a fixed list here, but
    // this is the one place on the site where JS writes text into the
    // page and it should not be the place that learns to parse markup.
    target.textContent = current.slice(0, charCount);
    schedule(deleting ? DELETE_MS : TYPE_MS);
  }

  function schedule(ms: number) {
    // A background tab still runs timers, just throttled — so without
    // this the line would burn through several words while nobody is
    // looking and resume mid-word. Nothing is scheduled while hidden;
    // visibilitychange picks it back up.
    if (document.hidden) return;
    timer = window.setTimeout(step, ms);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      window.clearTimeout(timer);
      return;
    }
    schedule(BETWEEN_MS);
  });

  schedule(HOLD_MS);
}
