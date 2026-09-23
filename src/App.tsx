import Navbar from './components/layout/Navbar';
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

  // `relative` is what the navbar's scroll sentinel is positioned against
  // — the sentinel has to sit at document top and stay there while the
  // sticky header travels.
  return (
    <div className="relative bg-paper">
      <Navbar />
      {/* A labelled <section> is a region landmark, so the tool's content
          is inside one without creating a second <main> — index.html's
          static article owns the page's only <main> (spec §11.1).
          Second step of the page-load sequence; the header is first and
          the article third (see index.css). Runs once. */}
      <section
        aria-label="Image resizer"
        className="enter enter-2 mx-auto max-w-[1240px] px-4 py-10 sm:px-6"
      >
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
      </section>
    </div>
  );
}

export default App;
