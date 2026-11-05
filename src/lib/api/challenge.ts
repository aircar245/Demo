import { api } from './client';
import type { ChallengeByCategory, ChallengeDetail } from '@/types/challenge';

interface ChallengeListResponse {
  list: ChallengeByCategory[];
  status: number;
}

export interface ChallengeCreatePayload {
  title: string;
  content?: string;
  score: number;
  baseScore: number;
  declineSpeed: number;
  category: string;
  difficulty: string;
  tags?: string[];
  tagVisible?: boolean;
  isHidden: boolean;
  config_id: number;
}

export interface ChallengeUpdatePayload {
  title?: string;
  content?: string;
  score?: number;
  baseScore?: number;
  declineSpeed?: number;
  category?: string;
  difficulty?: string;
  tags?: string[];
  tagVisible?: boolean;
  isHidden?: boolean;
}

const ALL_CATEGORIES = [
  'web','pwn','crypto','re','misc','dev','sa','design','hpc','blockchain','notice',
];

export async function getChallengesByCategory(
  category: string,
): Promise<ChallengeByCategory[]> {
  if (category === 'all') {
    const results = await Promise.allSettled(
      ALL_CATEGORIES.map(c =>
        api.get<ChallengeListResponse>(`/challenge/category/${c}`)
          .then(r => r.data.list ?? [])
      )
    );
    return results
      .filter((r): r is PromiseFulfilledResult<ChallengeByCategory[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);
  }
  const { data } = await api.get<ChallengeListResponse>(`/challenge/category/${category}`);
  return data.list ?? [];
}

// 获取单题详情：GET /challenge/:challengeId
export async function getChallengeById(id: number): Promise<ChallengeDetail> {
  const { data } = await api.get<ChallengeDetail>(`/challenge/${id}`);
  return data;
}

// 创建题目（admin）：POST /challenge/create
export async function createChallenge(
  payload: ChallengeCreatePayload,
): Promise<{ status: number; challengeId?: number }> {
  const { data } = await api.post('/challenge/create', payload);
  return data;
}

// 删除题目（admin）：GET /challenge/delete/:challengeId
export async function deleteChallenge(id: number): Promise<{ status: number }> {
  const { data } = await api.get(`/challenge/delete/${id}`);
  return data;
}

// 更新题目（admin）：POST /challenge/update/:challengeId
export async function updateChallenge(
  id: number,
  payload: ChallengeUpdatePayload,
): Promise<{ status: number }> {
  const { data } = await api.post(`/challenge/update/${id}`, payload);
  return data;
}

// 交换两道题目的显示顺序（admin）：POST /challenge/swap/:Id1/:Id2
export async function swapChallenges(
  id1: number,
  id2: number,
): Promise<{ status: number }> {
  const { data } = await api.post(`/challenge/swap/${id1}/${id2}`);
  return data;
}

// 单独切换 tag 可见性（admin）：POST /challenge/hiddentags
export async function toggleTagVisible(
  challengeId: number,
  tagVisible: boolean,
): Promise<{ status: number }> {
  const { data } = await api.post('/challenge/hiddentags', { challengeId, tagVisible });
  return data;
}
