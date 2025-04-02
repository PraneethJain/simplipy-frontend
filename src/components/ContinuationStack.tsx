import React from 'react';
import type { ContextData } from '@/types/state';

interface ContinuationProps {
    continuation: ContextData[];
}

const Continuation: React.FC<ContinuationProps> = ({ continuation }) => {
    const stack = continuation || [];

    return (
        // Use theme variables for background and border
        <div className="border border-border rounded-md bg-card p-3 h-full flex flex-col text-foreground">
            {/* Use theme colors, subtle bottom border */}
            <h2 className="text-sm font-medium mb-2 border-b border-border/50 pb-1.5 text-muted-foreground">
                Stack
            </h2>
            {stack.length === 0 ? (
                <div className="text-muted-foreground italic flex-grow flex items-center justify-center text-sm">
                    Stack Empty (Final State)
                </div>
            ) : (
                <div className="flex-grow pr-3 overflow-y-auto">
                    {/* Render stack from top (end) to bottom (start) */}
                    <ul className="space-y-1.5 flex flex-col-reverse">
                        {stack.map((context, index) => (
                            <li
                                key={index}
                                // Use theme colors, subtle highlight for top item
                                className={`border rounded px-2 py-1 text-xs font-mono ${index === stack.length - 1
                                    ? 'bg-primary/10 border-primary/40' // Subtle primary highlight
                                    : 'bg-background border-border/70' // Slightly different background or border
                                    }`}
                            >
                                <span className="font-semibold text-muted-foreground">L{context.lineno}:</span> Env {context.env_id}
                                {index === stack.length - 1 && (
                                    // Use primary text color for top indicator
                                    <span className="text-primary font-bold ml-2">(Top)</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default Continuation;