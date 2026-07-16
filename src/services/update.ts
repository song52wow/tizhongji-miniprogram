/**
 * 小程序版本更新服务
 * 封装 wx.getUpdateManager，处理检查更新、下载完成、下载失败三种回调。
 */

interface UpdateManagerLike {
  onCheckForUpdate: (callback: (res: { hasUpdate: boolean }) => void) => void;
  onUpdateReady: (callback: () => void) => void;
  onUpdateFailed: (callback: () => void) => void;
  applyUpdate: () => void;
}

interface ShowModalOptions {
  title: string;
  content: string;
  showCancel: boolean;
  confirmText: string;
  success?: (res: { confirm: boolean; cancel: boolean }) => void;
}

function safeShowModal(options: ShowModalOptions): void {
  const globalWx: any = (typeof wx !== 'undefined') ? wx : undefined;
  if (!globalWx || typeof globalWx.showModal !== 'function') {
    return;
  }
  try {
    globalWx.showModal(options);
  } catch (error) {
    console.error('showModal 调用失败', error);
  }
}

export function setupVersionUpdate(): void {
  if (typeof wx === 'undefined' || typeof (wx as any).getUpdateManager !== 'function') {
    console.warn('当前环境不支持小程序版本更新');
    return;
  }

  let updateManager: UpdateManagerLike;
  try {
    updateManager = (wx as any).getUpdateManager();
  } catch (error) {
    console.error('初始化小程序版本更新失败', error);
    return;
  }

  updateManager.onCheckForUpdate((res) => {
    console.info('检查更新结果', res.hasUpdate);
  });

  updateManager.onUpdateReady(() => {
    safeShowModal({
      title: '更新提示',
      content: '新版本已准备好，请重启小程序完成更新',
      showCancel: false,
      confirmText: '立即更新',
      success: (res) => {
        if (res && res.confirm) {
          try {
            updateManager.applyUpdate();
          } catch (error) {
            console.error('applyUpdate 调用失败', error);
          }
        }
      },
    });
  });

  updateManager.onUpdateFailed(() => {
    safeShowModal({
      title: '更新失败',
      content: '新版本下载失败，请关闭小程序后重新打开',
      showCancel: false,
      confirmText: '我知道了',
    });
  });
}