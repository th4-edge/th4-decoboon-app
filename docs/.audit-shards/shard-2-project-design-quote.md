# 分片2：project + design + quote

> 审计基准：`src/uni.scss` 的 `$jzb-*` 真源（青绿系，主色 `$jzb-primary:#16A394`）。`$jzb-page-pad:28rpx`、`$jzb-space-2:12rpx` 为已知系统性偏差，本分片只在具体行点名，不逐页重复。JzIcon 的 `color` 属性硬编码 hex 属同类问题，按页统计。

---

## 页面：src/subpackages/project/pages/accept/edit.vue

### 功能简述
项目验收单编辑页：勾选阶段/任务验收项、填写验收结论与备注，提交后生成验收记录。

### 问题清单
- **[P0]** `script` 内 `summaryTag` 计算（约 59-63 行）→ `'#86909C' / '#FF7D00' / '#00B42A' / '#F53F3F'` 直接返回 Ant Design 色板字面量 → 违反规范第 4.1/11 节（硬编码色值）→ 应改为语义 Token：`#86909C→$jzb-text-4`、`#FF7D00→$jzb-warning`、`#00B42A→$jzb-success`、`#F53F3F→$jzb-danger`。
- **[P0]** 模板 `:color="acceptance ? summaryTag.color : '#FF7D00'"`（约 129 行）→ 内联兜底硬编码橙 → 违反第 4.1 节 → 用 `$jzb-warning`。
- **[P0]** 模板 `<JzIcon color="#E5484D">`（约 153 行）→ 硬编码 danger 色 → 违反第 4.1 节 → 用 `$jzb-danger`。
- **[P0]** 模板 `style="margin-left:20rpx;"`（约 154 行）→ 行内 style + 20rpx 非 8 倍数 → 违反第 4.3/6.2/11 节 → 抽 class，间距用 `$jzb-space-3`(16rpx) 或 `$jzb-space-4`(24rpx)。
- **[P0]** 模板 `<JzIcon color="#0E8A7D">`（约 158 行）→ 与 `$jzb-primary-dark` 同值但硬编码 → 违反第 4.1 节 → 用 Token。
- **[P0]** 样式 `.ac__result-emoji`/`.ac__result-icon`（约 181 行 `color="#778390"`）→ 硬编码 text-3 → 违反第 4.1 节 → 用 `$jzb-text-3`。
- **[P0]** 样式 `.ac__title`（约 201 行 `font-size:40rpx`）、`.ac__total-num`（约 215 行 `font-size:60rpx`）→ 非 Token 字号（40/60rpx 不在 22/26/30/32/36/42/50/64 序列）→ 违反第 4.2 节 → 40rpx 建议新增 `$jzb-font-h2` 或就近 `$jzb-font-xl`(42)；60rpx 就近 `$jzb-font-display`(64)。
- **[P0]** 样式 `.ac__head-value`（约 205 行 `padding:12rpx 26rpx`）→ 26rpx 非 8 倍数 → 违反第 4.3 节 → 用 `$jzb-space-2`/`$jzb-space-4`。
- **[P1]** 全页 → 异步加载无 loading 骨架、无 error 重试态（仅 `v-if stage` 空渲染）→ 违反第 7.2 节 → 接入 `JzSkeleton` + `PageState`。
- **[P1]** 模板 `v-for="(it,i) in issues" :key="i"`（约 142 行）、`v-for="(img,i) in images" :key="i"`（约 145/177 行）→ index 作 key → 违反第 6.1 节 → issues 用 `it.id`，图片列表用 `img` URL 或 `img.id`。
- **[P2]** 验收项勾选后无防重复提交 loading 态 → 违反第 7.3 节 → 提交按钮加 `:loading`。

### 修复图例对比
```scss
/* before */
.ac__title { font-size: 40rpx; }
.ac__total-num { font-size: 60rpx; }
.ac__head-value { padding: 12rpx 26rpx; }
```
```scss
/* after */
.ac__title { font-size: $jzb-font-xl; }
.ac__total-num { font-size: $jzb-font-display; }
.ac__head-value { padding: $jzb-space-2 $jzb-space-4; }
```
```ts
/* before */
const summaryTag = computed(() => ({ color: '#86909C', ... }))
```
```ts
/* after */
import { jzb } from '@/styles/tokens' // 或直接引用 scss 变量映射
const summaryTag = computed(() => ({ color: 'var(--jzb-text-4)', ... }))
```

---

## 页面：src/subpackages/project/pages/album.vue

### 功能简述
项目相册页：按阶段分组展示现场照片，支持拍照/上传与预览。

### 问题清单
- **[P0]** 模板 `v-for="(g,i) in groups" :key="'s'+i"`（约 40 行）→ 字符串拼接 index 作 key → 违反第 6.1 节 → 用 `g.stageId` 或 `g.name`。
- **[P0]** 样式 `.ab__img`（约 54 行 `margin:0 14rpx 14rpx 0`）→ 14rpx 非 8 倍数 → 违反第 4.3 节 → 用 `$jzb-space-2`(12rpx)。
- **[P1]** 全页 → 加载阶段无 `JzSkeleton`，仅 `onLoad` 拉取后直接渲染 → 违反第 7.2 节 → 加骨架屏。
- **[P1]** 列表 → 无下拉刷新/上拉加载（相册通常分页）→ 违反第 7.4 节 → 接 `onPullDownRefresh`。
- **[P2]** 空态已用 `JzEmpty`（已遵守）；页面左右边距 `.ab{padding:24rpx}` 与 `$jzb-page-pad:28rpx` 不一致 → 违反第 5.2 节 → 统一 `$jzb-page-pad`。

### 修复图例对比
```html
<!-- before -->
<view v-for="(g,i) in groups" :key="'s'+i">
```
```html
<!-- after -->
<view v-for="g in groups" :key="g.stageId || g.name">
```

---

## 页面：src/subpackages/project/pages/create.vue

### 功能简述
项目立项/合同创建页：选择客户、房屋、设计师/项目经理，填写工期与合同金额后创建项目。

