import { ensureLoggedIn } from './services/auth';
import { setupVersionUpdate } from './services/update';

App({
  onLaunch() {
    setupVersionUpdate();
    ensureLoggedIn().catch((err) => {
      console.error('微信登录失败', err);
    });
  },
  globalData: {},
});