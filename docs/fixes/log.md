# 装得清・BUG 修复台账

> 按时间倒序，新记录插在最上面。编号 FIX-XXX 递增，不复用。
> 详细 SOP 见 
>
> [README.md](./README.md)
>
> 。




## FIX-039 · 合同重复确认生效误报更换付款/施工计划

* 日期：2026-10-08
* 报告角色：企业负责人 / 验收
* 影响模块：合同生效、幂等、付款/施工计划快照
* 严重度：P2 重复操作提示错误，但未产生重复项目

### 现象

合同已生效并生成唯一项目后，再次提交同一合同的 `Effective` 动作，接口返回 400“合同生效后不能更换付款或施工计划”，而不是幂等返回同一合同和项目。

### 根因

`ProjectContractContext.markEffective` 每次都会调用 `ContractPlanContext.ensure`；`ensure` 再次调用 `select`，而 `select` 明确禁止已生效合同更换计划，导致重复生效被误判。

### 修复方案

* `ContractPlanContext.ensure` 在付款计划和施工计划快照都已存在时直接返回；
* 只有快照缺失时才继续补齐；
* 新增 `ContractPlanContextTest.ensureMustBeIdempotentWhenEffectiveContractAlreadyHasBothPlans` 回归。

### 验证

* `mvn -q -Dtest=ContractPlanContextTest,ContractSignRoleTest,ProjectCreationScopeGuardTest test`：通过；
* 本地 dev：合同 `C1791410406775` 已生效后重复提交 `Effective` 返回成功，`projectId` 保持一致，`db_project` 仍只有 1 条项目记录。


## FIX-038 · 合同签约改为设计师发起、负责人复核确认

* 日期：2026-10-08
* 报告角色：设计师 / 企业负责人 / 店长
* 影响模块：合同状态机、合同权限、签约工作台、报价详情、项目立项
* 严重度：P0 签约权限与真实业务协作过程不符

### 业务裁决

合同签约不能再完全依赖企业负责人或店长。设计师负责发起合同、登记客户签约信息并提交复核；企业负责人或店长可调整待确认合同内容，确认签约后再单独确认生效并生成项目。

### 状态与权限

```text
设计师：创建待签约合同、提交企业确认
企业负责人/店长：编辑待确认合同、确认签约 Signed
企业负责人/店长：确认生效 Effective、生成唯一项目
```

* 合同发起接口只创建 `PendingSign`，即使误传 `signedAt/signedAmount` 也不得直接进入已签约；
* `Signed` 和 `Effective` 继续分开，只有生效合同可以创建项目；
* 金额、付款计划、施工计划和工期由企业负责人/店长在确认签约前完成最终调整并冻结；
* 设计师不能确认签约、不能确认生效、不能生成项目，服务端继续最终裁决。

### 代码改动

* 后端新增 `requireContractPreparer / requireContractConfirmer / requireProjectCreator` 三段角色能力；
* `project/contract/save` 允许设计师、店长、企业负责人发起，但只生成待签约合同；
* `project/contract/update` 按 `Signed / Effective` 分别校验确认人与立项人；
* App 新增 `act:contractPrepare / act:contractConfirm / act:projectCreate`，设计师、店长、负责人分别按阶段获得入口；
* 合同页增加“提交合同签约 → 调整并确认签约 → 确认生效并生成项目”步骤；
* 签约工作台恢复设计师的合同发起入口，负责人和店长展示合同确认入口。

### 验证

* `mvn -q -Dtest=ContractSignRoleTest,ProjectCreationScopeGuardTest test`：通过；
* `npm run check:contract-sign`：通过；
* `npm run type-check`：通过；
* 微信开发者工具（本地 dev，真实后端 `127.0.0.1:8090`）：
  * 设计师为已接受报价 `Q1790208531280` 发起合同，生成 `PendingSign`，`signed_amount=NULL`、`project_id=NULL`；
  * 设计师提交后合同页金额只读，按钮变为“已提交，等待负责人确认”；
  * 设计师直接调用 `project/contract/update` 推进 `Signed` 返回 403，推进 `Effective` 返回 403；
  * 店长打开同一合同，最终签约价可编辑，点击“调整并确认签约”并完成二次确认后合同为 `Signed`，`signed_amount=58903.17`、`project_id=NULL`；
  * 企业负责人点击“确认生效并生成项目”并完成二次确认后合同为 `Effective`，生成唯一项目 `P1791410475126`；
  * 财务项目页显示合同收入 5.89 万、待收 5.89 万，数据库应收 3 节点合计 `58903.17`；
  * 项目未分配项目经理时，项目经理访问项目详情返回“项目不存在或无权访问”，负向权限符合预期。


## FIX-037 · 设计师点击生成合同基线无反应与签约三步流程

* 日期：2026-10-08
* 报告角色：设计师 / 企业负责人
* 影响模块：报价详情、项目列表、签约工作台、合同基线创建
* 严重度：P1 合同签约主链入口越权且操作无反馈

### 现象

设计师在报价详情或合同页点击“生成合同基线”后，页面滚动到底部仍无有效结果；网络日志显示 `project/contract/save` 返回 403“只有企业负责人或店长可以处理合同签约与生效”。

### 根因

1. 前端把 `edit:project`、`act:quote` 等通用能力误用于合同签约入口，设计师因此看到了本不可执行的按钮；
2. 项目列表、首页快捷入口和选择器路由没有使用独立签约能力，存在多处越权入口；
3. 合同页把“生成基线、确认签约、确认生效”串成一次提交，用户不能在签约后独立确认生效；
4. 失败提示容易被底部滚动位置和普通 Toast 淹没，表现为“点击没反应”。

### 修复方案

* 新增独立能力 `act:contractSign`，仅店长显式拥有，BOSS 通过内部能力并集拥有；设计师、业务员、项目经理、财务不拥有；
* 签约工作台、合同创建页、付款计划选择器和施工计划选择器统一改为 `act:contractSign` 路由守卫；
* 报价详情、项目列表、首页快捷入口和角色工作台同步使用独立签约能力，设计师不再看到可点击签约按钮，改为等待负责人/店长的只读提示；
* 合同页拆为三步：生成合同基线 → 确认签约 → 确认合同生效并生成项目；签约成功后停留在合同页，单独展示“确认生效并生成项目”；
* 保留后端 `ProjectAccessContext.requireContractSigner` 作为最终权限裁决，前端只做入口收敛和提前提示。

### 验证

* `npm run check:contract-sign`：通过；
* `npm run type-check`：通过；
* `npm run build:mp-weixin`：通过；
* 微信开发者工具（本地 dev，真实后端 `127.0.0.1:8090`）：
  * 设计师董夏鹏首页快捷区不再显示“合同签约”，空态提示等待负责人/店长；
  * 设计师打开已接受报价详情，不显示“生成合同基线/继续合同签约”，显示“等待企业负责人或店长完成合同签约与生效”；
  * 设计师深链打开合同创建页时被页面级权限检查退回报价详情；
  * 企业负责人张伟首页显示“合同签约”，打开已签约合同页显示“确认生效并生成项目”；
  * 真实点击“确认生效并生成项目”后弹出“确认合同生效”二次确认，未点击确认生效，避免改变测试合同状态；
  * 验收后数据库核对 `db_project_contract.quote_id=228668984000512000` 仍为 `Signed`，`effective_at=NULL`、`project_id=NULL`。


## FIX-036 · 业务选择器选中后来源页无响应与施工计划误报

* 日期：2026-10-08
* 报告角色：设计师 / 企业负责人
* 影响模块：报价、合同计划、员工、供应商、材料计划选择器
* 严重度：P1 核心选择回传不可确认

### 现象

客户、房屋、设计方案、套餐模板、施工计划、员工、供应商和材料计划等选择器选中后，来源页没有稳定回填；施工计划相关编辑出现“施工计划模板不存在”提示。

### 根因

1. 选择结果只依赖 `uni.setStorageSync`，跨页面实例和回读时序下可能未稳定交付；
2. 合同创建页先异步回读已有合同，再消费新选择，旧合同可能覆盖新计划；
3. 施工计划编辑页只查 `planApi.constructionManagement()`，与合同目录来源不一致时误报不存在。

### 修复方案

* `createPickerChannel` 增加同运行内内存直传，存储作为跨实例兜底；
* 合同创建页调整为“先消费选择器结果，再回读合同”；
* 施工计划编辑增加 `planApi.catalog()` 回退查询；
* 保持所有选择器统一的一次性回传、清除和取消语义。

### 验证

* `npm run type-check`：通过；
* `npm run build:mp-weixin`：通过；
* `npm run check:selectors`：通过；
* `npm run check:media`：通过；
* `npm run check:subpackages`：通过；
* 微信开发者工具：选择器页面本身均可打开；最终来源页回填需在当前构建上再做一轮稳定点击复验。

## FIX-035 · 现场照片点击无反应，统一图片选择入口

* 日期：2026-10-08
* 报告角色：项目经理 / 设计师 / 业主
* 影响模块：现场汇报、录入量房信息、验收整改、变更证据、附件上传、报价项目图片
* 严重度：P1 核心留证动作无法完成

### 现象

现场汇报点击“拍照/相册”和录入量房信息点击照片区域都没有反应。排查发现全 App 至少 11 处直接调用 `uni.chooseImage`，仅写 `success`，没有统一 `fail` 回调；在开发者工具、权限拒绝或旧基础库不支持时表现为静默无反应。

### 根因

1. 直接使用旧 `uni.chooseImage`，未优先使用 `uni.chooseMedia`；
2. 多个页面各自复制图片选择逻辑，没有统一失败提示；
3. `fail` 分支缺失，权限拒绝、环境不支持、模拟器不支持时没有任何用户反馈。

### 修复方案

新增 `src/domains/file/choose-media.ts`：

* `chooseMedia` 优先调用 `uni.chooseMedia`，旧环境回退 `uni.chooseImage`；
* 统一处理取消、权限拒绝、版本不支持、开发者工具限制和未知失败；
* 提供 `chooseImages` 图片专用入口；
* 所有现场汇报、量房、验收、整改、变更、附件、目录图片页面统一接入。

### 代码改动

* `src/domains/file/choose-media.ts` 新增统一选择器；
* `report/edit.vue`、`measure-record.vue`、`feedback-edit.vue`、`change-create.vue`、`accept/edit.vue`、`change-detail.vue`、`carryover/edit.vue`、`carryover/reconciliation.vue`、`catalog/manage.vue`、`task/detail.vue` 移除直接 `uni.chooseImage`；
* `scripts/verify-media-picker-contract.mjs` 新增契约并纳入 `verify:mp-weixin`。

### 业务观察者审查

* 行业对标：现场留证必须给用户明确的“打开相册/拍照、权限拒绝、失败重试”反馈，不能静默；
* 闭环检查：现场汇报、量房、验收整改、变更证据和附件上传使用同一选择机制，取消不报错，失败可见；
* 权限与数据隔离：不扩大任何业务数据权限；
* 降级与空态：开发者工具不支持时提示使用真机；旧基础库回退 `chooseImage`；
* 结论：通过，真机相册/相机行为仍需真机确认。

### 验证

* `npm run type-check`：通过；
* `npm run build:mp-weixin`：通过；
* `npm run check:media`：通过；
* `npm run check:subpackages`：通过；
* 微信开发者工具点击现场汇报照片入口：点击事件已触发；模拟器不弹系统相册，按环境限制记录为 `BLOCKED_NEEDS_DEVICE`；
* 真机自测：现场汇报、量房照片、验收整改照片分别验证拍照、相册、取消、权限拒绝四项。

## FIX-033 · 报价主链业务对象仍使用原生 picker

* 日期：2026-10-08
* 报告角色：设计师 / 企业负责人
* 影响模块：新建报价 / 套餐确认 / 客户、房屋、设计方案、套餐模板选择
* 严重度：P2 业务对象选择缺少业务特征与一致回传机制

### 现象

新建报价中“客户、客户房屋、设计方案、套餐模板”全部使用原生 `<picker>`；套餐确认页的套餐基线也使用原生 picker。用户只能看到名称、面积或金额的拼接字符串，看不到负责人、客户阶段、最近跟进、方案版本、可报价条件、套餐分区和权限化成本。客户、房屋和方案还可能被自动选中第一条。

### 根因

App 财务项目选择器已经形成独立页面、业务筛选、搜索分页、清除和一次性回传机制，但这套机制只落在财务域；报价主链仍直接使用页面内数组和原生 picker：

1. `quote/edit.vue` 使用 `crmApi.list()`、`packApi.templates()` 等全量/大批量取数；
2. 客户、房屋、方案、套餐没有独立选择页和结果通道；
3. 房屋单条时自动选中，违反显式选择原则；
4. 套餐成本由页面自行决定是否展示，缺少统一角色边界。

### 修复方案

新增四类专用选择器和一次性回传通道：

* 客户选择器：服务端关键词/阶段筛选、分页、负责人/阶段/跟进摘要；
* 房屋选择器：必须带客户上下文，展示小区/面积/户型/设计状态，禁止第一条兜底；
* 设计方案选择器：按客户/房屋过滤，区分可报价与不可报价，展示阻断原因；
* 套餐模板选择器：面积段筛选、套餐价/折扣/分区/项目数，成本仅 BOSS/店长/财务可见。

报价新建与套餐确认改为全宽业务对象卡，点击进入专用选择器。更换客户时清空房屋、方案、套餐和金额上下文；更换房屋时重读方案；更换方案/套餐时重算预览。

### 代码改动

* 新增 `src/domains/{crm,property,design,pack}/*-picker.ts` 四类选择通道；
* 新增客户、房屋、设计方案、套餐模板四个选择页；
* `src/subpackages/quote/pages/edit.vue` 删除四类原生 picker，接入选择器和联动；
* `src/subpackages/quote/pages/quote-confirm.vue` 套餐基线接入套餐选择器；
* `src/subpackages/quote/pages/adjust.vue` 基准报价行接入专用选择页，报价项目接入 CatalogPicker；
* `src/config/index.ts`、`src/pages.json`、`src/roles/guard.ts` 完成路由、分包注册和权限规则；
* 新增 `scripts/verify-selector-contract.mjs` 并纳入 `verify:mp-weixin`。

