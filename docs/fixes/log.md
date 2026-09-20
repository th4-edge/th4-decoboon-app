# 装得清・BUG 修复台账

> 按时间倒序，新记录插在最上面。编号 FIX-XXX 递增，不复用。
> 详细 SOP 见 
>
> [README.md](./README.md)
>
> 。



***

## FIX-008・多套房客户指定设计师后，未量房房屋主按钮错误显示"进入设计转化"导致卡死

* 日期：2026-09-19

* 报告角色：实际使用反馈

* 影响模块：客户域 / 客户详情 / 销售阶段判定（salesStage）

* 严重度：P1 多套房客户主流程卡死

### 现象

客户有 2 套房，指定设计师后：
1. 一套房进入"量房中"，另一套仍为"待量房"；
2. 选中"待量房"那套房，主按钮显示**"进入设计转化"**；
3. 点击后进入设计转化页面，但该房屋尚未量房，无法继续推进 → **用户卡死，无法进行下一步**。

### 根因

`src/subpackages/customer/pages/detail.vue` 的 `salesStage` computed 原第 208 行：

```ts
if (customer.value.designer && (customer.value.measureAt || activeProperty.value?.latestMeasureAt)) return 'design'
```

`customer.measureAt` 是**客户级字段**，只要客户约定过一次量房就永久有值。多套房场景下：
1. 指定设计师 → `customer.designer` 有值；
2. 约定量房 → `customer.measureAt` 有值（客户级，不区分哪套房）；
3. 此时无论选中哪套房，`customer.designer && customer.measureAt` 恒为 true → `salesStage = 'design'`；
4. `primaryAction` 命中 `salesStage === 'design'` → 主按钮显示"进入设计转化"；
5. 但选中"待量房"房屋时 `latestMeasureAt` 为空，根本还没量房，无法进入设计转化。

### 修复方案

`src/subpackages/customer/pages/detail.vue`：
- `salesStage` 的 `design` 阶段判定去掉 `customer.value.measureAt ||`，只保留 `activeProperty.value?.latestMeasureAt`；
- `design` 阶段的业务含义修正为"**当前选中房屋已量完房**，可以进入设计转化"，而非"客户已约定量房"；
- 未量房房屋在已约定量房+已指定设计师的前提下，`salesStage` 落到 `'measure'` 分支，`primaryAction` 命中 `canRecordMeasure` → 显示**"录入量房"**（正确下一步：设计师去量房并录入数据）；
- 代码注释标注历史坑，防止后续维护者把 `customer.measureAt` 加回来。

修复后多套房场景的主按钮行为：

| 选中房屋状态 | salesStage | 主按钮 |
|---|---|---|
| 已量完房（latestMeasureAt 有值） | design | 进入设计转化 |
| 未量房（latestMeasureAt 为空） | measure | 录入量房 |

### 验证

* `npm run type-check`：通过；
* 回归用例：
  1. 单套房+已约定量房+已指定设计师+未量房 → 主按钮"录入量房"；
  2. 单套房+已量完房 → 主按钮"进入设计转化"；
  3. 多套房+A 已量完房+B 未量房 → 选 A 显示"进入设计转化"，选 B 显示"录入量房"；
  4. 未约定量房+未指定设计师 → 主按钮"约定量房"（不受影响）。

### 业务规则沉淀

* 销售阶段（salesStage）中凡是涉及"量房是否完成"的判定，**必须使用房屋级 `activeProperty.latestMeasureAt`，禁止使用客户级 `customer.measureAt`**。
* `customer.measureAt` 仅表示"客户曾约定过量房时间"，不代表任何一套房已经量完；多套房客户各套房进度独立，阶段判定必须跟随当前选中房屋。
* 后续新增阶段判定时，凡涉及房屋级进度（量房、设计、报价、签约、施工），一律以 `activeProperty` 对应字段为准，客户级字段只用于权限和整体上下文。

***

## FIX-007・多套房客户约定量房不回显当前房屋、无法切换房屋

* 日期：2026-09-19

* 报告角色：App 端实际使用反馈

