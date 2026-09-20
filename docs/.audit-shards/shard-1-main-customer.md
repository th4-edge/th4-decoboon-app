# 分片1：主包 + customer + account

> 说明：本分片以实际 Design Token 真源 `src/uni.scss` 的 `$jzb-*`（青绿主色 `#16A394`）为判定基准。
> 两处**系统性偏差**全局只在此说明，下文各页不再重复：① 真源中 `$jzb-space-2:12rpx`、`$jzb-page-pad:28rpx` 本身与"间距 8 倍数 / 页面左右边距 32rpx"不一致；② 全站 `JzIcon` 的 `color` prop 大量传字面量 `#0E8A7D / #778390 / #AEB8C2`（分别等于 `$jzb-primary-dark / $jzb-text-3 / $jzb-text-4`）。`detail.vue` 已改用 `TOKEN_COLOR` JS 映射（来自 `@/styles/tokens`），其余页应照此收敛。

---

## 页面：src/pages/about/index.vue

### 功能简述
产品介绍页：品牌主张、功能模块、业务链路、联系方式与协议入口，纯静态展示。

### 问题清单
- **[P0]** L86/L98/L124/L127/L130/L137/L138 `JzIcon color="#0E8A7D"/"#FFFFFF"/"#AEB8C2"` → 图标色硬编码字面量 → 违反第 4 节（禁止硬编码色值）→ 改用 `TOKEN_COLOR.primary / .inverse / .text4`。
- **[P0]** L153 `.about-hero background: linear-gradient(...#0E8A7D, #147D73 62%, #0B665F)`、L153/L156/L158/L160 `color:#fff` → 品牌渐变与白色硬编码，未用 `$jzb-gradient / $jzb-primary-dark` → 违反第 4 节 → 背景渐变改用 `$jzb-gradient`，文字用 `$jzb-text-inverse`。
- **[P1]** L153 `.about-hero padding:42rpx 34rpx`、L160 `.about-hero__chips text padding:9rpx 18rpx`、L161 `margin-top:36rpx`、L163 `margin-top:10rpx`、L168 `margin-top:9rpx`、L169 `padding:4rpx 22rpx`、L170 `padding:22rpx 0`、L172 `margin-right:14rpx`、L175 `padding:8rpx 24rpx`、L176 `padding:22rpx 0`、L187 `margin-top:20rpx` → 间距大量落在 6/9/10/14/18/20/22/34/36/42 等非 8 倍数网格 → 违反第 5.1 条 → 收敛到 `$jzb-space-1/3/4/5/6/7`。
- **[P1]** L155 `.about-hero__logo border-radius:34rpx`、L166 `.about-pillar__icon border-radius:20rpx`、L172 `.about-module__icon border-radius:17rpx`、L154 `border-radius:50%` → 单页圆角 ≥ 4 种（34/20/17/50%/pill）→ 违反第 5.3 条（≤2 种）→ 统一为 `$jzb-radius / $jzb-radius-pill`。
- **[P2]** L156 `font-size:52rpx`、L162 `font-size:34rpx`、L174 `font-size:20rpx`、L178 `font-size:28rpx`，字重 `760/650/680` → 字号/字重未走 Token → 违反第 4.2 节 → 用 `$jzb-font-*` 与 `$fw-*`。

### 修复图例对比
```scss
/* before */
.about-hero { padding: 42rpx 34rpx; background: linear-gradient(145deg,#0E8A7D,#147D73 62%,#0B665F); color:#fff; }
.about-module__icon { margin-right: 14rpx; border-radius: 17rpx; }
```
```scss
/* after */
.about-hero { padding: $jzb-space-7 $jzb-space-5; background: $jzb-gradient; color: $jzb-text-inverse; }
.about-module__icon { margin-right: $jzb-space-3; border-radius: $jzb-radius; }
```

---

## 页面：src/pages/auth/enterprise.vue

### 功能简述
未加入企业用户的"创建企业"表单：负责人/企业名称/门店/地址，提交后建企业并进入工作台。

### 问题清单
- **[P0]** L70 `JzIcon color="#0E8A7D"` → 图标色硬编码 → 违反第 4 节 → 改 `TOKEN_COLOR.primary`。
- **[P0]** L114 `.ent__card background:#fff` → 卡片底硬编码白 → 违反第 4 节 → 用 `$jzb-bg-card`。
- **[P1]** L109 `.ent padding:48rpx 24rpx 80rpx`、L111 `.ent__icon border-radius:32rpx`、L114 `.ent__card padding:6rpx 28rpx 20rpx`、L115 `padding:24rpx 0 10rpx`、L121 `margin-top:20rpx` → 32rpx 圆角非 Token（Token 为 28/36），6/10/20 非网格 → 违反第 5.1/5.3 条。
- **[P2]** L112 `.ent__title font-size:48rpx`、字重 `750` → 未走字号 Token。
- 已遵守：仅 1 个实心主按钮（L101）；`uni.reLaunch/goTab` 用 `P.login/P.home`；`<script setup>`；无 v-for。

