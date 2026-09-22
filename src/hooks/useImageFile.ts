import { useCallback, useEffect, useRef, useState } from 'react';
import { loadImage, releaseSourceImage } from '../lib/image/load';
import { isAppError } from '../lib/validation';
import type { AppError, SourceImage } from '../types';

export interface UseImageFileResult {
  source: SourceImage | null;
  error: AppError | null;
  isLoading: boolean;
  // Resolves true/false rather than void so a caller driving UI around it
  // (e.g. closing a "pick a different image" panel) can tell success from
  // failure without re-deriving it from error state on the next render.
  load: (file: File) => Promise<boolean>;
  clear: () => void;
}

// Loads, validates, and holds the source image (spec §8). Owns all
// revoking/closing — no other module touches a SourceImage's lifetime.
export function useImageFile(): UseImageFileResult {
  const [source, setSource] = useState<SourceImage | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Only for the unmount-cleanup effect below — synced via its own effect
  // (never mutated during render) so it always names whichever image is
  // actually live if this hook unmounts while one is loaded.
  const latestSourceRef = useRef<SourceImage | null>(null);
  useEffect(() => {
    latestSourceRef.current = source;
  }, [source]);
  useEffect(() => {
    return () => {
      if (latestSourceRef.current) releaseSourceImage(latestSourceRef.current);
    };
  }, []);

  const load = useCallback(async (file: File): Promise<boolean> => {
    setIsLoading(true);
    const result = await loadImage(file);
    setIsLoading(false);

    if (isAppError(result)) {
      // A failed load must never touch the image already showing — only
      // the error state changes; the current source is left untouched.
      setError(result);
      return false;
    }

    setError(null);
    // The functional updater is what makes this safe: it always sees the
    // truly-current source at the moment of the swap, not a value captured
    // in this callback's own closure, so the image released here is always
    // exactly the one being replaced — new image loads first, old image
    // releases only once the new one is confirmed good.
    setSource((prev) => {
      if (prev) releaseSourceImage(prev);
      return result;
    });
    return true;
  }, []);

  const clear = useCallback(() => {
    setSource((prev) => {
      if (prev) releaseSourceImage(prev);
      return null;
    });
    setError(null);
  }, []);

  return { source, error, isLoading, load, clear };
}
