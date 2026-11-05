import type { ChallengeByCategory } from '@/types/challenge';

export const BUILTIN_DIFFICULTIES = ['Baby', 'Easy', 'Medium', 'Hard', 'Boss'] as const;
export type BuiltinDifficulty = (typeof BUILTIN_DIFFICULTIES)[number];

export const CUSTOM_DIFFICULTY_OPTION = 'Custom';

const DECLINE_SPEED: Record<BuiltinDifficulty, number> = {
  Baby: 100,
  Easy: 67,
  Medium: 43,
  Hard: 25,
  Boss: 12,
};

const DEFAULT_BASE_SCORE: Record<BuiltinDifficulty, number> = {
  Baby: 500,
  Easy: 650,
  Medium: 700,
  Hard: 800,
  Boss: 900,
};

const DEV_BASE_SCORE: Record<BuiltinDifficulty, number> = {
  Baby: 500,
  Easy: 800,
  Medium: 1000,
  Hard: 1500,
  Boss: 2000,
};

const NOTICE_BASE_SCORE: Record<BuiltinDifficulty, number> = {
  Baby: 1,
  Easy: 1,
  Medium: 1,
  Hard: 1,
  Boss: 1,
};

export interface ScoringPreset {
  baseScore: number;
  declineSpeed: number;
}

export interface DifficultyFilterOption {
  value: string;
  label: string;
}

export function normalizeDifficulty(value: string): string {
  return value.trim().toUpperCase();
}

export function getBuiltinDifficulty(value: string): BuiltinDifficulty | null {
  const normalized = normalizeDifficulty(value);
  return BUILTIN_DIFFICULTIES.find(
    difficulty => normalizeDifficulty(difficulty) === normalized,
  ) ?? null;
}

export function isBuiltinDifficulty(value: string): boolean {
  return getBuiltinDifficulty(value) !== null;
}

export function getScoringPreset(
  category: string,
  difficulty: BuiltinDifficulty,
): ScoringPreset {
  const normalizedCategory = category.trim().toLowerCase();
  const baseScores = normalizedCategory === 'notice'
    ? NOTICE_BASE_SCORE
    : normalizedCategory === 'dev' || normalizedCategory === 'sa'
      ? DEV_BASE_SCORE
      : DEFAULT_BASE_SCORE;

  return {
    baseScore: baseScores[difficulty],
    declineSpeed: DECLINE_SPEED[difficulty],
  };
}

export function buildDifficultyFilterOptions(
  challenges: ChallengeByCategory[],
): DifficultyFilterOption[] {
  const reserved = new Set([
    'ALL',
    normalizeDifficulty(CUSTOM_DIFFICULTY_OPTION),
    ...BUILTIN_DIFFICULTIES.map(normalizeDifficulty),
  ]);
  const customByNormalized = new Map<string, string>();

  for (const challenge of challenges) {
    const label = challenge.difficulty?.trim();
    if (!label) continue;
    const normalized = normalizeDifficulty(label);
    if (reserved.has(normalized) || customByNormalized.has(normalized)) continue;
    customByNormalized.set(normalized, label);
  }

  const customOptions = [...customByNormalized.values()]
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
    .map(label => ({ value: normalizeDifficulty(label), label }));

  return [
    { value: 'ALL', label: 'ALL' },
    ...BUILTIN_DIFFICULTIES.map(difficulty => ({
      value: normalizeDifficulty(difficulty),
      label: normalizeDifficulty(difficulty),
    })),
    ...customOptions,
  ];
}
