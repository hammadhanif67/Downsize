import { MAX_FILENAME_LENGTH } from '../constants';
import type { SupportedMime } from '../../types';

const EXTENSION_BY_MIME: Record<SupportedMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function sanitizeName(name: string): string {
  const cleaned = name
    .replace(/[/\\]/g, '') // path separators
    .replace(/[\x00-\x1F\x7F]/g, '') // control characters
    .trim()
    .replace(/\s+/g, '-');
  return cleaned.slice(0, MAX_FILENAME_LENGTH) || 'image';
}

// `beach-photo-1280x720.jpg` (§6.6). The 60-char cap applies to the
// sanitized original name only, not the full filename.
export function buildFilename(originalName: string, width: number, height: number, mime: SupportedMime): string {
  return `${sanitizeName(originalName)}-${width}x${height}.${EXTENSION_BY_MIME[mime]}`;
}

// Creates its own object URL and revokes it on the next tick — the anchor
// only needs it long enough to start the download.
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
