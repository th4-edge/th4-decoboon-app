# 分片4：company + message + supply + subscription

审计基准：Design Token 真源为 `src/uni.scss` 的 `$jzb-*`（主色 `$jzb-primary:#16A394`），路由真源为 `src/config/index.ts` 的 `P.*`。
系统性偏差（不逐页重复点名，仅在具体行命中时标注）：`$jzb-page-pad:28rpx`（目标 `$page-gutter:32rpx`）、`$jzb-space-2:12rpx` 非 8 倍数。凡页面直接写 `28rpx`/`12rpx` 字面量而非引用 Token 的，单独列问题。

---

## 页面：src/subpackages/company/pages/handover.vue

### 功能简述
管理员选择离职员工与接收人，展示待交接业务数量并提交归属转移。

### 问题清单
- **[P0]** L18 `ref<Record<string, any> | null>` → 使用 `any` → 违反规范 6.1（禁止 any）→ 定义 `HandoverSummary` 接口替换 `Record<string, any>`。
- **[P0]** L64 `<JzIcon name="user" ... color="#E67E22" />` → 硬编码色值字面量 → 违反规范 4（禁止硬编码色值）→ 该色即 `$jzb-warning`，应在 `domains/identity` 定义角色/语义色常量后引用，template 内不得散落 hex。
- **[P0]** L92 `.hand-grid text:first-child { font-size: 42rpx }` → 字号硬编码字面量 → 违反规范 4.2 → 改用 `$jzb-font-xl`（=42rpx）。
- **[P1]** L88 `.hand-person { gap: 20rpx }` → 间距非 8 倍数 → 违反规范 5.1 → 改 `gap: $jzb-space-3`(16) 或 `$jzb-space-4`(24)。
- **[P1]** L87 `.hand-body { padding: 28rpx }` → 写死页边距字面量 → 违反规范 5.2（页面左右边距应统一 Token）→ 改 `padding: $jzb-page-pad`。
- **[P2]** L90/L93 `margin-top: 6rpx`、L95 `min-height: 90rpx`、L99 `margin-top: 22rpx`、L100 `margin-top: 30rpx` → 6/90/22/30 非 8 倍数 → 规范 5.1 → 就近归并到 `$jzb-space-1/2/3`。
- **[P1]** L28-41 `onLoad` 加载无 loading 态：请求中页面无骨架屏，`from/handover` 为 null 时模板只渲染“待离职员工”占位，失败仅 `toastError` → 违反规范 7.2 三态 → 增加 `loading` 标志并复用 `JzSkeleton`。

### 修复图例对比
```scss
/* before */
.hand-grid text:first-child { color: $jzb-text-1; font-size: 42rpx; font-weight: 750; }
.hand-person { gap: 20rpx; padding: 28rpx; }
```
```scss
/* after */
.hand-grid text:first-child { color: $jzb-text-1; font-size: $jzb-font-xl; font-weight: 700; }
.hand-person { gap: $jzb-space-3; padding: $jzb-page-pad; }
```
```ts
/* before */
const handover = ref<Record<string, any> | null>(null)
```
```ts
/* after */
const handover = ref<HandoverSummary | null>(null)
```

---

## 页面：src/subpackages/company/pages/info.vue

### 功能简述
查看并（仅 boss）编辑企业名称、简称与地址。

### 问题清单
- **[P0]** L41 `<JzIcon name="building" ... color="#FFFFFF" />` → 用 `building` 图标充当企业/品牌 Logo，且 `#FFFFFF` 硬编码 → 违反规范 1「装得清 Logo 统一」（禁止 building 图标冒充品牌 Logo）与规范 4 → 改用 `JzBrandLogo`；白色用 `$jzb-text-inverse`。
- **[P0]** L65 `.ci-logo { border-radius: 36rpx }` → 圆角硬编码 → 违反规范 4.4 → 36rpx 即 `$jzb-radius-xl`，应引用。
- **[P0]** L64 `.ci-hero { padding: 48rpx 32rpx }` → 间距字面量 → 违反规范 4.3 → 改 `padding: $jzb-space-7 $jzb-space-5`。
- **[P1]** L63 `.ci-body { padding: 28rpx }` → 页边距字面量 → 违反规范 5.2 → 改 `$jzb-page-pad`。
- **[P2]** L66 `margin-top: 22rpx` → 非 8 倍数 → 规范 5.1 → 改 `$jzb-space-3`。
- **[P1]** L16-23 加载无 loading 骨架；`company` 为 null 时整页空白（模板仅 `v-if="company"`），失败仅 toast → 违反规范 7.2 → 增加骨架/错误占位。