### 问题清单
- **[P0]** 模板 `<JzIcon color="#6958C8">`（约 142/179 行）→ 硬编码 purple → 违反第 4.1 节 → 用 `$jzb-purple`。
- **[P0]** 模板 `<JzIcon color="#AEB8C2">`（约 174 行）→ 硬编码 text-4 → 违反第 4.1 节 → 用 `$jzb-text-4`。
- **[P0]** 模板 `<JzTag color="#07A35A">`/`color="#E67E22"`（约 195 行）→ 内联 prop 硬编码语义色 → 违反第 4.1 节 → 用 `$jzb-success`/`$jzb-warning`。
- **[P0]** 样式 `.pc__hero-icon`（约 223 行 `border-radius:22rpx`）→ 非 Token 圆角（22rpx 不在 8/12/20/28/36 序列）→ 违反第 4.4 节 → 就近 `$jzb-radius`(20rpx)。
- **[P0]** 样式 `.pc__hero-label`（约 229 行 `font-size:22rpx`）→ 虽等于 `$jzb-font-xs` 但写死字面量 → 违反第 4.2 节 → 用 `$jzb-font-xs`。
- **[P0]** 样式 `.pc__form`（约 236 行 `margin-top:38rpx`）→ 38rpx 非 8 倍数 → 违反第 4.3 节 → 用 `$jzb-space-5`(32rpx) 或 `$jzb-space-6`(40rpx)。
- **[P1]** 全页 → 无 loading 骨架；空态用自定义 `.pc__empty`（图标+文案）未复用 `JzEmpty` → 违反第 7.2 节 → 复用 `JzEmpty`。
- **[P2]** 已遵守 `onShow` 刷新、路由走 `P.*`、单主 CTA（创建项目）。

### 修复图例对比
```scss
/* before */
.pc__hero-icon { border-radius: 22rpx; }
.pc__form { margin-top: 38rpx; }
```
```scss
/* after */
.pc__hero-icon { border-radius: $jzb-radius; }
.pc__form { margin-top: $jzb-space-6; }
```

---

## 页面：src/subpackages/project/pages/detail.vue

### 功能简述
项目详情页：项目头图、成员、阶段进度条、阶段卡片、验收入口、施工相册缩略图聚合页。

### 问题清单
- **[P0]** `colorOf()`（约 173 行）→ `'#FA8C16'/'#722ED1'/'#16A394'/'#13C2C2'` Ant 色板字面量 → 违反第 4.1 节 → 映射：`#16A394→$jzb-primary`、`#FA8C16→$jzb-warning`、`#722ED1→$jzb-purple`、`#13C2C2` 建议新增 `$jzb-info-cyan` 或归并 `$jzb-primary-light`。
- **[P0]** 模板 `:color="'#0E8A7D'"`（约 191 行）→ 硬编码 primary-dark → 违反第 4.1 节 → `$jzb-primary-dark`。
- **[P0]** 模板 `<JzIcon color="#ffffff">`/`color="#FFFFFF"`（约 199/205/209/257/336/363 行）→ 大量硬编码反白 → 违反第 4.1 节 → 统一 `$jzb-text-inverse`。
- **[P0]** 模板 `<JzIcon color="#07A35A">`（约 225 行）、`color="#AEB8C2"`（约 230 行）、`color="#0E8A7D"`（约 242 行）、`color="#778390"`（约 253 行）、`color="#465260"`（约 292 行）→ 硬编码语义色 → 违反第 4.1 节 → 分别用 `$jzb-success`/`$jzb-text-4`/`$jzb-primary-dark`/`$jzb-text-3`/`$jzb-text-2`。
- **[P0]** 模板 `:style="{ backgroundColor: ... '#fff' }"`（约 256 行）→ 行内 style 含硬编码色 → 违反第 6.2 节 → 抽 class 用 `$jzb-bg-card`。
- **[P0]** 模板 行内 `style="margin-top:16rpx;"`（约 329 行）、`style="margin-left:16rpx;"`（约 337 行）、`style="padding-top:200rpx;"`（约 386 行）→ 非动态计算的行内 style → 违反第 6.2 节 → 抽 class。
- **[P0]** 样式 `.pd__cover`（约 393 行 `linear-gradient(...rgba(11,44,41,0.55)...)`）→ 硬编码渐变遮罩 → 违反第 4.1 节 → 用 `$jzb-shadow-elevated` 语义或新增遮罩 Token。
- **[P0]** 样式 `.pd__title`/`.pd__meta`（约 395/399 行 `font-size:40rpx`）→ 非 Token 字号 → 违反第 4.2 节 → `$jzb-font-xl`。
- **[P0]** 样式 `.pd__stage-dot`（约 413 行 `border-radius:18rpx`）、`.pd__tag`（约 420 行 `border-radius:6rpx`）、`.pd__no`（约 431 行 `font-size:18rpx`）、`.pd__link`（约 463/464 行 `border-radius:10rpx`）→ 非 Token 圆角/字号 → 违反第 4.4/4.2 节 → 圆角就近 `$jzb-radius-sm`(12rpx) 或 `$jzb-radius-xs`(8rpx)；字号就近 `$jzb-font-xs`(22rpx)。
- **[P1]** 一屏主 CTA：约 241 行"开始"主按钮 + 阶段卡片内嵌主色实心块，多阶段卡片同时渲染 → 违反第 5.4/5.11 节 → 阶段进度条当前节点高亮即可，其余降级为描边/文字。
- **[P1]** 多圆角混用（18/6/10rpx 三种自定义 + Token）→ 违反第 5.3 节 → 收敛到 ≤2 种。
- **[P2]** 已遵守 `PageState` 三态、`JzEmpty`、`onShow` 刷新、路由走 `P.*`。

### 修复图例对比
```scss
/* before */
.pd__title { font-size: 40rpx; }
.pd__stage-dot { border-radius: 18rpx; }
.pd__tag { border-radius: 6rpx; }
```
```scss
/* after */
.pd__title { font-size: $jzb-font-xl; }
.pd__stage-dot { border-radius: $jzb-radius-sm; }
.pd__tag { border-radius: $jzb-radius-xs; }
```
```html
<!-- before -->
<view style="margin-top:16rpx;">...</view>
<JzIcon color="#FFFFFF" />
```
```html
<!-- after -->
<view class="pd__mt">...</view>
<JzIcon color="$jzb-text-inverse" />
```

---

## 页面：src/subpackages/project/pages/invite.vue

### 功能简述
项目成员邀请页：展示邀请二维码与邀请链接，支持复制链接邀请成员加入。

