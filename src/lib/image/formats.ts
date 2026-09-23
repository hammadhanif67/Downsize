import { createSurface, surfaceContext, surfaceToBlob } from './surface';
import type { SupportedMime } from '../../types';

export const FORMAT_LABEL: Record<SupportedMime, string> = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
};

export const ALL_FORMATS: SupportedMime[] = ['image/jpeg', 'image/png', 'image/webp'];

// Formats that carry an alpha channel. JPEG does not, which is why
// converting to it is the one direction that can lose information the
// resize pipeline would otherwise preserve.
export function hasAlphaChannel(mime: SupportedMime): boolean {
  return mime !== 'image/jpeg';
}

// Which formats this browser can actually ENCODE.
//
// canvas.toBlob and convertToBlob both fall back to PNG for a type they do
// not support, silently and with no error — so asking for WEBP on a browser
// that can decode but not encode it hands back PNG bytes in a file named
// .webp. The only reliable test is to encode something and look at what
// came back.
//
// One 1x1 encode per format, once, at first use. The result is cached: a
// browser does not gain codecs mid-session.
let cached: Promise<Set<SupportedMime>> | null = null;

async function probe(): Promise<Set<SupportedMime>> {
  const supported = new Set<SupportedMime>();
  const surface = createSurface(1, 1);
  // Getting a context is not optional here. OffscreenCanvas.convertToBlob
  // throws InvalidStateError on a canvas that has never had one, so
  // without this every format failed the probe and the list collapsed to
  // the PNG safety net — which looked exactly like a browser that can only
  // encode PNG.
  surfaceContext(surface);
  for (const mime of ALL_FORMATS) {
    try {
      const blob = await surfaceToBlob(surface, mime, 0.9);
      // The type check is the whole point — a Blob always comes back.
      if (blob && blob.type === mime) supported.add(mime);
    } catch {
      // treated as unsupported
    }
  }
  // PNG is the fallback every canvas implementation has; if the probe
  // somehow found nothing, offering an empty list would be worse than
  // assuming the one format that is guaranteed.
  if (supported.size === 0) supported.add('image/png');
  return supported;
}

export function encodableFormats(): Promise<Set<SupportedMime>> {
  cached ??= probe();
  return cached;
}

// ---------------------------------------------------------------------
// Regression guard for the probe itself.
//
// The probe's failure mode is invisible: a format silently missing from
// the list looks exactly like a legitimate browser limitation, not a bug.
// It shipped that way once — convertToBlob throws InvalidStateError on a
// canvas that has never had a 2D context, so every format failed and the
// list collapsed to the PNG safety net. Nothing errored. The UI just
// quietly offered less.
//
// toDataURL is an INDEPENDENT oracle: a different API on a different
// object, not sharing the code path under test. If it says the browser
// can write WEBP and the probe disagrees, the probe is wrong — a browser
// does not support a format through one canvas API and not the other.
// ---------------------------------------------------------------------
function oracleCanEncode(mime: SupportedMime): boolean {
  if (typeof document === 'undefined') return false; // worker: no oracle, skip
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL(mime).startsWith(`data:${mime}`);
  } catch {
    return false;
  }
}

// Formats the oracle says this browser can encode but the probe missed.
// Empty is the only acceptable answer. Exported so it can be asserted
// from outside as well as checked in dev (§14).
export async function auditEncodableFormats(): Promise<SupportedMime[]> {
  const found = await encodableFormats();
  return ALL_FORMATS.filter((mime) => oracleCanEncode(mime) && !found.has(mime));
}

if (import.meta.env.DEV) {
  void auditEncodableFormats().then((missing) => {
    if (missing.length === 0) return;
    // Not a thrown error: this runs inside an async chain, and throwing
    // here would become an unhandled rejection — which is the same silent
    // failure this guard exists to catch.
    console.error(
      `[downsize] Encode probe is WRONG. This browser can encode ${missing.join(', ')} ` +
        `but encodableFormats() left them out, so the Convert tab is offering less than it should. ` +
        `See probe() in lib/image/formats.ts.`,
    );
  });
}
