import { useState, useCallback, useEffect } from 'react';
import EnvironmentGraph from '@/components/EnvironmentGraph';
import ContinuationStack from '@/components/ContinuationStack'; // Ensure this matches your component file name
import CodeEditor from '@/components/CodeEditor';
import ProgramFlowGraph from '@/components/ProgramFlowGraph'; // CFG Component
import ProgramInfoModal from '@/components/ProgramInfoModal'; // Info Modal Component
import * as debuggerApi from '@/services/debuggerApi'; // API Service (uses named exports)
import { ReactFlowProvider } from 'reactflow'; // Import the Provider itself

// Import Types (adjust paths as needed based on your project structure)
import type { HistoryEntry } from '@/types/state';
import type { SerializedProgram, CtfTable } from '@/types/program';

// Shadcn UI Components & Icons
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { X, Info, PanelLeftClose, PanelRightClose, Wand2, Github, Sun, Moon } from 'lucide-react'; // Added Github icon

// Default sample code
const defaultCode = `
def my_func(a):
    return a * 2

y = 10 + (5 * my_func(2))

x = 1
if x > 0:
    y = 10

while x < 3:
    x = x + 1

def simple_add(a, b):
    c = a + b

z = simple_add(5, 3)
`;

// Utility function to extract error messages
function getErrorMessage(error: unknown): string {
  const defaultMessage = 'An unexpected error occurred. Check console for details.';
  if (typeof error === 'object' && error !== null) {
    // Check for Axios error structure
    const errObj = error as { response?: { data?: { detail?: string } }, message?: string };
    if (typeof errObj.response?.data?.detail === 'string' && errObj.response.data.detail.trim() !== '') {
      return errObj.response.data.detail;
    }
    // Check for standard Error message
    if (typeof errObj.message === 'string' && errObj.message.trim() !== '') {
      return errObj.message;
    }
  }
  // Check for Error instance
  if (error instanceof Error) {
    return error.message;
  }
  // Check for plain string error
  if (typeof error === 'string' && error.trim() !== '') {
    return error;
  }
  return defaultMessage;
}

