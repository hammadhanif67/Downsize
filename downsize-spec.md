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
- **Compression: a quality control, and target-file-size search (§6.9)**
- Static SEO content on the same page (see §11)

### Explicitly out of scope

Do not build these. Do not add nav items, tabs, or dead buttons for them.


- Cropping, rotation, filters
- AI assistance, any LLM integration
- Batch / multi-file processing
- Accounts, auth, payments, analytics dashboards, pricing pages
- Any backend, any serverless function, any database

Output format MUST match the input format. A JPEG in produces a JPEG out.

*(Amended 2026-09-23: a phased-scope section adding compress/convert/AI as Phases B–D was briefly added here and has been removed, along with the sidebar and tool-tab shell built for it. The processing layer (§6) stays pure-functional for its own sake — testability — not to reserve room for a roadmap.)*

**Amended 2026-09-23 — Phase B.** Compression and quality control move into
scope. They are what make "get this under 500 KB" answerable at all, which
resizing alone cannot do.

Two tool tabs, Resize and Compress, and both work. There is no Convert tab and
no AI Assist tab, **not even disabled** — the reverted shell above is the
reason that rule exists, and it still holds. Format conversion and AI
assistance remain out of scope until they are built, not before.

One output, not two. Resize and compress apply to the same result in that
order — resize, then encode at the chosen quality — and there is one result
object and one download. Switching tabs changes which settings are on screen
and nothing else.

**Amended 2026-09-23 — Phase C.** Format conversion moves into scope, and the
"output format MUST match the input format" invariant is retired with it. It
held from v1 through Phase B.5 and is now wrong in three places that had to
change together: this section, the FAQ answer on the page, and that answer's
twin in the FAQPage JSON-LD.

The default is still to keep the source format — conversion is something you
ask for, not something that happens. AI assist remains out of scope.

**JPEG has no alpha channel**, so converting to it is the one direction that
can destroy information the rest of the pipeline preserves. Three rules:

- **Detect, do not assume.** Most PNGs are opaque, and a warning that fires
  on every PNG is noise. Noise gets ignored, and then the one that mattered
  gets ignored too. `lib/image/client.ts` scans for a genuinely transparent
  pixel and caches the answer per image.
- **Scan lazily and cheaply.** Only when JPEG is selected, which cannot
  happen without opening the Convert tab, and only for a source format that
  can carry alpha. In the worker, reading horizontal strips with an
  early exit — a logo on transparency answers in the first strip, and a
  fully opaque image is the only one that pays the whole cost.
- **Ask for the colour.** White is right for a logo on a white page and
  wrong for one on a coloured page, and only the user knows which. Two
  swatches plus a native `<input type="color">`; no picker library.

Never flatten silently. That is the same class of harm as re-encoding an
untouched file (6.10).

