# 分片3：finance + team + statistic

> 判定基准：当前 Design Token 真源为 `src/uni.scss` 的 `$jzb-*`（主色 `$jzb-primary: #16A394`，深一档 `$jzb-primary-dark: #0E8A7D`）；运行时色值另见 `src/styles/tokens.ts` 的 `TOKEN_COLOR`。
> 系统性偏差（不逐页重复）：`$jzb-page-pad: 28rpx`（规范目标 32rpx）、`$jzb-space-2: 12rpx`、`$jzb-radius-sm: 12rpx` 均与"间距 8 倍数 / $page-gutter 32rpx"不一致，本分片只在叠加了更离谱字面量时点名。
> 公共样式 `src/styles/finance.scss` 自身含硬编码 `#fff / #E8F7F5 / #0E8A7D / #07A35A` 等字面量与非 Token 阴影，被 ledger/payables/payments/projects/receivables/receipts/project/entry 等页 `@import`，属共性问题，下文在各页只点 scoped 增量。

---

## 页面：src/subpackages/finance/pages/entry.vue

### 功能简述
财务统一录入表单页：按 `type`（应收/收款/应付/付款/手工记账）切换字段组，调用 financeApi 保存，单主按钮提交。

### 问题清单
- **[P0]** 模板多处 `JzIcon ... color="#AEB8C2"`（L197、203、205、210、212、213、219、223、229、231、232、237、240、241）→ 硬编码占位灰 → 违反 §4.1/§11 → 用 `TOKEN_COLOR.text4`（即 #AEB8C2 的 Token 源），模板改为 `:color="text4Color"`。
- **[P0]** 模板 `switch color="#0E8A7D"`（L206）、`switch color="#E5484D"`（L225）、`JzIcon color="#0E8A7D"`（L249）→ 硬编码品牌/危险色 → 违反 §4.1 → 分别用 `$jzb-primary-dark` / `$jzb-danger`。
- **[P1]** L206 `<text ... style="width:auto;">` → 静态行内 style → 违反 §6.2/§11 → 改为类名 `.fin-field--inline-label { width: auto; }`。
- **[P1]** L265 `.fe-tip { background: #E8F7F5; }` → 硬编码（恰等于 `$jzb-primary-lighter`）→ 违反 §4.1 → 用 `$jzb-primary-lighter`。
- **[P1]** L259 `.fe-head { padding: 34rpx $jzb-page-pad 12rpx }`、L265 `.fe-tip { margin: 20rpx ...; padding: 20rpx }`、L266 `.fe-tip text { margin-left: 10rpx }` → 34/20/10rpx 非 8 倍数 → 违反 §5.1 → 用 `$space-*`（32/24/8）。
- **[P2]** 金额输入为裸 `<input type="digit">`（L204 等），无 `font-variant-numeric: tabular-nums`，也未用 `JzMoney` → 违反 §4.2 数字规范 → 数字输入加 tabular-nums 或抽 `JzMoneyInput`。

### 修复图例对比
```vue
<!-- before -->
<JzIcon name="chevron-right" :size="24" color="#AEB8C2" />
<switch :checked="form.urgent" color="#E5484D" @change="onUrgentSwitch" />
```
```vue
<!-- after -->
<JzIcon name="chevron-right" :size="24" :color="text4Color" />
<switch :checked="form.urgent" :color="dangerColor" @change="onUrgentSwitch" />
```
```scss
/* before */
.fe-head { padding: 34rpx $jzb-page-pad 12rpx; }
.fe-tip  { margin: 20rpx $jzb-page-pad 0; padding: 20rpx; background: #E8F7F5; }
```
```scss
/* after */
.fe-head { padding: $space-lg $jzb-page-pad $space-3; }
.fe-tip  { margin: $space-4 $jzb-page-pad 0; padding: $space-4; background: $jzb-primary-lighter; }
```

### 已遵守项
单主按钮（L252 唯一 `jz-btn--primary`）；`<script setup>`；路由全用 `P.*`；提交按钮带 `disabled/submitting` 防重复；无 v-for index key。

---

## 页面：src/subpackages/finance/pages/ledger.vue

### 功能简述
资金台账列表页：汇总净现金流/收支，支持收支筛选，下拉刷新+上拉加载，PageState/JzSkeleton/ListFooter/JzEmpty 三态齐全。

### 问题清单
- **[P1]** L70-72 `<JzIcon ... color="#778390" />`（wallet/chart/user 三个图标）→ 硬编码辅助灰（=`$jzb-text-3`）→ 违反 §4.1 → 用 `$jzb-text-3` / `TOKEN_COLOR.text3`。

无其他 P0。其余维度合规。