// --- App Component ---
function App() {
  // --- Core State ---
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [stateHistory, setStateHistory] = useState<HistoryEntry[]>([]);
  const [currentStateIndex, setCurrentStateIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string>(defaultCode);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);

  // --- Static Program Info State ---
  const [programStructure, setProgramStructure] = useState<SerializedProgram | null>(null);
  const [ctfTable, setCtfTable] = useState<CtfTable | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState<boolean>(false);

  // --- UI State ---
  const [showCfg, setShowCfg] = useState<boolean>(false); // Toggle CFG visibility
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') return true;
    if (savedTheme === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // --- Derived State ---
  const currentDisplayData = stateHistory[currentStateIndex] ?? null;
  const currentProgramState = currentDisplayData?.state ?? null;
  const isCurrentStateFinished = currentDisplayData?.finished ?? false;
  const currentLine = currentProgramState?.k?.[currentProgramState.k.length - 1]?.lineno;
  const currentTransition = currentDisplayData?.transition ?? null;

  // --- Callbacks ---
  const handleCreateSession = useCallback(async () => {
    setError(null); setIsLoading(true); setStateHistory([]); setCurrentStateIndex(-1);
    setSessionId(null); setIsSessionActive(false); setProgramStructure(null); setCtfTable(null);
    setShowCfg(false); // Reset UI state
    try {
      const response = await debuggerApi.createSession(code);
      const initialHistoryEntry: HistoryEntry = { state: response.initial_state, finished: false, transition: null };
      setSessionId(response.session_id);
      setStateHistory([initialHistoryEntry]);
      setCurrentStateIndex(0);
      setProgramStructure(response.program_structure);
      setCtfTable(response.ctf_table);
      setIsSessionActive(true);
    } catch (err: unknown) {
      console.error("Failed to create session:", err); setError(getErrorMessage(err));
      // Ensure cleanup on error
      setIsSessionActive(false); setProgramStructure(null); setCtfTable(null);
    } finally {
      setIsLoading(false);
    }
  }, [code]);

  const handleStepForward = useCallback(async () => {
    if (!sessionId || !isSessionActive || isLoading || isCurrentStateFinished) return;
    setError(null);
    const nextIndex = currentStateIndex + 1;

    if (nextIndex < stateHistory.length) {
      // Using cache - no new transition info from backend
      setCurrentStateIndex(nextIndex);
      console.log("Using cached state for step forward");
    } else {
      // Fetching next state
      setIsLoading(true);
      try {
        const response = await debuggerApi.stepProgram(sessionId); // Expects StepResponseData
        const newHistoryEntry: HistoryEntry = { state: response.state, finished: response.finished, transition: response.last_transition ?? null };
        const updatedHistory = stateHistory.slice(0, currentStateIndex + 1);
        setStateHistory([...updatedHistory, newHistoryEntry]);
        setCurrentStateIndex(updatedHistory.length);
        if (response.finished) console.log("Program finished execution.");
      } catch (err: unknown) {
        console.error("Step failed:", err); setError(getErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
  }, [sessionId, isSessionActive, isLoading, currentStateIndex, stateHistory, isCurrentStateFinished]);

  const handleStepBack = useCallback(() => {
    if (!isSessionActive || isLoading || currentStateIndex <= 0) return;
    setError(null);
    setCurrentStateIndex(prevIndex => prevIndex - 1);
    console.log("Stepped back using cached state");
  }, [isSessionActive, isLoading, currentStateIndex]);

  const handleReset = useCallback(async () => {
    setError(null); setIsLoading(true); setStateHistory([]); setCurrentStateIndex(-1);
    setIsSessionActive(false); setProgramStructure(null); setCtfTable(null);
    setShowCfg(false); // Reset UI state

    const sessionToClean = sessionId; setSessionId(null);
    if (sessionToClean) {
      try {
        await debuggerApi.deleteSession(sessionToClean);
        console.log(`Session ${sessionToClean} deleted on reset.`);
      } catch (err) {
        console.warn("Reset/Delete session failed:", err);
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [sessionId]);

  const handleSimplify = useCallback(async () => {
    if (isLoading || isSessionActive || !code) return; // Don't simplify if busy, active session, or no code
    setError(null);
    setIsLoading(true);
    console.log("Attempting to simplify code...");
    try {
      const response = await debuggerApi.simplifyCode(code);
      console.log("Simplification successful:", response);
      setCode(response.simplified_code); // Update the editor content
      // Optionally show a success message briefly?
    } catch (err: unknown) {
      console.error("Simplification failed:", err);
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [code, isLoading, isSessionActive]); // Dependencies: code, isLoading, isSessionActive


  // --- Effect for Session Cleanup on Unmount ---
  useEffect(() => {
    const sessionToClean = sessionId;
    return () => {
      if (sessionToClean) {
        console.log(`Cleaning up session ${sessionToClean} on unmount`);
        debuggerApi.deleteSession(sessionToClean).catch(() => { /* Ignore cleanup errors */ });
      }
    };
  }, [sessionId]);

  // --- Button Disabled States ---
  const canStepForward = isSessionActive && !isLoading && !isCurrentStateFinished;
  const canStepBack = isSessionActive && !isLoading && currentStateIndex > 0;
  const canReset = (isSessionActive || stateHistory.length > 0 || error) && !isLoading;
  const canStart = !isLoading && !isSessionActive;
  const canViewInfo = isSessionActive && !isLoading && !!programStructure && !!ctfTable;
  const canShowCfg = isSessionActive && !!ctfTable; // Can toggle CFG if session active & CTF loaded
  const canSimplify = !isLoading && !isSessionActive && !!code; // Can simplify only when inactive and code exists

  // --- Render ---
  return (
    // No top-level ReactFlowProvider here
    <div className="flex flex-col h-screen p-4 bg-background text-foreground gap-4">
      {/* --- Top Controls --- */}
      <div className="flex items-center gap-2 flex-wrap border-b pb-2 mb-2"> {/* Added border-b and margin */}
        <h1 className="text-xl font-semibold mr-4">SimpliPy</h1> {/* Title */}
        <Button onClick={handleSimplify} disabled={!canSimplify} variant="outline" size="sm" title="Attempt to simplify code for the interpreter">
          <Wand2 className="h-4 w-4 mr-2" />
          {isLoading && !isSessionActive ? 'Simplifying...' : 'Simplify'}
        </Button>
        {/* Debug Buttons */}
        <Button onClick={handleCreateSession} disabled={!canStart || isLoading} variant="secondary" size="sm">
          {isLoading && !isSessionActive ? 'Starting...' : 'Start'}
        </Button>
        <Button onClick={handleStepBack} disabled={!canStepBack || isLoading} variant="outline" size="sm">Back</Button>
        <Button onClick={handleStepForward} disabled={!canStepForward || isLoading} variant="default" size="sm">Forward</Button>
        <Button onClick={handleReset} disabled={!canReset || isLoading} variant="destructive" size="sm">
          {isLoading && canReset ? 'Resetting...' : 'Reset'}
        </Button>

        <div className="flex-grow"></div> {/* Spacer */}

        {/* CFG Toggle Button */}
        <Button
          onClick={() => setShowCfg(prev => !prev)}
          disabled={!canShowCfg || isLoading}
          variant={showCfg ? "secondary" : "outline"} // Indicate active state
          size="sm"
          title={showCfg ? "Hide Control Flow Graph" : "Show Control Flow Graph"}
        >
          {showCfg ? <PanelRightClose className="h-4 w-4 mr-2" /> : <PanelLeftClose className="h-4 w-4 mr-2" />}
          CFG
        </Button>

        {/* Program Info Modal Button */}
        <Button onClick={() => setIsInfoModalOpen(true)} disabled={!canViewInfo} variant="outline" size="sm" title="Show Program Info Modal">
          <Info className="h-4 w-4" />
        </Button>

        <Button
          onClick={() => setIsDarkMode(prev => !prev)}
          variant="outline"
          size="sm"
          aria-label={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Status indicators */}
        <div className='flex items-center gap-4 text-xs text-muted-foreground shrink-0'>
          {sessionId && isSessionActive && (<span>S: {sessionId.substring(0, 6)}.. (Step {currentStateIndex + 1}/{stateHistory.length})</span>)}
          {isCurrentStateFinished && (<span className="font-semibold text-green-400">✓ Finished</span>)}
        </div>
      </div>

      {/* --- Error Display --- */}
      {error && (
        <Alert variant="destructive" className="relative shrink-0">
          <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => setError(null)}>
            <X className="h-4 w-4" /><span className="sr-only">Close error</span>
          </Button>
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}<span className="ml-2 text-muted-foreground">(Use Step Back or Reset)</span></AlertDescription>
        </Alert>
      )}

      {/* --- Main Content Area (Horizontal Layout) --- */}
      <div className="flex-grow flex gap-4 overflow-hidden min-h-0">

        {/* --- Panel 1: Code Editor --- */}
        <div className="h-full flex flex-col transition-all duration-300 w-1/3">
          <p className="text-xs text-muted-foreground mb-1 shrink-0">Code Editor</p>
          <div className="flex-grow h-auto min-h-0 border border-border rounded-md overflow-hidden">
            <CodeEditor
              code={code}
              onChange={(value) => setCode(value || '')}
              theme={isDarkMode ? 'dark' : 'light'}
              readOnly={isSessionActive || isLoading}
              currentLine={isSessionActive ? currentLine : undefined}
            />
          </div>
        </div>

        {/* --- Panel 2: State View (Env + Stack) --- */}
        <div className={`h-full flex flex-col gap-4 overflow-hidden transition-all duration-300 ${showCfg ? 'w-1/3' : 'w-2/3'}`}>
          {/* Environment Graph */}
          <div className={`flex flex-col overflow-hidden flex-1`}>
            <p className="text-xs text-muted-foreground mb-1 shrink-0">Environment Graph</p>
            <div className="flex-grow min-h-0 border border-border rounded-md bg-card">
              {currentProgramState ? (
                // Wrap EnvironmentGraph in its OWN Provider
                <ReactFlowProvider>
                  <EnvironmentGraph environments={currentProgramState.e} parentChain={currentProgramState.p} />
                </ReactFlowProvider>
              ) : (
                <div className="h-full w-full flex items-center justify-center text-muted-foreground italic text-sm">Environment</div>
              )}
            </div>
          </div>
          {/* Continuation Stack */}
          <div className={`flex flex-col overflow-hidden flex-1`}>
            <p className="text-xs text-muted-foreground mb-1 shrink-0">Continuation Stack (k)</p>
            <div className="flex-grow min-h-0 border border-border rounded-md bg-card">
              {currentProgramState?.k ? (
                <ContinuationStack continuation={currentProgramState.k} />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-muted-foreground italic text-sm">Stack</div>
              )}
            </div>
          </div>
        </div>

        {/* --- Panel 3: CFG (Conditional) --- */}
        {showCfg && ctfTable && (
          <div className="w-1/3 h-full flex flex-col transition-all duration-300">
            <p className="text-xs text-muted-foreground mb-1 shrink-0">Control Flow Graph</p>
            <div className="flex-grow min-h-0 border border-border rounded-md bg-card">
              {/* Wrap ProgramFlowGraph in its OWN Provider */}
              <ReactFlowProvider>
                <ProgramFlowGraph
                  ctf={ctfTable}
                  highlightedEdgeInfo={currentTransition}
                  theme={isDarkMode ? 'dark' : 'light'}
                />
              </ReactFlowProvider>
            </div>
          </div>
        )}
        {/* Optional Placeholder */}
        {showCfg && !ctfTable && isLoading && (
          <div className="w-1/2 h-full flex items-center justify-center text-muted-foreground italic">Loading CFG...</div>
        )}

      </div> {/* End Main Content Area */}

      {/* --- Footer --- */}
      <footer className="text-center text-xs text-muted-foreground shrink-0">
        Made with ❤️ by Praneeth Jain |{' '}
        <a
          href="https://www.github.com/PraneethJain"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center hover:text-foreground transition-colors relative top-[2px]"
        >
          <Github className="h-3 w-3 mr-1" />
          GitHub
        </a>
      </footer>

      {/* --- Program Info Modal (Rendered but hidden until opened) --- */}
      {programStructure && ctfTable && (
        <ProgramInfoModal
          isOpen={isInfoModalOpen}
          onClose={() => setIsInfoModalOpen(false)}
          program={programStructure}
          ctf={ctfTable}
        />
      )}
    </div>
  );
}

export default App;