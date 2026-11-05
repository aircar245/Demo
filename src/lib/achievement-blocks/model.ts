export interface RuleMetadata {
  events: string[];
  metrics: string[];
  operators: string[];
  tables: Record<string, string[]>;
}
export type Scalar = string | number | boolean;
export type Metric = { metric: string; category?: string; difficulty?: string };
export type Filter = { field: string; op?: string; value: Scalar | Scalar[] };
export type Statistic = {
  table: string;
  fields: string;
  aggregate: string;
  where: Filter[];
};
export type Operand = Scalar | Metric | Statistic;
export type Condition =
  | { op: "all" | "any"; conditions: Condition[] }
  | { op: "not"; condition: Condition }
  | {
      op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
      field: Operand;
      value: Operand;
    }
  | { op: "time-before" | "time-after"; at: string }
  | { op: "time-between"; from: string; to: string }
  | { op: "weekday"; value: number }
  | { op: "str-length"; field: string; value: number }
  | { op: "str-contains"; field: string; value: string };
export const EVENT_LABELS: Record<string, string> = {
  "user.register": "用户注册",
  "user.login": "用户登录",
  "user.password.change": "修改密码",
  "flag.submit": "提交 Flag",
  "challenge.view": "查看题目",
  "achievement.unlock": "解锁成就",
  "file.download": "下载附件",
  "client.page.view": "浏览页面",
};
export const METRIC_LABELS: Record<string, string> = {
  solved: "解题总数",
  categories: "解题分类数",
  difficulty: "指定难度解题数",
  categoryScore: "分类得分",
};
export const OPERATORS: Record<string, string> = {
  eq: "等于",
  neq: "不等于",
  gt: "大于",
  gte: "大于或等于",
  lt: "小于",
  lte: "小于或等于",
};
export const DIFFICULTIES = ["BABY", "EASY", "MEDIUM", "HARD", "BOSS"];
export const PAYLOAD_FIELDS = [
  "isCorrect",
  "isRepeated",
  "challengeId",
  "path",
  "fileId",
  "achievementId",
  "userId",
  "flag",
  "oldPassword",
  "newPassword",
];
