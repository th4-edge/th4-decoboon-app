import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

/**
 * 发布版本同步脚本
 *
 * 唯一真源：`package.json#version`
 * 同步目标：`src/manifest.json` 顶层与 `mp-weixin` 节点的 `versionName` / `versionCode`
 *
 * versionCode 规则（沿用历史发版记录 1.0.20→120、1.0.24→124）：
 *   major * 100 + minor * 10 + patch
 *
 * 用法：
 *   node scripts/sync-version.mjs          # 校验并按需写回 manifest
 *   node scripts/sync-version.mjs --check  # 只校验，不一致时以非 0 退出（用于发布门禁）
 */

const root = process.cwd()
const pkgPath = path.join(root, 'package.json')
const manifestPath = path.join(root, 'src/manifest.json')
const checkOnly = process.argv.includes('--check')

function fail(message) {
  console.error(`Version sync failed:\n- ${message}`)
  process.exit(1)
}

let pkg
try {
  pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
} catch (error) {
  fail(`无法读取 package.json: ${error.message}`)
}

const version = String(pkg.version || '').trim()
const parsed = version.match(/^(\d+)\.(\d+)\.(\d+)$/)
if (!parsed) fail(`package.json#version 非法: "${version}"，需为 x.y.z`)
const [, major, minor, patch] = parsed.map(Number)
const versionCode = String(major * 100 + minor * 10 + patch)

let manifest
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
} catch (error) {
  fail(`无法读取 src/manifest.json: ${error.message}`)
}

const drifted = []
function align(holder, label) {
  if (!holder || typeof holder !== 'object') return
  if (holder.versionName !== version || holder.versionCode !== versionCode) {
    drifted.push(`${label} ${holder.versionName || '<empty>'}/${holder.versionCode || '<empty>'}`)
    holder.versionName = version
    holder.versionCode = versionCode
  }
}

align(manifest, '顶层')
align(manifest['mp-weixin'], 'mp-weixin')

if (!drifted.length) {
  console.log(`Version sync passed: manifest 已对齐 package.json#version ${version} (versionCode ${versionCode})`)
  process.exit(0)
}

if (checkOnly) {
  fail(
    `src/manifest.json 版本与 package.json#version 不一致：\n`
    + `  - 期望 ${version} / ${versionCode}\n`
    + `  - 实际 ${drifted.join('、')}\n`
    + '  运行 `npm run sync:version` 自动修复。'
  )
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(`Version synced: src/manifest.json (${drifted.join('、')}) -> ${version} / ${versionCode}`)
