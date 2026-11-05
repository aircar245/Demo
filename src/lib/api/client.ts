import axios, { AxiosError } from 'axios';
import type { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/authStore';

/**
 * ========== API 客户端（前端与后端通信的中枢） ==========
 *
 * 这个文件做三件事：
 * 1. 创建 axios 实例，统一后端地址
 * 2. 请求拦截器：每次请求自动带上 accessToken
 * 3. 响应拦截器：token 过期(401)时，自动用 refreshToken 刷新并重试
 *
 * 后端约定（已从 NestJS 源码确认）：
 * - baseURL: http://localhost:3002（无全局前缀）
 * - 登录返回: { accessToken, refreshToken, ... }
 * - 刷新接口: GET /auth/refresh
 */

// ---- Token 的读写：统一放这里，方便以后换存储方式（localStorage / cookie）----
const ACCESS_KEY = 'cnss_access_token';
const REFRESH_KEY = 'cnss_refresh_token';

export const tokenStore = {
  getAccess: () =>
    typeof window !== 'undefined' ? localStorage.getItem(ACCESS_KEY) : null,
  getRefresh: () =>
    typeof window !== 'undefined' ? localStorage.getItem(REFRESH_KEY) : null,
  set: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

const apiBaseURL = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3002';
export const isPlaceholderApi = apiBaseURL.trim().replace(/\/+$/, '').toLowerCase() === 'https://example.com';

function placeholderApiError() {
  const message = '演示站点未连接后端，此操作不可用。';
  // Keep the message shape consumed by the existing forms, without attaching request data.
  return Object.assign(new AxiosError(message, 'ERR_NOT_SUPPORT'), {
    response: { status: 503, data: { message } },
  });
}

// ---- 创建 axios 实例 ----
export const api = axios.create({
  baseURL: apiBaseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ---- 请求拦截器：自动挂 accessToken ----
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (isPlaceholderApi) throw placeholderApiError();
  const token = tokenStore.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---- 响应拦截器：401 自动刷新 token ----
//
// 难点：多个请求同时 401 时，只应刷新一次 token，其余请求排队等刷新完成后重试。
// 用一个 isRefreshing 标志 + 等待队列解决。

let refreshPromise: Promise<string> | null = null;
export function refreshAccessToken(): Promise<string> {
 if (isPlaceholderApi) return Promise.reject(placeholderApiError());
 if (refreshPromise) return refreshPromise;
 const originalRefresh=tokenStore.getRefresh();
 if (!originalRefresh) return Promise.reject(new Error('Not logged in'));
 refreshPromise=(async()=>{
  try {
   const {data}=await axios.get(api.defaults.baseURL+'/auth/refresh',{headers:{Authorization:'Bearer '+originalRefresh}});
   if(tokenStore.getRefresh()!==originalRefresh) throw new Error('Session changed');
   tokenStore.set(data.accessToken,data.refreshToken??originalRefresh);
   return data.accessToken as string;
  } catch(error) {
   if(tokenStore.getRefresh()===originalRefresh){tokenStore.clear();useAuthStore.getState().clearUser();}
   throw error;
  } finally {refreshPromise=null;}
 })();
 return refreshPromise;
}
api.interceptors.response.use(response=>response,async(error:AxiosError)=>{
 const original=error.config as AxiosRequestConfig & {_retry?:boolean};
 if(error.response?.status!==401||!original||original._retry || /^\/auth\/(login|register|verify|changePassword|refresh)(?:[?#]|$)/.test(original.url ?? '')) return Promise.reject(error);
 original._retry=true;
 const token=await refreshAccessToken();
 original.headers={...original.headers,Authorization:'Bearer '+token};
 return api(original);
});
