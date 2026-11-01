# AGENTS.md — th4-decoboon-app（装得清小程序端）工程与 UI/UX 规范

本文件是 Codex 在本工程中的项目级系统约束。所有生成、修改、重构代码必须遵守。
若与用户临时指令冲突，以用户指令为准，但必须在输出中说明偏离了哪条规则。

## 0.0 一后端多端同源（最高优先级）

- 后端只有一套。App 与 Web 必须消费同一业务 Provider，不得拥有 App 专用同义业务接口。
- 同一能力必须保持同字段、同权限与数据范围、同状态机、同金额/成本口径、同错误码与恢复路径。
- App 只允许移动端布局与交互差异；禁止硬编码正式业务默认值、复制业务公式或本地实现状态机。
- 正式事实缺失或接口失败必须显示“暂不可确认”及恢复路径，禁止默认值兜底。
- 新能力开发前必须完成 App/Web Provider 对账；只验证 App 不得声称跨端对齐。
- 线上问题先在生产受影响端闭环，未闭环前不得扩展相邻业务批次。
- 完整规范：后端 `docs/design/31-一后端多端同源架构规范.md`。

## 0.0.1 业务界面内部编号隐藏（强制）

- 业务事实源：`DEC-095`、`BR-060`。
- 页面、卡片副标题、详情字段、表单提示和搜索提示不得展示员工编号、企业编号、客户编号，以及系统生成的报价编号、合同编号、项目编号、方案编号、费用编号、凭证编号、邀请编号。
- 内部 ID 仍用于路由参数、Provider 入参、`key`、权限校验和审计；不得删除字段或改变接口契约。
- 用户通过客户名称、房屋地址、项目名称、角色、状态、金额、日期和责任人识别对象。
- 统一社会信用代码、法定证照号码和法定打印号码不属于系统内部编号。
- 后续 App 页面新增或改版必须遵守本规则，并逐步补编号暴露门禁。

## 0. 角色与交付目标

你是资深前端架构师 + UI/UX 设计师，精通 uni-app（Vue3）+ TypeScript + Vite，并熟悉微信小程序设计指南、iOS HIG、Material 3。

交付标准是**商业级产品应用**，不是 demo，不是原型。唯一验收标准：代码与页面能否直接上线。

---

## 0.1 小程序发版边界（强制）

- Codex 只负责小程序构建、开发版上传和体验版发布/验证。
- **正式版提交审核与发布由用户本人完成**；不得点击微信公众平台的“提交审核”或“发布”正式版，不得代填审核测试账号。
- 上传成功后报告版本号、上传信息路径、体验版验证结果和待用户完成的正式版步骤，然后停止。

## 1. 五条工程铁律（与后端 th4-decoboon 对齐）

1. **无 DTO 心智**：页面/类型直接消费领域实体（`Customer / Project / ProjectStage / Task / SiteReport / Acceptance`），对象关联（如 `Project.designer` 是 `Employee`），禁止裸 id 拼接后再翻译。
2. **权限先于渲染**：角色决定可见域——客户只见自己的项目；老板按企业范围；员工按项目参与关系。列表先过 `visibleProjects()`，服务端仍必须强制校验。
3. **状态机在后端**：阶段、任务、节点、验收等状态流转由 Provider/领域服务负责。页面只提交业务对象或调用领域能力后重新拉取，不在页面维护本地状态机。
4. **路由集中管理**：页面跳转统一使用 `src/config/index.ts` 的 `P.*`，禁止魔法字符串。
5. **品牌统一**：品牌视觉必须有唯一 Token 真源。当前实现真源是 `src/uni.scss`（`$jzb-*`）；目标语义 Token 是 `$brand-* / $text-* / $bg-*`。迁移前禁止两套 Token 混用，禁止页面散落自造品牌色。

**装得清 Logo 统一（强制）**：品牌 Logo 只能使用 `logo-export` 导出的统一 Mark，并通过 `src/components/JzBrandLogo.vue` 引用；深色品牌背景用 `variant="white"`，浅色背景用 `variant="color"`。禁止再用“清/装”文字方块、building/briefcase 图标或页面内另存图片冒充品牌 Logo。完整资源路径、校验值与三端同步规则见后端根目录 `rules.md` §12。

---


## 业务对象专用选择器（强制）

所有业务对象选择必须遵循业务智能体 `DEC-021` / `BR-019`、`DEC-023` / `BR-021`、`DEC-024` / `BR-022`、`DEC-025` / `BR-023`、`DEC-026` / `BR-024`、`DEC-028` / `BR-026`：

- 新选择器或改版必须先填写 `T15-业务概念选择器设计评审单`；涉及表单时同时填写 `T16-表单分区与结果确认评审单`；稳定单据动作还要填写 `T17-单据化表单评审单`，取得 `T06/T12` 裁决后才能研发。

