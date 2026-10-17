# App 1.0.54 · 主材下单作业单走查与发布门禁

- 日期：2026-10-17
- 结论：**PASS**（主材下单作业单可用；测试单据已清理）
- App：`1.0.54` / versionCode `154`
- 运行环境：微信开发者工具，development 走查包指向生产 API（仅走查使用；正式上传使用 `dist/build/mp-weixin`）
- 操作人：张伟（Boss，昭青网络）
- 测试项目：李思远 · 华润凯旋门9栋1601
- 测试来源计划：`236266511365308416`（瓷砖--马可波罗400*800（展厅款），46㎡）
- 测试作业单：`1792203811236229974`（厂家标注“验收走查-…”）
- 自动脚本：`scripts/material-sheet-walkthrough.mjs`
- 原始步骤结果：`walkthrough.json`

## 覆盖结果

| 项 | 结果 | 证据 |
| --- | --- | --- |
| 空列表 → 建单页加载 9 条材料计划 | PASS | `screenshots/a0-list-before.png`、`screenshots/b1-create.png` |
| 未填安装位置时保存被前端阻断 | PASS | `walkthrough.json` |
| 保存草稿 → 详情页回读项目、厂家、材料行 | PASS | `screenshots/c1-detail-draft.png` |
| 作业单详情不显示价格/金额/账期 | PASS | `c1-detail-draft.png`；Excel 文本校验无价格字段 |
| 测量/配送/安装日期回填 | PASS | `screenshots/c2-detail-measured.png` |
| Excel 导出为有效 xlsx，含签字行且不含价格 | PASS | `export/TILE-20261017-001-Tile下单表.xlsx` |
| 提交请购后状态“待下单”，明细仍为 1 行 | PASS | `screenshots/c4-submitted.png` |
| 列表按“待下单”分组展示时间与厂家 | PASS | `screenshots/a3-list-submitted.png` |
| App 提交后 Web 财务下单队列可见 | PASS | Web 验收记录 `20261017-material-order-web` |

## 本轮发现并修复

1. **P0 行来源字段不匹配**：App 传 `materialPlanId`，后端实体关联要求 `materialPlan.planId`，保存时报“作业单行必须来源材料计划”。已统一在 API 层转换。
2. **P0 详情页竞态空白**：枚举 Promise 提前引用尚未赋值的 `detail`，可能导致详情页空态。已改为并行取数后统一组装。
3. **P0 提交后明细丢失**：提交/测量后用部分响应覆盖本地详情，`items` 为空。已改为成功后重新读取 `material/sheet/info`。
4. **P0 项目/房屋/来源计划未投影**：后端响应缺少追溯关联，App 显示“工程—”，Web 显示“未关联项目”，编辑无法恢复来源计划。已补投影并在事务内初始化关联。

## 数据清理

- 走查后先将测试单状态置为 `Cancelled`，再通过 `material/sheet/delete` 删除。
- 最终生产核验：`db_material_order_sheet = 0`、`db_material_order_sheet_item = 0`。
- 删除前备份见后端工作区 `docs/acceptance/runs/20261017-material-sheet-app-release/cleanup/`。

## 未覆盖

- 测量日期通过真实 Provider 写入并回读 UI；日期选择器的原生弹窗点击未做自动化。
- 图片/附件选择属微信原生能力，本轮未测试。
- 真实供应商下单、应付与结算不在本走查范围，避免在真实项目制造资金事实。
