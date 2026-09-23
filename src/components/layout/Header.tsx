import Logo from './Logo';

// Logo mark + wordmark, and one anchor to the static content's
// #how-it-works heading. Nothing else lives up here.
//
// max-w-[1240px] + px-4 sm:px-6 matches the tool and the static content
// below it, so the mark, the workspace columns and the article text all
// share one left edge.
//
// items-center on the flex row rather than baseline alignment: the mark's
// SVG box is exactly its visual bounds (see Logo.tsx), so centring it
// against the wordmark's line box lands it on the cap height.
function Header() {
  return (
    <header className="enter border-b border-rule">
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Logo size={22} />
          <span className="text-h3 font-semibold text-ink">Downsize</span>
        </div>
        <nav className="flex items-center gap-6 text-body text-ink">
          <a href="#how-it-works" className="focus-ring">
            How it works
          </a>
        </nav>
      </div>
    </header>
  );
}

export default Header;