### 业务观察者审查

* 行业对标：客户、房屋、方案、套餐属于高语义业务对象，必须优先展示业务事实而非普通下拉字符串；
* 闭环检查：报价主链从选客户到选套餐、选方案完成连续推进，选择器只选择对象，不推进业务状态；
* 权限与数据隔离：客户、房屋、方案继续使用既有服务端数据范围；选择器不扩大权限，套餐成本按角色裁剪；
* 降级与空态：选择器覆盖加载、空、失败、重试、清除和上下文失效；接口失败不覆盖原选择；
* 结论：通过；报价调整页已完成基准报价行专用选择器和 CatalogPicker 接入。

### 验证

* `npm run type-check`：通过；
* `npm run build:mp-weixin`：通过；
* `npm run check:selectors`：通过；
* `npm run check:subpackages`：通过；
* `npm run check:navigation`：通过；
* 用户自测清单：
  1. 新建套餐报价 → 选择客户、房屋、套餐均进入独立选择页并显示业务卡；
  2. 更换客户 → 原房屋、套餐和金额预览全部清除；
  3. 新建自定义报价 → 不可报价方案显示阻断原因且不可选；
  4. 设计师查看套餐 → 不显示标准成本；负责人/店长/财务可见；
  5. 套餐确认页 → 点击套餐基线进入套餐选择器，不再出现系统下拉；
  6. 报价调整页 → 扣减/升级/替换选择基准报价行进入专用选择页，报价项目进入 CatalogPicker。

## FIX-032 · 设计师首页快捷入口收敛与契约修正

* 日期：2026-10-08
* 报告角色：设计师
* 影响模块：App 首页 / 设计师快捷入口 / 设计、报价、签约导航
* 严重度：P2 入口语义混乱与重复导航

### 现象

设计师首页快捷区同时出现“客户诉求、客户、登记客户、方案报价、合同签约、施工项目、设计业绩、消息通知”八个同级入口。用户需要自己判断“客户”和“登记客户”、“方案报价”和底部“报价”、“施工项目”和底部“项目”是否重复；其中“合同签约”还会直接进入空表单，而不是先进入待签约队列。

### 根因

`src/roles/catalog.ts` 的 `ROLE_ACTIONS.designer` 是历史累积的平铺入口，没有按设计师 App 高频动作排序。具体链路是：

1. “登记客户”直连 `P.customerEdit`，而客户列表本身已经提供登记客户按钮；
2. “方案报价”直连 `P.quoteList`，底部“报价”则直连 `P.quoteWorkbench`，两个“报价”入口缺少名称区分；
3. “施工项目”和底部“项目”都直连 `P.projectList`，属于快捷区内部可消除的同页重复；
4. “合同签约”直连 `P.projectCreate`，跳过 `P.signWorkbench` 的待签约、停留天数和风险交接工作台。

### 修复方案

* 设计师默认视为设计岗位，登录入口不再把“登记客户”作为一级快捷；需要新增客户时从“我的客户”列表内登记；
* 首页按 App 设计师高频动作排序：先“待我设计 / 待我报价 / 合同签约”，再“客户诉求 / 我的客户 / 报价池”，最后“设计业绩 / 消息通知”；
* “合同签约”改为进入签约工作台，再携带客户、房屋、报价进入合同表单；
* 原“方案报价”列表入口改名为“报价池”，明确它是全量/历史报价台账，底部“报价”继续承载待我报价队列；
* 移除与底部“项目”同页的“施工项目”快捷入口，项目仍从底部 Tab 进入；
* 不改角色权限、报价状态机、签约状态机、金额口径或数据范围。

### 代码改动

* `src/roles/catalog.ts`：重排并收敛设计师 `ROLE_ACTIONS`，新增 FIX-032 历史坑注释；
* `scripts/verify-homepage-contract.mjs`：增加设计师快捷入口顺序、重复入口、签约队列和报价池落点契约。

### 业务观察者审查

* 行业对标：设计岗位首页优先暴露阶段待办，客户新建属于业务员高频动作，放在客户列表内更符合岗位分工；
* 闭环检查：待我设计、待我报价、合同签约、报价池仍完整覆盖设计转化到签约主链；施工项目继续从项目 Tab 进入；
* 权限与数据隔离：仅调整入口和目标页面，不改变 capability、服务端数据范围或页面权限；
* 降级与空态：签约工作台已有空态与风险提示；未选客户/房屋/报价时仍按原页面规则提示，不以默认第一条兜底；
* 结论：通过，待真实微信开发者工具点击验收。

### 验证

* `npm run type-check`：通过；
* `npm run check:home`：通过；
* `npm run check:navigation`：通过；
* `npm run check:action`：通过；
* 用户自测清单：
  1. 设计师登录首页快捷区 → 第一行显示“待我设计、待我报价、合同签约、客户诉求、我的客户”；
  2. 点击“合同签约” → 先进入签约工作台，不直接打开空合同表单；
  3. 点击“报价池” → 进入方案报价列表；点击底部“报价” → 进入待跟进报价工作台；
  4. 首页不再出现“登记客户”和“施工项目”；底部“项目”Tab 仍可进入项目列表；
  5. 客户列表内仍可通过“登记客户”新增客户。

## FIX-031 · 手工记账收支方向与账务用途未联动

* 日期：2026-10-06
* 报告角色：企业负责人 / 财务
* 影响模块：财务 / 手工记账
* 严重度：P2 记账口径误导与错误录入风险

### 现象

手工记账选择“支出”后，账务用途仍显示全部枚举，包括“其他收入”；选择“收入”时也能选到“项目零星成本”“企业费用”等支出用途。

### 根因

`src/subpackages/finance/pages/entry.vue` 的 `purposeOptions` 由 `LEDGER_PURPOSE_META` 直接展开为固定数组，没有按 `form.direction` 过滤；`onDirection` 只更新方向，也没有清理当前不兼容用途。页面因此能形成“支出 + 其他收入”等与业务口径冲突的组合。

### 修复方案

* 在 `src/domains/finance/meta.ts` 增加用途与收支方向的允许关系：项目零星成本/企业费用仅支出，其他收入仅收入，资金往来和其他收支通用；
* `entry.vue` 将账务用途改为按当前方向计算的可选列表；
* 切换方向时，如果当前用途不兼容，归一到中性的“其他”；
* 编辑历史流水时先校正不兼容组合，提交前再次防护，避免 picker 显示值与实际提交值不一致；
* 不改金额、成本、项目归属、核销或台账写入逻辑。

### 代码改动

* `src/domains/finance/meta.ts`：新增 `LEDGER_PURPOSE_DIRECTIONS`；
* `src/subpackages/finance/pages/entry.vue`：用途选项随方向过滤，切换/回填/提交时校正不兼容用途。

### 业务观察者审查

* 行业对标：收支方向决定可用用途/科目，与通用记账软件和家装企业收支分类习惯一致；
* 闭环检查：本次只影响手工记账“补缺”入口，不改变应收/应付、收付款核销、项目成本和其他收入的项目口径；
* 权限与数据隔离：不新增或放宽权限；历史流水校正仅作用于当前表单，不跨企业、不批量改库；
* 降级与空态：资金往来和其他在收/支两侧均保留；不兼容用途不显示，也不以默认值静默提交错误组合；
* 结论：通过。

### 验证

* `npm run verify:mp-weixin`：通过（含类型检查、构建、财务信息架构与分包校验）；
* 微信开发者工具真实页面点击：本轮未执行，按轻量模式完成静态与构建门禁；发布前需按用户自测清单点验；
* 用户自测清单：
  1. 企业负责人/财务进入“手工记账 → 收入” → 账务用途只显示其他收入、资金往来、其他；
  2. 切换“支出” → 账务用途只显示项目零星成本、企业费用、资金往来、其他，不再出现其他收入；原选中其他收入时自动回落为其他；
  3. 支出选择项目零星成本但不关联项目 → 提交被阻止并提示必须关联项目；
  4. 编辑历史流水时，若原方向与用途不兼容 → 页面显示合法的中性用途，不出现选项显示与提交值不一致。

***

## FIX-030 · 付款页成本口径文案纠偏

* 日期：2026-10-06
* 报告角色：财务 / 企业负责人
* 影响模块：财务付款登记 / 付款记录
* 严重度：P1 经营口径误导

### 现象

付款登记和付款记录使用“付款形成项目成本/成本流水”文案，暗示付款才产生成本、未付款就没有成本。

### 根因

旧文案没有区分资金流与项目成本归集口径。当前业务事实为：材料采购下单即形成应付，实际成本按到货确认；退货冲减应付与成本；付款只核销应付并写资金台账，不改变成本总额。

### 修复方案

* 付款登记副标题改为“付款核销应付并写入资金台账；项目成本按应付/到货口径归集”；
* 付款记录副标题改为“付款自动核销应付并生成资金流水；成本按应付/到货口径归集”；
* 不改任何金额、成本、核销或台账计算逻辑。

### 验证

* `npm run verify:mp-weixin`：通过；
* 微信开发者工具真实页面：付款登记、付款记录截图见 `recordings/req-biz-20261006-003-005/20261006-121322/`；
* 全端误导文案搜索：无“付款形成项目成本”类残留。

***

## FIX-029 · 工资付款工人选填与付款记录补录路径

* 日期：2026-10-06
* 报告角色：财务 / 项目经理
* 影响模块：工资付款 / 付款记录 / 工人档案 / 工资凭证
* 严重度：P1 工资付款被阻断

### 现象

工资应付未关联工人时，财务付款被前端强制阻断，项目经理不在线时无法先登记付款和形成台账事实。

### 根因

App 提交前强制 `workerId`，且付款记录没有“工人待补录”和关联工人的路径；后端 `Payment.worker` 已允许为空，但缺少只更新 worker 的补录 Provider。

### 修复方案

* 工资付款发放工人改为选填；未选时提示“身份证号/工种/银行账号栏位将留空，可稍后补录”，允许提交；
* 付款记录对工资付款无工人时显示“工人待补录”，财务/BOSS 可打开底部工人选择面板补录；
* 新增 `finance/payment/update`：只允许对工资付款设置 `Payment.worker`；同一工人重复补录幂等，已关联其他工人时拒绝替换；
* 已生成单张工资凭证时，使用原凭证号和原对象键重渲染 PDF，金额、来源明细、核销和台账不变；合并凭证暂不自动重打，返回明确错误；
* 已按授权新增 `db_voucher_revision` 迁移，记录补录前/后工人、操作人、时间和说明；本地 dev 已执行迁移并登记账本。

### 业务观察者审查

* 行业对标：工资发放不能因档案缺失阻断资金动作，档案补齐后再完善凭证符合现场财务流程；
* 闭环检查：付款 → 台账 → 补录 → 工资凭证重打保持同一 Payment/凭证号，金额事实不变；
* 权限与数据隔离：补录仅 BOSS/财务；工人档案仍由项目经理维护，企业范围校验；
* 降级与空态：无工人时提示留空；合并凭证拒绝自动重打，避免覆盖其他付款对象；
* 结论：通过。审计前后值已落 `db_voucher_revision`，合并凭证仍保留人工处理边界。

### 代码改动

* App：`entry.vue`、`payments.vue`、`domains/finance/api.ts`、`domains/finance/model.ts`、`domains/labor/api.ts`
* 后端：`finance/service/payments/update/**`、`finance/service/payments/page/support/Page.java`、`document/context/VoucherContext.java`、`document/model/VoucherRevision.java`、`document/repository/VoucherRevisionRepository.java`
* 迁移：`docs/design/migrations/79-凭证补录修订轨迹.sql`、`docs/design/migrations/README.md`、`scripts/build-release.sh`
* 测试：`PaymentWorkerBackfillTest`，并同步 `ProviderSecurityAcceptanceTest` 新增 Provider 基线
* 契约：`scripts/verify-finance-worker-backfill-contract.mjs`

### 验证

* App `npm run verify:mp-weixin`：通过；
* 后端 `mvn -q test`：通过（476 tests，0 failures，0 errors）；
* `VoucherBuildAcceptanceTest`：H2 集成验证“工资付款无工人生成凭证 → finance/payment/update 补录 → 原凭证号/原对象键重渲染”，付款金额、账户、日期、应付已付与台账金额不变；
* `mvn -q -Dtest=PaymentWorkerBackfillTest,ProviderSecurityAcceptanceTest,VoucherBuildAcceptanceTest test`：通过；
* 本地 dev MySQL：已备份并执行 79 迁移，`db_schema_migration` 登记 SUCCESS；
* 本地 dev 8092 smoke（DDL 后重启）：`POST /api/finance/payment/update` 返回 `tokenIsUndefined`，证明新 Provider 已注册且未认证请求被拒绝；
* 微信开发者工具真实页面确认付款页成本文案；工资缺档场景因本地无 Salary 应付夹具，未做真实提交验证。

## FIX-028 · 登记收款/付款的应收节点、应付单选择器空白修复

* 日期：2026-10-06
* 报告角色：财务 / 企业负责人（本地测试）
* 影响模块：财务收付登记
* 严重度：P1 主流程走不通（未选项目或没有待收/待付时出现空白选择浮层）

### 现象

1. 财务从财务工作台进入“登记收款”，未选项目时点击“应收节点”，弹出空的系统原生 picker；
2. 项目没有待收节点或应收全部收清时，也会出现空白 picker；
3. “登记付款”的“应付单”使用同构原生 picker，存在同类空白和字段不足问题。

### 根因

