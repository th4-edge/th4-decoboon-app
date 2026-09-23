import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8')
const component = read('src/components/OnboardingChecklist.vue')
const api = read('src/domains/onboarding/api.ts')
const home = read('src/pages/index/index.vue')

const required = [
  ["统计域启动引导路由", api, "statistic/onboarding/report"],
  ["统一状态投影接入", component, "onboardingApi.report()"],
  ["未知态展示", component, "状态暂不可确认"],
  ["跨页显示刷新", home, "onboardingRef.value?.reload()"],
  ["下拉刷新", home, "onPullDownRefresh"]
]

const missing = required.filter(([, source, token]) => !source.includes(token)).map(([label]) => label)
if (missing.length) {
  console.error(`启动引导契约校验失败: ${missing.join(', ')}`)
  process.exit(1)
}

const forbidden = [
  ['本地完成布尔值', component, 'done: false'],
  ['本地完成布尔值', component, 'done: true'],
  ['静默空数组兜底', component, 'catch(() => ({ list:'],
  ['前端分页拼装必做状态', component, 'catalogApi.page(']
]
const violations = forbidden.filter(([, source, token]) => source.includes(token)).map(([label, , token]) => `${label}(${token})`)
if (violations.length) {
  console.error(`启动引导契约校验失败: ${violations.join(', ')}`)
  process.exit(1)
}

if (!component.includes("step.status === 'unknown'") || !component.includes("STEP_STATUS") && !api.includes("STEP_STATUS")) {
  console.error('启动引导契约校验失败: 必须显式处理 unknown 步骤状态')
  process.exit(1)
}

console.log('全角色启动引导契约校验通过')