### 修复图例对比
```vue
<!-- before -->
<view class="fin-fact"><JzIcon name="wallet" :size="22" color="#778390" /><text>{{ ACCOUNT_LABEL[item.account] }}</text></view>
```
```vue
<!-- after -->
<view class="fin-fact"><JzIcon name="wallet" :size="22" :color="text3Color" /><text>{{ ACCOUNT_LABEL[item.account] }}</text></view>
```

### 已遵守项
loading=JzSkeleton、empty=JzEmpty+引导 sub、error=PageState+retry；`onShow` 自动 refresh；`onPullDownRefresh`；上拉 ListFooter；`:key="item.id"`；金额 `.fin-amount` 已带 tabular-nums；路由全 `P.*`；无行内 style、无 emoji/字符图标。

---

## 页面：src/subpackages/finance/pages/partners.vue

### 功能简述
供应商往来台账：按供应商聚合待付/逾期，账期标签，可切"仅看逾期"，行点击进应付明细。

### 问题清单
- **[P0]** L99 `<JzTag :color="row.overdueAmount ? '#E5484D' : '#0E8A7D'" />` → 模板硬编码危险/品牌色 → 违反 §4.1/§11 → 用 `$jzb-danger` / `$jzb-primary-dark`。
- **[P1]** L108 `<JzIcon name="chevron-right" ... color="#AEB8C2" />` → 硬编码占位灰 → 同上 → `TOKEN_COLOR.text4`。
- **[P1]** `loading` ref 存在（L24），但模板无 JzSkeleton/PageState：加载中列表空白，失败仅 `toastError`（L38）无重试页 → 违反 §7.2 三态 → 初载用 JzSkeleton，失败用 PageState。
- **[P1]** L128 `.fp__total-value { font-size: 40rpx; }` → 硬编码字号字面量 → 违反 §4.2 → 用 `$jzb-font-xl`（42rpx）或新增 `$font-display`。
- **[P2]** L96 `:key="row.partner?.id || row.partner?.name"` → id 缺失时退化为姓名字符串作 key，同名供应商会 key 冲突 → 违反 §6.1 → 保证 row 携带稳定业务 id，无 id 时用 index 仅在静态不重排列表。

### 修复图例对比
```vue
<!-- before -->
<JzTag :text="termsText(row)" :color="row.overdueAmount ? '#E5484D' : '#0E8A7D'" />
```
```vue
<!-- after -->
<JzTag :text="termsText(row)" :color="row.overdueAmount ? dangerColor : primaryDarkColor" />
```
```vue
<!-- before（加载中无任何占位） -->
<view v-for="row in ledgers" ...>...</view>
<JzEmpty v-if="!loading && !ledgers.length" ... />
```
```vue
<!-- after -->
<JzSkeleton v-if="loading && !ledgers.length" :rows="4" />
<view v-for="row in ledgers" v-else ...>...</view>
```

### 已遵守项
单主按钮"维护供应商"（L78）；`onShow` 加载；下拉刷新；JzEmpty 带 sub 引导；路由全 `P.*`；`<script setup>`。

---

## 页面：src/subpackages/finance/pages/payables.vue

### 功能简述
应付账款列表：hero 汇总总额/已付/待付/风险，按类型筛选，进度条+行内"安排付款"，三态齐全。

### 问题清单
- **[P0]** L85 `<text v-if="item.urgent" style="color:#E5484D;">加急</text>` → 硬编码危险色 + 静态行内 style → 违反 §4.1/§6.2/§11 → 类名 `.fin-card__urgent { color: $jzb-danger; }`。
- **[P1]** L81-82 `:style="{ color: PAYABLE_TYPE_META[item.type].color }"` → 业务 meta 返回裸 hex 经行内 style 上色，未走 Token → 违反 §6.2（动态色应来自 Token 映射）→ meta 提供语义 token key，组件侧映射到 `$jzb-*`。
- **[P1]** L87 `:style="{ ..., background: item.type === 'salary' ? '#E67E22' : undefined }"` → 行内硬编码橙 → 违反 §4.1 → 用 `$jzb-warning`，进度条色改为 CSS 修饰类 `.fin-progress__bar--salary`。
- **[P2]** `.fin-card__amount`（finance.scss L37）金额未带 `font-variant-numeric: tabular-nums`，仅 hero 的 `.fin-amount` 有 → 违反 §4.2 → 卡片金额统一加 tabular-nums。

### 修复图例对比
```vue
<!-- before -->
<text v-if="item.urgent" style="color:#E5484D;">加急</text>
<view class="fin-progress__bar" :style="{ width: `${progress(item)}%`, background: item.type === 'salary' ? '#E67E22' : undefined }" />
```
```vue
<!-- after -->
<text v-if="item.urgent" class="fin-card__urgent">加急</text>
<view class="fin-progress__bar" :class="{ 'fin-progress__bar--salary': item.type === 'salary' }" :style="{ width: `${progress(item)}%` }" />
```
```scss
.fin-card__urgent { color: $jzb-danger; }
.fin-progress__bar--salary { background: $jzb-warning; }
```

