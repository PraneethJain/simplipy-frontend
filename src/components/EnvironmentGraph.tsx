import React, { useEffect, useCallback, useRef } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    Node,
    Position,
    MarkerType,
    XYPosition,
    useReactFlow, // Import useReactFlow hook
} from 'reactflow';
import 'reactflow/dist/style.css'; // Import React Flow styles

import EnvironmentNode from './EnvironmentNode';
import type { LexicalMapData, ParentChainData } from '../types/state';

// Layout settings (adjust as needed)
// const NODE_WIDTH = 200; // Less critical if not auto-laying out everything
const NODE_HEIGHT_ESTIMATE = 100; // Estimate, actual height varies
const VERTICAL_GAP = 80; // Increased gap for clarity
const HORIZONTAL_OFFSET_NEW_NODE = 100; // How far horizontally to place a new node from parent
const DEFAULT_POSITION: XYPosition = { x: 50, y: 50 };


interface EnvironmentGraphProps {
    environments: LexicalMapData;
    parentChain: ParentChainData;
}

const nodeTypes = {
    environment: EnvironmentNode,
};

const EnvironmentGraph: React.FC<EnvironmentGraphProps> = ({ environments, parentChain }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const { fitView } = useReactFlow(); // Get fitView function
    const isInitialLayoutDone = useRef(false); // Track if initial layout happened

    // --- Function to calculate position for a NEW node ---
    // Tries to place it relative to its parent
    const getNewNodePosition = useCallback((
        newNodeId: string,
        currentNodes: Node[],
        parents: ParentChainData
    ): XYPosition => {
        const parentIdNum = parents[newNodeId];
        if (parentIdNum === undefined) {
            // No parent (e.g., global or disconnected), place at default or slightly offset from others
            // A more sophisticated approach could check existing node positions
            return { x: DEFAULT_POSITION.x + Math.random() * 50, y: DEFAULT_POSITION.y + Math.random() * 50 };
        }

        const parentId = String(parentIdNum);
        const parentNode = currentNodes.find(n => n.id === parentId);

        if (parentNode?.position) {
            // Basic positioning below the parent
            // Could add logic to check for siblings and spread horizontally
            return {
                x: parentNode.position.x + HORIZONTAL_OFFSET_NEW_NODE, // Offset slightly
                y: parentNode.position.y + NODE_HEIGHT_ESTIMATE + VERTICAL_GAP,
            };
        }

        // Parent exists but has no position yet (should be rare if processed in order)
        // Fallback to default
        console.warn(`Parent node ${parentId} not found or has no position for new node ${newNodeId}. Using default.`);
        return DEFAULT_POSITION;

    }, []);


    // --- Main Effect for Updating Nodes and Edges ---
    useEffect(() => {
        setNodes((currentNodes) => {
            const newNodes: Node[] = [];
            const existingNodeMap = new Map(currentNodes.map(n => [n.id, n]));
            const incomingEnvIds = new Set(Object.keys(environments));

            // 1. Update existing nodes and identify new nodes
            for (const [envId, envData] of Object.entries(environments)) {
                const existingNode = existingNodeMap.get(envId);

                if (existingNode) {
                    // Update data, keep existing position (React Flow handles this via onNodesChange)
                    newNodes.push({
                        ...existingNode,
                        // IMPORTANT: Update the data prop
                        data: { label: envId, environment: envData },
                    });
                } else {
                    // It's a new node, calculate initial position
                    // Note: We pass 'currentNodes' which has the state *before* this update.
                    // If multiple nodes are added at once, later ones might not find
                    // the position of parents added in the *same* step.
                    // getNewNodePosition provides a fallback.
                    const position = getNewNodePosition(envId, currentNodes, parentChain);

                    newNodes.push({
                        id: envId,
                        type: 'environment',
                        data: { label: envId, environment: environments[envId] },
                        position: position,
                        sourcePosition: Position.Top, // Child is source for parent arrow
                        targetPosition: Position.Bottom, // Child is target for grandchild arrow
                    });
                }
            }

            // 2. (Optional but good practice) Remove nodes that are no longer in the environments data
            const finalNodes = newNodes.filter(n => incomingEnvIds.has(n.id));

            // --- Fit view only on significant changes (e.g., initial load or many new nodes) ---
            // Heuristic: Fit view if it's the first time or if nodes were added/removed
            const nodesChangedSignificantly = !isInitialLayoutDone.current || finalNodes.length !== currentNodes.length;
            if (nodesChangedSignificantly) {
                // Use a timeout to allow nodes to render before fitting view
                setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 0);
                isInitialLayoutDone.current = true; // Mark initial layout as done
            }


            return finalNodes; // Return the updated list for the state setter
        });


        // Update Edges (Simpler: recalculate all based on parentChain)
        const generatedEdges = Object.entries(parentChain).map(([childId, parentIdNum]) => {
            const parentId = String(parentIdNum); // Ensure parent ID is string
            return {
                id: `e-${childId}-to-${parentId}`, // Edge ID points child *to* parent
                source: String(childId),          // Source is the CHILD environment
                target: String(parentId),          // Target is the PARENT environment
                type: 'smoothstep',              // Or 'straight', 'step'
                markerEnd: {                     // Arrow points TO the target (parent)
                    type: MarkerType.ArrowClosed,
                    width: 15,
                    height: 15,
                    color: '#888', // Slightly lighter color
                },
                style: { strokeWidth: 1.5, stroke: '#aaa' } // Lighter style
                // NO LABEL properties
            };
        });
        setEdges(generatedEdges);

        // Dependencies: Trigger when the underlying data changes.
        // setNodes/setEdges are stable, no need to include them.
    }, [environments, parentChain, getNewNodePosition, fitView, setEdges, setNodes]); // Add fitView


    // Note: onConnect is usually for user interaction, not needed for programmatic edges
    // const onConnect = (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds));

    return (
        <div className="h-full w-full border border-gray-300 rounded bg-gray-50 relative overflow-hidden"> {/* Ensure overflow hidden */}
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange} // Handles node dragging, selection, deletion
                onEdgesChange={onEdgesChange} // Handles edge selection, deletion
                // onConnect={onConnect} // Only needed if users can manually create edges
                nodeTypes={nodeTypes}
                fitView // fitView is now called conditionally inside useEffect
                // defaultViewport={{ x: 0, y: 0, zoom: 1}} // Alternative to fitView on load
                attributionPosition="bottom-left"
            // Prevent nodes from being dragged outside the viewport (optional)
            // translateExtent={[[0, 0], [ Infinity, Infinity]]}
            // minZoom={0.2} // Optional zoom limits
            >
                <Background />
                <Controls />
                <MiniMap nodeStrokeWidth={3} zoomable pannable />
            </ReactFlow>
        </div>
    );
};


// Wrap the component with the provider where it's used (in App.tsx)
// No need to wrap here, but ensure App.tsx still has <ReactFlowProvider>
export default EnvironmentGraph;