### 修复图例对比
```scss
/* before */
.ent__icon { border-radius: 32rpx; }
.ent__card { padding: 6rpx 28rpx 20rpx; background: #fff; }
```
```scss
/* after */
.ent__icon { border-radius: $jzb-radius-lg; }
.ent__card { padding: $jzb-space-1 $jzb-page-pad; background: $jzb-bg-card; }
```

---

## 页面：src/pages/auth/login.vue

### 功能简述
微信登录页：品牌区、能力卖点、微信登录/手机号授权按钮、协议勾选。

### 问题清单
- **[P0]** L131/L132/L133 `color="#0E8A7D"`、L144/L149/L154 `color="#FFFFFF"` → 图标色硬编码。
- **[P1]** L170 `.login__shell padding-left/right:40rpx` → 页面左右安全边距 40rpx，与全项目 `$jzb-page-pad` 不统一 → 违反第 5.2 条。
- **[P1]** L171 `margin-top:54rpx`、L173 `margin-left:22rpx`、L176 `margin-top:80rpx`、L178 `margin-top:38rpx`、L179/L183 `gap:10rpx`、L180 `padding:34rpx 30rpx 28rpx`、L183 `margin-top:36rpx`、L185 `margin-right:10rpx` → 22/30/34/36/38/40/54/10 非网格 → 违反第 5.1 条。
- **[P1]** L172 `.login__logo border-radius:32rpx` → 圆角非 Token（28/36）。
- **[P2]** L174 `font-size:44rpx`、L177 `font-size:46rpx`、字重 `780/760/750`；L15 动态 `:style="{ paddingTop: padTop }"` 属运行时计算，豁免内联 style 禁令。
- 已遵守：仅 1 个主按钮（两种状态互斥 `v-if/v-else`）；`P.userAgreement/P.privacyPolicy`；协议勾选有 `:active` 态。

### 修复图例对比
```scss
/* before */
.login__shell { padding-left: 40rpx; padding-right: 40rpx; }
.login__logo { border-radius: 32rpx; }
```
```scss
/* after */
.login__shell { padding-left: $jzb-page-pad; padding-right: $jzb-page-pad; }
.login__logo { border-radius: $jzb-radius-lg; }
```

---

## 页面：src/pages/company/join.vue

### 功能简述
已登录未入企业页：身份卡、邀请码/链接输入、查看邀请、创建企业、切换微信账号。

### 问题清单
- **[P0]** L92 `color="#778390"`、L122 `color="#0E8A7D"`、L126 `color="#465260"` → 图标色硬编码。
- **[P1]** L168 `.join-invite__desc margin-top:12rpx`、L171 `.join-invite__input height:88rpx` → 88rpx 输入框高非 `$jzb-control-height(92)`，12rpx 属系统偏差 Token（保留即可，但需注明来源）。
- 已遵守：圆角仅 `$jzb-radius-sm` 一类；主按钮仅"查看邀请"1 个实心，其余 ghost/neutral；`P.enterprise/P.companyJoin/P.login`；v-for 无；`<script setup>`。

### 修复图例对比
```vue
<!-- before -->
<JzIcon name="info" :size="24" color="#778390" />
<!-- after -->
<JzIcon name="info" :size="24" :color="TOKEN_COLOR.text3" />
```

---

## 页面：src/pages/customer/list.vue

### 功能简述
客户列表 Tab 页：搜索、门店筛选、黄金时段/派单/跟进概览、阶段筛选、客户卡片流、下拉刷新/上拉加载。

### 问题清单
- **[P0]** L103–L106 `goldenMeta` 返回 `'#E5484D' / '#FF7D00' / '#168A96' / '#86909C'` → 营销分层色硬编码，且 `#FF7D00 / #86909C` 不在 Token 体系（后者为纯灰）→ 违反第 4 节/第 11 条（禁纯灰）。
- **[P0]** L259–L264 多个 `JzTag color="#07A35A"/"#AEB8C2"/"#E67E22"/"#6958C8"/"#0E8A7D"`、L183/L205/L210/L240/L248 `JzIcon color=...` → 状态/图标色硬编码字面量。
- **[P0]** L283 `linear-gradient(135deg,#FFF7F4,#FFFFFF)`、L294 `linear-gradient(135deg,#FFF8EE,#FFFFFF)`、L299/L305 `background:#fff`、L339 `.cl__grade--b color:#3b6fd4;background:#eef3ff` → 暖色渐变与 B 级评级蓝硬编码。
- **[P1]** L289/L311 `font-size:34rpx`、L309 `font-size:20rpx`、L337 `.cl__grade font-size:20rpx`、L308 `.cl__follow-tasks margin:0 24rpx 16rpx`（横向 24rpx 与卡片 `$jzb-page-pad(28)` 不齐）、L315 `padding-bottom:152rpx` → 字号/横向边距不统一。
- 已遵守（三态与列表规范优秀）：L229 `JzSkeleton` 加载、L272 错误卡+重试、L273 `JzEmpty` 带 sub、L274 `ListFooter`、L44 `onShow` 刷新、L45 下拉刷新、L46 上拉加载；v-for 用 `c.id`；主操作仅 FAB 1 个。

