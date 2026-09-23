import ImageCanvas from './ImageCanvas';
import FileCard from './FileCard';
import SizeComparison from './SizeComparison';
import ResizeControls from './ResizeControls';
import PresetGrid from './PresetGrid';
import DownloadBar from './DownloadBar';
import FileError from '../upload/FileError';
import type { Preset } from '../../lib/presets';
import type { AppError, ResizeResult, ResizeSettings, SourceImage } from '../../types';

interface WorkspaceProps {
  source: SourceImage;
  settings: ResizeSettings;
  result: ResizeResult | null;
  isProcessing: boolean;
  isLoading: boolean;
  fileError: AppError | null;
  resizeError: AppError | null;
  onReplace: (file: File) => void;
  onClear: () => void;
  setWidth: (value: number) => void;
  setHeight: (value: number) => void;
  setPercentage: (value: number) => void;
  setMode: (mode: 'dimensions' | 'percentage') => void;
  toggleLock: () => void;
  reset: () => void;
  applyPreset: (preset: Preset) => void;
}

// Preview left (~62%), controls right (~38%). The controls column reads as
// one panel — a left border and internal padding at desktop, its sections
// separated by full-width rules — rather than a stack of floating widgets
// or a set of separately bordered boxes.
//
// No lg:items-start on the row: the default flex `stretch` is what makes
// both columns take the height of the taller one, so the panel's left
// border runs the full height of the workspace rather than stopping
// wherever its own content happens to end.
function Workspace({
  source,
  settings,
  result,
  isProcessing,
  isLoading,
  fileError,
  resizeError,
  onReplace,
  onClear,
  setWidth,
  setHeight,
  setPercentage,
  setMode,
  toggleLock,
  reset,
  applyPreset,
}: WorkspaceProps) {
  const displayed = result ?? source;

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <div className="min-w-0 lg:w-[62%]">
        <ImageCanvas
          src={displayed.previewUrl}
          width={displayed.width}
          height={displayed.height}
          sourceWidth={source.width}
          sourceHeight={source.height}
          sourceBytes={source.bytes}
          isProcessing={isProcessing}
        />
        <FileError error={resizeError} />
      </div>

      <div className="flex min-w-0 flex-col lg:w-[38%] lg:border-l lg:border-rule lg:pl-8">
        <div className="pb-6">
          <FileCard source={source} isLoading={isLoading} onReplace={onReplace} onClear={onClear} />
          <FileError error={fileError} />
        </div>

        <div className="border-t border-rule py-6">
          <ResizeControls
            settings={settings}
            setWidth={setWidth}
            setHeight={setHeight}
            setPercentage={setPercentage}
            setMode={setMode}
            toggleLock={toggleLock}
            reset={reset}
          />
        </div>

        <div className="border-t border-rule py-6">
          <PresetGrid presetId={settings.presetId} onApply={applyPreset} />
        </div>

        <div className="border-t border-rule pt-6">
          <div className="pb-4">
            <SizeComparison source={source} result={result} />
          </div>
          {/* pb keeps the button clear of the iOS home indicator when it is
              stuck to the bottom of the viewport; env() resolves to 0 on
              every device that does not have one. */}
          <div
            className="sticky bottom-0 bg-paper lg:static"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <DownloadBar source={source} result={result} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Workspace;