* 影响模块：客户域 / 约定量房（measure）/ 客户详情房屋选择

* 严重度：P1 多套房客户主流程信息不透明

### 现象

客户有两套及以上房屋时：
1. 客户详情页切换选中房屋后，点击"约定量房"进入量房页，页面**不展示当前选中的是哪套房**，只显示客户级小区/地址，用户体感"默认选中第一个房屋"；
2. 约定量房页面**没有房屋切换入口**，用户无法确认或修改当前量房对象，"页面选择没有用"；
3. 详情页 HouseCard 选中切换本身正常（`@select` → `activePropertyId` → `activeProperty` 响应），两套房均未量房时按钮状态不变是正常业务表现。

### 根因

`src/subpackages/customer/pages/measure.vue` 原实现：
1. 只接收 `propertyId` 参数用于保存时透传，**未拉取房屋列表、未在 UI 回显当前房屋**；
2. 客户信息卡展示 `customer.community` / `customer.addr`（客户级线索地址），与房屋级档案地址是两份数据（参见 FIX-003），用户无法据此判断当前量房对象；
3. 无房屋选择器，多套房客户无法在量房页切换；
4. `detail.vue` 的 `scheduleMeasure()` 已正确传递 `propertyId=${activeProperty.value?.id}`，问题不在跳转参数，而在目标页不消费展示。

### 修复方案

`src/subpackages/customer/pages/measure.vue` 重构：
1. `onLoad` 并行拉取 `crmApi.info(id)` 和 `propertyApi.list(customerId)`，房屋列表用于回显和切换；
2. 按传入 `propertyId` 定位 `propertyIdx`，未传或不匹配时默认第一套；
3. 新增"量房房屋"卡片：展示房号、详细地址、面积/户型；多套房时右上角显示"切换房屋"picker，单套房时只读展示套数；
4. 切换房屋时同步更新 `propertyId`，保存时使用当前选中房屋 id；
5. 当前房屋已有量房记录时，展示橙色警告条提示"该房屋已有量房记录，再次约定将覆盖原约定时间"；
6. `canSubmit` 增加 `currentProperty` 非空校验，无房屋时禁用保存。

### 验证

* `npm run type-check`：通过；
* 回归用例：
  1. 单套房客户 → 量房页显示该房屋信息，无"切换房屋"入口，保存正常；
  2. 多套房客户 → 详情页选第二套房 → 进量房页回显第二套房信息 → 点"切换房屋"可切到第一套 → 保存后关联当前选中房屋；
  3. 已量房房屋 → 量房页显示橙色警告条；
  4. 无房屋客户 → 量房页显示"尚未建立房屋档案"，保存按钮禁用。

### 业务规则沉淀

* 任何需要挂到具体房屋的业务页面（约定量房、录入量房、设计转化、报价生成），**必须在页面首屏回显当前房屋的房号/地址/面积**，不得只展示客户级信息；多套房时必须提供切换入口。
* 跳转传递 `propertyId` 只是参数到位，目标页必须消费并展示，否则等于没传。

***

## FIX-006・App 端客户房屋编辑保存无反应

* 日期：2026-09-19

* 报告角色：App 端实际使用反馈

* 影响模块：客户域 / 房屋档案编辑（property-edit）

* 严重度：P1 核心业务操作不可用

### 现象

App 端进入客户详情 → 点击房屋卡片"编辑" → 进入房屋编辑页面 → 修改信息后点击"保存房屋"按钮，页面无任何反馈（无 loading、无成功/失败提示、不返回），体感为"保存无反应"。小程序端与 H5 端未复现。

### 根因

两处 App 端特有问题叠加：

1. **按钮 `:loading` 与全屏 `uni.showLoading` 重复**：保存按钮同时绑定 `:loading="submitting"`，而 `save()` 内又调用 `loading('保存中…')`（`uni.showLoading` + `mask:true`）。App 端 button 原生组件的 loading 状态机与全屏 loading 遮罩同时存在时，点击事件可能被内部状态拦截；同域 `edit.vue`（客户编辑）按钮未绑定 `:loading`，保存正常。

