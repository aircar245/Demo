import { api } from './client';

export interface FlagSubmitResult {
  status: number;
  isCorrect: boolean;
  isRepeated: boolean;
}

export interface FlagInfo {
  id: number;
  content: string;
  score: number;
  challengeId: number;
  isBroadcast: boolean;
}

// 提交 Flag：POST /flag/submit
export async function submitFlag(
  challengeId: number,
  flagLiteral: string,
): Promise<FlagSubmitResult> {
  const { data } = await api.post<FlagSubmitResult>('/flag/submit', {
    challengeId,
    flagLiteral,
  });
  return data;
}

// 获取题目的 Flag 列表（admin）：GET /flag/get/:challengeId
export async function getFlags(challengeId: number): Promise<FlagInfo[]> {
  const { data } = await api.get<FlagInfo | FlagInfo[]>(`/flag/get/${challengeId}`);
  return Array.isArray(data) ? data : (data ? [data] : []);
}

// 创建 Flag（admin）：POST /flag/create
export async function createFlag(
  challengeId: number,
  flagLiteral: string,
  score: number,
  isBroadcast: boolean,
): Promise<{ status: number }> {
  const { data } = await api.post('/flag/create', { challengeId, flagLiteral, score, isBroadcast });
  return data;
}

// 更新 Flag（admin）：POST /flag/update/:flagId
export async function updateFlag(
  flagId: number,
  flagLiteral: string,
  score: number,
  challengeId: number,
  isBroadcast: boolean,
): Promise<{ status: number }> {
  const { data } = await api.post(`/flag/update/${flagId}`, { challengeId, flagLiteral, score, isBroadcast });
  return data;
}

// 删除 Flag（admin）：GET /flag/delete/:flagId
export async function deleteFlag(flagId: number): Promise<{ status: number }> {
  const { data } = await api.get(`/flag/delete/${flagId}`);
  return data;
}
