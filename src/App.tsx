import Header from './components/layout/Header';
import Sidebar from './components/sidebar/Sidebar';
import Workspace from './components/workspace/Workspace';
import { useImageFile } from './hooks/useImageFile';
import { useResize } from './hooks/useResize';

// Phase A (spec §2): layout restructure, no new features. Resize stays the
// only working tool; the shell exists so Compress/Convert/AI have a real
// place to land later without another rebuild. Left sidebar fixed 320px
// with a right border running the FULL container height (no lg:items-start
// on the row below — default flex stretch is what makes both columns equal
// height, same reasoning as the panel-border fix from the previous phase).
// Below 1024px the sidebar stacks above the workspace and its border moves
// from right to bottom.
function App() {
  const { source, error: fileError, isLoading, load, clear } = useImageFile();
  const {
    settings,
    result,
    isProcessing,
    error: resizeError,
    setWidth,
    setHeight,
    setPercentage,
    setMode,
    toggleLock,
    reset,
    applyPreset,
  } = useResize(source);

  return (
    <div className="min-h-dvh bg-paper">
      <Header />
      <main className="mx-auto flex max-w-[1240px] flex-col px-4 py-10 sm:px-6 lg:flex-row">
        <div className="border-b border-rule pb-8 lg:w-80 lg:shrink-0 lg:border-r lg:border-b-0 lg:pr-8 lg:pb-0">
          <Sidebar
            source={source}
            isLoading={isLoading}
            fileError={fileError}
            onFileSelected={load}
            onClear={clear}
            presetId={settings.presetId}
            onApplyPreset={applyPreset}
          />
        </div>

        {source && (
          <div className="min-w-0 flex-1 pt-8 lg:pt-0 lg:pl-8">
            <Workspace
              source={source}
              settings={settings}
              result={result}
              isProcessing={isProcessing}
              resizeError={resizeError}
              setWidth={setWidth}
              setHeight={setHeight}
              setPercentage={setPercentage}
              setMode={setMode}
              toggleLock={toggleLock}
              reset={reset}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
