import { AlertCircle } from 'lucide-react';
import type { AppError } from '../../types';

// Shared with Dropzone's aria-describedby so the two stay linked without
// either component needing to know about the other's internals.
export const FILE_ERROR_ID = 'file-error';

// Exact copy per spec §9.5 — never templated, never softened.
const MESSAGES: Record<AppError['kind'], string> = {
  'unsupported-type': "That file type isn't supported. Use a JPG, PNG or WEBP.",
  'too-large': 'That file is over 30 MB. Try a smaller one.',
  'decode-failed': "That image couldn't be opened. It may be damaged.",
  'dimensions-too-large': 'That image is too large to process in the browser.',
  'encode-failed': "The resized image couldn't be created. Try again.",
};

interface FileErrorProps {
  error: AppError | null;
}

function FileError({ error }: FileErrorProps) {
  if (!error) return null;
  return (
    <p id={FILE_ERROR_ID} role="alert" className="mt-3 flex items-center gap-2 text-body text-danger">
      <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
      {MESSAGES[error.kind]}
    </p>
  );
}

export default FileError;
