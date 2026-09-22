// Wordmark plus "How it works" only — no tagline (cut per ruling, step 7
// revision: the step 8 H1 says the same thing with more room to say it, so
// keeping it here too was just going to read as redundant). An in-page
// anchor, #how-it-works gets its id when step 8 writes the static content
// it points to. No GitHub link yet: a link with nowhere real to go is worse
// than no link, and there's no repo URL to point at until one exists.
//
// max-w-[1240px] + px-4 sm:px-6 here matches App.tsx's <main> exactly, so
// the wordmark and the workspace columns below share one left edge instead
// of the header sitting flush to the viewport while the content indents.
function Header() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <span className="text-h3 font-semibold text-ink">Downsize</span>
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
