#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apiPath = path.join(root, 'src/domains/trade/api.ts')
const viewPath = path.join(root, 'src/subpackages/project/pages/change-create.vue')

export function findings(api, view) {
  const issues = []
  const req = (source, pattern, message) => { if (!pattern.test(source)) issues.push(message) }
  req(api, /contractChangeRange:\s*async\s*\(input:\s*\{[^}]*current\?: number[^}]*size\?: number/, 'range API 必须接收 current/size')
  req(api, /Math\.min\(50,\s*Math\.max\(1,\s*Math\.trunc\(input\.size \?\? 20\)\)\)/, 'range 页大小必须钳制为 1..50')
  req(api, /current,\s*size,[\s\S]*?keyword:/, 'range 请求必须发送分页和关键词')
  req(view, /const rangeSize = ref\(20\)/, '页面必须声明服务端页大小')
  req(view, /const rangeTotal = ref\(0\)/, '页面必须消费服务端 total')
  req(view, /function loadMoreSources\(\)/, '页面必须支持加载下一页')
  req(view, /@scrolltolower="loadMoreSources"/, '来源列表滚动到底必须触发服务端下一页')
  req(view, /current:\s*page,[\s\S]*?size:\s*rangeSize\.value/, '页面请求必须发送 current/size')
  return issues
}

const [api, view] = [fs.readFileSync(apiPath, 'utf8'), fs.readFileSync(viewPath, 'utf8')]
if (process.argv.includes('--self-test')) {
  const samples = [
    findings(api.replace('    current?: number\n    size?: number\n    keyword?: string', '    currentPage?: number\n    size?: number\n    keyword?: string'), view),
    findings(api.replace('Math.min(50, Math.max(1, Math.trunc(input.size ?? 20)))', 'input.size ?? 200'), view),
    findings(api, view.replace('const rangeTotal = ref(0)\n', '')),
    findings(api, view.replace('current: page,', 'current: 1,'))
  ]
  if (samples.some((sample) => sample.length === 0)) {
    console.error('App 合同来源分页门禁自测失败：负向样本未拦截')
    process.exit(1)
  }
  console.log(`App 合同来源分页门禁自测：PASS（${samples.length}/${samples.length} 个负向样本被拦截）`)
  process.exit(0)
}
const issues = findings(api, view)
if (issues.length) {
  console.error('App 合同来源分页门禁失败：')
  for (const issue of issues) console.error(`- ${issue}`)
  process.exit(1)
}
console.log('App 合同来源分页门禁通过：服务端 current/size、最多 50 条、滚动加载下一页。')
