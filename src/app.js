// app.js
App({
  onLaunch() {
    const logs = wx.getStorageSync('logs') || [];
    logs.unshift(Date.now());
    wx.setStorageSync('logs', logs);
    wx.login({ success: () => {} });
  },
  globalData: {},
});