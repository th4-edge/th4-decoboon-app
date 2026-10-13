# 增减项「发起页」App 端走查（微信开发者工具 + 本地 dev 后端）

- 时间：2026-10-13 09:05 / 10:00 CST｜环境：`dist/dev/mp-weixin`（`VITE_API_BASE=http://127.0.0.1:8090/api/`）× 本地 dev 后端
- 身份：设计师 `13910000111`（`devToken` 注入登录）；项目 `王芳（造数1100）· 望江府1栋102`；合同 `C1791842081135`
- 驱动：`miniprogram-automator`（DevTools CLI）；截图见 `screenshots/`（首轮，减项路径）与 `screenshots2/`（本轮，新增分项路径）

## 一、修复验证：工程量输入（P0）

**根因（已更正）**：并非 `v-model` 覆盖，而是 **App 的 `previewContractChange`（`domains/trade/api.ts`）入参类型与载荷漏传 `targetQuantity`**，只映射了 `targetCatalogItemId / reduceQuantity / newQuantity`；`batchSaveContractChange` 有该字段。服务端试算收到的目标工程量为空 → `ContractChangeTargetContext` 抛「工程量必须大于 0」→ 页面因「试算未通过不能提交」而卡死。
**修复**：`previewContractChange` 补齐 `targetQuantity`（类型 + 载荷映射）。

| # | 操作 | 实测结果 | 证据 |
| --- | --- | --- | --- |
| 1 | 打开发起页 | 顶部「发起增减项 · 一张单说清」，动作三段（新增分项/减项/替换）、底部动作条 | app-1-open.png |
| 2 | 切「减项」 | 卡片提示「请选择来源分项」 | — |
| 3 | 打开来源选择器 | **8 条来源**，逐条显示「当前有效剩余 9m² · 待审批占用 1m² · 可变更 8m²」 | app-5-source-sheet.png |
| 4 | 选来源（水电--强电布线） | 来源卡显示剩余/占用/可变更；提示变「请填写工程量」 | — |
| 5 | **输入工程量 2** | **本条差额 −¥76**，汇总「本次变更 −¥76 / 变更后合同额 ¥802」 | app-6-qty-2.png |
| 6 | 输入工程量 99（超量） | 差额回到「待试算」，行内提示「**超过可变更量 8m²**」 | app-7-over-qty.png |
| 7 | 选「主材--实木复合地板」来源 | 显示「可变更 0m²」（已被整项替换关闭）→ 不可变更 | app-5-source-sheet.png |

## 二、本轮补齐：新增分项完整路径（`screenshots2/`）

| # | 步骤 | 实测结果 | 证据 |
| --- | --- | --- | --- |
| 1 | 打开发起页 | 默认 1 条「新增分项」明细（`onLoad` 自动预置），动作段高亮「新增分项」；行内提示「请从报价项目库选择目标分项」 | 01-open-default-row.png |
| 2 | 打开目标分项面板 | 6 个类型 chips（施工/主材/全屋定制/软装/电器/综合）；**3 条**报价项目库条目，逐条显示「项目库单价 ¥7/㎡（人工 ¥7）」等 | 02-target-picker.png |
| 3 | 选目标分项 | 目标卡变「拆除--墙顶面白灰/腻子粉铲除 · 报价项目库目标分项」；提示变「请填写工程量」 | 03-target-picked.png |
| 4 | **输入工程量 3** | **本条差额 +¥20**，汇总「本次变更 +¥20 / 变更后合同额 ¥898」；无「工程量必须大于 0」 | 04-qty-3-preview.png |
| 5 | 追加第 2 条 | 卡片 2 张；待补提示「还有 1 条明细未补全：第 2 行 请从报价项目库选择目标分项」（多项列表可读） | 05-multi-row-pending.png |
| 6 | 删除一条 | 卡片 2 → 1（删除为可点红色胶囊，不再像置灰） | 01-a-two-rows.png / 02-a-after-delete.png |
| 7 | 补变更原因 → 提交 | 提交按钮由禁用变可点；提交成功后跳转 `change-detail` | 03-b-ready-submit.png / 04-c-after-submit.png |
| — | 服务端对账 | 生成变更单 **`BC1791856822457`｜待审批｜amount=+20.4｜costDelta=+13.5｜1 条明细**（`project/contract-change/page`） | — |

## 三、本轮结论

- App「新增分项」路径**闭环打通**：预置明细 → 选目标（项目库，含单价）→ 填工程量 → 服务端试算出金额 → 补原因 → 提交为「待审批」。
- 附带修复：`.cc__card-del` 由 `text-3` 灰色文案改为 **danger 胶囊**（消除「删除置灰」的误读）。

## 四、仍待办（非本轮）

- App 端「审批」页面动作（通过/驳回）未走真机；审批已在 Web/API 侧完成（见 `ACCEPT-20261013-002`）。
- 来源选择器的区域分组依赖合同行 `space_name`，当前 dev 造数合同行区域为空 → 只验到「未标注区域」分组。

## 五、方法论更正（automator 不穿透自定义组件）

- 此前判「共享组件 `CatalogPicker` 在 App 端不渲染」**不成立**。探针实测：JzSheet 打开后，其**自有根 class `.jz-sheet` 计数为 0**、`.jz-sheet__panel`/`.jz-sheet__title` 亦为 0；而同屏 **slot 投影到页面的** `.cc__chip--target`=6、`.cc__picker-item--target`=3；逻辑层 `createSelectorQuery` 同样只返回 3。
- 结论：`miniprogram-automator` 的 `page.$/$$` 与逻辑层 `createSelectorQuery` **都不查询自定义组件内部节点**（只查页面自身 wxml，含 slot 投影内容）。用「组件自有 class 计数」判定组件是否渲染会得到**假阴性**。
- 影响：目标分项改用页面内 `JzSheet` 自建选择器，**理由是贴合原型**（类型 chips + 逐条项目库单价），并非 `CatalogPicker` 损坏；两者逻辑重复待专项收敛。
