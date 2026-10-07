import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const result = await build({
  absWorkingDir: root,
  entryPoints: ['src/domains/finance/refund.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  plugins: [{
    name: 'source-alias',
    setup(builder) {
      builder.onResolve({ filter: /^@\// }, (args) => {
        const base = path.resolve(root, 'src', args.path.slice(2))
        const resolved = [base, `${base}.ts`, `${base}.js`, path.join(base, 'index.ts')]
          .find((candidate) => fs.existsSync(candidate))
        if (!resolved) throw new Error(`Unable to resolve ${args.path}`)
        return { path: resolved }
      })
    }
  }]
})
const source = result.outputFiles[0].text
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const { remainingRefundable, roundMoney, sumRefundsForReceipt } = await import(moduleUrl)

const refunds = [
  { receipt: { id: 'receipt-1' }, amount: 10000 },
  { receipt: { id: 'receipt-1' }, amount: 0.1 },
  { receipt: { id: 'receipt-2' }, amount: 20 }
]
const cases = [
  ['sum receipt-1', sumRefundsForReceipt('receipt-1', refunds), 10000.1],
  ['sum receipt-2', sumRefundsForReceipt('receipt-2', refunds), 20],
  ['sum missing receipt', sumRefundsForReceipt('receipt-3', refunds), 0],
  ['remaining partial refund', remainingRefundable(26162.44, 10000), 16162.44],
  ['remaining full refund', remainingRefundable(10000, 10000), 0],
  ['remaining over refund blocked', remainingRefundable(10000, 12000), 0],
  ['floating point rounded', roundMoney(0.1 + 0.2), 0.3]
]
for (const [name, actual, expected] of cases) {
  if (actual !== expected) throw new Error(`${name}: expected ${expected}, got ${actual}`)
}

const page = fs.readFileSync(path.join(root, 'src/subpackages/finance/pages/refund-create.vue'), 'utf8')
if (!page.includes('remainingRefundable')) throw new Error('refund-create must use remainingRefundable')
if (page.includes('Number(form.amount) <= receipt.value.amount')) throw new Error('refund-create must not use original receipt amount as refund limit')
if (page.includes('form.amount = String(receipt.value.amount)')) throw new Error('refund-create must not prefill original receipt amount')

console.log(`refund-amount PASS: ${cases.length} cases`)