2. **`toast` 先于 `hideLoading` 执行，成功提示被遮罩吞没**：原代码在 `try` 块内先 `toast('房屋已更新')`，再靠 `finally` 中的 `hideLoading()` 关闭 loading。微信小程序端 `uni.showToast` 会自动关闭 `uni.showLoading`，但 App 端两者独立，toast 被仍在显示的 loading 遮罩覆盖，用户看不到成功提示；若 API 调用偏快，loading 闪现后直接 `navigateBack`，用户更无感知。

3. **附带清理**：`propertyApi.update` 透传 `status: undefined`（编辑页面不传 status），虽 JSON 序列化会忽略，但属于不整洁调用；编辑房屋基础信息不应触碰状态字段。

### 修复方案

1. `src/subpackages/customer/pages/property-edit.vue`：
   - 移除保存按钮的 `:loading="submitting"` 属性，保留 `:disabled="submitting"` 防重复点击；加载反馈由 `save()` 内 `uni.showLoading` 统一提供；
   - 重构 `save()`：API 调用成功后先 `hideLoading()` 再 `toast()`，catch 分支同样先 `hideLoading()` 再 `toastError()`；`finally` 只负责重置 `submitting`；
   - 代码注释标注历史坑，防止后续维护者把 toast 移回 hideLoading 之前。

2. `src/domains/property/api.ts`：
   - `propertyApi.update` 请求体移除 `status` 字段，编辑基础信息不修改业务状态。

### 验证

* `npm run type-check`：通过；
* 对比同域 `edit.vue`（客户编辑）按钮模式，已对齐（无 `:loading` + `:disabled` 防重 + `uni.showLoading` 统一加载反馈）；
* App 端需实机回归：编辑房屋 → 保存 → 应看到"保存中…"loading → 消失后显示"房屋已更新"成功 toast → 500ms 后返回详情页，房屋卡片信息同步更新。

### 业务规则沉淀

* 所有使用 `jz-actionbar` 底部保存按钮的页面，按钮本身**不应**绑定 `:loading`；加载态统一由 `uni.showLoading` 全屏反馈，按钮只通过 `:disabled` 防重复点击。
* 任何 `uni.showLoading` + `uni.showToast` 组合的代码路径，必须保证 `hideLoading()` 在 `toast()` 之前执行；不得依赖小程序端"showToast 自动关闭 loading"的隐式行为。

***

## FIX-005・主包组件引用分包私有 API 导致小程序启动失败

* 日期：2026-09-18

* 报告角色：BOSS 微信开发者工具启动

* 影响模块：首页 / 首次入驻引导 / 供应链领域依赖

* 严重度：P0 小程序无法启动

### 现象

微信开发者工具启动时报错：

```text
module 'subpackages/supply/domains/supply/api.js' is not defined
require args is '../subpackages/supply/domains/supply/api.js'
Component is not found in path "components/OnboardingChecklist"
```

### 根因

`src/components/OnboardingChecklist.vue` 属于主包，却直接引用了 `@/subpackages/supply/domains/supply/api`。微信小程序主包不能同步加载只有进入供应链分包后才注册的私有模块，导致组件初始化直接失败。

### 修复方案

1. 将供应链领域模型和 API 上移到 `src/domains/supply/model.ts`、`src/domains/supply/api.ts`；
2. 首页引导和供应链页面统一引用主包领域模块；
3. 原分包路径保留为兼容 re-export；
4. 重新生成 `dist/dev/mp-weixin` 和 `dist/build/mp-weixin`，确认编译产物引用 `domains/supply/api.js`。

### 验证

* `npm run verify:mp-weixin`：通过；
* 主包 492817 B、最大分包 164914 B、总包 1326733 B；
* 分包规范检查通过；
* 开发构建产物 `components/OnboardingChecklist.js` 已不再 require 分包路径。

***

## FIX-004・首次入驻引导供应商步骤永不完成且返回首页不刷新

* 日期：2026-09-18

* 报告角色：BOSS 实际使用反馈

* 影响模块：首页 / 首次入驻引导 / 供应商协作 / 报价项目库

* 严重度：P1 主流程反馈不闭环

