import Dropzone from '../upload/Dropzone';
import FileError from '../upload/FileError';
import FileCard from './FileCard';
import PresetGrid from './PresetGrid';
import type { Preset } from '../../lib/presets';
import type { AppError, SourceImage } from '../../types';

interface SidebarProps {
  source: SourceImage | null;
  isLoading: boolean;
  fileError: AppError | null;
  onFileSelected: (file: File) => void;
  onClear: () => void;
  presetId: string | null;
  onApplyPreset: (preset: Preset) => void;
}

// Left column (spec: sidebar, Phase A). Always renders both sections,
// image-loaded or not — this is the shell the later phases (Output format,
// Quality) will eventually add sections 3/4 to, not something that only
// appears once a file exists. "1. Image" swaps Dropzone for FileCard the
// moment a source exists; "Use a different image" as a separate link is
// gone — the card itself is that affordance now (click it, or its own X).
function Sidebar({ source, isLoading, fileError, onFileSelected, onClear, presetId, onApplyPreset }: SidebarProps) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="mb-3 text-caption text-ink-muted">1. Image</h2>
        {source ? (
          <FileCard source={source} isLoading={isLoading} onReplace={onFileSelected} onClear={onClear} />
        ) : (
          <Dropzone onFileSelected={onFileSelected} isLoading={isLoading} />
        )}
        <FileError error={fileError} />
      </div>

      <div>
        <h2 className="mb-3 text-caption text-ink-muted">2. Presets</h2>
        <PresetGrid presetId={presetId} onApply={onApplyPreset} />
      </div>
    </div>
  );
}

export default Sidebar;