### 修复图例对比
```vue
<!-- before -->
<view class="ci-logo"><JzIcon name="building" :size="54" color="#FFFFFF" /></view>
```
```vue
<!-- after -->
<view class="ci-logo"><JzBrandLogo variant="white" /></view>
```
```scss
/* before */
.ci-hero { padding: 48rpx 32rpx; }
.ci-logo { border-radius: 36rpx; }
```
```scss
/* after */
.ci-hero { padding: $jzb-space-7 $jzb-space-5; }
.ci-logo { border-radius: $jzb-radius-xl; }
```

---

## 页面：src/subpackages/company/pages/invite.vue

### 功能简述
填写被邀请人姓名/手机号/岗位，生成邀请并通过微信分享卡片邀请入职。

### 问题清单
- **[P0]** L89 主按钮「生成邀请」+ L95 主按钮「微信分享邀请卡片」均为 `jz-btn--primary jz-btn--block` → 单页同色实心主按钮 2 个 → 违反规范 5.4/11 → 「微信分享邀请卡片」降级为描边（`jz-btn--outline`）或文字按钮。
- **[P0]** L78/L85 `color="#778390"`、L92 `<JzTag color="#07A35A">` → 硬编码色值 → 违反规范 4 → 分别对应 `$jzb-text-3`、`$jzb-success`，应抽成语义色常量。
- **[P1]** L39 `path: \`/pages/invite/accept?inviteId=...\`` → 直接写路由字符串 → 违反规范 1.4（路由集中 `P.*`）→ 改用 `${P.inviteAccept}?inviteId=...`。
- **[P1]** L103 `.ci-body { padding: 28rpx }` → 页边距字面量 → 违反规范 5.2 → 改 `$jzb-page-pad`。
- **[P2]** L108/L110 `height: 76rpx`、L114 `margin-top: 26rpx`、L115 `margin: 10rpx 0 26rpx`、L105 `min-height: 96rpx` → 76/26/10/96 非 8 倍数 → 规范 5.1 → 归并到 Space/ControlHeight Token。
- **[P1]** L33-35 `teams` 加载无 loading 态，失败静默置空 → 违反规范 7.2。

### 修复图例对比
```vue
<!-- before -->
<button class="jz-btn jz-btn--primary jz-btn--block" open-type="share">微信分享邀请卡片</button>
```
```vue
<!-- after -->
<button class="jz-btn jz-btn--outline jz-btn--block" open-type="share">微信分享邀请卡片</button>
```
```ts
/* before */
path: `/pages/invite/accept?inviteId=${generated.value.id}`
```
```ts
/* after */
path: `${P.inviteAccept}?inviteId=${generated.value.id}`
```

---

## 页面：src/subpackages/company/pages/member-detail.vue

### 功能简述
查看单个员工档案、岗位调整与发起离职交接入口。

### 问题清单
- **[P0]** L21 `const status = { active: [..., '#07A35A'], suspended: [..., '#E67E22'], resigned: [..., '#E5484D'] }` → 状态色硬编码 → 违反规范 4 → 与 `members.vue` 的 `statusMeta` 重复定义，应抽到 `domains/identity` 单一真源并引用语义 Token。
- **[P0]** L67 `.md-avatar { color: #fff; border-radius: 30rpx; font-size: 40rpx }` → 色值/圆角/字号均硬编码 → 违反规范 4 → 圆角就近取 `$jzb-radius-lg`(28)，字号取 `$jzb-font-xxl`(50) 或新增头像字号 Token，白色用 `$jzb-text-inverse`。
- **[P1]** L66 `.md-head { gap: 18rpx }` → 非 8 倍数 → 规范 5.1 → 改 `$jzb-space-3`/`$jzb-space-4`。
- **[P1]** L64 `.md-body { padding: 28rpx }` → 页边距字面量 → 规范 5.2 → 改 `$jzb-page-pad`。
- **[P2]** L69 `margin-top: 4rpx`、L70 `padding: 20rpx 0` → 非 8 倍数 → 规范 5.1。
- **[P1]** L22-29 加载无 loading 骨架；`member` 为 null 时整页空白 → 规范 7.2。

