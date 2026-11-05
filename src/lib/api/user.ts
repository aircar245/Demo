import { api, isPlaceholderApi } from './client';
import axios from 'axios';
import type { ScoreboardRanking, SolvedChallenge, TotalScoreRanking, Achievement } from '@/types/user';
import { sanitizeDisplayText } from '@/lib/safeText';

// 后端 GET /user/scoreboard/:userGroup 实际返回格式
interface ScoreboardResponse {
  userGroup: number;
  list: TotalScoreRanking[];
}

interface ScoreboardDirectionResponse {
  userGroup: number;
  category?: string;
  list?: TotalScoreRanking[];
  scoreList?: Array<{ name: string; score: number }>;
}

export interface RankedEntry {
  userId?: number;
  username: string;
  score: number;
  rank: number;
  scoreList: Array<{ category: string; score: number }>;
}

// 后端 category=All 时：{ userGroup, list: [{username, totalScore, scoreList}] }
// 后端 category!=All 时：{ userGroup, category, scoreList: [{name, score}] }
// userGroup=-1 表示查全部（不过滤分组）
export async function getScoreboardByDirection(
  userGroup: number | string = -1,
  category: string = 'All',
  limit = 50,
  offset = 0,
): Promise<RankedEntry[]> {
  const { data } = await api.get<ScoreboardDirectionResponse>(
    `/user/scoreboard/direction`,
    { params: { userGroup, category, limit, offset } },
  );

  if (category === 'All') {
    const list: TotalScoreRanking[] = data?.list ?? [];
    return list.filter(item => Number(item.totalScore) > 0).map((item, i) => ({
      userId: item.userId,
      username: sanitizeDisplayText(item.username),
      score: Number(item.totalScore),
      rank: offset + i + 1,
      scoreList: (item.scoreList ?? []).map(s => ({
        category: s.category,
        score: Number(s.score),
      })),
    }));
  } else {
    const scoreList: Array<{ name: string; score: number }> = data?.scoreList ?? [];
    return scoreList.filter(item => Number(item.score) > 0).map((item, i) => ({
      username: sanitizeDisplayText(item.name),
      score: Number(item.score),
      rank: offset + i + 1,
      scoreList: [],
    }));
  }
}

// scorehistory 端点返回格式
export interface ScoreHistoryEntry {
  date: string;       // 'YYYY-MM-DD'
  category: string;
  dailyScore: number;
}
interface ScoreHistoryResponse {
  status: number;
  list: ScoreHistoryEntry[];
}

// 排行榜：GET /user/scoreboard/:userGroup
export async function getScoreboard(userGroup: number | string = 0): Promise<ScoreboardRanking[]> {
  const { data } = await api.get<ScoreboardResponse>(`/user/scoreboard/${userGroup}`);
  const list = data?.list ?? [];
  return list.filter(item => Number(item.totalScore) > 0).map((item, i) => ({
    username: sanitizeDisplayText(item.username),
    score: Number(item.totalScore),
    rank: i + 1,
  }));
}

// 获取用户已解题目：GET /user/solved/:userId
// 后端返回 { status: 0, list: [...] } 格式
export async function getSolvedChallenges(userId: number): Promise<SolvedChallenge[]> {
  const { data } = await api.get<{ status: number; list: SolvedChallenge[] }>(`/user/solved/${userId}`);
  return (data?.list ?? []).map(solve => ({
    ...solve,
    title: sanitizeDisplayText(solve.title),
  }));
}

// 获取用户得分历史（按日/分类）：GET /user/scorehistory/:userId
export async function getScoreHistory(userId: number): Promise<ScoreHistoryEntry[]> {
  const { data } = await api.get<ScoreHistoryResponse>(`/user/scorehistory/${userId}`);
  return data?.list ?? [];
}

// 获取注册用户总数：GET /auth/count（公开接口，无需认证）
export async function getUserCount(): Promise<number> {
  if (isPlaceholderApi) return 0;
  const baseURL = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3002';
  const { data } = await axios.get<{ count: number; status: number }>(
    `${baseURL}/auth/count`,
  );
  return data?.count ?? 0;
}

// 最近解题动态：GET /auth/recent-solves（公开接口）
export interface RecentSolve {
  username: string;
  title: string;
  category: string;
  createdAt: string;
}
export async function getRecentSolves(limit = 8): Promise<RecentSolve[]> {
  if (isPlaceholderApi) return [];
  const baseURL = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3002';
  const { data } = await axios.get<{ list: RecentSolve[]; status: number }>(
    `${baseURL}/auth/recent-solves`,
    { params: { limit } },
  );
  return (data?.list ?? []).map(solve => ({
    ...solve,
    username: sanitizeDisplayText(solve.username),
    title: sanitizeDisplayText(solve.title),
  }));
}

// 平台整体统计：GET /auth/stats（公开接口）
export interface GlobalStats {
  totalScore: number;
  maxScore: number;
  solvedCount: number;
  challengeCount: number;
}
export async function getGlobalStats(): Promise<GlobalStats> {
  if (isPlaceholderApi) return { totalScore: 0, maxScore: 0, solvedCount: 0, challengeCount: 0 };
  const baseURL = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3002';
  const { data } = await axios.get<GlobalStats & { status: number }>(
    `${baseURL}/auth/stats`,
  );
  return {
    totalScore:     data?.totalScore     ?? 0,
    maxScore:       data?.maxScore       ?? 0,
    solvedCount:    data?.solvedCount    ?? 0,
    challengeCount: data?.challengeCount ?? 0,
  };
}

// 获取用户成就列表：GET /user/achievements/:userId（公开接口）
export async function getAchievements(userId: number): Promise<Achievement[]> {
  if (isPlaceholderApi) return [];
  const baseURL = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3002';
  const { data } = await axios.get<{ list: Achievement[]; status: number }>(
    `${baseURL}/user/achievements/${userId}`,
  );
  return data?.list ?? [];
}