### 现象

BOSS 按首页引导完成成本价格和供应商维护后，返回首页仍看到“开始使用装得清”中的供应商步骤未完成，无法确定系统是否已经记录维护结果。

### 根因

1. `OnboardingChecklist.vue` 的供应商步骤写死 `done: false`，没有读取 `partner/page` 的真实结果；
2. 引导数据只在组件首次挂载时加载，Tab 首页从子页面返回时没有重新取数；
3. 引导将“必做项”和“可选项”混在一张横滑列表里，但完成谓词、分母和下一步没有形成冻结契约。

### 修复方案

1. 引导数据加载供应商列表；
2. 供应商完成条件改为：有效材料供应商且至少存在一个关联品牌；
3. 首页 `onShow` 时调用引导组件 `reload()`，保证从报价库/供应商页返回后刷新；
4. 明确供应商完成文案和关联品牌要求。

### 代码改动

* `src/components/OnboardingChecklist.vue`：接入 `supplyApi.partners()`、动态 `partnerCount`、`reload()`；
* `src/pages/index/index.vue`：首页重新显示时刷新引导组件。

### 过程反思

* 产品规格写了“真实数据推导”，但没有逐项冻结完成谓词、刷新触发和动作后返回的验收用例；
* 开发留下了静态 `done:false` 占位，类型检查和构建无法识别业务状态不收敛；
* 后续所有首次入驻、实施清单、进度和待办状态都按 `LESSON-001`、`ECD-008` 执行。

### 验证

* `npm run type-check`：通过；
* 行为回归待独立验收：维护报价项/成本/供应商 -> 返回首页 -> 状态完成；
* 供应商只新增名称、不填写关联品牌时仍不应显示“品牌关系已完成”；产品已在 `REQ-20260918-ONBOARDING-DEFECT-001` 中将该谓词冻结为可选步骤。
* 独立验收仍需验证返回刷新、可选/必做分母、接口异常、删除回退和重复进入。

***

## FIX-003・约定量房按钮显示条件错误 + 房屋无法编辑 + 量房时间无法调整



* 日期：2026-09-17

* 报告角色：开发自测（BOSS 视角）

* 影响模块：客户 / 房屋 / 量房

* 严重度：P1 主流程走不通

### 现象



1. 客户档案填了地址但没建房屋档案时，详情页主按钮仍可能出现 "约定量房"；

2. 房屋卡片只能看不能改，地址 / 面积 / 户型错了没有编辑入口；

3. 已经约定过的量房时间（`customer.measureAt`）一旦写入，主按钮被 "指定设计师" 顶掉，没有改时间的入口。

### 根因



1. `src/subpackages/customer/pages/detail.vue` 原 `canScheduleMeasure` 用 `hasAddress`（即 `customer.addr` 非空）判断是否可约定量房。但客户档案地址和房屋地址是两份数据 —— 有客户地址不代表有房屋档案，而约定量房必须挂到具体房屋（后端 `customer/customer/measure` 接口要求 propertyId）；

2. `HouseCard` 组件只渲染展示，未 emit 编辑事件；`property-edit.vue` 只支持新增（调 `propertyApi.save`），未支持编辑模式（后端 `property/property/update` 接口已存在但前端没接）；

3. 客户详情 primaryAction 在 `salesStage === 'measure'` 分支里，一旦 `customer.measureAt` 有值就走 "指定设计师" 分支，"约定量房" 入口消失，用户无法回到量房页改时间。

### 修复方案



1. `canScheduleMeasure` 改判：`properties.length > 0 && !activeProperty.latestMeasureAt`（有房屋且当前房屋未量房），删除对 `customer.addr` 的依赖；

2. `HouseCard` 新增 `scheduledAt` prop 和 `edit` / `reschedule` 事件：

* 已约定量房时间 → 卡片显示 "已约定 MM-DD HH:mm 调整" 胶囊；

* 卡片底部加 "编辑" 入口；

1. `property-edit.vue` 支持 `propertyId` 参数：带参进入调 `propertyApi.info` 回填、保存调 `propertyApi.update`；不带参走原新增流程；

