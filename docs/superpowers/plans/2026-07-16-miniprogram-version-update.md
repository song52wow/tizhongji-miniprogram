# 微信小程序版本更新通知 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在微信小程序冷启动时注册原生版本更新监听，新包下载完成后强制提示立即重启，下载失败时提示用户关闭后重新打开。

**Architecture:** 将微信 `UpdateManager` 逻辑隔离在 `src/services/update.ts` 的 `setupVersionUpdate()` 中，`App.onLaunch()` 只负责调用该服务并继续现有登录流程。Node.js 单测通过 mock `wx`、`UpdateManager` 和 CommonJS 模块缓存验证更新行为及启动接线，TypeScript 编译生成并提交对应 JavaScript。

**Tech Stack:** 微信小程序原生 API、TypeScript 6、CommonJS、Node.js `node:test`、`miniprogram-build`

**项目强制要求：** 开始修改前必须调用 `/codex:rescue` 参与前端实现；插件调用失败则停止，不得绕过。工作目录为 `tizhongji-miniprogram`。

---

## 文件结构

- 新建 `src/services/update.ts`：封装 `UpdateManager` 注册、更新就绪弹窗、失败弹窗和异常隔离。
- 生成 `src/services/update.js`：由 `npm run build:ts` 从 TypeScript 生成并纳入提交。
- 修改 `src/app.ts`：在 `onLaunch()` 开始时调用 `setupVersionUpdate()`。
- 生成修改 `src/app.js`：由 `npm run build:ts` 生成并纳入提交。
- 新建 `tests/update.test.js`：测试更新服务的能力检测、监听注册、强制更新、失败提示和异常隔离。
- 新建 `tests/app.test.js`：测试 App 启动时先注册更新监听，再执行现有登录流程。

### Task 1: 以 TDD 实现独立 UpdateManager 服务

**Files:**
- Create: `src/services/update.ts`
- Create (generated): `src/services/update.js`
- Test: `tests/update.test.js`

- [ ] **Step 1: 编写更新服务失败测试**

创建 `tests/update.test.js`：

```javascript
const test = require('node:test');
const assert = require('node:assert');

const { setupVersionUpdate } = require('../src/services/update.js');

function createHarness() {
  const handlers = {};
  let applyCount = 0;
  let modalOptions = null;

  const updateManager = {
    onCheckForUpdate(handler) {
      handlers.check = handler;
    },
    onUpdateReady(handler) {
      handlers.ready = handler;
    },
    onUpdateFailed(handler) {
      handlers.failed = handler;
    },
    applyUpdate() {
      applyCount += 1;
    },
  };

  global.wx = {
    getUpdateManager() {
      return updateManager;
    },
    showModal(options) {
      modalOptions = options;
    },
  };

  return {
    handlers,
    getApplyCount: () => applyCount,
    getModalOptions: () => modalOptions,
  };
}

function withMutedConsole(method, callback) {
  const original = console[method];
  console[method] = () => {};
  try {
    callback();
  } finally {
    console[method] = original;
  }
}

test.afterEach(() => {
  delete global.wx;
});

test('setupVersionUpdate safely skips unsupported environments', () => {
  global.wx = {};

  withMutedConsole('warn', () => {
    assert.doesNotThrow(() => setupVersionUpdate());
  });
});

test('setupVersionUpdate registers all UpdateManager listeners', () => {
  const harness = createHarness();

  setupVersionUpdate();

  assert.strictEqual(typeof harness.handlers.check, 'function');
  assert.strictEqual(typeof harness.handlers.ready, 'function');
  assert.strictEqual(typeof harness.handlers.failed, 'function');
});

test('ready update shows mandatory modal and applies update once', () => {
  const harness = createHarness();
  setupVersionUpdate();

  harness.handlers.ready();
  const modal = harness.getModalOptions();

  assert.strictEqual(modal.title, '更新提示');
  assert.strictEqual(modal.content, '新版本已准备好，请重启小程序完成更新');
  assert.strictEqual(modal.showCancel, false);
  assert.strictEqual(modal.confirmText, '立即更新');

  modal.success({ confirm: true });
  assert.strictEqual(harness.getApplyCount(), 1);
});

test('failed update shows reopen guidance without applying update', () => {
  const harness = createHarness();
  setupVersionUpdate();

  harness.handlers.failed();
  const modal = harness.getModalOptions();

  assert.strictEqual(modal.title, '更新失败');
  assert.strictEqual(modal.content, '新版本下载失败，请关闭小程序后重新打开');
  assert.strictEqual(modal.showCancel, false);
  assert.strictEqual(modal.confirmText, '我知道了');
  assert.strictEqual(harness.getApplyCount(), 0);
});

test('initialization errors do not escape setupVersionUpdate', () => {
  global.wx = {
    getUpdateManager() {
      throw new Error('initialization failed');
    },
  };

  withMutedConsole('error', () => {
    assert.doesNotThrow(() => setupVersionUpdate());
  });
});

test('modal errors do not escape update callbacks', () => {
  const harness = createHarness();
  global.wx.showModal = () => {
    throw new Error('modal failed');
  };
  setupVersionUpdate();

  withMutedConsole('error', () => {
    assert.doesNotThrow(() => harness.handlers.ready());
    assert.doesNotThrow(() => harness.handlers.failed());
  });
});
```