1. `entry.vue` 的应收/应付字段直接绑定原生 `picker`，选项来自首屏数组；未选项目时数组为空，字段仍可点击；
2. 首屏选项只保留 `outstandingAmount > 0`，项目全部收清/付清时列表必然为空；
3. 原生 picker 无法承载项目上下文、汇总、搜索、筛选、分组、错误重试和已结清只读态。

### 修复方案

1. 新增 `receivable-picker.vue`、`payable-picker.vue`，按现有项目选择页的页面结构实现项目上下文、汇总条、搜索、筛选、分组、卡片、骨架屏、错误重试、加载更多和底部确认；
2. 新增 `receivable-picker.ts`、`payable-picker.ts` 一次性结果总线，返回完整领域实体，读取即消费，避免重复进入串数据；
3. `entry.vue` 改为“选择卡 + 摘要卡 + 内联空态”：未选项目先提示并打开项目选择页；项目无应收/应付或全部结清时不打开空 picker，直接给出口；
4. 选择后自动填充待收/待付余额，允许改小做部分收付；提交前校验不得超过待收/待付余额；
5. 已收清/已付清默认隐藏，打开“显示已结清”后只读展示，点击提示不可核销；
6. 保留应收计划 → 收款、应付账款/工人工资 → 安排付款的 `projectId + receivableId / payableId` 预选兼容。

### 代码改动

* 新增：`src/subpackages/finance/pages/receivable-picker.vue`、`src/subpackages/finance/pages/payable-picker.vue`
* 新增：`src/domains/finance/receivable-picker.ts`、`src/domains/finance/payable-picker.ts`
* 修改：`src/subpackages/finance/pages/entry.vue`、`src/domains/finance/api.ts`、`src/config/index.ts`、`src/pages.json`、`src/roles/guard.ts`
* 回归契约：`scripts/verify-finance-entry-picker-contract.mjs`、`package.json`

### 业务观察者审查

* 行业对标：装企财务登记必须先锁定项目/核销对象，再带出待收/待付余额；选择对象时直接显示账期、逾期、来源和发票信息，符合财务人员核对习惯；
* 闭环检查：入口既有应收计划、应付账款、工人工资和财务工作台入口均保留；选择只回填表单，不提交收付款，不改变金额和核销事实；
* 权限与数据隔离：选择页仍走后端既有数据范围和 `edit:finance` 守卫，选择结果只包含当前后端可见实体，不扩大跨企业/跨项目范围；
* 降级与空态：无项目、无应收、全部收清、无应付、全部结清、筛选无结果、接口错误均有无空白出口；已选对象不会因刷新失败被静默覆盖；
* 结论：通过。搜索、筛选、重置已补做端到端验证；分页因演示数据不足一页，仍由契约脚本和构建覆盖。

### 验证

* `npm run verify:mp-weixin`：通过（含 `type-check`、微信小程序构建、分包守卫、新增财务选择器契约）；
* 微信开发者工具真实小程序自动化：16 个主链路证据点，路径见下方证据目录；只做浏览和选择，未提交任何收付款；
* 搜索/筛选补充验证：8090 稳定后真实页面验证“逾期筛选”“尾款搜索”“重置筛选”“材料应付搜索”，证据目录 `recordings/req-biz-20261006-002-search-filter/20261006-133132/`；
* 证据目录：`/Users/zhangwei/FutureFiles/安徽昭青/家装装修/装客宝/前端代码/th4-decoboon-app/recordings/req-biz-20261006-002/20261006-115859/`，含 `run.json`、16 张 `frames/*.png` 和由真实页面帧生成的过程视频；
* 用户自测清单：
  1. 财务 → 登记收款，未选项目点“应收节点” → 提示先选项目并进入项目选择，不出现空白浮层；
  2. 选择有应收项目 → 打开应收选择页 → 搜索/筛选/选择节点 → 返回表单，摘要与待收金额正确；
  3. 应收计划点“收款” → 节点已预选；
  4. 选择有应付项目 → 打开应付选择页 → 选择应付单 → 返回表单，项目/收款方/待付金额正确；
  5. 应付账款/工人工资点“安排付款” → 应付单已预选；
  6. 无应收、全部收清、无应付、全部结清、筛选无结果和接口错误均有明确出口或重试。

## FIX-027・全角色审计缺陷：PM 手工任务、深链权限与 TeamLeader 空态

* 日期：2026-10-04
* 报告角色：PM / 业务员 / 团队负责人 / 开发自测
* 影响模块：施工任务 / 页面权限 / 团队工作台
* 严重度：P1 主流程走不通，P2 权限与空态体验

### 现象

1. PM 在项目/阶段详情点“新建任务”，填写后点保存无反应，任务不落库；后端报“工艺任务不能为空”。
2. Marketer 直接冷启动/深链打开资金台账页面时，路由层未阻断，页面先打开再由接口返回 403。
3. TeamLeader 未绑定团队时，首页能提示“尚未绑定团队”，但设计调度、团队成员和团队业绩页显示“加载失败”。

### 根因

1. `task/edit.vue` 没有 `catalogId` 选择入口，而后端 `project/task/save` 对新建任务强制要求 CatalogItem。
2. `uni.addInterceptor` 只能覆盖站内 `navigateTo/redirectTo/reLaunch/switchTab`，无法覆盖小程序冷启动直达页。
3. 三个 TeamLeader 页面只判断 `view:team` 等能力，没有校验 `session.emp.team` 是否存在；无团队时直接请求团队报表，错误被渲染成加载失败。

### 修复方案

1. 新建任务统一进入既有工艺任务库排期页；`task/edit` 只编辑已有任务，旧入口无 `id` 时自动重定向到工艺任务库。
2. App `onShow` 在页面栈形成后补一次 `hasRouteRule + canVisit` 检查，无权限直达页返回首页。
3. 新增 `useTeamContext`，TeamLeader 无团队访问依赖团队的数据页时给出明确提示并返回首页。

### 代码改动

* `src/subpackages/project/pages/detail.vue`、`stage/detail.vue`：新建任务跳转 `projectPlanEdit`；
* `src/subpackages/project/pages/task/edit.vue`：新建模式重定向工艺任务库；
* `src/subpackages/project/pages/plan-edit.vue`：兼容 `projectId + stageId` 深链参数；
* `src/roles/guard.ts`、`src/App.vue`：补冷启动/深链权限检查；
* `src/composables/teamContext.ts` 与三个 TeamLeader 页面：统一无团队处理；
* `scripts/verify-navigation-contract.mjs`：新增静态导航与权限契约守卫。

### 业务观察者审查

* 行业对标：施工任务必须来自企业工艺库，不能做任意文本任务；本修复符合家装报价/施工项标准化。
* 闭环检查：合同生成的目录任务和 PM 补充排期统一走 `stage × zone × catalogItem`，不会破坏设计与施工交接。
* 权限与数据隔离：深链由页面层先行阻断，接口仍保留最终校验；没有放宽权限。
* 降级与空态：无团队时返回首页并保留明确提示；不再把权限/团队前置问题伪装成加载失败。
* 结论：通过。

### 验证

* `npm run verify:mp-weixin`：通过（含新增 `check:navigation`）。
* 真实验证：PM 原新建任务入口自动进入工艺任务库；选择“拆除--保温墙铲除”后成功生成带 `catalog_item_id` 的任务。
* 真实验证：Marketer 冷启动打开资金台账，App `onShow` 后返回首页。
* 真实验证：TeamLeader 临时解除团队绑定后访问设计调度，返回首页。

## FIX-026・客户批量手机号录入、负责人变更与企业负责人删除

* 日期：2026-09-26
* 报告角色：企业负责人 / 店长 / 业务员
* 影响模块：客户经营 / 客户详情
* 严重度：P1 获客录入与人员交接能力

### 现象

客户线索通常只有手机号，无法被负责人、店长批量录入并交付业务员；存量客户无法在 App 中直接变更负责人；企业负责人无法删除误录且尚未形成业务事实的客户。

### 根因

1. 原客户 Provider 只有单条 `save/update`，没有手机号批量解析、预览和导入能力；
2. `CustomerContext.resolveOwner` 只允许 BOSS 明确转交客户，店长不能调整本门店客户负责人；
3. 客户编辑页对已有客户也回传当前登录员工为负责人，存在 BOSS/店长编辑基础资料时误改归属的隐患；
4. 原客户只有标签软删除，没有客户级安全删除 Provider，也没有业务事实保护。

### 修复方案

1. 新增 `customer/customer-batch/build`：按任意特殊字符拆分手机号，识别有效、重复、无效并返回预览，不落库；
2. 新增 `customer/customer-batch/save`：服务端再次解析，只创建有效且未重复的客户，来源统一为“批量导入”，交付选定业务员，单次上限 200；
3. 扩展客户负责人解析：企业负责人可跨门店转交，店长只能转交本门店在职业务人员；
4. 客户详情支持负责人变更；负责设计师沿用既有 `handoff`；
5. 新增 `customer/customer/delete`：仅企业负责人可删除，且客户不存在跟进、房屋、设计、报价、合同或项目事实时才能删除；画像、标签关联随客户清理，业务事实绝不级联删除；
6. 修复编辑页对已有客户回传 `owner` 导致误改负责人。

### 代码改动

* 后端：`CustomerBatchContext`、`customer-batch/build|save`、`customer/customer/delete`、`CustomerContext`、`CustomerSource.BatchPhone` 与关联仓储存在性方法；
* App：新增客户批量录入页 `subpackages/customer/pages/batch.vue`；客户列表增加批量录入入口；客户详情增加负责人变更与负责人删除入口；
* 测试：新增后端解析、交付、权限和删除保护测试；新增 `check:customer-admin` 客户管理契约。

### 业务观察者审查

* 行业对标：装企投放线索通常以手机号文本流转，必须先解析预览、去重再交付；负责人调整是离职交接和客户再分配的高频动作；
* 闭环检查：批量客户从负责人统一进入业务员客户范围，删除只允许清理未进入主链的线索，不破坏客户—房屋—报价—项目链路；
* 权限与数据隔离：批量入口仅负责人/店长；店长不能跨门店转交；删除仅负责人；后端重复校验企业和门店，不信任前端；
* 降级与空态：重复/无效号码不写入；无负责人、无有效号码、超 200 条均阻断并给出原因；
* 结论：通过。

### 验证

* 后端定向测试：`CustomerBatchContextTest`、`CustomerOwnerAssignmentTest`、`CustomerDeleteProviderTest` 通过；
* 后端全量测试：通过；
* App `npm run verify:mp-weixin`：通过，包含类型检查、构建和分包检查；
* `node scripts/verify-customer-admin-contract.mjs`：通过；
* 用户自测清单：
  1. 负责人/店长粘贴不同分隔符手机号 → 预览有效、重复、无效数量；
  2. 确认后选择业务员 → 客户出现在业务员客户范围且来源为批量导入；
  3. 店长变更本门店客户负责人成功，跨门店失败；
  4. 负责人双击/重复确认变更 → 只保留最新负责人；
  5. 负责人删除纯导入线索成功，删除已有跟进/房屋/报价/合同/项目的客户被阻断。

***

## FIX-025・线上文件上传统一“网络异常”诊断修复

* 日期：2026-09-26
* 报告角色：生产环境企业员工
* 影响模块：头像 / 量房 / 工地照片 / 验收 / 设计附件 / 文件上传
* 严重度：P1 生产主流程上传不可用

### 现象

开发环境所有文件上传正常；线上普通业务接口正常，但头像、照片、附件等所有 `uni.uploadFile` 请求均提示“网络异常，请检查网络”。

### 根因

1. 微信小程序的 `request`、`uploadFile`、`downloadFile` 使用相互独立的合法域名；只配置 `request` 不会自动允许 `uploadFile`；
2. 开发工具当前关闭域名校验，因此开发环境正常；生产客户端会在请求发出前拦截未加入 `uploadFile` 合法域名的上传；
3. 前端 `requestFailure()` 丢弃了微信 `errMsg`，把所有 `uploadFile:fail` 都转换成“网络异常”，掩盖了“url not in domain list”的真实原因；
4. 服务端证据：生产 Nginx 500MB 请求体限制正常，公网 multipart 探测可到达后端并返回业务 token 错误，应用日志没有小程序上传异常，确认不是后端、Nginx 或 OSS 前置链路故障。

### 修复方案

1. 上传失败按 `uploadFile` 场景单独解析；识别域名未配置时明确提示管理员将当前 API 域名加入微信 uploadFile 合法域名；
2. HTTPS 证书异常和一般上传连接失败分别给出可执行提示；
3. 新增生产上传域名排查文档和上传诊断契约，明确 request、uploadFile、downloadFile 三类域名必须同时配置；
4. 微信公众平台的 uploadFile 合法域名属于外部平台配置，仍需管理员在后台添加 `https://decoboon.joytsing.com` 后才能彻底恢复。

### 代码改动

* `src/core/http.ts`：上传失败错误分类与域名诊断提示；
* `scripts/verify-upload-diagnostics-contract.mjs`：新增上传诊断契约；
* `package.json`：新增 `check:upload` 并纳入发布校验；
* `docs/18-生产上传域名排查.md`：新增生产排查与发布门禁；
* `README.md`：补充三类合法域名发布提醒。

### 业务观察者审查

* 行业对标：图片和附件上传是家装现场主链的基础，平台域名配置缺失应阻断发布，不能在真机上线后再由用户承担网络故障；
* 闭环检查：修复后普通接口和在途上传失败能区分原因，不改动上传字段、业务类型、项目归属或 OSS 私有文件边界；
* 权限与数据隔离：上传仍携带登录 token 并经服务端文件授权，未增加公开目录、跨企业路径或匿名访问；
* 降级与空态：无法上传时用户得到明确配置提示，已选择文件可在页面保留后重试，不静默丢数据；
* 结论：代码诊断修复通过，生产恢复依赖微信后台 uploadFile 域名配置完成。

### 验证