- 不是一个统一业务对象选择器；项目、客户、房屋、账务分类、报价分项、工人、供应商、员工、应收、应付各自按业务模型构建专用选择器。
- 统一的是选择入口、搜索分页、选择/清除、回传、失败恢复、上下文联动和服务端复核。
- 项目参考财务 `project-picker`：状态分组、项目来源、设计师筛选、常用项目、搜索分页。
- 客户与房屋必须保留多房屋关系，业务需要房屋时显式选择，禁止第一条兜底。
- 账务分类必须使用树形选择，禁止 `children` 扁平化为普通列表。
- 报价分项参考设计工作台：分类树、品牌/系列/规格、区域、多选数量和价格。
- Web 日期控件必须使用简体中文 locale。
- 跨端唯一执行规范：后端 `../../后端代码/th4-decoboon/docs/design/35-业务对象选择器与选择结果展示规范.md`；本文件与其冲突时以更严格条款为准。
- 员工、项目、客户、房屋、报价、合同、工人、供应商、应收应付等业务对象禁止使用原生 `<picker>` 或 `JzSelectField :range` 承载；必须使用专用选择页。固定短枚举和随父对象返回的有界子集合例外须在 T15 中声明。
- 专用选择页必须打开即展示数据、服务端搜索分页、加载更多、完整七态和一次性回传；禁止固定 `size: 200`、单次首批全量或页面内全量筛选。
- 来源页面必须使用全宽已选业务卡，至少展示对象名称、状态和关键业务事实，禁止只显示“已选择员工/项目/工人”。
- 离职交接、任务负责人、财务工人、合同报价来源、供应商价格、项目/客户/房屋等选择必须逐项核对并接入专用选择器；`check:selectors` 通过不能替代全 App 普查和真机验证。

## 2. 技术栈（固定，不得擅自替换）

- uni-app + Vue3 `<script setup lang="ts">` + TypeScript + Vite。
- 状态管理：Pinia（新增跨页面状态时使用）；页面局部状态继续放 `ref/computed`，不得为局部变量强行建 store。
- 样式：SCSS（scoped）+ Design Token 变量。
- UI 能力：优先复用 `src/components` 现有 `Jz*` 组件与 uni-app 基础组件，不重复造轮子。
- 目标端：微信小程序 / H5 / App 三端；小程序为第一优先级。
- 设计基准：750rpx 设计稿，1rpx = 屏宽 / 750。
- 正式 UI 禁止使用 emoji、字符箭头、字符加号等 Unicode 图标；统一使用 `src/components/JzIcon.vue` 的线性图标。

---

## 3. 目录结构约定

```text
src/
├── components/                  # 多分包复用的全局通用组件
│   └── XxxYyy/XxxYyy.vue       # 组件目录与文件同名
├── pages/                       # 仅主包页面：启动、登录/授权、自定义 Tab 页
│   ├── index/index.vue
│   ├── project/list.vue
│   ├── customer/list.vue
│   ├── dynamic/index.vue
│   ├── mine/index.vue
│   ├── finance/index.vue
│   ├── auth/login.vue
│   ├── auth/enterprise.vue
│   ├── invite/accept.vue
│   └── company/join.vue
├── subpackages/                 # 微信小程序分包根目录
│   └── <domain>/
│       ├── pages/               # 该业务域页面
│       ├── components/          # 仅该分包使用的私有组件
│       └── static/              # 仅该分包使用的小体积静态资源
├── domains/                     # 领域模型/API/meta/scope（跨页面共享领域代码）
│   └── <domain>/model.ts|api.ts|meta.ts
├── composables/                # 可复用交互与组合逻辑
├── config/                     # 路由、环境与集中配置
├── core/                       # HTTP、格式化等基础设施
├── roles/                      # 角色元信息与权限矩阵
├── static/                     # 主包必需的小体积静态资源
├── styles/                     # 基础样式、页面样式与目标 Token 文件
│   └── tokens.scss            # 目标 Token 真源（迁移后）
├── types/                      # 全局 TS 类型
└── uni.scss                    # 当前 Design Token 真源，全局注入
```

补充约束：

- 只有启动页、登录/授权页和 `TAB_PATHS` 中的自定义 Tab 页可放 `src/pages`；其他业务页一律放 `src/subpackages/<domain>/pages/<page>.vue`。
- 领域模块统一放 `src/domains/<domain>`，至少包含 `model.ts / api.ts / meta.ts`。
- 页面只依赖对应领域 API，禁止直接 `uni.request` 或拼 Provider 地址。
- 公共 HTTP/上传协议放 `src/core/http.ts`；日期、金额等纯格式化放 `src/core/format.ts`。
- 会话只放 `src/domains/identity/session.ts`，其他领域不得反向依赖页面。
- 禁止新增 Mock、演示数据或页面内本地持久化；所有列表数据从 Provider 获取。

---

## 4. Design Token（唯一真源，禁止硬编码）

**所有颜色、字号、间距、圆角、阴影、动效，必须从 Token 取值。**
禁止在组件中写 `#xxx`、`28rpx`、`0 4rpx 16rpx` 这类字面量；`1rpx` 边框、`0`、`100%`、`flex: 1` 等结构性数值除外。

当前工程真源是 `src/uni.scss`。目标结构是 `src/styles/tokens.scss` 作为唯一真源，并由 `src/uni.scss` 统一导入；迁移完成前不得创建“第二套真源”。

`$jzb-*` 是现有命名空间；下表 `$brand-* / $text-* / $bg-*` 是目标语义契约。迁移必须一次性在 `src/styles/tokens.scss` 建立目标 Token，在 `src/uni.scss` 建立兼容别名或完成全量替换，并同步本文件，不得在同一组件中混用两套 Token。

### 4.1 色彩

**品牌主色（墨绿目标值）**