**Encode support is probed, not assumed.** `canvas.toBlob` and
`convertToBlob` fall back to PNG for a type they cannot write, silently and
with no error — so offering WEBP on a browser that can decode but not encode
it would hand back PNG bytes in a file named `.webp`. `lib/image/formats.ts`
encodes a 1x1 once per format and checks the returned `blob.type`. Note that
the probe surface needs a 2D context first: `convertToBlob` throws
`InvalidStateError` on a canvas that has never had one, which made every
format fail the probe and looked exactly like a PNG-only browser.

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
├── public/                     # copied verbatim into dist/
│   ├── og-image.png            # 1200×630, light palette in both themes
│   ├── apple-touch-icon.png    # 180×180
│   ├── favicon.ico             # 16 + 32, PNG payloads
│   └── favicon.svg             # own 16-unit geometry, see the file
│
│   Three files that LOOK like they belong above are generated into dist/
│   by vite.config.ts instead, and for the same reason in each case —
│   their contents are not knowable when the file would be written:
│     robots.txt    carries the site URL, which varies by deployment
│     sitemap.xml   same
│     _headers      carries a SHA-256 of the inline theme script (§12)
│   public/ is copied verbatim, so anything hardcoded there survives into
│   the build and silently contradicts the canonical.
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css               # Tailwind + design tokens
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.tsx           # sticky bar, section spy, mobile panel
│   │   │   ├── ThemeToggle.tsx      # light → dark → system
│   │   │   └── Logo.tsx             # inline SVG mark, size prop
│   │   ├── upload/
│   │   │   ├── Dropzone.tsx
│   │   │   └── FileError.tsx
│   │   ├── workspace/
│   │   │   ├── Workspace.tsx        # orchestrates preview + controls
│   │   │   ├── ImageCanvas.tsx      # displays preview, ruler ticks, source info bar
│   │   │   ├── FileCard.tsx         # loaded-file summary: thumb, name, size, remove
│   │   │   ├── ToolTabs.tsx          # Resize · Compress, real tablist
│   │   │   ├── ResizeControls.tsx
│   │   │   ├── CompressControls.tsx  # quality slider / target-size search
│   │   │   ├── PresetGrid.tsx
│   │   │   ├── SizeComparison.tsx   # before → after, side-by-side thumbnails
│   │   │   └── DownloadBar.tsx
│   │   ├── icons/                   # platform glyphs for PresetGrid
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── NumberField.tsx
│   │       ├── Toggle.tsx
│   │       └── Spinner.tsx
│   ├── hooks/
│   │   ├── useImageFile.ts     # load, validate, hold source image
│   │   ├── useImagePipeline.ts # resize + compress settings, one result
│   │   └── useTheme.ts         # theme choice, storage, theme-color meta
│   ├── site/                   # operates on index.html's static article,
│   │   ├── reveal.ts           #   which React does not own — not React
│   │   └── typing.ts           #   code, so not components/ or hooks/
│   ├── lib/
│   │   ├── image/
│   │   │   ├── load.ts
│   │   │   ├── resize.ts
│   │   │   ├── encode.ts
│   │   │   ├── compress.ts     # target-size binary search (§6.9)
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

### 6.9 Target-size search (`lib/image/compress.ts`)

Added 2026-09-23 with Phase B. Numbered 6.9 so the existing subsections keep
the numbers they are referred to by elsewhere.

```ts
encodeToTarget(canvas, mime, targetBytes)
  : Promise<{ blob; quality; attempts; reachable } | AppError>
```

Binary search for the **highest** quality whose encode lands at or under
`targetBytes`, capped at `MAX_QUALITY_SEARCH_ATTEMPTS` (8). Rules:

- It walks whole percentage points between `MIN_QUALITY` and `MAX_QUALITY`,
  not the continuous range. Bisecting a float converges on something like
  0.6414062, and reporting "quality 64" after encoding at that is a small
  lie — re-encode at 0.64 and the size moves. On an integer grid the number
  shown and the number encoded are the same number, and §14 checks that
  re-encoding at the reported quality reproduces the byte count exactly.
- It probes the **top first** (a modest target often fits at full quality,
  and that should cost one encode, not eight) and the **bottom second**,
  before searching. Probing the bottom early is what guarantees a known-good
  blob exists for the rest of the run — every later probe either fits and
  becomes the new best, or is discarded. The function can therefore never be
  in a position where it has to return an overshooting blob.
- If even `MIN_QUALITY` overshoots it returns that blob with
  `reachable: false`. **Never return something over target and present it as
  success.**
- It returns `AppError` rather than throwing, like everything else in `lib/`
  (§6.3). The Phase B brief's signature had no failure arm; `encode()` can
  genuinely fail, and throwing out of `lib/` is ruled out.

Assumes size decreases monotonically with quality. True for JPEG and WEBP in
practice, guaranteed by nothing. A non-monotonic encoder would make the
search land on a valid-but-not-optimal quality; it would still never
overshoot, because only encodes that actually fit are kept.

