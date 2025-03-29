import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import type { Environment, EnvironmentValue } from '@/types/state';
import { ScrollArea } from "@/components/ui/scroll-area"; // Use ScrollArea for content

interface EnvironmentNodeData {
    label: string; // Environment ID
    environment: Environment;
}

// formatValue function remains the same
const formatValue = (value: EnvironmentValue): string => {
    // ... (keep existing implementation)
    if (value === "💀") {
        return "💀";
    }
    if (typeof value === 'object' && value !== null && 'lineno' in value) {
        // Closure Representation
        return `ƒ(L${value.lineno}, Formals:[${value.formals.join(', ')}])`; // Shorter Closure rep
    }
    try {
        return JSON.stringify(value); // Default JSON stringify
    } catch {
        return String(value); // Fallback to string conversion
    }
};


const EnvironmentNode: React.FC<NodeProps<EnvironmentNodeData>> = ({ data, selected }) => {
    const { label, environment } = data;
    const isGlobal = label === '0';

    return (
        // Use theme variables for background, border, text. Add focus/selection ring
        <div
            className={`react-flow__node-env bg-card border rounded-md shadow-sm text-xs w-52 text-foreground ${ // Fixed width example
                selected ? 'border-primary ring-1 ring-primary' : 'border-border'
                }`} // Force global border color
        >
            {/* Handles for connections */}
            {/* Target handle (parent connects here) */}
            <Handle
                type="target"
                position={Position.Top}
                className="!bg-transparent !border-none" // Make handles less visible unless connected
            />
            {/* Source handle (this connects to child) */}
            <Handle
                type="source"
                position={Position.Bottom}
                className="!bg-transparent !border-none" // Make handles less visible unless connected
            />


            {/* Header with Env ID */}
            <div
                className={`font-semibold px-2 py-1 rounded-t text-sm ${isGlobal ? 'bg-blue-900/50 text-blue-200' : 'bg-muted text-muted-foreground'
                    }`}
            >
                Env: {label} {isGlobal ? '(Global)' : ''}
            </div>

            {/* Scrollable Content Area */}
            <ScrollArea className="max-h-40"> {/* Max height + scroll */}
                <div className="p-2">
                    {Object.entries(environment).length === 0 ? (
                        <span className="text-muted-foreground italic">empty</span>
                    ) : (
                        <table className="w-full">
                            <tbody>
                                {Object.entries(environment).map(([key, value]) => (
                                    <tr key={key} className="border-b border-border/50 last:border-b-0 align-top">
                                        <td className="py-0.5 pr-1 font-mono font-medium text-muted-foreground">{key}:</td>
                                        {/* Allow value text to wrap and break */}
                                        <td className="py-0.5 font-mono break-words whitespace-pre-wrap">
                                            {formatValue(value)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </ScrollArea>

            {/* Optional: Add NodeResizer if you want users to resize nodes */}
            {/* <NodeResizer minWidth={150} minHeight={80} isVisible={selected} handleClassName="bg-primary rounded-full" /> */}
        </div>
    );
};

// Use memo for performance optimization with React Flow
export default memo(EnvironmentNode);