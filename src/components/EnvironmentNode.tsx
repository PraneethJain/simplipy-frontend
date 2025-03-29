import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import type { Environment, EnvironmentValue } from '../types/state';

interface EnvironmentNodeData {
    label: string; // Environment ID
    environment: Environment;
}

const formatValue = (value: EnvironmentValue): string => {
    if (value === "💀") {
        return "💀 (Bottom)";
    }
    if (typeof value === 'object' && value !== null && 'lineno' in value) {
        // Closure Representation
        return `Closure(lineno: ${value.lineno}, formals: [${value.formals.join(', ')}])`;
    }
    // Add formatting for other types if needed (e.g., lists, other objects)
    return JSON.stringify(value); // Default JSON stringify
};


const EnvironmentNode: React.FC<NodeProps<EnvironmentNodeData>> = ({ data }) => {
    const { label, environment } = data;
    const isGlobal = label === '0'; // Assuming GLOBAL_ENV_ID is 0

    return (
        <div className={`react-flow__node-env bg-white border rounded shadow-md text-xs ${isGlobal ? 'border-blue-500 border-2' : 'border-gray-300'}`}>
            {/* Handle for incoming parent edges (hidden by default CSS, but needed for connections) */}
            <Handle type="target" position={Position.Top} />

            <div className={`font-bold px-2 py-1 rounded-t ${isGlobal ? 'bg-blue-100' : 'bg-gray-100'}`}>
                Env ID: {label} {isGlobal ? '(Global)' : ''}
            </div>
            <div className="p-2 max-h-40 overflow-y-auto">
                {Object.entries(environment).length === 0 ? (
                    <span className="text-gray-500 italic">empty</span>
                ) : (
                    <table className="w-full">
                        <tbody>
                            {Object.entries(environment).map(([key, value]) => (
                                <tr key={key} className="border-b border-gray-200 last:border-b-0">
                                    <td className="py-0.5 pr-2 font-mono font-semibold">{key}:</td>
                                    <td className="py-0.5 font-mono break-all">{formatValue(value)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Handle for outgoing child edges (hidden by default CSS, but needed for connections) */}
            <Handle type="source" position={Position.Bottom} />
        </div>
    );
};

export default memo(EnvironmentNode); // Memoize for performance