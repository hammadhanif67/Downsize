import { useCallback, useEffect, useRef, useState } from 'react';
import { encode, supportsQuality } from '../lib/image/encode';
import { encodeToTarget } from '../lib/image/compress';
import { resize } from '../lib/image/resize';
import { DEFAULT_QUALITY, RESIZE_DEBOUNCE_MS } from '../lib/constants';
import { clampPercentage, isAppError, resolveTargetSize } from '../lib/validation';
import type { Preset } from '../lib/presets';
import type {
  AppError,
  CompressMode,
  CompressOutcome,
  CompressSettings,
  ResizeResult,
  ResizeSettings,
  SizeUnit,
  SourceImage,
} from '../types';

function defaultSettingsFor(source: SourceImage): ResizeSettings {
  return {
    mode: 'dimensions',
    width: source.width,
    height: source.height,
    lockAspect: true,
    percentage: 100,
    presetId: null,
  };
}

const EMPTY_SETTINGS: ResizeSettings = {
  mode: 'dimensions',
  width: 0,
  height: 0,
  lockAspect: true,
  percentage: 100,
  presetId: null,
};

const DEFAULT_COMPRESS: CompressSettings = {
  mode: 'quality',
  quality: DEFAULT_QUALITY,
  targetValue: 500,
  targetUnit: 'KB',
};

const BYTES_PER: Record<SizeUnit, number> = { KB: 1024, MB: 1024 * 1024 };

export function targetBytesOf(compress: CompressSettings): number {
  return Math.round(compress.targetValue * BYTES_PER[compress.targetUnit]);
}

// What a given output is: dimensions plus the quality it was encoded at.
// The debounced effect compares this against what it last produced and
// skips if nothing that affects the bytes has changed — so toggling Lock
// ratio, or a target search writing its found quality back into settings,
// does not trigger a redundant full encode.
function signatureOf(width: number, height: number, quality: number | undefined): string {
  return `${width}x${height}@${quality ?? 'default'}`;
}

export interface UseResizeResult {
  settings: ResizeSettings;
  compress: CompressSettings;
  result: ResizeResult | null;
  // Describes the last target-size search, or null if the current output
  // did not come from one. Cleared as soon as anything else regenerates
  // the output, so the attempt count on screen never describes a blob
  // that has since been replaced.
  compressOutcome: CompressOutcome | null;
  // False for PNG. Lossless, no quality axis — the panel says so rather
  // than offering a slider that does nothing.
  canCompress: boolean;
  isProcessing: boolean;
  isSearching: boolean;
  // Not in the spec's literal §8 list, but encode() can genuinely fail
  // (canvas.toBlob returning null), and that has to surface somewhere.
  error: AppError | null;
  setWidth: (value: number) => void;
  setHeight: (value: number) => void;
  setPercentage: (value: number) => void;
  // Explicit mode switch (the "Exact size" / "Percentage" radios). Seeds
  // the target mode from what the source mode currently implies, so
  // switching never jumps the output out from under the user.
  setMode: (mode: 'dimensions' | 'percentage') => void;
  toggleLock: () => void;
  reset: () => void;
  applyPreset: (preset: Preset) => void;
  setQuality: (quality: number) => void;
  setCompressMode: (mode: CompressMode) => void;
  setTargetValue: (value: number) => void;
  setTargetUnit: (unit: SizeUnit) => void;
  resetCompress: () => void;
  // Explicit press only — never debounced. A search is up to eight full
  // encodes, and running that per keystroke is abusive on a large image.
  runTargetSearch: () => void;
}