### 修复图例对比
```ts
/* before */
if (days <= 3) return { label: '黄金期 0-3天', color: '#E5484D' }
if (days <= 7) return { label: '升温期 4-7天', color: '#FF7D00' }
/* after */
if (days <= 3) return { label: '黄金期 0-3天', color: TOKEN_COLOR.danger }
if (days <= 7) return { label: '升温期 4-7天', color: TOKEN_COLOR.warning }
```

---

## 页面：src/pages/dynamic/index.vue

### 功能简述
"同频动态"Tab 页：工地现场汇报时间流，支持写汇报 ActionSheet 选项目。

### 问题清单
- **[P0]** L104 `.dy__scope background: linear-gradient(135deg,#FFFFFF,#F4FBFA)` → 渐变次色 `#F4FBFA` 硬编码。
- **[P1]** L104 `.dy__scope margin:0 $jzb-page-pad 22rpx`、L106 `.dy__scope-count padding:8rpx 18rpx` → 22rpx/18rpx 非网格。
- **[P1]** 无 loading 骨架态：`refresh()`（L38）失败仅 `toastError` 并置空数组，首屏与失败时无骨架/错误重试 UI → 违反第 7.2 条三态要求。
- 已遵守：L86 `JzEmpty` 带 sub；L29 `onShow` 刷新；L30 下拉刷新；v-for `r.id`；路由全 `P.*`；无实心主按钮。

### 修复图例对比
```vue
<!-- before -->
<view v-if="!feed.length" class="jz-card dy__empty">
<!-- after -->
<JzSkeleton v-if="loading" :rows="3" />
<view v-else-if="!feed.length" class="jz-card dy__empty">
```

---

## 页面：src/pages/finance/index.vue

### 功能简述
财务工作台 Tab 页：账面余额、四张统计卡、资金闭环流程、快捷入口、风险待收/待付、最近流水。

### 问题清单
- **[P0]** L44–L59 `stats/quick` 中大量 `tone:'#E8F7F5'/'#EAF8F0'/'#FFF4E8'/'#FDECEC'`、`color:'#0E8A7D'/'#07A35A'/'#E67E22'/'#E5484D'` → 语义软底/前景色全部硬编码字面量（应映射 `$jzb-*-soft`/语义 Token）。
- **[P0]** L108/L113/L118 行内 `style="background:#EAF8F0;"` / `style="background:#E8F7F5;"` / `style="background:#FFF4E8;"` → 行内硬编码色（非动态计算）→ 违反第 6.2 节/第 11 条。
- **[P0]** L103/L106/L111/L116/L131 等 `JzIcon color="#0E8A7D"/"#AEB8C2"/"#07A35A"/"#E67E22"` → 图标色硬编码。
- **[P1]** `loading` ref（L19）存在但模板未渲染骨架：summary 未返回时数字卡/流程直接显示 `0` 与空结构；失败仅 toast → 违反第 7.2 条 loading/error 态。
- 已遵守：空态 L156/L169/L187 均用 `JzEmpty` 带 sub；L25 `onShow` 刷新；L26 下拉刷新；v-for 用 `item.id`；样式集中在 `@/styles/finance.scss`。

### 修复图例对比
```vue
<!-- before -->
<view class="fin-flow__icon" style="background:#EAF8F0;"><JzIcon name="check-circle" :size="28" color="#07A35A" /></view>
<!-- after -->
<view class="fin-flow__icon fin-flow__icon--success"><JzIcon name="check-circle" :size="28" :color="TOKEN_COLOR.success" /></view>
```
```scss
.fin-flow__icon--success { background: $jzb-success-soft; }
```

---

## 页面：src/pages/index/index.vue

### 功能简述
首页工作台：问候+企业归属、OnboardingChecklist、角色统计卡、业绩卡、快捷入口、需要关注、我的项目、最新动态。

### 问题清单
- **[P0]** L111/L121–L153 `attentionAlerts`、L171–L235 `statCards` 中数十处 `iconColor:'#E5484D'/'#E67E22'/'#6958C8'/'#0E8A7D'/'#07A35A'`、`tone:'#E8F7F5'/'#F0EEFC'/'#FFF4E8'/'#FDECEC'`，其中 L207/L487 `'#2F54EB'`（团队客户/团队业绩图标）**不在任何 Token** → 违反第 4 节。
- **[P0]** L393/L411/L415/L426/L442… `JzIcon color="#FFFFFF"/"#778390"/"#0E8A7D"/"#AEB8C2"/"#8D98A5"` → 图标色硬编码，`#8D98A5` 非 Token。
- **[P1]** `refresh()`（L239）**无 try/catch**：任一接口 reject 即未捕获 Promise 拒绝，页面无 loading 骨架、无错误重试 UI（统计卡持续空）→ 违反第 7.2 条。
- **[P2]** L2 `function go(url){...}` 写在所有 `import` 之前 → 违反第 6.4 节导入顺序。
- 已遵守：L60 `onShow` 刷新并 `onboardingRef.reload()`（符合第 7.7 节可变引导刷新）；L66 下拉刷新；L534/L571 `JzEmpty` 带 sub；v-for 用 `s.label/a.key/p.id/r.id/q.label`；样式集中 `@/styles/home.scss`。