### 修复图例对比
```ts
/* before */
const status = { active: ['在职', '#07A35A'], suspended: ['停用', '#E67E22'], resigned: ['已离职', '#E5484D'] }
```
```ts
/* after */
// domains/identity/meta.ts 单一真源
export const EMPLOYEE_STATUS_META = {
  active:    { label: '在职', color: 'success' },
  suspended: { label: '停用', color: 'warning' },
  resigned:  { label: '已离职', color: 'danger' }
}
```

---

## 页面：src/subpackages/company/pages/members.vue

### 功能简述
成员列表（在职/停用/已离职筛选 + 门店筛选），支持邀请、交接、停用、恢复、注销。

### 问题清单
- **[P0]** L24-28 `statusMeta` 硬编码 `#07A35A/#E67E22/#E5484D`，与 `member-detail.vue` L21 重复 → 违反规范 4、规范 5.10（同类元素样式一致）→ 抽到 `domains/identity/meta.ts`。
- **[P0]** L103/L117 `color="#0E8A7D"`、L111 `#AEB8C2`、L121 `#E67E22`、L126 `#07A35A`、L130 `#E5484D`、L134 `#778390` → 大量 JzIcon 颜色硬编码 → 违反规范 4 → 分别对应 `$jzb-primary-dark / $jzb-text-4 / $jzb-warning / $jzb-success / $jzb-danger / $jzb-text-3`。
- **[P1]** L36 固定 `size:200` 一次性拉取，无 `onReachBottom`/分页/到底提示 → 违反规范 7.4（长列表必须分页/上拉加载）→ 接入 `usePagedList` + `ListFooter`。
- **[P1]** L34-39 无 loading 骨架，失败仅 toast，列表区无 `JzSkeleton` → 规范 7.2。

### 已遵守项
- 空状态正确使用 `JzEmpty`（L141）并带引导文案；`onShow` 重新加载（L31）、`onPullDownRefresh`（L32）；v-for 均用 `member.id`/`item.value` 作 key；路由全部走 `P.*`；无同色实心主按钮（操作均为图标+文字）；页边距已用 `$jzb-page-pad`。

### 修复图例对比
```vue
<!-- before -->
<view class="member-avatar"><JzIcon name="user" :size="34" color="#0E8A7D" /></view>
<JzIcon name="pause" :size="30" color="#E67E22" />
```
```vue
<!-- after -->
<view class="member-avatar"><JzIcon name="user" :size="34" :color="iconColor.primaryDark" /></view>
<JzIcon name="pause" :size="30" :color="iconColor.warning" />
```

---

## 页面：src/subpackages/company/pages/resign.vue

### 功能简述
员工主动退出企业，展示本人待交接清单，可填写原因并强制退出。

### 问题清单
- **[P0]** L13 `ref<Record<string, any> | null>` → 使用 `any` → 违反规范 6.1 → 与 handover 共用 `HandoverSummary` 类型。
- **[P0]** L53 `color="#E5484D"`、L61 `color="#E67E22"` → 硬编码色值 → 违反规范 4 → 分别对应 `$jzb-danger`、`$jzb-warning`。
- **[P0]** L81 `.resign-grid text:first-child { font-size: 44rpx }` → 字号硬编码 → 规范 4.2 → 取 `$jzb-font-display`(64) 与 `$jzb-font-xxl`(50) 之间需新增/就近 Token，不写裸 44。
- **[P1]** L77 `.resign-company { gap: 20rpx }` → 非 8 倍数 → 规范 5.1。
- **[P1]** L76 `.resign-body { padding: 28rpx }` → 页边距字面量 → 规范 5.2。
- **[P2]** L80 `gap: 24rpx`（字面量，应 `$jzb-space-4`）、L83 `padding: 22rpx`、L86 `padding: 20rpx`、L87 `margin-top: 20rpx`、L88 `margin-top: 30rpx` → 非 8 倍数 → 规范 5.1。
- **[P1]** L24-27 加载无 loading 骨架 → 规范 7.2。