2. 客户详情页 HouseCard 接线：`@edit` 跳 property-edit（带 propertyId），`@reschedule` 跳 measure 页（measure 页 onLoad 已会按 `customer.measureAt` 回填日期时间，保存即更新）。

### 代码改动



* `src/subpackages/customer/components/HouseCard/HouseCard.vue`：新增 prop/events/ 量房状态行 / 编辑入口；

* `src/subpackages/customer/pages/detail.vue`：`canScheduleMeasure` 改判、新增 `hasMeasureRecord` / `scheduledAt` computed、`editProperty` / `rescheduleMeasure` 函数、HouseCard 事件接线；

* `src/subpackages/customer/pages/property-edit.vue`：支持编辑模式。

### 业务观察者审查



* **行业对标**：家装行业（土巴兔 / 齐家）CRM 中 "约定量房" 必须绑定具体房屋地址，客户档案地址只是线索，房屋档案才是量房对象。本修复对齐该口径；

* **闭环检查**：跟进 → 建房屋 → 约定量房 → 指定设计师 → 录入量房 → 设计转化，每一步都有入口，且 "调整时间" 作为高频次要操作放在房屋卡上，不抢主按钮；

* **权限与数据隔离**：`propertyApi.update` 后端按企业 / 参与关系校验，前端仅传 propertyId，不引入越权风险；

* **降级与空态**：无房屋时主按钮走 "写跟进"，空状态卡片引导新增房屋；已量房房屋不显示 "调整" 入口（避免重复量房）；

* **结论**：通过。

### 验证



* `npm run type-check`：通过；

* 用户自测清单：

1. 跟进中 + 无房屋 → 主按钮 "写跟进"，不出现 "约定量房"；

2. 跟进中 + 有房屋 + 未量房 → 主按钮 "约定量房"；

3. 点 HouseCard"编辑" → 进编辑页数据回填、保存返回详情刷新；

4. 已约定量房时间 → 卡片显示 "已约定 xx 调整"，点调整进 measure 页时间已回填，改后保存生效；

5. 已量房房屋 → 卡片显示 "最近量房 xx"，不显示 "调整"。



***

## FIX-002・跟进阶段主 CTA 与 "写跟进" 主次不清



* 日期：2026-09-17

* 报告角色：产品 / 业务

* 影响模块：客户 / 跟进

* 严重度：P2 体验问题

### 现象

跟进中客户详情页，主按钮显示 "约定量房"，同时底部固定栏还有一个次按钮 "写跟进"。两个按钮并排，主次不清；且底部固定栏占空间，与 "单屏一个主 CTA" 的视觉规范冲突。

### 根因

`detail.vue` 原底部 actionbar 在 `primaryAction.kind !== 'follow'` 时额外渲染一个 "写跟进" 次按钮。但根据 AGENTS.md §5.4 / §15.9，单页主色实心按钮只能有一个，主 CTA 必须唯一。"写跟进" 是高频但非当前阶段主动作，应降级为悬浮入口。

### 修复方案



1. 删除底部固定 actionbar；

2. 右下角复用 `JzFloatAdd`（与客户列表页 "登记客户" 同一组件同一视觉）作为 "写跟进"FAB，图标用 `message`；

3. `JzFloatAdd` 扩展 `icon?: IconName` prop，默认 `plus`，不影响客户列表页；

4. 页面底部 padding 从 160rpx 调到 260rpx，避免 FAB 遮挡最后一条跟进记录；

5. FAB 显示条件：`customer && canFollow && primaryAction?.kind !== 'follow'`—— 主按钮已是 "写跟进" 时不重复显示。

### 代码改动



* `src/components/JzFloatAdd.vue`：新增 `icon` prop；

* `src/subpackages/customer/pages/detail.vue`：删 actionbar、加 FAB、调 padding。

### 业务观察者审查



* **行业对标**：CRM 类产品（纷享销客、销售易）详情页普遍用右下角 FAB 承载高频次要操作，主 CTA 留在内容流中；

* **闭环检查**：跟进是贯穿销售全程的动作，不仅跟进阶段需要，已转项目 / 已报价阶段也常需要补记沟通。FAB 全局可用，比只在底部固定栏更顺手；

