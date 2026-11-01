# src — App 实现、视觉与分包规范

> 根 `AGENTS.md` 同时生效。本文件只约束 `src/**`；视觉真源为 `docs/03-视觉与设计规范.md` 和 `src/uni.scss`。

## 1. 技术栈与目录

- uni-app + Vue 3 `<script setup lang="ts">` + TypeScript + Vite + Pinia。
- 样式使用 SCSS scoped + Design Token；750rpx 设计基准；目标端为微信小程序/H5/App，小程序优先。
- 通用组件放 `src/components`；领域代码放 `src/domains/<domain>`，至少包含 `model.ts / api.ts / meta.ts`。
- 启动、登录/授权和 Tab 页放 `src/pages`；其他业务页放 `src/subpackages/<domain>/pages`。
- 页面只调用领域 API；公共 HTTP 放 `src/core/http.ts`，格式化和会话不得在页面重复实现。
- 禁止新增 Mock、演示数据、页面内正式默认值或本地持久化冒充业务事实。

## 2. Token 与视觉

- 当前 Token 真源：`src/uni.scss`；目标迁移文件：`src/styles/tokens.scss`。迁移前不得建立第二套真源。
- 颜色、字号、间距、圆角、阴影、动效必须使用 Token；禁止在页面写新的 `#xxx`、`28rpx`、阴影字面量。
- 品牌 Logo 只使用 `JzBrandLogo.vue` 和 `logo-export`；深色背景用 `variant="white"`，浅色背景用 `variant="color"`。
- 图标统一使用 `JzIcon.vue`；禁止 emoji、字符箭头、字符加号和混用图标库。
- 间距使用 8rpx 栅格；页面左右统一 `$page-gutter`；单页圆角种类 ≤2；一屏主 CTA 只能一个。
- 禁止纯黑/纯灰；卡片必须有背景、圆角和阴影；文字层级至少通过字号、字重、颜色中的两项区分。
- 视觉细则、状态色和组件规范以 `docs/03-视觉与设计规范.md` 为准，不在本文件复制完整色表。

## 3. Vue / TypeScript

- 禁止 Options API、无理由 `any` 和静默类型断言；不明确时用 `unknown` + 类型守卫。
- Props 使用 `defineProps<Props>() + withDefaults`；事件使用类型化 `defineEmits`。
- `v-for` 必须有稳定 `:key`；禁止 index key（静态不重排列表除外）。
- 组件 ≤300 行、页面 ≤500 行；超限拆组件/composable/domain。
- 能 `computed` 的结果不用 `watch` 重算；定时器、监听和订阅在 `onUnmounted` 清理。
- 样式使用 BEM；禁止 `!important`、行内 style 和无类名标签选择器；嵌套 ≤3 层。
- 命名：组件 PascalCase，页面 kebab-case，变量/函数 camelCase，常量 UPPER_SNAKE_CASE，类型 PascalCase。

## 4. 页面状态与交互

- 所有异步数据覆盖 loading / empty / error；骨架屏优先，空态有引导，错误态有重试。
- 所有可交互元素覆盖 default / active / disabled；H5 补 hover / focus。
- 按钮防重复点击；成功提示 ≤1.5s；删除、取消和不可逆动作二次确认。
- 长列表使用分页/加载更多；增长型列表禁止固定大 `size` 或全量拉取。
- 动效 ≤300ms；颜色反馈 <100ms 视为无效；禁止无意义动效。
- 表单限制输入类型、必填标记、失焦校验、错误近场提示和键盘避让。
- 每个页面必须覆盖视觉七态和失败恢复；不得用 `|| list[0]`、默认值或空数组掩盖串号、权限和数据缺失。

## 5. 页面与 Provider 边界

- 页面保留领域对象关联，不把关联对象拆成裸 id 再翻译。
- Provider 响应统一按 `{ success, data, errorCode }` 处理；分页使用统一解包和 `Page<Entity>`。
- 权限、状态和正式动作来自服务端；前端只负责显示和触发，不复制业务规则。
- 详情页必须按当前实体 ID 或上下文读取，禁止全量拉取后在前端 find。
- 角色元信息放 `src/roles/catalog.ts`，权限矩阵放 `src/roles/permission.ts`。

## 6. 选择器与表单

- 员工、项目、客户、房屋、报价、合同、工人、供应商、应收应付等业务对象使用专用选择页；禁止原生 `<picker>` 或 `JzSelectField :range` 承载增长型对象。
- 选择页打开即展示数据，提供服务端搜索分页、加载更多、七态、选择/清除/取消和一次性回传。
- 来源页面使用全宽已选业务卡，展示名称、状态和关键业务事实，不显示“已选择某某”。
- 依赖父对象的子集合必须处理父对象失效、清空和重新加载。
- 新选择器先走 T15/T16/T17；`check:selectors` 通过不等于真实页面合规。

## 7. 分包与体积

- 只有启动、登录/授权和 Tab 页可放主包；新增业务模块优先新增独立分包。
- 单个静态文件 >50KB 优先 CDN；分包私有资源放分包 `static`；主包资源保持最小。
- 主包 ≤2MB、单分包 ≤2MB、总包 ≤20MB；禁止主包/分包私有反向引用。
- 分包跳转使用绝对路径；新增高频入口同步检查 `preloadRule`。
- 提交前运行 `npm run type-check`、`npm run build:mp-weixin`、`npm run check:subpackages`；发布前运行 `npm run build:mp-weixin:release` 或 `npm run verify:mp-weixin`。

## 8. BUG 修复与验证

- BUG 先读 `docs/fixes/README.md`：复现与根因 → 最小修复 → 业务/权限/异常审查 → FIX 留痕。
- 不允许只改代码不沉淀；涉及关联数据、权限、金额和状态时补负向和边界用例。
- 定向验证至少覆盖 `npm run type-check` 和相关契约脚本；按影响补 `check:selectors`、`audit:selectors`、`check:finance-pickers`、`check:ui` 和小程序构建。
- 最终页面必须进入真实微信开发者工具；关键链路补多机型、七态、弱网和真机证据。
