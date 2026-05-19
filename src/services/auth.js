"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccessToken = getAccessToken;
exports.getUserId = getUserId;
exports.ensureLoggedIn = ensureLoggedIn;
const BASE_URL = 'https://tizhongji.cisonc.site';
const TOKEN_KEY = 'accessToken';
let loginPromise = null;
function getAccessToken() {
    return wx.getStorageSync(TOKEN_KEY) || '';
}
function getUserId() {
    return wx.getStorageSync('userId') || '';
}
function exchangeCode(code) {
    return new Promise((resolve, reject) => {
        wx.request({
            url: `${BASE_URL}/auth/wechat`,
            method: 'POST',
            header: { 'Content-Type': 'application/json' },
            data: { code },
            success: (res) => {
                var _a;
                const body = res.data;
                if (res.statusCode >= 200 && res.statusCode < 300 && (body === null || body === void 0 ? void 0 : body.success) && ((_a = body.data) === null || _a === void 0 ? void 0 : _a.token)) {
                    wx.setStorageSync(TOKEN_KEY, body.data.token);
                    if (body.data.userId) {
                        wx.setStorageSync('userId', body.data.userId);
                    }
                    resolve(body.data.token);
                    return;
                }
                reject(new Error((body === null || body === void 0 ? void 0 : body.error) || `登录失败 (${res.statusCode})`));
            },
            fail: (err) => {
                reject(new Error(err.errMsg || '网络请求失败'));
            },
        });
    });
}
function doLogin() {
    return new Promise((resolve, reject) => {
        wx.login({
            success: (res) => {
                if (!res.code) {
                    reject(new Error('微信登录失败'));
                    return;
                }
                exchangeCode(res.code).then(resolve).catch(reject);
            },
            fail: (err) => {
                reject(new Error(err.errMsg || '微信登录失败'));
            },
        });
    });
}
/** 确保已有有效 access token（微信 code 换 JWT） */
function ensureLoggedIn() {
    if (getAccessToken()) {
        return Promise.resolve();
    }
    if (!loginPromise) {
        loginPromise = doLogin().then((token) => {
            loginPromise = null;
            return token;
        }, (err) => {
            loginPromise = null;
            throw err;
        });
    }
    return loginPromise.then(() => undefined);
}
