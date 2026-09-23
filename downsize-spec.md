# Downsize — Build Specification

**Product:** Downsize — a browser-based image resizer
**Domain:** downsizeimage.com
**Version:** 1.0 (MVP)
**Audience of this document:** the engineer/agent implementing the app. Follow it literally. Where it says MUST, it is a hard requirement. Where it says SHOULD, deviate only with a stated reason.

---

## 1. What this product is

Downsize resizes images entirely inside the user's browser. No image is ever uploaded to a server. A person drops in a photo, picks a width (or a preset), and downloads the resized file. That is the whole product.

The defining property — and the thing the marketing copy and the architecture both hang on — is that **processing is local**. There is no backend, no queue, no storage, no account.

**Primary job:** take a large image and produce a smaller one, fast, with no friction and no sign-up.
**Audience:** people who need a correctly sized image right now — social media managers, bloggers, store owners, students uploading a form photo.

---

## 2. Scope

### In scope for v1

- Upload one image via drag-and-drop or file picker
- Client-side validation (type, size, decodability)
- Preview with real metadata (dimensions, file size, format)
- Resize by width, by height, by percentage, or by preset
- Aspect-ratio lock (on by default)
- Before/after comparison of dimensions and file size
- Download the result with a sensible filename
- Static SEO content on the same page (see §11)

### Explicitly out of scope

Do not build these. Do not add nav items, tabs, or dead buttons for them.

- Compression quality controls, target-file-size compression
- Format conversion (JPG ↔ PNG ↔ WEBP)
- Cropping, rotation, filters
- AI assistance, any LLM integration
- Batch / multi-file processing
- Accounts, auth, payments, analytics dashboards, pricing pages
- Any backend, any serverless function, any database

Output format MUST match the input format. A JPEG in produces a JPEG out.

*(Amended 2026-09-23: a phased-scope section adding compress/convert/AI as Phases B–D was briefly added here and has been removed, along with the sidebar and tool-tab shell built for it. This app does one thing: resize images. None of the above are planned features. The processing layer (§6) stays pure-functional for its own sake — testability — not to reserve room for a roadmap.)*

---

## 3. Stack and constraints

| Concern | Choice |
|---|---|
| Framework | React 18+ with TypeScript, strict mode on |
| Build | Vite |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite` plugin, CSS-first config) |
| Icons | `lucide-react` |
| Validation | `zod` (file + settings validation) |
| Processing | Canvas 2D API + `createImageBitmap` |
| Hosting | Cloudflare Pages (static only, no Functions in v1) |
| Package manager | npm |

**Hard constraints:**

- No runtime dependency beyond the table above. No UI kit, no image library, no state manager. If a problem seems to need one, solve it with ~30 lines instead.
- No `any` in application code. Use `unknown` plus a narrowing function.
- No network requests at runtime. The app MUST work fully offline after first load.
- JS bundle (gzipped) target: **app code under 25 KB, total under 95 KB**. Treat this as a
  budget, not an aspiration. (Amended 2026-09-23 — see §14 for why.)

---

## 4. Architecture

Three layers, strictly separated:

1. **`lib/`** — pure TypeScript. No React, no DOM events, no Tailwind. Takes inputs, returns outputs. Independently testable.
2. **`hooks/`** — holds state, orchestrates calls into `lib/`, owns loading/error state.
3. **`components/`** — renders. No image math inside a component. Ever.

```
downsize/
├── index.html                  # SEO content lives here (see §11)
├── public/
│   ├── robots.txt
│   ├── sitemap.xml
│   ├── og-image.png            # 1200×630
│   ├── apple-touch-icon.png    # 180×180
│   ├── favicon.svg
│   └── _headers                # Cloudflare headers (see §12)
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css               # Tailwind + design tokens
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   └── Logo.tsx             # inline SVG mark, size prop
│   │   ├── upload/
│   │   │   ├── Dropzone.tsx
│   │   │   └── FileError.tsx
│   │   ├── workspace/
│   │   │   ├── Workspace.tsx        # orchestrates preview + controls
│   │   │   ├── ImageCanvas.tsx      # displays preview, ruler ticks, source info bar
│   │   │   ├── FileCard.tsx         # loaded-file summary: thumb, name, size, remove
│   │   │   ├── ResizeControls.tsx
│   │   │   ├── PresetGrid.tsx
│   │   │   ├── SizeComparison.tsx   # before → after, side-by-side thumbnails
│   │   │   └── DownloadBar.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── NumberField.tsx
│   │       ├── Toggle.tsx
│   │       └── Spinner.tsx
│   ├── hooks/
│   │   ├── useImageFile.ts     # load, validate, hold source image
│   │   └── useResize.ts        # settings state + run processing
│   ├── lib/
│   │   ├── image/
│   │   │   ├── load.ts
│   │   │   ├── resize.ts
│   │   │   ├── encode.ts
│   │   │   └── download.ts
│   │   ├── validation.ts
│   │   ├── presets.ts
│   │   ├── format.ts           # byte + dimension formatting
│   │   └── constants.ts
│   └── types/
│       └── index.ts
└── vite.config.ts
```

---

## 5. Core types

Put these in `src/types/index.ts`. Everything else derives from them.

```ts
export type SupportedMime = 'image/jpeg' | 'image/png' | 'image/webp';