**PNG has no quality axis.** `encode()` drops the quality argument for
`image/png` at source, so "quality 60 on a PNG" is not expressible rather
than merely ineffective, and target-size mode is disabled for PNG sources
with the note *"PNG has no quality setting. Reduce the dimensions instead."*
Do not fake it by downscaling behind the user's back.

**Never debounced.** A search is up to eight full encodes of a full-size
canvas. It runs on an explicit button press only, and §14 checks that by
counting `toBlob` calls, not by watching the UI.

### 6.10 Pass-through

Added 2026-09-23. When **all** of these hold, the result is the source `File`
itself and nothing is encoded:

- the resolved output dimensions equal the source dimensions, and
- `compress.quality` is still `DEFAULT_QUALITY`, and
- no target search has run (`compressOutcome === null`)

This is not an optimisation. **Re-encoding a JPEG is lossy at any quality** —
a decode/encode round trip at 95 still moves pixels — so doing it when
nothing was asked for is damage with no upside. At the default it also
inflated already-compressed files, so opening the Compress tab on a 320 KB
photo announced "File is 22% bigger": damage, reported as work.

The result's `previewUrl` is a **second** `createObjectURL` handle to the
same file, never `source.previewUrl`. Results are revoked when replaced, and
revoking the source's own URL would blank the Before thumbnail and the file
card.

The pass-through path still bumps the shared request id, because an encode
from an earlier edit may be in flight and would otherwise land afterwards
and replace the source file with its own output.

### 6.7 Threading

**Rewritten 2026-09-23 (Phase B.5).** The original text said the main thread
was fine, because "the stepped resize of a 12 MP image takes tens of
milliseconds". That reasoning was sound *for resize alone* and did not
survive the target-size search, which is up to eight full encodes of a
full-size canvas. Measured with a MessageChannel ping-pong probe, against an
idle baseline of 0 ms median / 9 ms longest:

| Source | Longest single stall | Total blocked | Share of the search |
|---|---|---|---|
| 1600x1200, 1.9 MP | 72 ms | 127 ms | 1% |
| 4000x3000, 12 MP | **480 ms** | 3,582 ms | 31% |
| 6000x4000, 24 MP | **1,000 ms** | 6,865 ms | 46% |

A 12 MP phone photo — the commonest large input there is — sat on the 500 ms
line per stall. So the pipeline moved off the main thread.

**Shape.** `createImageBitmap` on the main thread, transfer the bitmap to the
worker, `OffscreenCanvas` there, resize and encode and search all off-thread,
post back a `Blob`.

`resize.ts`, `encode.ts` and `compress.ts` are **not forked**. The only DOM
they touched was creating a canvas and `toBlob`, both of which moved behind
`surface.ts`; the worker imports the same modules the fallback does. A second
copy of the stepped-downscale loop is exactly the kind of thing that drifts
into a silent quality regression.

**Bitmap ownership: resident in the worker, addressed by id.** Transferring
neuters the sender's reference, so the main thread cannot keep one. The
alternative — re-decoding per job — would put a full `createImageBitmap` of a
24 MP JPEG on every debounced keystroke, which is the cost this change exists
to remove, reintroduced at a worse cadence. `SourceImage.bitmap` is therefore
`SourceImage.imageId`.

The **load-before-release** guarantee (6.2) now spans the boundary: the worker
acknowledges an `adopt` before `adoptBitmap` resolves, and the caller releases
the previous image only after that. A failed load leaves the previous image
whole and still usable — 14 checks that it can still be resized, not merely
that it is still on screen.

**One request counter**, moved from the hook into `client.ts` so a superseded
reply is dropped before it crosses back. `beginRequest()` also posts a cancel,
and the search re-reads it **between attempts** — each attempt awaits an
encode, which yields, which is what lets the message land mid-search.
Cancellation is a `SEARCH_CANCELLED` sentinel with no `kind` field, because
`{ kind: 'cancelled' }` would have passed `isAppError` and been rendered to
the user as a failure.

