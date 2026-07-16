# 设计：微信小程序版本更新通知

日期：2026-07-16
状态：已确认，待实施计划

## 1. 需求与范围

- 平台：仅微信小程序（`tizhongji-miniprogram`）。
- 目标：小程序冷启动时接入微信原生版本更新机制；新版本下载完成后，强制提示用户立即重启更新。
- 更新下载失败时，提示用户关闭小程序后重新打开。
- 未发现新版本时不显示提示，不干扰正常启动。
- 不新增后端 API，不保存版本状态，不制作自定义弹窗页面。

本功能明确为**微信小程序平台独占**：它依赖 `wx.getUpdateManager()` 和小程序代码包更新生命周期，Flutter App 不存在对应运行机制，因此无需在 `tizhongji-app` 中实现。

## 2. 关键设计决策

| 决策 | 选择 |
|------|------|
| 更新机制 | 微信原生 `wx.getUpdateManager()` |
| 代码边界 | 独立 `src/services/update.ts` |
| 注册时机 | `App.onLaunch()` 开始时 |
| 更新就绪行为 | 不可取消的原生弹窗，确认后 `applyUpdate()` |
| 下载失败行为 | 原生弹窗提示关闭并重新打开 |
| 无更新行为 | 静默，不显示提示 |
| 后端依赖 | 无 |

## 3. 架构与组件

### 3.1 更新服务

新增 `src/services/update.ts`，导出：

```typescript
export function setupVersionUpdate(): void;
```

职责：

1. 检测 `wx.getUpdateManager` 是否可用。
2. 获取 `UpdateManager` 实例。
3. 注册 `onCheckForUpdate`、`onUpdateReady` 和 `onUpdateFailed` 监听。
4. 负责更新就绪与下载失败时的原生弹窗。
5. 隔离并记录初始化或弹窗异常，避免影响 App 启动。

该服务不负责登录、网络请求、版本比较或持久化。

### 3.2 App 启动入口

修改 `src/app.ts`：

1. 导入 `setupVersionUpdate`。
2. 在 `onLaunch()` 开始时同步调用 `setupVersionUpdate()`。
3. 保留现有 `ensureLoggedIn()` 调用与错误处理。

更新注册和登录流程互不依赖。更新能力异常不得阻止登录执行。

TypeScript 编译后同步提交生成的 `src/services/update.js` 与 `src/app.js`。

## 4. 数据流与交互

```text
App.onLaunch()
  ├─ setupVersionUpdate()
  │    ├─ wx.getUpdateManager()
  │    ├─ onCheckForUpdate → 仅记录检查结果
  │    ├─ onUpdateReady → 强制更新弹窗 → 用户确认 → applyUpdate()
  │    └─ onUpdateFailed → 失败提示弹窗
  └─ ensureLoggedIn() → 现有登录流程
```

### 4.1 检查更新

`onCheckForUpdate` 只记录 `hasUpdate`：

- `hasUpdate: false`：不显示任何提示。
- `hasUpdate: true`：等待微信完成代码包下载，不提前打扰用户。

### 4.2 更新就绪

`onUpdateReady` 触发后调用 `wx.showModal`：

- 标题：`更新提示`
- 内容：`新版本已准备好，请重启小程序完成更新`
- `showCancel: false`
- 确认按钮：`立即更新`

用户确认后调用一次 `updateManager.applyUpdate()`，由微信重启小程序并加载新代码包。

### 4.3 更新失败

`onUpdateFailed` 触发后调用 `wx.showModal`：

- 标题：`更新失败`
- 内容：`新版本下载失败，请关闭小程序后重新打开`
- `showCancel: false`
- 确认按钮：`我知道了`

微信 `UpdateManager` 不提供业务侧强制重新下载接口，因此本次不实现自动重试。

## 5. 兼容性与错误处理

- 当前项目基础库版本为 `3.15.2`，支持 `wx.getUpdateManager()`。
- 仍进行能力检测：当 `wx.getUpdateManager` 不是函数时，输出 `console.warn` 并安全返回。
- 获取 `UpdateManager` 或注册监听发生同步异常时，捕获并输出 `console.error`。
- `wx.showModal` 调用失败时记录错误，不向 App 生命周期继续抛出。
- 只有微信明确触发 `onUpdateFailed` 时才显示下载失败提示。
- `App.onLaunch()` 每个小程序进程只执行一次，不增加额外去重状态。

## 6. 测试与验收

新增 `tests/update.test.js`，通过 mock `wx` 与 `UpdateManager` 验证：

1. 不支持 `getUpdateManager` 时安全返回，不抛出异常。
2. 正确注册 `onCheckForUpdate`、`onUpdateReady`、`onUpdateFailed`。
3. 更新就绪后显示不可取消弹窗。
4. 用户确认后只调用一次 `applyUpdate()`。
5. 下载失败后显示指定失败文案，且不调用 `applyUpdate()`。
6. 初始化或弹窗异常不会从 `setupVersionUpdate()` 向外抛出。

提交前运行：

```bash
npm test
npm run build
```

运行时验收使用微信开发者工具的“下次编译模拟更新”能力：

1. 冷启动小程序并模拟存在新版本。
2. 等待代码包下载完成，观察不可取消的“更新提示”弹窗。
3. 点击“立即更新”，确认小程序重启。
4. 模拟更新下载失败，确认显示“更新失败”提示。
5. 无新版本时，确认启动过程不显示更新提示。

当前开发机的微信开发者工具 CLI 因服务端口未开启、未生成 `.ide` 端口文件而无法自动捕获模拟器截图；这属于本机验收环境限制，不作为功能通过的证据。实现完成后若该限制仍存在，运行时验收将标记为受阻，不以构建或单元测试替代运行时验证。

## 7. 不做（YAGNI）

- 不新增后端版本配置或最低版本接口。
- 不实现灰度发布、跳过版本或更新频率控制。
- 不自定义更新弹窗 UI。
- 不在未发现更新时提示“已是最新版本”。
- 不为 Flutter App 增加与微信代码包机制无关的占位功能。