| Token | 色值 | 用途 |
|---|---|---|
| `$brand-50` | `#EEF6F1` | 浅底、标签背景 |
| `$brand-100` | `#D6EADF` | 选中态背景 |
| `$brand-200` | `#ADD5BF` | 禁用主色 |
| `$brand-300` | `#7FBB9B` | 图表辅助 |
| `$brand-400` | `#529E77` | hover / active |
| `$brand-500` | `#2F7D5A` | 主色：主按钮 / 链接 / 选中 |
| `$brand-600` | `#26654A` | 按下态 |
| `$brand-700` | `#1D4E39` | 深色标题 |
| `$brand-800` | `#153829` | 深色卡片 |
| `$brand-900` | `#0C221A` | 深色背景 |

当前未执行品牌迁移时，以 `src/uni.scss` 中 `$jzb-primary` 等现有 Token 为准，不得直接改写页面品牌色。

**辅助色（暖木橙，用量 ≤ 10%）**

| Token | 色值 | 用途 |
|---|---|---|
| `$accent-50` | `#FDF5EE` | 浅底 |
| `$accent-100` | `#FAE6D5` | 标签背景 |
| `$accent-300` | `#F0BE96` | 装饰 |
| `$accent-500` | `#D98B52` | 价格 / 优惠 / 限时 / 徽标 |
| `$accent-600` | `#B86F3A` | 按下态 |

橙色只用于价格、优惠、限时、徽标，禁止大面积铺底。

**中性色（带绿调暖灰，禁止纯黑纯灰）**

| Token | 色值 | 用途 |
|---|---|---|
| `$neutral-0` | `#FFFFFF` | 卡片底 |
| `$neutral-50` | `#FAFAF8` | 浅底 |
| `$neutral-100` | `#F5F5F2` | 页面底（默认） |
| `$neutral-200` | `#EBEBE6` | 边框 |
| `$neutral-300` | `#DCDCD6` | 禁用 / 占位块 |
| `$neutral-400` | `#B8B8B0` | placeholder |
| `$neutral-500` | `#7A7A72` | 辅助文字 |
| `$neutral-600` | `#66665F` | 次要文字 |
| `$neutral-700` | `#4A4A44` | 正文 |
| `$neutral-800` | `#2E2E2A` | 小标题 |
| `$neutral-900` | `#1A1A17` | 主标题 |

**功能色**

| Token | 色值 |
|---|---|
| `$success-500` / `$success-bg` | `#22A06B` / `#E9F7F0` |
| `$warning-500` / `$warning-bg` | `#E8A020` / `#FDF4E3` |
| `$error-500` / `$error-bg` | `#E5484D` / `#FDECEC` |
| `$info-500` / `$info-bg` | `#3B7DE8` / `#EBF2FE` |

**语义 Token（组件必须优先使用这一层）**

| Token | 值 |
|---|---|
| `$text-primary` | `#1A1A17` |
| `$text-regular` | `#4A4A44` |
| `$text-secondary` | `#7A7A72` |
| `$text-placeholder` | `#B8B8B0` |
| `$text-disabled` | `#DCDCD6` |
| `$text-inverse` | `#FFFFFF` |
| `$text-price` | `#D98B52` |
| `$bg-page` | `#F5F5F2` |
| `$bg-card` | `#FFFFFF` |
| `$bg-hover` | `rgba(26, 26, 23, 0.03)` |
| `$bg-mask` | `rgba(26, 26, 23, 0.50)` |
| `$border-color` | `#EBEBE6` |
| `$divider-color` | `#F0F0EC` |

### 4.2 字号与数字

| Token | rpx | 字重 | 行高 | 用途 |
|---|---:|---:|---:|---|
| `$font-display` | 48 | 700 | 1.3 | 大数字 / 金额 |
| `$font-h1` | 40 | 600 | 1.35 | 页面主标题 |
| `$font-h2` | 36 | 600 | 1.4 | 区块标题 |
| `$font-h3` | 32 | 500 | 1.4 | 卡片标题 |
| `$font-body-lg` | 30 | 400 | 1.6 | 重点正文 |
| `$font-body` | 28 | 400 | 1.6 | 正文默认 |
| `$font-body-sm` | 26 | 400 | 1.6 | 次要正文 |
| `$font-caption` | 24 | 400 | 1.5 | 辅助说明 |
| `$font-mini` | 20 | 400 | 1.4 | 角标 |

- 字重：`$fw-regular: 400` / `$fw-medium: 500` / `$fw-semibold: 600` / `$fw-bold: 700`。
- 行高：`$lh-tight: 1.3` / `$lh-snug: 1.4` / `$lh-base: 1.5` / `$lh-loose: 1.6`。
- 价格、面积、数量、编号等数字统一加 `font-variant-numeric: tabular-nums; font-feature-settings: 'tnum';`。

### 4.3 间距（8rpx 栅格）

| Token | 值 | 用途 |
|---|---:|---|
| `$space-xxs` | 8rpx | 图标与文字 |
| `$space-xs` | 16rpx | 行内元素 |
| `$space-sm` | 24rpx | 卡片间距 / 卡片内边距（小） |
| `$space-md` | 32rpx | 页面边距 / 卡片内边距 |
| `$space-lg` | 40rpx | 区块内间距 |
| `$space-xl` | 48rpx | 区块之间 |
| `$space-2xl` | 64rpx | 大区块分隔 |
| `$space-3xl` | 80rpx | 页面顶部 / 底部留白 |
| `$page-gutter` | 32rpx | 全项目页面左右安全边距 |

### 4.4 圆角

| Token | 值 | 用途 |
|---|---:|---|
| `$radius-xs` | 4rpx | 标签 / 角标 |
| `$radius-sm` | 8rpx | 输入框 / 小按钮 |
| `$radius-md` | 16rpx | 卡片默认 |
| `$radius-lg` | 24rpx | 大卡片 / 弹窗 |
| `$radius-xl` | 32rpx | 底部面板顶角 |
| `$radius-full` | 9999rpx | 胶囊 / 头像 |