### 已遵守项
PageState error / JzSkeleton / ListFooter / JzEmpty 三态与分页齐全；`onShow`+下拉刷新；`:key="item.id"`；单主按钮（header 右侧"新增应付"）；路由全 `P.*`。

---

## 页面：src/subpackages/finance/pages/payments.vue

### 功能简述
付款记录流水：hero 汇总累计/本月付款，列表展示收款方/账户/凭证状态，三态齐全。

### 问题清单
- **[P1]** L61-62 `<JzIcon ... color="#778390" />`（users/wallet）→ 硬编码辅助灰 → 违反 §4.1 → `$jzb-text-3`。

无其他 P0/P1。

### 修复图例对比
```vue
<!-- before -->
<view class="fin-fact"><JzIcon name="users" :size="22" color="#778390" /><text>{{ item.payeeName || ... }}</text></view>
```
```vue
<!-- after -->
<view class="fin-fact"><JzIcon name="users" :size="22" :color="text3Color" /><text>{{ item.payeeName || ... }}</text></view>
```

### 已遵守项
三态齐全（PageState/JzSkeleton/ListFooter/JzEmpty）；onShow+下拉刷新；`:key="item.id"`；无行内 style；无字符图标；路由全 `P.*`。

---

## 页面：src/subpackages/finance/pages/project.vue

### 功能简述
单项目财务驾驶舱：合同/成本/利润、应收应付流水、结算状态机（生成/确认/关闭/释放质保金），5 个 Tab 切换。

### 问题清单
- **[P0]** L224-225 `.fp-metric--income { color: $jzb-success !important; }` / `.fp-metric--danger { ... !important; }` → 使用 `!important` → 违反 §6.2/§11 → 提升选择器特异性或调整默认色，删除 `!important`。
- **[P0]** JS 内硬编码色（L25-28 costRows：`#8A5CC7/#E67E22/#0E8A7D/#778390`；L126-128 JzIcon `#07A35A/#E5484D/#778390`；L132/133/138/148/158/168 `#0E8A7D`）→ 违反 §4.1 → 统一从 `TOKEN_COLOR` 取色。
- **[P1]** L203 `<JzEmpty text="项目财务数据加载中" />` 作为 `!report` 兜底——但 `refresh()` 失败仅 `toastError`（L40），`report` 保持 null，失败页会一直显示"加载中" → 违反 §7.2 error 态 → 增加 `loadError` 状态，失败渲染 PageState。
- **[P1]** L212 `.fp-head__amount { font-size: 58rpx; }`、L240 `.fp-settle-hero__amount { font-size: 54rpx; }` → 硬编码展示字号 → 违反 §4.2 → 用 `$jzb-font-display` 或新增 display token。
- **[P1]** L209 `.fp-head { background: linear-gradient(135deg,#0E8A7D,...#096C64); box-shadow: 0 18rpx 44rpx rgba(14,138,125,.22); }`、L237 `.fp-inline-action { background: #E8F7F5; }` → 硬编码渐变/底色/阴影 → 违反 §4.1/§4.5 → 复用 `$jzb-gradient` / `$jzb-primary-lighter` / `$jzb-shadow-float`。
- **[P2]** 实心主按钮有"生成结算"(L169)、"确认结算"(L196)、"释放质保金"(L198) 三个 `jz-btn--primary`，虽靠 `v-if` 状态互斥（不同结算状态各现其一），仍建议视觉上收敛为同一 CTA 槽位避免 reviewer 误判一屏多主按钮。

### 修复图例对比
```scss
/* before */
.fp-metric--income { color: $jzb-success !important; }
.fp-metric--danger { color: $jzb-danger !important; }
.fp-head__amount   { font-size: 58rpx; }
```
```scss
/* after */
.fp-grid .fp-metric--income { color: $jzb-success; }
.fp-grid .fp-metric--danger { color: $jzb-danger; }
.fp-head__amount { font-size: $jzb-font-display; }
```
```ts
// before
const costRows = [
  { label: '材料成本', value: ..., color: '#8A5CC7' },
  { label: '人工成本', value: ..., color: '#E67E22' },
]
// after
import { TOKEN_COLOR } from '@/styles/tokens'
const costRows = [
  { label: '材料成本', value: ..., color: TOKEN_COLOR.purple },
  { label: '人工成本', value: ..., color: TOKEN_COLOR.warning },
]
```

### 已遵守项
`<script setup>`；路由全 `P.*`；结算破坏性操作走 `confirm()`（L52/61/72）；v-for key 均为业务 id；onShow+下拉刷新；JzEmpty 用于空 Tab。

---

## 页面：src/subpackages/finance/pages/projects.vue

