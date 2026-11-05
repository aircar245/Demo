import { api, tokenStore } from './client';
import type {
  CurrentUser,
  LoginPayload,
  LoginResponse,
  RegisterPayload,
} from '@/types/auth';

/**
 * auth 模块接口封装。
 * 页面组件里调用这些函数即可，不用直接碰 axios。
 * 对应后端路由：src/modules/auth/auth.controller.ts
 */

// 登录：POST /auth/login → 成功后把 token 存起来
export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', payload);
  tokenStore.set(data.accessToken, data.refreshToken);
  return data;
}

// 注册：POST /auth/register → 成功后与 login 一样存 token
export async function register(
  payload: RegisterPayload,
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/register', payload);
  tokenStore.set(data.accessToken, data.refreshToken);
  return data;
}

// 发送邮箱验证码：POST /auth/verify
export async function sendVerifyEmail(email: string): Promise<void> {
  await api.post('/auth/verify', { email });
}

// 申请仅用于登录 NSCC 的短期票据
export async function requestNsccTicket(): Promise<string> {
  const { data } = await api.post<{ status: number; ticket: string }>(
    '/auth/nscc-ticket',
  );
  return data.ticket;
}

// 重置密码：POST /auth/changePassword（邮箱验证码流程，无需旧密码）
export async function changePassword(
  email: string,
  emailCode: string,
  newPassword: string,
): Promise<void> {
  await api.post('/auth/changePassword', { email, emailCode, newPassword });
}

// 登出：GET /auth/logout → 清空本地 token，同时传 refreshToken 使后端加入黑名单
export async function logout(): Promise<void> {
  try {
    const refreshToken = tokenStore.getRefresh();
    await api.get('/auth/logout', {
      params: refreshToken ? { refreshToken } : undefined,
    });
  } finally {
    tokenStore.clear();
  }
}

// 仅从经过服务端认证的接口恢复当前身份。
export async function getCurrentUser(): Promise<CurrentUser> {
  const { data } = await api.get<CurrentUser>('/auth/me');
  if (!data || !Number.isInteger(data.userId) || ![0, 1, 2].includes(data.role)) {
    throw new Error('Invalid session response');
  }
  return data;
}