Errors cross as the `AppError` union — plain objects that structured-clone.
An `Error` instance does not survive `postMessage` intact.

**Fallback.** `OffscreenCanvas` is the real requirement; detected once at
module load, never per job. Without it, `client.ts` calls the same three
functions inline. Same correctness, same bytes, no worker chunk fetched.

Show the processing state regardless — the work still takes seconds, it just
no longer takes the UI with it.

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

**`useImagePipeline(source)`** (named `useResize` before Phase B) owns: `settings: ResizeSettings`, `compress: CompressSettings`, `result: ResizeResult | null`, `compressOutcome`, `isProcessing`, `isSearching`. Exposes `setWidth`, `setHeight`, `setPercentage`, `applyPreset`, `toggleLock`, `reset`, `setQuality`, `setCompressMode`, `setTargetValue`, `setTargetUnit`, `resetCompress`, `runTargetSearch`.

There is ONE request-id counter, shared by the debounced path and the explicit target-size search. Two counters cannot order each other: a debounced resize that started before a search and finished after it would still match its own id and overwrite the search's result.

Aspect-lock behaviour: when `lockAspect` is true and width changes, `height = round(width / sourceAspect)` and vice versa. Compute from the **source** aspect ratio, never from the current field values — otherwise rounding drift accumulates as the user types.

Flow: `idle → loading → ready → (processing ⇄ ready) → downloaded`. There is no separate "apply" step. Changing a setting updates the result after the debounce; the download button is always live once a result exists.

---

## 9. Interface

### 9.1 Design direction

The subject is measurement — dimensions, ratios, exact pixels. The visual language borrows from drafting and technical drawing, not from generic SaaS. The image sits on a light measured surface; the chrome around it stays quiet so the photo is the only thing with colour in the layout.

**Tokens** (define as CSS custom properties in `index.css`, consume via Tailwind):

**Amended 2026-09-23.** The values below replace the original set, which was a
grey-on-grey scheme; the palette is now white/black with one blue, and there are
two of them.

```
                 LIGHT (:root)   DARK ([data-theme="dark"])
--paper:         #FFFFFF         #0B0D10    /* page background */
--surface:       #F5F7F9         #14181D    /* panels, canvas backdrop */
--ink:           #000000         #F2F4F7    /* primary text */
--ink-muted:     #4A5260         #9AA3AF    /* secondary text, units, hints */
--rule:          #D6DBE1         #262C34    /* borders, dividers, ruler ticks */
--accent:        #1B4FD8         #4C7DFF    /* active state, primary action */
--accent-ink:    #0A3099         #6B95FF    /* hover/active only */
--danger:        #B3261E         #FF6B61    /* error text and borders only */
--on-accent:     #FFFFFF         #0B0D10    /* label ON --accent */
```

Three things about this that are not arbitrary:

- `--accent` **lightens** in dark mode. #1B4FD8 on #0B0D10 is 1.46:1 — not a dim
  blue, an invisible one.
- `--on-accent` exists because white is not a safe label colour on the lightened
  accent: #FFF on #4C7DFF is 3.69:1, below AA. Near-black on it is 5.27:1. The
  download button reads this token; it does not hardcode white.
