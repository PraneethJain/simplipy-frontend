import { useState, useCallback, useEffect } from 'react';
import EnvironmentGraph from './components/EnvironmentGraph';
import ContinuationStack from './components/ContinuationStack';
import CodeEditor from './components/CodeEditor';
import * as debuggerApi from './services/debuggerApi';
import type { ProgramState } from './types/state';
import { ReactFlowProvider } from 'reactflow';

// Default sample code
const defaultCode = `
x = 10
y = 5

def add(a, b):
  res = a + b
  return res

z = add(x, y)

w = x + 5
`;

function getErrorMessage(error: unknown): string {
  const defaultMessage = 'An unexpected error occurred. Check console for details.';
  if (typeof error === 'object' && error !== null) {
    const errObj = error as { response?: { data?: { detail?: string } }, message?: string };
    if (typeof errObj.response?.data?.detail === 'string' && errObj.response.data.detail.trim() !== '') {
      return errObj.response.data.detail;
    }
    if (typeof errObj.message === 'string' && errObj.message.trim() !== '') {
      return errObj.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim() !== '') {
    return error;
  }
  return defaultMessage;
}

// Define a type for items in our history
type HistoryEntry = {
  state: ProgramState;
  finished: boolean;
};

function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  // NEW: Store history of states
  const [stateHistory, setStateHistory] = useState<HistoryEntry[]>([]);
  // NEW: Index of the currently viewed state in the history
  const [currentStateIndex, setCurrentStateIndex] = useState<number>(-1);
  // --- Remove old programState and isFinished state ---
  // const [programState, setProgramState] = useState<ProgramState | null>(null);
  // const [isFinished, setIsFinished] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string>(defaultCode);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);

  // DERIVED STATE: Get the current state data based on the index
  const currentDisplayData = stateHistory[currentStateIndex] ?? null;
  const currentProgramState = currentDisplayData?.state ?? null;
  const isCurrentStateFinished = currentDisplayData?.finished ?? false;

  // Get current line from the derived state
  const currentLine = currentProgramState?.k?.[currentProgramState.k.length - 1]?.lineno;


  const handleCreateSession = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    // setIsFinished(false); // Removed
    // setProgramState(null); // Removed
    setStateHistory([]); // Clear history
    setCurrentStateIndex(-1); // Reset index
    setSessionId(null);
    setIsSessionActive(false);
    try {
      const response = await debuggerApi.createSession(code);
      const initialHistoryEntry: HistoryEntry = {
        state: response.initial_state,
        finished: false // Initial state is never finished
      };
      setSessionId(response.session_id);
      setStateHistory([initialHistoryEntry]); // Start history with the initial state
      setCurrentStateIndex(0); // Point to the first state
      setIsSessionActive(true);
    } catch (err: unknown) {
      console.error("Failed to create session:", err);
      setError(getErrorMessage(err));
      setIsSessionActive(false); // Ensure session is not marked active on failure
      setStateHistory([]); // Clear history on error too
      setCurrentStateIndex(-1);
    } finally {
      setIsLoading(false);
    }
  }, [code]);

  // Renamed from handleStep to handleStepForward for clarity
  const handleStepForward = useCallback(async () => {
    // Ensure session is active, not loading, and the *current* state isn't the finished one
    if (!sessionId || !isSessionActive || isLoading || isCurrentStateFinished) return;

    setError(null);

    // Check if we are stepping into a state we already have in history
    const nextIndex = currentStateIndex + 1;
    if (nextIndex < stateHistory.length) {
      // We have this state cached, just move the pointer
      setCurrentStateIndex(nextIndex);
      console.log("Using cached state for step forward");
    } else {
      // We need to fetch the next state from the API
      setIsLoading(true);
      try {
        const response = await debuggerApi.stepProgram(sessionId);
        const newHistoryEntry: HistoryEntry = {
          state: response.state,
          finished: response.finished
        };

        // IMPORTANT: If we stepped back previously, the history beyond the current point is now invalid.
        // Truncate the history before adding the new state.
        const updatedHistory = stateHistory.slice(0, currentStateIndex + 1);

        setStateHistory([...updatedHistory, newHistoryEntry]);
        setCurrentStateIndex(updatedHistory.length); // Index of the newly added state

        if (response.finished) {
          console.log("Program finished execution.");
        }
      } catch (err: unknown) {
        console.error("Failed to step program:", err);
        setError(getErrorMessage(err));
        // Optional: Stop session on error?
        // setIsSessionActive(false);
      } finally {
        setIsLoading(false);
      }
    }
  }, [sessionId, isSessionActive, isLoading, currentStateIndex, stateHistory, isCurrentStateFinished]); // Added dependencies

  // NEW: Handler for stepping back
  const handleStepBack = useCallback(() => {
    if (!isSessionActive || isLoading || currentStateIndex <= 0) return; // Can't go back from index 0 or less
    setError(null); // Clear errors when navigating
    setCurrentStateIndex(prevIndex => prevIndex - 1);
    console.log("Stepped back using cached state");
  }, [isSessionActive, isLoading, currentStateIndex]);

  const handleReset = useCallback(() => {
    setError(null);
    setIsLoading(false); // Stop loading if reset is clicked
    // setIsFinished(false); // Removed
    setStateHistory([]);
    setCurrentStateIndex(-1);
    // setProgramState(null); // Removed
    setIsSessionActive(false); // Session is no longer active

    if (sessionId) {
      const sessionToClean = sessionId;
      setSessionId(null); // Clear session ID from UI immediately
      // Trigger background cleanup
      debuggerApi.deleteSession(sessionToClean).catch((err) => {
        console.warn("Silent background deletion of session failed:", err);
      });
    }
  }, [sessionId]); // Keep sessionId dependency for cleanup


  // Cleanup session on unmount
  useEffect(() => {
    const sessionToClean = sessionId;
    return () => {
      if (sessionToClean) {
        console.log(`Cleaning up session ${sessionToClean} on unmount`);
        debuggerApi.deleteSession(sessionToClean).catch(() => { });
      }
    };
  }, [sessionId]);

  // Determine button disabled states based on new logic
  const canStepForward = isSessionActive && !isLoading && !isCurrentStateFinished;
  const canStepBack = isSessionActive && !isLoading && currentStateIndex > 0;
  const canReset = (isSessionActive || stateHistory.length > 0 || error) && !isLoading; // Can reset if session active, or history exists, or error exists, but not while loading
  const canStart = !isLoading && !isSessionActive; // Can start if not loading and no active session

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen p-4 bg-gray-100 gap-4">
        {/* Top Controls */}
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={handleCreateSession}
            disabled={!canStart}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            {isLoading && !isSessionActive ? 'Starting...' : 'Start Debug Session'}
          </button>
          {/* NEW Step Back Button */}
          <button
            onClick={handleStepBack}
            disabled={!canStepBack}
            className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            Step Back
          </button>
          {/* Renamed Step -> Step Forward */}
          <button
            onClick={handleStepForward}
            disabled={!canStepForward}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            {isLoading && isSessionActive ? 'Stepping...' : 'Step Forward'}
          </button>
          <button
            onClick={handleReset}
            disabled={!canReset}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            Reset & Edit Code
          </button>

          {sessionId && isSessionActive && <span className="text-sm text-gray-600">Session ID: {sessionId} (Step {currentStateIndex + 1} of {stateHistory.length})</span>}
          {/* Show finished message based on the *current* state's finished flag */}
          {isCurrentStateFinished && <span className="text-sm font-semibold text-green-700">Execution Finished (Use Step Back or Reset)</span>}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded relative" role="alert">
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline"> {error}</span>
            <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-2">
              <span className="text-red-500 text-xl">×</span>
            </button>
            <span className="text-sm ml-2 text-red-600">(Use Step Back or Reset)</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-grow flex gap-4 overflow-hidden">
          {/* Left Panel: Code Editor */}
          <div className="w-1/3 h-full">
            <CodeEditor
              code={code}
              onChange={(value) => setCode(value || '')}
              // Editor is read-only if a session is active OR something is loading
              readOnly={isSessionActive || isLoading}
              // Highlight line based on the *current* state in history
              currentLine={isSessionActive ? currentLine : undefined}
            />
          </div>

          {/* Right Panel: State Visualizations */}
          <div className="w-2/3 h-full flex flex-col gap-4">
            {/* Top Right: Environment Graph */}
            <div className="flex-1 h-2/3 overflow-hidden">
              {/* Display based on currentProgramState */}
              {currentProgramState ? (
                <EnvironmentGraph
                  environments={currentProgramState.e}
                  parentChain={currentProgramState.p}
                />
              ) : (
                <div className="h-full w-full border border-gray-300 rounded bg-gray-50 flex items-center justify-center text-gray-500 italic">
                  {isSessionActive ? 'Loading state...' : 'Environment Graph (Start session to view)'}
                </div>
              )}
            </div>
            {/* Bottom Right: Continuation Stack */}
            <div className="flex-1 h-1/3 overflow-hidden">
              {/* Display based on currentProgramState */}
              {currentProgramState?.k ? (
                <ContinuationStack continuation={currentProgramState.k} />
              ) : (
                <div className="h-full w-full border border-gray-300 rounded bg-white p-3 shadow-sm flex items-center justify-center text-gray-500 italic">
                  {isSessionActive ? 'Loading stack...' : 'Continuation Stack (Start session to view)'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ReactFlowProvider>
  );
}

export default App;