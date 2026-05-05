# 微信小程序适配方案

## 1. 概述

本文档描述将现有 Flutter 体重记录应用适配为微信小程序的技术方案。Flutter 版本与小程序版本共用同一套后端 API（端口 3000），前端逻辑和 UI 需要针对小程序技术栈重新实现。

---

## 2. 技术选型

| 维度 | Flutter | 微信小程序 |
|---|---|---|
| 框架 | Flutter SDK | 微信小程序框架 |
| 语言 | Dart | TypeScript (推荐) / JavaScript |
| 视图 | Widget tree | WXML (类 HTML) |
| 样式 | Dart 代码 | WXSS (类 CSS) |
| 状态管理 | StatefulWidget / setState | setData + Component / 原生 setData |
| 图表 | fl_chart | ECharts (小程序版) / wx-charts |
| HTTP | http package | wx.request |
| 本地存储 | shared_preferences | wx.getStorageSync / getStorage |
| 路由 | Navigator 1.0 | 小程序页面栈 (navigateTo/redirectTo) |
| 构建工具 | flutter build | npm run build 或 miniprogram-ci |

**推荐技术栈：**
- **语言**：TypeScript（类型安全，更接近 Dart 体验）
- **样式方案**：原生 WXSS + 设计 token 变量（通过 JS 常量共享颜色/尺寸）
- **图表**：ECharts for微信小程序（功能完整，社区活跃）
- **组件化**：原生小程序 Component 构造器（支持 behaviors、多个插槽）
- **状态管理**：简单场景用 Page + setData，复杂场景可引入 MobX-mini 或 alita
- **构建工具**：Vite + miniprogram-compiler 或直接使用微信开发者工具

---

## 3. 目录结构

```
tizhongji-miniprogram/
├── src/
│   ├── app.ts                 # App 入口
│   ├── app.wxss               # 全局样式
│   ├── app.json               # 全局配置
│   ├── pages/
│   │   ├── home/              # 首页
│   │   │   ├── index.ts
│   │   │   ├── index.wxml
│   │   │   ├── index.wxss
│   │   │   └── index.json
│   │   ├── record/            # 记录页
│   │   ├── history/           # 历史页
│   │   └── trend/             # 趋势页
│   ├── components/            # 公共组件
│   │   ├── weight-card/       # 体重卡片组件
│   │   ├── nav-bar/           # 底部导航组件
│   │   ├── range-filter/      # 时间范围筛选
│   │   └── stat-card/         # 统计卡片
│   ├── services/
│   │   └── api.ts             # API 请求封装（对应 WeightApiService）
│   ├── models/
│   │   └── weight.ts          # 数据模型（对应 weight_record.dart）
│   ├── utils/
│   │   ├── date.ts            # 日期格式化（对应 intl）
│   │   └── style.ts           # 样式 token（颜色、间距常量）
│   └── types/
│       └── global.d.ts        # 全局类型声明
├── package.json
└── tsconfig.json
```

---

## 4. 页面详细设计

### 4.1 首页（home）

**功能**：展示今日早晨/晚上体重、7天趋势简图、快捷记录入口、底部导航

**WXML 结构**：
```
- scroll-view（内容区）
  - view（日期标题：今天 + M月d日, EEEE）
  - view（早晨体重卡片）
    - view（卡片头部：sun图标 + 早晨体重标签 + 时间）
    - view（体重数字：48px，蓝色主色）
    - view（变化提示：箭头 + +0.2kg 较昨日）
  - view（晚上体重卡片）
    - view（卡片头部：moon图标 + 晚上体重标签 + 时间）
    - view（体重数字：48px）
    - view（变化提示：+0.5kg 较早晨）
  - view（近7天趋势卡片）
    - view（标题 + 箭头图标）
    - ec-canvas（折线图：fl_chart 的小程序替代）
    - view（日期范围标签）
- button（悬浮添加按钮：56x56，蓝色圆角16px）
- component（底部导航栏）
```

**样式规格（WXSS token）**：
```
主色蓝色:     #106399
文字深色:     #191C1D
文字次要:     #41474F
背景灰色:     #F8F9FA
边框灰色:     #E1E3E4
早晨主色:     #FF8A40
早晨背景:     #FFDBC9
早晨文字:     #9B4500
晚上主色:     #9984FF
晚上背景:     #E6DEFF
晚上文字:     #6042D6
高亮蓝:       #2563EB
导航灰:       #94A3B8

卡片间距:     16px
卡片内边距:   25px
圆角:        12px
阴影:        0px 4px 12px rgba(16,99,153,0.08)
字体大小:     48px（体重数字）, 32px（页面标题）, 16px（正文）, 12px（标签）
```

