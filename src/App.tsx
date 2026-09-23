import Header from './components/layout/Header';
import Dropzone from './components/upload/Dropzone';
import FileError from './components/upload/FileError';
import Workspace from './components/workspace/Workspace';
import { useImageFile } from './hooks/useImageFile';
import { useResize } from './hooks/useResize';

// The tool. One job: resize an image. Two-column workspace once a file is
// loaded, dropzone before that.
//
// This wrapper is a plain <div>, not <main> — index.html's static content
// owns the page's single <main> landmark (spec §11.1), and React never
// touches that markup.
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
    <div className="bg-paper">
      <Header />
      {/* Second step of the page-load sequence; the header is first and the
          static article is third (see index.css). Runs once. */}
      <div className="enter enter-2 mx-auto max-w-[1240px] px-4 py-10 sm:px-6">
        {!source && (
          <>
            <Dropzone onFileSelected={load} isLoading={isLoading} />
            <FileError error={fileError} />
          </>
        )}

        {source && (
          <Workspace
            source={source}
            settings={settings}
            result={result}
            isProcessing={isProcessing}
            isLoading={isLoading}
            fileError={fileError}
            resizeError={resizeError}
            onReplace={load}
            onClear={clear}
            setWidth={setWidth}
            setHeight={setHeight}
            setPercentage={setPercentage}
            setMode={setMode}
            toggleLock={toggleLock}
            reset={reset}
            applyPreset={applyPreset}
          />
        )}
      </div>
    </div>
  );
}

export default App;
