#!/usr/bin/env node
/**
 * 微信小程序 AI 开发模式（beta）与 uni-app 运行时的兼容性检查。
 *
 * 背景：uni-app 的 mp-weixin 运行时会用一个"白名单对象"替换全局 wx
 * （@dcloudio/uni-mp-weixin/dist/uni.api.esm.js 的 initWx()），
 * 判定规则为：objectKeys 白名单命中，或 typeof wx[key] === 'function'。
 * 因此对象型的新增 API（如 wx.modelContext）会被静默丢弃。
 *
 * 用法：node scripts/verify-mp-ai-compat.mjs
 * 退出码：0 = 无阻塞问题；1 = 存在阻塞问题。
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const RUNTIME = path.join(ROOT, 'node_modules/@dcloudio/uni-mp-weixin/dist/uni.api.esm.js')
const MANIFEST = path.join(ROOT, 'src/manifest.json')

// 小程序 AI 开发模式相关的新增 API 及其真实类型
const AI_APIS = [
  ['modelContext', 'object', '原子组件/半屏页取上下文（sendFollowUpMessage / reapplyApiCall）'],
  ['onAgentHandoff', 'function', '接力页接收 handoff（path / query / payload）'],
  ['offAgentHandoff', 'function', '取消 handoff 监听'],
  ['requestAgentPrivacyAuthorization', 'function', '对话内隐私授权卡片'],
  ['getDetailPageCloseButtonBoundingClientRect', 'function', '半屏页关闭按钮定位'],
]

let blocking = 0
const rows = []

if (!fs.existsSync(RUNTIME)) {
  console.log('⚠️  未找到 uni-app mp-weixin 运行时，先执行 npm install：', RUNTIME)
  process.exit(1)
}

const source = fs.readFileSync(RUNTIME, 'utf8')
const match = source.match(/const objectKeys = \[([\s\S]*?)\]/)
const objectKeys = match
  ? match[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
  : []

// 忠实复现 initWx 的判定规则：白名单命中 或 原生类型为 function
const survives = (key, type) => objectKeys.includes(key) || type === 'function'

for (const [key, type, desc] of AI_APIS) {
  const ok = survives(key, type)
  if (!ok) blocking += 1
  rows.push({ API: `wx.${key}`, 原生类型: type, 经uni运行时: ok ? '保留' : '丢失', 说明: desc })
}

console.log(`uni-app mp-weixin 运行时: ${path.relative(ROOT, RUNTIME)}`)
console.log(`运行时 objectKeys 白名单: ${objectKeys.join(', ') || '(未解析到)'}\n`)
console.table(rows)

// lazyCodeLoading 是 SKILL 按需注入的硬性前提
let manifestOk = false
try {
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  manifestOk = m['mp-weixin']?.lazyCodeLoading === 'requiredComponents'
} catch {
  manifestOk = false
}
console.log(`manifest.json mp-weixin.lazyCodeLoading = requiredComponents : ${manifestOk ? '✅' : '❌'}`)
if (!manifestOk) blocking += 1

if (blocking > 0) {
  console.log(`\n❌ 存在 ${blocking} 项阻塞，需按 docs/20-小程序AI开发模式兼容性验证-2026-10-13.md 打补丁或修正配置。`)
  process.exit(1)
}
console.log('\n✅ 未发现阻塞项。')
