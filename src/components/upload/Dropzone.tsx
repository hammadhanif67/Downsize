import { ImageUp } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ACCEPTED_MIMES } from '../../lib/constants';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { FILE_ERROR_ID } from './FileError';

interface DropzoneProps {
  onFileSelected: (file: File) => void;
  isLoading: boolean;
}

function Dropzone({ onFileSelected, isLoading }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // A counter, not a boolean (spec §9.2 MUST): dragging over a child element
  // fires dragleave on the parent before dragenter on the child, so a
  // boolean flag flickers the highlight off mid-drag over any nested
  // content. The counter only reaches zero when the pointer has actually
  // left every nested element, not just one of them.
  const dragCounterRef = useRef(0);
  const [isDragActive, setIsDragActive] = useState(false);

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  // Window-level so a paste anywhere on the page works, not just while the
  // dropzone itself has focus (spec §9.2 MUST).
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const file = e.clipboardData?.files?.[0];
      if (file) onFileSelected(file);
    }
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onFileSelected]);

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDragActive(true);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault(); // required or onDrop never fires
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelected(file);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); // Space must not also scroll the page
      openPicker();
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (file) onFileSelected(file);
  }

  // The primary action of the page and the first thing anyone sees, so
  // this is the one element allowed to carry colour: accent icon at rest,
  // solid accent border on hover, and a 2px border over a 6% accent tint
  // while a file is actually over it. Still zero radius, no shadow, no
  // gradient — and no transition, because the agreed motion list does not
  // include one here.
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Drop an image to resize, or choose a file"
      aria-describedby={FILE_ERROR_ID}
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`focus-ring flex cursor-pointer flex-col items-center gap-3 px-6 py-16 text-center ${
        isDragActive
          ? 'border-2 border-solid border-accent bg-accent/[0.06]'
          : 'border border-dashed border-rule bg-surface hover:border-solid hover:border-accent hover:bg-paper'
      }`}
    >
      {isLoading ? (
        <>
          <Spinner className="h-8 w-8 text-ink-muted" />
          <p className="text-body text-ink-muted">Opening image</p>
        </>
      ) : (
        <>
          <ImageUp aria-hidden="true" className="h-8 w-8 text-accent" />
          <h3 className="text-h3 font-medium text-ink">Drop an image to resize</h3>
          <p className="text-body text-ink-muted">JPG, PNG or WEBP · up to 30 MB · nothing leaves your device</p>
          <Button
            onClick={(e) => {
              // Without this the click bubbles to the div above and fires
              // openPicker twice — harmless, but this keeps it to one call.
              e.stopPropagation();
              openPicker();
            }}
          >
            Choose file
          </Button>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIMES.join(',')}
        onChange={handleInputChange}
        className="sr-only"
        aria-label="Choose an image file"
      />
    </div>
  );
}

export default Dropzone;