### 修复图例对比
```ts
/* before */
{ label: '团队客户', val: r.customerCount, color: '#2F54EB', icon: 'users', tone: '#E8F7F5' }
/* after */
{ label: '团队客户', val: r.customerCount, color: TOKEN_COLOR.primary, icon: 'users', tone: TOKEN_COLOR.primarySoft }
```

---

## 页面：src/pages/invite/accept.vue

### 功能简述
邀请接受页：展示邀请/项目信息，微信授权手机号后加入企业或绑定业主项目。

### 问题清单
- **[P0]** L148 `JzTag color="#07A35A"/"#E5484D"`、L163 `JzIcon color="#0E8A7D"` → 色值硬编码。
- **[P1]** L179 `gap:18rpx`、L182 `margin-top:6rpx`、L183 `padding-top:10rpx`、L184 `padding:20rpx 0`、L187 `padding:20rpx` → 6/10/18/20 非网格。
- **[P1]** L165 `<view class="invite-loading">正在加载邀请…</view>` 为纯文字占位、失败仅 toast，无骨架/错误重试 UI → 违反第 7.2 条。
- 已遵守：仅 1 个主按钮（L167）；`P.home/login`；`<script setup>`；邀请类型/状态机由后端返回。

### 修复图例对比
```vue
<!-- before -->
<JzTag :text="statusText" :color="invite.status === 'pending' ? '#07A35A' : '#E5484D'" />
<!-- after -->
<JzTag :text="statusText" :color="invite.status === 'pending' ? TOKEN_COLOR.success : TOKEN_COLOR.danger" />
```

---

## 页面：src/pages/legal/agreement.vue

### 功能简述
用户协议长文本页：版本信息 + 十二章条款静态展示。

### 问题清单
- **[P1]** L90 `.legal__body padding:24rpx`（左右 24rpx，与全项目 `$jzb-page-pad` 不统一）、L91 `.legal__card padding:26rpx`、`margin-top:20rpx`、L92 `margin-bottom:18rpx`、L97 `margin-top:18rpx`、L89 `padding-bottom:60rpx` → 24/26/20/18/60 非网格/边距不统一 → 违反第 5.1/5.2 条。
- 已遵守：无按钮/无主色实心；无硬编码色值；无 v-for；纯静态页无需三态；`JzPageHeader`。

### 修复图例对比
```scss
/* before */
.legal__body { padding: 24rpx; }
.legal__card { margin-top: 20rpx; padding: 26rpx; }
/* after */
.legal__body { padding: $jzb-space-5 $jzb-page-pad; }
.legal__card { margin-top: $jzb-space-4; padding: $jzb-space-5; }
```

---

## 页面：src/pages/legal/privacy.vue

### 功能简述
隐私政策长文本页：版本信息 + 九章个人信息处理规则静态展示。

### 问题清单
- **[P1]** L78 `.legal__body padding:24rpx`、L79 `.legal__card padding:26rpx`/`margin-top:20rpx`、L80 `margin-bottom:18rpx`、L85 `margin-top:18rpx`、L77 `padding-bottom:60rpx` → 与 agreement.vue 相同的非网格/边距不统一问题（两页样式应抽取公共）→ 违反第 5.1/5.2 条。
- 已遵守：无硬编码色值；无按钮；纯静态页。

### 修复图例对比
同 `legal/agreement.vue`，两页应收敛为同一组 `.legal__*` Token 化样式。

---

## 页面：src/pages/mine/index.vue

### 功能简述
"我的"Tab 页：身份卡、按角色分组的设置/经营入口列表、退出登录。

### 问题清单
- **[P0]** L126 `JzIcon color="#0E8A7D"`、L129/L135 `color="#AEB8C2"` → 图标色硬编码。
- **[P1]** L144 `.mine__profile padding:30rpx 28rpx`、L145 `margin-left:22rpx`、L149 `margin-bottom:26rpx`、L150 `gap:12rpx`/`margin-bottom:12rpx`/`padding:0 4rpx`、L154 `.mine__group .jz-cell padding:22rpx`、L155 `margin-right:18rpx`/`border-radius:18rpx`、L158 `.mine__cell-arrow font-size:36rpx` → 22/26/30/22/18/18 非网格，18rpx 圆角非 Token。
- **[P1]** `refresh()`（L26）无 loading 态：成员数/项目数首次进入时卡片先显示 0，无骨架 → 违反第 7.2 条。
- 已遵守：L110 `:style="{ backgroundColor: roleMeta.soft }"` 为来自角色元数据的动态计算，豁免；L23 `onShow` 刷新；L24 下拉刷新；v-for 用 `group.key/item.label`；退出为 ghost 按钮，无实心主按钮。