### 功能简述
项目账本列表：hero 汇总合同规模/回款/应付/待收，按"全部/资金风险/待结算"筛选，卡片含回款进度条。

### 问题清单
- **[P0]** L71 `<view class="fin-card__facts" style="margin-top:20rpx;">` → 静态行内 style（非动态计算）→ 违反 §6.2/§11 → 新增类 `.fin-card__facts--loose { margin-top: $space-4; }`。
- **[P0]** L75 `:style="{ color: item.outstandingAmount > 0 ? '#E5484D' : '#07A35A' }"` → 行内硬编码 hex → 违反 §4.1/§6.2 → 用修饰类 `.fin-card__amount--overdue` / `--settled` 配 `$jzb-danger`/`$jzb-success`。
- **[P1]** L80 使用 `fin-card__warning` 类，但 `src/styles/finance.scss` 与本页均未定义该类 → 成本未完整的黄色警告色实际不生效 → 违反 §7（视觉状态落地）→ 补 `.fin-card__warning { color: $jzb-warning; }`。
- **[P2]** L81 `<text class="fin-card__action">项目核算</text>` 作为可点行，但右侧无 chevron 也无按压态提示（整卡 @tap）→ 违反 §15.12 可点击区域可辨识 → 补 `chevron-right` JzIcon。

### 修复图例对比
```vue
<!-- before -->
<view class="fin-card__facts" style="margin-top:20rpx;">
  ...
  <text :style="{ color: item.outstandingAmount > 0 ? '#E5484D' : '#07A35A' }">待收 ...</text>
```
```vue
<!-- after -->
<view class="fin-card__facts fin-card__facts--loose">
  ...
  <text :class="item.outstandingAmount > 0 ? 'fin-card__amount--overdue' : 'fin-card__amount--settled'">待收 ...</text>
```
```scss
.fin-card__facts--loose { margin-top: $space-4; }
.fin-card__amount--overdue { color: $jzb-danger; }
.fin-card__amount--settled { color: $jzb-success; }
```

### 已遵守项
PageState/JzSkeleton/ListFooter/JzEmpty 三态齐全；onShow+下拉刷新；`:key="item.project.id"`；hero 金额 `.fin-amount` 带 tabular-nums；路由全 `P.*`。

---

## 页面：src/subpackages/finance/pages/receipts.vue

### 功能简述
客户收款记录：hero 累计/本月回款，卡片展示核销应收/账户/付款方/凭证，三态齐全。

### 问题清单
- **[P1]** L61-62 `<JzIcon ... color="#778390" />`（wallet/user）→ 硬编码辅助灰 → 违反 §4.1 → `$jzb-text-3`。

无其他 P0/P1。

### 修复图例对比
```vue
<!-- before -->
<view class="fin-fact"><JzIcon name="wallet" :size="22" color="#778390" /><text>{{ ACCOUNT_LABEL[item.account] }}</text></view>
```
```vue
<!-- after -->
<view class="fin-fact"><JzIcon name="wallet" :size="22" :color="text3Color" /><text>{{ ACCOUNT_LABEL[item.account] }}</text></view>
```

### 已遵守项
三态齐全；onShow+下拉刷新；`:key="item.id"`；无行内 style；无字符图标；路由全 `P.*`；hero 金额 tabular-nums。

---

## 页面：src/subpackages/finance/pages/receivables.vue

### 功能简述
应收计划列表：hero 全部/已收/待收/逾期，按节点类型筛选，进度条+行内"登记收款"，三态齐全。

### 问题清单
- **[P1]** L85-86 `:style="{ color: RECEIVABLE_TYPE_META[...].color }"` / `RECEIVABLE_STATUS_META[...].color` → 业务 meta 裸 hex 经行内 style 上色 → 违反 §6.2 → meta 输出语义 token key，组件映射 `$jzb-*` 或 JzTag 替代裸 text 上色。

无其他 P0。

### 修复图例对比
```vue
<!-- before -->
<text :style="{ color: RECEIVABLE_TYPE_META[item.type].color }">{{ RECEIVABLE_TYPE_META[item.type].label }}</text>
```
```vue
<!-- after -->
<JzTag :text="RECEIVABLE_TYPE_META[item.type].label" :color="typeColor(item.type)" />
```
```ts
function typeColor(t: Receivable['type']) {
  return RECEIVABLE_TYPE_META[t].token // meta 改为导出 token 引用，而非 hex 字面量
}
```

### 已遵守项
PageState/JzSkeleton/ListFooter/JzEmpty；onShow+下拉刷新；`:key="item.id"`；筛选 tab `:key="item.key"`；单主按钮；路由全 `P.*`。

---

## 页面：src/subpackages/team/pages/designers.vue

### 功能简述
设计调度/团队派单：汇总待指派与设计师在线数，待指派客户列表+底部选人弹层，设计师负荷排行。

