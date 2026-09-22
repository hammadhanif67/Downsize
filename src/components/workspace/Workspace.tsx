import ImageCanvas from './ImageCanvas';
import SizeComparison from './SizeComparison';
import ToolTabs from './ToolTabs';
import ResizeControls from './ResizeControls';
import DownloadBar from './DownloadBar';
import FileError from '../upload/FileError';
import type { AppError, ResizeResult, ResizeSettings, SourceImage } from '../../types';

interface WorkspaceProps {
  source: SourceImage;
  settings: ResizeSettings;
  result: ResizeResult | null;
  isProcessing: boolean;
  resizeError: AppError | null;
  setWidth: (value: number) => void;
  setHeight: (value: number) => void;
  setPercentage: (value: number) => void;
  setMode: (mode: 'dimensions' | 'percentage') => void;
  toggleLock: () => void;
  reset: () => void;
}

// Center column (spec, Phase A restructure). Presets and the file picker
// moved out to the sidebar; this is preview + tools + result now. Three
// flat bordered boxes — image, tabs+panel, before/after+download — 0
// radius, no shadow, not a "card kit": each border is either separating
// two things or is a real frame, same discipline as everywhere else.
//
// The before/after box renders unconditionally (once source exists), not
// gated on `result` — gating it would make the WHOLE box pop into
// existence the moment the first debounced resize finishes, which is
// itself a layout shift. Rendering it early with an empty "After" slot
// avoids that; SizeComparison handles the null-result state internally.
function Workspace({
  source,
  settings,
  result,
  isProcessing,
  resizeError,
  setWidth,
  setHeight,
  setPercentage,
  setMode,
  toggleLock,
  reset,
}: WorkspaceProps) {
  const displayed = result ?? source;

  return (
    <div className="flex flex-col gap-8">
      <div>
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

      <div className="border border-rule">
        <ToolTabs />
        <div id="panel-resize" role="tabpanel" aria-labelledby="tab-resize" className="p-6">
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
      </div>

      <div className="border border-rule">
        <div className="p-6">
          <SizeComparison source={source} result={result} />
        </div>
        {/* Sticky to the viewport bottom below 1024px (spec). Stays inside
            this box's own width rather than bleeding full-width — Box 3
            has a real left/right border now (it didn't before this phase),
            and escaping past it while stuck would visually cut through its
            own frame. Desktop drops back to plain static flow, no sticky. */}
        <div className="sticky bottom-0 border-t border-rule bg-paper p-4 sm:p-6 lg:static lg:p-6">
          <DownloadBar source={source} result={result} />
        </div>
      </div>
    </div>
  );
}

export default Workspace;