### 修复图例对比
```scss
/* before */
.mine__cell-icon { margin-right: 18rpx; border-radius: 18rpx; }
/* after */
.mine__cell-icon { margin-right: $jzb-space-3; border-radius: $jzb-radius-sm; }
```

---

## 页面：src/pages/project/list.vue

### 功能简述
项目工地 Tab 页：状态筛选、项目卡片（封面/进度/负责人）、新建项目、下拉刷新/上拉加载。

### 问题清单
- **[P0]** L121 `color="#0E8A7D"`、L128/L132/L143/L144/L145 `color="#778390"` → 图标色硬编码。
- **[P1]** L160 `.pl__filter-row padding:16rpx $jzb-page-pad 22rpx`、L161 `.pl__filter margin-right:14rpx`/`background:#fff`、L171 `margin-left:20rpx`、L175 `padding-top:18rpx`、L176 `margin-bottom:10rpx`、L178 `gap:20rpx`、L180 `margin-left:7rpx` → 14/18/20/10/7 非网格；`background:#fff` 硬编码。
- 已遵守（三态/列表规范为全分片标杆）：L106 `PageState state="error"` 带重试、L107 `JzSkeleton`、L108 `JzEmpty` 带引导按钮、L150 `ListFooter`、L36 `onShow` 刷新、L37 下拉、L38 上拉；v-for `p.id`；主操作仅 FAB。

### 修复图例对比
```scss
/* before */
.pl__filter { margin-right: 14rpx; background: #fff; border-radius: $jzb-radius-pill; }
/* after */
.pl__filter { margin-right: $jzb-space-3; background: $jzb-bg-card; border-radius: $jzb-radius-pill; }
```

---

## 页面：src/subpackages/customer/pages/detail.vue

### 功能简述
客户详情（重点页）：身份卡、打电话/复制号码、销售五步步骤条、房屋横滑卡、客户信息、客户画像、跟进记录、评级依据浮层、主操作 FAB。

### 对照 AGENTS.md 第 15 节 15 条专项基准
1. **销售流程单一承载** ✅ L483 已用 `SalesSteps`，无"业务流程/设计转化/方案报价"三张并列卡。
2. **五步固定** ✅ `salesStage`（L201）映射 visit→follow→measure→design→quote。
3. **当前阶段唯一 CTA** ✅ `primaryAction`（L209）单一，经 `SalesSteps action-label` 渲染。
4. **按钮文案唯一** ✅ FAB"写跟进"与主按钮"写跟进"互斥（L625 `v-if primaryAction?.kind!=='follow'`），同屏不重复。
5. **房屋信息只表达一次** ✅ 统一在 `HouseCard`，无独立"当前房屋"卡。
6. **多房横滑** ✅ L503 `scroll-view scroll-x`。
7. **身份卡只放身份** ✅ 头像/姓名/电话/阶段/顾问/设计师；到店次数下沉到跟进工具按钮（L567）。
8. **图标+文字可识别** ✅ L473/L477 打电话、复制号码均 `JzIcon+文本`。
9. **主色高亮 ≤2** ✅ SalesSteps 当前节点 + 主按钮；实心主按钮仅 1。
10. **key-value 两列栅格** ✅ L706 `.cd__info-label width:160rpx`。
11. **空值统一 `—`** ✅ L462/L467/L533 等 `|| '—'`。
12. **可点击可辨识** ✅ 新增/编辑入口带 `plus/edit` 图标。
13. **底部固定栏主次** ⚠️ 已改为右下角 FAB（注释 L618–622 说明），与 15.1 目标结构的"底部固定双按钮"不同；属有意偏离，建议在规范中回写。
14. **长编号折叠** 委托 `HouseCard` 组件实现（本页内不可见），通过即可。
15. **无长段业务说明** ✅ 画像空态仅一句引导（L556）。

