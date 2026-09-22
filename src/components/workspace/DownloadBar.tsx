import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { buildFilename, triggerDownload } from '../../lib/image/download';
import Button from '../ui/Button';
import type { ResizeResult, SourceImage } from '../../types';

const CONFIRMATION_MS = 2000;

interface DownloadBarProps {
  source: SourceImage;
  result: ResizeResult | null;
}

// Live whenever a result exists — no separate "apply" step (spec §8). While
// a newer resize is still processing, `result` still holds the previous
// (valid) output, so this stays enabled and pointing at it the whole time.
//
// No Toast component exists in §4's file tree (a gap in the spec, not
// something to build around) — the confirmation that copy §9.4 calls
// "Image downloaded" happens on the button itself instead: the label swaps
// to "Downloaded" with a check icon for 2s, then reverts.
function DownloadBar({ source, result }: DownloadBarProps) {
  const [justDownloaded, setJustDownloaded] = useState(false);
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => window.clearTimeout(timeoutRef.current);
  }, []);

  function handleDownload() {
    if (!result) return;
    const filename = buildFilename(source.name, result.width, result.height, source.mime);
    triggerDownload(result.blob, filename);

    setJustDownloaded(true);
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setJustDownloaded(false), CONFIRMATION_MS);
  }

  return (
    <Button variant="primary" onClick={handleDownload} disabled={!result} className="flex w-full items-center justify-center">
      {justDownloaded ? (
        <span className="flex items-center gap-2">
          <Check aria-hidden="true" className="h-4 w-4" />
          Downloaded
        </span>
      ) : (
        'Download image'
      )}
    </Button>
  );
}

export default DownloadBar;
