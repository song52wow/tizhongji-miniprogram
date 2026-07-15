"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWeightRecords = getWeightRecords;
exports.createWeightRecord = createWeightRecord;
exports.getWeightStats = getWeightStats;
exports.deleteWeightRecord = deleteWeightRecord;
exports.getProfile = getProfile;
exports.updateProfile = updateProfile;
exports.getToday = getToday;
exports.getDaysAgo = getDaysAgo;
const date_1 = require("../utils/date");
const auth_1 = require("./auth");
// 生产环境后端服务地址（需在微信公众平台配置域名白名单）
const BASE_URL = 'https://tizhongji.cisonc.site';
function request(options, isRetry = false) {
    return (0, auth_1.ensureLoggedIn)().then(() => new Promise((resolve, reject) => {
        const token = (0, auth_1.getAccessToken)();
        wx.request({
            url: BASE_URL + options.url,
            method: options.method || 'GET',
            data: options.data,
            header: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            success: (res) => {
                var _a;
                if (res.statusCode === 401 && !isRetry) {
                    wx.removeStorageSync('accessToken');
                    request(options, true).then(resolve).catch(reject);
                    return;
                }
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
    }));
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
        data: Object.assign(Object.assign({ date: params.date, period: params.period, weight: params.weight }, (params.bodyFat !== undefined && params.bodyFat !== null ? { bodyFat: params.bodyFat } : {})), (params.note ? { note: params.note } : {})),
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
// 获取用户资料（身高）
async function getProfile() {
    const res = await request({
        url: '/profile',
    });
    return res.data || { height: null };
}
// 更新用户资料（身高）
async function updateProfile(height) {
    const res = await request({
        url: '/profile',
        method: 'PUT',
        data: { height },
    });
    return res.data || { height };
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