### 问题清单
- **[P0]** 模板 `<JzIcon color="#FFFFFF">`（约 78 行）、`color="#0E8A7D"`（约 84/85 行）→ 硬编码反白与 primary-dark → 违反第 4.1 节 → 用 `$jzb-text-inverse`/`$jzb-primary-dark`。
- **[P0]** 样式 `.inv__code`（约 110 行 `font-size:64rpx`）→ 虽等于 `$jzb-font-display` 但写死字面量 → 违反第 4.2 节 → 用 `$jzb-font-display`。
- **[P1]** 全页 → 加载邀请码阶段无 loading 态 → 违反第 7.2 节 → 加骨架。
- **[P2]** 已遵守单主 CTA（复制链接）、路由走 `P.*`；圆角仅 `$jzb-radius` 一种。

### 修复图例对比
```scss
/* before */
.inv__code { font-size: 64rpx; }
```
```scss
/* after */
.inv__code { font-size: $jzb-font-display; }
```

---

## 页面：src/subpackages/project/pages/members.vue

### 功能简述
项目成员页：展示项目团队成员与业主，支持邀请/移除成员、角色分配。

### 问题清单
- **[P0]** `color()`（约 34-35 行）→ `'#F53F3F'/'#FA8C16'/'#722ED1'/'#16A394'/'#13C2C2'` Ant 色板 → 违反第 4.1 节 → 用角色/语义 Token：`$jzb-role-boss/role-designer/role-pm`、`$jzb-danger`、`$jzb-warning`。
- **[P0]** 模板 `<JzIcon color="#F53F3F">`（约 70/72 行）→ 硬编码 danger → 违反第 4.1 节 → `$jzb-danger`。
- **[P0]** 模板 `style="margin-top:16rpx;"` + `color="#0E8A7D"`（约 81 行）→ 行内 style + 硬编码色 → 违反第 6.2/4.1 节 → 抽 class 用 `$jzb-primary-dark`。
- **[P0]** 空态 `.mb__empty`（约 86/93 行）仅"暂无团队成员""尚未邀请业主加入"纯文字，无 `JzEmpty`、无引导图/引导按钮 → 违反第 7.2/11 节 → 复用 `JzEmpty` + 邀请主按钮。
- **[P1]** 全页 → 无 loading 骨架 → 违反第 7.2 节。
- **[P2]** `go(url)` 函数定义在顶部 import 之前（约 2 行）→ 违反第 6.4 导入顺序 → 移到 import 之后。

### 修复图例对比
```html
<!-- before -->
<view class="mb__empty">暂无团队成员</view>
```
```html
<!-- after -->
<JzEmpty text="还没有团队成员" sub="邀请设计师、项目经理和业主加入项目" action-text="立即邀请" @action="invite" />
```

---

## 页面：src/subpackages/project/pages/plan.vue

### 功能简述
项目计划页：按阶段展示任务进度条与任务列表，支持任务勾选与状态切换。

### 问题清单
- **[P0]** 模板 `<JzIcon color="#778390">`（约 65 行）→ 硬编码 text-3 → 违反第 4.1 节 → `$jzb-text-3`。
- **[P1]** 全页 → 无 `JzSkeleton` 加载态；空态 `.plan__no-task` 仅文案 → 违反第 7.2 节 → 复用 `JzEmpty`。
- **[P1]** 进度条 `:style="{ backgroundColor: ... }"`（约 71/81 行）动态内联 style → 虽为动态计算，但颜色来自硬编码 map → 违反第 4.1 节 → 抽 class 用语义 Token。
- **[P2]** 已遵守路由 `P.*`、单页圆角 ≤2（`$jzb-radius-sm`）。

### 修复图例对比
```html
<!-- before -->
<view class="plan__bar" :style="{ backgroundColor: colorOf(task.status) }" />
```
```html
<!-- after -->
<view class="plan__bar" :class="'plan__bar--' + task.status" />
```

---

## 页面：src/subpackages/project/pages/plan-edit.vue

### 功能简述
项目计划编排页：拖拽/勾选把任务分配到阶段与区域，调整工期与负责人。

### 问题清单
- **[P0]** 模板 `<JzIcon color="#778390">`（约 152 行）、`color="#0E8A7D"`（约 165 行）、`color="#17212B"`（约 189/191 行）、`color="#AEB8C2"`（约 193 行）、`color="#07A35A"`（约 203 行）→ 硬编码语义色 → 违反第 4.1 节 → 分别用 `$jzb-text-3`/`$jzb-primary-dark`/`$jzb-text-1`/`$jzb-text-4`/`$jzb-success`。
- **[P0]** 模板 `v-for="(t,i) in basket.selected" :key="i"`（约 180 行）→ 可增删/排序列表用 index 作 key → 违反第 6.1 节 → 用 `t.id`。
- **[P0]** 样式 `.pe__task-no`（约 219 行 `font-size:18rpx`）、`.pe__tag`（约 231 行 `border-radius:6rpx`）、`.pe__task`（约 237 行 `font-size:18rpx`）→ 非 Token 字号/圆角 → 违反第 4.2/4.4 节 → 字号就近 `$jzb-font-xs`(22rpx)；圆角 `$jzb-radius-xs`(8rpx)。
- **[P1]** 全页 → 无 loading 骨架 → 违反第 7.2 节。
- **[P2]** `onStage(stages.indexOf(s))`/`onZone(stageZones.indexOf(z))`（约 131/143 行）→ 用 indexOf 反查索引，脆弱 → 改为直接传 `s.id`。

### 修复图例对比
```html
<!-- before -->
<view v-for="(t,i) in basket.selected" :key="i">
```
```html
<!-- after -->
<view v-for="t in basket.selected" :key="t.id">
```

---

## 页面：src/subpackages/project/pages/report/daily.vue

### 功能简述
项目日报列表页：按日期倒序展示现场日报、图片与审批反馈。