**数据来源**：
- 早晨体重：调用 `GET /weight-records?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&period=morning`，取当天 morning 记录
- 晚上体重：同上，period=evening
- 7天趋势：调用 `GET /weight-records?startDate=7天前&endDate=今天`，取所有 morning 记录用于图表

**交互**：
- 悬浮按钮点击 → navigateTo /pages/record/index
- 底部导航切换页面

---

### 4.2 记录页（record）

**功能**：选择日期、选择时段（早晨/晚上）、输入体重、填写备注、保存

**WXML 结构**：
```
- scroll-view
  - view（页面标题：记录体重）
  - view（输入卡片）
    - view（日期选择行）
      - text（日期标签：日期）
      - picker（mode=date，value=选中日期，显示格式 d/m/yyyy）
    - view（时段切换行）
      - view（早晨选项，点击切换，橙色激活态）
        - icon（sun）
        - text（早晨）
      - view（晚上选项，点击切换，紫色激活态）
        - icon（moon）
        - text（晚上）
    - view（体重输入区）
      - input（type=digit，placeholder=0.0，font-size=48，蓝色，suffix=kg）
    - view（备注输入区）
      - textarea（maxlength=200，placeholder=添加记录备注...，高度61px）
  - view（保存按钮）
    - icon（check）
    - text（保存记录）
- component（底部导航栏）
```

**样式规格**：
- 日期选择行：背景灰色 #EDEEEF，内边距 13px，圆角 8px
- 时段切换：灰色背景胶囊容器，4px 内边距，选项圆角 6px，激活时填充颜色
- 早晨激活色：#9B4500 背景，白色文字
- 晚上激活色：#6042D6 背景，白色文字
- 体重输入：背景灰色，内边距 13px 上下 42px，数字居中 48px 蓝色 #106399
- 保存按钮：全宽，高度 16px*2+16=48px，蓝色背景 #106399，圆角 999px，上方间距 12px
- 底部间距：120px（给底部导航留空间）

**交互**：
- 日期 picker：调用 `wx.showDatePicker`，限制 lastDate 为今天
- 时段切换：更新当前选中的 period，重新加载该时段已有记录（如果存在）
- 保存按钮：调用 `POST /weight-records`，成功后 `wx.navigateBack()`
- 已有记录提示：调用 API 查询当天同时段记录，若存在则显示"已有记录，更新将覆盖"（灰色小字，8px 间距）

**校验规则（对应 Flutter 端）**：
- 体重为空：提示"请输入体重"
- 体重格式错误：提示"体重数值格式不正确"
- 体重范围：20.0~300.0 kg
- 备注长度：最多 200 字符

---

### 4.3 历史页（history）

**功能**：历史记录列表（早晚分离）、通知中心 Tab、编辑/删除操作

**WXML 结构**：
```
- scroll-view
  - view（页面标题：中心控制台）
  - view（副标题：查看您的活动足迹与系统提醒）
  - view（Tab 切换栏）
    - view（历史记录 Tab，点击切换 active）
    - view（通知中心 Tab，点击切换 active）
  - view（Tab 内容区）
    - list（记录列表）
      - view（每条记录，点击进入编辑）
        - view（左侧图标：圆圈 + sun/moon）
        - view（中间：日期 + 备注（如果有））
        - view（右侧：体重数字 + kg）
    - view（空状态：无记录时显示"暂无记录"）
  - view（加载更多按钮）
- view（通知中心内容，同上 Tab 结构）
  - icon（通知图标，大尺寸灰色）
  - text（暂无通知）
- component（底部导航栏）
```

**样式规格**：
- Tab 切换：灰色胶囊容器，圆角 999px，4px 内边距，白色背景表示选中状态，带轻微阴影
- 记录列表项：灰色背景 #F8F9FA，边框 #E1E3E4，内边距 13px，圆角 8px
- 早晨图标：橙色圆圈背景 #FFDBC9，内含 sun 图标，橙色文字 #9B4500
- 晚上图标：紫色圆圈背景 #E6DEFF，内含 moon 图标，紫色文字 #6042D6
- 列表项间距：12px
- 列表内图标与文字间距：24px
- 记录项高度：48px 图标 + 文字行

**交互**：
- 列表点击：navigateTo /pages/record/index?date=YYYY-MM-DD
- 列表滚动到底部：加载更多（调用 `GET /weight-records?page=N`）
- 编辑后返回：调用 `setData({ page: 1 })` 重新加载
- 删除：确认对话框后调用 `DELETE /weight-records/:id`，成功后从列表移除

---

### 4.4 趋势页（trend）

**功能**：时间范围筛选、体重双线趋势图、统计卡片网格

