import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8')
const api = read('src/domains/document/api.ts')
const quoteDetail = read('src/subpackages/quote/pages/detail.vue')
const backendRenderer = read('../../后端代码/th4-decoboon/src/main/java/com/th4/edge/decoboon/document/context/QuotePdfRenderer.java')
const backendArchive = read('../../后端代码/th4-decoboon/src/main/java/com/th4/edge/decoboon/document/context/DocumentArchiveContext.java')

const required = [
  ['报价 PDF Provider', api, 'document/quote/build'],
  ['报价详情入口', quoteDetail, 'documentApi.buildQuote'],
  ['客户版成本边界', quoteDetail, '不含成本'],
  ['不可覆盖归档', backendArchive, 'setReprintOf'],
  ['重打审计', backendArchive, 'DocumentPrint']
]
const missing = required.filter(([, source, token]) => !source.includes(token)).map(([label]) => label)
if (missing.length) {
  console.error(`单据归档契约校验失败: ${missing.join(', ')}`)
  process.exit(1)
}

for (const forbidden of ['getCost(', 'getProfit(', 'getGrossProfit(']) {
  if (backendRenderer.includes(forbidden)) {
    console.error(`报价客户版 PDF 越界读取内部字段: ${forbidden}`)
    process.exit(1)
  }
}

console.log('报价 PDF 与归档契约校验通过')