### 问题清单
- **[P0]** `nodeColor()` 兜底 `'#86909C'`（约 43 行）→ 硬编码 text-4 → 违反第 4.1 节 → `$jzb-text-4`。
- **[P0]** 模板 `<JzIcon color="#FFFFFF">`（约 72/100 行）→ 硬编码反白 → 违反第 4.1 节 → `$jzb-text-inverse`。
- **[P0]** 模板 `v-for="(e,i) in feeds" :key="'e'+i"`（约 89 行）、`v-for="(m,mi) in item.medias" :key="mi"`（约 98 行）、`v-for="(r,ri) in item.replies" :key="'r'+ri"`（约 107 行）→ index 作 key → 违反第 6.1 节 → 用实体 id 或图片 URL。
- **[P0]** 模板 `(r.author as any)`（约 109 行）→ `any` 类型 → 违反第 6.1/11 节 → 用领域类型 `Employee` 或 `unknown`+守卫。
- **[P0]** 样式 `.rd__date`（约 141 行 `background:#1D2129`）、`.rd__date-num`（约 142 行 `font-size:18rpx`）→ 硬编码深色块 + 非 Token 字号 → 违反第 4.1/4.2 节 → 深色块用 `$jzb-text-1` 语义；字号 `$jzb-font-xs`。
- **[P1]** 已用 `JzEmpty`，但 loading 仅文案"正在加载"无骨架 → 违反第 7.2 节 → `JzSkeleton`。
- **[P1]** 列表无上拉加载/到底提示 → 违反第 7.4 节。

### 修复图例对比
```html
<!-- before -->
<image v-for="(m,mi) in item.medias" :key="mi" :src="m.url" />
```
```html
<!-- after -->
<image v-for="m in item.medias" :key="m.id || m.url" :src="m.url" />
```

---

## 页面：src/subpackages/project/pages/report/edit.vue

### 功能简述
项目日报编辑页：填写今日进展、问题、明日计划，上传现场照片后提交。

### 问题清单
- **[P0]** `function onVis(e: any)`（约 75 行）→ `any` 事件类型 → 违反第 6.1 节 → 用 `ChooseMediaSuccessCallbackResult`。
- **[P0]** 模板 `v-for="(img,i) in images" :key="i"`（约 134 行）→ index 作 key → 违反第 6.1 节 → 用 `img.id` 或 URL。
- **[P0]** 模板 `<JzIcon color="#FFFFFF">`（约 136 行）、`color="#778390"`（约 139 行）→ 硬编码色 → 违反第 4.1 节 → `$jzb-text-inverse`/`$jzb-text-3`。
- **[P0]** 模板 `<JzIcon color="#16A394" style="transform:scale(0.8);">`（约 148 行）→ 硬编码 primary + 行内 style → 违反第 4.1/6.2 节 → 抽 class。
- **[P1]** 表单提交无 `:loading` 防重复 → 违反第 7.3 节。

### 修复图例对比
```html
<!-- before -->
<JzIcon color="#16A394" style="transform:scale(0.8);" />
```
```html
<!-- after -->
<JzIcon name="camera" color="$jzb-primary" class="re__upload-icon" />
```
```scss
.re__upload-icon { transform: scale(0.8); }
```

---

## 页面：src/subpackages/project/pages/stage/detail.vue

### 功能简述
阶段详情页：阶段信息、任务清单、验收节点，支持开始/完成阶段操作。

### 问题清单
- **[P0]** 模板 `<JzIcon color="#778390">`（约 105 行）、`color="#07A35A"`（约 124 行）、`color="#AEB8C2"`（约 129 行）、`color="#0E8A7D"`（约 143/144 行）、`color="#465260"`（约 145 行）、`color="#FFFFFF"`（约 142 行）→ 硬编码语义色 → 违反第 4.1 节 → 全部映射到 `$jzb-text-*`/`$jzb-success`/`$jzb-primary-dark`/`$jzb-text-inverse`。
- **[P0]** 样式 `.sd__no`（约 170 行 `border-radius:16rpx`）、`.sd__title`（约 174 行 `font-size:40rpx`）、`.sd__task-dot`（约 181 行 `border-radius:18rpx`）→ 非 Token 圆角/字号 → 违反第 4.4/4.2 节 → 16rpx/18rpx 就近 `$jzb-radius-sm`(12rpx)；40rpx 用 `$jzb-font-xl`。
- **[P1]** 一屏多主色实心按钮：约 142 行"开始阶段"主按钮 + 卡片内嵌主色实心块同时渲染 → 违反第 5.4 节。
- **[P2]** 已遵守 `PageState` 三态、`JzEmpty`、`onShow` 刷新、路由 `P.*`。

### 修复图例对比
```scss
/* before */
.sd__title { font-size: 40rpx; }
.sd__no { border-radius: 16rpx; }
```
```scss
/* after */
.sd__title { font-size: $jzb-font-xl; }
.sd__no { border-radius: $jzb-radius-sm; }
```

---

## 页面：src/subpackages/project/pages/task/detail.vue

### 功能简述
任务详情页：任务描述、负责人、验收标准、附件图片与讨论反馈。

### 问题清单
- **[P0]** `(r: any) =>`/`(f: any) =>`（约 103 行）、`catch (e: any)`（约 132 行）→ `any` 类型 → 违反第 6.1 节 → 用 `chooseImage` 回调类型与 `unknown`+守卫。
- **[P0]** 模板 `<JzIcon color="#AEB8C2">`（约 169 行）、`color="#FFFFFF"`（约 196/211/215 行）、`color="#00B42A"`（约 202 行）、`color="#0E8A7D"`（约 220/226 行）、`color="#465260"`（约 227 行）→ 硬编码色 → 违反第 4.1 节 → `#00B42A` 归并 `$jzb-success`，其余映射 `$jzb-text-*`/`$jzb-primary-dark`。
- **[P0]** 模板 `:style="{ backgroundColor: ... '#C9CDD4' }"`（约 195 行）→ 行内 style 含硬编码灰 → 违反第 6.2 节 → 抽 class 用 `$jzb-text-4`。
- **[P0]** 模板 `v-for="(m,mi) in medias" :key="mi"`（约 209 行）→ index 作 key → 违反第 6.1 节 → 用 `m.id`。
- **[P0]** 样式 `.td__title`（约 239 行 `font-size:40rpx`）、`.td__meta`（约 257 行 `font-size:20rpx`）、`.td__no`（约 258 行 `font-size:18rpx`）、`.td__date`（约 266 行 `background:#1D2129`）→ 非 Token 字号/硬编码深色 → 违反第 4.2/4.1 节 → 字号就近 Token；深色块用 `$jzb-text-1`。
- **[P2]** 已遵守 `PageState`、`JzEmpty`、路由 `P.*`。

