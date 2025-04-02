// src/components/ProgramInfoModal.tsx
import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
// Import shared types
import type { SerializedProgram, CtfTable, SerializedBlock, SerializedStatement } from '@/types/program'; // Adjust path if needed

interface ProgramInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    program: SerializedProgram; // Still needed for structure view
    ctf: CtfTable; // Needed for CTF table and CFG view
}

type NodeType = SerializedProgram | SerializedBlock | SerializedStatement

const isProgram = (n: NodeType): n is SerializedProgram =>
    n.type === "Program";

const isBlock = (n: NodeType): n is SerializedBlock =>
    n.type === "Block";

// --- ProgramStructureViewer (Helper for simplified structure) ---
const ProgramStructureViewer: React.FC<{ node: NodeType }> = ({ node }) => {
    const renderNodeContent = (n: typeof node) => {
        const lineRange = (first: number, last: number) =>
            first === last ? `L${first}` : `L${first}-${last}`;

        if (isProgram(n)) {
            return <ProgramStructureViewer node={n.block!} />;
        }

        if (isBlock(n)) {
            return (
                <div className="ml-4 pl-4 border-l border-border/50"> {/* Use border color */}
                    <p className="text-xs text-muted-foreground font-semibold">
                        {lineRange(n.first_line, n.last_line)}: Block {n.lexical ? '[Scope]' : ''} {/* Shortened label */}
                    </p>
                    {n.lexical && (
                        <div className="text-xs mt-1 mb-2 space-y-0.5 pl-2"> {/* Indent scope info */}
                            {n.locals && n.locals.length > 0 && <p>Locals: <code className="text-amber-400">{n.locals.join(', ')}</code></p>}
                            {n.nonlocals && n.nonlocals.length > 0 && <p>Nonlocals: <code className="text-sky-400">{n.nonlocals.join(', ')}</code></p>}
                            {n.globals && n.globals.length > 0 && <p>Globals: <code className="text-rose-400">{n.globals.join(', ')}</code></p>}
                        </div>
                    )}
                    {n.statements.map((stmt) => (
                        <ProgramStructureViewer key={`${stmt.type}-${stmt.idx}-${stmt.first_line}`} node={stmt} />
                    ))}
                </div>
            );
        }

        let statementLabel = `${lineRange(n.first_line, n.last_line)}: ${n.type.replace('Stmt', '')}`; // Cleaner type name
        if (n.type === 'DefStmt' && n.name) {
            statementLabel += ` (${n.name})`;
        }

        // Handle nested blocks
        if (n.if_block) { // IfStmt
            return (
                <div className="my-1">
                    <p><code>{statementLabel}</code></p>
                    <ProgramStructureViewer node={n.if_block} />
                    {n.else_block && (
                        <>
                            <p className="text-xs text-muted-foreground ml-1">Else:</p>
                            <ProgramStructureViewer node={n.else_block} />
                        </>
                    )}
                </div>
            );
        } else if (n.block) { // WhileStmt or DefStmt block
            return (
                <div className="my-1">
                    <p><code>{statementLabel}</code></p>
                    <div className={n.type === 'DefStmt' ? "p-1 border border-dashed border-muted/50 rounded mt-1" : ""}>
                        <ProgramStructureViewer node={n.block} />
                    </div>
                </div>
            );
        } else { // Simple statement
            return <p><code>{statementLabel}</code></p>;
        }
    };
    return <div className="mb-1 font-mono text-xs">{renderNodeContent(node)}</div>;
};

// --- Main Modal Component ---
const ProgramInfoModal: React.FC<ProgramInfoModalProps> = ({ isOpen, onClose, program, ctf }) => {

    // Helper to render CTF tables
    const renderCtfTable = (data: Record<string, number>, title: string) => (
        <div className='mb-4'>
            <h4 className="text-sm font-semibold mb-1 text-muted-foreground">{title}</h4>
            {Object.keys(data).length === 0 ? <p className="text-xs text-muted-foreground italic">Empty</p> : (
                <Table className="text-xs">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[80px]">From Line</TableHead>
                            <TableHead>To Line</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Object.entries(data)
                            .sort(([a,], [b,]) => parseInt(a) - parseInt(b))
                            .map(([fromLine, toLine]) => (
                                <TableRow key={`${title}-${fromLine}`}>
                                    <TableCell className="font-mono py-1">{fromLine}</TableCell>
                                    <TableCell className="font-mono py-1">{toLine}</TableCell>
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
            )}
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            {/* Adjusted size and layout */}
            <DialogContent className="max-w-3xl h-[75vh] flex flex-col sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Program Information</DialogTitle>
                    <DialogDescription>
                        Simplified structure, lexical scopes, and control transfer functions.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="structure" className="flex-grow flex flex-col min-h-0"> {/* Ensure tabs content can shrink/grow */}
                    <TabsList className="mb-2 shrink-0">
                        <TabsTrigger value="structure">Structure</TabsTrigger>
                        <TabsTrigger value="ctf">CTF Tables</TabsTrigger>
                    </TabsList>

                    {/* Structure Tab */}
                    <TabsContent value="structure" className="flex-grow overflow-hidden min-h-0">
                        <ScrollArea className="h-full p-1 pr-4 border border-border rounded-md">
                            <ProgramStructureViewer node={program} />
                        </ScrollArea>
                    </TabsContent>

                    {/* CTF Tables Tab */}
                    <TabsContent value="ctf" className="flex-grow overflow-hidden min-h-0">
                        <ScrollArea className="h-full p-1 pr-4 border border-border rounded-md">
                            {renderCtfTable(ctf.next, 'Next Instruction')}
                            {renderCtfTable(ctf.true, 'True Branch')}
                            {renderCtfTable(ctf.false, 'False Branch')}
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};

export default ProgramInfoModal;