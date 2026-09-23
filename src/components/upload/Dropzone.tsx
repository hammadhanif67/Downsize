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

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (file) onFileSelected(file);
  }

  // The wrapper is a drop target and nothing else — no role, not focusable,
  // no key handler, no accessible name of its own. "Choose file" is the
  // only control, and it owns the file input, the focus ring and the
  // keyboard path.
  //
  // This is the fix for label-content-name-mismatch at the root. Making the
  // wrapper a role="button" that CONTAINED a heading, a paragraph and a
  // real button meant its accessible name could never contain all of its
  // visible text, so someone driving the page by voice could say a phrase
  // they could plainly see and match nothing. Naming it more carefully
  // only moved the problem around; removing the nested control removes it.
  //
  // Dropping to a target with no role is still fine: drag-and-drop is a
  // pointer interaction, and the keyboard equivalent has always been the
  // button, not a droppable div.
  //
  // Colour: this is the primary action of the page, so it is the one
  // element allowed to carry accent — accent icon at rest, solid accent
  // border on hover, 2px border over a 6% tint while a file is over it.
  // Zero radius, no shadow, no gradient, no transition.
  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col items-center gap-3 px-6 py-16 text-center ${
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
          <Button onClick={openPicker} aria-describedby={FILE_ERROR_ID}>
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