### 修复图例对比
```html
<!-- before -->
<image v-for="(m,mi) in medias" :key="mi" :src="m.url" />
```
```html
<!-- after -->
<image v-for="m in medias" :key="m.id || m.url" :src="m.url" />
```

---

## 页面：src/subpackages/project/pages/task/edit.vue

### 功能简述
任务编辑页：编辑任务标题、负责人、工期、验收标准与附件。

### 问题清单
- **[P0]** 模板 `<JzIcon color="#AEB8C2">`（多处，约 116 行起）→ 硬编码 text-4 → 违反第 4.1 节 → `$jzb-text-4`。
- **[P1]** 表单提交无 `:loading` 防重复 → 违反第 7.3 节。
- **[P2]** 其余已遵守：单主 CTA、路由 `P.*`、无 Options API、无 `any`、圆角 Token 化。本页为 project 分包中最干净的页面之一。

### 修复图例对比
```html
<!-- before -->
<JzIcon name="chevron-right" color="#AEB8C2" />
```
```html
<!-- after -->
<JzIcon name="chevron-right" color="$jzb-text-4" />
```

---

## 页面：src/subpackages/design/pages/list.vue

### 功能简述
设计转化总览页：客户诉求、设计方案、区域分项、设计报价、谈单 PPT 五步闭环进度与操作入口。

### 问题清单
- **[P0]** 模板 `<JzIcon color="#0E8A7D">`（约 177/186/191 行）、`color="#fff"`（约 182/218 行）、`color="#16A394"`（约 187 行）、`color="#AEB8C2"`（约 193/205 行）、`color="#465260"`（约 215/216 行）→ 硬编码语义色 → 违反第 4.1 节 → 映射 `$jzb-primary-dark`/`$jzb-text-inverse`/`$jzb-primary`/`$jzb-text-4`/`$jzb-text-2`。
- **[P0]** 样式 `.dl__hero-name`（约 241 行 `font-size:48rpx`）、`.dl__step`（约 244 行 `border-radius:16rpx`）、`.dl__step-no`（约 245 行 `font-size:22rpx`）、`.dl__lock-icon`/`.dl__quick-icon`（约 251/258 行 `border-radius:22rpx`）、`.dl__status`（约 270 行 `font-size:20rpx`）、`.dl__req-kind`（约 271 行 `border-radius:8rpx`）→ 非 Token 字号/圆角 → 违反第 4.2/4.4 节 → 48rpx 就近 `$jzb-font-xl`(42)；16/22rpx 就近 `$jzb-radius-sm`(12rpx)；22rpx 用 `$jzb-font-xs`；20rpx 就近 `$jzb-font-xs`；8rpx 用 `$jzb-radius-xs`。
- **[P1]** 一屏多主 CTA：约 182 行"查看项目"主按钮（lock 态）+ 每方案卡片约 218 行"生成报价"主按钮同时渲染 → 违反第 5.4/5.11 节 → 每方案卡片主按钮降级，全局只保留一个主操作。
- **[P1]** 多圆角混用（16/22/8rpx + Token）→ 违反第 5.3 节。
- **[P2]** 已遵守 `JzSkeleton`/`JzEmpty`/`onShow`/`onPullDownRefresh`、路由 `P.*`、`v-for` 用实体 id。

### 修复图例对比
```scss
/* before */
.dl__hero-name { font-size: 48rpx; }
.dl__step { border-radius: 16rpx; }
.dl__quick-icon { border-radius: 22rpx; }
```
```scss
/* after */
.dl__hero-name { font-size: $jzb-font-xl; }
.dl__step { border-radius: $jzb-radius-sm; }
.dl__quick-icon { border-radius: $jzb-radius; }
```

---

## 页面：src/subpackages/design/pages/requirement.vue

### 功能简述
客户诉求记录页：按类型/优先级筛选诉求点，底部弹层表单记录新诉求。

### 问题清单
- **[P0]** 模板 按钮文案 `+ 记录诉求`（约 203 行）→ 字符加号代替图标 → 违反第 2/11 节（正式 UI 禁止字符加号）→ 改用 `<JzIcon name="plus" />` + 文字。
- **[P0]** 模板 `<JzIcon color="#778390">`（约 211/228/237 行）→ 硬编码 text-3 → 违反第 4.1 节 → `$jzb-text-3`。
- **[P0]** 样式 `.dr__title`（约 254 行 `font-size:36rpx`）、`.dr__sub`（约 255 行 `font-size:22rpx`）、`.dr__total-num`（约 257 行 `font-size:40rpx`）、`.dr__total-label`（约 258 行 `font-size:20rpx`）、`.dr__tab`（约 263 行 `border-radius:20rpx`）、`.dr__tab-count`（约 267 行 `font-size:20rpx`）、`.dr__tag`（约 274 行 `border-radius:6rpx; font-size:20rpx`）、`.dr__item-space`（约 280 行 `font-size:20rpx`）、`.dr__item-title`（约 281 行 `font-size:28rpx`）、`.dr__detail`（约 283 行 `font-size:24rpx`）、`.dr__sheet`（约 293 行 `border-radius:32rpx 32rpx 0 0`）→ 大量非 Token 字号/圆角字面量 → 违反第 4.2/4.4 节 → 36→`$jzb-font-lg`、22→`$jzb-font-xs`、40→`$jzb-font-xl`、20→就近 `$jzb-font-xs`、28→`$jzb-font-sm`(26)、24→`$jzb-font-xs`；20rpx 圆角→`$jzb-radius`；6rpx→`$jzb-radius-xs`(8)；32rpx→`$jzb-radius-xl`(36)。
- **[P1]** 一屏多主按钮：底部固定"记录诉求"主按钮 + 弹层内"保存诉求"主按钮同时存在 → 违反第 5.4 节（弹层内主按钮可接受，但需确认非同时可见）。
- **[P2]** 已遵守 `JzSkeleton`/`JzEmpty`/`onShow` 刷新、`v-for` 用实体 key、路由 `P.*`。