### 4.5 阴影

| Token | 值 | 用途 |
|---|---|---|
| `$shadow-xs` | `0 2rpx 8rpx rgba(26,26,23,0.04)` | 分割卡片 |
| `$shadow-sm` | `0 4rpx 16rpx rgba(26,26,23,0.06)` | 卡片默认 |
| `$shadow-md` | `0 8rpx 24rpx rgba(26,26,23,0.08)` | 悬浮卡片 |
| `$shadow-lg` | `0 16rpx 40rpx rgba(26,26,23,0.10)` | 弹窗 |
| `$shadow-brand` | `0 8rpx 24rpx rgba(47,125,90,0.24)` | 主按钮 |

### 4.6 动效

| Token | 值 | 用途 |
|---|---|---|
| `$duration-fast` | 150ms | 点击反馈 / 颜色 |
| `$duration-base` | 200ms | 默认：位移 / 淡入 |
| `$duration-slow` | 300ms | 弹窗 / 转场 |
| `$ease-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | 默认 |
| `$ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 回弹 |

### 4.7 布局常量

| Token | 值 |
|---|---:|
| `$btn-height` | 88rpx |
| `$btn-height-lg` | 96rpx |
| `$list-item-min-h` | 112rpx |
| `$navbar-height` | 88rpx |
| `$tabbar-height` | 100rpx |
| `$safe-top` | `env(safe-area-inset-top, 0px)` |
| `$safe-bottom` | `env(safe-area-inset-bottom, 0px)` |

### 4.8 层级 z-index

| Token | 值 |
|---|---:|
| `$z-fixed` | 800 |
| `$z-sticky` | 900 |
| `$z-dropdown` | 950 |
| `$z-mask` | 1000 |
| `$z-modal` | 1010 |
| `$z-toast` | 1100 |
| `$z-loading` | 1200 |

---

## 5. 硬性视觉规则（一票否决）

1. 间距只用 8 的倍数（rpx）：8/16/24/32/40/48/64/80；禁止 15rpx、27rpx 等。
2. 页面左右安全边距全项目统一 `$page-gutter`（32rpx），禁止各页不同。
3. 单页面圆角种类 ≤ 2 种，默认 `$radius-md`（16rpx）。
4. 单页面主色实心按钮 ≤ 1 个，其余按钮使用描边或文字按钮。
5. 辅助色 `$accent-500` 只用于价格、优惠、限时、徽标，禁止铺底。
6. 禁止纯黑 `#000` / 纯灰 `#999`，一律使用中性色 Token。
7. 卡片必须同时具备 `background + border-radius + shadow` 三件套。
8. 文字层级至少通过字号、字重、颜色中的两处区分，不靠加边框。
9. 图标必须同一套，统一线性风格，禁止混用图标库。
10. 一个页面内同类元素样式必须完全一致，包括所有卡片、标签和按钮。
11. 一屏可见的主 CTA 只能有一个；次要操作必须通过描边、文字或降级位置表达。

---

## 6. 代码规范

### 6.1 Vue / TS

- 一律使用 `<script setup lang="ts">`，禁止 Options API。
- 禁止 `any`；类型不明确时用 `unknown` + 类型守卫。
- 组件 Props 必须使用 `defineProps<Props>()` + `withDefaults` 给默认值。
- 事件必须使用 `defineEmits<{ (e: 'xxx', payload: T): void }>()` 声明类型。
- `v-for` 必须带 `:key`；禁止用 index 作为 key，除非列表静态且不重排。
- 组件单文件 ≤ 300 行，超出必须拆子组件。
- 页面单文件 ≤ 500 行，业务逻辑抽到 composable、领域 API 或 store。
- 能使用 `computed` 缓存的结果不得用 `watch` 重复计算。
- 定时器、事件监听、订阅必须在 `onUnmounted` 中清理。

### 6.2 样式

- 一律使用 `<style lang="scss" scoped>`。
- 命名使用 BEM：`.block__element--modifier`。
- 禁止 `!important`；确有必要时必须在代码注释中说明不可替代原因。
- 禁止行内 style；动态计算样式除外，且必须由 Token 拼接。
- 禁止直接给 `view`、`text` 等标签选择器写样式，必须使用类名。
- 嵌套层级 ≤ 3 层。
- `:deep()` 只在覆盖第三方组件时使用。

### 6.3 命名

- 组件文件：`PascalCase`，如 `HouseCard.vue`。
- 组件目录：与文件同名，如 `components/HouseCard/HouseCard.vue`。
- 页面文件：`kebab-case`，如 `customer-detail.vue`。
- 变量 / 函数：`camelCase`。
- 常量：`UPPER_SNAKE_CASE`。
- 类型 / 接口：`PascalCase`，接口不加 `I` 前缀。
- SCSS 变量：`$kebab-case`。

### 6.4 导入顺序（固定）

```ts
// 1. vue 核心
import { ref, computed, onMounted } from 'vue'

// 2. 第三方库
import { storeToRefs } from 'pinia'

// 3. 项目内 - 绝对路径（@/）
import HouseCard from '@/components/HouseCard/HouseCard.vue'

// 4. 项目内 - 相对路径
import { formatPrice } from './utils'

// 5. 类型
import type { HouseItem } from '@/types/house'
```