* 生产 Nginx：`client_max_body_size 500m`，`/api/file/private/grant` 反代正常；
* 生产公网 multipart 探测：HTTP 200，返回 `tokenIsUndefined`，证明服务端上传路由可达；
* 生产日志：无对应上传接口异常，证明请求未成功从线上小程序发出；
* `node scripts/verify-upload-diagnostics-contract.mjs`：通过；
* 用户自测清单：
  1. 微信后台 uploadFile 添加 `https://decoboon.joytsing.com` 后，重新打开小程序；
  2. 员工头像上传成功并立即回显；
  3. 量房、工地日报、验收各上传一张照片成功；
  4. 多图上传成功且业务保存后可再次查看；
  5. 若仍失败，直接查看新的明确错误提示，不再显示笼统的“网络异常”。

***

## FIX-024・注册/授权离场死循环与“我的家”无项目空态修复

* 日期：2026-09-26
* 报告角色：新用户 / 经项目授权的业主
* 影响模块：登录首页 / 企业注册 / 未加入企业 / 进入我的家
* 严重度：P1 主流程离场受阻，P2 空态与视觉体验

### 现象

1. 进入「我的家」后如果没有找到装修项目，页面只有“我是装修公司员工”和“我要注册装修公司”，没有返回首页或退出当前账号的操作提示；
2. 手机号登录成功但尚未加入企业时，点击「以后再说」仍停留在未加入企业页；
3. 创建企业页首屏只有图标和表单，缺少品牌识别、负责人开通说明和已校验手机号反馈，首屏过单调。

### 根因

1. `src/pages/company/join.vue` 的 `later()` 只执行 `uni.reLaunch(P.home)`，没有清理 `sessionType=user && !emp` 的临时会话；
2. `src/pages/index/index.vue` 的 `onLoad/onShow` 会把这类用户再次 `reLaunch` 到未加入企业页，形成跳转回环；
3. `src/pages/owner/enter.vue` 的无项目空态只有员工/企业入口，页面又被“进入我的家”语义包裹，用户无法判断如何放弃或退出；
4. `src/pages/auth/enterprise.vue` 头部只有普通图标、标题和手机号文本，没有使用统一品牌 Mark 和品牌色信息层级。

### 修复方案

1. 未归属用户确认“以后再说”时，先注销本次未归属会话，再回游客首页；首页不再二次回跳；
2. 「进入我的家」空态新增主操作“返回首页，暂不进入我的家”、顶部返回按钮和“不是当前账号？切换账号”，同时保留员工加入与注册企业入口；
3. 创建企业页改用 `JzBrandLogo variant="white"` 品牌色卡片，展示负责人开通、手机号已验证、预计耗时以及邀请员工/管理项目/经营分析三项能力；
4. 注册企业成功仍必须校验后端返回 `currentEmployee` 后才能建立负责人会话，保持企业归属闭环。

### 代码改动

* `src/pages/company/join.vue`：修复“以后再说”会话清理与回首页顺序，更新按钮文案；
* `src/pages/owner/enter.vue`：增加顶部返回、无项目返回首页、切换账号和邀请失效退出路径；
* `src/pages/auth/enterprise.vue`：增加统一品牌色负责人开通卡片与身份校验反馈；
* `scripts/verify-registration-flow-contract.mjs`：新增注册流程契约检查；
* `package.json`：新增 `check:registration` 并纳入 `verify:mp-weixin`。

### 业务观察者审查

* 行业对标：家装平台在业主尚无项目时会先确认手机号归属，并提供“返回首页/切换账号”以及装修公司入口，避免把未授权用户困在企业入驻页；
* 闭环检查：登录分流 → 负责人创建企业、员工接受邀请、业主接受项目授权三条路径均有明确出口，不影响原业务闭环；
* 权限与数据隔离：空态不请求项目接口；企业创建仍以服务端返回的负责人身份为准，未归属用户不会获得员工/业主数据范围；
* 降级与空态：无项目、邀请失效、手机号未授权、接口失败均有返回或切换路径；
* 结论：通过。

### 验证

* `npm run type-check`：通过；
* `npm run check:registration`：通过；
* `npm run verify:mp-weixin`：通过，覆盖契约、类型、微信小程序构建与分包检查；
* 微信开发者工具加载生产构建：确认“暂时没找到您的装修项目”、返回首页、员工加入、注册企业、切换账号均可见；真实手机号授权仍以真机验证为准；
* 用户自测清单：
  1. 新用户手机号登录且无企业 → 点“以后再说，返回首页” → 应进入游客首页且不再回跳；
  2. 业主无项目 → 点“返回首页，暂不进入我的家” → 应进入游客首页；
  3. 业主点“不是当前账号？切换账号” → 应清除当前会话并进入登录页；
  4. 企业负责人进入创建企业页 → 首屏应看到品牌色卡片、已验证手机号和约 1 分钟完成提示；
  5. 员工邀请、业主邀请两条已有链路 → 授权后仍按原路由进入工作台/我的家。

***

## FIX-023・登录首页用户协议与隐私政策入口修复

* 日期：2026-09-24
* 报告角色：小程序登录用户
* 影响模块：登录首页 / 用户协议 / 隐私政策
* 严重度：P1 合规入口与用户体验问题

### 现象

登录首页虽然展示《用户协议》和《隐私政策》，但开发者工具实测点击文字不会跳转；开发环境协议页还显示 `2026-09-15-draft`、`待法务审核` 和 `待补充`。

### 根因

1. 协议入口使用 `text + catchtap`，在真实点击链路中没有触发页面导航；
2. 开发环境 `.env` 仍保留草案版本、占位主体和占位联系方式，与生产协议配置不一致。

### 代码改动

1. 登录页协议入口改为小程序原生 `navigator`，扩大点击区域并与勾选区彻底分离；
2. 勾选区和协议链接区拆分布局，点击协议不会意外切换勾选状态；
3. 用户协议、隐私政策正文统一使用 `runtime.legalSubject`，避免主体硬编码；
4. 开发环境同步正式版本 `1.0.0`、服务主体和客服邮箱。

### 验证

* 微信开发者工具点击《用户协议》→ `pages/legal/agreement`；
* 微信开发者工具点击《隐私政策》→ `pages/legal/privacy`；
* 两页显示版本 `1.0.0`、服务主体“安徽昭青网络科技有限公司”、邮箱 `decoboon@joytsing.com`；
* 勾选控件可独立切换，点击协议后勾选状态不丢失；
* `npm run verify:mp-weixin`、`npm run check:release-env`：通过。

***

## FIX-022・员工头像上传失效与全链路头像 UI 统一

* 日期：2026-09-24
* 报告角色：开发自测 / 装企员工账号
* 影响模块：个人信息 / 企业成员 / 客户 / 项目 / 任务 / 阶段验收 / 设计 / 报价 / 财务 / 绩效 / 工地动态
* 严重度：P2 体验与身份一致性问题

### 现象

用户在小程序个人信息页选择微信头像后提示上传成功，但个人页及其他员工展示位置仍不显示新头像；同时成员、项目负责人、任务负责人、验收提交人等位置只有文字或通用占位图标，员工身份识别不统一。

### 根因

1. `src/core/http.ts` 的通用上传固定使用 multipart 字段名 `file`，而 `user/user/update` 后端按字段名 `avatar` 注入 `@AutoFile StreamFile avatar`；请求未绑定头像文件，接口仍可能成功返回旧资料；
2. 个人信息页没有校验返回值是否产生新头像地址，导致“未生效”被提示为成功；
3. 生产头像仍写本地公开目录，未使用已接入的阿里云 OSS；历史/本地头像相对路径也未统一转成可长期展示的绝对地址；
4. 多个员工出现位置使用的仍是通用图标、首字方块或纯文字，缺少统一的员工身份视觉。

### 代码改动

1. 通用上传支持指定字段名，头像上传显式使用 `avatar`；
2. 上传后校验头像地址确实发生变化，失败时进入真实错误态；
3. 生产头像写入 OSS `avatar/{comId}/` 私有对象，通过 `/file/private/download?path=avatar%2F...` 的严格头像分支返回稳定地址，本地 provider 保留公开目录兼容；员工实体统一归一化历史头像绝对地址；
4. 新增 `JzEmployeeAvatar`，角色色环 + 岗位色点，图片失败回退姓名首字；
5. 在员工本人、企业成员 / 交接、客户负责人 / 设计师、项目负责人 / 成员、任务、阶段、验收、设计、报价、财务选人、绩效、动态与相册等位置接入。

### 业务观察者审查

* 行业对标：家装协同工具在客户、工地、任务和验收中均需要快速识别责任人，头像 + 岗位是低学习成本的身份锚点；
* 闭环检查：头像只影响身份展示，不改变客户 / 项目 / 任务 / 验收状态及金额口径；
* 权限与数据隔离：头像由当前登录员工本人上传，企业范围与角色仍由既有 Provider 和权限矩阵控制；OSS Bucket 与头像对象均保持私有，匿名读取只开放严格匹配的 `avatar/` 对象键分支，其他文件仍必须签名，客户端不能直填非空 `avatarUrl`；
* 降级与空态：无头像或加载失败时回退姓名首字；离职 / 停用员工使用灰化角色点，不伪装为在职。

### 验证

* 后端 `mvn -q test`：通过，338 tests / 0 failures / 0 errors；
* `AvatarContextTest` + `AvatarDownloadProviderTest` + `OwnerFileExposureAcceptanceTest`：通过，覆盖私有 OSS 对象路径、稳定下载地址、严格路径边界和本地兼容；
* `npm run verify:mp-weixin`：通过（客户源契约、员工展示契约、首页/合同/计划/分包契约、类型检查、小程序构建、分包守卫全通过）；
* `npm run build:mp-weixin`：通过，主包 699694 B、最大分包 539173 B、总包 2435135 B；
* 用户自测：员工本人上传头像 -> 个人页立即刷新 -> 返回首页/成员/项目/任务/验收后头像一致；无头像员工显示姓名首字；头像加载失败不出现空白。

***

## FIX-021・预约量房 2.0 独立验收遗留 P1 修复（今日口径 / 历史客户 / 4h / 业务员入口）

* 日期：2026-09-24
* 报告角色：发版前历史缺陷清理（来源：预约量房工作台 2.0 独立验收报告）
* 影响模块：企业负责人预约量房工作台 / 人员绩效考核 / 业务员我的量房
* 严重度：P1

### 修复

1. “今日预约”按 `scheduledAt` 自然日计数，今天已完成和未来时段均包含；
2. 全企业日期窗口不再先按客户当前状态截断，签约客户的历史量房事实保留；
3. App 逾期阈值由 84 小时改为 4 小时，与后端统一；
4. 人员绩效页把月份、门店传给量房报告；
5. 业务员补 `view:measure-workbench`，可进入“我的量房”；
6. `build-release.sh` 迁移打包范围改为 24–59；迁移 56 改为可重试。

### 验证

* 后端全量 `319 tests / 0 failures / 0 errors / BUILD SUCCESS`；
* `BossMeasureWorkspace2AcceptanceTest` 4/4 PASS，`ProviderSecurityAcceptanceTest` 312 路由 PASS；
* App `verify:mp-weixin` PASS、release build PASS、103 页；
* 迁移 56 在临时 MySQL 中连续执行两次 PASS。

### 业务规则沉淀

* 今日预约看自然日，历史事实不看客户当前状态；4 小时逾期和绩效筛选必须跨端一致；
* 详见 `business-rules.md` §18。

***

## FIX-020・对外可见投影必须显式组装，业主详情纳入统一口径

* 日期：2026-09-24

* 报告角色：用户规范收口要求（承接 FIX-015 与业主端沉浸式审计）

* 影响模块：后端投影规范 / 业主详情 / 我的家首页 / 项目旅程 / 员工侧同源项目投影

* 严重度：P1 规范缺失（同类问题一次审计抓到 3 处）

### 问题

同一项目在业主端不同页面出现不同结论：首页显示"待验收"、旅程显示"施工中"；业主详情"当前阶段"为空白。根因不是单个页面，而是对外可见投影曾直接返回实体，`Project.status` / `Project.currentStageName` 等派生列只在部分投影临时回填，导致同一事实出现多种口径。

### 规范收口

1. `customer/project/page`、**`customer/project/info`**、`customer/project/journey/info`、`project/project/page|overview` 全部纳入"对外可见投影必须显式组装"的强制规范；
2. 派生字段必须按领域事实现场推导，并与共享冻结口径一致：
   - 当前阶段：`Doing` / `Accepting` 优先，否则取第一个阶段；
   - 业主可见状态：存在 `Pending` 验收单 → `Accepting`；否则已开工 → `Ongoing`；全 `Done` → `Finished`；无开工 → `Preparing`；`Suspended` / 终态原样保留；
3. 前端 `projectStageText()` 仅作为字段缺失时的降级展示，不得掩盖后端未组装；
4. 回归必须覆盖"同一项目在首页 / 详情 / 旅程三处 `status` 与 `currentStageName` 相等"，以及验收驳回后的跨页状态迁移。

### 实现与验证

* 业主详情投影已补 `currentStageName` 与业主可见 `status` 推导；首页分页与旅程使用同一冻结口径；
* 本轮相关代码在 2026-09-24 审计修复批次中已通过后端 `compile`、App `type-check`、`build:mp-weixin`；规范收口本身为文档变更；
* 规范事实源：`rules.md` §5.6、`AGENTS.md`「对外可见投影必须显式组装」、`code-error-catalog.md` ECD-011、`business-rules.md` §14.5。

***

## FIX-019・相册并入验收证据 + 增加「阶段」分组（日期 → 阶段 → 记录）

* 日期：2026-09-24

* 报告角色：用户追加决策（在 FIX-018 之后）

* 影响模块：业主端 / 工地相册（album）/ 新增后端聚合接口

* 严重度：P2 业务完整性与组织方式

### 需求

1. 相册不能只有现场汇报的照片，**验收留痕（验收影像 + 整改问题图）也要进相册**；
2. 相册在原"按日期分组"基础上**再分一层阶段**，同一天跨阶段时结构更清晰。