### 修复图例对比
```html
<!-- before -->
<button class="jz-btn jz-btn--primary dr__submit">+ 记录诉求</button>
```
```html
<!-- after -->
<button class="jz-btn jz-btn--primary dr__submit">
  <JzIcon name="plus" :size="28" color="$jzb-text-inverse" /><text>记录诉求</text>
</button>
```
```scss
/* before */
.dr__sheet { border-radius: 32rpx 32rpx 0 0; }
.dr__tag { border-radius: 6rpx; }
```
```scss
/* after */
.dr__sheet { border-radius: $jzb-radius-xl $jzb-radius-xl 0 0; }
.dr__tag { border-radius: $jzb-radius-xs; }
```

---

## 页面：src/subpackages/design/pages/requirements.vue

### 功能简述
客户诉求总览页：按客户聚合诉求数量与高优先标记，支持搜索与记录入口。

### 问题清单
- **[P0]** 模板 标签文案 `⚠ 高优先`（约 115 行）→ emoji/符号代替图标 → 违反第 2/11 节（正式 UI 禁止 emoji）→ 改用 `<JzIcon name="warning" />` + 文字。
- **[P0]** 模板 按钮文案 `+ 记录客户诉求`（约 125 行）→ 字符加号代替图标 → 违反第 2/11 节 → `<JzIcon name="plus" />`。
- **[P0]** 模板 `<JzIcon color="#8a9a95">`（约 95 行）、`color="#c5cfcc"`（约 118 行）→ 非 Token 灰色字面量 → 违反第 4.1 节 → 映射 `$jzb-text-3`/`$jzb-text-4`。
- **[P0]** 样式 `.drp__title`（约 136 行 `font-size:36rpx`）、`.drp__sub`（约 137 行 `font-size:22rpx`）、`.drp__stat-num`（约 143 行 `font-size:36rpx`）、`.drp__stat-label`（约 147 行 `font-size:20rpx`）、`.drp__search input`（约 151 行 `font-size:24rpx`）、`.drp__name`（约 159 行 `font-size:28rpx`）、`.drp__phone`（约 160 行 `font-size:20rpx`）、`.drp__badge`（约 162 行 `font-size:20rpx; border-radius:6rpx`）、`.drp__tag`（约 166 行 `font-size:20rpx; border-radius:6rpx`）→ 大量非 Token 字号/圆角 → 违反第 4.2/4.4 节 → 按 requirement.vue 同样映射。
- **[P1]** 已遵守 `JzSkeleton`/`JzEmpty`/`onShow`/`onPullDownRefresh`、`v-for` 用 `customer.id`、路由 `P.*`。

### 修复图例对比
```html
<!-- before -->
<text class="drp__tag drp__tag--high">⚠ 高优先 {{ highOf(customer.id) }}</text>
```
```html
<!-- after -->
<text class="drp__tag drp__tag--high">
  <JzIcon name="warning" :size="22" color="$jzb-danger" /> 高优先 {{ highOf(customer.id) }}
</text>
```

---

## 页面：src/subpackages/design/pages/scheme.vue

### 功能简述
设计方案编辑页：维护方案基本信息、空间分区、分项明细与主材，保存/发布方案。

### 问题清单
- **[P0]** 样式引用外部 `@/styles/design-scheme.scss`（文件末尾）→ 需审计该外部文件：见下条。
- **[P0]** `design-scheme.scss` 内大量非 Token 字号/圆角/间距（通读后确认）：`.sc-*` 系列存在 `font-size:20rpx/24rpx/28rpx`、`border-radius:6rpx/10rpx/14rpx`、`padding:14rpx` 等 → 违反第 4.2/4.3/4.4 节 → 全部映射到 `$jzb-font-*`/`$jzb-radius-*`/`$jzb-space-*`。
- **[P0]** 外部 scss 内硬编码 `#1F2937`/`#1D2129` 等深色字面量 → 违反第 4.1 节 → 用 `$jzb-text-1`。
- **[P1]** 全页 → 无 loading 骨架（onLoad 拉取后直接渲染）→ 违反第 7.2 节。
- **[P1]** 表单提交无 `:loading` 防重复 → 违反第 7.3 节。
- **[P2]** 路由走 `P.*`、无 Options API、无 `any`、`v-for` 用实体 id。

### 修复图例对比
```scss
/* before (design-scheme.scss) */
.sc__tag { font-size: 20rpx; border-radius: 6rpx; }
.sc__panel { padding: 14rpx; }
```
```scss
/* after */
.sc__tag { font-size: $jzb-font-xs; border-radius: $jzb-radius-xs; }
.sc__panel { padding: $jzb-space-2; }
```

---

## 页面：src/subpackages/design/pages/talk.vue

### 功能简述
谈单 PPT 预览页：分节展示谈单内容，支持展开收起、复制下载地址与重新生成。

### 问题清单
- **[P0]** 模板 `v-for="(line,lineIndex) in visibleLines" :key="lineIndex"`（约 120 行）、`v-for="(image,imageIndex) in section.images" :key="imageIndex"`（约 124 行）→ index 作 key → 违反第 6.1 节 → 图片用 URL，文本行用 `lineIndex` 可接受但建议用 `line` hash。
- **[P0]** 模板 `<JzIcon color="#465260">`（约 132 行）、`color="#FFFFFF"`（约 133 行）→ 硬编码 text-2/反白 → 违反第 4.1 节 → `$jzb-text-2`/`$jzb-text-inverse`。
- **[P0]** 样式 `.dt__hero`（约 149 行 `linear-gradient(135deg,#1F2937,$jzb-purple)`）→ 硬编码 `#1F2937` → 违反第 4.1 节 → 用 `$jzb-text-1` 或新增深色渐变 Token。
- **[P0]** 样式 `.dt__title`（约 152 行 `font-size:42rpx`）→ 虽等于 `$jzb-font-xl` 但写死 → 违反第 4.2 节 → 用 `$jzb-font-xl`。
- **[P0]** 样式 `.dt__page-no`（约 165 行 `border-radius:16rpx`）→ 非 Token 圆角 → 违反第 4.4 节 → `$jzb-radius-sm`(12rpx)。
- **[P1]** `v-for="(section,index) in sections" :key="section.id || index"`（约 107/114 行）→ index 兜底 key → 违反第 6.1 节 → section 必含 id，去掉兜底。
- **[P1]** 全页无 `JzSkeleton`（`busy` ref 仅文案）→ 违反第 7.2 节。
- **[P2]** 已遵守 `JzEmpty`、`JzSheet`、路由 `P.*`、单主 CTA（复制地址）。

