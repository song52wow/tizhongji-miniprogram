const test = require('node:test');
const assert = require('node:assert');

const SERVICE_PATH = require.resolve('../src/services/update.js');

function loadService() {
  delete require.cache[SERVICE_PATH];
  return require(SERVICE_PATH);
}

function createManager() {
  const listeners = {};
  const manager = {
    onCheckForUpdate: (cb) => {
      listeners.onCheckForUpdate = cb;
    },
    onUpdateReady: (cb) => {
      listeners.onUpdateReady = cb;
    },
    onUpdateFailed: (cb) => {
      listeners.onUpdateFailed = cb;
    },
    applyUpdate: () => {},
  };
  return { manager, listeners };
}

test.beforeEach(() => {
  delete global.wx;
});

test.afterEach(() => {
  delete global.wx;
  delete require.cache[SERVICE_PATH];
});

test('setupVersionUpdate 不会在 wx.getUpdateManager 不支持时抛出', () => {
  // 情形 1：wx 全局未定义
  const noWxModule = loadService();
  assert.doesNotThrow(() => noWxModule.setupVersionUpdate());

  // 情形 2：wx 存在但 wx.getUpdateManager 不是函数
  global.wx = { showModal: () => {} };
  const partialWxModule = loadService();
  assert.doesNotThrow(() => partialWxModule.setupVersionUpdate());
});

test('setupVersionUpdate 注册 onCheckForUpdate、onUpdateReady、onUpdateFailed 三个监听', () => {
  const { manager, listeners } = createManager();
  global.wx = {
    getUpdateManager: () => manager,
    showModal: () => {},
  };
  const { setupVersionUpdate } = loadService();
  setupVersionUpdate();

  assert.strictEqual(typeof listeners.onCheckForUpdate, 'function');
  assert.strictEqual(typeof listeners.onUpdateReady, 'function');
  assert.strictEqual(typeof listeners.onUpdateFailed, 'function');
});

test('ready 回调弹窗文案匹配且确认后 applyUpdate 恰好一次', () => {
  let applyCalls = 0;
  let modalArgs = null;
  const { manager, listeners } = createManager();
  manager.applyUpdate = () => {
    applyCalls += 1;
  };
  global.wx = {
    getUpdateManager: () => manager,
    showModal: (opts) => {
      modalArgs = opts;
      opts.success({ confirm: true });
    },
  };

  const { setupVersionUpdate } = loadService();
  setupVersionUpdate();
  listeners.onUpdateReady();

  assert.strictEqual(modalArgs.title, '更新提示');
  assert.strictEqual(modalArgs.content, '新版本已准备好，请重启小程序完成更新');
  assert.strictEqual(modalArgs.showCancel, false);
  assert.strictEqual(modalArgs.confirmText, '立即更新');
  assert.strictEqual(applyCalls, 1);
});

test('failed 回调弹窗文案匹配且不调用 applyUpdate', () => {
  let applyCalls = 0;
  let modalArgs = null;
  const { manager, listeners } = createManager();
  manager.applyUpdate = () => {
    applyCalls += 1;
  };
  global.wx = {
    getUpdateManager: () => manager,
    showModal: (opts) => {
      modalArgs = opts;
    },
  };

  const { setupVersionUpdate } = loadService();
  setupVersionUpdate();
  listeners.onUpdateFailed();

  assert.strictEqual(modalArgs.title, '更新失败');
  assert.strictEqual(modalArgs.content, '新版本下载失败，请关闭小程序后重新打开');
  assert.strictEqual(modalArgs.showCancel, false);
  assert.strictEqual(modalArgs.confirmText, '我知道了');
  assert.strictEqual(applyCalls, 0);
});

test('wx.getUpdateManager 同步抛错不向外传播', () => {
  global.wx = {
    getUpdateManager: () => {
      throw new Error('boom-getUpdateManager');
    },
    showModal: () => {},
  };
  const { setupVersionUpdate } = loadService();
  assert.doesNotThrow(() => setupVersionUpdate());
});

test('wx.showModal 同步抛错时 ready/failed 回调不向外传播', () => {
  const { manager, listeners } = createManager();
  global.wx = {
    getUpdateManager: () => manager,
    showModal: () => {
      throw new Error('boom-showModal');
    },
  };

  const { setupVersionUpdate } = loadService();
  setupVersionUpdate();

  assert.doesNotThrow(() => listeners.onUpdateReady());
  assert.doesNotThrow(() => listeners.onUpdateFailed());
});