### 决策：新增聚合接口，而不是前端拼两个列表

* 前端拿两路数据（`customer/report/page` + `acceptanceApi.listByProject`）拼不出**正确的跨来源排序与分页**（各自的分页边界对不齐），也会多一次往返；
* 因此新增 `customer/project/album/page`：服务端把「现场汇报」与「阶段验收」合并、按发生时间倒序、统一分页。

### 实现

**后端**

1. 新增投影模型 `customer/model/ProjectAlbumEntry`（key / source / businessId / type / typeName / title / content / images / authorName / authorRole / stageName / statusName / occurredAt）；
2. 新增 Provider：接口 `customer/service/project/album/page/Page.java`（`Provider<Project, Page<ProjectAlbumEntry>>, Security`）+ 实现 `.../page/support/Page.java`，`@Service("customer/project/album/page")`；
   - 现场汇报：`visibleToCustomer=true`、按创建时间倒序，映射阶段/作者/角色/照片；
   - 阶段验收：映射验收影像 + 整改问题图（**保序去重**）、结论优先、问题清单兜底、状态名（待确认/已确认/驳回）；
   - 两路合并后按 `occurredAt` 倒序，再按 `current/size` 分页（单请求最多聚合 200 条原始记录）；
3. 仓储补预取：`ProjectReportRepository` 客户可见查询加 `@EntityGraph({"stage","author"})`；`AcceptanceRepository.findByProject_ProjectIdOrderByAcceptanceIdDesc` 加 `@EntityGraph({"stage","submittedBy"})`（ManyToOne，不放大结果行，避免 N+1 与 OSIV 依赖）。

**前端**

4. `domains/project`：新增 `ProjectAlbumEntry` 模型 + `projectApi.album({projectId,current,size})`；影像按来源业务对象（`Report` / `Acceptance`）逐条 `fileApi.grant` 换取短期地址；时间统一 `dateTimeValue`；
5. 相册页改为**三层结构：日期 → 阶段 → 记录**：
   - 第一层：日期（今天 / 昨天 / N月N日 · 周X）+ 当天条数；
   - 第二层：阶段（带扳手图标 + 条数徽标 + 左侧时间轴竖线）；
   - 第三层：记录卡（作者 + 角色 / 类型标签 + 时间 / 标题 / 正文 / 照片网格），卡片左侧有节点圆点挂在时间轴上；
6. 类型标签：汇报沿用类型名与语义色；**验收按状态着色**（已确认→done、驳回→blocked、其余→pending）。

### 验证

* 后端 `mvn -o -DskipTests compile` 通过；
* 前端 `npx vue-tsc --noEmit`、`npx uni build -p mp-weixin` 通过；
* 750rpx 版式走查（375px 视口，构造"今天含 2 个阶段 3 条 + 昨天 1 条"，覆盖 1/2/4/9 张图与 `+12` 蒙层）：
  - 双层分组正确：今天 → 水电改造(2) / 泥瓦工程(1)；昨天 → 其他记录(1)；
  - 时间轴竖线与卡片节点圆点均渲染；4 条记录全部落在对应阶段下；
  - 网格列数分别为 2 / 1 / 3 / 2，`+12` 蒙层正常；
  - **页面无横向溢出**（`scrollWidth === clientWidth`）。

### 待办 / 风险

* 单请求聚合上限 200 条原始记录（汇报 200 + 验收全部）；超大工地（数百条验收）时更早的记录需要靠分页继续取，当前分页作用于合并后的列表，暂未触达上限；
* 验收单的 `occurredAt` 取**提交时间**（createTime），与"照片什么时候拍的"一致；业主确认时间不另开一条时间线记录，仅通过状态标签体现。

### 业务规则沉淀

* 工地相册的证据来源固定为**现场汇报 + 阶段验收**两路，缺一不可；
* 跨来源时间线必须在**服务端合并排序分页**，禁止前端拼接两个分页列表；
* 相册固定三层：**日期 → 阶段 → 记录**；同一天跨阶段必须分块展示；
* 详见 `business-rules.md` §16。

***

## FIX-018・工地相册是"一锅乱炖"的图片墙；项目详情合同履约档案日期金额字号一样大

* 日期：2026-09-24

* 报告角色：App 端实际使用反馈

* 影响模块：业主端 / 工地相册（album）/ 项目详情「合同履约档案」卡片

* 严重度：P2 展示与业务可读性

### 现象

1. **工地相册**：进入后是一整片无差别图片墙——没有日期、没有分组、没有"谁在什么时候拍的、拍的是什么"，看起来像素材库而不是履约证据；
2. **项目详情「合同履约档案」**：当前合同额、签约日期、计划工期三类值**字号字重完全相同**（32rpx / 600），日期区间又长又粗，视觉上很突兀，还挤在同一行右对齐。

### 根因

1. `album.vue` 原实现只是把 `project.cover` + 所有汇报图片拉平去重后丢进 flex 网格，**丢掉了日期、提交人、阶段、正文这些业务信息**；
2. 后端 `customer/report/page`（业主侧动态）的白名单**没有暴露 `author`**（只给了 `authorRole`），业主端拿不到落款人；前端 `SiteReport` 也没有 `stageName`；
3. `detail.vue` 的 `.pd__contract-val` 对所有值统一 32rpx/600，且日期直接渲染后端 ISO 原文。

### 修复方案

**后端（按需最小扩权，不新开接口）**

* `customer/report/page` 白名单放开 `author`，并显式声明 `Employee{empId,name,role}`（**只给姓名与角色，不含手机号**）；员工侧 `project/report/page` 本来就已暴露 author；
* 复用现有分页接口（已按 `createTime` 倒序、只返回 `visibleToCustomer=true`），**不新增端点**——相册需要的数据现有接口都有。

**前端 · 工地相册（朋友圈式时间线）**

* 按 **自然日分组**，日期倒序（今天 / 昨天 / N月N日 · 周X），组头显示当天条数；
* 每条记录 = 一次现场汇报，卡片结构：**落款人（姓名 + 角色）/ 类型标签（阶段开工/工序完成/进度汇报/申请验收/问题整改…）/ 所属阶段 / 时间 / 标题 / 正文 / 照片**；
* 照片按朋友圈规则排布：**1 张 → 大图；2、4 张 → 两列；其余 → 三列**；超过 9 张时第 9 格蒙层显示 `+N`，点击进入 `previewImage` 全屏查看；
* 分页：首屏 20 条，触底加载更早记录，下拉刷新；顶部汇总"共 N 次记录 · M 张照片"；
* 修正原页头"照片来自阶段汇报与验收单"的过度承诺文案，改为准确描述（现场汇报照片按天归档）。

**前端 · 合同履约档案排版**

* 只强调**当前合同额**（32rpx/750，品牌色，等宽数字），日期与工期收敛为 26rpx/500 的辅助信息；
* 签约日期与工期统一走 `dateTimeText().slice(0,10)`，不再直出 ISO；工期区间用「至」分隔并缩小分隔字号，避免长串挤压。

### 验证

* 后端 `mvn -o -DskipTests compile` 通过；
* 前端 `npx vue-tsc --noEmit`、`npx uni build -p mp-weixin` 通过（编译产物含全部 `album__*` 类）；
* 750rpx 版式走查（375px 视口，含 1/2/4/9 张与 "+12" 蒙层）：
  - 日期分组正常（今天 / 昨天），4 条记录分组正确；
  - 图片网格：单图 325×210、两列 160×150、三列 105×110，`+12` 蒙层正常；
  - **页面无横向溢出**（`scrollWidth === clientWidth`）。

### 待办 / 风险

* 相册当前**只聚合现场汇报的照片**（含阶段开工自动汇报）。验收单证据图（`acceptance.evidenceUrls` / 整改问题图）尚未并入；若业务要求"验收也要进相册"，需要新增一个聚合端点或在前端再拉验收列表，属增量；
* `siteApi.page` 单页上限 100（后端 `Math.min(size, 100)`），相册已按 20/页分页，不受影响。

### 业务规则沉淀

* 工地相册是**履约证据链**，必须保留"谁 / 何时 / 哪个阶段 / 做了什么"四要素，禁止退化成无信息的图片墙；
* 相册按自然日倒序分组；照片排布遵循 1 大图 / 2·4 两列 / 其余三列，超过 9 张折叠为 `+N`；
* 卡片内的值必须体现层级：核心金额强调、日期等辅助信息收敛，不得同字号同字重；日期禁止直出 ISO。

***

## FIX-017・全后端框架 DateTime 用法普查：又抓到 2 处"14 位裸数字"直出

* 日期：2026-09-24

* 报告角色：由 FIX-016 触发的主动排查（用户要求"扫一遍，检查修复"）

* 影响模块：订阅/账单（业主与员工都看）/ 项目成员列表 / 全后端时间口径

* 严重度：P2 展示缺陷（不崩、不报错，静默显示错值）

### 普查范围

1. 全后端 `getCreateTime()` / `getUpdateTime()` 调用点：**96 处**，逐条分类；
2. 其它框架 `com.th4.edge.framework.data.date.model.DateTime` 字段（`Subscription.serviceEndTime`、`PlatformTenant.serviceEndTime` 等）；
3. 全后端 `ofEpochMilli(...)`（毫秒换算误用）；
4. 前端所有手写日期格式化（`replace('T')` / `slice(...)`）。

### 关键机制（本次才彻底查清）

* 框架 `DateTime` 是 `@Embedded` 且**未覆写 `toString()`**；`getDateTime()` 返回 **`yyyyMMddHHmmss` 的 14 位数字**（非毫秒）；
* 框架 `MyJacksonAnnotationIntrospector` 只对带 `@com.th4.edge.framework.data.date.annotation.DateTime` **注解**的字段套用 `DateTimeJsonSerializer`（输出 `yyyy-MM-dd HH:mm:ss`）；
* `AuditModel.createTime/updateTime` 用的是 `@CreateTime/@UpdateTime`，**没有 `@DateTime` 注解** → 序列化成对象 `{ dateTime: "20260924103500", date: 20260924, ... }`（`Long` 受全局 `JacksonLongConfigure` 影响按字符串输出）；
* 因此前端 `raw.createTime?.dateTime` 拿到的是 **14 位裸数字字符串**，必须经 `dateTimeValue()` / `dateTimeText()` 才能显示成时间。

### 发现并修复（本轮新增 2 处）

| # | 位置 | 问题 | 修复 |
| --- | --- | --- | --- |
| 1 | `subscription/domains/billing/api.ts` | `serviceEndTime / lastRenewTime / paidTime / expireTime / createdAt` 直接取 `.dateTime`，得到 14 位裸数字；订阅页把它显示成 `20260924103500` | 统一套 `dateTimeValue(...)` 归一化 |
| 2 | `subscription/pages/index.vue` | `formatTime()` 用 `value.replace('T',' ')`，对 14 位数字无效（原样显示） | 改用 `dateTimeText()` 兜底（14 位 / ISO / 已格式化都支持） |
| 3 | `project/service/members/list/support/List.java`（2 处） | `String.valueOf(project.getCreateTime().getDateTime())` 输出 14 位裸数字（前端 `joinedText` 靠"剥非数字"侥幸显示对） | 改用 `DateTimeText.format(...)` → `yyyy-MM-dd HH:mm:ss` |

### 复核确认无问题（不改动，留档）

* **统计 / 老板看板 / 平台适配层**：全部走 `toLocalDateTime()` / `toLocalDate()` ✓（`PerformanceReportContext`、`BossDashboardContext`、`BusinessAnalysisContext`、`SiteWorkbenchContext`、`TenantDataAdapter` 等）；
* `MaterialSelectionContext` / `SelectionBoard.Board` 的 `updatedAt`（Long，14 位）：前端 `dateTimeValue()` 与 `selection-board.timestampOf()` **都已显式识别 14 位**，显示与"停留天数"均正确 ✓
* `ofEpochMilli`：全后端**已无残留**（唯一一处 `CustomerTagContext` 在 FIX-016 已修）✓
* `team/pages/designers.vue` 的 `measureAt`、`HouseCard` 的 `scheduledAt`：后端字段是 `LocalDateTime`（ISO 串），格式化正确 ✓
* `customer/pages/detail.vue` 跟进时间、`site` 汇报时间：`crm/api.ts` / `site/api.ts` 已在 API 层用 `dateTimeValue()` 归一化 ✓
* `Subscription.serviceEndTime` 的**计算**（`SubscriptionContext` 剩余天数 / 过期判断）全部走 `toLocalDateTime()` ✓

### 验证

* 后端 `mvn -o -DskipTests compile` 通过；
* `DateTimeText` 真实 classpath 用例：`format(new DateTime(2026-09-24T10:35))` → `2026-09-24 10:35:00`；`formatPacked(20260924103500L)` → 同上；空值 `—`；非 14 位降级；
* 前端 `core/format` esbuild 打包后在 node 实测：
  - `"20260924103500"` → `dateTimeValue` = `2026-09-24 10:35:00`、`dateTimeText` = `2026-09-24 10:35`；
  - ISO 串 / 已格式化串 / 纯日期 / 空值 均正确（空值 → `''`，由 UI 兜 `-`）；
* `npx vue-tsc --noEmit`、`npx uni build -p mp-weixin` 通过。

### 业务规则沉淀

* 框架 `DateTime` 的三种形态（**对象**、**14 位数字**、**带 @DateTime 注解的格式化串**）必须分别识别，不能假设是其中一种；
* 后端投影输出时间一律走 `DateTimeText`；前端展示一律走 `dateTimeValue()/dateTimeText()`；判断"距今多久"用 `timestampOf()` 这类已识别 14 位的工具；
* 详见 `business-rules.md` §15。

***

## FIX-016・项目旅程"施工"里现场汇报的日期显示成 com.th4.edge...（框架 DateTime 未覆写 toString）

* 日期：2026-09-24

* 报告角色：App 端实际使用反馈