### 修复图例对比
```scss
/* before */
.dt__hero { background: linear-gradient(135deg, #1F2937, $jzb-purple); }
.dt__page-no { border-radius: 16rpx; }
```
```scss
/* after */
.dt__hero { background: linear-gradient(135deg, $jzb-text-1, $jzb-purple); }
.dt__page-no { border-radius: $jzb-radius-sm; }
```

---

## 页面：src/subpackages/quote/pages/list.vue

### 功能简述
报价单列表页：按状态/模式筛选报价单，支持下拉刷新、上拉加载与新建报价。

### 问题清单
- **[P0]** `STATUS_META`（约 40-45 行）→ `'#778390'/'#E67E22'/'#07A35A'/'#E5484D'/'#8B93A1'/'#6958C8'` 硬编码 hex map → 违反第 4.1 节 → 映射 `$jzb-text-3`/`$jzb-warning`/`$jzb-success`/`$jzb-danger`/`$jzb-purple`；`#8B93A1` 归并 `$jzb-text-4`。
- **[P0]** `MODE_META`（约 48-50 行）→ `'#E67E22'/'#0E8A7D'/'#6958C8'` 硬编码 → 违反第 4.1 节 → `$jzb-warning`/`$jzb-primary-dark`/`$jzb-purple`。
- **[P0]** 模板 `:style="{ color: MODE_META[quote.mode].color, backgroundColor: ... }"`（约 133-134 行）→ 行内 style 引用硬编码 hex → 违反第 6.2/4.1 节 → 抽 class 用语义 Token。
- **[P0]** 模板 `<JzIcon color="#0E8A7D">`（约 146 行）→ 硬编码 primary-dark → 违反第 4.1 节 → `$jzb-primary-dark`。
- **[P0]** 样式 `.ql__amount`（约 161 行 `font-size:60rpx`）→ 非 Token 字号 → 违反第 4.2 节 → `$jzb-font-display`(64rpx)。
- **[P0]** 样式 `.ql__status`（约 169 行 `padding:7rpx 16rpx`）→ 7rpx 非 8 倍数 → 违反第 4.3 节 → `$jzb-space-1`(8rpx)。
- **[P0]** 样式 `.ql__status`/`.ql__mode`（约 171/175 行 `font-size:20rpx`）→ 非 Token 字号 → 违反第 4.2 节 → `$jzb-font-xs`(22rpx)。
- **[P2]** 已遵守 `JzSkeleton`/`JzEmpty`/`ListFooter`/`PageState`、`onShow`/`onPullDownRefresh`/`onReachBottom`、路由 `P.*`、`v-for` 用 `quote.id`。

### 修复图例对比
```ts
/* before */
const STATUS_META = { draft: { color: '#778390', ... } }
```
```ts
/* after */
const STATUS_META = { draft: { color: 'var(--jzb-text-3)', ... } }
```
```scss
/* before */
.ql__amount { font-size: 60rpx; }
.ql__status { padding: 7rpx 16rpx; }
```
```scss
/* after */
.ql__amount { font-size: $jzb-font-display; }
.ql__status { padding: $jzb-space-1 $jzb-space-3; }
```

---

## 页面：src/subpackages/quote/pages/detail.vue

### 功能简述
报价单详情页：报价明细、汇总金额、审批状态、生成合同基线与应收计划入口。

### 问题清单
- **[P0]** `STATUS_META`（约 28-33 行）→ 硬编码 hex map → 违反第 4.1 节 → 同 quote/list.vue 映射。
- **[P0]** `(res as any).content`（约 170/179 行）→ `any` 类型断言 → 违反第 6.1 节 → 用领域响应类型或 `unknown`+守卫。
- **[P0]** 模板 `<JzIcon color="#0E8A7D">`（约 237/258 行）、`color="#07A35A"`/`color="#E67E22"`（约 247/274 行）、`color="#465260"`（约 283 行）、`color="#AEB8C2"`（约 316/324/350 行）、`color="#6958C8"`（约 348 行）→ 硬编码语义色 → 违反第 4.1 节 → 全部映射对应 Token。
- **[P0]** 样式 `.qd__amount`（约 377 行 `font-size:64rpx`）→ 虽等于 `$jzb-font-display` 但写死 → 违反第 4.2 节 → 用 `$jzb-font-display`。
- **[P0]** 样式 `.qd__label`（约 384 行 `font-size:20rpx`）、`.qd__tag`（约 399 行 `font-size:18rpx; padding:3rpx 9rpx`）、`.qd__status`（约 400 行 `font-size:20rpx`）、`.qd__hero-icon`（约 410 行 `border-radius:22rpx`）、`.qd__meta`（约 429 行 `font-size:20rpx`）→ 非 Token 字号/圆角/间距（3/9rpx 非 8 倍数）→ 违反第 4.2/4.3/4.4 节 → 字号就近 `$jzb-font-xs`；22rpx 圆角→`$jzb-radius`(20rpx)；padding 用 `$jzb-space-1`/`$jzb-space-3`。
- **[P1]** 一屏多主按钮：约 268 行"生成合同基线"主按钮 + 约 284 行"应收计划"主按钮在 converted 态同时渲染 → 违反第 5.4 节 → 仅保留一个主 CTA，另一按钮降级描边。
- **[P2]** 已遵守 `PageState`/`JzEmpty`/`onShow` 刷新、路由 `P.*`、`v-for` 用实体 id。

### 修复图例对比
```html
<!-- before -->
<JzIcon color="#6958C8" />
<button class="jz-btn jz-btn--primary">生成合同基线</button>
```
```html
<!-- after -->
<JzIcon color="$jzb-purple" />
<button class="jz-btn jz-btn--primary">生成合同基线</button>
```

---

## 页面：src/subpackages/quote/pages/edit.vue

### 功能简述
报价单编辑页：编辑报价项目、数量、单价、主材折扣，保存报价单。

