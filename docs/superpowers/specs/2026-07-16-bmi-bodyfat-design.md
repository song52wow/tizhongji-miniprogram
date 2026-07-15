# 设计：微信小程序 BMI 计算 + 体脂率记录

日期：2026-07-16
状态：已确认，进入实现

## 1. 需求与范围

- 平台主体：微信小程序（`tizhongji-miniprogram`）。
- 后端 `tizhongji-service` 为共享服务，同时服务 Flutter App，所有改动必须**向后兼容**：新增数据库列可空、新增接口不影响既有接口。
- 三块能力：
  1. 设置并持久化用户身高（BMI 计算所需）。
  2. 记录体重时可选填体脂率。
  3. 在记录页/首页/趋势页展示 BMI 与体脂率。

## 2. 关键设计决策（已与用户确认）

| 决策 | 选择 |
|------|------|
| 身高来源 | 新增「我的/设置」页录入 |
| 身高持久化 | 后端存储，新增 `/profile` 接口（`user_profiles` 表） |
| 体脂率存储 | `weight_records` 新增可空列 `body_fat` |
| BMI 分级标准 | 中国标准 |
| 展示位置 | 记录页录入体脂率 + 实时 BMI；首页展示当前 BMI/体脂；趋势页加入体脂率曲线 |

## 3. 后端设计（tizhongji-service）

### 3.1 用户资料表与接口（存身高）

新增表：
```sql
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,
  height REAL,              -- 单位 cm，可空表示未设置
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

接口：
- `GET /profile` → `{ success: true, data: { height: number | null } }`（无记录返回 `height: null`）
- `PUT /profile` body `{ height: number | null }` → upsert，返回同上
- 校验：`height` 若非 null 必须为有限数字且 `50 ≤ height ≤ 250`（cm）。

实现：新增 `src/profile.ts`（`getProfile` / `upsertProfile` + 校验），在 `server.ts` 增加两条路由（沿用现有按 path 段匹配 + 鉴权模式）。

### 3.2 体脂率列（weight_records）

- 迁移：`initSchema` 内对 `weight_records` 做幂等迁移——通过 `PRAGMA table_info(weight_records)` 检查是否已有 `body_fat`，无则 `ALTER TABLE weight_records ADD COLUMN body_fat REAL;`
- 类型：`CreateWeightRecordInput`、`DailyWeightRecord` 增 `bodyFat?: number`。
- `upsertWeightRecord`：读写 `body_fat` 列。
- `toDailyWeightRecord`：映射 `body_fat`（null → undefined）。
- 校验：`bodyFat` 若提供必须为有限数字且 `0 < bodyFat ≤ 75`（%）。
- BMI **不入库**，由 weight + height 前端计算，避免冗余。

## 4. 前端设计（tizhongji-miniprogram）

### 4.1 新增「我的」页 `pages/profile/index`
- tabBar 新增第 5 项「我的」。
- 图标：新增 `images/profile.png` / `images/profile-selected.png`（若暂无素材，先复用现有图标占位并标 TODO，不阻塞逻辑）。
- 交互：进入读 `GET /profile` 回填；输入身高（数字键盘，cm），保存调 `PUT /profile`，成功 toast。
- 身高同时写入本地缓存 `wx.setStorageSync('userHeight', ...)` 作为记录页快速读取来源。

### 4.2 `services/api.ts`
- 新增 `getProfile()` / `updateProfile(height)`。
- `WeightRecord` 模型增 `bodyFat?: number`；`createWeightRecord` 参数与 `getWeightRecords` 返回支持 `bodyFat`。

### 4.3 `utils/bmi.ts`（新增，纯函数，可单测）
- `calcBmi(weightKg, heightCm): number | null` —— 身高无效返回 null；结果保留 1 位小数。
- `bmiCategory(bmi): { label, level }` —— 中国标准：
  - 偏瘦 `< 18.5`
  - 正常 `18.5 – 23.9`
  - 超重 `24 – 27.9`
  - 肥胖 `≥ 28`

### 4.4 记录页 `pages/record`
- 体重输入下方新增「体脂率(%)」可选输入框（最多一位小数，范围 0–75）。
- 输入体重后实时显示「BMI 22.3 · 正常」（读缓存身高，回落 `GET /profile`）；无身高时显示引导「设置身高后自动计算」。
- 保存时携带 `bodyFat`。

### 4.5 首页 `pages/home`
- 最新记录卡片增加 BMI（含分级色）与体脂率展示；无身高/无数据时优雅降级。

### 4.6 趋势页 `pages/trend`
- 体重曲线下新增体脂率曲线，复用现有 canvas 绘制逻辑；无体脂数据时隐藏该图。

## 5. 数据流

```
我的页 → PUT /profile(height) → SQLite user_profiles
记录页 → 读 height（缓存优先，回落 GET /profile）→ 本地算 BMI；保存 POST /weight-records(含 bodyFat)
首页/趋势页 → GET /weight-records(含 bodyFat) + height → 本地算 BMI / 画曲线
```

## 6. 兼容性与错误处理
- Flutter 端：`body_fat` 列可空、`/profile` 为新接口，旧端不受影响。
- 无身高时 BMI 区域显示引导文案，不报错。
- 体脂率非必填；前后端范围/精度校验一致。

## 7. 测试
- 后端单测：`profile` CRUD 与校验；`weight_records` 带/不带 `bodyFat` 的 upsert；迁移幂等性。
- 前端：`utils/bmi.ts` 分级边界值单测。

## 8. 不做（YAGNI）
- 体脂率健康分级（男女标准差异大，先只记录+画曲线）。
- 身高历史、体重目标、性别等扩展资料，本次只加 height。
