# th4-decoboon-app · 工程架构与接口对接

> 基线：`docs/装得清整体业务体系设计说明书.md`、App `AGENTS.md`、`rules.md`  
> 目标：角色、业务领域、页面、功能四层边界清晰，页面不承载持久化逻辑，接口按领域独立演进。

## 1. 分包原则

```text
角色 role      → 决定工作台、Tab 和可见入口
业务领域 domain → 决定实体、元数据、权限语义和 Provider 路由
页面 page      → 决定视图与交互，只调用领域 API
功能 function  → 表示 save/update/list/info/report/confirm 等领域能力
```

统一依赖方向：

```text
pages → domains/*/api + domains/*/model + roles/permission
domains/*/api → core/http
roles/catalog → page path constants
```

禁止：

- 页面直接 `uni.request` 或拼 Provider 地址。
- 在页面里维护业务状态机或本地持久化。
- 将客户、项目、任务、验收等实体继续堆入单一 `types.ts`。
- 使用角色字段直接替代服务端租户、项目成员和数据归属校验。

## 2. 目录与职责

```text
src/
├── config/                 # apiBase、tokenKey、页面路径 P
├── core/                   # HTTP 协议、上传、格式化
├── roles/
│   ├── catalog.ts          # ROLE_META、ROLE_TABS、ROLE_ACTIONS
│   └── permission.ts       # Capability 与前端矩阵
├── domains/
│   ├── identity/           # Employee、Company、Invite、Session
│   ├── common/             # Page<Entity>
│   ├── crm/                # Customer、CustomerFollow、Lead、Measure
│   ├── base/               # StageTemplate、Zone、CraftTask/WorkItem
│   ├── trade/              # Quote、Contract、ContractChange
│   ├── project/            # Project、ProjectStage、ProjectMember、Scope
│   ├── schedule/           # SchedulePlan、Task、TaskNode、DailyReport
│   ├── site/               # SiteReport、SiteIssue
│   ├── acceptance/         # Acceptance、AcceptanceConfirm 语义
│   ├── material/           # MaterialPlan
│   ├── finance/            # Receivable、Receipt、Expense、Settlement
│   ├── collab/             # Notice、Attachment、Activity
│   └── statistic/          # WorkbenchReport、DashboardReport
└── pages/                  # 路由页面，保留现有 28 页路径
```

每个领域最小结构：

```text
domains/crm/
├── model.ts
├── meta.ts
└── api.ts
```

有状态或复合行为时增加 `scope.ts`、`repository.ts` 等领域内文件，但页面仍只依赖该领域的公开 API。

## 3. 角色与页面

### 3.1 当前角色

| RoleKey | 页面重点 | 关键权限 |
| --- | --- | --- |
| `boss` | 全局指标、项目、客户、团队、消息、审批 | 全公司项目、团队、财务、审批 |
| `marketer` | 客户登记、电话/微信跟进、待量房交接 | 客户跟进，不参与报价/合同/施工 |
| `designer` | 客户、项目、施工计划、排期、验收协作 | 计划编排、施工项下发 |
| `pm` | 项目、阶段、任务、节点、汇报、验收提交 | 施工推进、节点留证 |
| `supervisor` | 项目、巡检、问题整改、质量复核 | 巡检、整改、验收复核 |
| `purchaser` | 材料计划、采购、到场 | 材料执行 |
| `warehouse` | 库存、领用、退料、盘点 | 库存执行 |
| `finance` | 应收、收款、支出、应付、结算 | 财务范围 |
| `customer` | 我的家、进度、动态、验收确认 | 仅本人项目公开数据 |

后续角色增加时先修改 `EmployeeRole`、`ROLE_META`、`ROLE_TABS`、`ROLE_ACTIONS` 和权限矩阵，再增加领域页面；不要在页面中散落角色 `if/else`。

### 3.2 页面归属

| 页面目录 | 领域 | 当前能力 |
| --- | --- | --- |
| `pages/auth/*` | identity | 登录、企业注册、员工/业主邀请 |
| `pages/index` | statistic + 多领域聚合 | 角色工作台 |
| `pages/mine` | identity | 会话、企业、团队入口 |
| `pages/customer/*` | crm | 客户列表、详情、编辑、跟进 |
| `pages/project/*` | project | 项目、成员、工地相册、业主邀请 |
| `pages/stage/detail` | project | 项目阶段详情与开工 |
| `pages/task/*` | schedule | 施工任务与三节点 |
| `pages/report/*` | site + schedule | 现场汇报与施工日报 |
| `pages/accept/edit` | acceptance | 阶段验收提交/客户确认 |
| `pages/team/*` | identity | 员工与邀请 |
| `pages/msg/list` | collab | 站内消息 |

## 4. Provider 路由规划

### 4.1 后端已有资产

| Provider 路由 | 当前能力 |
| --- | --- |
| `user/sms/send`、`user/login`、`user/info`、`user/register`、`user/invite`、`user/accept` | 用户、企业注册、员工邀请 |
| `customer/customer/{page,info,save,update}` | 客户基础 CRUD、状态与业务字段维护 |
| `customer/customer-follow/{page,save}` | 客户跟进时间线 |
| `project/project/{page,info,save,update}` | 项目主档 |
| `project/stage/{page,info}` | 项目阶段分页与详情 |
| `project/task/{page,info,update}` | 施工任务查询、详情与状态推进 |
| `project/acceptance/{page,save,update}` | 验收单 |
| `trade/quote/{page,info,save,update}`、`quote-item/page` | 报价 |
| `project/material-plan/{page,update}` | 项目材料计划 |