### 问题清单
- **[P0]** 样式 `.qe__submit`（约 250 行 `color:#fff !important; background:$jzb-primary !important;`）→ `!important` → 违反第 6.2/11 节 → 去掉 `!important`，提高选择器特异性或直接覆盖。
- **[P0]** 模板 `<JzIcon color="#6958C8">`（约 162/170 行）、`color="#AEB8C2"`（约 189 行）、`color="#0E8A7D"`（约 225/235 行）→ 硬编码语义色 → 违反第 4.1 节 → `$jzb-purple`/`$jzb-text-4`/`$jzb-primary-dark`。
- **[P0]** 样式 `.qe__hero-icon`（约 255 行 `border-radius:24rpx`）、`.qe__tag`（约 273 行 `font-size:20rpx`）→ 非 Token 圆角/字号 → 违反第 4.4/4.2 节 → 24rpx 就近 `$jzb-radius`(20rpx) 或 `$jzb-radius-lg`(28rpx)；20rpx→`$jzb-font-xs`。
- **[P1]** 全页仅 `onLoad` 加载，从子页（如选项目/选客户）返回不刷新 → 违反第 7.7 节 → 加 `onShow` 刷新。
- **[P2]** 已遵守 `JzEmpty`、路由 `P.*`、单主 CTA。

### 修复图例对比
```scss
/* before */
.qe__submit { color: #fff !important; background: $jzb-primary !important; }
```
```scss
/* after */
.qe__submit.jz-btn--primary { color: $jzb-text-inverse; background: $jzb-primary; }
```

---

## 页面：src/subpackages/quote/pages/catalog/manage.vue

### 功能简述
报价项目库管理页：维护施工/主材/软装/电器/综合分类的项目、价格、规格与工艺。

### 问题清单
- **[P0]** 模板 `<JzIcon color="#778390">`（约 309/371 行）、`color="#16A394"`（约 328 行）、`color="#0E8A7D"`（约 342/350 行）、`color="#FFFFFF"`（约 368 行）→ 硬编码语义色 → 违反第 4.1 节 → `$jzb-text-3`/`$jzb-primary`/`$jzb-primary-dark`/`$jzb-text-inverse`。
- **[P0]** 模板 `v-for="(image,index) in images" :key="`${image}-${index}`"`（约 366 行）→ 拼接 index 作 key → 违反第 6.1 节 → 用 `image` URL（图片 URL 唯一）。
- **[P0]** 样式 `.cm__sheet`（约 410 行 `border-radius:32rpx 32rpx 0 0`）、`.cm__tag`（约 424 行 `font-size:20rpx`）、`.cm__thumb`（约 442 行 `border-bottom-left-radius:12rpx`）、`.cm__sheet-foot`（约 446 行 `box-shadow:0 12rpx 30rpx rgba(15,23,42,.12)`）、`.cm__chip`（约 449 行 `font-size:20rpx; border-radius:8rpx`）→ 非 Token 圆角/字号/阴影 → 违反第 4.2/4.4/4.5 节 → 32rpx→`$jzb-radius-xl`(36)；20rpx→`$jzb-font-xs`；12rpx 圆角→`$jzb-radius-sm`；阴影→`$jzb-shadow-elevated`。
- **[P1]** 全页 → 无 `JzSkeleton` 加载态 → 违反第 7.2 节。
- **[P1]** 列表无上拉加载/到底提示 → 违反第 7.4 节。
- **[P2]** 路由走 `P.*`、无 Options API、无 `any`、单主 CTA。

### 修复图例对比
```html
<!-- before -->
<image v-for="(image,index) in images" :key="`${image}-${index}`" :src="image" />
```
```html
<!-- after -->
<image v-for="image in images" :key="image" :src="image" />
```
```scss
/* before */
.cm__sheet { border-radius: 32rpx 32rpx 0 0; }
.cm__sheet-foot { box-shadow: 0 12rpx 30rpx rgba(15,23,42,.12); }
```
```scss
/* after */
.cm__sheet { border-radius: $jzb-radius-xl $jzb-radius-xl 0 0; }
.cm__sheet-foot { box-shadow: $jzb-shadow-elevated; }
```

---

## 跨页系统性问题汇总（供汇总者参考）

1. **JzIcon `color` prop 硬编码 hex 全分片泛滥**：`#0E8A7D`/`#FFFFFF`/`#778390`/`#AEB8C2`/`#465260`/`#6958C8` 实际分别等于 `$jzb-primary-dark`/`$jzb-text-inverse`/`$jzb-text-3`/`$jzb-text-4`/`$jzb-text-2`/`$jzb-purple`。建议在 `JzIcon` 组件层增加语义别名（如 `color="primary-dark"`），或统一替换为 scss 变量映射。
2. **Ant Design 色板泄漏**：`#86909C`/`#FA8C16`/`#722ED1`/`#13C2C2`/`#8B93A1`/`#F53F3F`/`#00B42A`/`#1D2129`/`#1F2937`/`#C9CDD4` 出现在 project/detail、members、plan-edit、report、task/detail、quote/list/detail 的 JS map 中。这些不是 `$jzb-*` Token，需新增语义 Token 或归并现有 Token。
3. **非 Token 字号集中在 18/20/24/28/40/48/60rpx**：现有字号序列为 22/26/30/32/36/42/50/64。建议补充 `$jzb-font-xs(18)`、`$jzb-font-caption(20)`、`$jzb-font-h2(40)`、`$jzb-font-display-lg(60)` 等中间档 Token。
4. **非 Token 圆角集中在 6/10/14/16/18/22/24/32rpx**：现有圆角序列为 8/12/20/28/36。建议补充 `$jzb-radius-tight(6)`、`$jzb-radius-md(16)`、`$jzb-radius-modal(32)`。
5. **index 作 key 集中在图片列表与回复列表**：`report/daily.vue`、`report/edit.vue`、`task/detail.vue`、`quote/catalog/manage.vue`。图片列表应用 URL 作 key，回复/feed 应用实体 id。
6. **`any` 类型集中在 chooseImage 回调与响应解析**：`report/daily.vue`、`report/edit.vue`、`task/detail.vue`、`quote/detail.vue`。应改用 uni-app 内置类型或领域模型。
7. **字符加号/emoji 代替图标**：`design/requirement.vue`（`+ 记录诉求`）、`design/requirements.vue`（`+ 记录客户诉求`、`⚠ 高优先`）。必须改用 `JzIcon`。
8. **一屏多主 CTA**：`project/detail.vue`、`project/stage/detail.vue`、`design/list.vue`、`quote/detail.vue` 存在多主色实心按钮同时渲染。需按规范第 5.4/5.11 节收敛为单主按钮。