### 修复图例对比
```scss
/* before */
.resign-grid text:first-child { font-size: 44rpx; }
.resign-company { gap: 20rpx; padding: 28rpx; }
```
```scss
/* after */
.resign-grid text:first-child { font-size: $jzb-font-xxl; }
.resign-company { gap: $jzb-space-3; padding: $jzb-page-pad; }
```

---

## 页面：src/subpackages/message/pages/list.vue

### 功能简述
通知中心：按类型/未读筛选消息，支持全部已读、分页加载、点击跳转业务详情。

### 问题清单
- **[P0]** L25-28 `TYPE_COLOR` 颜色映射硬编码 `#07A35A/#0E8A7D/#6958C8/#E5484D/#168A96/#778390`，L84 再以 `+ '14'` 拼出内联底色 → 违反规范 4 → 改为语义色 token 映射（success/primaryDark/purple/danger/info…），底色由组件按 token 派生。
- **[P0]** L105 `.msg__head { background: linear-gradient(135deg,#FFFFFF,#F4FBFA) }`、L117 `.msg__icon { border-radius: 24rpx }`、L112 `.msg__filter { background:#fff }`、L113 `color:#fff` → 硬编码渐变/色值/圆角 → 违反规范 4 → 24rpx 圆角不在 Token 体系（xs8/sm12/base20/lg28），取 `$jzb-radius`。
- **[P1]** L104 `.msg { padding: 24rpx 24rpx 60rpx }` → 左右页边距 24rpx，与全站 `$jzb-page-pad`(28) 不一致 → 违反规范 5.2 → 统一为 `$jzb-page-pad`。
- **[P1]** L107 `padding: 7rpx 16rpx`、L109 `margin-left:14rpx`、L110 `margin-bottom:18rpx`、L112 `padding:10rpx 22rpx`、L114 `padding:26rpx 22rpx; margin-bottom:18rpx`、L118 `margin-left:20rpx` → 7/14/18/10/22/26/20 非 8 倍数 → 规范 5.1。

### 已遵守项
- 三态最完整：`PageState` 错误态+重试（L82）、`JzEmpty` 带引导（L97）、`ListFooter` 上拉加载/到底（L98）；`onShow` 刷新（L37）、`onPullDownRefresh`（L38）；v-for 用 `n.id`；路由全部 `P.*`；无同色实心主按钮。

### 修复图例对比
```ts
/* before */
const TYPE_COLOR: Record<string, string> = {
  customer: '#07A35A', project: '#0E8A7D', quote: '#6958C8', overdue: '#E5484D', ...
}
```
```ts
/* after */
const TYPE_COLOR: Record<string, ColorToken> = {
  customer: 'success', project: 'primaryDark', quote: 'purple', overdue: 'danger', ...
}
// 底色由 JzTag/图标组件按 token 派生，页面不再拼 rgba
```

---

## 页面：src/subpackages/supply/pages/index.vue

### 功能简述
供应商协作首页：采购/供应商/采购价/库存四 Tab，聚合待采购、进行中、待到货与操作入口。

