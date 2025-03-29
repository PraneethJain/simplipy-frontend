import React, { useEffect, useCallback, useRef } from 'react';
import ReactFlow, {
    Controls,
    useNodesState,
    useEdgesState,
    Node,
    Position,
    MarkerType,
    XYPosition,
    useReactFlow,
    SelectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css'; // Keep React Flow base styles

import EnvironmentNode from '@/components/EnvironmentNode';
import type { LexicalMapData, ParentChainData } from '@/types/state';

// Layout constants (remain the same)
const NODE_HEIGHT_ESTIMATE = 100;
const VERTICAL_GAP = 80;
const HORIZONTAL_OFFSET_NEW_NODE = 100;
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
    const { fitView } = useReactFlow();
    const isInitialLayoutDone = useRef(false);

    const getNewNodePosition = useCallback(/* ... keep existing implementation ... */
        (newNodeId: string, currentNodes: Node[], parents: ParentChainData): XYPosition => {
            const parentIdNum = parents[newNodeId];
            if (parentIdNum === undefined) {
                return { x: DEFAULT_POSITION.x + Math.random() * 50, y: DEFAULT_POSITION.y + Math.random() * 50 };
            }
            const parentId = String(parentIdNum);
            const parentNode = currentNodes.find(n => n.id === parentId);
            if (parentNode?.position) {
                return {
                    x: parentNode.position.x + HORIZONTAL_OFFSET_NEW_NODE,
                    y: parentNode.position.y + NODE_HEIGHT_ESTIMATE + VERTICAL_GAP,
                };
            }
            console.warn(`Parent node ${parentId} not found or has no position for new node ${newNodeId}. Using default.`);
            return DEFAULT_POSITION;
        }, []);

    useEffect(() => {
        setNodes((currentNodes) => {
            const newNodes: Node[] = [];
            const existingNodeMap = new Map(currentNodes.map(n => [n.id, n]));
            const incomingEnvIds = new Set(Object.keys(environments));

            for (const [envId, envData] of Object.entries(environments)) {
                const existingNode = existingNodeMap.get(envId);
                if (existingNode) {
                    newNodes.push({
                        ...existingNode,
                        data: { label: envId, environment: envData },
                    });
                } else {
                    const position = getNewNodePosition(envId, currentNodes, parentChain);
                    newNodes.push({
                        id: envId,
                        type: 'environment',
                        data: { label: envId, environment: environments[envId] },
                        position: position,
                        // Keep source/target positions if needed for edge routing
                        sourcePosition: Position.Bottom, // Handles on EnvironmentNode control connection points
                        targetPosition: Position.Top,
                    });
                }
            }

            const finalNodes = newNodes.filter(n => incomingEnvIds.has(n.id));

            const nodesChangedSignificantly = !isInitialLayoutDone.current || finalNodes.length !== currentNodes.length;
            if (nodesChangedSignificantly) {
                // Use timeout for fitView after render
                setTimeout(() => {
                    if (finalNodes.length > 0) { // Only fitView if there are nodes
                        fitView({ padding: 0.2, duration: 300 });
                    }
                }, 0);
                // Only mark as done if there were nodes to layout
                if (finalNodes.length > 0) {
                    isInitialLayoutDone.current = true;
                }
            } else if (finalNodes.length === 0) {
                // Reset flag if all nodes are removed
                isInitialLayoutDone.current = false;
            }


            return finalNodes;
        });

        // Update Edges with dark mode styling
        const generatedEdges = Object.entries(parentChain).map(([childId, parentIdNum]) => {
            const parentId = String(parentIdNum);
            return {
                id: `e-${childId}-to-${parentId}`,
                source: String(childId),
                target: String(parentId),
                type: 'smoothstep',
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: 15,
                    height: 15,
                    // Use a muted foreground color for arrow
                    color: 'gray',
                },
                // Use a muted foreground/border color for edge line
                style: { strokeWidth: 1.5, stroke: 'gray' }
            };
        });
        setEdges(generatedEdges);

    }, [environments, parentChain, getNewNodePosition, fitView, setEdges, setNodes]);

    return (
        // Container already styled in App.tsx, ensure ReactFlow fills it
        <div className="h-full w-full relative overflow-hidden">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                // fitView called conditionally in useEffect
                attributionPosition="bottom-left"
                // Use theme variable for node drag selection
                nodeDragThreshold={1}
                // color="dark"
                proOptions={{ hideAttribution: true }}
                selectNodesOnDrag={true} // default is true
                selectionOnDrag={true}
                selectionMode={SelectionMode.Partial} // Or Full
                className="bg-inherit" // Inherit background from parent
            >
                {/* Dark mode background */}
                {/* <Background
                    variant={BackgroundVariant.Dots}
                    gap={16}
                    size={1}
                    color="hsl(var(--border) / 0.5)" // Use border color, semi-transparent
                /> */}
                {/* Controls and Minimap will use default styles or styles from global CSS */}
                <Controls position="top-right" />
                {/* <MiniMap
                    nodeStrokeWidth={3}
                    zoomable
                    pannable
                    // className applied via global CSS for dark mode
                    position="bottom-right"
                /> */}
            </ReactFlow>
        </div>
    );
};

export default EnvironmentGraph;