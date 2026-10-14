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
 *
 * 历史坑：原实现用「行级状态机」判断是否在 template/style 内（见到 `</template>` 就置 false），
 * 遇到 `<template v-if>` 这类**嵌套模板**会提前退出 → 嵌套块之后的模板裸色值全部漏检
 * （FIX-041 的 `<switch color="#0E8A7D">` 就是这样长期漏过的）；单行 `<template>…</template>`
 * 也同样是漏检盲区。现改为按**字符区间**计算脚本/样式/根模板块，再按区间给行打标。
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

/**
 * 计算 SFC 块区间：[start, end) 字符偏移。
 *
 * - 只在**块外**识别块开始标签，块内只找对应结束标签，避免 script 里的字符串或
 *   style 里的选择器被误判成结构标签；
 * - template 支持嵌套（`<template v-if>` / `<template #slot>`），按深度配对；
 * - 单行 `<template>…</template>` 同样落在区间内，不再漏检。
 */
function blockRanges(text) {
  const ranges = { script: [], style: [], template: [] }
  const tagRe = /<(\/?)(script|style|template)\b[^>]*>/gi
  let depth = { script: 0, style: 0, template: 0 }
  let start = { script: -1, style: -1, template: -1 }
  let match
  while ((match = tagRe.exec(text)) !== null) {
    const closing = match[1] === '/'
    const name = match[2].toLowerCase()
    const active = depth.script > 0 ? 'script' : (depth.style > 0 ? 'style' : null)
    if (active && name !== active) continue
    if (!closing) {
      if (depth[name] === 0) start[name] = match.index
      depth[name] += 1
    } else if (depth[name] > 0) {
      depth[name] -= 1
      if (depth[name] === 0) ranges[name].push([start[name], match.index + match[0].length])
    }
  }
  return ranges
}

/** 行号（0 基）→ 是否落在任一区间内。 */
function linesIn(ranges, text) {
  const lineStart = [0]
  for (let i = 0; i < text.length; i += 1) if (text[i] === '\n') lineStart.push(i + 1)
  const flags = new Set()
  for (const [from, to] of ranges) {
    let low = 0
    let high = lineStart.length - 1
    while (low < high) { // 二分找到起始行
      const mid = (low + high + 1) >> 1
      if (lineStart[mid] <= from) low = mid
      else high = mid - 1
    }
    for (let i = low; i < lineStart.length && lineStart[i] < to; i += 1) flags.add(i)
  }
  return flags
}

const failures = []
for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file)
    const text = readFileSync(file, 'utf8')
    const lines = text.split('\n')
    const ranges = blockRanges(text)
    const styleLines = linesIn(ranges.style, text)
    const templateLines = linesIn(ranges.template, text)
    lines.forEach((line, index) => {
      const inStyle = styleLines.has(index)
      const inTemplate = templateLines.has(index)
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