App 当前按设计书的目标域调用。`customer/customer`、独立 schedule/task-node/report、collab、finance、statistic 等路由需要在后端按第 4.2 节补齐；过渡期可在 Provider 网关做路由别名，但不要长期保留两套业务实现。

### 4.2 目标路由

App 已按设计书目标路由调用，以下 Provider 需继续实现或补齐：

| 领域 | 路由 |
| --- | --- |
| identity | `user/employee/page`、`user/invite/page`、`identity/customer-invite/save`、`identity/customer/accept` |
| crm | `customer/customer/{page,info,save,update}`、`customer/customer-follow/{page,save}`、`customer/measure/{page,info,save,update}` |
| base | `bim/construction/{page,info,enums}`、`bim/zone/{list,save,update}`、`base/stage-template/list` |
| trade | `trade/quote/*`、`trade/contract/*`、`trade/contract-change/*`、`trade/contract-sign/*` |
| project | `project/member/{list,save,update}`、`project/site/{page,info,save,update}`、`project/stage/info` |
| schedule | `project/schedule/{page,info,save,update}`、`project/schedule-item/*`、`project/task/{info,save,update,delete}` |
| task node | `project/task-node/{list,save,update}` |
| site | `project/report/{page,list,save,update}`、`project/issue/*`、`project/rectification/*`、`project/inspection/*` |
| acceptance | `project/acceptance/info`、`project/acceptance-item/*`、`project/acceptance-confirm/save` |
| material | `material/{material,plan,request,purchase,arrival,use,inventory}/**` |
| finance | `finance/{receivable,receipt,expense,payable,payment,settlement,ledger}/**` |
| collab | `collab/notice/{page,update,count}` |
| statistic | `statistic/marketer/report`、`statistic/{workbench,dashboard,project-health,finance,material,quality}/report` |

> 业务动作优先保存对应实体，由后端监听器/服务推进状态。例如客户确认验收保存 `AcceptanceConfirm`，不要在前端直接改下一阶段状态。

## 5. 当前实体字段兼容说明

设计书要求的迁移原则是保留页面、逐步替换数据源。当前 App 领域模型使用稳定的前端语义字段，后端 Provider 应对齐以下目标：

| App 字段 | 后端目标 |
| --- | --- |
| `Project.id` | `projectId`，由 API 边界或序列化层统一 |
| `Project.address/community` | `Site.address/community` |
| `Project.contractAmount` | `Contract + ContractChange` 派生 |
| `Project.paidAmount` | `Receipt/ReceiptAllocation` 派生 |
| `ProjectStage.projectId` | `ProjectStage.project.projectId` 扁平化 |
| `Task.projectId/stageId` | `Task.project.projectId`、`Task.stage.stageId` |
| `Task.craft/spec/unit/quantity` | `WorkItem` 快照 + `Task` 实例 |
| `Task.nodes` | `TaskNode + TaskMedia` 聚合 |
| `Acceptance.customerStatus` | `Acceptance.status + AcceptanceConfirm` 聚合 |

短期可以由 Provider 返回兼容字段；正式领域上线后，再按迁移顺序移除扁平 ID 和派生冗余字段。API 边界只做字段协议适配，不在页面创建 VO/DTO。

## 6. 接口对接顺序

1. 完成 identity：员工分页、邀请分页、业主邀请/接受，打通真实登录与角色进入。
2. 完成 customer/customer-follow 与 bim/construction、zone，保证客户转化和设计师排期。
3. 完成 project/member、stage/info、task 全能力与 task-node，实现“排期 → 节点 → 日报”。
4. 完成 report、interaction、acceptance-confirm，实现“提交 → 客户确认 → 推动阶段”。
5. 按设计书顺序追加 contract、material、finance、statistic；每增加一个领域只新增 `domains/<domain>` 与对应页面，不修改其他领域的内部实现。

## 7. 联调验收点

- 登录后 `session.emp.role` 能正确映射到 `RoleKey`，Tab 按角色变化。
- 所有列表接口统一消费 `Page<Entity>`，由 `src/core/http.ts` 的 `listOf` 解包。
- 客户侧接口不返回成本、供应商、内部备注、其他项目。
- 阶段验收确认后由后端推动阶段/任务状态，前端只重新拉取数据。
- 页面刷新、下拉刷新、返回后 `onShow` 均能重新获取 Provider 数据，不依赖本地缓存状态。
- `npm run type-check`、`npm run build:mp-weixin` 通过。

## 8. 业务错误处理约定

后端业务异常统一返回 HTTP 200 + `{success:false,errorCode:{code,message}}`，不能把
`success:false` 当作成功数据继续消费。`src/core/http.ts` 会将其转换为 Promise
reject；页面必须在异步动作边界使用 `try/catch`，并通过 `toastError(error, fallback)`
展示后端 `message`。列表初始化等非点击动作也不能遗漏 `catch`，否则会出现页面无响应。