* 影响模块：业主端项目旅程（施工部分）/ 业主旅程投影 / 客户标签

* 严重度：P1 数据展示事故（用户直接看到 Java 类名）

### 现象

业主端「项目旅程 · 施工」中，"**阶段开工 · 开工交底**"这条现场汇报的日期显示为
`com.th4.edge.framework.data.date.model.DateTime@1a2b3c...`（Java 类名 + 哈希），不是时间。

### 根因

1. 这条记录是阶段开工时自动生成的现场汇报（`stages/update` → `report.setTitle("阶段开工 · " + stage.getName())`，`visibleToCustomer=true`），必然会出现在业主旅程里；
2. `CustomerJourneyContext.reportItem()` 用 `date(report.getCreateTime())`，而 `ProjectReport` 继承 `AuditModel`，审计时间是框架的 `@Embedded DateTime`；
3. **框架 `DateTime` 没有覆写 `toString()`**（已用 `javap` + 运行验证：`dt.toString().startsWith("com.th4.edge")` 为 true），所以字符串拼接直接输出类名；
4. 同类调用还有 `acceptanceItem()` 的 `acceptance.getCreateTime()`，以及 `designItem()` 里的 `design.getUpdateTime().getDateTime()`（这个传的是 **Long**，会输出 `20260924103500` 这种 14 位数字）。

补充：框架 `DateTime.getDateTime()` 返回的是 **`yyyyMMddHHmmss` 的 14 位数字**，不是 epoch 毫秒。

### 修复方案

1. 新增 `common/support/DateTimeText`：`format(DateTime)` / `formatPacked(Long)`，统一输出 `yyyy-MM-dd HH:mm:ss`，空值 `—`，非 14 位原样降级；JavaDoc 写明"getDateTime() 是 14 位数字、DateTime 未覆写 toString"两个坑；
2. `CustomerJourneyContext.date(Object)` 改为：框架 `DateTime` → `DateTimeText.format`；14 位数字字符串 → `DateTimeText.formatPacked`；其余原样。**一处收敛，三个调用点（汇报/验收/设计）同时修好**；
3. `designItem()` 不再传 `.getDateTime()`（Long），直接传框架 `DateTime` 对象。

### 顺带修掉的同源缺陷

* `CustomerTagContext.isGoldenNoContact()` 把 `getCreateTime().getDateTime()` 当 **epoch 毫秒**用（`Instant.ofEpochMilli`）——实际是 14 位数字，换算出来是 2612 年，导致"建档 ≤3 天且未首联"的黄金标签**永远不成立**。已改为框架提供的 `toLocalDateTime()`。

### 验证

* 后端 `mvn -o -DskipTests compile` 通过；
* `DateTimeText` 用真实 classpath 跑用例：
  - `format(new DateTime(2026-09-24T10:35))` → `2026-09-24 10:35:00`；
  - `formatPacked(20260924103500L)` → `2026-09-24 10:35:00`；
  - `format(null)` / `formatPacked(null)` → `—`；`formatPacked(123L)` → `123`（降级）；
  - 对照：`new DateTime(...).toString().startsWith("com.th4.edge")` → **true**，确认原缺陷成立；
* 前端（本次回退细分）`npx vue-tsc --noEmit`、`npx uni build -p mp-weixin` 通过。

### 业务规则沉淀

* 框架 `DateTime` 只能经 `DateTimeText` 输出，禁止直接 `toString()` / 字符串拼接；
* 需要"时间进度"这类计算时，用框架的 `toLocalDateTime()/toLocalDate()`，禁止把 `getDateTime()` 当 epoch 毫秒；
* 详见 `business-rules.md` §15。

***

## FIX-015・项目"当前阶段"被硬编码成"待开工"，与项目状态"待验收"自相矛盾

* 日期：2026-09-24

* 报告角色：App 端实际使用反馈（业务逻辑质疑）

* 影响模块：项目域状态机 / 业主端我的家 / 项目列表 / 项目详情

* 严重度：P1 状态语义矛盾（业主与员工都会误读项目到底在什么阶段）

### 现象

项目工地卡片 / 我的家 首屏显示"当前阶段：待开工"，但同一项目里又存在"待验收"（项目状态、阶段状态或验收入口），两处结论互相打架。用户直接问"业务逻辑有问题吗"。

### 根因（三个叠加问题）

1. **前端硬编码兜底**：多处以 `project.currentStageName || '待开工'` 兜底。`currentStageName` 是**需要回填的派生列**，只有 `project/project/overview`（老板经营台）和 `project/project/page`（分页）在投影时临时赋值；其他入口（尤其业主旅程）拿到的就是 `null`，于是全部落到"待开工"；
2. **旅程直接读派生列**：`CustomerJourneyContext` 用 `project.getCurrentStageName()` 而非按阶段事实现场推导，业主端 journey 的 `currentStageName` 常年为空 → 业主端 8 个"我的家"页面统统显示"待开工"；
3. **状态机有降级漏洞**：
   - `project/service/stages/update` 开工时**无条件** `project.setStatus(Ongoing)`，会把"阶段待验收（Accepting）"或"停工（Suspended）"悄悄降级成"施工中"；
   - `ProjectContext.refreshProject` 只用任务进度判断阶段是否开始，**刚开始、任务还没报进度**的阶段会被刷回 `Todo`，项目又掉回"待开工"。

以上直接违反已裁决口径 `DEC-009` 决策二：「项目当前阶段名称与项目级状态不得同时表达相互矛盾的结论」。按 `AGENTS.md` 的智能体门禁，本项先回业务智能体核对（`zhuangdeqing-business` → `DEC-009` / `GAP-010`），再改代码。

### 修复方案

**前端（杜绝矛盾兜底）**

1. `domains/project/meta.ts` 新增 `projectStageText(project)`：优先真实阶段名，缺失时回退到**项目状态文案**（如"待验收"），**永不硬编码"待开工"**；
2. 替换全部硬编码兜底：`pages/index/index.vue`（业主我的家 + 员工项目卡）、`pages/project/list.vue`（两处）、`subpackages/project/pages/contract.vue`；
3. 业主端 8 个"我的家"页面：`:stage-name` 兜底改为 `journey.currentStageName || journey.projectStatusName || '待确认'`。

**后端（状态机不再互相打架）**

4. `CustomerJourneyContext`：`currentStageName` 改为按阶段事实现场推导（正在施工 / 待验收的阶段 → 否则第一个阶段），与 `project/page`、`project/overview` 同口径；不再读派生列；
5. `stages/update`：开工**只允许把"待开工"推进为"施工中"**，不得降级 `Accepting` / `Suspended`；
6. `ProjectContext.refreshProject`：`actualStart != null` 或既有 `Doing` 都算"已开工"，不会被任务进度 0 刷回 `Todo`；`anyStarted` 同步改为"存在非 Todo 阶段"。

### 验证

* 后端 `mvn -o -DskipTests compile` 通过；
* 前端 `npx vue-tsc --noEmit`、`npx uni build -p mp-weixin` 通过；
* 口径对照：`DEC-009` 决策二（Accepting 统一表达为"待验收/阶段待验收"、项目级状态与当前阶段不得矛盾）；`GAP-010` 建议（Accepting 不再等同于竣工验收）。
* 回归关注点：待开工（无阶段开工）→"待开工"；阶段已开工但任务 0% → 仍"施工中"；阶段待验收 → 项目"待验收" + 当前阶段显示真实阶段名；停工 → 开工别的阶段不会被改成"施工中"。

### 项目详情卡片品牌色 + 页签补齐（同一需求）

7. 项目详情卡片改为**品牌色卡面**（白 → 品牌极浅渐变 + 品牌描边），区块标题（选材/待办/岗位/计划/合同/入口）统一品牌深色，避免整页纯白灰；
8. 业主端项目详情页签补齐为 **进度 / 计划 / 增减项 / 动态 / 建议**（原来是 进度 / 动态）：
   - 计划 → 复用原计划页签（业主只读）；
   - 增减项 → 入口卡 + `我的家 · 增减项` 明细（业主只读，不暴露内部成本）；
   - 动态 → 原有现场动态；
   - 建议 → 业主自己的意见/建议列表（`customer/feedback/page`，业主可提交、可跟踪处理回复与时限）。

### 待办 / 风险

* `Project.currentStageName` 作为派生列仍然保留，但**不再作为读取来源**；后续可考虑补齐回填或彻底移除，避免再次被误用；
* 项目状态 `Accepting` 的文案目前统一为"待验收"（`DEC-009` 允许"待验收"或"阶段待验收"）；若要做"最终阶段→竣工验收、中间阶段→阶段待验收"的区分，需要按阶段顺序判定，属后续增量。

### 业务规则沉淀

* 项目级状态与"当前阶段"不得互相矛盾，缺失时一律回退到项目状态文案；
* 派生列（`currentStageName` 之类）不得当作事实源直接读取，必须按领域事实推导；
* 状态推进只能沿既定方向，禁止"开工"把待验收/停工降级为施工中；
* 详见 `business-rules.md` §14。

### 追加（2026-09-24）：Accepting 文案最终统一为"待验收"（细分方案已回退）

**过程**：先按"影响最小"做过一版前端单点细分（`projectStatusLabel()`：待验收阶段是最后一个 → "竣工验收"，否则 → "阶段待验收"，只在项目详情使用）。

**用户最终决策：回退细分，统一成"待验收"。**

* 回退内容：删除 `domains/project/meta.ts` 的 `projectStatusLabel()`；`subpackages/project/pages/detail.vue` 顶部队列恢复 `PROJECT_STATUS_META[project.status].label`；
* 定稿口径：`ProjectStatus.Accepting` 在所有页面统一显示 **"待验收"**（DEC-009 允许"待验收"或"阶段待验收"，二选一即可）；
* 代价说明：这样"阶段待验收 vs 竣工验收"不再在 UI 上区分，符合 DEC-009「只有最终阶段才使用竣工验收语义」——即**在最终阶段也不额外声称"竣工验收"**，不会产生误读；
* 验证：`npx vue-tsc --noEmit`、`npx uni build -p mp-weixin` 通过；`meta.ts` / `detail.vue` 中已无"阶段待验收 / 竣工验收"字样。

***

## FIX-014・业主端付款仍是装企口径、签约/截止日期直出 ISO、进度 Tab 多点一次

* 日期：2026-09-24

* 报告角色：App 端实际使用反馈

* 影响模块：业主端 我的家（付款计划 / 验收整改 / 合同 / 增减项 / 报价清单 / 选材记录）/ 进度 Tab / 项目旅程

* 严重度：P2 口径 + 交互（业主看到"已收/待收"、日期原文，且只有一个工地还要多点一层）

### 需求与现象

1. 验收整改页"最近整改截止"只给一个日期，业主要自己数还剩几天 → **前端计算"还差 N 天 / 已逾期 N 天"**；
2. 付款计划的"下一节点"挤在事实条的小格子里 → **改成横向卡片**；
3. 付款计划明细展示"已收 / 待收"，这是**装企视角**；业主端应该是"**已付 / 待付**"；
4. 合同档案"签约日期"直接显示后端 ISO 原文（`2026-09-10T05:03:07`）→ **优化日期格式**；
5. 进度 Tab：业主一般只有**一个工地**，应该**直接进工地详情**；项目旅程末尾"不展示企业内部成本和利润"这类提示对业主是多余的。

### 根因

1. `CustomerJourneyContext.paymentSection()/paymentItem()` 直接用 `ReceivableStatus.getName()`（待收 / 部分收款 / 已收清）和"应收 / 已收 / 未收"文案 —— 这是装企口径，而 `CustomerJourney` 是**业主只读投影**；
2. 业主端各页的 `factValue(value, type)` 只把 `money` 补 ¥，`valueType === 'date'` 的事实原样输出后端 ISO 串；`OwnerFactList` 的 `item.date` 同样直出；
3. "下一节点"只是 `section.facts` 里的一条 `text`（`节点名 · 日期`），没有独立卡片；
4. `pages/project/list.vue` 对所有角色都先渲染列表页；
5. `journey.vue` 的页脚对所有者角色都渲染。

### 修复方案

**后端（口径换算，不减信息）**

* `paymentSection()`：标题"款项 / 应收节点与到账进度" → "付款 / 按合同节点的付款进度"；状态"待收款"→"待付款"、"已结清"→"已付清"；summary"已收 X，未收 Y"→"已付 X，待付 Y"；facts"应收总额 / 已收 / 未收"→"应付总额 / 已付 / 待付"；
* `paymentItem()`：新增 `paymentStatusName()`，把 `ReceivableStatus` 换算为业主口径 —— `Pending→待付款`、`Partial→部分付款`、`Received→已付清`、`Overdue→已逾期`、`Closed→已关闭`；并下发"已付 + 待付"两条事实；
* **员工端财务页面继续使用 enum 原口径（待收/已收清）**，只有业主旅程投影换算，避免把装企台账口径改掉。

**前端**

* `src/core/format.ts`：`diffDays()` 改为只取日期部分（ISO 带 T 时不再解析失败）；新增 `dueText()`（今天到期 / 还差 N 天 / 已逾期 N 天）与 `factDisplay()`（money → `3万` / `¥9,800`；date → `YYYY-MM-DD`）；
* 业主端 5 个事实页（验收 / 付款 / 合同 / 增减项 / 选材）统一改用 `factDisplay`；验收整改的"整改截止"额外渲染 `dueText` 胶囊（未到期橙、逾期红）；事实条统一 `flex-wrap` + 最小宽度；
* `owner-payment.vue`：把 `next` fact 移出事实条，改为**横向卡片** —— 左侧「下一节点 + 节点名 + 到期日 + 相对天数」，右侧「待付金额（大字）+ 应付金额」，逾期整卡换红；
* `OwnerFactList.vue`：卡片日期走 `dateTimeText()`，金额改用 `JzMoney`；
* `OwnerPriceGroups.vue` / `owner-quote.vue`：金额同样改用 `JzMoney`；
* `pages/project/list.vue`：业主角色且可见工地只有 1 个时 `uni.redirectTo` 工地详情（一次性标记，避免从详情返回时反复跳转）；
* `journey.vue`：页脚"不展示企业内部成本和利润"只对员工展示，业主端不再出现。

