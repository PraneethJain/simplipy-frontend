import { CtfTable, SerializedProgram } from "@/types/program";

export interface ClosureRepresentation {
  lineno: number;
  formals: string[];
}

export type EnvironmentValue =
  | string
  | number
  | boolean
  | ClosureRepresentation
  | "💀";

export interface Environment {
  [variableName: string]: EnvironmentValue;
}

export interface LexicalMapData {
  [envId: string]: Environment;
}

export interface ParentChainData {
  [childEnvId: string]: number;
}

export interface ContextData {
  lineno: number;
  env_id: number;
}

export interface ProgramState {
  e: LexicalMapData;
  p: ParentChainData;
  k: ContextData[];
}

export interface SessionResponseData {
  session_id: string;
  initial_state: ProgramState;
  program_structure: SerializedProgram;
  ctf_table: CtfTable;
}

export interface LastTransitionInfo {
  from_line: number;
  to_line: number; // Can be -1 for final state
  ctf: string; // 'next', 'true', 'false' etc.
}

export interface StepResponseData {
  state: ProgramState;
  finished: boolean;
  last_transition: LastTransitionInfo | null;
}

export interface HistoryEntry {
  state: ProgramState;
  finished: boolean;
  // Add the transition that LED TO this state (optional)
  transition?: LastTransitionInfo | null;
}