* **权限与数据隔离**：FAB 受 `canFollow` 权限控制，无权限角色不渲染；

* **降级与空态**：主按钮本身是 "写跟进" 时 FAB 自动隐藏，避免双重入口；

* **结论**：通过。

### 验证



* `npm run type-check`：通过；

* 用户自测清单：

1. 跟进中有地址客户 → 主按钮 "约定量房"，右下角 FAB"写跟进"；

2. 跟进中无地址客户 → 主按钮 "写跟进"，右下角 FAB 不出现；

3. 已转项目客户 → 主按钮 "查看工地"，右下角 FAB"写跟进" 仍在；

4. 客户列表页 "登记客户"FAB 样式位置不受影响。



***

## FIX-001・客户详情 "查看工地" 按钮串到其他客户（P0）



* 日期：2026-09-17

* 报告角色：BOSS 视角本地调试

* 影响模块：客户 / 项目

* 严重度：**P0 数据串号**

### 现象

BOSS 查看 "跟进中" 客户王武的详情，主按钮显示 "查看工地"（王武在跟进中、无项目，预期应显示 "写跟进 / 约定量房"）；点击后跳转到的是另一个客户李明的工地详情。

### 根因



1. 取数错误：`detail.vue` 调 `projectApi.list()` 未传 `customerId`，后端 `project/project/page` 对 BOSS 角色返回全公司项目（按 projectId 倒序前 200 条）；

2. 计算兜底错误：`project` computed 原写法



```
customerProjects.value.find(item => item.property?.id === activeProperty.value?.id)

|| customerProjects.value\[0] || null
```

find 匹配不到王武房屋时，兜底取列表第一条 —— 即李明的项目；且兜底未校验 `item.customer.id === 当前客户 id`；



1. 按钮判定：`primaryAction` 第一分支 `if (project.value)` 命中，错误显示 "查看工地"；

2. 跳转串号：`openProject()` 用 `project.value.id`（李明的项目 id）跳 `projectDetail`，后端按企业范围放行，无权限拦截，错得无声无息。

### 修复方案



1. `projectApi.list(query?: { customerId?: string })` 增加可选 customerId 参数，不传则行为不变（首页等 14 处调用零影响）；

2. 客户详情页调用改为 `projectApi.list({ customerId: id.value })`；

3. `project` computed 删除 `[0]` 兜底，改为双条件严格匹配：



```
customerProjects.value.find(item =>

&#x20; item.customer?.id === id.value &&

&#x20; item.property?.id === activeProperty.value?.id

) ?? null
```



1. 代码注释标注历史坑点，防止后续维护者把兜底加回来。

### 代码改动



* `src/domains/project/api.ts`：`list` 增加可选 `customerId` 参数 + JSDoc；

* `src/subpackages/customer/pages/detail.vue`：传 customerId、project computed 严格匹配、加注释。

### 业务观察者审查



* **行业对标**：所有 CRM/ERP 详情页都必须按当前实体 ID 过滤关联数据，全量列表前端 find 是反模式；

* **闭环检查**：修复后王武详情不再错误显示 "查看工地"，步骤条停在 "跟进"，主按钮回到 "写跟进 / 约定量房"；李明详情仍能正常看到自己的工地；

* **权限与数据隔离**：前端双保险（API 过滤 + computed 校验 customer.id），即使后端误返回也不会串号；

* **降级与空态**：王武无项目时 `project.value = null`，按钮自然落到跟进分支；

* **结论**：通过。**此条为 P0，所有客户详情类页面都应排查是否有同类 "全量列表 + \[0] 兜底" 模式。**

### 验证



* `npm run type-check`：通过；

* 用户自测清单：

1. BOSS 打开王武（跟进中、无项目）详情 → 不显示 "查看工地"；

2. BOSS 打开李明（有项目）详情 → 正常显示 "查看工地"，点击进李明自己的工地；

3. 首页 / 我的 / 动态 / 报价编辑 / 财务登记等 14 处 `projectApi.list()` 调用行为不变。