### 问题清单
- **[P0]** L183-185 `<JzIcon ... color="#6958C8"/"#0E8A7D"/"#E67E22" />`、L197 `<JzTag color="#E67E22" />`、L211/240 `<JzAvatar color="#6958C8" />`、L236/245 `<JzIcon color="#AEB8C2" />` → 模板硬编码角色/品牌/占位色 → 违反 §4.1/§11 → 改 `TOKEN_COLOR.*`（purple/primary-dark/warning/text4）。
- **[P1]** L209 `:key="perf.employee?.id || 'designer'"`、L260（performance 同构）同名兜底 → 无 id 的多条 designer 会共用同一 key `'designer'`，Vue diff 错乱 → 违反 §6.1 → 后端报表必须带 `employee.id`，兜底改为稳定行标识而非字面常量。
- **[P1]** 错误态缺失：`refresh()` 失败仅 `toastError`（L100），模板无 PageState 错误页，只在初始 `booting` 用 JzSkeleton（L188）→ 违反 §7.2 → 增加 error 状态与重试。
- **[P1]** L253 `.md { padding: 24rpx 24rpx 60rpx; }` 页面左右边距 24rpx，与全项目 `$jzb-page-pad`/`$page-gutter` 不一致 → 违反 §5.2 → 统一 `$jzb-page-pad`。
- **[P1]** L257 `.md__summary-value { font-size: 58rpx; }`、L261/284 `.md__side-num/.md__designer-num { font-size: 34rpx; }` → 硬编码展示字号 → 违反 §4.2 → 用 `$jzb-font-display` / `$jzb-font-lg`。
- **[P2]** L254 `.md__summary { background: linear-gradient(135deg,#FFFFFF,#EAF9F6) }` 硬编码浅绿渐变；L288 `.md__sheet { border-radius: 32rpx 32rpx 0 0 }` 32rpx 不在 token 圆角刻度（8/12/20/28/36/999）→ 违反 §4.4 → 用 `$jzb-radius-xl`(36rpx)。
- **[P2]** L287-288 `.md__mask z-index:20 / .md__sheet z-index:21` 随手取值 → 违反 §4.8 → 用 `$z-mask`/`$z-modal`。
- **[P2]** 圆角种类：`$jzb-radius-sm` + `radius-pill` + `$jzb-radius-lg` + 32rpx sheet + 圆形头像，单页 >2 种 → 违反 §5.3 → 收敛到 sm/lg/pill。

### 修复图例对比
```vue
<!-- before -->
<view class="md__quick-item" @tap="openQuotes"><JzIcon name="file-text" :size="38" color="#6958C8" /><text>报价池</text>...</view>
<view v-for="perf in performances" :key="perf.employee?.id || 'designer'" ...>
```
```vue
<!-- after -->
<view class="md__quick-item" @tap="openQuotes"><JzIcon name="file-text" :size="38" :color="TOKEN_COLOR.purple" /><text>报价池</text>...</view>
<view v-for="perf in performances" :key="perf.employee?.id ?? perf.store?.name ?? perf.conversionRate" ...>
```
```scss
/* before */
.md { padding: 24rpx 24rpx 60rpx; }
.md__sheet { border-radius: 32rpx 32rpx 0 0; }
/* after */
.md { padding: $space-4 $jzb-page-pad $space-7; }
.md__sheet { border-radius: $jzb-radius-xl $jzb-radius-xl 0 0; }
```

### 已遵守项
`<script setup>`；onShow 刷新；下拉刷新；JzEmpty 带 sub 引导；选人弹层用真实 JzIcon；路由全 `P.*`；指派后 `await refresh()`（L148）保证返回即刷新。

---

## 页面：src/subpackages/team/pages/list.vue

### 功能简述
企业/团队成员列表：角色 Tab 筛选，JzAvatar+姓名+角色标签，右下角 JzFloatAdd 邀请成员。

### 问题清单
- **[P0]** L64、L68 `ROLE_META[...]?.color || '#16A394'` → 模板内硬编码主色兜底 → 违反 §4.1/§11 → 兜底改用 `TOKEN_COLOR.primaryBase`。
- **[P1]** 缺 loading 骨架：未引入 JzSkeleton，加载中列表区空白（仅 PageState 处理 error）→ 违反 §7.2 → 初载加 JzSkeleton。
- **[P1]** L84 `.team { padding-bottom: 140rpx; }` → 140rpx 非 8 倍数（为悬浮按钮留白）→ 违反 §5.1 → 用 144rpx（=18×8）或基于 float 按钮 token。
- **[P2]** L90 `.team__filter { padding: 8rpx 26rpx; margin-right: 14rpx; }` → 26/14rpx 非 8 倍数 → 违反 §5.1 → 16rpx/16rpx。
- **[P2]** L2 `function go(url: string) {...}` 写在 import 之前 → 违反 §6.4 导入顺序 → 移到 `<script setup>` 顶部 import 区之后。

