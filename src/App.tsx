import { useState, useCallback, useEffect } from 'react';
import EnvironmentGraph from '@/components/EnvironmentGraph';
import Continuation from '@/components/ContinuationStack';
import CodeEditor from '@/components/CodeEditor';
import * as debuggerApi from '@/services/debuggerApi';
import type { ProgramState } from '@/types/state';
import { ReactFlowProvider } from 'reactflow';

// Shadcn UI Components
import { Button } from "@/components/ui/button"; // Adjust path if needed
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Adjust path
import { X } from 'lucide-react'; // Icon for alert close

// Default sample code (remains the same)
const defaultCode = `
x = 10
y = 5

def add(a, b):
  res = a + b
  return res

z = add(x, y)

w = x + 5
`;

// getErrorMessage function (remains the same)
function getErrorMessage(error: unknown): string {
  // ... (keep existing implementation)
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

type HistoryEntry = {
  state: ProgramState;
  finished: boolean;
};

function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [stateHistory, setStateHistory] = useState<HistoryEntry[]>([]);
  const [currentStateIndex, setCurrentStateIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string>(defaultCode);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);

  const currentDisplayData = stateHistory[currentStateIndex] ?? null;
  const currentProgramState = currentDisplayData?.state ?? null;
  const isCurrentStateFinished = currentDisplayData?.finished ?? false;
  const currentLine = currentProgramState?.k?.[currentProgramState.k.length - 1]?.lineno;

  const handleCreateSession = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    setStateHistory([]);
    setCurrentStateIndex(-1);
    setSessionId(null);
    setIsSessionActive(false);
    try {
      const response = await debuggerApi.createSession(code);
      const initialHistoryEntry: HistoryEntry = {
        state: response.initial_state,
        finished: false
      };
      setSessionId(response.session_id);
      setStateHistory([initialHistoryEntry]);
      setCurrentStateIndex(0);
      setIsSessionActive(true);
    } catch (err: unknown) {
      console.error("Failed to create session:", err);
      setError(getErrorMessage(err));
      setIsSessionActive(false);
      setStateHistory([]);
      setCurrentStateIndex(-1);
    } finally {
      setIsLoading(false);
    }
  }, [code]);

  const handleStepForward = useCallback(async () => {
    if (!sessionId || !isSessionActive || isLoading || isCurrentStateFinished) return;
    setError(null);
    const nextIndex = currentStateIndex + 1;
    if (nextIndex < stateHistory.length) {
      setCurrentStateIndex(nextIndex);
      console.log("Using cached state for step forward");
    } else {
      setIsLoading(true);
      try {
        const response = await debuggerApi.stepProgram(sessionId);
        const newHistoryEntry: HistoryEntry = {
          state: response.state,
          finished: response.finished
        };
        const updatedHistory = stateHistory.slice(0, currentStateIndex + 1);
        setStateHistory([...updatedHistory, newHistoryEntry]);
        setCurrentStateIndex(updatedHistory.length);
        if (response.finished) {
          console.log("Program finished execution.");
        }
      } catch (err: unknown) {
        console.error("Failed to step program:", err);
        setError(getErrorMessage(err));
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

  const handleReset = useCallback(() => {
    setError(null);
    setIsLoading(false);
    setStateHistory([]);
    setCurrentStateIndex(-1);
    setIsSessionActive(false);
    if (sessionId) {
      const sessionToClean = sessionId;
      setSessionId(null);
      debuggerApi.deleteSession(sessionToClean).catch((err) => {
        console.warn("Silent background deletion of session failed:", err);
      });
    }
  }, [sessionId]);

  useEffect(() => {
    const sessionToClean = sessionId;
    return () => {
      if (sessionToClean) {
        console.log(`Cleaning up session ${sessionToClean} on unmount`);
        debuggerApi.deleteSession(sessionToClean).catch(() => { });
      }
    };
  }, [sessionId]);

  const canStepForward = isSessionActive && !isLoading && !isCurrentStateFinished;
  const canStepBack = isSessionActive && !isLoading && currentStateIndex > 0;
  const canReset = (isSessionActive || stateHistory.length > 0 || error) && !isLoading;
  const canStart = !isLoading && !isSessionActive;

  return (
    <ReactFlowProvider>
      {/* Main container with dark background and padding */}
      <div className="flex flex-col h-screen p-4 bg-background text-foreground gap-4">
        {/* Top Controls */}
        <div className="flex items-center gap-2 flex-wrap"> {/* Reduced gap */}
          <Button
            onClick={handleCreateSession}
            disabled={!canStart || isLoading} // Simplified disabled logic slightly
            variant="secondary" // Use secondary for start
            size="sm" // Smaller buttons
          >
            {isLoading && !isSessionActive ? 'Starting...' : 'Start Session'}
          </Button>

          <Button
            onClick={handleStepBack}
            disabled={!canStepBack || isLoading}
            variant="outline" // Outline for less emphasis
            size="sm"
          >
            Step Back
          </Button>

          <Button
            onClick={handleStepForward}
            disabled={!canStepForward || isLoading}
            variant="default" // Default/Primary for the main action
            size="sm"
          >
            {isLoading && isSessionActive ? 'Stepping...' : 'Step Forward'}
          </Button>

          <Button
            onClick={handleReset}
            disabled={!canReset || isLoading}
            variant="destructive" // Destructive for reset
            size="sm"
          >
            Reset & Edit
          </Button>

          <div className="flex-grow"></div> {/* Pushes status text to the right */}

          {/* Status indicators */}
          <div className='flex items-center gap-4 text-xs text-muted-foreground'>
            {sessionId && isSessionActive && (
              <span>Session: {sessionId.substring(0, 6)}... (Step {currentStateIndex + 1}/{stateHistory.length})</span>
            )}
            {isCurrentStateFinished && (
              <span className="font-semibold text-green-400">✓ Finished</span>
            )}
          </div>
        </div>

        {/* Error Display using Shadcn Alert */}
        {error && (
          <Alert variant="destructive" className="relative">
            {/* Optional Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6"
              onClick={() => setError(null)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close error</span>
            </Button>
            {/* <AlertCircle className="h-4 w-4" /> */} {/* Icon included by default */}
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error}
              <span className="ml-2 text-muted-foreground">(Use Step Back or Reset)</span>
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content Area */}
        <div className="flex-grow flex gap-4 overflow-hidden">
          {/* Left Panel: Code Editor */}
          <div className="w-1/3 h-full flex flex-col"> {/* Added flex flex-col */}
            <p className="text-xs text-muted-foreground mb-1">Code Editor</p>
            <div className="flex-grow h-0"> {/* Allow editor to take remaining space */}
              <CodeEditor
                code={code}
                onChange={(value) => setCode(value || '')}
                readOnly={isSessionActive || isLoading}
                currentLine={isSessionActive ? currentLine : undefined}
              />
            </div>
          </div>

          {/* Right Panel: State Visualizations */}
          <div className="w-2/3 h-full flex flex-col gap-4">
            {/* Top Right: Environment Graph */}
            <div className="flex-1 h-2/3 flex flex-col overflow-hidden"> {/* Added flex flex-col */}
              <p className="text-xs text-muted-foreground mb-1">Environment Graph</p>
              <div className="flex-grow h-0 border border-border rounded-md bg-card"> {/* Allow graph to take space, add border/bg */}
                {currentProgramState ? (
                  <EnvironmentGraph
                    environments={currentProgramState.e}
                    parentChain={currentProgramState.p}
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground italic">
                    {isSessionActive ? 'Loading state...' : 'Start session to view environment'}
                  </div>
                )}
              </div>
            </div>
            {/* Bottom Right: Continuation Stack */}
            <div className="flex-1 h-1/3 flex flex-col overflow-hidden"> {/* Added flex flex-col */}
              <p className="text-xs text-muted-foreground mb-1">Continuation</p>
              <div className="flex-grow h-0"> {/* Allow stack to take remaining space */}
                {currentProgramState?.k ? (
                  <Continuation continuation={currentProgramState.k} />
                ) : (
                  <div className="h-full w-full border border-border rounded-md bg-card flex items-center justify-center text-muted-foreground italic">
                    {isSessionActive ? 'Loading stack...' : 'Start session to view stack'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ReactFlowProvider>
  );
}

export default App;