### 问题清单
- **[P0]** L140/L141/L142 每张采购卡片按状态渲染 `jz-btn--primary jz-btn--sm`（确认采购/已下单/到货），同屏多卡 → 单页同色实心主按钮 >1 → 违反规范 5.4/11 → 降级为描边/文字按钮，仅卡片内主操作或保留一个汇总 CTA。
- **[P0]** L67-72 `purchaseStatusColor` 硬编码 `#E5484D/#0E8A7D/#E67E22/#16A394`；L124/L149/L162 `color="#0E8A7D"`；L129/L174 `<JzTag color="#E67E22">` → 违反规范 4 → 统一语义色 token 映射。
- **[P1]** L31-55 `refresh()` 无 loading 骨架，失败仅 toast；各 Tab 列表无 `onReachBottom`（`activePurchases.slice(0,12)`）→ 违反规范 7.2/7.4。
- **[P1]** L192 `.supply__tabs { padding: 20rpx $jzb-page-pad 10rpx }`、L195 `.supply__list { padding: 14rpx $jzb-page-pad }` → 20/10/14 非 8 倍数 → 规范 5.1。
- **[P0]** L193 `.supply__tab { background:#fff }`、L197 `.supply__summary view { border: 1rpx solid rgba(22,163,148,.12) }` → 硬编码白与品牌 rgba → 违反规范 4 → 用 `$jzb-bg-card` 与 `$jzb-primary` 派生。
- **[P2]** L199 `margin-top:4rpx`、L200 `margin:26rpx 0 12rpx`、L204/L205 `margin-top:18rpx`、L196 `gap:12rpx` → 非 8 倍数 → 规范 5.1。
- **[P2]** L155 模板两行元素挤在一行（`<text .../>` 与 `<view class="supply__metrics">` 之间无换行/缩进）→ 代码可读性 → 规范 6.2。

### 修复图例对比
```vue
<!-- before -->
<view v-if="canApprove && item.status === 'submitted'" class="supply__actions">
  <button class="jz-btn jz-btn--primary jz-btn--sm" @tap="approve(item)">确认采购</button>
</view>
```
```vue
<!-- after -->
<view v-if="canApprove && item.status === 'submitted'" class="supply__actions">
  <button class="jz-btn jz-btn--outline jz-btn--sm" @tap="approve(item)">确认采购</button>
</view>
```

---

## 页面：src/subpackages/supply/pages/partner-edit.vue

### 功能简述
新增/编辑供应商资料：类型、联系人、账期、银行信息与品牌。

### 问题清单
- **[P0]** L49 `list.find(...) as Record<string, any> | undefined` → 使用 `any`（且为绕过类型断言）→ 违反规范 6.1 → 直接用 `Partner | undefined`，补全 `Partner` 字段类型。
- **[P0]** L119/L133/L141 `color="#AEB8C2"` → 硬编码色值 → 违反规范 4 → 即 `$jzb-text-4`。
- **[P1]** L156 `.pe__card { margin: 24rpx $jzb-page-pad }` 已用 Token；但 L157 `min-height:104rpx`、L164 `margin-top:12rpx` → 104/12 非 8 倍数 → 规范 5.1。
- **[P1]** L44-72 编辑态回填无 loading 骨架，失败仅 toast → 规范 7.2。

### 已遵守项
- 单一主按钮（L148 固定底栏，`submitting` 防重）；必填 `*` 标记（L115）；输入均有 `maxlength/type`；无 v-for；无裸路由（`navigateBack`）；圆角统一 `$jzb-radius-sm`。

### 修复图例对比
```ts
/* before */
const found = list.find((item) => item.id === id.value) as Record<string, any> | undefined
```
```ts
/* after */
const found = list.find((item) => item.id === id.value)  // Partner | undefined
```

---

## 页面：src/subpackages/supply/pages/partner-price-edit.vue

### 功能简述
维护供应商—报价项目的采购价、人工价、起订量与交期，含角色鉴权。

### 问题清单
- **[P0]** L157 `@change="active = ($event as any).detail.value"` → `as any` 类型断言 → 违反规范 6.1 → 声明 `(e: { detail: { value: boolean } })`。
- **[P0]** L135/L141/L147 `color="#AEB8C2"`、L157 `<switch color="#0E8A7D">` → 硬编码色值 → 违反规范 4 → 分别 `$jzb-text-4`、`$jzb-primary-dark`。
- **[P1]** L164-176 样式与 partner-edit 高度重复（`.pp__*` vs `.pe__*`），L167 `min-height:104rpx`、L174 `margin-top:12rpx` 非 8 倍数 → 违反规范 5.1，且建议抽公共表单卡片样式 → 规范 5.10。
- **[P1]** L38-74 加载无 loading 骨架 → 规范 7.2。

