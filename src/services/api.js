"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWeightRecords = getWeightRecords;
exports.createWeightRecord = createWeightRecord;
exports.getWeightStats = getWeightStats;
exports.deleteWeightRecord = deleteWeightRecord;
exports.getToday = getToday;
exports.getDaysAgo = getDaysAgo;
const date_1 = require("../utils/date");
const crypto_1 = require("../utils/crypto");
// 生产环境后端服务地址（需在微信公众平台配置域名白名单）
const BASE_URL = 'https://tizhongji.cisonc.site';
// 开发环境密钥（生产环境需从安全渠道获取，保持与后端一致）
const AUTH_SECRET = 'b242de131e53f5982e6681e836ae49870291f74edfb083b068912b454b6e676e23c0d8a9be43f2208e0f5fdad7020d36';
function computeSignature(userId) {
    // 纯 JS HMAC-SHA256，兼容微信小程序环境（无需 Web Crypto API）
    return (0, crypto_1.hmacSha256)(AUTH_SECRET, userId);
}
// 获取用户 ID
function getUserId() {
    let userId = wx.getStorageSync('userId');
    if (!userId) {
        userId = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        wx.setStorageSync('userId', userId);
    }
    return userId;
}
function request(options) {
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
            success: (res) => {
                var _a;
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(res.data);
                }
                else {
                    reject(new Error(((_a = res.data) === null || _a === void 0 ? void 0 : _a.error) || `请求失败 (${res.statusCode})`));
                }
            },
            fail: (err) => {
                reject(new Error(err.errMsg || '网络请求失败'));
            },
        });
    });
}
// 获取体重记录列表
async function getWeightRecords(params) {
    const queryParts = [];
    if (params.startDate)
        queryParts.push(`startDate=${encodeURIComponent(params.startDate)}`);
    if (params.endDate)
        queryParts.push(`endDate=${encodeURIComponent(params.endDate)}`);
    if (params.period)
        queryParts.push(`period=${encodeURIComponent(params.period)}`);
    queryParts.push(`page=${encodeURIComponent(String(params.page || 1))}`);
    queryParts.push(`pageSize=${encodeURIComponent(String(params.pageSize || 100))}`);
    const query = queryParts.join('&');
    const data = await request({
        url: `/weight-records?${query}`,
    });
    return data.items || [];
}
// 创建体重记录
async function createWeightRecord(params) {
    const data = await request({
        url: '/weight-records',
        method: 'POST',
        data: Object.assign({ date: params.date, period: params.period, weight: params.weight }, (params.note ? { note: params.note } : {})),
    });
    return data;
}
// 获取体重统计数据
async function getWeightStats(params) {
    const queryParts = [];
    if (params.startDate)
        queryParts.push(`startDate=${encodeURIComponent(params.startDate)}`);
    if (params.endDate)
        queryParts.push(`endDate=${encodeURIComponent(params.endDate)}`);
    const query = queryParts.join('&');
    return request({
        url: `/weight-records/stats${query ? '?' + query : ''}`,
    });
}
// 删除体重记录
async function deleteWeightRecord(id) {
    return request({
        url: `/weight-records/${id}`,
        method: 'DELETE',
    });
}
// 工具：获取今日日期字符串
function getToday() {
    return (0, date_1.formatDateForApi)(new Date());
}
// 工具：获取 N 天前的日期字符串
function getDaysAgo(n) {
    const date = new Date();
    date.setDate(date.getDate() - n);
    return (0, date_1.formatDateForApi)(date);
}
