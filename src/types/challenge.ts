/**
 * Challenge 模块类型定义
 */

export interface ChallengeByCategory {
  title: string;
  score: number;
  solvedCount: number;
  /** 管理员请求时后端 role > 0，跳过 filteredres 映射，返回原始字段名 */
  solved?: number;
  id: number;
  tags: string[];
  yourScore: number;
  difficulty: string;
  category: string;
  configId: number; // -1 = 无容器
  // 管理员可见字段（普通用户响应中不含这些字段）
  isHidden?: boolean;
  tagVisible?: boolean;
}

// 单题详情（GET /challenge/:id 返回）
export interface ChallengeDetail {
  title: string;
  content: string;       // Markdown 内容
  creatorId: number;
  creatorUsername: string;
  score: number;
  baseScore?: number;     // 管理员可见；动态计分保底分
  declineSpeed?: number;  // 管理员可见；动态计分衰减速率
  category: string;
  difficulty: string;
  tags: string[];
  tagVisible?: boolean;  // 管理员可见；普通用户由后端清空 tags，此字段不影响展示逻辑
  isHidden?: boolean;    // 管理员可见；题目是否隐藏
  challengeId: number;
  configId: number;      // -1 = 无容器
}
