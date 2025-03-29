import React from 'react';
import type { ContextData } from '../types/state';

interface ContinuationStackProps {
    continuation: ContextData[];
}

const ContinuationStack: React.FC<ContinuationStackProps> = ({ continuation }) => {
    console.log(continuation);
    const stack = continuation || []; // Handle potential undefined stack

    return (
        <div className="border border-gray-300 rounded bg-white p-3 shadow-sm h-full flex flex-col">
            <h2 className="text-lg font-semibold mb-2 text-gray-700 border-b pb-1">Continuation (k)</h2>
            {stack.length === 0 ? (
                <div className="text-gray-500 italic flex-grow flex items-center justify-center">Stack Empty (Final State)</div>
            ) : (
                // Render stack from top (end of array) to bottom (start of array)
                <ul className="space-y-1 overflow-y-auto flex-grow flex flex-col-reverse">
                    {stack.map((context, index) => (
                        <li
                            key={index} // Using index is okay here as stack order matters and items don't change identity
                            className={
                                "border rounded px-2 py-1 text-sm font-mono " +
                                (index === stack.length - 1
                                    ? "bg-blue-100 border-blue-400 shadow"
                                    : "bg-gray-50 border-gray-200")
                            }
                        >
                            <span className="font-semibold">L{context.lineno}:</span> Env {context.env_id}
                            {index === stack.length - 1 && <span className="text-blue-700 font-bold ml-2">(Top)</span>}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default ContinuationStack;