import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// robots.txt and sitemap.xml can't live in public/ any more: Vite copies
// that directory verbatim, so a hardcoded domain in either file would
// survive into the build and contradict the canonical. They're generated
// here instead, from the same VITE_SITE_URL the HTML uses, and served in
// dev by the same plugin so the two environments can't drift.
// Deliberately not the %VITE_NAME% form. Vite's core HTML env replacement
// claims that syntax, so it tried to resolve this marker itself and warned
// once per occurrence - five warnings on every single build. A build that
// warns on every deploy trains you to stop reading the log, and the one
// time it matters the warning is already noise.
const SITE_URL_MARKER = '__DOWNSIZE_SITE_URL__'

function siteFiles(siteUrl: string, indexable: boolean): Plugin {
  const robots = indexable
    ? ['User-agent: *', 'Allow: /', `Sitemap: ${siteUrl}/sitemap.xml`, ''].join('\n')
    : ['User-agent: *', 'Disallow: /', ''].join('\n')
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    `    <loc>${siteUrl}/</loc>`,
    '  </url>',
    '</urlset>',
    '',
  ].join('\n')

  return {
    name: 'downsize-site-files',

    // Do the %VITE_SITE_URL% substitution here rather than relying on
    // Vite's built-in HTML env replacement. That built-in only substitutes
    // variables present in the LOADED env, which means it works locally
    // (where .env supplies it) and silently no-ops on a CI build where
    // .env is gitignored — shipping the literal "%VITE_SITE_URL%/" as the
    // canonical. Resolving it through the same siteUrl the sitemap uses
    // keeps the two from ever disagreeing.
    // `post` + the object form so this runs late enough that ctx.bundle
    // exists: the font filename is content-hashed, so it cannot be written
    // into index.html by hand and has to be read back out of the build.
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        let out = html.replaceAll(SITE_URL_MARKER, siteUrl)

        // A preview build must not be indexable. robots.txt alone is not
        // enough — a preview URL that is linked from anywhere can still be
        // indexed without ever being crawled.
        if (!indexable) {
          out = out.replace(
            '<meta name="robots" content="index,follow" />',
            '<meta name="robots" content="noindex,nofollow" />',
          )
        }

        // Preload the Instrument Sans latin subset.
        //
        // Without it the font arrives after first paint, the fallback is
        // swapped out, and the first <h2> reflows — Lighthouse attributed
        // the whole of a 0.002 desktop CLS to exactly that. Small, but it
        // is the only shift left and this is the cheap half of the fix.
        //
        // Only the `latin` subset, not `latin-ext`: preloading a file the
        // page will not use costs real bytes on the critical path, and
        // English content never touches the ext subset. Only the sans,
        // not IBM Plex Mono, which sets a handful of numbers and was not
        // implicated.
        //
        // crossorigin is mandatory even same-origin — fonts are fetched
        // in CORS mode, and a preload without it is downloaded twice.
        //
        // ctx.bundle is undefined in dev, where the font is served
        // unhashed from node_modules and there is nothing to preload.
        const font = ctx.bundle
          ? Object.keys(ctx.bundle).find((f) =>
              /instrument-sans-latin-wght-normal-[^/]*\.woff2$/.test(f),
            )
          : undefined

        if (font) {
          out = out.replace(
            '</head>',
            `  <link rel="preload" href="/${font}" as="font" type="font/woff2" crossorigin />\n  </head>`,
          )
        }

        // Build-time assertions, not a hope.
        //
        // A literal marker in the canonical shipped to production once
        // already, and it was invisible locally because .env supplied the
        // value here and not on CI. Throwing fails the Cloudflare build
        // outright — the only feedback that cannot be scrolled past.
        if (out.includes(SITE_URL_MARKER)) {
          throw new Error(
            `[downsize] ${SITE_URL_MARKER} survived substitution in index.html. ` +
              'The canonical would have shipped as a literal token.',
          )
        }
        if (!/<link rel="canonical" href="https:\/\/[^"]+\/"/.test(out)) {
          throw new Error(
            '[downsize] index.html has no absolute https canonical after substitution.',
          )
        }
        return out
      },
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]
        if (url === '/robots.txt') {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end(robots)
          return
        }
        if (url === '/sitemap.xml') {
          res.setHeader('Content-Type', 'application/xml; charset=utf-8')
          res.end(sitemap)
          return
        }
        next()
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap })
    },

    // _headers is written in writeBundle, not emitted in generateBundle,
    // because it has to contain a hash of the inline theme script EXACTLY
    // as that script ships — and index.html is not final until the HTML
    // plugin has run its own transforms. Reading the written file is the
    // only way to hash what actually goes out rather than what was
    // authored.
    writeBundle(options) {
      const dir = options.dir ?? 'dist'
      const html = readFileSync(join(dir, 'index.html'), 'utf8')
      writeFileSync(join(dir, '_headers'), buildHeaders(html), 'utf8')
    },
  }
}

