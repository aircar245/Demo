export type UserRole = 0 | 1 | 2;

/**
 * 与后端 auth 模块对应的类型定义。
 * 字段严格对照后端 src/modules/auth/auth.interface.ts，保证前后端一致。
 */

// 登录/注册成功后后端返回的结构
export interface LoginResponse {
  status: number;
  accessToken: string;
  refreshToken: string;
  role: UserRole;
  username: string;
  email: string;
  userGroup: number;
  telephone: string;
  qqId: string;
  userId: number;
}

// 前端保存的"当前登录用户"信息（从 LoginResponse 里挑出来的部分）
export interface CurrentUser {
  username: string;
  email: string;
  role: UserRole;
  userGroup: number;
  telephone: string;
  qqId: string;
  userId: number;
}

// 登录请求体（后端 loginDto：emailorusername 支持邮箱或用户名）
export interface LoginPayload {
  emailorusername: string;
  password: string;
}

// 注册请求体（对齐后端 auth.dto.ts registerDto）
export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  telephone: string;
  qqId: string;
  emailCode: string;
  invitation: string; // 校外必填；校内传空字符串
}
