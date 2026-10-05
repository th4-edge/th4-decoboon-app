# App（微信小程序）签约工作台回归 · 2026-10-06

- 环境：微信开发者工具 2.02.2609231，项目 `dist/dev/mp-weixin`（**本机临时把 dev API 指向生产** `https://decoboon.joytsing.com/api/`）
- AppID：wxe5cc5fec9e50a9a9
- 自动化：`cli auto --auto-port 9420` 已启用，`miniprogram-automator` 已成功连接并读到 `pages/index/index`

## 已完成的 App 侧修复（与本轮 Web 角色矩阵对齐）

`src/subpackages/project/pages/sign-workbench.vue`：

| 位置 | 修改前 | 修改后 |
| --- | --- | --- |
| `goSign()` 分支 | 仅 `session.role === 'boss'` 可进入建项目/签约 | `canSign`（boss **或** storeManager） |
| 页头标题 | `boss ? '企业合同签约' : '签约工作台'` | `canSign ? '企业合同签约' : '签约工作台'` |
| 行内动作文案 | `boss ? '去签约' : '查看报价'` | `canSign ? '去签约' : '查看报价'` |
| 拦截提示 | 「请联系企业负责人完成合同签约」 | 「请联系企业负责人**或店长**完成合同签约」 |

验证：`npm run type-check` 通过；`npm run build:mp-weixin` 成功；产物中已包含 `storeManager` 判断。

## 未完成：模拟器内「店长签约」实测（BLOCKED）

- 小程序登录为**手机号快捷登录**（`getphonenumber`），在开发者工具内需要**用户本人完成微信手机号授权**，属技能规定的「登录/授权需用户完成」阻塞项，未绕过。
- 现有会话仍是**张伟（企业负责人）**；尝试用 automator 直接 `reLaunch` 到签约工作台时出现 `timeout waiting for automator response`，未取得可靠页面证据。
- 因此**没有**把 App 侧店长签约标记为通过；App 侧该动作的真实通过状态仍待补验。

## 补验方法（二选一）

1. 你在开发者工具里完成一次微信手机号授权登录 **王宏文（18055190856）**，我接着跑「签约工作台 → 去签约」；
2. 或给一个已确认未签约的报价，我用企业负责人会话先验证「签约工作台」页面运行，再切店长验证 affordance。