**WXML 结构**：
```
- scroll-view
  - view（页面标题：趋势与统计）
  - view（副标题：观察您的长期进展与规律）
  - view（时间范围筛选器）
    - view（7天，按钮）
    - view（30天，按钮，选中态）
    - view（90天，按钮）
    - view（全部，按钮）
  - view（体重变化趋势卡片）
    - view（标题行：体重变化趋势 + 图例（早晨/夜晚色块））
    - ec-canvas（双线折线图：早晨橙色 #FC8A40，夜晚紫色 #9984FF）
  - view（统计网格，Bento 布局）
    - view（平均早体重卡片，2列布局）
    - view（平均晚体重卡片）
    - view（体重变化卡片，横向跨2列，蓝色背景）
    - view（最低体重卡片）
    - view（最高体重卡片）
    - view（平均早晚差值卡片）
- component（底部导航栏）
```

**样式规格**：
- 统计卡片圆角：20px
- 统计卡片内边距：25px
- 体重变化卡片：背景 rgba(90,155,213,0.1)，边框 rgba(90,155,213,0.2)
- 网格间距：16px
- 卡片阴影：0px 4px 8px rgba(16,99,153,0.04)
- 统计数字：48px（平均体重），32px（其他），粗体
- 标签色：平均早体重橙色，平均晚体重紫色，体重变化蓝色，其他灰色

**数据来源**：
- 趋势数据：调用 `GET /weight-records?startDate=rangeStart&endDate=today`，分别提取 morning/evening 记录
- 统计数据：调用 `GET /weight-records/stats?startDate=rangeStart&endDate=today`
- 图表需要将日期转换为 x 轴索引

**图表规格（ECharts 配置）**：
- 类型：折线图（line）
- X 轴：日期，按时间顺序
- Y 轴：体重（kg），自动适配数据范围
- 两条线：橙色（早晨）、紫色（夜晚）
- 数据点：圆点，半径 5px，白色描边
- 曲线：平滑曲线
- 区域填充：透明度 8%
- X 轴标签：M月d日格式

---

## 5. 通用组件

### 5.1 底部导航栏（nav-bar）

**位置**：固定在底部，高度 80px

**WXML**：
```
<view class="nav-bar">
  <view wx:for="{{tabs}}" wx:key="index" class="nav-item" bindtap="onTabTap" data-index="{{index}}">
    <text class="nav-icon {{item.icon}}"></text>
    <text class="nav-label">{{item.label}}</text>
  </view>
</view>
```

**数据**：
```
tabs: [
  { label: '总览', icon: 'dashboard' },
  { label: '记录', icon: 'edit' },
  { label: '趋势', icon: 'chart' },
  { label: '动态', icon: 'feed' },
]
```

**样式**：
- 背景：白色，透明度 230/255，顶部边框 #E2E8F0
- 阴影：0px -4px 6px rgba(90,155,213,0.08)
- 4 等分，每个占 1/4 宽度
- 图标大小：18px（默认），20px（当前激活）
- 文字大小：12px
- 激活态：蓝色 #2563EB，未激活：灰色 #94A3B8

### 5.2 体重卡片（weight-card）

通用卡片组件，接收 props：
- `period`: 'morning' | 'evening'
- `weight`: number | null
- `changeText`: string
- `iconColor`: 背景色和文字色根据 period 自动计算

### 5.3 统计卡片（stat-card）

接收 props：
- `label`: 标题文本
- `value`: 数值（支持 null 显示 --）
- `unit`: 单位（kg）
- `subText`: 副文本（如日期或状态描述）
- `accentColor`: 主题色（用于早晨橙色、晚上紫色、体重变化蓝色等）
- `icon`: 图标类型

---

## 6. API 层适配

Flutter 的 `WeightApiService` 映射为小程序 `services/api.ts`：

```typescript
// services/api.ts
const BASE_URL = 'http://localhost:3000'; // 小程序需在后台域名配置白名单

interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'DELETE';
  data?: any;
  header?: Record<string, string>;
}

function request<T>(options: RequestOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        'X-User-Id': wx.getStorageSync('userId') || '',
        ...options.header,
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data as T);
        } else {
          reject(new Error((res.data as any).error || '请求失败'));
        }
      },
      fail: reject,
    });
  });
}

// 对应 getWeightRecords
export function getWeightRecords(params: {
  userId: string;
  startDate?: string;
  endDate?: string;
  period?: string;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.period) query.set('period', params.period);
  query.set('page', String(params.page || 1));
  query.set('pageSize', String(params.pageSize || 100));
  return request<{ items: WeightRecord[], total: number }>({
    url: `/weight-records?${query.toString()}`,
  });
}

// 对应 createWeightRecord
export function createWeightRecord(params: {
  userId: string;
  date: string;
  period: 'morning' | 'evening';
  weight: number;
  note?: string;
}) {
  return request<WeightRecord>({
    url: '/weight-records',
    method: 'POST',
    data: params,
  });
}

// 对应 getWeightStats
export function getWeightStats(params: { userId: string; startDate?: string; endDate?: string }) {
  const query = new URLSearchParams();
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  return request<WeightStats>({
    url: `/weight-records/stats?${query.toString()}`,
  });
}

// 对应 deleteWeightRecord
export function deleteWeightRecord(id: string, userId: string) {
  return request<{ success: boolean }>({
    url: `/weight-records/${id}`,
    method: 'DELETE',
  });
}
```

