// src/components/ProgramFlowGraph.tsx
import React, { useEffect, useMemo } from 'react';
import ReactFlow, {
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    Node,
    Edge,
    Position,
    MarkerType,
    BackgroundVariant,
    useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import type { CtfTable } from '@/types/program'; // Adjust path as needed
import type { LastTransitionInfo } from '@/types/state';

// --- Color Definitions for Dark Mode Visibility ---
const colors = {
    nodeBg: 'hsl(240 10% 3.9%)',
    nodeText: 'hsl(0 0% 98%)',
    nodeBorder: 'hsl(210 40% 70%)',
    nodeBorderSelected: 'hsl(210 40% 98%)', // For custom node selection

    edgeNext: 'hsl(240 5% 65%)',
    edgeTrue: 'hsl(140 60% 60%)',
    edgeFalse: 'hsl(0 70% 65%)',
    edgeSelected: 'hsl(45 100% 70%)', // Used in onEdgesChangeIntercept

    labelBg: 'hsl(240 5% 15%)',
    labelText: 'hsl(0 0% 98%)',
};

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const NODE_WIDTH = 60;
const NODE_HEIGHT = 35;
const HORIZONTAL_SEP = 40;
const VERTICAL_SEP = 70;

const getLayoutedElements = (
    nodes: Node[],
    edges: Edge[],
    direction: 'TB' | 'LR' = 'TB'
): { nodes: Node[]; edges: Edge[] } => {
    const isHorizontal = direction === 'LR';
    dagreGraph.setGraph({
        rankdir: direction,
        nodesep: HORIZONTAL_SEP,
        ranksep: VERTICAL_SEP,
    });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        if (!nodeWithPosition) {
            console.warn(`Dagre could not find position for node ${node.id}`);
            return node;
        }
        node.targetPosition = isHorizontal ? Position.Left : Position.Top;
        node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;
        node.position = {
            x: nodeWithPosition.x - NODE_WIDTH / 2,
            y: nodeWithPosition.y - NODE_HEIGHT / 2,
        };
        return node;
    });
    return { nodes: layoutedNodes, edges };
};

// --- Component Props Interface ---
interface ProgramFlowGraphProps {
    ctf: CtfTable;
    highlightedEdgeInfo: LastTransitionInfo | null;
}

