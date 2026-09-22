import { useCallback, useEffect, useRef, useState } from 'react';
import { encode } from '../lib/image/encode';
import { resize } from '../lib/image/resize';
import { RESIZE_DEBOUNCE_MS } from '../lib/constants';
import { clampPercentage, isAppError, resolveTargetSize } from '../lib/validation';
import type { Preset } from '../lib/presets';
import type { AppError, ResizeResult, ResizeSettings, SourceImage } from '../types';

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

export interface UseResizeResult {
  settings: ResizeSettings;
  result: ResizeResult | null;
  isProcessing: boolean;
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
}

// Settings state + debounced processing (spec §8). Holds the same
// load-before-release discipline as useImageFile: a new result only ever
// replaces the previous one once it has successfully finished encoding.
export function useResize(source: SourceImage | null): UseResizeResult {
  const [settings, setSettings] = useState<ResizeSettings>(EMPTY_SETTINGS);
  const [result, setResult] = useState<ResizeResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  // Bumped only when a debounced resize actually STARTS (inside the
  // setTimeout below), not on every settings change. A plain debounce
  // already coalesces a fast-typing burst into one call via clearTimeout;
  // this id exists for a different case — two separate debounce windows
  // whose async encode() calls finish out of order (e.g. a large image from
  // an earlier edit is still encoding when a smaller, faster one from a
  // later edit finishes first). Whichever result lands, only the one whose
  // id still matches when its encode resolves is allowed to commit.
  const requestIdRef = useRef(0);

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
      const requestId = ++requestIdRef.current;
      setIsProcessing(true);

      const { width, height } = resolveTargetSize(settings, source.width, source.height);
      const { canvas } = resize(source.bitmap, width, height);
      const encoded = await encode(canvas, source.mime);

      // Superseded by a newer request that started while this one was
      // still encoding — discard rather than showing stale output.
      if (requestId !== requestIdRef.current) return;

      setIsProcessing(false);

      if (isAppError(encoded)) {
        setError(encoded);
        return;
      }

      setError(null);
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
  }, [settings, source]);

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

  return {
    settings,
    result,
    isProcessing,
    error,
    setWidth,
    setHeight,
    setPercentage,
    setMode,
    toggleLock,
    reset,
    applyPreset,
  };
}
