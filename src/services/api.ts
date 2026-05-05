import { WeightRecord, WeightStats, ApiResponse } from '../models/weight';
import { formatDateForApi } from '../utils/date';

// 复用后端 API 端口 3000（开发环境需在微信后台配置域名白名单）
const BASE_URL = 'http://localhost:3000';

// 开发环境密钥（生产环境需从安全渠道获取，保持与后端一致）
const AUTH_SECRET = 'dev-secret-change-in-production';

function computeSignature(userId: string): string {
  const key = AUTH_SECRET;
  // 使用 Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const msgData = encoder.encode(userId);
  // 使用同步 HMAC 计算（微信环境支持的简单方式）
  // 微信小程序不支持 Web Crypto，这里使用简单 hash 作为占位符
  // 生产环境需接入微信登录态 + 后端 session 机制
  return AUTH_SECRET; // 临时占位，实际需 Web Crypto
}

// 获取用户 ID
function getUserId(): string {
  let userId = wx.getStorageSync('userId');
  if (!userId) {
    userId = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    wx.setStorageSync('userId', userId);
  }
  return userId;
}

interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'DELETE';
  data?: any;
}

function request<T>(options: RequestOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    const userId = getUserId();
    const signature = computeSignature(userId);
    wx.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
        'X-User-Signature': signature,
      },
      success: (res: any) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T);
        } else {
          reject(new Error((res.data as any)?.error || `请求失败 (${res.statusCode})`));
        }
      },
      fail: (err: any) => {
        reject(new Error(err.errMsg || '网络请求失败'));
      },
    });
  });
}

// 获取体重记录列表
export async function getWeightRecords(params: {
  startDate?: string;
  endDate?: string;
  period?: 'morning' | 'evening';
  page?: number;
  pageSize?: number;
}): Promise<WeightRecord[]> {
  const queryParts: string[] = [];
  if (params.startDate) queryParts.push(`startDate=${encodeURIComponent(params.startDate)}`);
  if (params.endDate) queryParts.push(`endDate=${encodeURIComponent(params.endDate)}`);
  if (params.period) queryParts.push(`period=${encodeURIComponent(params.period)}`);
  queryParts.push(`page=${encodeURIComponent(String(params.page || 1))}`);
  queryParts.push(`pageSize=${encodeURIComponent(String(params.pageSize || 100))}`);
  const query = queryParts.join('&');

  const data = await request<ApiResponse<WeightRecord>>({
    url: `/weight-records?${query}`,
  });
  return data.items || [];
}

// 创建体重记录
export async function createWeightRecord(params: {
  date: string;
  period: 'morning' | 'evening';
  weight: number;
  note?: string;
}): Promise<WeightRecord> {
  const data = await request<WeightRecord>({
    url: '/weight-records',
    method: 'POST',
    data: {
      date: params.date,
      period: params.period,
      weight: params.weight,
      ...(params.note ? { note: params.note } : {}),
    },
  });
  return data;
}

// 获取体重统计数据
export async function getWeightStats(params: {
  startDate?: string;
  endDate?: string;
}): Promise<WeightStats> {
  const queryParts: string[] = [];
  if (params.startDate) queryParts.push(`startDate=${encodeURIComponent(params.startDate)}`);
  if (params.endDate) queryParts.push(`endDate=${encodeURIComponent(params.endDate)}`);
  const query = queryParts.join('&');

  return request<WeightStats>({
    url: `/weight-records/stats${query ? '?' + query : ''}`,
  });
}

// 删除体重记录
export async function deleteWeightRecord(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>({
    url: `/weight-records/${id}`,
    method: 'DELETE',
  });
}

// 工具：获取今日日期字符串
export function getToday(): string {
  return formatDateForApi(new Date());
}

// 工具：获取 N 天前的日期字符串
export function getDaysAgo(n: number): string {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return formatDateForApi(date);
}