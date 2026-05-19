const BASE_URL = 'https://tizhongji.cisonc.site';
const TOKEN_KEY = 'accessToken';

let loginPromise: Promise<string> | null = null;

export function getAccessToken(): string {
  return wx.getStorageSync(TOKEN_KEY) || '';
}

export function getUserId(): string {
  return wx.getStorageSync('userId') || '';
}

function exchangeCode(code: string): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}/auth/wechat`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { code },
      success: (res: any) => {
        const body = res.data as {
          success?: boolean;
          data?: { token?: string; userId?: string };
          error?: string;
        };
        if (res.statusCode >= 200 && res.statusCode < 300 && body?.success && body.data?.token) {
          wx.setStorageSync(TOKEN_KEY, body.data.token);
          if (body.data.userId) {
            wx.setStorageSync('userId', body.data.userId);
          }
          resolve(body.data.token);
          return;
        }
        reject(new Error(body?.error || `登录失败 (${res.statusCode})`));
      },
      fail: (err) => {
        reject(new Error(err.errMsg || '网络请求失败'));
      },
    });
  });
}

function doLogin(): Promise<string> {
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
export function ensureLoggedIn(): Promise<void> {
  if (getAccessToken()) {
    return Promise.resolve();
  }
  if (!loginPromise) {
    loginPromise = doLogin().then(
      (token) => {
        loginPromise = null;
        return token;
      },
      (err) => {
        loginPromise = null;
        throw err;
      }
    );
  }
  return loginPromise.then(() => undefined);
}
