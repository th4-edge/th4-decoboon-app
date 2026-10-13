#!/usr/bin/env node
/**
 * 增减项「预览」与「正式提交」的明细字段白名单一致性守卫。
 *
 * 背景（2026-10-13 线上缺陷）：App 1.0.44 的「新增分项」输入工程量后仍报
 * 「工程量必须大于 0」且一直显示「待试算」。根因是 `project/contract-change/preview`
 * 的载荷白名单漏转发 `targetQuantity`，而后端 Preview 与 batch-save 共用
 * `ContractChangeItem` 实体（字段名就是 `targetQuantity`），服务端拿到空工程量即 400。
 *
 * 两侧明细现在映射同一份 `rowItem(...)`，白名单必须逐字段一致；本脚本在构建期拦截漂移。
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = resolve(ROOT, 'src/domains/trade/api.ts')
const ANCHOR = 'items: input.items.map((item) => ({'

/** 从源码中按出现顺序取出每处 `items: input.items.map((item) => ({ ... }))` 的顶层字段名。 */
function collectItemMappings(source) {
  const found = []
  let cursor = 0
  while (true) {
    const start = source.indexOf(ANCHOR, cursor)
    if (start < 0) break
    const bodyStart = start + ANCHOR.length
    const end = source.indexOf('}))', bodyStart)
    if (end < 0) throw new Error('明细映射块未闭合，无法解析')
    const body = source.slice(bodyStart, end)
    const keys = []
    for (const match of body.matchAll(/(?:^|[\s,])([A-Za-z_][A-Za-z0-9_]*)\s*:/g)) {
      if (!keys.includes(match[1])) keys.push(match[1])
    }
    found.push(keys)
    cursor = end
  }
  return found
}

const source = readFileSync(SOURCE, 'utf8')
const mappings = collectItemMappings(source)

if (mappings.length !== 2) {
  console.error(`[contract-change-item-parity] 预期 2 处明细映射（预览 / 正式提交），实际 ${mappings.length} 处`)
  process.exit(1)
}

// 文件内顺序：先 batch-save，后 preview（以源码出现顺序为准，避免依赖行号）。
const [submit, preview] = mappings
const missingInPreview = submit.filter((key) => !preview.includes(key))
const extraInPreview = preview.filter((key) => !submit.includes(key))

if (missingInPreview.length || extraInPreview.length) {
  console.error('[contract-change-item-parity] 预览与提交的明细字段不一致（会直接导致服务端校验失败）')
  if (missingInPreview.length) console.error(`  预览缺少：${missingInPreview.join(', ')}`)
  if (extraInPreview.length) console.error(`  预览多出：${extraInPreview.join(', ')}`)
  process.exit(1)
}

console.log(`[contract-change-item-parity] 通过：预览与提交明细字段一致（${submit.length} 项）`)
