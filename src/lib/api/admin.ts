import { api } from './client';
import { sanitizeDisplayText } from '@/lib/safeText';

// ---- 邀请码类型 ----
export interface InviteCode {
  id: number;
  content: string;   // 如 "CNSS-abc123"
  comment: string;   // 备注（给谁的）
  deletedAt: string | null;
}
// 设置/取消管理员权限：POST /auth/admin
export async function setAdminRole(userId: number, role: 0 | 1): Promise<{ status: number }> {
  const { data } = await api.post('/auth/admin', { userId, role });
  return data;
}

// 封禁/解封用户：POST /auth/banned
export async function setBanned(userId: number, value: boolean): Promise<{ status: number }> {
  const { data } = await api.post('/auth/banned', { userId, value });
  return data;
}

// 控制排行榜是否对普通用户可见：POST /user/scoreboard/visible/:visible
export async function setLeaderboardVisibility(visible: boolean): Promise<{ status: number }> {
  const { data } = await api.post(`/user/scoreboard/visible/${visible}`);
  return data;
}

// 获取用户列表：GET /user/list（admin only）
export interface AdminUser {
  username: string;
  userGroup: number;
  userId: number;
  qqId: string;
  role: 0 | 1 | 2;
  isBanned: boolean;
}

export async function getUserList(): Promise<AdminUser[]> {
  const { data } = await api.get<{ list: AdminUser[]; status: number }>('/user/list');
  return (data?.list ?? []).map(user => ({
    ...user,
    username: sanitizeDisplayText(user.username),
  }));
}

// ---- 邀请码 API（admin only）----

// 获取邀请码列表：GET /invitation/list
export async function getInviteCodeList(): Promise<InviteCode[]> {
  const { data } = await api.get<{ list: InviteCode[]; status: number }>('/invitation/list');
  return data?.list ?? [];
}

// 创建邀请码：POST /invitation/create
export async function createInviteCode(comment: string): Promise<{ status: number }> {
  const { data } = await api.post('/invitation/create', { comment });
  return data;
}

// 删除邀请码：POST /invitation/delete/:id
export async function deleteInviteCode(id: number): Promise<{ status: number }> {
  const { data } = await api.post(`/invitation/delete/${id}`);
  return data;
}
