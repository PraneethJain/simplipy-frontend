export interface SerializedStatement {
  type: string;
  idx: number;
  first_line: number;
  last_line: number;
  // Only include fields necessary for structure/nesting
  name?: string; // Keep for DefStmt context
  if_block?: SerializedBlock; // Keep for IfStmt nesting
  else_block?: SerializedBlock | null; // Keep for IfStmt nesting
  block?: SerializedBlock; // Keep for WhileStmt/DefStmt nesting
}

export interface SerializedBlock {
  type: "Block";
  first_line: number;
  last_line: number;
  statements: SerializedStatement[];
  lexical: boolean;
  locals?: string[];
  nonlocals?: string[];
  globals?: string[];
}

export interface SerializedProgram {
  type: "Program";
  block: SerializedBlock;
}

export interface CtfTable {
  next: Record<string, number>;
  true: Record<string, number>;
  false: Record<string, number>;
}

export interface SimplifyResponseData {
  simplified_code: string;
}