### 修复图例对比
```vue
<!-- before -->
<JzAvatar :color="ROLE_META[e.role as keyof typeof ROLE_META]?.color || '#16A394'" :size="80" />
```
```vue
<!-- after -->
<JzAvatar :color="ROLE_META[e.role as keyof typeof ROLE_META]?.color || TOKEN_COLOR.primaryBase" :size="80" />
```
```scss
/* before */
.team__filter { padding: 8rpx 26rpx; margin-right: 14rpx; }
/* after */
.team__filter { padding: 8rpx $space-4; margin-right: $space-3; }
```

### 已遵守项
onShow 按权限刷新；下拉刷新；PageState error；JzEmpty；ListFooter；`:key="e.id"`；JzFloatAdd；路由全 `P.*`。

---

## 页面：src/subpackages/team/pages/workbench.vue

### 功能简述
项目经理履约驾驶舱：hero 在管项目数+逾期环，4 个统计卡、5 个快捷入口、5 个 Tab（项目/任务/验收/材料/业务）。

### 问题清单
- **[P0]** 模板大量 `JzIcon color="#0E8A7D"/"#E5484D"/"#AEB8C2"`（L106/111/116/121/128-132/167/182/187/196/218/233/327 等）→ 硬编码品牌/危险/占位色 → 违反 §4.1/§11 → 全部走 `TOKEN_COLOR.*`。
- **[P1]** 缺 loading 骨架：`loading` ref（L21）存在，但模板 `v-if="isPm && report"` / `v-else-if="!loading"`，加载中既无内容也无骨架，白屏 → 违反 §7.2 → 加载态加 JzSkeleton。
- **[P1]** L240 `.pm__hero-value { font-size: 64rpx; }`、L243 `44rpx`、L251 `.pm__stat-value { font-size: 34rpx; }`、L253/244 `20rpx` → 硬编码字号 → 违反 §4.2 → 用 `$jzb-font-display`/`$jzb-font-lg`/`$jzb-font-xs`。
- **[P2]** L247 `.pm__stat { width: calc(25% - 11rpx); }` → 11rpx 非 8 倍数；L246/254/265 多处手写 `box-shadow: 0 8rpx 24rpx rgba(14,138,125,.06)` 等 → 违反 §4.5 → 抽 `$jzb-shadow-*` token。
- **[P2]** L56-57 `open()` 与 `navigate()` 函数体完全相同 → 重复定义，违反 §6.1（DRY）→ 合并为一个。

### 修复图例对比
```vue
<!-- before -->
<view class="pm__stat-icon"><JzIcon name="clipboard" :size="34" color="#0E8A7D" /></view>
<view class="pm__stat-icon pm__stat-icon--risk"><JzIcon name="alert-circle" :size="34" color="#E5484D" /></view>
```
```vue
<!-- after -->
<view class="pm__stat-icon"><JzIcon name="clipboard" :size="34" :color="TOKEN_COLOR.primary" /></view>
<view class="pm__stat-icon pm__stat-icon--risk"><JzIcon name="alert-circle" :size="34" :color="TOKEN_COLOR.danger" /></view>
```
```vue
<!-- before（加载中白屏） -->
<view v-if="isPm && report" class="pm__body">...</view>
<view v-else-if="!loading" class="pm__denied">...</view>
```
```vue
<!-- after -->
<JzSkeleton v-if="isPm && loading" :rows="6" />
<view v-else-if="isPm && report" class="pm__body">...</view>
<view v-else-if="!loading" class="pm__denied">...</view>
```

### 已遵守项
`<script setup>`；onShow 按角色刷新；下拉刷新；JzEmpty 各 Tab 均带 sub 引导；JzProgress 复用公共组件；`:key="item.id"`；路由全 `P.*`；无实心主按钮违规。

---

## 页面：src/subpackages/statistic/pages/analysis.vue

### 功能简述
BOSS 经营驾驶舱：月/门店筛选，4 张指标卡（签约/回款/毛利/在建），经营预警列表，项目毛利 TOP6，可编辑月目标。