// Settings state + debounced processing (spec §8). Holds the same
// load-before-release discipline as useImageFile: a new result only ever
// replaces the previous one once it has successfully finished encoding.
export function useResize(source: SourceImage | null): UseResizeResult {
  const [settings, setSettings] = useState<ResizeSettings>(EMPTY_SETTINGS);
  const [compress, setCompress] = useState<CompressSettings>(DEFAULT_COMPRESS);
  const [result, setResult] = useState<ResizeResult | null>(null);
  const [compressOutcome, setCompressOutcome] = useState<CompressOutcome | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const canCompress = source !== null && supportsQuality(source.mime);
  // PNG has no quality axis, so it is not merely that the slider is
  // disabled — nothing downstream is allowed to pass a quality at all.
  const effectiveQuality = canCompress ? compress.quality : undefined;

  // Bumped only when a debounced resize actually STARTS (inside the
  // setTimeout below), not on every settings change. A plain debounce
  // already coalesces a fast-typing burst into one call via clearTimeout;
  // this id exists for a different case — two separate debounce windows
  // whose async encode() calls finish out of order (e.g. a large image from
  // an earlier edit is still encoding when a smaller, faster one from a
  // later edit finishes first). Whichever result lands, only the one whose
  // id still matches when its encode resolves is allowed to commit.
  //
  // The target-size search shares this counter rather than keeping its
  // own. Two counters cannot order each other: a debounced resize that
  // started before a search and finished after it would still match its
  // own id and quietly overwrite the search's result. One counter means
  // whichever request started last is the only one allowed to commit,
  // whichever path it came from.
  const requestIdRef = useRef(0);

  // The signature of the output currently on screen. See signatureOf.
  const lastSignatureRef = useRef<string | null>(null);

  const latestResultRef = useRef<ResizeResult | null>(null);
  useEffect(() => {
    latestResultRef.current = result;
  }, [result]);
  useEffect(() => {
    return () => {
      if (latestResultRef.current) URL.revokeObjectURL(latestResultRef.current.previewUrl);
    };
  }, []);

  // A genuinely new (or cleared) source: reset settings to it and drop any
  // result — that result belongs to whatever image was showing before, and
  // must not linger even for the ~250ms it'd take the effect below to
  // naturally replace it. (The settings-reset here also makes the effect
  // below re-run with the new source's dimensions almost immediately after;
  // see the comment on that effect for why the one brief mismatched pass
  // in between is harmless.)
  useEffect(() => {
    setSettings(source ? defaultSettingsFor(source) : EMPTY_SETTINGS);
    setCompress(DEFAULT_COMPRESS);
    setCompressOutcome(null);
    lastSignatureRef.current = null;
    setError(null);
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, [source]);

  // Debounced regeneration (spec §6.8): wait 250ms of quiet before actually
  // resizing. clearTimeout in the cleanup means only the LAST settings
  // change in a fast burst (e.g. typing "1280" digit by digit) ever starts
  // a resize at all — the other three renders' timers never fire.
  //
  // One easy-to-miss detail: this effect's dependency list includes
  // `source`, and so does the settings-reset effect above. When a new image
  // loads, both effects re-run in the same pass — this one first, still
  // holding the PREVIOUS image's settings paired with the NEW source. That
  // pairing is momentarily wrong, but harmless: the settings-reset effect
  // runs right after (same render pass) and calls setSettings, which
  // changes this effect's own dependency and makes React clean up (clear)
  // the stale timer this instance just started, before it ever fires.
  useEffect(() => {
    if (!source) return;

    const timeoutId = window.setTimeout(async () => {
      const { width, height } = resolveTargetSize(settings, source.width, source.height);
      const signature = signatureOf(width, height, effectiveQuality);

      // Nothing that affects the bytes has changed. Toggling Lock ratio,
      // or a target search writing its found quality back into settings,
      // both land here — and a full re-encode of a large canvas to
      // produce a blob identical to the one already on screen is pure
      // waste. Checked here rather than in the dependency list because
      // the deps are settings objects and this is about their RESULT.
      if (signature === lastSignatureRef.current) return;

      const requestId = ++requestIdRef.current;
      setIsProcessing(true);

      const { canvas } = resize(source.bitmap, width, height);
      const encoded = await encode(canvas, source.mime, effectiveQuality);

      // Superseded by a newer request that started while this one was
      // still encoding — discard rather than showing stale output. The
      // newer request may be another debounce or a target search; both
      // bump the same counter.
      if (requestId !== requestIdRef.current) return;

      setIsProcessing(false);

      if (isAppError(encoded)) {
        setError(encoded);
        return;
      }

      setError(null);
      lastSignatureRef.current = signature;
      // This output was not produced by a search, so any outcome note on
      // screen describes a blob that no longer exists.
      setCompressOutcome(null);
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.previewUrl);
        return {
          blob: encoded,
          width,
          height,
          bytes: encoded.size,
          previewUrl: URL.createObjectURL(encoded),
        };
      });
    }, RESIZE_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
    // compress.mode, targetValue and targetUnit are deliberately absent:
    // none of them changes the bytes, and listing them would make typing
    // in the target field start an encode — the exact thing the explicit
    // button exists to avoid.
  }, [settings, effectiveQuality, source]);

  // Raw setters — no clamping here on purpose (spec §9.3: clamp on blur,
  // not on keystroke). Aspect-lock derives the paired axis from the
  // SOURCE's ratio every time, never from the current field values, so
  // rounding never compounds across a typing session (spec §8).
  const setWidth = useCallback(
    (width: number) => {
      setSettings((prev) => {
        const next: ResizeSettings = { ...prev, width, mode: 'dimensions', presetId: null };
        if (prev.lockAspect && source) {
          next.height = Math.round(width / (source.width / source.height));
        }
        return next;
      });
    },
    [source],
  );

  const setHeight = useCallback(
    (height: number) => {
      setSettings((prev) => {
        const next: ResizeSettings = { ...prev, height, mode: 'dimensions', presetId: null };
        if (prev.lockAspect && source) {
          next.width = Math.round(height * (source.width / source.height));
        }
        return next;
      });
    },
    [source],
  );

  const setPercentage = useCallback((percentage: number) => {
    setSettings((prev) => ({ ...prev, percentage, mode: 'percentage', presetId: null }));
  }, []);

  // The "Exact size" / "Percentage" radios (spec ruling: explicit, visible
  // states — not an inferred "whichever field you touched last"). Each
  // switch seeds the target mode's controls from what the SOURCE mode
  // currently implies, so neither direction jumps the output:
  // dimensions→percentage reads the current width as a share of the
  // source; percentage→dimensions reads what the current percentage
  // resolves to in pixels.
  const setMode = useCallback(
    (mode: 'dimensions' | 'percentage') => {
      setSettings((prev) => {
        if (prev.mode === mode) return prev;
        if (!source) return { ...prev, mode, presetId: null };

        if (mode === 'percentage') {
          const percentage = clampPercentage(Math.round((prev.width / source.width) * 100));
          return { ...prev, mode, percentage, presetId: null };
        }

        const { width, height } = resolveTargetSize(prev, source.width, source.height);
        return { ...prev, mode, width, height, presetId: null };
      });
    },
    [source],
  );

  const toggleLock = useCallback(() => {
    setSettings((prev) => ({ ...prev, lockAspect: !prev.lockAspect }));
  }, []);

  const reset = useCallback(() => {
    if (!source) return;
    setSettings(defaultSettingsFor(source));
  }, [source]);

  // Fixed-dimension presets set mode to 'dimensions'; scale presets (Half
  // size, Quarter size) set mode to 'percentage' — presets never introduce
  // a third radio state, they just drive one of the two that already
  // exist. A null height (width-driven presets like "Blog body") derives
  // the other axis from the source ratio, same as typing width with the
  // lock on.
  const applyPreset = useCallback(
    (preset: Preset) => {
      if (!source) return;
      setSettings((prev) => {
        if (preset.kind === 'scale') {
          return { ...prev, mode: 'percentage', percentage: preset.percentage, presetId: preset.id };
        }
        const width = preset.width;
        const height = preset.height ?? Math.round(width / (source.width / source.height));
        return { ...prev, mode: 'dimensions', width, height, presetId: preset.id };
      });
    },
    [source],
  );

  // ---- compression ----------------------------------------------------

  const setQuality = useCallback((quality: number) => {
    setCompress((prev) => ({ ...prev, quality }));
    // Clear immediately rather than waiting for the debounce to commit:
    // otherwise the "found at quality 64 in 5 attempts" note sits there
    // for 250ms describing an output the slider has already moved off.
    setCompressOutcome(null);
  }, []);

  const setCompressMode = useCallback((mode: CompressMode) => {
    // Switching modes changes nothing about the output — the quality in
    // force stays in force, and the target value the user typed is still
    // there when they come back. Target size is a way of choosing the
    // quality, not a second competing setting.
    setCompress((prev) => (prev.mode === mode ? prev : { ...prev, mode }));
  }, []);

  const setTargetValue = useCallback((targetValue: number) => {
    setCompress((prev) => ({ ...prev, targetValue }));
  }, []);

  const setTargetUnit = useCallback((targetUnit: SizeUnit) => {
    setCompress((prev) => ({ ...prev, targetUnit }));
  }, []);

  const resetCompress = useCallback(() => {
    setCompress(DEFAULT_COMPRESS);
    setCompressOutcome(null);
  }, []);

  // Runs on an explicit press. Same request counter as the debounced path,
  // so whichever started last wins regardless of which finishes first.
  const runTargetSearch = useCallback(() => {
    if (!source || !supportsQuality(source.mime)) return;

    const requestId = ++requestIdRef.current;
    setIsSearching(true);

    void (async () => {
      const { width, height } = resolveTargetSize(settings, source.width, source.height);
      const { canvas } = resize(source.bitmap, width, height);
      const targetBytes = targetBytesOf(compress);
      const found = await encodeToTarget(canvas, source.mime, targetBytes);

      if (requestId !== requestIdRef.current) return;
      setIsSearching(false);

      if (isAppError(found)) {
        setError(found);
        return;
      }

      setError(null);
      // Write the answer back into the one quality the app has. The
      // signature is stored first so the effect this setCompress is about
      // to wake sees its work already done and returns without re-encoding.
      lastSignatureRef.current = signatureOf(width, height, found.quality);
      setCompress((prev) => ({ ...prev, quality: found.quality }));
      setCompressOutcome({
        quality: found.quality,
        attempts: found.attempts,
        reachable: found.reachable,
        targetBytes,
        bytes: found.blob.size,
      });
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.previewUrl);
        return {
          blob: found.blob,
          width,
          height,
          bytes: found.blob.size,
          previewUrl: URL.createObjectURL(found.blob),
        };
      });
    })();
  }, [compress, settings, source]);

  return {
    settings,
    compress,
    result,
    compressOutcome,
    canCompress,
    isProcessing,
    isSearching,
    error,
    setWidth,
    setHeight,
    setPercentage,
    setMode,
    toggleLock,
    reset,
    applyPreset,
    setQuality,
    setCompressMode,
    setTargetValue,
    setTargetUnit,
    resetCompress,
    runTargetSearch,
  };
}