### 问题清单
- **[P0]** L447 `JzIcon color="#778390"`、L453/L546 `color="#0E8A7D"` → 同页内未统一用本页已引入的 `TOKEN_COLOR`（L474/L478 等已正确用）。
- **[P0]** L649 `.cd__grade--b color:#3b6fd4;background:#eef3ff`、L668 `.cd__tag--behavior color:#3b6fd4;background:#eef3ff`、L669 `.cd__tag--intent… color:#6657c8;background:#f0eefc`、L670 `.cd__tag--risk color:#c93c42;background:#fdecec` → 评级/标签色硬编码（`#fdecec` 应为 `$jzb-danger-soft`，`#f0eefc` 应为 `$jzb-purple-soft`）。
- **[P0]** L654 `.cd__grade-mask background: rgba(0,0,0,.5)` → 纯黑遮罩，应用 `$bg-mask` 语义。
- **[P1]** 圆角种类 >2：L647/L666 `999rpx`（pill）、L655 `32rpx`、L660 `16rpx`、L684/L687 `12rpx` → 同页 4 种圆角 → 违反第 5.3 条。
- **[P1]** 非网格间距：L647 `padding:2rpx 14rpx`、L652 `margin-left:6rpx`、L659 `gap:20rpx`、L660 `padding:20rpx`、L677 `.cd__portrait margin:20rpx 24rpx`、L684 `padding:14rpx`、L687 `margin-top:14rpx`/`padding:16rpx`、L701 `padding:22rpx 24rpx`、L703 `padding:8rpx 26rpx` → 14/6/20/22/26 非网格。
- **[P2]** L654 `z-index:1100` 硬编码（应为 `$z-modal/z-mask`）；L657/L662/L663 字号 32/24rpx、L647/L666/L675 字号 20rpx 未走 Token。
- 已遵守：L429 `JzSkeleton`、L490 内联错误+重试、L519/L579 `JzEmpty`、L608 加载错误重试、L251 `onShow` 刷新（第 7.7 节）、v-for 全用 `tag.key/property.id/item.id/item.dimension`、路由全 `P.*`、按 customerId 过滤避免串号（FIX-001 注释）。

### 修复图例对比
```scss
/* before */
.cd__grade--b { color: #3b6fd4; background: #eef3ff; }
.cd__tag--risk { color: #c93c42; background: #fdecec; }
.cd__grade-mask { z-index: 1100; background: rgba(0,0,0,0.5); }
/* after */
.cd__grade--b { color: $jzb-purple; background: $jzb-purple-soft; }
.cd__tag--risk { color: $jzb-danger; background: $jzb-danger-soft; }
.cd__grade-mask { z-index: $z-modal; background: $bg-mask; }
```

---

## 页面：src/subpackages/customer/pages/edit.vue

### 功能简述
新建/编辑客户基础资料表单：姓名、手机号、性别、来源、小区、地址、面积、预算、备注。

### 问题清单
- **[P0]** L92/L98 `JzIcon color="#AEB8C2"` → 图标色硬编码。
- **[P1]** L137 `.ce__label width:170rpx`、L134 `.ce__row min-height:104rpx`、L143 `margin-top:6rpx`/`font-size:20rpx`、L150 textarea `padding:18rpx 20rpx`/`height:170rpx` → 170/104/6/20/18/170 非网格。
- **[P2]** `load()`（L37）静默失败（无 try/catch），表单回填失败无提示 → 违反第 7.3 条不静默失败。
- 已遵守：仅 1 个主按钮（L124）；必填 `*` 标记（L79/L83）；`P.login/P.customerBack`；`<script setup>`。

### 修复图例对比
```vue
<!-- before -->
<JzIcon name="chevron-right" :size="26" color="#AEB8C2" />
<!-- after -->
<JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
```

---

## 页面：src/subpackages/customer/pages/flow.vue

### 功能简述
客户业务流转只读时间线：设计方案、报价、谈单 PPT、合同、项目工地分区列表。

### 问题清单
- **[P0]** L137/L146/L155/L164/L174 `JzIcon color="#AEB8C2"`（6 处）→ 图标色硬编码。
- **[P1]** L185 `.flow__head background:linear-gradient(145deg,$jzb-primary-lightest,#FFFFFF)`（`#FFFFFF` 字面量）、`padding:30rpx`；L186 `font-size:20rpx`/`letter-spacing:2rpx`/字重 `720`；L187 `margin-top:10rpx`；L189 `.flow__list padding:6rpx 24rpx`；L190 `min-height:100rpx`；L193 `margin-top:6rpx`；L194 `font-size:20rpx` → 30/20/10/6/100 非网格。
- **[P1]** `loading` ref（L30）存在但模板未渲染任何加载指示 → 违反第 7.2 条 loading 态。
- 已遵守：各分区空态 L140/L149/L158/L167/L177 均 `JzEmpty` 带 sub；L54 `onShow` 刷新；v-for 用 `item.id`；无实心主按钮。

### 修复图例对比
```scss
/* before */
.flow__head { padding: 30rpx; background: linear-gradient(145deg, $jzb-primary-lightest, #FFFFFF); }
/* after */
.flow__head { padding: $jzb-space-5; background: linear-gradient(145deg, $jzb-primary-lightest, $jzb-bg-card); }
```

---

## 页面：src/subpackages/customer/pages/follow.vue

### 功能简述
写跟进表单：客户/上次跟进摘要、跟进方式 chips、内容、下次跟进日期、保存。

### 问题清单
- **[P2]** L42 `catch { /* 客户上下文加载失败不阻断写跟进 */ }` → 上下文加载失败静默、无任何提示或重试 → 违反第 7.3 条不静默失败。
- **[P2]** L122 `.cf__textarea height:220rpx`、L123 `.cf__date height:88rpx`（非 `$jzb-control-height 92`）→ 控件高度未走 Token。
- 已遵守：无硬编码色值（全 `$jzb-*`）；圆角仅 pill 一类；仅 1 个主按钮（L99）；v-for `w.key`；必填 `*` 标记。

