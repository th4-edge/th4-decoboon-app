# DQ-X3 / DQ-X4 / DQ-X5 · App 方案模版真实页面验收

- 日期：2026-10-30
- 结论：**微信开发者工具原生小程序功能链路 PASS**
- 状态：`FUNCTIONAL_DEVTOOLS_VERIFIED`
- 物理真机：`NOT_RUN_NO_CONNECTED_DEVICE`
- 视觉：`MACHINE_PRECHECKED_HUMAN_REVIEW_PENDING`
- 运行环境：微信开发者工具 iPhone 16 模拟器，393×754，DPR 3，SDK 3.17.5
- 后端：本地 `http://127.0.0.1:8090/api`
- App：`dist/dev/mp-weixin`
- 操作账号：临时本地员工「验收设计师 / Designer」
- 原始结果：`run.json`

## 覆盖结果

| 链路 | 结果 | 核心证据 |
| --- | --- | --- |
| 模板库空态、筛选与新建入口 | PASS | `raw/screenshots/01-template-list-empty.png` |
| 新建模板基础信息与草稿回读 | PASS | `03-template-draft-editor.png` |
| 区域新增、参考面积/周长回读 | PASS | `04-template-room-sheet.png`、`05-template-room-saved.png` |
| 报价项目选择、归属区域、公式保存 | PASS | `06-template-catalog-picker.png`、`07-template-item-sheet.png` |
| 发布二次确认、发布后只读 | PASS | `09-template-publish-confirm.png`、`10-template-published-readonly.png` |
| 模板详情无价格、实例化并回读方案 | PASS | `32-template-detail-final-verified.png`、`33-design-scheme-final.png` |
| V2/V3 新版本及幂等复用 | PASS | `15-template-v2-draft.png`、`19-template-v3-draft.png`、`raw/api/03-*`、`04-*` |
| 复制为个人草稿 | PASS | `18-template-copied-draft.png` |
| 停用、全部状态可见、已停用筛选 | PASS | `20-*`、`21-*`、`22-*` |
| 非维护者无维护动作 | PASS | `29-template-non-maintainer-actions.png` |
| 空公式、错误单位、引用区域删除阻断 | PASS | `24-*`、`25-*`、`26-*`、`27-*` |
| 缺房屋上下文阻断实例化 | PASS | `28-template-no-property-blocked.png` |
| 最终列表/详情/方案 console error=0 | PASS | `raw/console-errors.json` |

## 真实页面发现并修复

1. `template-edit` 未挂载 `JzConfirmDialog`，发布、删除区域和删除分项点击后没有确认反馈。
2. `template-detail` 直接显示内部枚举 `Bedroom`，已映射为“卧室”等业务文案。
3. 新版本和复制模板漏复制 `referenceArea/referencePerimeter`，已修复并补定向测试。
4. 编辑器/详情把模板主档“已发布”压过当前版本“草稿/停用”，已改为读取当前版本状态。
5. 模板分页“全部状态”默认排除已停用，已改为真正全部状态；已停用筛选可命中。
6. 模板详情接口白名单仍返回销售价格字段，已从模板相关 Provider 移除 `materialPrice/manualPrice/fixedTotalPrice`，并补白名单契约测试。
7. 详情页英文 eyebrow `DESIGN TEMPLATE` 改为“方案模版”。

## 验证

- App `type-check`：PASS
- App `check:design-items`、`check:navigation`、`check:ui`、`check:client-copy`：PASS
- App 小程序构建：PASS；主包 1,077,077 B，最大分包 734,997 B，总包 4,223,451 B，180 页
- 后端定向测试：`DesignTemplateWhitelistContractTest`、`DesignTemplateVersionCopyTest`、`DesignTemplateInstantiateInheritanceTest`、`DesignTemplateFormulaContextTest`：PASS
- 模板响应价格/成本字段检查：PASS（`raw/api/07-*`、`08-*`）
- 方案事实：主卧参考面积 20㎡、周长 18m，方案工程量保持待实测，金额为 0，不生成伪利润

## 视觉评审

使用本地 `qwen2.5vl:7b` 视觉桥完成两轮机器预检：

- `visual-review/core-flow-qwen25vl-7b.md`
- `visual-review/lifecycle-qwen25vl-7b.md`

7B 模型能读取截图，但多图状态评审出现误判，因此只能作为预检，不替代人工或更强视觉模型的最终视觉签字。

## 数据清理

- 清理状态：PASS
- 备份：`~/.decoboon-local/template-acceptance-20261030/before.sql`
- SHA-256：`e9a087c787604a82cca82731894673aa1d2eaeca962ce98d22b6c6e8e0f1f692`
- 清理证据：`raw/db/cleanup.txt`
- 与备份基线对比：30 张相关表计数一致，0 mismatch（`raw/db/baseline-compare.txt`）

## 边界

- 本次为微信开发者工具原生小程序真实渲染，不是物理手机运行；不声明物理真机通过。
- 未提交 Git、未上传体验版、未发布正式版。
- 视觉结论待人工/更强视觉模型复核。
