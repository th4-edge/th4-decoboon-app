#!/usr/bin/env node
/**
 * 合同行分页跨端契约门禁。
 * 防止 App 再次以无 current/size 的调用消费合同行，或重新引入当前页金额 reduce / 静默空数组降级。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apiPath = path.join(root, 'src/domains/trade/api.ts')
const pagePath = path.join(root, 'src/subpackages/project/pages/contract.vue')

export function findings(apiSource, pageSource) {
  const issues = []
  const requireApi = (pattern, message) => {
    if (!pattern.test(apiSource)) issues.push(`trade/api.ts: ${message}`)
  }
  const requirePage = (pattern, message) => {
    if (!pattern.test(pageSource)) issues.push(`contract.vue: ${message}`)
  }

  requireApi(/contractLines:\s*async\s*\(\s*params:[^)]*current\s*=\s*1[^)]*size\s*=\s*20\b/s,
    '合同行 API 必须显式接收 current=1 / size=20')
  requireApi(/Math\.min\(50,\s*Math\.max\(1,\s*Math\.trunc\(size\)\)\)/, '合同行页大小必须钳制为 1..50')
  requireApi(/current:\s*safeCurrent/, '请求必须发送 current')
  requireApi(/size:\s*safeSize/, '请求必须发送 size')
  requireApi(/toPageData\(result,\s*safeCurrent,\s*safeSize\)/, '合同行响应必须归一化为服务端分页结果')

  requirePage(/const LINE_PAGE_SIZE = 20/, '页面必须声明 20 条默认页大小')
  requirePage(/tradeApi\.contractLines\([\s\S]*?1,\s*LINE_PAGE_SIZE\s*\)/, '首次加载必须请求第 1 页')
  requirePage(/lineCurrent\.value \+ 1,[\s\S]*?LINE_PAGE_SIZE/, '加载更多必须请求下一页')
  requirePage(/lineHasMore/, '页面必须消费服务端 hasMore')
  requirePage(/workbench\.value\?\.lineCount/, '合同范围总数必须消费 workbench.lineCount')
  requirePage(/workbench\.value\.lineAmount/, '合同范围金额必须消费 workbench.lineAmount')
  requirePage(/v-if="!lineHasMore"\s+class="cw__group-amount"/, '未全部加载时不得显示当前页分组合计')
  if (/linesTotal\s*=\s*computed\(\(\)\s*=>\s*lines\.value\.reduce/.test(pageSource)) {
    issues.push('contract.vue: 禁止用当前页 lines.reduce 冒充完整合同金额')
  }
  if (/contractLines\([\s\S]{0,300}?\.catch\(\(\)\s*=>\s*\[\]\)/.test(pageSource)) {
    issues.push('contract.vue: 合同行失败时禁止静默降级为空数组')
  }
  return issues
}

function readSources() {
  return [fs.readFileSync(apiPath, 'utf8'), fs.readFileSync(pagePath, 'utf8')]
}

if (process.argv.includes('--self-test')) {
  const [apiSource, pageSource] = readSources()
  const mutations = [
    [apiSource.replace('size = 20', 'size = 200'), pageSource, '缺少默认 20'],
    [apiSource.replace('current: safeCurrent', 'current: 1'), pageSource, '缺少 current'],
    [apiSource, pageSource.replace('workbench.value?.lineCount', 'lines.value.length'), '当前页行数冒充总数'],
    [apiSource, `${pageSource}\nconst linesTotal = computed(() => lines.value.reduce((sum, line) => sum + line.amount, 0))`, '当前页金额求和'],
    [apiSource, pageSource.replace('v-if="!lineHasMore" class="cw__group-amount"', 'class="cw__group-amount"'), '当前页分组合计']
  ]
  let passed = 0
  for (const [api, page, label] of mutations) {
    if (findings(api, page).length) passed += 1
    else {
      console.error(`自测失败：未识别负向样本「${label}」`)
      process.exit(1)
    }
  }
  console.log(`合同行分页契约门禁自测：PASS（${passed}/${mutations.length} 个负向样本被拦截）`)
  process.exit(0)
}

const [apiSource, pageSource] = readSources()
const issues = findings(apiSource, pageSource)
if (issues.length) {
  console.error('合同行分页契约门禁失败：')
  for (const issue of issues) console.error(`- ${issue}`)
  process.exit(1)
}
console.log('合同行分页契约门禁通过：App 显式 current/size、最多 50 条、消费 workbench 汇总且无当前页金额/静默空数组降级。')