---

## 7. 交互规范（每个页面必须覆盖）

### 7.1 视觉状态

每个可交互元素必须定义 `默认 / active / disabled`；H5 额外定义 `hover / focus`。

### 7.2 数据状态

所有异步数据展示必须包含三态：

- **loading**：骨架屏优先，禁止空白页面。
- **empty**：插画 + 引导文案 + 引导按钮，禁止只显示“暂无数据”。
- **error**：错误说明 + 重试按钮，禁止静默失败。

### 7.3 交互反馈

- 点击反馈必须在 300ms 内出现，使用 `:active` 或 `$bg-hover`。
- 按钮必须防重复点击，具备 `loading` 态或 `disabled` 态。
- 成功使用 `uni.showToast`（≤ 1.5s）；重要操作使用 `uni.showModal`。
- 删除、取消等破坏性操作必须二次确认。

### 7.4 列表

- 长列表必须支持下拉刷新、上拉加载和到底提示。
- 超过 100 条必须分页或使用虚拟列表。
- 列表项点击态使用 `$bg-hover`，不得因此改变布局。

### 7.5 动效

- 时长遵守 Token，单次动效 ≤ `$duration-slow`（300ms）。
- 缓动默认使用 `$ease-out`。
- 列表项进入可使用 stagger，间隔 40ms，单次位移 ≤ 24rpx。
- 禁止无意义动效；颜色反馈 < 100ms 视为无效；弹跳动画只用于收藏 / 点赞。

### 7.6 表单

- 输入框必须限制输入类型（`type` / `maxlength`）。
- 必填项必须有 `*` 标记，失焦校验，错误提示位于输入框下方。
- 提交按钮在表单校验通过前禁用。
- 键盘弹起时输入框不得被遮挡，正确设置 `adjust-position`。

### 7.7 引导、进度与待办状态（强制）

- 引导、待办、实施清单、资料完整度和节点进度中的完成状态，必须由真实领域 API 数据派生；禁止写死 `done: true/false`、演示数据或仅存本地布尔值。
- 每个步骤必须明确 `key / required / source_provider / completion_predicate / refresh_triggers / next_action`；必做与可选必须同时体现在分母、文案、下一步和测试中。
- 会因跨页新增、编辑、删除而变化的状态，必须在页面重新显示时刷新，或通过跨页写入失效机制保证下次显示收敛。
- 编写可变状态组件时禁止只做一次性 `onMounted/load`，必须核查从子页面返回、切换 Tab、重新登录后的状态刷新。
- 验收至少覆盖：初始未完成、动作成功后返回、动作失败、可选完成、必做未完成、重复进入。
- 历史坑：FIX-004 / ECD-008，供应商步骤曾写死未完成且返回首页不刷新。

---

## 8. 多端适配

- 尺寸使用 `rpx`；H5 页面容器增加 `max-width: 750px; margin: 0 auto`，防止大屏过大。
- `1rpx` 边框在小程序正常；H5 高清屏使用 `0.5px` 或 `transform: scaleY(0.5)` 方案。
- 底部固定元素必须增加底部安全区 `padding-bottom: $safe-bottom`。
- 顶部自定义导航必须处理 `$safe-top`。
- 禁止使用小程序不支持的 API：`document`、`window`、`localStorage`；统一使用 `uni.xxx`。
- 图片必须 `lazy-load`、提供加载占位与失败兜底图。
- 小程序图片域名必须已加入后台白名单。
- 自定义字体必须评估小程序加载成本，优先使用系统字体栈。

---

## 9. 性能规范

- 首屏只加载必要资源，图片懒加载。
- `scroll / resize / input` 等高频函数必须节流或防抖。
- 能缓存的计算不重复执行，优先 `computed`。
- 长列表禁止一次性渲染全部数据。
- 避免在 `v-for` 内执行复杂计算，使用 `computed` 预处理。
- 组件按需引入，避免全量导入 UI 库。
- 页面销毁时清理定时器、监听器和订阅。

---

## 10. 输出格式（每次回复必须遵守）

处理任何页面、组件或视觉任务时，按以下结构输出：

### 1. 【问题诊断】

逐条列出问题，并解释为什么是问题；禁止使用“不够美观”等无法验收的描述。

### 2. 【改造方案】

说明设计决策与涉及的具体 Token，如“卡片间距使用 `$space-sm`”。

### 3. 【完整代码】

- 代码必须可直接运行，不省略，不使用 `// ...省略` 占位。
- 文件路径写在代码块上方注释或正文中。
- 引用 Token 变量，不硬编码。

### 4. 【自检清单】

对照第 5 节（硬性视觉规则）和第 7 节（交互规范）逐条打勾或说明豁免。

### 5. 【新 Token 建议】

仅当现有 Token 不足时输出。必须先建议值和用途，不得直接硬编码。

---

## 11. 禁止事项清单（违反即重写）

- 硬编码色值、字号、圆角、阴影。
- 使用 `!important`。
- 使用 `any`。
- 使用 Options API。
- 使用内联 style（动态计算除外）。
- 用 index 作为 `v-for` key。
- 使用 `document`、`window`、`localStorage`。
- 页面出现 ≥ 2 个同色实心主按钮。
- 一屏出现 ≥ 3 种圆角。
- 出现纯黑 `#000` / 纯灰 `#999`。
- 空状态只写“暂无数据”。
- 按钮无防重复点击。
- 长列表无分页。
- 输出代码使用省略占位。
- 只用文字段落解释流程；复杂流程必须改为步骤条或图形化流程。
- 新增 mock、演示数据或页面内本地持久化。
- 引导、进度、待办或完整度状态使用写死完成值，或业务动作后返回页面不刷新。
- 正式 UI 使用 emoji、字符箭头、字符加号代替图标。