### 修复图例对比
```vue
<!-- before -->
} catch {
  // 客户上下文加载失败不阻断写跟进
}
<!-- after -->
} catch (error) {
  toastError(error, '客户上下文加载失败，可继续填写跟进')
}
```

---

## 页面：src/subpackages/customer/pages/measure-record.vue

### 功能简述
登记量房事实表单：量房日期/时间、现场照片地址清单、保存。

### 问题清单
- **[P0]** L82 `JzIcon color="#0E8A7D"`、L98 `color="#778390"` → 图标色硬编码。
- **[P1]** L110 `.mr__icon width/height:82rpx`/`margin-right:20rpx`/`border-radius:24rpx`、L115 `.mr__group--gap margin-top:34rpx`、L118 `.mr__label width:170rpx`、L120 `.mr__notice padding:20rpx`/`gap:12rpx`/`margin-top:20rpx`、L121 `.mr__textarea min-height:118rpx`/`margin-top:14rpx`/`padding:20rpx` → 82/20/24/34/170/118/14 非网格，24rpx 圆角非 Token。
- 已遵守：仅 1 个主按钮（L103 带 `:loading` 防重复）；`P.login`；textarea `maxlength`；`<script setup>`。

### 修复图例对比
```scss
/* before */
.mr__icon { width: 82rpx; height: 82rpx; margin-right: 20rpx; border-radius: 24rpx; }
/* after */
.mr__icon { width: $jzb-space-7; height: $jzb-space-7; margin-right: $jzb-space-3; border-radius: $jzb-radius; }
```

---

## 页面：src/subpackages/customer/pages/measure.vue

### 功能简述
约定量房时间表单：介绍卡、客户卡、日期/时间选择、提交进入"待量房"。

### 问题清单
- **[P0]** L62 `JzIcon color="#0E8A7D"` → 图标色硬编码。
- **[P1]** L101 `.cm__intro padding:26rpx`/`margin-bottom:20rpx`、L102 `.cm__icon 82rpx`/`margin-right:20rpx`/`border-radius:24rpx`、L105 `.cm__customer padding:26rpx`、L108 `.cm__form padding:8rpx 28rpx`、L109 `min-height:100rpx`、L111 `.cm__label width:180rpx`、L114 `.cm__tip margin:22rpx 6rpx` → 26/20/82/24/100/180/22/6 非网格。
- 已遵守：仅 1 个主按钮（L93 `:disabled="!canSubmit"`，表单校验通过前禁用）；含"必须晚于当前时间"校验（L45）；`<script setup>`。

### 修复图例对比
```scss
/* before */
.cm__icon { width: 82rpx; height: 82rpx; margin-right: 20rpx; border-radius: 24rpx; }
/* after */
.cm__icon { width: $jzb-space-7; height: $jzb-space-7; margin-right: $jzb-space-3; border-radius: $jzb-radius; }
```

---

## 页面：src/subpackages/customer/pages/portrait-edit.vue

### 功能简述
客户画像表单：9 个下拉画像字段 + 5 项顾虑多选 chips，保存后回显完整度。

### 问题清单
- **[P0]** L132 `JzIcon color="#0E8A7D"`、L146 `color="#8D98A5"`（非 Token）、L168 `color="#778390"` → 图标色硬编码。
- **[P1]** L180 `.pe__customer gap:14rpx`、L182 `font-size:22rpx`、L183 `margin-top:20rpx`、L184 `.pe__field padding:18rpx 0`、L187 `font-size:26rpx`、L188 `font-size:20rpx`、L189 `.pe__picker padding:18rpx 20rpx`/`border-radius:12rpx`/`font-size:24rpx`、L192 `.pe__chip padding:10rpx 22rpx`/`font-size:22rpx`、L194 `.pe__tip gap:10rpx`/`padding:16rpx`/`border-radius:12rpx`/`font-size:20rpx` → 14/22/20/18/26/24/10/12 非网格；圆角 12rpx+999rpx 两类（合规）。
- 已遵守：仅 1 个主按钮（L173）；v-for `field.key/item.value`；`<script setup>`。

### 修复图例对比
```vue
<!-- before -->
<JzIcon name="chevron-down" :size="24" color="#8D98A5" />
<!-- after -->
<JzIcon name="chevron-down" :size="24" :color="TOKEN_COLOR.text3" />
```

---

## 页面：src/subpackages/customer/pages/property-edit.vue

### 功能简述
新增/编辑房屋档案：详细地址、小区、楼栋、房号、面积、户型、备注。

### 问题清单
- **[P0]** L104 `JzIcon color="#0E8A7D"` → 图标色硬编码。
- **[P1]** L159 `.pe__field min-height:104rpx`、L162 `.pe__label width:176rpx` → 104/176 非网格。
- 已遵守：仅 1 个主按钮（L144 带 `:loading`/`:disabled`）；必填 `*`（L113）；编辑/新增模式由 `propertyId` 派生；`<script setup>`；无 v-for。

