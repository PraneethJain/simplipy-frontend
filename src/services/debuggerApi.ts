import apiClient from "./apiClient";
import type {
  SessionResponseData,
  StepResponseData,
  ProgramState,
} from "../types/state";

export const createSession = async (
  code: string,
  filename: string = "program.py"
): Promise<SessionResponseData> => {
  const response = await apiClient.post<SessionResponseData>("/program", {
    code,
    filename,
  });
  return response.data;
};

export const stepProgram = async (
  sessionId: string
): Promise<StepResponseData> => {
  const response = await apiClient.get<StepResponseData>(`/step/${sessionId}`);
  return response.data;
};

export const resetSession = async (
  sessionId: string,
  code?: string,
  filename?: string
): Promise<SessionResponseData> => {
  const payload = code ? { code, filename: filename || "program.py" } : null;
  const response = await apiClient.post<SessionResponseData>(
    `/reset/${sessionId}`,
    payload
  );
  return response.data;
};

export const getState = async (sessionId: string): Promise<ProgramState> => {
  const response = await apiClient.get<ProgramState>(`/state/${sessionId}`);
  return response.data;
};

export const deleteSession = async (
  sessionId: string
): Promise<{ message: string }> => {
  const response = await apiClient.delete<{ message: string }>(
    `/session/${sessionId}`
  );
  return response.data;
};