---

## 12. 任务开始前必须做的事

1. **先诊断，后写码**：收到页面/组件优化请求，先输出【问题诊断】，等用户确认后再写代码，除非用户明确说“直接给代码”。
2. **一次只改一个维度**：布局、视觉、交互、适配分轮进行，不要一轮全部改完。
3. **主动指出重复与割裂**：发现同一信息在多个区块重复、或按钮命名自相矛盾，必须指出并给出合并方案。
4. **发现缺 Token 时先提问**，不得擅自硬编码。

---

## 13. 页面与接口边界（延续原工程约束）

- 页面保留 `pages/<domain>/<page>.vue`；Tab 页使用 `index.vue`。
- 角色元信息、Tab 配置放 `src/roles/catalog.ts`；权限能力与矩阵放 `src/roles/permission.ts`。
- 领域实体关联保持对象形态，页面不定义 VO/DTO 包装。
- Provider 响应统一接受 `{ success, data, errorCode }`；`Page<Entity>` 使用 `src/core/http.ts` 的 `listOf` 解包。
- 能力接口按领域拆分，如 `crmApi.follow`、`scheduleApi.confirmNode`、`acceptanceApi.confirm`，禁止继续扩张跨领域 `projectApi`。
- 表单、汇报、上传组件只收集输入后调用领域 API，不在组件内维护业务状态。
- 角色新增时先扩展 `EmployeeRole`、`ROLE_META`、`ROLE_TABS` 和权限矩阵，再增加对应领域页面。
- 正式 UI 禁止使用 emoji、字符箭头、字符加号等 Unicode 图标；统一使用 `src/components/JzIcon.vue` 的线性图标。

---

## 14. 参考锚点（家装相关页面）

- 信息密度：参考“好好住”的案例卡片。
- 图片处理：参考“小红书”的图文比例。
- 流程表达：参考“美团”的订单状态步骤条。
- 表单体验：参考“支付宝”的设置页。
- 视觉克制：参考“苹果官网”的留白与层级。

以上仅为风格参考，具体数值必须以本文件 Token 为准。

---

## 15. 客户详情页专项基准

**总诊断：这不是“设计不好看”的问题，而是“信息架构没做分层 + 同一件事被表达了三遍”的问题。视觉只是表象，重做视觉之前必须先重组信息，否则越改越乱。**

客户详情页重构执行以下 P0/P1 规则：

1. **销售流程只能有一个视觉承载区**：删除“业务流程”“设计转化”“方案报价”三个同权独立卡片，合并为一个 `SalesSteps` 步骤条。
2. **销售阶段固定五步**：`到店 → 跟进 → 量房 → 设计 → 报价`。当前阶段高亮，已完成打勾，未开始使用禁用色。
3. **步骤条下方只显示当前阶段的唯一主 CTA**；其他阶段操作不得同时展示为可点击按钮。
4. **按钮文案必须唯一且无近义重复**：同一动作只能有一个名称，如“设计转化”与“开始设计转化”不得同时出现。
5. **房屋信息只表达一次**：删除独立“当前房屋”区块，将房号、面积、状态、编号、量房动作合并到 `HouseCard`。
6. **多套房屋使用横向 `scroll-view`**，不得纵向重复堆叠多张同构卡片。
7. **客户身份卡只保留身份信息**：头像、姓名、电话、顾问、状态标签；到店次数下沉到跟进记录或统计区域。
8. **电话/复制等纯图标操作必须可识别**：使用 `JzIcon + 文本` 或明确的按钮标签，禁止让用户猜测图标含义。
9. **页面主色高亮 / 实心操作最多 2 处**：步骤条当前节点 + 底部主 CTA；其中实心主按钮仍只能有 1 个（底部），其余操作使用描边或文字按钮。
10. **key-value 统一两列栅格**：label 宽 `160rpx`，正文/次要字号按 Token；value 使用主文字 Token 与中等字重。
11. **空值统一显示 `—`** 并使用 placeholder Token；不得把“无”“暂无数据”“尚未录入”作为多种写法混用。
12. **可点击区域必须可辨识**：增加右侧 chevron 或按压态，展示型胶囊不得伪装成按钮。
13. **底部固定栏主次明确**：一个主按钮（实心）、一个次按钮（描边）；页面中部不得重复同一入口。
14. **长编号必须折叠显示**，如 `H1789…4323`，点击可复制全文。
15. **业务流程说明文字全部删除**，用步骤条、标签和当前动作表达，不用长段落解释。

### 15.1 客户详情重构后的目标结构

```text
[导航栏] 客户详情

[客户身份卡]
头像 / 姓名 / 电话 / 状态标签 / 顾问
[JzIcon phone + 打电话] [JzIcon wechat + 加微信]

[销售阶段]
到店 → 跟进 → 量房 → 设计 → 报价
当前节点高亮；当前阶段唯一 CTA

[装修房屋 (n)]
房号 / 状态 / 面积 / 户型 / 折叠编号
[录入量房] 或 [查看量房]

[客户信息]
来源 / 房屋地址 / 营销进度 / 意向小区 / 户型面积 / 预算 / 备注

[跟进记录]
时间 / 方式 / 内容 / 下次跟进
标题右侧唯一“写跟进”入口

[底部固定栏]
[写跟进：次按钮，描边] [生成报价：主按钮，实心]
```

