import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const result = await build({
  absWorkingDir: root,
  entryPoints: ['src/core/format.ts'],
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
const { money } = await import(moduleUrl)
const cases = [
  [105, '¥105'],
  [-105, '-¥105'],
  [-760, '-¥760'],
  [0, '¥0'],
  [null, '-']
]
for (const [input, expected] of cases) {
  const actual = money(input)
  if (actual !== expected) {
    throw new Error(`money(${input}) expected ${expected}, got ${actual}`)
  }
}
console.log(`money-format PASS: ${cases.length} cases`)
