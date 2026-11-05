import { api } from './client';

export interface InstanceInfo {
  ConfigID: number;
  Expiration: string;
  ID: number;
  Service: string; // "ip:port" 格式
}

export interface InstanceListResponse {
  Instance: InstanceInfo[];
  status: number;
}

// 获取当前用户所有运行中的实例
export async function getMyInstances(): Promise<InstanceInfo[]> {
  const { data } = await api.get<InstanceListResponse>('/instance/list');
  return data?.Instance ?? [];
}

// 创建实例（开启容器）
export async function createInstance(challengeId: number): Promise<InstanceInfo> {
  const { data } = await api.post<InstanceInfo & { status: number }>('/instance/create', { challengeId }, { timeout: 100000 });
  return data;
}

// 删除实例（关闭容器）
export async function deleteInstance(instanceId: number): Promise<void> {
  await api.post(`/instance/delete/${instanceId}`, {});
}

// 续期实例
export async function renewInstance(instanceId: number): Promise<InstanceInfo> {
  const { data } = await api.post<InstanceInfo & { status: number }>(`/instance/renew/${instanceId}`, {});
  return data;
}
