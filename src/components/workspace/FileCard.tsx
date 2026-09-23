import { X } from 'lucide-react';
import { useCallback, useRef } from 'react';
import { ACCEPTED_MIMES } from '../../lib/constants';
import { formatBytes, formatDimensions } from '../../lib/format';
import Spinner from '../ui/Spinner';
import type { SourceImage } from '../../types';

interface FileCardProps {
  source: SourceImage;
  isLoading: boolean;
  onReplace: (file: File) => void;
  onClear: () => void;
}

// Summarizes the loaded file and doubles as the "replace" trigger — the
// whole card is a real <input type=file> trigger, same mechanics as
// Dropzone (hidden input, click-to-open), and onReplace is literally
// useImageFile's load(). That's what keeps the load-before-release
// guarantee intact here without reimplementing it: this component never
// touches source lifetime itself, it just calls the same function Dropzone
// calls. The X is the only way back to the empty state — it calls clear().
//
// Sits at the top of the controls column, replacing the old "Use a
// different image" text link.
function FileCard({ source, isLoading, onReplace, onClear }: FileCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (file) onReplace(file);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPicker();
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${source.file.name} — click to choose a different image`}
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      className="focus-ring flex cursor-pointer items-center gap-3 border border-rule p-2"
    >
      {isLoading ? (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-rule bg-surface">
          <Spinner className="h-5 w-5 text-ink-muted" />
        </div>
      ) : (
        <img src={source.previewUrl} alt="" className="h-12 w-12 shrink-0 border border-rule object-cover" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-body text-ink">{source.file.name}</p>
        <p className="truncate font-mono text-caption text-ink-muted">
          {formatDimensions(source.width, source.height)} · {formatBytes(source.bytes)}
        </p>
      </div>

      <button
        type="button"
        aria-label="Remove image"
        onClick={(e) => {
          // Same reasoning as Dropzone's inner "Choose file" button: without
          // this the click bubbles up and also fires openPicker.
          e.stopPropagation();
          onClear();
        }}
        className="focus-ring shrink-0 p-1 text-ink-muted"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIMES.join(',')}
        onChange={handleInputChange}
        className="sr-only"
        aria-label="Choose a different image file"
      />
    </div>
  );
}

export default FileCard;