// Cloudflare Pages reads _headers from the output root (spec §12).
//
// The CSP as §12 originally wrote it would have broken the site:
// `script-src 'self'` blocks the inline theme script in index.html, and
// that script does two load-bearing things — it sets data-theme before
// first paint, and it adds the `.js` class that gates the #root height
// reservation. Losing it means a flash of the wrong theme AND the return
// of the 0.558 CLS the reservation exists to prevent. A nonce is not
// available on a static host, so the script is allow-listed by hash.
//
// The hash covers the script's text content byte for byte. Change one
// character of that script and this regenerates; change it by hand and
// the browser refuses to run it, which is the correct failure — loud, at
// the first page load, rather than silent.
function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = []
  const pattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g
  for (const match of html.matchAll(pattern)) {
    const body = match[1]
    // JSON-LD is data, not script — the browser never executes it, and
    // CSP does not gate it.
    if (/type=["']application\/ld\+json["']/.test(match[0])) continue
    if (body.trim() === '') continue
    // Newlines are normalised to LF before hashing.
    //
    // The HTML parser does this to a script element's text content, so
    // the browser hashes LF even when the file on disk has CRLF. On a
    // Windows checkout the raw bytes hash to something else entirely,
    // and the script is silently blocked. This would have worked on
    // Cloudflare's Linux builder and failed only locally — a bug that
    // passes CI and breaks on one developer's machine, or the reverse.
    // split/join rather than a regex: this line has been mangled twice
    // already by escaping in tooling between here and the file, and a
    // silently dropped /g would normalise only the first newline.
    const normalised = body.split('\r\n').join('\n').split('\r').join('\n')
    hashes.push(`'sha256-${createHash('sha256').update(normalised, 'utf8').digest('base64')}'`)
  }
  return hashes
}

function buildHeaders(html: string): string {
  const csp = [
    "default-src 'self'",
    // Hashes, not 'unsafe-inline'. Adding unsafe-inline would make the
    // whole directive decorative.
    `script-src 'self' ${inlineScriptHashes(html).join(' ')}`.trim(),
    // The worker is same-origin (new Worker(new URL(...))), so 'self' is
    // enough and blob: is deliberately not granted.
    "worker-src 'self'",
    "img-src 'self' blob: data:",
    // React writes element.style through the CSSOM, which CSP does not
    // gate, but Tailwind's build can inline a style element and the cost
    // of being wrong here is an unstyled page. Kept as §12 had it.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    // This is the no-upload promise, enforced by the browser rather than
    // by trust. v1 makes no network calls at all after load. It widens
    // when the AI endpoint lands and NOT before.
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ')

  return [
    '/*',
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  X-Frame-Options: DENY',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=()',
    `  Content-Security-Policy: ${csp}`,
    '',
    // Content-hashed filenames, so they can never go stale.
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ].join('\n')
}

// .env is gitignored, so a Cloudflare build never sees it. Resolution
// order matters — getting it wrong means shipping a canonical that points
// somewhere this build is not served from:
//
//   1. VITE_SITE_URL   explicit override, set once in the Pages dashboard
//   2. CF_PAGES_URL    PREVIEW deployments only (see below)
//   3. committed fallback
//
// The important difference from Vercel: Cloudflare Pages has no
// environment variable that gives the project's CUSTOM domain. VERCEL_
// PROJECT_PRODUCTION_URL did exactly that and has no equivalent here.
// CF_PAGES_URL is the per-deployment *.pages.dev address, which changes
// on every push — the same reason VERCEL_URL was rejected.
//
// So for production the committed fallback IS the mechanism, not a last
// resort. For previews the per-deployment URL is right: a preview that
// claimed downsize.site as its canonical would be asking Google to index
// the wrong copy.
const PRODUCTION_BRANCH = 'main'
const FALLBACK_SITE_URL = 'https://downsize.site'

interface SiteTarget {
  url: string
  // Previews are noindex. Two crawlable copies of the same site is the
  // duplicate-content problem this migration is partly meant to end, and
  // *.pages.dev previews would reintroduce it immediately.
  indexable: boolean
}

function resolveSite(fileEnv: Record<string, string>): SiteTarget {
  const explicit = fileEnv.VITE_SITE_URL || process.env.VITE_SITE_URL
  if (explicit) return { url: explicit.replace(/\/+$/, ''), indexable: true }

  const branch = process.env.CF_PAGES_BRANCH
  const deployUrl = process.env.CF_PAGES_URL
  if (branch && branch !== PRODUCTION_BRANCH && deployUrl) {
    return { url: deployUrl.replace(/\/+$/, ''), indexable: false }
  }

  return { url: FALLBACK_SITE_URL, indexable: true }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const site = resolveSite(loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [react(), tailwindcss(), siteFiles(site.url, site.indexable)],
    server: {
      port: Number(process.env.PORT) || 5173,
      strictPort: false,
    },
  }
})