- [ ] **Step 2: 运行测试并确认因模块不存在而失败**

Run:

```bash
node --test tests/update.test.js
```

Expected: FAIL，错误包含 `Cannot find module '../src/services/update.js'`。

- [ ] **Step 3: 编写最小 TypeScript 实现**

创建 `src/services/update.ts`：

```typescript
interface UpdateManagerLike {
  onCheckForUpdate(callback: (result: { hasUpdate: boolean }) => void): void;
  onUpdateReady(callback: () => void): void;
  onUpdateFailed(callback: () => void): void;
  applyUpdate(): void;
}

interface ModalOptions {
  title: string;
  content: string;
  showCancel: false;
  confirmText: string;
  success?: (result: { confirm: boolean }) => void;
}

function showUpdateModal(options: ModalOptions): void {
  try {
    wx.showModal({
      ...options,
      fail: (error: unknown) => {
        console.error('版本更新弹窗显示失败', error);
      },
    });
  } catch (error) {
    console.error('版本更新弹窗显示失败', error);
  }
}

export function setupVersionUpdate(): void {
  if (typeof wx === 'undefined' || typeof wx.getUpdateManager !== 'function') {
    console.warn('当前微信版本不支持小程序更新管理');
    return;
  }

  try {
    const updateManager = wx.getUpdateManager() as UpdateManagerLike;

    updateManager.onCheckForUpdate((result) => {
      console.info('小程序版本更新检查结果', result.hasUpdate);
    });

    updateManager.onUpdateReady(() => {
      showUpdateModal({
        title: '更新提示',
        content: '新版本已准备好，请重启小程序完成更新',
        showCancel: false,
        confirmText: '立即更新',
        success: (result) => {
          if (!result.confirm) {
            return;
          }
          try {
            updateManager.applyUpdate();
          } catch (error) {
            console.error('应用小程序更新失败', error);
          }
        },
      });
    });

    updateManager.onUpdateFailed(() => {
      showUpdateModal({
        title: '更新失败',
        content: '新版本下载失败，请关闭小程序后重新打开',
        showCancel: false,
        confirmText: '我知道了',
      });
    });
  } catch (error) {
    console.error('初始化小程序版本更新失败', error);
  }
}
```

- [ ] **Step 4: 编译 TypeScript 并运行目标测试**

Run:

```bash
npm run build:ts
node --test tests/update.test.js
```

Expected: TypeScript 编译成功；`tests/update.test.js` 的 6 项测试全部 PASS。

- [ ] **Step 5: 运行完整测试集**

Run:

```bash
npm test
```

Expected: 原有 6 项 BMI 测试和新增 6 项更新服务测试全部 PASS，共 12 项。

- [ ] **Step 6: 提交更新服务**

```bash
git add src/services/update.ts src/services/update.js tests/update.test.js
git commit -m "✨ feat(update): add miniprogram update manager"
```

### Task 2: 以 TDD 接入 App 启动流程

**Files:**
- Modify: `src/app.ts:1-10`
- Modify (generated): `src/app.js:1-12`
- Test: `tests/app.test.js`

- [ ] **Step 1: 编写 App 启动接线失败测试**

创建 `tests/app.test.js`：

