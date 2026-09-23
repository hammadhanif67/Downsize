import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// robots.txt and sitemap.xml can't live in public/ any more: Vite copies
// that directory verbatim, so a hardcoded domain in either file would
// survive into the build and contradict the canonical. They're generated
// here instead, from the same VITE_SITE_URL the HTML uses, and served in
// dev by the same plugin so the two environments can't drift.
function siteFiles(siteUrl: string): Plugin {
  const robots = ['User-agent: *', 'Allow: /', `Sitemap: ${siteUrl}/sitemap.xml`, ''].join('\n')
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
    transformIndexHtml(html) {
      return html.replaceAll('%VITE_SITE_URL%', siteUrl)
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
  }
}

// .env is gitignored, so a Vercel build never sees it. Resolution order
// matters here — getting it wrong means shipping a canonical that points
// somewhere this build is not served from:
//
//   1. VITE_SITE_URL          explicit override (local .env, or Vercel's
//                             dashboard once a real domain exists)
//   2. VERCEL_PROJECT_PRODUCTION_URL
//                             the project's STABLE production domain,
//                             injected by Vercel at build time. Note this
//                             is deliberately not VERCEL_URL, which is the
//                             per-deployment hash URL and changes on every
//                             push — useless as a canonical.
//   3. committed fallback     so a plain `npm run build` anywhere still
//                             produces something coherent.
function resolveSiteUrl(fileEnv: Record<string, string>): string {
  const explicit = fileEnv.VITE_SITE_URL || process.env.VITE_SITE_URL
  if (explicit) return explicit.replace(/\/+$/, '')

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`

  return 'https://downsize-alpha.vercel.app'
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const siteUrl = resolveSiteUrl(loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [react(), tailwindcss(), siteFiles(siteUrl)],
    server: {
      port: Number(process.env.PORT) || 5173,
      strictPort: false,
    },
  }
})
