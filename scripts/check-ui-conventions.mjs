/**
 * App 端 UI/交互统一化守卫（对应 docs/03-视觉与设计规范.md §6.10 / §8.3）。
 *
 * 规则：
 * 1. 禁止 uni.showModal / uni.showActionSheet —— 统一走 composables/dialog.ts 与 JzActionSheet。
 * 2. 禁止页面手写遮罩浮层（`__mask` 类）—— 统一走 JzSheet / JzConfirmDialog。
 *
 * 允许清单仅包含统一浮层自身与「非模态解释气泡」。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SCAN_DIRS = ['src']
const MASK_ALLOWLIST = new Set([
  'src/components/JzSheet.vue',
  'src/components/JzConfirmDialog.vue',
  'src/components/JzMetricGlossary.vue'
])

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(vue|ts)$/.test(entry)) out.push(full)
  }
  return out
}

const failures = []
for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file)
    const text = readFileSync(file, 'utf8')
    const lines = text.split('\n')
    lines.forEach((line, index) => {
      // 注释中的说明不计入
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
      if (/uni\.showModal|uni\.showActionSheet/.test(line)) {
        failures.push(`${rel}:${index + 1} 禁止直接调用 uni.showModal / uni.showActionSheet，请使用 composables/dialog.ts 或 JzActionSheet`)
      }
      if (/class="[^"]*__mask/.test(line) && !MASK_ALLOWLIST.has(rel)) {
        failures.push(`${rel}:${index + 1} 禁止手写遮罩浮层，请使用 JzSheet / JzConfirmDialog`)
      }
    })
  }
}

if (failures.length) {
  console.error('UI 统一化规范检查未通过：')
  for (const item of failures) console.error('  - ' + item)
  process.exit(1)
}
console.log('UI 统一化规范检查通过（无原生确认弹窗、无手写遮罩浮层）')