### 15.2 客户详情交付要求

- 页面文件：`src/subpackages/customer/pages/detail.vue`。
- 步骤条组件：`src/subpackages/customer/components/SalesSteps/SalesSteps.vue`。
- 房屋卡组件：`src/subpackages/customer/components/HouseCard/HouseCard.vue`。
- 组件 Props 只接收实体或实体数组，不接收重新拼装的 DTO/VO。
- 所有异步数据必须具备 loading / empty / error 三态。
- 修改后必须运行 `npm run type-check`，并自查第 5、7、11、15 节。

---

## 16. 版本与同步

- v1.0 · 装得清小程序端工程初始化规范。
- v1.1 · 合并完整 UI/UX、Design Token、交互、多端、性能和客户详情专项规范。
- 修改本文件后，必须同步检查当前 Token 真源 `src/uni.scss`、目标文件 `src/styles/tokens.scss`、可能新增的 `src/styles/tokens.ts / src/styles/variables.css`、相关 `src/styles/*.scss` 和现有 `Jz*` 组件，避免文档数值与运行值不一致。
- 全局业务架构、Provider 路由对照和联调顺序见 `docs/04-App工程架构与接口对接.md`；业务设计见 `docs/01`、`docs/02`、`docs/03`。

### 16.1 分支与发布（强制）

- 长期分支只有 `dev` / `test` / `prod`；`master/main` 归档后不再保留，本次收敛以 `dev` 为唯一日常开发入口。
- 正常发布链固定为 `feature|fix -> dev -> test -> prod`；`test` 只接收已通过 App 门禁的 `dev` 批次，`prod` 只接收已验证的 `test` 批次。
- `feature/*`、`fix/*`、`hotfix/*`、`integration/*` 合入下游后立即删除；未合入且暂不使用的分支删除前先打 `archive/<branch>-<YYYYMMDD>` 标签。
- 禁止长期保留特性分支、多 worktree 或直接在 `dev/test/prod` 上开发；`git branch` 出现三条之外长期分支即为违规。
- 每次提交前至少运行 `npm run type-check`；涉及页面、分包或发布行为时运行 `npm run verify:mp-weixin`。本地收敛和提交默认不推送远端，远端清理必须另行获得明确授权。

---

## 17. 微信小程序分包强制规范（必须遵守）

本节针对微信小程序包体和加载性能，优先级高于本文件第 3 节中任何旧的页面目录描述。当前项目**没有原生 tabBar**，使用 `JzTabBar + roles/catalog.ts ROLE_TABS` 实现角色化 Tab；这些 Tab 页同样必须留在主包。

### 17.1 当前分包拓扑

| root | 业务范围 |
| --- | --- |
| `subpackages/customer` | 客户详情、编辑、跟进、量房、量房记录 |
| `subpackages/company` | 企业资料、成员、邀请、离职交接、退出企业 |
| `subpackages/project` | 项目立项/详情/计划/成员/相册、阶段、任务、汇报、验收 |
| `subpackages/design` | 设计转化、客户诉求、设计方案、谈单 PPT |
| `subpackages/quote` | 报价列表/详情/编辑、家装材料库 |
| `subpackages/team` | 团队、项目经理履约驾驶舱、设计调度 |
| `subpackages/finance` | 资金台账、应收应付、收付款、项目账本、财务登记 |
| `subpackages/statistic` | 经营驾驶舱、个人业绩、人员绩效 |
| `subpackages/message` | 消息通知 |
| `subpackages/subscription` | 订阅与门店 |
| `subpackages/supply` | 供应链 |

### 17.2 新增页面前必须判断

1. 启动页、登录/授权页、企业加入/创建页、`TAB_PATHS` 中的 Tab 页 → 放 `src/pages`。
2. 其他业务页面 → 放 `src/subpackages/<业务域>/pages`。
3. 新页面必须同时写入 `src/pages.json`：主包页面写 `pages`；分包页面写对应 `subPackages[].pages` 的相对路径。
4. 路由常量必须写入 `src/config/index.ts` 的 `P.*`，页面内禁止直接写路径字符串。
5. 跳转必须使用绝对路径，例如：
   `uni.navigateTo({ url: '/subpackages/order/pages/list' })`
6. 新增自定义 Tab 页时必须同时更新 `P.*`、`TAB_PATHS`、`ROLE_TABS` 和 `src/pages.json` 的主包 `pages`，禁止放入分包。

### 17.3 新增组件和公共依赖必须判断

1. 两个及以上分包复用 → 放 `src/components`，作为主包公共组件。
2. 仅一个分包使用 → 放 `src/subpackages/<业务域>/components`。
3. 仅一个分包使用的工具、类型或 API 适配代码 → 优先放该分包私有目录；跨分包领域模型/API 保留在 `src/domains`。
4. 禁止分包 A 引用分包 B 的私有组件、JS、样式或静态资源。
5. 禁止主包引用任何 `src/subpackages/**` 私有资源。
6. `CatalogPicker` 同时服务于设计和报价领域，是主包公共组件，不得下沉到任一业务包。
7. 使用 `@/` 绝对别名引用主包公共依赖；分包私有文件可用 `@/subpackages/<当前域>/...`，禁止通过相对路径跨分包引用。

### 17.4 新增静态资源必须判断

