import { ensureLoggedIn } from './services/auth';

App({
  onLaunch() {
    ensureLoggedIn().catch((err) => {
      console.error('微信登录失败', err);
    });
  },
  globalData: {},
});