### 已遵守项
- onLoad 角色权限拦截（L39）；单一固定底栏主按钮；防重复提交；金额非负校验；无 v-for key 问题；无裸路由。

### 修复图例对比
```vue
<!-- before -->
<switch :checked="active" color="#0E8A7D" @change="active = ($event as any).detail.value" />
```
```vue
<!-- after -->
<switch :checked="active" :color="switchColor" @change="onActiveChange" />
```
```ts
/* after */
function onActiveChange(e: { detail: { value: boolean } }) { active.value = e.detail.value }
```

---

## 页面：src/subpackages/supply/pages/purchase-edit.vue

### 功能简述
从项目材料计划发起采购单：选计划、供应商、数量、单价、交付方式与到场日期。

### 问题清单
- **[P1]** L155 `<view class="pe__empty jz-card">暂无可采购的材料计划…</view>` → 空态仅一行说明文字，未用 `JzEmpty`、无引导图/引导按钮 → 违反规范 7.2（empty 态）→ 改用 `JzEmpty` 并加「去确认材料需求」引导。
- **[P0]** L113/L124 `color="#AEB8C2"` → 硬编码色值 → 违反规范 4 → `$jzb-text-4`。
- **[P0]** L176 `.pe__mode { background: #fff }` → 硬编码白 → 违反规范 4 → `$jzb-bg-card`。
- **[P1]** L172 `.pe__summary { padding:18rpx }`、L175 `gap:12rpx`、L178 `margin-top:6rpx`、L181 `padding:16rpx; margin-top:12rpx` → 18/12/6 非 8 倍数 → 规范 5.1。
- **[P1]** L30-43 加载无 loading 骨架 → 规范 7.2。

### 已遵守项
- 单一固定底栏主按钮（L156），`disabled` 联动 `plans.length`；表单校验（数量>0、单价非负）；picker 选项联动；无裸路由。

### 修复图例对比
```vue
<!-- before -->
<view v-else class="pe__empty jz-card">暂无可采购的材料计划，请先由项目经理确认材料需求。</view>
```
```vue
<!-- after -->
<JzEmpty v-else text="暂无可采购的材料计划" sub="材料计划确认后，即可从这里发起采购" />
```

---

## 页面：src/subpackages/supply/pages/receipt-edit.vue

### 功能简述
按采购单确认材料实际到场数量、到场日期，自动生成应付。

### 问题清单
- **[P1]** L89 `.re__tag { padding: 6rpx 16rpx }`、L91 `.re__remaining { margin:20rpx 0; padding:18rpx }` → 6/20/18 非 8 倍数 → 违反规范 5.1 → 归并 Space Token。
- **[P1]** L16-35 通过拉全量 `purchases()` 再 `find(id)` 取单条 → 数据范围/性能隐患（非本审计维度 UI，但属 AGENTS §18 提示的「全量拉取前端 find」历史坑型），建议后端提供按 id 查询 → P2 建议。
- **[P1]** 加载无 loading 骨架，`purchase` 为 null 时表单区不渲染、底栏按钮 disabled，缺骨架 → 规范 7.2。

### 已遵守项
- 样式基本全部引用 `$jzb-*` Token（无硬编码 hex/圆角/字号）；单一固定底栏主按钮（L80）；数量区间校验（L40）；`submitting` 防重；无 v-for；无裸路由；圆角统一 `$jzb-radius-sm/pill`。

### 修复图例对比
```scss
/* before */
.re__tag { padding: 6rpx 16rpx; }
.re__remaining { margin: 20rpx 0; padding: 18rpx; }
```
```scss
/* after */
.re__tag { padding: $jzb-space-1 $jzb-space-3; }
.re__remaining { margin: $jzb-space-3 0; padding: $jzb-space-3; }
```

---

## 页面：src/subpackages/subscription/pages/index.vue

### 功能简述
订阅中心：当前套餐/用量、套餐横向选择、席位门店加购、微信下单续费与订单记录。