### 问题清单
- **[P0]** L32-35 `metricCard(..., '#0E8A7D','#E8F7F5', '#07A35A','#EAF8F0', '#6958C8','#F0EEFC', '#E67E22','#FFF4E8')` → JS 内硬编码一组语义色/底色 → 违反 §4.1 → 从 `TOKEN_COLOR` + 语义 soft 色映射表取值。
- **[P0]** L174 `<JzIcon color="#0E8A7D" />`、L243 `:color="item.level === 'high' ? '#E5484D' : '#E67E22'"`、L248 `color="#AEB8C2"` → 模板硬编码 → 违反 §4.1 → `TOKEN_COLOR.*`。
- **[P1]** L223 `:style="{ background: item.tone }"` → 图标底色用 JS 传入的裸 hex → 违反 §6.2 → 改为 `:class="'ana-metric__icon--' + item.tone"`，底色在 scss 用 token。
- **[P1]** 缺 loading 骨架：`loading` ref（L21）无对应 UI，初次进入指标卡/预警区白屏 → 违反 §7.2 → 加 JzSkeleton。
- **[P1]** L293 `.ana-metric__value { font-size: 40rpx; }`、L298 `.ana-alert-summary__value { font-size: 38rpx; }` → 硬编码数字字号且未带 tabular-nums → 违反 §4.2 → 用 display token + tabular-nums。
- **[P2]** L309 `.ana-alert__tag { padding: 4rpx 10rpx; ... font-size: 20rpx; }` → 10/20rpx 非 8 倍数、20rpx 小于 token 最小 `$jzb-font-xs(22rpx)` → 违反 §5.1/§4.2。

### 修复图例对比
```ts
// before
metricCard('签约额', ..., 'file-text', '#0E8A7D', '#E8F7F5')
// after
import { TOKEN_COLOR } from '@/styles/tokens'
const TONE_SOFT = { primary: '$jzb-primary-lighter', success: '$jzb-success-soft' /* ... */ }
metricCard('签约额', ..., 'file-text', TOKEN_COLOR.primary, TONE_SOFT.primary)
```
```vue
<!-- before -->
<view class="ana-metric__icon" :style="{ background: item.tone }"><JzIcon :name="item.icon" :size="30" :color="item.color" /></view>
<!-- after -->
<view class="ana-metric__icon" :class="`ana-metric__icon--${item.toneKey}`"><JzIcon :name="item.icon" :size="30" :color="item.color" /></view>
```

### 已遵守项
onShow 刷新；下拉刷新；JzEmpty 预警/利润空态均带 sub；设置目标按钮 `:loading/:disabled` 防重复；一屏仅 1 个实心主按钮（保存目标，L216，取消为 neutral）；路由全 `P.*`。

---

## 页面：src/subpackages/statistic/pages/assessment.vue

### 功能简述
人员绩效考核：月+门店+角色筛选，4 个汇总指标卡，员工明细进度条列表（转化/签约/准时交付）。

### 问题清单
- **[P0]** L99 `<JzIcon name="calendar" color="#0E8A7D" />` → 模板硬编码品牌色 → 违反 §4.1 → `TOKEN_COLOR.primary`。
- **[P1]** 缺 loading 骨架：无 JzSkeleton，`report` 为 null 时汇总区与列表均不渲染 → 违反 §7.2 → 加载态加 JzSkeleton。
- **[P1]** L145 `.assess-summary__value { font-size: 38rpx; }`、L153 `.assess-person__rate { font-size: 40rpx; }` → 硬编码数字字号 → 违反 §4.2 → display token。
- **[P1]** L140 `.assess-tab { padding: 12rpx 22rpx; }`、L145 `margin-top: 10rpx`、L156 `margin-top: 12rpx` → 12/22/10rpx 非 8 倍数 → 违反 §5.1 → 用 `$space-*`。

### 修复图例对比
```vue
<!-- before -->
<view class="assess-month"><JzIcon name="calendar" :size="30" color="#0E8A7D" /><text>{{ month }}</text></view>
<!-- after -->
<view class="assess-month"><JzIcon name="calendar" :size="30" :color="TOKEN_COLOR.primary" /><text>{{ month }}</text></view>
```
```scss
/* before */
.assess-tab { padding: 12rpx 22rpx; }
.assess-summary__value { margin-top: 10rpx; font-size: 38rpx; }
/* after */
.assess-tab { padding: $space-3 $space-4; }
.assess-summary__value { margin-top: $space-3; font-size: $jzb-font-display; }
```

### 已遵守项
onShow 刷新；下拉刷新；JzEmpty 带 sub；进度条行内 `:style` 仅 width（动态，合规）；`:key="`${item.employee?.id}-${item.role}`"`；路由全 `P.*`；无实心主按钮违规。

---

## 页面：src/subpackages/statistic/pages/performance.vue

### 功能简述
按角色（PM/团队长/店长/设计师/顾问）渲染经营业绩：hero 签约额、指标卡、待办、趋势、排名、客户健康度条，底部一个主 CTA。

