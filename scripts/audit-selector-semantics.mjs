#!/usr/bin/env node
/**
 * App 业务对象选择器语义审计。
 *
 * 与 check:selectors 的“已接入主链”不同，本脚本扫描全部页面中的 JzSelectField /
 * ActionSheet / 全量对象读取线索，按业务对象关键词拦截新的普通下拉和对象动作表。
 * 固定枚举、日期时间、项目内阶段/区域/分区等有界子集允许保留。
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const roots = ['src/pages', 'src/subpackages', 'src/components'].map((item) => path.join(root, item))
const failures = []
const findings = []

function walk(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) return walk(full)
    return entry.name.endsWith('.vue') ? [full] : []
  })
}

const files = roots.flatMap(walk).sort()
const businessObject = /(?:^|[^A-Za-z])(employee|employees|designer|designers|owner|owners|worker|workers|customer|customers|property|properties|project|projects|quote|quotes|contract|contracts|supplier|suppliers|template|templates)(?:[^A-Za-z]|$)/i
const allowedBoundedSelect = /(?:PROJECT_STATUSES|projectStatusLabels|RECTIFICATION_TYPES|KIND_OPTIONS|MEASURE_REGION_TYPES|spaceOptions|spaces\.map|sections\.map|stageOptions|SHEET_UNIT_OPTIONS|sheetTypes|TYPE_OPTIONS|STATUS_OPTIONS|MODE_OPTIONS)/i

for (const full of files) {
  const relative = path.relative(root, full)
  const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.includes('<JzSelectField')) {
      const tagLines = [line]
      for (let offset = 1; offset < 12 && !/\/?>\s*$/.test(tagLines[tagLines.length - 1]); offset += 1) {
        if (index + offset >= lines.length) break
        tagLines.push(lines[index + offset])
      }
      const block = tagLines.join(' ')
      if (businessObject.test(block) && !allowedBoundedSelect.test(block)) {
        failures.push({ type: 'business-object-in-select-field', file: relative, line: index + 1, snippet: block.replace(/\s+/g, ' ').slice(0, 280) })
      } else {
        findings.push({ type: 'select-field-allowed-candidate', file: relative, line: index + 1 })
      }
    }
    const actionDeclaration = line.match(/const\s+(\w+Actions)\s*=\s*computed/)
    if (actionDeclaration) {
      const block = lines.slice(index, Math.min(lines.length, index + 10)).join(' ')
      if (block.includes('.map(') && businessObject.test(block)) {
        failures.push({ type: 'business-object-action-sheet', file: relative, line: index + 1, snippet: block.replace(/\s+/g, ' ').slice(0, 280) })
      }
    }
    if (/identityApi\.(employees|designers)\s*\(/.test(line)) {
      findings.push({ type: 'identity-full-list-read', file: relative, line: index + 1 })
    }
    if (/<JzActionSheet/.test(line)) {
      const block = lines.slice(index, Math.min(lines.length, index + 8)).join(' ')
      const match = block.match(/:actions="([^"]+)"/)
      if (match && businessObject.test(match[1])) {
        failures.push({ type: 'business-object-action-sheet-binding', file: relative, line: index + 1, snippet: match[1] })
      }
    }
  }
}

const summary = {
  files: files.length,
  selectFieldCandidates: findings.filter((item) => item.type === 'select-field-allowed-candidate').length,
  identityFullListReads: findings.filter((item) => item.type === 'identity-full-list-read').length,
  failures: failures.length
}
console.log(`App 选择器语义审计：${summary.files} 个 Vue 文件，${summary.selectFieldCandidates} 个 JzSelectField 通过固定枚举/有界子集初筛，${summary.identityFullListReads} 处身份全量读取需按上下文判定，${summary.failures} 个硬违规。`)
for (const finding of findings.filter((item) => item.type === 'identity-full-list-read')) {
  console.log(`- 上下文待判定 ${finding.file}:${finding.line}`)
}
if (failures.length) {
  console.error('\n业务对象选择器语义违规：')
  for (const failure of failures) {
    console.error(`- ${failure.file}:${failure.line} [${failure.type}] ${failure.snippet || ''}`)
  }
  process.exit(1)
}
console.log('通过：未发现业务对象继续使用 JzSelectField 或 ActionSheet 承载选择。')
