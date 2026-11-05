/**
 * 用户模块类型定义
 * 来源：后端 src/modules/users/users.interface.ts
 */

export interface ScoreboardRanking {
  username: string;
  score: number;
  rank: number;
}

export interface SolvedChallenge {
  category: string;
  title: string;
  challengeId: number;
  score: number;
}

export interface TotalScoreRanking {
  userId: number;
  username: string;
  totalScore: number;
  scoreList: Array<{
    category: string;
    score: number;
  }>;
}

export interface Achievement {
  id: number;
  description: string;
  icon: string;
  rare: number;
  unlockedAt: string;
  key: string;
  label: string;
  color: string;
}