- `--danger` lightens for the same reason (#B3261E on the dark paper is 2.98:1).

**Dark mode** (was "out of scope for v1", reinstated 2026-09-23). Tokens only — no
component has a `dark:` variant and no component reads the theme. Three selectors:
`:root` for light, `:root[data-theme="dark"]`, and
`@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`. The toggle
cycles light → dark → system and persists to `localStorage` under `downsize-theme`.

A **blocking inline script** at the top of `<head>`, before any stylesheet and not a
module, reads that key and sets `data-theme` before first paint. It duplicates the
key name and the two paper colours from `hooks/useTheme.ts`; that duplication is
deliberate and unavoidable — it has to run before the bundle exists.

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

**Motion.** The original line here — "one transition only, no entrance animations" —
was written for the tool alone, before there was a page around it. Amended
2026-09-23. The complete list now lives as a comment block in `index.css`; nothing
animates that is not on it. In summary: a 300ms page-load fade in three 80ms steps,
the 150ms preview cross-fade, 120ms colour changes on focus/hover/selection, the
footer name, scroll reveals on the static article, and one typing line.

Rules that the scroll reveals are bound by, because they are what separates this
from a template:

- Every element is fully present and readable in the HTML. Animation is opacity and
  transform only — never `display: none`, never `visibility: hidden`, never text
  injected by JS.
- The default state is **visible**. No stylesheet rule hides a reveal target. JS adds
  the class that makes one animatable, and only to elements below the fold at that
  moment — so a JS failure, or a crawler, gets the whole page.
- Nothing above the fold animates. The H1 and the tool are the LCP candidates.
- `prefers-reduced-motion: reduce` means the scripts do nothing at all.

Typing applies to exactly one line, under the H1, and nowhere else.

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
<meta name="robots" content="index,follow" />
<meta name="author" content="Hammad Minhas" />
<link rel="canonical" href="%VITE_SITE_URL%/" />
<meta name="theme-color" content="#FFFFFF" />

<meta property="og:type" content="website" />
<meta property="og:url" content="%VITE_SITE_URL%/" />
<meta property="og:title" content="Downsize — Resize images in your browser" />
<meta property="og:description" content="Resize JPG, PNG and WEBP without uploading. Everything happens on your device." />
<meta property="og:image" content="%VITE_SITE_URL%/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
```

Title stays under ~60 characters of visible weight; description 150–160. Lead the title with the search phrase people actually type ("resize an image online"), brand last.

**Site URL is an environment value, never a hardcoded string** *(amended 2026-09-23)*

Every absolute URL the page advertises — canonical, `og:url`, `og:image`, the `url` field in the WebApplication JSON-LD, `robots.txt`'s `Sitemap:` line and `sitemap.xml`'s `<loc>` — is derived from a single value, substituted at build time via Vite's `%VITE_SITE_URL%` HTML replacement. `robots.txt` and `sitemap.xml` are generated by a plugin in `vite.config.ts` rather than sitting in `public/`, because Vite copies `public/` verbatim and a hardcoded domain in either file would survive the build and contradict the canonical.

Resolution order (`resolveSiteUrl()` in `vite.config.ts`): `VITE_SITE_URL` → `VERCEL_PROJECT_PRODUCTION_URL` → committed fallback. Deliberately **not** `VERCEL_URL`, which is the per-deployment hash URL and changes on every push.

**Switch this to the real domain the day it goes live, and nowhere else.**

The failure mode this exists to prevent, which shipped once: the canonical read `https://downsizeimage.com/` while the build was served from a Vercel alpha domain. That domain is live and serves an unrelated image tool, so the tag was telling search engines the canonical version of this page was **a different company's product** — handing over the ranking signal — and every `og:image` share resolved against their domain. A canonical for a domain this build is not served from is worse than no canonical at all.

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

**Amended 2026-09-23.** `_headers` is GENERATED by the Vite plugin into the
output root, not committed in `public/`. It has to contain a SHA-256 of the
inline theme script, and a hand-written file cannot carry a hash of
something that changes.

Two things the original block below got wrong, both of which would have
shipped silently:

- `script-src 'self'` **blocks the inline theme script**, which sets
  `data-theme` before first paint and adds the `.js` class that gates the
  `#root` height reservation. Losing it means a flash of the wrong theme
  AND the return of the 0.558 CLS. Static hosting has no nonce, so the
  script is allow-listed by hash.
- The hash must be computed over **LF-normalised** content. The HTML parser
  normalises a script element's text before hashing, so a CRLF checkout
  hashes to something else. That fails on Windows and passes on
  Cloudflare's Linux builder — or the reverse, depending on who builds.

`worker-src 'self'` was also missing; the pipeline worker needs it.

The original text, for reference — `public/_headers`:

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

**Conversion**
- [ ] The format list contains only formats this browser can actually ENCODE,
      verified by the returned `blob.type` rather than assumed
- [ ] **On a browser that encodes WEBP, the list contains all three formats.**
      `auditEncodableFormats()` cross-checks the probe against `toDataURL`, an
      independent canvas API, and must return an empty array. The probe's
      failure mode is invisible by eye — a missing format looks like a
      browser limitation, not a bug — so this is asserted, not noticed. It
      also logs loudly in dev
- [ ] axe runs on the **Convert tab**, not only Resize and Compress. The
      colour swatches and `<input type="color">` are control primitives that
      appear nowhere else in the app
- [ ] The swatch borders clear 3:1 (1.4.11). A white swatch on `--paper` in
      light theme is a white square on a near-white background — the border
      is the only thing that makes it a visible control, in both themes
- [ ] The source's own format is not offered twice — "Keep original (PNG)"
      already is that option
- [ ] An OPAQUE PNG converted to JPG shows no transparency warning at all.
      This is the point of detecting rather than assuming
- [ ] A TRANSPARENT PNG converted to JPG shows the warning and the fill
      control, and changing the fill colour changes the output bytes
- [ ] A JPG source never triggers an alpha scan in any direction
- [ ] Converting to PNG turns the quality control off; converting to JPG or
      WEBP turns it on. Keyed off the OUTPUT format, never the source
- [ ] The download extension follows the output format
- [ ] "Keep original" still passes through byte-identically, and selecting a
      format and then going back to "Keep original" returns to pass-through

**Compression**
- [ ] **Loading an image and changing nothing produces a byte-identical download
      to the source file.** Verify with a hash, not a size — two different
      encodes of the same picture can land on the same byte count. Added
      2026-09-23: the default quality re-encoded an already-compressed JPEG
      and announced "File is 22% bigger", which is damage reported as work.
      When the dimensions are unchanged, the quality is still at the default
      and no target search has run, the result IS the source file (§6.10).
- [ ] Touching width, height, a preset or the quality slider resumes normal
      encoding; Reset on either panel returns to pass-through
- [ ] A target search always produces its own encode, even when it lands on
      the default quality
- [ ] A 3 MB JPEG targeting 500 KB lands at or under 500 KB in ≤8 attempts
- [ ] Re-encoding the same canvas at the reported quality reproduces the byte
      count exactly, and the next point up overshoots (so it really was the
      highest quality that fits, not merely one that fits)
- [ ] An unreachable target returns `reachable: false` and the UI says so in
      plain words, naming both numbers
- [ ] A PNG shows the note, offers no quality control at all, and survives
      tab switching
- [ ] Resize and compress compose: one output reflecting both, one result
      object, one download. Switching tabs discards neither tab's settings
- [ ] Typing in the target field starts no search — verified by counting
      `HTMLCanvasElement.prototype.toBlob` calls, not by watching the UI
- [ ] The debounced path and the button path share ONE request-id counter.
      Two counters cannot order each other, and a slow debounced resize
      landing after a search would silently overwrite it

**Validation**
- [ ] A `.pdf` renamed to `.jpg` is rejected with `decode-failed`
- [ ] A 40 MB file is rejected before decoding
- [ ] Typing `0`, a negative number, or `999999` in a field clamps on blur without crashing

**Quality**
- [ ] A 4000px → 300px downscale shows no jagged aliasing (stepped path confirmed)

**Interface**
- [ ] Full keyboard path: focus dropzone → open picker → edit width → download
- [ ] Layout holds at 320px width with no horizontal scroll
- [ ] axe is clean WITH A FILE LOADED, not just on the empty state. FileCard
      only exists once an image is open, and a nested-interactive violation
      hid in it through six phases of empty-state-only scans
- [ ] Rapid slider dragging never freezes the UI
- [ ] Reduced-motion preference removes the cross-fade

**Theme**
- [ ] Hard reload with dark stored shows no white frame before paint
- [ ] The choice survives a reload, and an explicit light beats a dark OS
- [ ] System mode follows the OS setting with no reload
- [ ] `--rule-strong` clears 3:1 against BOTH `--paper` and `--surface` in both
      themes (WCAG 1.4.11), and every border on something clickable, typable or
      droppable uses it rather than `--rule`
- [ ] Every text/background pair passes WCAG AA in BOTH themes — measured from the
      rendered page, not from the token list, and with transitions disabled first
      (a frozen mid-transition colour reads as a failure that is not there)

**Motion**
- [ ] With JS blocked, nothing in the article is below opacity 1
- [ ] With `prefers-reduced-motion`, no element is transformed and the typing line
      sits on its first word
- [ ] `scrollWidth === clientWidth` at 360/390/414/768/1024/1440 with every
      horizontally-translated block held at full displacement, not just at rest
- [ ] Table reveals animate the `<td>`s. A `<tr>` silently ignores both `opacity`
      and `transform`, so arming rows animates nothing and looks correct in a
      screenshot

**Threading**
- [ ] An 8-attempt search on a 24 MP image keeps the main thread near its idle
      baseline; type in the width field while it runs and every keystroke lands
- [ ] Superseding a search stops it early — the replacement lands in roughly
      one attempt's time, not after the remaining seven
- [ ] Superseding a search also CLEARS its spinner. A search superseded by
      anything that is not another search used to leave the Compress button
      disabled and spinning for the rest of the session
- [ ] A failed load leaves the previous image usable, not merely visible:
      resize it afterwards and check the output actually changes
- [ ] Force the OffscreenCanvas detect false and run this whole list again.
      `surface instanceof OffscreenCanvas` throws when the global is absent,
      which broke the fallback in exactly the browsers it exists for — and
      silently, because it rejected on a path that does not return AppError

**Layout stability**
- [ ] **`#root` reserves the tool's exact height before React mounts; verify with
      JS enabled AND disabled.** Added as a standing regression note 2026-09-23
      after this went unnoticed through six phases. It will come back the next
      time the tool's empty-state height changes — the dropzone's min-height,
      the section padding, or the navbar — because nothing about editing those
      points at the reservation in `index.css`. Check it whenever any of them
      move.
- [ ] `#root`'s reserved min-height equals the rendered empty-state height
      exactly, at 320/360/390/414/640/768/1024/1440. It ships empty with `<main>`
      after it, so any mismatch shoves the whole article down when the bundle
      mounts — measured at CLS 0.558 before it was reserved, and it scores 0
      whenever the bundle happens to win the race, so one clean run proves
      nothing. Run Lighthouse more than once.
- [ ] With scripting off the reservation is absent (it is gated on the `.js`
      class), so there is no unexplained gap where the tool would be

**Content**
- [ ] Every FAQ answer appears in the FAQPage JSON-LD, matching the on-page text
- [ ] The preset table's DIMENSIONS match `lib/presets.ts` (the names deliberately
      differ: the tool shortens them, the table spells them out)
- [ ] Each nav anchor id exists in `index.html`

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
5. Build `useImagePipeline` + `ResizeControls` + `SizeComparison` + `DownloadBar`. The core loop now works.
6. Add `PresetGrid`.
7. Add `ImageCanvas` with the ruler-tick frame, `Header`. (Amended 2026-09-23:
   dropped `Footer` — the footer was listed in both §4 and §11.3.6, and only
   §11.3.6 is coherent: it's static HTML written in step 8, and React never
   touches that markup per §11.1. A React `Footer.tsx` had no job left.)
8. Write the static SEO content, head tags, JSON-LD, `robots.txt`, `sitemap.xml`, `og-image.png`.
9. Generate `_headers` from the build (§12), deploy to Cloudflare Pages.
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