### 修复图例对比
```vue
<!-- before -->
<JzIcon name="user" :size="30" color="#0E8A7D" />
<!-- after -->
<JzIcon name="user" :size="30" :color="TOKEN_COLOR.primary" />
```

---

## 页面：src/subpackages/customer/pages/tag-manage.vue

### 功能简述
客户标签管理：系统标签只读、已选标签移除、可添加标签绑定、老板/店长新建与字典维护。

### 问题清单
- **[P0]** L161 `JzIcon color="#0E8A7D"`、L179 `color="#C93C42"`、L189 `color="#0E8A7D"`；L234 `.tm__chip--bound color:#c93c42;background:#fdecec`、L247 `.tm__dict-action--danger color:#c93c42` → 危险色硬编码（应 `$jzb-danger / $jzb-danger-soft`）。
- **[P1]** L22 `canMaintainDictionary = ['boss','storemanager']` → 角色拼写小写 `'storemanager'`，而工程内实际角色为 `'storeManager'`（见 detail.vue L70），导致老板/店长字典维护区对店长永不显示 → 权限判断 BUG（业务越权/漏显）→ 违反第 1 节权限规则。
- **[P1]** L171/L182/L193/L217 空态为纯文字"暂无系统标签/尚未添加…"，未用 `JzEmpty` → 违反第 7.2/第 11 条空态规范。
- **[P1]** L226 `gap:14rpx`、L228/L232/L236/L246 `font-size:22rpx`、L230 `margin-top:20rpx`、L230 `font-size:26rpx`、L232 `padding:10rpx 20rpx`/`gap:6rpx`、L238/L239 `height:76rpx`/`font-size:24rpx`/`border-radius:12rpx`、L245 `font-size:20rpx` → 14/22/20/26/10/6/76/24 非网格。
- 已遵守：绑定/移除/停用均二次确认（`showModal`）或即时 reload；v-for `tag.id`；新建按钮带 `:disabled`。

### 修复图例对比
```ts
/* before (BUG) */
const canMaintainDictionary = computed(() => ['boss', 'storemanager'].includes(session.role || ''))
/* after */
const canMaintainDictionary = computed(() => ['boss', 'storeManager'].includes(session.role || ''))
```
```vue
<!-- before -->
<text v-else class="tm__empty">暂无系统标签</text>
<!-- after -->
<JzEmpty v-else text="暂无系统标签" sub="系统按客户事实自动生成标签" />
```

---

## 页面：src/subpackages/customer/pages/wechat-record.vue

### 功能简述
记录/更新客户微信号：客户摘要、微信号可选输入、确认按钮。

### 问题清单
- **[P0]** L56 `JzIcon color="#0E8A7D"`、L67 `color="#778390"` → 图标色硬编码。
- 已遵守：无其他硬编码色值（样式全 `$jzb-*`）；间距基本 Token 化；仅 1 个主按钮（L74 带 `:loading`/`:disabled`）；`P.login`；无 v-for。**无 P1 问题。**

### 修复图例对比
```vue
<!-- before -->
<JzIcon name="user" :size="30" color="#0E8A7D" />
<!-- after -->
<JzIcon name="user" :size="30" :color="TOKEN_COLOR.primary" />
```

---

## 页面：src/subpackages/account/pages/password.vue

### 功能简述
设置/修改 Web 登录密码：状态卡、原密码/新密码/确认密码表单、显示切换、提交。

### 问题清单
- **[P0]** L86 `JzIcon color="#0E8A7D"`、L106/L114/L122 `color="#8A95A1"`（非 Token 灰）→ 图标色硬编码。
- **[P1]** L139 `.password-status__icon width/height:80rpx`/`margin-right:20rpx`/`border-radius:24rpx`、L146 `.password-field min-height:108rpx`、L148 `.password-field__label width:150rpx`、L152 `.password-tip margin-top:22rpx`/`padding:0 12rpx` → 80/20/24/108/150/22 非网格。
- 已遵守：密码强度/长度/字母数字校验（L39–L46）、两次一致性校验；仅 1 个主按钮（L127 带 `:loading`）；`P.mine`；无 v-for。

### 修复图例对比
```vue
<!-- before -->
<JzIcon :name="showNew ? 'eye-off' : 'eye'" :size="34" color="#8A95A1" />
<!-- after -->
<JzIcon :name="showNew ? 'eye-off' : 'eye'" :size="34" :color="TOKEN_COLOR.text3" />
```
```scss
/* before */
.password-status__icon { width: 80rpx; height: 80rpx; margin-right: 20rpx; border-radius: 24rpx; }
/* after */
.password-status__icon { width: $jzb-space-7; height: $jzb-space-7; margin-right: $jzb-space-3; border-radius: $jzb-radius; }
```