export interface SourceImage {
  file: File;
  bitmap: ImageBitmap;      // orientation already applied
  width: number;            // natural width after orientation
  height: number;
  bytes: number;
  mime: SupportedMime;
  name: string;             // original filename without extension
  previewUrl: string;       // object URL — must be revoked on replace
}

export type ResizeMode = 'dimensions' | 'percentage' | 'preset';

export interface ResizeSettings {
  mode: ResizeMode;
  width: number;
  height: number;
  lockAspect: boolean;
  percentage: number;       // 1–100, used when mode === 'percentage'
  presetId: string | null;
}

export interface ResizeResult {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
  previewUrl: string;       // must be revoked when replaced
}

export type AppError =
  | { kind: 'unsupported-type'; received: string }
  | { kind: 'too-large'; bytes: number }
  | { kind: 'decode-failed' }
  | { kind: 'dimensions-too-large'; width: number; height: number }
  | { kind: 'encode-failed' };
```

Errors are a discriminated union, not strings. The UI maps each `kind` to a message (§9.5). This keeps copy out of the logic layer.

---

## 6. Image pipeline

This is the part that matters most. Get it right and the rest is plumbing.

### 6.1 Constants (`lib/constants.ts`)

```ts
export const MAX_FILE_BYTES = 30 * 1024 * 1024;   // 30 MB
export const MAX_SOURCE_PIXELS = 50_000_000;      // ~50 MP guard
export const MAX_OUTPUT_DIMENSION = 12_000;       // canvas safety ceiling
export const MIN_OUTPUT_DIMENSION = 1;
export const ACCEPTED_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
```

### 6.2 Loading (`lib/image/load.ts`)

```ts
export async function loadImage(file: File): Promise<SourceImage>
```

Requirements:

1. Validate **before** decoding (§6.3).
2. Decode with `createImageBitmap(file, { imageOrientation: 'from-image' })`. This applies EXIF orientation, which is why phone photos otherwise come out rotated. If the options argument throws (older browser), fall back to a plain `createImageBitmap(file)` call rather than failing outright.
3. If decoding rejects, return `{ kind: 'decode-failed' }` — a `.png` file can contain garbage.
4. Reject if `width * height > MAX_SOURCE_PIXELS`.
5. Create the preview URL with `URL.createObjectURL(file)`.
6. Derive `name` by stripping the extension from `file.name`.

**Memory discipline (MUST):** when a new image replaces an old one, call `URL.revokeObjectURL` on the old preview URL **and** `oldBitmap.close()`. Object URLs and bitmaps are not garbage collected on their own; skipping this leaks tens of megabytes per image.

### 6.3 Validation (`lib/validation.ts`)

Check in this order and stop at the first failure:

1. MIME type is in `ACCEPTED_MIMES`. Do not trust the file extension — read `file.type`, and if it is empty, reject as unsupported.
2. `file.size <= MAX_FILE_BYTES`.
3. Decode succeeds.

Also export a `clampSettings()` that forces width/height into `[MIN_OUTPUT_DIMENSION, MAX_OUTPUT_DIMENSION]` and rounds to integers. Every path into the resize function goes through it — typed input, preset, percentage, all of them.

### 6.4 Resizing (`lib/image/resize.ts`)

```ts
export function resize(
  bitmap: ImageBitmap,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement
```

Requirements:

1. Create a canvas at the target size, get a 2D context with `{ alpha: true }`.
2. Set `ctx.imageSmoothingEnabled = true` and `ctx.imageSmoothingQuality = 'high'`.
3. **Stepped downscaling (MUST).** A single `drawImage` from 4000px to 400px aliases badly — the browser samples too few source pixels. When the shrink factor is greater than 2×, halve repeatedly into an intermediate canvas until within 2× of the target, then draw the final step. This is the single biggest quality difference in the app.

```ts
let current: CanvasImageSource = bitmap;
let cw = bitmap.width;
let ch = bitmap.height;

while (cw / 2 > targetWidth && ch / 2 > targetHeight) {
  const next = document.createElement('canvas');
  next.width = Math.max(1, Math.floor(cw / 2));
  next.height = Math.max(1, Math.floor(ch / 2));
  const nctx = next.getContext('2d')!;
  nctx.imageSmoothingQuality = 'high';
  nctx.drawImage(current, 0, 0, next.width, next.height);
  current = next;
  cw = next.width;
  ch = next.height;
}
// final draw into the target canvas
```

4. Upscaling is allowed but never sharpens; do not add a warning banner for it in v1.
5. This function is synchronous and pure with respect to its inputs. It does not touch React state.

### 6.5 Encoding (`lib/image/encode.ts`)

```ts
export function encode(canvas: HTMLCanvasElement, mime: SupportedMime): Promise<Blob>
```

- Wrap `canvas.toBlob(cb, mime)` in a promise; reject with `encode-failed` if the callback receives `null`.
- Pass **no quality argument** in v1 — quality is out of scope and PNG ignores it anyway. Leave the parameter in the signature (`quality?: number`) so Phase 2 slots in cleanly.
- PNG output of a photo is often *larger* than the JPEG source. That is expected; v1 does not try to fix it.

### 6.6 Download (`lib/image/download.ts`)

Filename pattern: `{originalName}-{width}x{height}.{ext}` → `beach-photo-1280x720.jpg`.

Sanitise the original name: strip path separators and control characters, collapse whitespace to `-`, cap at 60 characters.

Create an object URL, trigger an `<a download>` click, then revoke the URL on the next tick.

### 6.7 Threading

Run on the main thread in v1. The stepped resize of a 12 MP image takes tens of milliseconds and a Web Worker adds transfer complexity for little gain. Keep `lib/image/*` free of DOM-event and React imports so moving to an `OffscreenCanvas` worker later is a contained change.

Show the processing state anyway — on a low-end phone with a 50 MP input it is perceptible.

### 6.8 Debouncing

Resize output regenerates when settings change. Debounce regeneration by **250 ms** so dragging a percentage slider does not queue dozens of encodes. Cancel stale work: keep a monotonically increasing request id and discard any result whose id is not the latest.

---

## 7. Presets (`lib/presets.ts`)

```ts
export interface Preset {
  id: string;
  label: string;
  group: 'Social' | 'Web' | 'Common';
  width: number;
  height: number | null;   // null = width-driven, keep source ratio
}
```

Ship exactly these:

**Social** — Instagram Post `1080×1080`, Instagram Portrait `1080×1350`, Instagram Story `1080×1920`, Facebook Cover `820×312`, YouTube Thumbnail `1280×720`, LinkedIn Banner `1584×396`, X Post `1600×900`

**Web** — Full HD width `1920×null`, Blog body `1200×null`, Thumbnail `400×null`

**Common** — Half size `(percentage 50)`, Quarter size `(percentage 25)`

Presets with a fixed height change the aspect ratio. When one is selected, the app MUST show a one-line note under the controls stating that the image will be stretched to fit, because cropping is out of scope in v1. Wording in §9.4.

---

## 8. State and flow

Two hooks, no global store.

**`useImageFile()`** owns: `source: SourceImage | null`, `error: AppError | null`, `isLoading`. Exposes `load(file)` and `clear()`. Handles all revoking/closing.

**`useResize(source)`** owns: `settings: ResizeSettings`, `result: ResizeResult | null`, `isProcessing`. Exposes `setWidth`, `setHeight`, `setPercentage`, `applyPreset`, `toggleLock`, `reset`.

Aspect-lock behaviour: when `lockAspect` is true and width changes, `height = round(width / sourceAspect)` and vice versa. Compute from the **source** aspect ratio, never from the current field values — otherwise rounding drift accumulates as the user types.

Flow: `idle → loading → ready → (processing ⇄ ready) → downloaded`. There is no separate "apply" step. Changing a setting updates the result after the debounce; the download button is always live once a result exists.

---

## 9. Interface

### 9.1 Design direction

The subject is measurement — dimensions, ratios, exact pixels. The visual language borrows from drafting and technical drawing, not from generic SaaS. The image sits on a light measured surface; the chrome around it stays quiet so the photo is the only thing with colour in the layout.

**Tokens** (define as CSS custom properties in `index.css`, consume via Tailwind):

```
--paper:     #F4F5F7   /* app background */
--surface:   #FFFFFF   /* panels, canvas backdrop */
--ink:       #15191F   /* primary text */
--ink-muted: #5E6672   /* secondary text, units, hints */
--rule:      #D9DEE5   /* borders, dividers, ruler ticks */
--accent:    #1B4FD8   /* active state, primary action — used sparingly */
--danger:    #B3261E   /* error text and borders only */
```

Dark mode is out of scope for v1.

**Type:** one family for the interface — **Instrument Sans** (self-hosted via `@fontsource`, weights 400/500/600). For numeric values only — dimensions, file sizes, percentages — use **IBM Plex Mono** at 400. The mono face is functional, not decorative: tabular figures stop the layout from jittering while a number is being edited. Do not use mono for labels, buttons, or prose.

Type scale: 13 / 15 / 18 / 24 / 32 px. Body copy at 15px with 1.55 line-height, measure capped at 68 characters.

**Layout:**

```
┌──────────────────────────────────────────────────────┐
│  Downsize                                How it works │  ← header, 1px bottom rule
├──────────────────────────────────────────────────────┤
│                                                      │
│   ┌────────────────────────┐  ┌───────────────────┐  │
│   │                        │  │ Width      1280 px│  │
│   │      image preview     │  │ Height      720 px│  │
│   │   (ruler ticks along   │  │ [x] Lock ratio    │  │
│   │    top + left edge)    │  │                   │  │
│   │                        │  │ Presets           │  │
│   │                        │  │ [ ][ ][ ][ ][ ]   │  │
│   └────────────────────────┘  │                   │  │
│   3024 × 4032 · 4.2 MB        │ 1280×720 · 310 KB │  │
│                               │ [ Download ]      │  │
│                               └───────────────────┘  │
├──────────────────────────────────────────────────────┤
│  Static SEO content: how it works, FAQ (§11)         │
└──────────────────────────────────────────────────────┘
```

Two columns on ≥1024px (preview ~62%, controls ~38%). Single column below, controls stacked under the preview, download bar sticky to the bottom edge on mobile.

**The one bold move:** thin ruler ticks along the top and left edge of the preview frame, drawn in `--rule`, with the pixel dimension labelled at each end. It is the only ornament in the app and it earns its place by encoding the actual subject — size. Everything else stays flat: **0 radius everywhere** (amended 2026-09-23 — the original "4px radius on controls" line is revoked; sharp corners throughout, set globally via `* { border-radius: 0 }` rather than trusted to each component), no shadows, no gradients, no card grid.

**Motion:** one transition only — the preview cross-fades over 150ms when a new result replaces the old one, so the change is visible. No entrance animations, no hover lifts. Respect `prefers-reduced-motion: reduce` by disabling even that.

### 9.2 Empty state (dropzone)

Full-width dashed `--rule` frame, generous padding, `ImageUp` icon from lucide, heading **"Drop an image to resize"**, subline **"JPG, PNG or WEBP · up to 30 MB · nothing leaves your device"**, and a secondary button **"Choose file"**.

The dropzone MUST: highlight on `dragover` (accent border, no scaling), handle `dragleave` correctly using a counter (nested elements fire spurious leave events), accept a paste from the clipboard (`paste` event on `window`), and open the file picker on Enter/Space when focused.

### 9.3 Controls

- Two number fields, width and height, each with a trailing `px` unit in `--ink-muted`.
- Fields accept typing freely; clamp on blur, not on every keystroke, or the user cannot delete a digit.
- A lock toggle labelled **"Lock ratio"**, on by default, with `Link`/`Unlink` icons.
- A percentage row: a range input plus its value, active only in percentage mode.
- Preset grid: small buttons with label on the first line and dimensions in mono on the second. Selected preset gets an accent border and `aria-pressed="true"`.
- A **"Reset"** text button returns settings to the source dimensions.

### 9.4 Copy

Exact strings. Sentence case throughout. No exclamation marks.

| Location | Text |
|---|---|
| ~~Header tagline~~ | ~~Resize images in your browser~~ — cut (step 7 revision): the header is wordmark + "How it works" only; this line now lives solely as the step 8 H1, which has more room to say it without repeating itself two lines later |
| Dropzone heading | Drop an image to resize |
| Dropzone subline | JPG, PNG or WEBP · up to 30 MB · nothing leaves your device |
| Download button | Download image |
| After download toast | Image downloaded |
| Comparison line | 3024 × 4032 · 4.2 MB → 1280 × 720 · 310 KB |
| Saving label | 92% smaller |
| Fixed-ratio preset note | This preset has a fixed shape, so the image will stretch to fit. |
| Replace image link | Use a different image |

### 9.5 Error states

Inline, under the dropzone, `--danger` text with an `AlertCircle` icon. Never a modal, never a toast — the user needs the message while they retry.

| `kind` | Message |
|---|---|
| `unsupported-type` | That file type isn't supported. Use a JPG, PNG or WEBP. |
| `too-large` | That file is over 30 MB. Try a smaller one. |
| `decode-failed` | That image couldn't be opened. It may be damaged. |
| `dimensions-too-large` | That image is too large to process in the browser. |
| `encode-failed` | The resized image couldn't be created. Try again. |

Errors state what happened and what to do. They do not apologise.

### 9.6 Loading states

- Decoding a file: spinner inside the dropzone, text **"Opening image"**.
- Processing a resize: the preview stays visible at reduced opacity with a small spinner in the corner. Do not blank the preview — a flash of empty space on every keystroke is worse than a stale pixel.

---

## 10. Accessibility

Non-negotiable:

- Every control reachable and operable by keyboard. Visible focus ring: 2px `--accent` at 2px offset. Never remove outlines without a replacement.
- The file input is a real `<input type="file">`, visually hidden but focusable — not a div with a click handler.
- Number fields have real `<label>` elements, not placeholder-only labelling.
- The result region carries `aria-live="polite"` so a screen reader announces the new dimensions and size after a change.
- Error text is associated with its control via `aria-describedby`; the dropzone gets `role="button"` and `aria-label` when it is the interactive element.
- Contrast: all text meets WCAG AA against its background. Check `--ink-muted` on `--paper` specifically.
- `<html lang="en">`.
- Respect `prefers-reduced-motion`.

---

## 11. SEO

The app is one page. That page has to serve both a tool user and a search crawler. Both are served by the same HTML.

### 11.1 Rendering strategy (the important part)

A Vite React SPA ships an empty `<div id="root">`. Crawlers increasingly execute JS, but ranking on an empty shell is a gamble with no upside here.

**Approach:** the marketing and support content is **static HTML written directly into `index.html`**, placed *after* `<div id="root">` inside a `<main>` sibling. React mounts into `#root` and never touches that markup. No SSR, no prerender plugin, no hydration mismatch, no extra build step. The crawler gets a full page of real content on first byte; the user gets an instant tool above it.

Keep the H1 in the static HTML, not in React. Exactly one H1 per page.

### 11.2 Head

```html
<title>Resize an Image Online — Free, Private, No Upload | Downsize</title>
<meta name="description" content="Resize JPG, PNG and WEBP images in your browser. Your files never leave your device. No sign-up, no watermark, no upload." />
<link rel="canonical" href="https://downsizeimage.com/" />
<meta name="theme-color" content="#F4F5F7" />

<meta property="og:type" content="website" />
<meta property="og:url" content="https://downsizeimage.com/" />
<meta property="og:title" content="Downsize — Resize images in your browser" />
<meta property="og:description" content="Resize JPG, PNG and WEBP without uploading. Everything happens on your device." />
<meta property="og:image" content="https://downsizeimage.com/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
```

Title stays under ~60 characters of visible weight; description 150–160. Lead the title with the search phrase people actually type ("resize an image online"), brand last.

### 11.3 Static content blocks

Below the tool, in this order, in semantic HTML:

1. `<h1>` — **Resize an image without uploading it**, followed by a 2–3 sentence intro that names JPG, PNG, WEBP and states the local-processing guarantee.
2. `<h2>` **How to resize an image** — an ordered list of 4 steps. This is a genuine sequence, so numbering is correct here.
3. `<h2>` **Why resize in the browser** — 3 short paragraphs: privacy, speed, no account. Plain prose, not a feature-card grid.
4. `<h2>` **Common image sizes** — a real `<table>` of the presets from §7 with their dimensions and typical use. Tables of specifications are well-understood by crawlers and genuinely useful.
5. `<h2>` **Questions** — 5 `<h3>`/`<p>` pairs (see JSON-LD below for the questions).
6. `<footer>` with a short about line and the year.

Write this copy as prose a person would read. Do not keyword-stuff; do not repeat "resize image" in every sentence. One natural mention per paragraph is plenty.

### 11.4 Structured data

Two JSON-LD blocks in `<head>`. Every answer in the FAQ block MUST match visible page text word for word — mismatched structured data gets the rich result withdrawn.

```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Downsize",
  "url": "https://downsizeimage.com/",
  "applicationCategory": "MultimediaApplication",
  "operatingSystem": "Any browser",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "description": "Resize JPG, PNG and WEBP images locally in the browser."
}
```

Second block: `FAQPage` with these five questions —
1. Are my images uploaded to a server?
2. What file types can I resize?
3. Is there a file size limit?
4. Will resizing reduce the quality?
5. Does it cost anything?

### 11.5 Crawl files

`public/robots.txt`:
```
User-agent: *
Allow: /
Sitemap: https://downsizeimage.com/sitemap.xml
```

`public/sitemap.xml`: one `<url>` entry for `/`. A single-page site does not need more, and a bloated sitemap is worse than a small honest one.

### 11.6 Performance (SEO is partly performance)

Budgets — treat a miss as a bug:

- **LCP under 2.0s** on a 4G profile. The LCP element is the H1 or the dropzone, both static HTML, so this is achievable.
- **CLS under 0.05.** Reserve the preview area with a fixed aspect box before the image loads. This is the most likely place to lose points — do not let the layout jump when an image appears.
- **INP under 200ms.** The debounce in §6.8 is what protects this.
- Self-host fonts, `font-display: swap`, preload the one weight used above the fold. No Google Fonts network request.
- No render-blocking JS above the static content.
- `og-image.png` compressed under 150 KB.

---

## 12. Security and headers

`public/_headers` (Cloudflare Pages reads this file):

```
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

`img-src` MUST include `blob:` and `data:` or previews break. `connect-src 'self'` is what enforces the no-upload promise at the browser level — keep it that tight, since v1 makes no network calls at all.

---

## 13. Deployment

- Cloudflare Pages, connected to the GitHub repo.
- Build command `npm run build`, output directory `dist`.
- No environment variables, no secrets, no Functions in v1.
- Every push to `main` deploys. Preview deployments on branches.

---

## 14. Acceptance criteria

Ship only when all of these pass:

**Function**
- [ ] A 4000×3000 JPEG resizes to 1280 wide and the download opens correctly
- [ ] A PNG with transparency keeps its alpha channel
- [ ] A WEBP resizes and downloads as WEBP
- [ ] A portrait photo taken on a phone appears upright (EXIF orientation)
- [ ] Aspect lock keeps the ratio within ±1px across a full range of widths
- [ ] Unlocking allows independent width and height
- [ ] Each preset produces exactly its stated dimensions
- [ ] Downloaded filename follows `name-WxH.ext`
- [ ] Loading a second image releases the first (check memory in DevTools)

**Validation**
- [ ] A `.pdf` renamed to `.jpg` is rejected with `decode-failed`
- [ ] A 40 MB file is rejected before decoding
- [ ] Typing `0`, a negative number, or `999999` in a field clamps on blur without crashing

**Quality**
- [ ] A 4000px → 300px downscale shows no jagged aliasing (stepped path confirmed)

**Interface**
- [ ] Full keyboard path: focus dropzone → open picker → edit width → download
- [ ] Layout holds at 320px width with no horizontal scroll
- [ ] Rapid slider dragging never freezes the UI
- [ ] Reduced-motion preference removes the cross-fade

**SEO / performance**
- [ ] `curl https://downsizeimage.com` returns the H1, the how-to steps, and the FAQ in the raw HTML
- [ ] Lighthouse: Performance ≥ 95, Accessibility 100, SEO 100
- [ ] Both JSON-LD blocks validate in Google's Rich Results Test
- [ ] App code (everything except `react`/`react-dom`) under 25 KB gzip
- [ ] Total JS under 95 KB gzip

> **Amended 2026-09-23:** the original 80 KB figure was set without accounting for the
> framework and didn't survive contact with a real build (React 19 + ReactDOM alone is
> ~69 KB gzip). Replaced with the two lines above. The framework budget barely touches
> LCP (the LCP element is static HTML outside the React tree); what JS size actually
> threatens is INP, which the four criteria below already cover directly — those are the
> tests that matter. If all four pass, the KB numbers are close to academic.
>
> Two rules regardless of where the number lands: import `lucide-react` icons
> individually (`import { X } from 'lucide-react'`), never a namespace import — that
> alone can add ~2 MB unminified. And no new dependency, direct or transitive, without
> asking first.
>
> Fallback if step 10 still comes in over 95 KB: alias `react`/`react-dom` to
> `preact/compat` in `vite.config.ts` (~5 KB gzip runtime, no source changes) — but only
> then, tried and re-run through the full acceptance checklist, not pre-emptively now.