### 顺带修掉的两个真实缺陷

1. **金额丢单位（截图级）**：`money(x, false)` 只取数值部分，≥1 万时把"3 万"渲染成"¥3"。受影响面：付款节点金额、合同/增减项金额、报价清单分项金额、报价汇总。已统一改用 `JzMoney`（基于 `moneyParts`）：≥1 万显示"3.84万"、<1 万显示"¥9,800"；
2. **业主卡片日期直出 ISO**：`OwnerFactList` 的 `item.date` 原样渲染 `2026-09-10T05:03:07`，现统一走 `dateTimeText()`。

### 验证

* 后端 `mvn -o -DskipTests compile`：通过；
* 前端 `npx vue-tsc --noEmit`、`npx uni build -p mp-weixin`：通过（编译产物含 `opayment__next*`，`OwnerFactList.wxml` 含 `jz-money`）；
* `core/format.ts` 用 esbuild 打包后在 node 实测：
  - `money(30000)`→`3万`、`money(9800)`→`¥9,800`、`money(128000.5)`→`12.8万`；
  - `factDisplay('30000.00','money')`→`3万`、`factDisplay('2026-09-10T05:03:07','date')`→`2026-09-10`、`factDisplay('—','money')`→`—`；
  - `dueText(+3)`→`还差 3 天`、`dueText(0)`→`今天到期`、`dueText(-2)`→`已逾期 2 天`、`dueText('2026-09-25T00:00:00')` 可正常解析、`dueText('—')`→空；
* 750rpx 版式走查（375px 视口）：下一节点横向卡片 351px（正文列 249 / 金额列 63–81），无横向溢出；待付金额 18px 大字可读；事实条 3 项 1 行不溢出。

### 待办 / 风险

* `pages/project/list.vue` 的业主单项目跳转依赖 `projectApi.page` 的返回；若后端返回分页不完整（`hasMore=true`）会放弃跳转并展示列表，属安全降级；
* 付款节点的 `待付` 由后端按 `amount - receivedAmount` 计算并下发，前端只做展示，不在前端重算金额。

### 业务规则沉淀

* `CustomerJourney` 是业主只读投影：**所有金额/状态文案必须是业主口径**（应付/已付/待付），装企台账口径（应收/已收/待收）只能留在员工端；
* 业主端日期禁止直出 ISO；截止类日期必须由前端补"还差 N 天 / 已逾期 N 天"；
* 金额一律走 `JzMoney` / `money()`，禁止用 `money(x, false)` 再手工拼 `¥`（≥1 万会丢"万"）；
* 业主只有一个工地时，"进度"入口直接落工地详情；
* 详见 `business-rules.md` §13。

***

## FIX-013・选材状态只有文字标签、业主端选材事实条会横向溢出

* 日期：2026-09-24

* 报告角色：App 端实际使用反馈

* 影响模块：选材工作台（selection-board）/ 员工端主材选材（selection）/ 业主端选材记录（owner-selection）/ 公共组件 JzTag

* 严重度：P3 展示与可读性（不阻断流程，但状态扫读效率低、且存在横向溢出）

### 现象

1. "选材状态"只用文字标签表达（已确认 / 待客户确认 / 选材草稿 / 未发起），一眼看不出"确认了没有"；希望用图标区分：**已确认 → 对勾图标，未确认 → 等待时钟图标**，且必须是真图标，**不能用 emoji 字符（✅ ⏰）**；
2. 业主端「我的家 · 选材记录」顶部事实条在同时存在"材料计划 / 已下单 / 已到场 / 选材版本 / 选材状态"5 项时，`flex: 1` 均分导致长文案（如"待客户确认"）横向挤压，溢出屏幕。

### 根因

1. `JzTag` 只有 `dot` 圆点能力，没有图标能力；而它的根节点是 `<text>`，小程序 `<text>` 内**不能嵌 `<image>`**（`JzIcon` 渲染的就是 `<image>`），所以不能直接往标签里塞图标；
2. `owner-selection.vue` 的 `.factstrip` 是 `display: flex` + `.factstrip__item { flex: 1 }`：不换行、不设最小宽度，项数一多或文案一长必然溢出。

### 修复方案

**公共组件**

1. `JzTag` 新增可选 `icon`（`IconName` 类型）：
   - **不带 `icon` 时保持原来的 `<text>` 根节点**，既有 120+ 处调用的行内排版零影响；
   - 带 `icon` 时改用 `<view>` 根节点 + `JzIcon` + `<text>` 标签，规避"`<text>` 内不能嵌 image"的限制；
   - 图标尺寸按 `sm / md / lg` 取 22 / 26 / 30rpx，颜色跟随标签语义色（solid 时取白色）。

**选材状态图标（走 JzIcon 线性图标，不用 emoji）**

2. `selection-board.vue`：`SELECTION_META` 增加 `icon` —— `confirmed → check-circle`，`none / draft / pendingConfirm → clock`；
3. `selection.vue`：`STATUS_META` 同样增加 `icon`，选材状态标签带图标（订单状态标签保持纯文字，两者语义不同）；
4. `owner-selection.vue`：事实条里的 `selectionStatus` 改为「图标 + 文案」，图标由**最新一版选材的 status 枚举**推导（`items` 中 `selection-*` 的第一条即最新版，后端按版本倒序下发），不靠中文字符串匹配。

**事实条溢出**

5. `.factstrip` 改 `flex-wrap: wrap`；`.factstrip__item` 改 `flex: 1 1 200rpx; min-width: 0`；选材状态取值降到 26rpx/700，避免"待客户确认"撑破卡片。

### 验证

* `npx vue-tsc --noEmit`、`npx uni build -p mp-weixin` 通过；
* 编译产物 `JzTag.wxml` 确认双分支：有 icon → `<view>` 包 `<jz-icon>` + `<text>`；无 icon → 仍是原 `<text>` 根节点；三个页面编译 JS 均含 `icon:"check-circle"` / `icon:"clock"`；
* 750rpx 版式走查（375px 视口）：图标胶囊最宽 88px（"待客户确认" + 图标）不溢出；不带图标的旧标签宽度不变（49px）；业主端 5 项事实条**自动换 2 行**，`scrollWidth === clientWidth`。

### 业务规则沉淀

* 状态表达用 `JzIcon` 线性图标，**禁止用 emoji 字符（✅ ⏰ 等）当正式 UI 图标**（与 AGENTS.md「正式 UI 禁止 emoji」一致）；
* 带图标的状态标签统一走 `JzTag` 的 `icon`，不要在各页面自造胶囊样式；
* 事实条 / 指标条这类条目数可增长的行，必须 `flex-wrap` + 最小宽度，不得用纯 `flex: 1` 硬均分；
* 详见 `business-rules.md` §12。

***

## FIX-012・主材选材结果把 JSON 原样透给业主、材料记录卡片文字层级混乱

* 日期：2026-09-24

* 报告角色：App 端实际使用反馈

* 影响模块：业主端「我的家 · 选材记录」（OwnerFactList）/ 员工端「主材选材」（selection.vue）/ 后端业主旅程投影

* 严重度：P2 展示质量（业主看到一长串 JSON 完全读不懂；卡片可读性差）

### 现象

1. 业主打开「我的家 · 选材记录」，选材结果卡片里显示的是一串 JSON：`{"color":"暖灰石纹","spec":"800×800","brand":"马可波罗"}`，普通业主读不懂，也不知道这就是"选材结果"；
2. 员工端「主材选材」的"选材结果"是一段灰底平文本，"颜色 / 规格 / 品牌 / 工艺 / 备注"糊成一整句；
3. 材料记录卡片文字层级混乱：标题、副标题、状态、时间、标签、值挤在相近的灰阶里，真正的重点（选材结果）淹没在灰字中。

### 根因

1. `CustomerJourneyContext.selectionItem()` 直接把 `selection.getSelectionJson()`（本来只用于前端回显表单的结构化快照）塞进 `item.getLines()`，而业主端 `OwnerFactList` 原样渲染 `lines`；
2. 员工端 `selection.vue` 的 `resultText()` 只取 `selectionText`（可读 content）平铺成一整句，完全没用 `selectionJson` 的结构；
3. `OwnerFactList` / `selection.vue` 的样式以 `$jzb-text-3`/`$jzb-text-4` 灰阶为主，缺少"标签—值"的对比与强调色，也没有分隔与左强调条。

### 修复方案

**后端**

1. 新增 `com.th4.edge.decoboon.common.support.SelectionText`：把 `selectionJson` / 可读文本统一解析成有序字段（颜色/花色、规格/型号、品牌/系列、工艺、备注），JSON 优先、文本兜底、坏 JSON 回退文本；
2. `CustomerJourneyContext.selectionItem()` 改为输出结构化 `facts`，**JSON 不再进入 `lines`**；无结构时用可读文本兜底。

**前端**

3. `src/core/format.ts` 新增 `selectionFields()` / `selectionLineText()`：解析 JSON 快照，并把历史残留的 JSON 行转回「标签：值」文本（防止缓存或历史数据再次暴露 JSON）；
4. `OwnerFactList`（业主端 选材 / 合同 / 增减项 / 付款 / 验收 共用组件）：
   - `lines` 统一走 `selectionLineText()`，杜绝 JSON 直出；
   - 文字层级重排：标题 `text-1` 32rpx/700、副标题 `text-3` 22rpx、状态胶囊品牌色 `primary-dark on primary-lighter`、时间加时钟图标提升到 `text-3`、事实标签 `text-3` 20rpx + 值 `text-1` 26rpx/650、正文 `text-2`；
   - 事实区改为整行可换行（`word-break`），行前加品牌色圆点作为视觉锚点；卡片内分隔与间距收敛。
5. 员工端「主材选材」`selection.vue`：
   - 选材结果卡片化：品牌色左条 + 结果图标 + 版本号 + 「标签 / 值」逐行（标签 `text-3`，值 `text-1` 600）；
   - 未选材时改为灰底降级块并给出明确下一步文案；
   - "合同要求"拆成 `text-4` 标签 + `text-2` 值；底部时间 `text-3`、下一步按钮品牌色 + 600 字重并加分隔线；卡片加 `:active` 反馈。

### 验证

* 后端 `mvn -o -DskipTests compile` 通过；用真实依赖 classpath 跑 `SelectionText` 用例：
  JSON → 5 个中文字段、仅文本 → 解析、JSON 优先于文本、全空 → 空、坏 JSON → 文本兜底、无冒号文本 → 无名 segment；
* 前端 `npx vue-tsc --noEmit`、`npx uni build -p mp-weixin` 通过；用 esbuild 打包 `core/format.ts` 后在 node 实测：
  `selectionLineText('{"color":"暖灰石纹",...}')` → `颜色/花色：暖灰石纹；规格/型号：800×800；…`，非 JSON 文本（如 `需求：客厅通铺`）原样返回，坏 JSON 不抛异常；
* 750rpx 版式走查（375px 视口）：无横向溢出；5 个事实字段两栏排布、长"备注"换 2 行不裁切；结果行标签列 70px / 值列 228px；页面文本中不再出现 `{"`。

### 业务规则沉淀

* 结构化快照（`selectionJson`）只用于回显表单，**禁止直接进入任何面向用户的文本字段**（旅程 lines、打印稿、PDF）；
* 选材结果必须以「标签 + 值」成对展示，标签 `text-3`、值 `text-1` 加粗，不得糊成一句话；
* `OwnerFactList` 是 5 个业主事实页共用组件，任何文案或颜色改动都要按"选材 / 合同 / 增减项 / 付款 / 验收"一起回归；
* 详细规则见 `business-rules.md` §11。

***

## FIX-011・施工工艺没有快照会回溯历史报价、员工端看不到工艺、设计方案页信息层级偏高

* 日期：2026-09-24

* 报告角色：App 端实际使用反馈

* 影响模块：设计分项（DesignItem）/ 报价快照（QuoteLine）/ 后端业主旅程投影 / 员工端方案编辑与报价详情 / 业主端设计方案

* 严重度：P2 口径风险 + 展示层级（越权倒不至于，但"报价快照"被材料库回改）

### 现象

1. 报价行与设计分项都没有自己的施工工艺字段，工艺只能从材料库 `CatalogItem.craft` 现取 —— **材料库改了工艺，历史已生成的报价跟着变**，与"报价明细快照"的定位自相矛盾；
2. 员工端「方案编辑」的分项卡片、「报价详情」的分项行都看不到施工工艺，设计师/店长向客户讲解报价时没有工艺依据；
3. 业主端「我的家 · 设计方案」把"设计风格 / 套内面积 / 户型"做成三张大卡放在页面**最底部**，字号 32rpx + 700 字重（与区块标题同级），视觉非常突兀；
4. 「区域设计内容」把所有区域的分项全部铺开，区域一多页面极长，业主抓不到重点（这是 FIX-010 把"区域被横向 Tab 藏起来"修成"全部展开"时留下的副作用）。

### 根因

1. `DesignItem.applyCatalog()` 只快照 `criterion`，**没有快照 `craft`**；`QuoteLine` 连 craft 列都没有；因此 `CustomerJourneyContext` 与员工端只能经 `catalogItem` 关联现取主数据，等于没有快照；
2. 员工端方案/报价响应白名单（`@AllowProperties`）没有放开 craft，前端 `DesignItem` / `QuoteItem` 模型也没映射该字段；
3. `owner-design.vue` 的 `.design__meta` 在模板中排在最后一个区块之后，样式取 `$jzb-font-md`(32rpx) + `font-weight: 700`；
4. `OwnerPriceGroups` 在 FIX-010 改为"全部展开"，解决了"看不到区域"，但没有解决"区域多时看不到重点"。

