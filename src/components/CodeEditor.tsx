import React, { useRef, useEffect } from 'react';
import Editor, { Monaco, OnMount } from "@monaco-editor/react";
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api'; // Import type for editor instance

interface CodeEditorProps {
    code: string;
    onChange: (value: string | undefined) => void;
    language?: string;
    readOnly?: boolean;
    currentLine?: number; // Optional: To highlight the current line
}

const CURRENT_LINE_DECORATION_CLASS = 'current-line-highlight';

const CodeEditor: React.FC<CodeEditorProps> = ({
    code,
    onChange,
    language = "python",
    readOnly = false,
    currentLine
}) => {
    // Refs to store editor instance, monaco instance, and decoration IDs
    const editorRef = useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<Monaco | null>(null);
    const decorationsRef = useRef<string[]>([]); // Store decoration IDs to remove them later

    // Effect to apply/update decorations when currentLine changes or editor mounts
    useEffect(() => {
        // Ensure editor and monaco are mounted
        if (!editorRef.current || !monacoRef.current) {
            return;
        }

        const editor = editorRef.current;
        const monaco = monacoRef.current;
        let newDecorations: monacoEditor.editor.IModelDeltaDecoration[] = [];

        // If we have a valid current line number, create the decoration
        if (typeof currentLine === 'number' && currentLine > 0) {
            newDecorations = [
                {
                    range: new monaco.Range(currentLine, 1, currentLine, 1), // Range for the whole line
                    options: {
                        isWholeLine: true, // Apply to the entire line
                        // Class name for styling (defined in CSS)
                        className: CURRENT_LINE_DECORATION_CLASS,
                        // Optional: specify where the decoration should be (e.g., behind text)
                        // Use GlyphMargin if you want an icon in the gutter
                        // linesDecorationsClassName: 'myGlyphMarginClass',
                    }
                }
            ];
        }

        // Use deltaDecorations to atomically remove old decorations and add new ones
        // It returns the new decoration IDs
        decorationsRef.current = editor.deltaDecorations(
            decorationsRef.current, // Old decorations IDs to remove
            newDecorations         // New decorations to add
        );

        // Optionally reveal the line if it's off-screen
        if (typeof currentLine === 'number' && currentLine > 0) {
            // Smooth scroll is generally preferred if available and desired
            editor.revealLineInCenterIfOutsideViewport(currentLine, monacoEditor.editor.ScrollType.Smooth);
            // Or just ensure it's visible:
            // editor.revealLine(currentLine, monacoEditor.editor.ScrollType.Smooth);
        }

        // No explicit cleanup function needed here, as deltaDecorations handles removal
    }, [currentLine]); // Rerun this effect only when currentLine changes

    // Store editor and monaco instances on mount
    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        // Trigger the effect manually once on mount in case currentLine is already set
        // The useEffect will run immediately after mount anyway, so this might be redundant
        // but ensures initial highlight if prop is passed before first render completes fully.
        // However, directly manipulating decorationsRef here might race with useEffect.
        // It's safer to rely on the useEffect triggered by the initial currentLine prop value.
    };

    return (
        // Remove the simple lineHighlightClass from the container
        <div className="border border-gray-300 rounded shadow-sm h-full">
            <Editor
                height="100%"
                language={language}
                value={code}
                onChange={onChange}
                onMount={handleEditorDidMount}
                options={{
                    readOnly: readOnly,
                    minimap: { enabled: true },
                    fontSize: 13,
                    scrollBeyondLastLine: false,
                    automaticLayout: true, // Adjust layout on container resize
                    // Consider adding 'renderLineHighlight': 'none' if you don't want Monaco's default line highlight
                }}
            />
        </div>
    );
};

export default CodeEditor;