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
// hidden <input type=file> and click-to-open are the same mechanics as
// Dropzone, and onReplace is literally useImageFile's load(). That's what
// keeps the load-before-release guarantee intact here without
// reimplementing it. The X is the only way back to the empty state.
//
// TWO SIBLING BUTTONS, not a role="button" card with a button inside it.
//
// The card used to be a div with role="button" and tabIndex 0 wrapping the
// X — the same nested-interactive anti-pattern that was removed from
// Dropzone, still sitting here because every axe run up to now happened on
// the empty state, where this component does not exist. A screen reader
// met one control and found another inside it; the outer aria-label also
// failed Label in Name, since "click to choose a different image" does not
// contain the filename that is the visible text.
//
// Now the thumbnail and the text are one real button and the X is its
// sibling. The accessible name is the visible text plus an sr-only phrase
// saying what pressing it does, so the name contains what is on screen
// rather than replacing it. stopPropagation on the X goes away with the
// nesting that needed it.
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

  return (
    // The frame is what says this cluster is operable, so --rule-strong,
    // even though the div itself is now inert. Losing the line would lose
    // the boundary, which is the test.
    <div className="flex items-center gap-1 border border-rule-strong p-2">
      <button
        type="button"
        onClick={openPicker}
        className="focus-ring flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        {isLoading ? (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-rule bg-surface">
            <Spinner className="h-5 w-5 text-ink-muted" />
          </div>
        ) : (
          <img src={source.previewUrl} alt="" className="h-12 w-12 shrink-0 border border-rule object-cover" />
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate text-body text-ink">{source.file.name}</span>
          <span className="block truncate font-mono text-caption text-ink-muted">
            {formatDimensions(source.width, source.height)} · {formatBytes(source.bytes)}
          </span>
        </span>

        {/* Appended, not substituted: WCAG 2.5.3 wants the accessible name
            to contain the visible text, so the filename stays in the name
            and this explains the action. */}
        <span className="sr-only">— choose a different image</span>
      </button>

      <button
        type="button"
        aria-label="Remove image"
        onClick={onClear}
        // 44x44 touch target; the icon stays 16px.
        className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center text-ink-muted transition-colors duration-[120ms] hover:text-ink"
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