// --- Main Component ---
const ProgramFlowGraph: React.FC<ProgramFlowGraphProps> = ({ ctf, highlightedEdgeInfo }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges] = useEdgesState([]);
    const { fitView, getNode } = useReactFlow();

    // console.log(highlightedEdgeInfo)

    // Get unique line numbers involved in CTF
    const allLineNumbers = useMemo(() => {
        const lineSet = new Set<number>();
        Object.keys(ctf.next).forEach(line => lineSet.add(Number(line)));
        Object.keys(ctf.true).forEach(line => lineSet.add(Number(line)));
        Object.keys(ctf.false).forEach(line => lineSet.add(Number(line)));
        Object.values(ctf.next).forEach(line => lineSet.add(line));
        Object.values(ctf.true).forEach(line => lineSet.add(line));
        Object.values(ctf.false).forEach(line => lineSet.add(line));
        return Array.from(lineSet).filter(line => line >= 0).sort((a, b) => a - b);
    }, [ctf]);

    // --- Effect to Generate and Layout Nodes/Edges ---
    useEffect(() => {
        // 1. Generate Nodes (initial position {0,0} is fine)
        const generatedNodes: Node[] = allLineNumbers.map((lineNumber) => ({
            id: String(lineNumber),
            type: 'default',
            data: { label: String(lineNumber) },
            position: { x: 0, y: 0 }, // Position will be set by Dagre
            style: {
                fontSize: '10px',
                fontFamily: 'monospace',
                background: colors.nodeBg,
                color: colors.nodeText,
                border: `1px solid ${colors.nodeBorder}`,
                borderRadius: '4px',
                width: `${NODE_WIDTH}px`, // Set fixed width/height from constants
                height: `${NODE_HEIGHT}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            },
        }));

        // 2. Generate Edges
        const generatedEdges: Edge[] = [];
        const nodeIds = new Set(generatedNodes.map(n => n.id));

        const addEdgeIfValid = (source: string, target: string, label: string, type: 'next' | 'true' | 'false') => {
            if (nodeIds.has(source) && nodeIds.has(target)) {
                const edgeColor = type === 'next' ? colors.edgeNext :
                    type === 'true' ? colors.edgeTrue :
                        colors.edgeFalse;
                const arrowColor = type === 'next' ? colors.edgeNext : edgeColor; // Use edge color for T/F arrows

                generatedEdges.push({
                    id: `e-${source}-${target}-${label.toLowerCase()}`,
                    source: source,
                    target: target,
                    label: label,
                    type: 'smoothstep',
                    markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: arrowColor },
                    style: { stroke: edgeColor, strokeWidth: 1.5 },
                    labelStyle: { fontSize: '10px', fill: colors.labelText, fontWeight: '500' },
                    // labelBgEnabled: true,
                    labelBgStyle: { fill: colors.labelBg, fillOpacity: 0.85, stroke: colors.nodeBorder, strokeWidth: 0.5 },
                    labelBgPadding: [4, 2],
                    labelBgBorderRadius: 2,
                });
            } else {
                console.warn(`Skipping CFG edge: ${label} from ${source} to ${target} (Node ID not found)`);
            }
        };

        Object.entries(ctf.next).forEach(([from, to]) => addEdgeIfValid(from, String(to), 'next', 'next'));
        Object.entries(ctf.true).forEach(([from, to]) => addEdgeIfValid(from, String(to), 'T', 'true'));
        Object.entries(ctf.false).forEach(([from, to]) => addEdgeIfValid(from, String(to), 'F', 'false'));

        // 3. Apply Dagre Layout
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
            generatedNodes,
            generatedEdges,
            'TB' // Or 'LR'
        );

        // 4. Set State
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);

        // 5. Fit View (after layout)
        requestAnimationFrame(() => { // Use rAF to wait for next paint cycle
            fitView({ padding: 0.15, duration: 300 }); // Slightly smaller padding might be ok
        });

    }, [ctf, allLineNumbers, setNodes, setEdges, fitView]); // Dependencies

    useEffect(() => {
        setEdges((prevEdges) =>
            prevEdges.map((edge) => {
                let shouldHighlight = false;
                if (highlightedEdgeInfo) {
                    // Check if this edge matches the highlighted info
                    shouldHighlight =
                        edge.source === String(highlightedEdgeInfo.from_line) &&
                        edge.target === String(highlightedEdgeInfo.to_line) &&
                        (edge.label === highlightedEdgeInfo.ctf ||
                            (edge.label === 'T' && highlightedEdgeInfo.ctf === 'true') ||
                            (edge.label === 'F' && highlightedEdgeInfo.ctf === 'false'));
                }

                // Determine base color based on type stored in data
                const baseColor = edge.label === 'next' ? colors.edgeNext :
                    edge.label === 'T' ? colors.edgeTrue :
                        colors.edgeFalse;

                return {
                    ...edge,
                    style: {
                        ...edge.style,
                        stroke: shouldHighlight ? colors.edgeSelected : baseColor, // Highlight or base color
                        strokeWidth: shouldHighlight ? 2.5 : 1.5, // Thicker when highlighted
                    },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: shouldHighlight ? colors.edgeSelected : baseColor,
                    },
                    // markerEnd: {
                    //     ...edge.markerEnd,
                    //     color: shouldHighlight ? colors.edgeHighlight : baseColor, // Match arrow color
                    // },
                    animated: shouldHighlight, // Add animation when highlighted
                };
            })
        );

        // Optional: Bring highlighted nodes into view
        if (highlightedEdgeInfo) {
            const fromNode = getNode(String(highlightedEdgeInfo.from_line));
            const toNode = getNode(String(highlightedEdgeInfo.to_line));
            if (fromNode && toNode) {
                // Simple focus on the 'to' node
                // fitView({ nodes: [toNode], duration: 300, padding: 0.5 });
                // Or focus on both nodes (might zoom out too much)
                // fitView({ nodes: [fromNode, toNode], duration: 300, padding: 0.3 });
            }
        }

    }, [highlightedEdgeInfo, setEdges, getNode]); // Rerun when highlight info changes

    return (
        <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={true} nodesConnectable={false}
            fitView={false} // Prevent fitView on node drag, etc. Initial fitView in effect.
            attributionPosition="bottom-left" className="bg-inherit" minZoom={0.1}
        >
            <Background variant={BackgroundVariant.Dots} gap={20} size={0.7} color="hsl(var(--border) / 0.4)" />
            <Controls position="top-right" />
        </ReactFlow>
    );
};

export default ProgramFlowGraph;