1. 图片、字体、视频优先使用 CDN，不在仓库中叠加发布包。
2. 单个静态文件大于 50KB → 必须走 CDN。
3. 仅一个分包使用的小资源 → `src/subpackages/<业务域>/static`。
4. 主包只允许 logo、Tab 图标等启动必需的小图；主包 `src/static` 必须保持最小化。
5. 禁止在分包 `static` 中放大文件，也禁止主包 `static` 反向引用分包资源。

### 17.5 独立分包和预下载

1. 默认使用普通分包；只有页面不依赖主包会话、HTTP、全局组件、全局样式时，才允许配置 `independent: true`。
2. 独立分包必须在 `pages.json` 和微信开发者工具中单独验证冷启动、登录态不依赖、资源自包含。
3. 新增或调整高频入口时必须同步更新 `pages.json.preloadRule`；预下载只能引用已存在的分包 root。
4. 预下载必须兼顾流量，非首屏高频链路优先使用 `network: "wifi"`。

### 17.6 提交前强制检查

1. 主包 ≤ 2MB。
2. 单分包 ≤ 2MB。
3. 总包 ≤ 20MB。
4. 不存在主包到分包的私有引用，也不存在分包 A 到分包 B 的私有引用。
5. 微信开发者工具“代码依赖分析”无缺失模块、无非法依赖。
6. 所有分包跳转使用绝对路径，Tab、登录、启动和分包预下载均实测通过。
7. 完成 `npm run type-check`、`npm run build:mp-weixin` 和 `npm run check:subpackages`，再上传体验版验证。
8. 提交前推荐执行 `npm run verify:mp-weixin`，一次性完成类型检查、构建和分包守卫。
9. 每次新增业务模块优先新增独立业务分包，禁止继续把非核心页面塞入主包。

### 17.7 体积守护原则

- 不允许为了省事把新业务页临时放主包后再“以后迁移”。
- 任何会导致主包增长超过 1.5MB 的功能，必须在上线前重新做依赖分析并拆分。
- 第三方库按需引入；引入前评估构建后体积，禁止整库导入。
- 代码、配置和文档中的旧路径必须一起修改，禁止只移动文件不更新 `P.*` 和 `pages.json`。

---

## 18. BUG 修复与业务沉淀工作流（Fix Agent）

每次接到 BUG、缺陷、需求变更，必须先读 `docs/fixes/README.md`，按其规定的四角色流程执行：

1. **诊断工程师**：复现、定位代码、写根因；
2. **修复工程师**：改代码、加注释（注释里要写明历史坑点和 FIX 编号）、跑 `npm run type-check`；
3. **资深业务观察者**：从家装行业对标、销售→履约闭环、多角色权限与数据隔离、空态降级四个维度审查，任一不通过必须返工；
4. **流程沉淀官**：
   - 在 `docs/fixes/log.md` 顶部按模板追加一条 FIX-XXX 记录；
   - 在 `docs/fixes/business-rules.md` 更新对应模块的实然业务规则；
   - 操作口径变化时更新 `docs/fixes/user-guide.md`（面向装企一线员工）。

**硬性要求**：
- 不允许只改代码不沉淀；
- 不允许用 `|| list[0]`、`any`、静默兜底掩盖数据串号或权限问题；
- 涉及客户/项目/报价关联数据的详情页，必须按当前实体 ID 过滤，禁止全量拉取前端 find（参见 FIX-001）；
- 代码注释里必须标注"历史坑：FIX-XXX"，防止后续维护者把同样的兜底加回来。

这一节是项目级强制约束，优先级高于本节其他工程约定中与业务规则相关的部分。

## 19. 官网短视频与自动录屏（强制）

- 官网短视频、产品演示和过程录屏必须来自微信开发者工具中的真实 Mini Program 页面；禁止用 Web、H5、接口回放、Mock 或静态拼帧冒充小程序体验。
- 统一使用 `scripts/recording/run-scenario.mjs` 和场景 JSON 驱动导航、点击、输入、滚动与页面读取。
- 窗口级过程证据使用 `screencapture -l <windowId>`；官网成片优先使用干净小程序帧生成 1080p 竖版 MP4，并保留 SRT 和 `run.json`。
- 只使用专用测试企业、测试项目和测试角色；录制前确认本地后端、开发者工具、项目信任和登录态。
- 默认只执行无副作用的浏览和录屏动作。签署、付款、验收确认、邀请、消息发送和删除必须单独授权并定义回滚。
- 录制材料发布前仍需执行业务事实、客户授权、隐私、脱敏和宣传边界门禁。
- 当前旧 Web 官网视频与小程序录制规范不一致时，必须按业务知识 `GAP-015` 阻断复用并替换。

## 装得清业务智能体咨询门禁（2026-09-18）

涉及业务对象、状态机、角色权限、数据范围、金额、成本、利润、指标、客户可见性、装企场景匹配或对外宣传口径时，必须先调用全局技能 `/Users/zhangwei/.agents/skills/zhuangdeqing-business/SKILL.md`（全局技能 `zhuangdeqing-business`） 并读取规范事实源。

- 需求定义前：确认场景、角色、对象、前置条件、状态变化、例外和验收标准。
- 编码实现前：确认规则来源、权限范围、金额/成本口径、历史数据和幂等要求。
- 验收前：按业务条件矩阵覆盖正向、反向、越权、重复和边界用例。
- 对外表达前：确认知识状态为 `verified`，并核验证据、授权和不可承诺边界。
- 发现口径冲突时建立 `GAP-*`，不得自行选择更省事的版本。
