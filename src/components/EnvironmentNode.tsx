import React, { memo, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import type { Environment, EnvironmentValue } from '@/types/state';

interface EnvironmentNodeData {
    label: string; // Environment ID
    environment: Environment;
}

const formatValue = (value: EnvironmentValue): string => {
    if (value === "💀") { return "💀"; }
    if (typeof value === 'object' && value !== null && 'lineno' in value && 'formals' in value) {
        const formalsString = Array.isArray(value.formals) ? value.formals.join(', ') : 'unknown';
        return `ƒ(L${value.lineno}, Formals:[${formalsString}])`;
    }
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
};

const EnvironmentNode: React.FC<NodeProps<EnvironmentNodeData>> = ({ data, selected }) => {
    const { label, environment } = data;
    const isGlobal = label === '0';

    const nodeRef = useRef<HTMLDivElement>(null);
    const scrollableAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const nodeElement = nodeRef.current;
        const scrollableAreaElement = scrollableAreaRef.current;

        if (!nodeElement || !scrollableAreaElement) return;

        const handleWheel = (event: WheelEvent) => {
            if (event.target && scrollableAreaElement.contains(event.target as Node)) {
                event.stopPropagation(); // Stop React Flow zoom
                // Check if the element needs scrolling, might help trigger scrollbar?
                if (scrollableAreaElement.scrollHeight > scrollableAreaElement.clientHeight) {
                    // Potentially manually scroll, although usually not needed
                    // scrollableAreaElement.scrollTop += event.deltaY;
                }
            }
        };

        // Listener attached to the main node to capture early
        nodeElement.addEventListener('wheel', handleWheel, { capture: true });

        return () => {
            nodeElement.removeEventListener('wheel', handleWheel, { capture: true });
        };
    }, []); // Re-run if refs change (shouldn't, but good practice)

    return (
        <div
            ref={nodeRef}
            className={`react-flow__node-env flex flex-col bg-card border rounded-md shadow-sm text-xs w-60 text-foreground overflow-hidden ${ // Keep overflow-hidden on parent
                selected ? 'border-primary ring-1 ring-primary' : 'border-border'
                }`}
            style={{ maxHeight: '250px' }}
            data-simplipy-nodrag="true"
        >
            <Handle type="target" position={Position.Top} className="!bg-transparent !border-none" />
            <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-none" />

            <div
                className={`flex-shrink-0 font-semibold px-2 py-1 rounded-t text-sm ${isGlobal ? 'bg-blue-900/50 text-blue-200' : 'bg-muted text-muted-foreground'
                    }`}
            >
                Env: {label} {isGlobal ? '(Global)' : ''}
            </div>

            <div
                ref={scrollableAreaRef}
                className="flex-grow min-h-0 overflow-y-auto">
                <div className="p-2">
                    {Object.entries(environment).length === 0 ? (
                        <span className="text-muted-foreground italic">empty</span>
                    ) : (
                        <table className="w-full table-fixed"><tbody>
                            {Object.entries(environment).map(([key, value]) => (
                                <tr key={key} className="border-b border-border/50 last:border-b-0 align-top">
                                    <td className="py-0.5 pr-1 font-mono font-medium text-muted-foreground w-1/3 truncate" title={key}>
                                        {key}:
                                    </td>
                                    <td className="py-0.5 font-mono break-words whitespace-pre-wrap">
                                        {formatValue(value)}
                                    </td>
                                </tr>
                            ))}
                        </tbody></table>
                    )}
                </div>
            </div>

        </div>
    );
};

export default memo(EnvironmentNode);