---

## 7. 数据模型

```typescript
// models/weight.ts

export type WeightPeriod = 'morning' | 'evening';

export interface WeightRecord {
  id: string;
  userId: string;
  date: string;        // YYYY-MM-DD
  period: WeightPeriod;
  weight: number;      // kg，精确到 0.1
  note?: string;
  createdAt: string;
  updatedAt: string;
  weightDiff?: number; // evening - morning，仅当同日同时存在早晚记录时
}

export interface WeightStats {
  avgMorningWeight: number | null;
  avgEveningWeight: number | null;
  minWeight: number | null;
  maxWeight: number | null;
  change: number | null;
  avgWeightDiff: number | null;
}
```

---

## 8. 样式 token

```typescript
// utils/style.ts

export const colors = {
  bluePrimary: '#106399',
  textDark: '#191C1D',
  textMuted: '#41474F',
  bgGray: '#F8F9FA',
  bgGrayDeep: '#EDEEEF',
  borderGray: '#E1E3E4',
  morningOrange: '#FC8A40',
  morningOrangeBg: '#FFDBC9',
  morningText: '#9B4500',
  eveningPurple: '#9984FF',
  eveningPurpleBg: '#E6DEFF',
  eveningText: '#6042D6',
  accentBlue: '#2563EB',
  navGray: '#94A3B8',
  deleteRed: '#BA1A1A',
};

export const spacing = {
  pagePadding: 20,
  cardPadding: 25,
  cardRadius: 12,
  cardRadiusLarge: 20,
  cardRadiusSmall: 8,
  cardGap: 16,
  navHeight: 80,
  fabSize: 56,
};

export const typography = {
  pageTitle: 32,
  cardTitle: 24,
  statNumberLarge: 48,
  statNumberMedium: 32,
  body: 16,
  caption: 12,
  cardTitleBottom: 18,
};
```

WXSS 中引用：`@import '../../utils/style.wxss';` 或通过 JS 导入 color 值动态设置。

---

## 9. 关键差异点

| 差异 | Flutter 实现 | 小程序适配方案 |
|---|---|---|
| 图表 | fl_chart | ECharts for微信小程序，ec-canvas 组件 |
| 字体大小 | TextStyle(fontSize: 48) | text { font-size: 48px } |
| 颜色 | Color(0xFF106399) | #106399 |
| 间距 | EdgeInsets.fromLTRB(20,24,20,100) | padding: 24px 20px 100px; |
| 圆角 | BorderRadius.circular(12) | border-radius: 12px; |
| 阴影 | BoxShadow(color: ..., blurRadius: 12) | box-shadow: 0px 4px 12px rgba(...); |
| 状态管理 | setState(() => ...) | this.setData({ ... }) |
| 生命周期 | initState() | onLoad() |
| 导航 | Navigator.push / pop | wx.navigateTo / wx.navigateBack |
| Tab 切换 | TabController + TabBarView | 两个 view 条件渲染或 scroll-view 分屏 |
| 空状态 | 无数据时显示文本 | wx:if="{{records.length === 0}}" 显示空状态 |
| 日期格式化 | intl 的 DateFormat | 自定义函数 formatDate(date, format) |
| 输入限制 | FilteringTextInputFormatter | input type="digit" + confirm-type="done" |
| 下拉刷新 | — | scroll-view 搭配 bindscrolltoupper + wx.showNavigationBarLoading |
| 加载更多 | ListView.builder | scroll-view 搭配 bindscrolltolower |

---

## 10. 开发任务清单

### 阶段一：项目初始化
1. 创建小程序项目（app.json 配置 + 页面注册）
2. 配置全局样式和样式 token
3. 安装 ECharts 微信小程序版依赖

### 阶段二：公共层
4. 实现 API 请求封装（services/api.ts）
5. 实现数据模型（models/weight.ts）
6. 实现工具函数（date.ts、style.ts）
7. 开发通用组件：底部导航栏、体重卡片、统计卡片、时间范围筛选器

### 阶段三：页面开发
8. 开发首页（home）：今日体重卡片 + 趋势简图
9. 开发记录页（record）：日期选择 + 时段切换 + 体重输入 + 保存
10. 开发历史页（history）：记录列表 + 分页加载
11. 开发趋势页（trend）：时间筛选 + 双线图表 + 统计网格

### 阶段四：联调与优化
12. 后端联调（域名白名单配置）
13. 底部导航页面跳转逻辑
14. 样式验收（对比 Figma 设计）
15. 微信开发者工具真机测试