### 修复方案

**后端（快照闭环）**

1. `db_design_item`、`quote_line` 各增加 `craft LONGTEXT` 快照列 → 迁移 `docs/design/migrations/59-设计分项与报价行施工工艺快照.sql`（幂等加列 + 历史数据从材料库/设计分项回填，不覆盖已有值）；
2. 新增 `com.th4.edge.decoboon.common.support.CraftText.firstNonBlank()`，统一"自身快照 → 上游主数据"的取值口径，避免各处各写一套；
3. **写入**：`DesignItem Save.applyCatalog()` 与 `DesignCopyContext` 冻结材料库 craft；报价行 7 个创建点（`QuoteContext` 设计快照/套餐行、`HybridQuoteBuilder` 套餐行/数量差异/设计新增、`QuoteAdjustmentContext`、`QuoteCopyContext`）全部写入 craft；
4. **读取**：`CustomerJourneyContext` 的 `designItemGroups()` / `quoteGroups()` 改为"自身快照优先"；`ContractChangeFulfillmentContext` 生成项目施工任务时的工艺也改为优先用报价行快照；
5. **白名单**：设计分项（`design/schemes/info`、`design/items/save`）、报价行（`quote/info`、`quote/designerinfo`、`manager/quotes/info`、`quote/lines/page`）放开 `craft`。

**前端**

6. `domains/design` 的 `DesignItem`、`domains/trade` 的 `QuoteItem` 补 `craft` 字段与归一化；
7. 员工端「方案编辑」分项卡片、员工端「报价详情」`QuoteItemRow` 增加品牌色施工工艺块（与业主端同一视觉语言）；
8. 业主端设计方案页：把"设计风格 / 套内面积 / 户型"三张卡**移到「区域尺寸」上方**，字号从 32rpx/700 收到 **26rpx/600**、标签 20rpx，改紧凑三栏；
9. `OwnerPriceGroups` 改为**区域可收缩、默认收缩**：区域卡永远全部可见，点区域标题展开/收起明细，索引点按会跳转并自动展开；提交标题显示"点击展开/收起"与 chevron。

### 验证

* 后端 `mvn -o -DskipTests compile`：通过；
* 前端 `npx vue-tsc --noEmit`、`npx uni build -p mp-weixin`：通过（编译产物含 `opgroup__head--collapsed` / `qir__craft*` / `ds__item-craft*`）；
* 750rpx 版式走查（375px 视口，9 个区域）：
  - 三张事实卡 1 行排布，取值 13px/600（原 16px/700），标签 10px；
  - 9 个区域索引换 3 行、9 张区域卡全部渲染、明细默认隐藏（`visibleRows = 0`），页面高度从"全展开"的数千像素收敛到 995px；
  - 无横向溢出（`scrollWidth === clientWidth`）。
* 回归关注点：`craft` 为空时不渲染工艺块，不影响其余字段；`show-price=false`（设计方案）时仍不出现金额。

### 待办 / 风险

* `docs/design/migrations/01-空库基线.sql` 仍是 2026-09-15 生成版本，**未随本次 DDL 重新生成**：空库初始化需按顺序执行基线 + 59 号迁移（59 号幂等，可重复执行）。基线重生成按发布流程统一处理，避免本次混入大量无关 DDL 差异。
* 员工端方案编辑的分项卡把工艺截断到 3 行（`jz-clamp-3`）以保持列表可扫读，完整工艺在分项编辑页查看。
* 项目任务（`ProjectTask.craft`）本轮只改了生成时优先取报价行快照，**没有**改成快照列；任务工艺仍可被人工编辑。

### 业务规则沉淀

* 施工工艺属于报价快照的一部分：设计分项与报价行各自冻结，改材料库不得回溯历史报价；
* 员工端与业主端必须看到同一份 craft，不允许一边读快照、一边读主数据；
* 设计方案页的"设计风格/套内面积/户型"是辅助事实，卡片规格必须低于区块标题；
* 区域分组"全部可见"指的是**区域清单全部可见**，明细默认收缩、按需展开。

***

## FIX-010・设计方案/报价清单的分项看不到施工工艺、区域多了被横向 Tab 藏掉

* 日期：2026-09-24

* 报告角色：App 端实际使用反馈

* 影响模块：业主端 / 我的家 · 设计方案（owner-design）+ 我的家 · 报价清单（owner-quote）/ 共用组件 OwnerPriceGroups / 后端业主旅程投影

* 严重度：P2 信息展示不全（报价分项口径缺失 + 区域隐藏，影响业主核对与签单讲解）

### 现象

业主打开"我的家 · 设计方案 → 区域设计内容"或"我的家 · 报价清单 → 按区域查看报价"时：

1. 每个分项只显示"分类 · 品牌 · 规格"这类"是什么"的信息，**看不到"这活儿怎么做"的施工工艺**，业主无法判断报价高低的依据；
2. 区域用横向滚动 Tab 切换，只显示当前一个区域；**区域一多，后面的区域被滚出屏幕，既看不到也没有任何"还有更多"的提示**；
3. 需要逐一点 Tab 才能核对区域，区域一多就没法做整体核对（合计只在最底部出现）。

### 根因

1. 后端业主旅程投影 `CustomerJourney.PriceRow` 只有 `category/brand/spec/quantity/price/amount/role/type`，**根本没有工艺字段**；
   `CustomerJourneyContext.quoteGroups()/designItemGroups()` 也就没下发；`journey/info` 的 `@AllowProperties(PriceRow)` 白名单同样没有放开；
2. 工艺数据本身只在材料库主数据 `CatalogItem` 上：`craft`（施工工艺，@Lob）、`criterion`（工艺/验收标准，@Lob）；
   `DesignItem.applyCatalog()` 只快照了 `source.getCriterion()`，**没有快照 `craft`**；`QuoteLine` 更是没有自己的工艺列，只能经 `catalogItem` / `designItem` 关联取；
3. 两条关联（`DesignItem.catalogItem`、`QuoteLine.catalogItem`/`designItem`）都是 LAZY，而 `CustomerJourneyContext` 是无事务边界的 `@Component`，逐行访问会 N+1（关掉 OSIV 还会直接 `LazyInitializationException`）；
4. 前端 `OwnerPriceGroups.vue` 用 `scroll-view scroll-x` + `activeIndex` 一次只渲染一个区域，天然"展示不全"。

### 修复方案

**后端（只加不减，向后兼容）**
1. `CustomerJourney.PriceRow` 新增 `craft`（施工工艺）与 `criterion`（工艺/验收标准）字段；
2. `journey/info` 的 `PriceRow` 白名单放开 `craft`、`criterion`；
3. `CustomerJourneyContext` 新增 `craftOf()/criterionOf()`：`CatalogItem.craft/criterion` 优先，`DesignItem.criterion`（工艺说明快照）兜底；`designItemGroups()` 与 `quoteGroups()` 均写入；
4. `DesignItemRepository.findByDesign_DesignIdOrderBySortAsc` 加 `@EntityGraph(attributePaths = {"catalogItem"})`，
   `QuoteLineRepository.findByQuote` 加 `@EntityGraph(attributePaths = {"catalogItem", "designItem"})`，一次 JOIN 预取，避免 N+1 与 OSIV 依赖（ManyToOne 预取不会放大结果行）。

**前端**
5. `domains/journey` 的 `JourneyPriceRow` 与 `normalizePriceRow` 增加 `craft` / `criterion`；
6. `OwnerPriceGroups.vue` 重做：
   - **去掉横向 Tab**，改为"区域索引 + 全部区域卡片平铺、默认全展开"；
   - 区域索引平铺换行：`共 N 个区域 · M 项` + 序号胶囊（点按 `uni.pageScrollTo` 跳到对应区域卡）；
   - 每个分项把**施工工艺独立成块**：品牌色底 + 左侧 6rpx 色条 + 扳手图标 + "施工工艺"标签 + 整行换行正文；无工艺则整块隐藏；
   - `criterion` 以"验收标准：xxx"次要行展示；品牌/规格与数量移到底部一行，价格固定右上。

### 验证

* 后端：`mvn -o -DskipTests compile` 通过（`CustomerJourneyContext` / `CustomerJourney$PriceRow` 产物已重新编译）；
* 前端：`npx vue-tsc --noEmit` 通过；`npx uni build -p mp-weixin` 构建通过；
* 750rpx 版式走查（375px 视口，9 个区域 + 长工艺文案）：
  - 9 个区域胶囊自动换成 3 行、全部在容器内（`maxRight 786 < containerRight 816`），**页面无横向溢出**（`scrollWidth === clientWidth`）；
  - 施工工艺块宽 304（整行），长文案按 2 行换行展开，未被裁切；
  - 编译产物 `OwnerPriceGroups.wxml` 中区域卡 `id` 与 `bindtap` 正常下发。
* 回归关注点：无 `craft` 的老分项只少一个工艺块，不影响其余字段；`show-price=false`（设计方案页）时不出现金额，仅保留序号、区域名与项数。

### 待办 / 风险（不在本次范围）

* `DesignItem` 未快照 `CatalogItem.craft`：材料库改了工艺，历史设计分项会跟着变。若要严格"报价快照"，需给 `db_design_item` 加 `craft` 长文本列（@Lob + 迁移 `alter table ... modify column ... longtext`，参见 ECD-009），本次未做，已登记为后续事项；
* 员工端"方案编辑（scheme.vue）/ 报价详情（quote detail）"的 `QuoteItemRow` 仍未展示施工工艺（前端 `QuoteItem` 模型没有映射 `catalogItem.craft`），如需同步请另开一条。

### 业务规则沉淀

* 施工工艺与验收标准属于"业主应当看得懂的质量依据"，必须随分项下发并在业主端独立成块强调，不得塞进品牌/规格灰色小字；
* 设计分项与报价的区域分组一律全量平铺，禁止用横向滚动 Tab 把区域藏起来；
* 详细规则见 `business-rules.md` §10。

***

## FIX-009・量房档案日期直出 ISO 原文、量房记录卡片长文本被压成半栏

* 日期：2026-09-24

* 报告角色：App 端实际使用反馈

* 影响模块：业主端 / 我的家 · 量房档案（owner-measure）/ 项目旅程（journey）/ 现场照片留痕

* 严重度：P2 展示质量（信息可读性问题，不阻断主流程）

### 现象

业主打开「我的家 · 量房档案」时：

1. "最近量房"统计位、量房记录卡片时间、现场照片分组标题直接展示后端 ISO 原文 `2026-09-10T05:03:07`（带 `T`、带秒），既占宽又不像给人看的时间；
2. 量房记录卡片里"量房设计师""原始结构""尺寸记录"按 50% 两栏平铺，"原始结构"这类长文本被压成半栏，大面积换行、卡片高度失控、主次不分；
3. "需求：xxx / 结论：xxx"整行同色同字号，标签与内容分不清；
4. 卡片标题和右上角状态标签是同一句话（后端 `measureItem` 把 `title` 与 `statusName` 都设为状态名"已完成"），出现"已完成 … 已完成"的重复信息。

### 根因

1. `CustomerJourneyContext.date()` 直接 `value.toString()`，`LocalDateTime` 序列化后即 `2026-09-10T05:03:07`，前端 `normalizeItem` 原样透传，页面 `{{ item.date }}` 直接渲染；
2. `src/subpackages/project/pages/owner-measure.vue` 的 `.measure__fact { width: 50% }` 对所有事实一视同仁，没有区分"人"（短文本）与"房屋事实"（长文本）；
3. `src/components/owner/OwnerPhotoGrid.vue` 用 `item.time`（同样是 ISO 原文）直接做分组标题；
4. `src/subpackages/project/pages/journey.vue` 的项目旅程同样直出 `item.date` 与 `valueType === 'date'` 的事实值。

### 修复方案

1. `src/core/format.ts` 新增统一展示格式化：`dateTimeText()` → `2026-09-10 05:03`、`dateTimeShortText()` → `09-10 05:03`；兼容 `yyyyMMddHHmmss` / `yyyy-MM-dd`，非时间字符串原样返回（`—` 不丢）；
2. `owner-measure.vue` 记录卡片改版：
   - 时间走 `dateTimeText()`，统计位走 `dateTimeShortText()`；
   - "量房设计师"升级为头像卡（`JzAvatar` + 姓名）；其余事实改为"标签 + 整行可换行长文本"，`原始结构`/`尺寸记录` 不再被半栏挤压；
   - "需求 / 结论"按全角冒号拆成标签胶囊 + 正文；
   - 标题栏加序号徽标与状态标签（`JzTag`），区块标题加品牌渐变竖条，空态加图标底座；
   - `title` 与 `statusName` 同名时收敛为业务名词"量房记录"，状态只由标签表达，消除重复；
3. `OwnerPhotoGrid.vue` 分组标题走 `dateTimeText()`（分组键仍保留原始值，避免合并不同批次）；
4. `journey.vue` 的 `valueType === 'date'` 事实与条目日期同样走 `dateTimeText()`。

### 验证

* `npx vue-tsc --noEmit`：通过；
* `npx uni build -p mp-weixin`：构建通过（仅 sass legacy API 既有告警）；
* 750rpx 版式走查（375px 视口）：`.measure__fact-value` 长文本整行换行（宽 240 / 高 68），页面无横向溢出（`scrollWidth === clientWidth`），日期统计位单行不裁切；
* 回归关注点：日期为空或为 `—` 时仍显示占位文案，不出现 `Invalid Date` / `undefined`。

### 业务规则沉淀

* 业主可见的时间一律以 `YYYY-MM-DD HH:mm` 呈现，禁止把后端 ISO 原文、时间戳或 `yyyyMMddHHmmss` 直接暴露给业主；窄栏位可用 `MM-DD HH:mm`。
* 量房记录卡片中，"人"的事实（量房设计师）用头像卡突出，"房屋事实"（原始结构、尺寸记录）整行铺开换行，禁止把长文本压进两栏网格。

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