### 问题清单
- **[P0]** L32-43 `statusMeta`、L225-234 `orderStatusMeta`、L366/371/376/416/421/434/467/477/492/498/500/504/510/512 内联 `color="#16A394/#E67E22/#5B6BD6/#0E8A7D/#4E5969/#778390"` → 大量硬编码色值（其中 `#5B6BD6` 不在 Token 体系）→ 违反规范 4 → 抽语义色常量；`#5B6BD6` 新增 Token 或改用 `$jzb-purple`(#6958C8)。
- **[P0]** L614 hero 渐变 `#12A08F/#2BC4B4/#6FD3C6`、L616 阴影、L639 `#7A261F/#FFE9E6`、L630 `#7A4100/#FFE8B3`、L653 渐变 `#16A394/#65C7B9`、L669 `#FFF9EF`、L671 `#E98A2C/#D86618`、L676/L699 `#D86618`、L693 `#F3FBF9` → 色值/渐变/阴影硬编码 → 违反规范 4/4.5 → 应在 uni.scss 新增品牌渐变/价格橙/到期提示等语义 Token 后引用。
- **[P0]** 字号/圆角字面量：L592 `40rpx`、L631 `44rpx`、L634 `56rpx`、L673 `38rpx`、L678 `66rpx`、L699 `42rpx`；L686 `border-radius:22rpx`、L656/L665 圆角混用 xl/lg/pill/sm/base/22rpx/50% → 违反规范 4.2/4.4、5.3（单页圆角 ≤2 种）→ 字号归并 `$jzb-font-*`，圆角收敛到 ≤2 种。
- **[P0]** L630/L643/L700/L702/L711/L716 等 `font-size: 20rpx` → 字号硬编码（20 不在 Token：xs=22）→ 规范 4.2 → 取 `$jzb-font-xs` 或新增 mini Token。
- **[P1]** L80-102 `loading` 仅用于切换内容/JzEmpty，加载中既不渲染 info 也不渲染空态（整页空白），无 `JzSkeleton` → 违反规范 7.2。
- **[P1]** L550-576 订单列表无 `onReachBottom`/分页/到底提示 → 规范 7.4。
- **[P1]** L667 `transition: border-color .2s, transform .2s` → 时长未用 `$jzb-duration-base`(200ms) Token → 规范 4.6。
- **[P1]** L589 `.subscription__content { padding: 24rpx $jzb-page-pad 0 }` → 顶部 24 与页边距体系混用；L640 `gap:14rpx`、L646 `margin:12rpx 4rpx 20rpx`、L683 `gap:10rpx` 等非 8 倍数 → 规范 5.1。

### 已遵守项
- 主 CTA 克制：仅底部「微信支付/续费」一个实心主按钮（L531），订单行操作已降级为 text/ghost（L571-572，并有注释说明）；`onShow` 刷新（L74）、`onPullDownRefresh`（L78）；空态用 `JzEmpty`（L577/L582）；v-for 用 `orderNo/code/store.id` 等业务 key；路由 `P.login`；无 Options API / `!important` / 静态行内 style（L395/L402 为进度条宽度动态绑定，属允许的动态计算）。

### 修复图例对比
```scss
/* before */
.subscription__hero {
  background: linear-gradient(135deg, #12A08F 0%, #2BC4B4 58%, #6FD3C6 100%);
  box-shadow: 0 16rpx 36rpx rgba(14, 138, 125, .16);
}
.subscription__price-value { font-size: 40rpx; }
.subscription__trial { font-size: 20rpx; background: #FFE8B3; color: #7A4100; }
```
```scss
/* after */
.subscription__hero {
  background: $jzb-gradient-hero;   /* uni.scss 新增语义 Token */
  box-shadow: $jzb-shadow-elevated;
}
.subscription__price-value { font-size: $jzb-font-xxl; }
.subscription__trial {
  font-size: $jzb-font-xs;
  background: $jzb-warning-soft;
  color: $jzb-warning;
}
```
```ts
/* before */
frozen: { text: '订阅已冻结', short: '冻结', color: '#8A5CC7' }
```
```ts
/* after */
frozen: { text: '订阅已冻结', short: '冻结', color: 'purple' as ColorToken }
```
