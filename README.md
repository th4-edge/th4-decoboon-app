# th4-decoboon-app · 装得清（装得清小程序端）

> 面向中小家装企业的微信小程序。以 **项目/工地履约** 为业务枢纽，按角色开放工作台与功能入口，覆盖客户转化、施工排期、任务节点、现场汇报、验收确认和后续材料/财务扩展。

- 技术栈：**uni-app + Vue 3 + TypeScript + Vite**
- 构建目标：**微信小程序（mp-weixin）**、H5
- 品牌主色：`#16A394`
- 数据来源：全部通过 `src/domains/*/api.ts` 调用 th4 Provider，不再包含本地演示数据

## 快速开始

```bash
npm install
npm run dev:h5
npm run dev:mp-weixin
npm run build:mp-weixin
npm run type-check
```

默认网关前缀为 `/api/`，可通过 `.env` 的 `VITE_API_BASE` 覆盖。Provider 响应约定为 `{ success, data, errorCode }`。

## 小程序自动操作与官网录屏

官网短视频、产品演示和过程录屏统一使用微信开发者工具中的真实小程序，不使用 Web、H5、接口回放或 Mock 冒充。

```bash
# 无视频演练
npm run record:site:dry -- --reuse-session

# 自动操作 + 微信开发者工具窗口录屏 + 1080p 竖版干净帧视频
ZHUANGDEQING_RECORD_DEV_TOKEN="<本地测试员工 devToken>" MP_PROJECTID="<本地测试项目ID>" npm run record:site
```

完整说明、场景配置和业主同频录屏见 `scripts/recording/README.md`。录制默认只使用专用测试环境，有副作用的动作必须单独授权。

## 工程结构

```text
src/
├── config/                    # 运行时配置、页面路径常量
├── core/                      # HTTP/上传/格式化等跨领域技术能力
├── roles/                     # 角色元信息、Tab 映射、前端权限矩阵
├── domains/
│   ├── common/                # Page<Entity> 等通用领域协议
│   ├── identity/              # 企业、员工、邀请、登录会话
│   ├── crm/                   # 线索、客户、跟进、量房
│   ├── base/                  # 阶段模板、区域、工艺/施工项主数据
│   ├── trade/                 # 报价、合同、合同变更
│   ├── project/               # 项目、工地、阶段、项目范围
│   ├── schedule/              # 排期、任务、任务节点、日报
│   ├── site/                  # 现场汇报、问题、整改
│   ├── acceptance/            # 阶段验收、客户确认
│   ├── material/              # 材料计划与供应链
│   ├── finance/               # 应收、收款、应付、付款、工资、台账、结算
│   ├── collab/                # 项目成员、消息、附件、活动时间线
│   └── statistic/             # 工作台、经营看板、质量/财务报表
├── components/                # 品牌化通用组件
├── composables/               # 系统信息、提示等组合式能力
└── pages/                     # 按业务域拆分的路由页面
```

每个业务域采用 `model.ts + api.ts + meta.ts` 的稳定结构：

- `model.ts`：前端直接消费的领域实体，不做 VO/DTO 包装。
- `api.ts`：该领域对 th4 Provider 的调用边界。
- `meta.ts`：该领域枚举的中文标签与状态色。

## UI 设计体系

- 全局 Token：`src/uni.scss`
- 基础布局、卡片、表单、按钮和状态样式：`src/styles/base.scss`
- 统一线性图标：`src/components/JzIcon.vue`
- 完整 UI、交互、布局和页面验收规范：[`docs/03-视觉与设计规范.md`](./docs/03-视觉与设计规范.md)

页面必须复用统一的 Header、TabBar、Card、Button、Tag、Empty 和 Icon 体系，禁止继续使用 emoji 或散落字符图标。

## 角色与信息架构

同一小程序内按登录员工/业主身份切换工作台和 Tab：

| 角色 | Tab 入口 |
| --- | --- |
| 老板 | 工作台 / 项目 / 动态 / 我的 |
| 门店店长 | 工作台 / 客户 / 项目 / 我的；含设计调度、门店报价、团队、通知和业绩 |
| 家装顾问 | 工作台 / 客户 / 项目 / 我的 |
| 设计师 | 工作台 / 客户 / 项目 / 我的 |
| 项目经理 | 工作台 / 项目 / 动态 / 我的 |
| 监理 / 采购 / 仓管 | 工作台 / 项目 / 动态 / 我的，后续按领域页面继续收紧 |
| 财务 | 工作台 / 财务 / 项目 / 我的；含应收、收款、应付、付款、工人工资、资金台账和项目结算 |
| 业主 | 我的家 / 进度 / 动态 / 我的 |

Tab 与工作台快捷入口配置集中在 `src/roles/catalog.ts`，权限矩阵集中在 `src/roles/permission.ts`。前端权限只负责可见性和交互提示，服务端必须继续执行租户、项目成员和数据归属校验。

## 接口对接入口

页面不直接拼接口地址，统一调用对应领域 API：

```ts
import { crmApi } from '@/domains/crm/api'
import { scheduleApi } from '@/domains/schedule/api'
import { siteApi } from '@/domains/site/api'
```

登录、邀请、项目、阶段、任务、汇报、验收等具体路由映射与后端缺口见
[`docs/04-App工程架构与接口对接.md`](./docs/04-App工程架构与接口对接.md)。

## 财务域实现

财务角色进入 `/pages/finance/index` 工作台，覆盖以下页面和 Provider：

- 资金闭环：应收计划 -> 客户收款 -> 资金台账 -> 应付账款 -> 业务付款。
- 业务分类：首期款/进度款/尾款/质保金、材料款、工人工资、项目款、供应商款和费用支出。
- 项目视图：按项目汇总合同、实收、应收、应付、实付、成本构成、预计利润与结算状态。
- 权限边界：老板和财务可写，店长按门店只读，服务端 Provider 强制校验企业和项目归属。
- 不可变流水：收款、付款和手工记账统一归集到 `finance/ledger`，不通过更新或删除修改历史资金事实。

完整业务状态、Provider 路由与结算条件见后端工程 `docs/design/08-财务域业务闭环设计.md`。

## 发布

生产小程序使用以下命令完成法务门禁、类型检查、构建和分包校验：

```bash
npm run build:mp-weixin:release
```

构建产物位于 `dist/build/mp-weixin`。发布记录见 `docs/16-微信小程序发布记录-2026-09-16.md`。

微信公众平台的 `request` 与 `uploadFile` 是两套独立合法域名。正式发布前必须确认 `https://decoboon.joytsing.com` 同时加入 request、uploadFile 和 downloadFile 合法域名，排查步骤见 [`docs/18-生产上传域名排查.md`](./docs/18-生产上传域名排查.md)。
