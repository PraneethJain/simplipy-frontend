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
}

export interface StepResponseData {
  state: ProgramState;
  finished: boolean;
}
