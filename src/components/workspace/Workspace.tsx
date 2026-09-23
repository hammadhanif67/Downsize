import { useState } from 'react';
import ImageCanvas from './ImageCanvas';
import FileCard from './FileCard';
import SizeComparison from './SizeComparison';
import ResizeControls from './ResizeControls';
import PresetGrid from './PresetGrid';
import DownloadBar from './DownloadBar';
import CompressControls from './CompressControls';
import ToolTabs, { panelId, tabId, type Tool } from './ToolTabs';
import FileError from '../upload/FileError';
import type { Preset } from '../../lib/presets';
import type {
  AppError,
  CompressMode,
  CompressOutcome,
  CompressSettings,
  ResizeResult,
  ResizeSettings,
  SizeUnit,
  SourceImage,
} from '../../types';

interface WorkspaceProps {
  source: SourceImage;
  settings: ResizeSettings;
  compress: CompressSettings;
  result: ResizeResult | null;
  compressOutcome: CompressOutcome | null;
  canCompress: boolean;
  isProcessing: boolean;
  isSearching: boolean;
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
  setQuality: (quality: number) => void;
  setCompressMode: (mode: CompressMode) => void;
  setTargetValue: (value: number) => void;
  setTargetUnit: (unit: SizeUnit) => void;
  resetCompress: () => void;
  runTargetSearch: () => void;
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
  compress,
  result,
  compressOutcome,
  canCompress,
  isProcessing,
  isSearching,
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
  setQuality,
  setCompressMode,
  setTargetValue,
  setTargetUnit,
  resetCompress,
  runTargetSearch,
}: WorkspaceProps) {
  // Which tool's settings are showing. Local to the workspace on purpose:
  // it is a view choice, not part of the output. Neither panel's settings
  // live in here, so switching tabs cannot discard either of them — they
  // are both held in the hook the whole time, and the single result always
  // reflects both.
  const [tool, setTool] = useState<Tool>('resize');
  const displayed = result ?? source;
  const busy = isProcessing || isSearching;

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
          isProcessing={busy}
        />
        <FileError error={resizeError} />
      </div>

      <div className="flex min-w-0 flex-col lg:w-[38%] lg:border-l lg:border-rule lg:pl-8">
        <div className="pb-6">
          <FileCard source={source} isLoading={isLoading} onReplace={onReplace} onClear={onClear} />
          <FileError error={fileError} />
        </div>

        {/* The tabs head the settings, not the whole column: they switch
            what is below them and nothing else. FileCard describes the
            loaded file and applies to both tools, so it stays above —
            putting it inside the tab region would imply it were
            tool-scoped. On a phone, where the column is stacked under the
            preview, this still reads as preview → file → tabs → settings. */}
        <div className="border-t border-rule pt-2">
          <ToolTabs active={tool} onChange={setTool} />
        </div>

        {tool === 'resize' ? (
          <>
            <div role="tabpanel" id={panelId('resize')} aria-labelledby={tabId('resize')} className="py-6">
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
          </>
        ) : (
          <div role="tabpanel" id={panelId('compress')} aria-labelledby={tabId('compress')} className="py-6">
            <CompressControls
              compress={compress}
              result={result}
              outcome={compressOutcome}
              canCompress={canCompress}
              isSearching={isSearching}
              setQuality={setQuality}
              setCompressMode={setCompressMode}
              setTargetValue={setTargetValue}
              setTargetUnit={setTargetUnit}
              resetCompress={resetCompress}
              runTargetSearch={runTargetSearch}
            />
          </div>
        )}

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
