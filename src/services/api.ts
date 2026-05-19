import { WeightRecord, WeightStats, ApiResponse } from '../models/weight';
import { formatDateForApi } from '../utils/date';
import { ensureLoggedIn, getAccessToken } from './auth';

// 生产环境后端服务地址（需在微信公众平台配置域名白名单）
const BASE_URL = 'https://tizhongji.cisonc.site';

interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'DELETE';
  data?: any;
}

function request<T>(options: RequestOptions, isRetry = false): Promise<T> {
  return ensureLoggedIn().then(
    () =>
      new Promise((resolve, reject) => {
        const token = getAccessToken();
        wx.request({
          url: BASE_URL + options.url,
          method: options.method || 'GET',
          data: options.data,
          header: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          success: (res: any) => {
            if (res.statusCode === 401 && !isRetry) {
              wx.removeStorageSync('accessToken');
              request<T>(options, true).then(resolve).catch(reject);
              return;
            }
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
      })
  );
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
