import React, { useRef, useEffect } from 'react';
import Editor, { Monaco, OnMount } from "@monaco-editor/react";
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';

interface CodeEditorProps {
    code: string;
    onChange: (value: string | undefined) => void;
    language?: string;
    readOnly?: boolean;
    currentLine?: number;
}

// Class name defined in global CSS (e.g., index.css)
const CURRENT_LINE_DECORATION_CLASS = 'current-line-highlight';

const CodeEditor: React.FC<CodeEditorProps> = ({
    code,
    onChange,
    language = "python",
    readOnly = false,
    currentLine
}) => {
    const editorRef = useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<Monaco | null>(null);
    const decorationsRef = useRef<string[]>([]);

    useEffect(() => {
        if (!editorRef.current || !monacoRef.current) {
            return;
        }
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        let newDecorations: monacoEditor.editor.IModelDeltaDecoration[] = [];

        if (typeof currentLine === 'number' && currentLine > 0) {
            // Validate line number against model
            const model = editor.getModel();
            if (model && currentLine <= model.getLineCount()) {
                newDecorations = [
                    {
                        range: new monaco.Range(currentLine, 1, currentLine, model.getLineMaxColumn(currentLine)), // Ensure range covers content
                        options: {
                            isWholeLine: true,
                            className: CURRENT_LINE_DECORATION_CLASS,
                            // Stickiness ensures decoration stays with the line number if edits happen above/below
                            stickiness: monacoEditor.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
                        }
                    }
                ];
            } else {
                console.warn(`Invalid currentLine number: ${currentLine}`);
            }
        }

        // Update decorations
        decorationsRef.current = editor.deltaDecorations(
            decorationsRef.current,
            newDecorations
        );

        // Reveal line only if it's valid
        if (typeof currentLine === 'number' && currentLine > 0 && newDecorations.length > 0) {
            // Use a slight delay for reveal to ensure rendering completes
            setTimeout(() => {
                editor.revealLineInCenterIfOutsideViewport(currentLine, monacoEditor.editor.ScrollType.Smooth);
            }, 50); // 50ms delay, adjust if needed
        }

    }, [currentLine]); // Rerun effect when currentLine changes

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        // Initial highlight application is handled by the useEffect
    };

    return (
        // Use border-border from theme, remove shadow
        <div className="border border-border rounded-md h-full overflow-hidden">
            <Editor
                height="100%" // Ensure editor fills the container
                language={language}
                theme="vs-dark" // Explicitly set dark theme for Monaco
                value={code}
                onChange={onChange}
                onMount={handleEditorDidMount}
                options={{
                    readOnly: readOnly,
                    minimap: { enabled: false }, // Minimalistic: disable minimap
                    fontSize: 13,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    lineNumbersMinChars: 3, // Reduce space for line numbers
                    renderLineHighlight: "none", // Disable default Monaco highlight, use ours
                    scrollbar: { // Optional: Style scrollbars
                        verticalScrollbarSize: 8,
                        horizontalScrollbarSize: 8,
                    },
                    padding: { top: 8, bottom: 8 } // Add some internal padding
                }}
            // Pass className to potentially style wrapper if needed
            // className="h-full w-full"
            />
        </div>
    );
};

export default CodeEditor;