---

## 15. Build order

Work in this sequence and keep the app runnable at the end of each step.

1. Scaffold Vite + TS + Tailwind v4, define the tokens in `index.css`, self-host the two fonts.
2. Write `types/`, `constants.ts`, `validation.ts`, `format.ts`.
3. Write `lib/image/load.ts`, `resize.ts`, `encode.ts`, `download.ts`. Verify from a throwaway test page before any UI exists.
4. Build `Dropzone` + `useImageFile`: upload, validate, show metadata. No resizing yet.
5. Build `useResize` + `ResizeControls` + `SizeComparison` + `DownloadBar`. The core loop now works.
6. Add `PresetGrid`.
7. Add `ImageCanvas` with the ruler-tick frame, `Header`. (Amended 2026-09-23:
   dropped `Footer` — the footer was listed in both §4 and §11.3.6, and only
   §11.3.6 is coherent: it's static HTML written in step 8, and React never
   touches that markup per §11.1. A React `Footer.tsx` had no job left.)
8. Write the static SEO content, head tags, JSON-LD, `robots.txt`, `sitemap.xml`, `og-image.png`.
9. Add `_headers`, deploy to Cloudflare Pages.
10. Run the §14 checklist. Fix. Ship.

---

## 16. Conventions

- Components are named function declarations with an explicit props interface. No `React.FC`.
- One component per file; the filename matches the component.
- Tailwind utilities in the markup; no CSS modules, no `@apply` except for the two or three genuinely repeated patterns (focus ring, panel).
- Handlers named `handleX`; props for them named `onX`.
- Comments explain *why*, not *what*. The stepped-downscale loop and the EXIF fallback deserve a comment. `// set width` does not.
- No `console.log` in committed code.
- No TODO comments for out-of-scope features. The roadmap lives in §2, not in the source.