```javascript
const test = require('node:test');
const assert = require('node:assert');

function restoreCacheEntry(path, entry) {
  if (entry) {
    require.cache[path] = entry;
    return;
  }
  delete require.cache[path];
}

test('App onLaunch sets up version updates before login', () => {
  const appPath = require.resolve('../src/app.js');
  const authPath = require.resolve('../src/services/auth.js');
  const updatePath = require.resolve('../src/services/update.js');
  const originalApp = global.App;
  const originalAppModule = require.cache[appPath];
  const originalAuthModule = require.cache[authPath];
  const originalUpdateModule = require.cache[updatePath];
  const calls = [];
  let appConfig;

  global.App = (config) => {
    appConfig = config;
  };
  require.cache[authPath] = {
    exports: {
      ensureLoggedIn() {
        calls.push('login');
        return Promise.resolve();
      },
    },
  };
  require.cache[updatePath] = {
    exports: {
      setupVersionUpdate() {
        calls.push('update');
      },
    },
  };
  delete require.cache[appPath];

  try {
    require(appPath);
    appConfig.onLaunch();
    assert.deepStrictEqual(calls, ['update', 'login']);
  } finally {
    global.App = originalApp;
    restoreCacheEntry(appPath, originalAppModule);
    restoreCacheEntry(authPath, originalAuthModule);
    restoreCacheEntry(updatePath, originalUpdateModule);
  }
});
```

- [ ] **Step 2: 运行接线测试并确认失败**

Run:

```bash
node --test tests/app.test.js
```

Expected: FAIL，实际调用序列为 `['login']`，缺少 `'update'`。

- [ ] **Step 3: 修改 App TypeScript 入口**

将 `src/app.ts` 更新为：

```typescript
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
```

- [ ] **Step 4: 编译并运行接线测试**

Run:

```bash
npm run build:ts
node --test tests/app.test.js
```

Expected: TypeScript 编译成功；App 启动接线测试 PASS，调用顺序为 `update` 后 `login`。

- [ ] **Step 5: 运行完整测试集**

Run:

```bash
npm test
```

Expected: 全部 13 项测试 PASS。

- [ ] **Step 6: 提交 App 启动接线**

```bash
git add src/app.ts src/app.js tests/app.test.js
git commit -m "✨ feat(app): check updates on launch"
```

### Task 3: 构建与运行时验收

**Files:**
- Verify only; no expected source changes.

- [ ] **Step 1: 运行生产构建**

Run:

```bash
npm run build
```

Expected: `tsc` 与 `mp build` 均退出 0，输出包含 `All compilation tasks done!`，WXML/WXSS/JavaScript 均生成到 `dist/`。

- [ ] **Step 2: 检查提交范围和生成文件同步状态**

Run:

```bash
git status --short
git diff --check
```

Expected: 工作区无未提交文件，`git diff --check` 无输出。

- [ ] **Step 3: 尝试通过微信开发者工具 CLI 打开项目**

Run:

```bash
/Applications/wechatwebdevtools.app/Contents/MacOS/cli open \
  --project "$PWD" \
  --port 9420 \
  --lang zh
```

Expected: 开发者工具打开当前项目。若输出“工具的服务端口已关闭”，在开发者工具中进入“设置 → 安全设置”，开启服务端口后重新执行；若当前执行环境无法操作该设置，将运行时验收标记为 BLOCKED，不以测试或构建替代。

- [ ] **Step 4: 在开发者工具模拟更新就绪**

在微信开发者工具中使用“下次编译模拟更新”后重新编译。

Expected:

1. 出现标题为“更新提示”的原生弹窗。
2. 弹窗只有“立即更新”按钮，没有取消按钮。
3. 点击后小程序重启并重新加载代码包。

- [ ] **Step 5: 验证相邻路径**

在开发者工具中分别验证：

1. 无新版本时冷启动，页面正常打开且不显示更新弹窗。
2. 模拟下载失败时，出现“更新失败”弹窗，正文为“新版本下载失败，请关闭小程序后重新打开”。
3. 登录仍按原流程执行，更新监听初始化不会阻止首页加载。

Expected: 三条行为均符合设计；任何不符均判定运行时验收 FAIL。

- [ ] **Step 6: 推送当前分支**

先确认本地提交与工作区：

```bash
git status --short --branch
git log --oneline @{u}..
```

Expected: 工作区干净，输出列出设计文档和本功能的本地提交。

经当前会话已明确授权后推送：

```bash
git push origin feature/bmi-bodyfat
```

Expected: 远端 `feature/bmi-bodyfat` 更新到本功能最后一个提交。