### 问题清单
- **[P0]** L162-163、L401、L415、L429 用字符箭头 `↑`/`↓` 表达涨跌，L436 用 `→` 连接"录入 → 量房率 → 跟进数" → 字符箭头代替图标/视觉 → 违反 §5.1/§11 → 涨/跌分别用 `JzIcon name="trend-up/trend-down"`（或三角符号组件）；流程说明改步骤点。
- **[P0]** L233/252/327/533 `<JzIcon color="#AEB8C2" />` → 硬编码占位灰 → 违反 §4.1 → `TOKEN_COLOR.text4`。
- **[P1]** L546 `.perf__hero { background: linear-gradient(135deg,#0E8A7D,#08796F,#075E58); box-shadow: 0 18rpx 44rpx rgba(14,138,125,.24); }` → 硬编码三段渐变 hex 与阴影 → 违反 §4.1/§4.5 → 复用 `$jzb-gradient` / `$jzb-shadow-float`。
- **[P1]** L545 `.perf { padding: 24rpx; }` → 页面左右边距 24rpx，与全项目 `$jzb-page-pad` 不一致 → 违反 §5.2 → `$jzb-page-pad`。
- **[P1]** L548/562/589/618/637 等大量硬编码数字字号：64/42/40/44/36rpx → 违反 §4.2 → display/lg token；其中仅 `.perf__trend-value`(L598) 带了 tabular-nums，其余金额/大数字未带 → 统一补 tabular-nums 或用 `JzMoney`。
- **[P1]** 缺 loading 骨架：`loading` ref（L22）无 UI，初次进入白屏 → 违反 §7.2 → 加 JzSkeleton。
- **[P1]** L569 `border-radius: 15rpx` → 15rpx 不在 token 圆角刻度（8/12/20/28/36/999）→ 违反 §4.4 → 用 `$jzb-radius-sm`(12rpx)。
- **[P2]** 非 8 倍数间距遍地：3rpx(L571)/6rpx/7rpx(L590)/9rpx(L554)/10rpx(L581)/12rpx(L567)/14rpx(L241...)/15rpx(L569)/18rpx(L553) → 违反 §5.1 → 统一到 `$space-*`。
- **[P2]** L260/354 `:key="perf.designer?.id || 'designer'"`、`|| 'member'` → 同 designers.vue，无 id 时退化为字面常量 key，存在 key 碰撞 → 违反 §6.1。

### 修复图例对比
```vue
<!-- before -->
<text class="perf__trend-change" :class="{ 'perf__trend--up': card.trend > 0, 'perf__trend--down': card.trend < 0 }">
  {{ card.trend > 0 ? `↑ ${card.trend.toFixed(1)}%` : card.trend < 0 ? `↓ ${...}%` : '持平' }}
</text>
<JzIcon name="chevron-right" :size="26" color="#AEB8C2" />
```
```vue
<!-- after -->
<text class="perf__trend-change" :class="trendClass(card.trend)">
  <JzIcon v-if="card.trend > 0" name="trend-up" :size="20" :color="TOKEN_COLOR.success" />
  <JzIcon v-else-if="card.trend < 0" name="trend-down" :size="20" :color="TOKEN_COLOR.danger" />
  {{ trendText(card.trend) }}
</text>
<JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
```
```scss
/* before */
.perf { padding: 24rpx; }
.perf__hero { background: linear-gradient(135deg, #0E8A7D 0%, #08796F 54%, #075E58 100%); }
/* after */
.perf { padding: $space-4 $jzb-page-pad; }
.perf__hero { background: $jzb-gradient; }
```

### 已遵守项
色值取值范式好：`toneColor()` 统一从 `TOKEN_COLOR` 映射（L176-185），是本分片唯一走对 JS 侧 token 的页面；onShow 刷新；下拉刷新；JzEmpty 各空态带 sub；`:key="item.id"` 业务主键；一屏仅 1 个实心主 CTA（"去跟进客户" L490）；路由全 `P.*`；趋势值 `.perf__trend-value` 已带 tabular-nums。

---

## 跨页共性结论（供汇总者参考）

1. **模板 `JzIcon color="#HEX"` 是本分片最高频 P0**：finance/entry、payments、receipts、ledger（#778390）、team/designers、workbench、statistic/analysis、assessment、performance 普遍存在，统一收敛到 `src/styles/tokens.ts` 的 `TOKEN_COLOR`。
2. **缺 loading 骨架/error 重试页**：partners、team/list、workbench、analysis、assessment、performance 均只有 `toastError`，未用 JzSkeleton/PageState，违反 §7.2。
3. **v-for key 字面量兜底**：designers.vue L209、performance.vue L260/L354 用 `|| 'designer'/'member'` 作 key，存在碰撞风险，需后端报表强制带员工 id。
4. **业务 meta 裸 hex 经 `:style` 上色**：payables/receivables/project.vue，建议 meta 改输出语义 token key 或改用 `JzTag`。
5. **唯一 `!important`** 在 finance/project.vue L224-225；**唯一字符箭头 ↑↓→** 在 statistic/performance.vue；**唯一静态行内 style** 在 finance/payables.vue L85、projects.vue L71、entry.vue L206。
