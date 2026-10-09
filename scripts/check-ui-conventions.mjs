/**
 * App 端 UI/交互统一化守卫（对应 docs/03-视觉与设计规范.md §6.10 / §8.3）。
 *
 * 规则：
 * 1. 禁止 uni.showModal / uni.showActionSheet —— 统一走 composables/dialog.ts 与 JzActionSheet。
 * 2. 禁止页面手写遮罩浮层（`__mask` 类）—— 统一走 JzSheet / JzConfirmDialog。
 * 3. 禁止页面直写 <picker> —— 统一走 JzSelectField / JzDateRangeField。
 * 4. 禁止 <style> 内写裸色值（#hex）—— 统一走 $jzb-* Token。
 * 5. 禁止 <style> 内写裸数字 z-index —— 统一走 $jzb-z-* 层级 Token。
 * 6. 禁止把 Token 引用写进字符串（'TOKEN_COLOR.x'）—— 必须作为表达式使用，
 *    否则会当作颜色字面量传进 SVG，导致图标无描边（1.0.38 事故）。
 * 7. 禁止 <template> 里给 color 属性写裸色值 —— 统一走 TOKEN_COLOR / STATUS_COLOR。
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
/** 只有选值控件自身可以持有原生 picker；页面一律用 JzSelectField / JzDateRangeField。 */
const PICKER_ALLOWLIST = new Set([
  'src/components/JzSelectField/JzSelectField.vue',
  'src/components/JzDateRangeField/JzDateRangeField.vue',
  'src/components/JzStoreFilter.vue'
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
    let inStyle = false
    let inTemplate = false
    lines.forEach((line, index) => {
      if (/<template[\s>]/.test(line)) { inTemplate = true; return }
      if (/<\/template>/.test(line)) { inTemplate = false; return }
      if (/<style[\s>]/.test(line)) { inStyle = true; return }
      if (/<\/style>/.test(line)) { inStyle = false; return }
      // 注释中的说明不计入
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
      if (/uni\.showModal|uni\.showActionSheet/.test(line)) {
        failures.push(`${rel}:${index + 1} 禁止直接调用 uni.showModal / uni.showActionSheet，请使用 composables/dialog.ts 或 JzActionSheet`)
      }
      if (/class="[^"]*__mask/.test(line) && !MASK_ALLOWLIST.has(rel)) {
        failures.push(`${rel}:${index + 1} 禁止手写遮罩浮层，请使用 JzSheet / JzConfirmDialog`)
      }
      if (/<picker[\s>]/.test(line) && !PICKER_ALLOWLIST.has(rel)) {
        failures.push(`${rel}:${index + 1} 禁止页面直写 <picker>，请使用 JzSelectField / JzDateRangeField`)
      }
      if (inStyle && /#[0-9A-Fa-f]{6}\b/.test(line)) {
        failures.push(`${rel}:${index + 1} 样式内禁止裸色值，请使用 $jzb-* Token`)
      }
      if (inStyle && /z-index:\s*-?\d/.test(line)) {
        failures.push(`${rel}:${index + 1} 样式内禁止裸数字 z-index，请使用 $jzb-z-* 层级 Token`)
      }
      if (inTemplate && /(?:^|[^\w:-])color=(?:"#[0-9A-Fa-f]{3,8}"|"'#[0-9A-Fa-f]{3,8}'")/.test(line)) {
        failures.push(`${rel}:${index + 1} 模板 color 属性禁止裸色值，请使用 TOKEN_COLOR / STATUS_COLOR`)
      }
      // 仅单引号包裹才算“把 Token 引用写进字符串”（属性引号 " 不算）
      if (/'((TOKEN_COLOR|STATUS_COLOR)\.[A-Za-z0-9_]+)'/.test(line)) {
        failures.push(`${rel}:${index + 1} Token 引用被写进字符串，请去掉引号作为表达式使用`)
      }
    })
  }
}

if (failures.length) {
  console.error('UI 统一化规范检查未通过：')
  for (const item of failures) console.error('  - ' + item)
  process.exit(1)
}
console.log('UI 统一化规范检查通过（确认弹窗/浮层/picker/样式与模板色值/层级/Token 引用 均已规范）')
