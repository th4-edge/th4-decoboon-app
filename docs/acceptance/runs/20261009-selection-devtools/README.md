# 主材选材 微信开发者工具走查（DEC-056）— 结果

- 日期：2026-10-10（跨 10-09 夜）
- 环境：微信开发者工具（Mac，项目=装得清，`dist/dev/mp-weixin`）；本地 dev 后端 `127.0.0.1:8090`；测试企业 昭青装饰
- 登录员工：董夏鹏（设计师，手机 19900000005 本地测试密码 123456）
- 通道：`miniprogram-automator`（渲染文本断言）+ `cua_repl`（原生弹窗点击）
- 脚本：`th4-decoboon-app/scripts/selection-walkthrough.mjs`、`selection-list-deliver.mjs`

## 结论

| 目标 | 结果 | 证据 |
| --- | --- | --- |
| 列表页渲染新口径 | PASS | 按钮「材料计划 / 一键交付财务下单」；进度「已选材/已交付」；筛选项「待选材/已选材/已交付/已进入采购」 |
| 单项页去除草稿/客户确认/客户姓名 | PASS | 动作仅「保存 / 保存并交付」；状态仅「待选材 / 已选材」 |
| 待选材 → 保存 → 已选材 | PASS | `status: 待选材/未下单` → 保存后 `已选材/未下单`，文本回显录入内容 |
| 保存并交付 → 待财务下单 | PASS | `已选材/待财务下单`，页面提示「已交付财务下单，等待财务确认」；DB `db_material_plan.status=ReadyToOrder` 且 `selection_id` 绑定新选材 |
| 列表「一键交付财务下单」 | PASS | 有待交付项时按钮可用；点按弹出确认「将把 1 项已选材交付财务下单…」→ 点「确认交付」→ 按钮变 disabled，计数「已交付 1」，卡片变「待财务下单 / 等待财务下单」；DB 校验 `ReadyToOrder` |
| 多图上传（UI） | BLOCKED_NATIVE_PICKER | `chooseMedia` 打开系统相机/相册，automator/CUA 无法驱动；多图上传+回读已由接口冒烟验证（`docs/acceptance/runs/20261009-selection-api-smoke/`） |
| 真机走查 | NOT_TESTED（需真机） | 需物理手机 + 微信扫码；相机/相册属真机能力 |

## 关键过程说明

1. **lite vs full**：先试 `windowMode=fullMode`（`cli quit` → `cli open --project`），automator 导航仍不稳定；根因不是 lite 模式，而是 **App 未登录**时选材页 `onLoad` 直接 `reLaunch(登录页)`，导致 automator 页面栈错乱。
2. **登录态**：App 仅支持微信手机号快捷登录；会话 `jzb_session_v2` 在模块加载时一次性 `restore()`。人工完成一次登录后，automator 可正常进入选材页。
3. **token 失效**：走查期间后端被并发进程多次重启，App 内旧 token 失效。做法：用本地测试密码重新签发同员工 token 并写回 `jzb_token`（HTTP 层每次请求读 storage），不重启小程序即可继续；**未做跨员工凭证切换或角色伪装**。
4. **渲染断言**：小程序构建产物 data 键被压缩，改用渲染文本（`.msi__status` / `.msi__actions button` / `.msd__overview-value`）断言。
5. **原生弹窗**：`uni.showModal` 不在页面 DOM，用 CUA 可访问性树点击「确认交付」。

## 数据

- 走查目标：项目 `233710289445453824`（彭静（演示30）），主材分项 `233710002844467203`（石材--管仲新三层地板 1.4）
- 最终：`db_material_plan.plan_id=233710289621614592` → `ReadyToOrder`；`db_material_selection.selection_id=234344485339791360` → `Selected`，内容「颜色/花色：浅灰哑光；规格/型号：600×600；品牌/系列：东鹏；工艺：防滑」
- 走查前为可重复覆盖"待选材"起点，已备份并重置该分项（`docs/acceptance/runs/20261009-selection-api-smoke/backup-selection-234339482512392192.sql`）
