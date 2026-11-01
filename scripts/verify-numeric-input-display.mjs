import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const sourceRoot = path.join(root, 'src')
const failures = []
let checked = 0

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(target)
    return entry.name.endsWith('.vue') ? [target] : []
  })
}

function attr(tag, name) {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] || ''
}

for (const file of walk(sourceRoot)) {
  const source = fs.readFileSync(file, 'utf8')
  for (const match of source.matchAll(/<input\b[\s\S]*?\/?>/g)) {
    const tag = match[0]
    if (!/\btype="(?:digit|number)"/.test(tag)) continue
    checked += 1
    const classes = attr(tag, 'class').split(/\s+/).filter(Boolean)
    const placeholderClasses = attr(tag, 'placeholder-class').split(/\s+/).filter(Boolean)
    const placeholderStyle = attr(tag, 'placeholder-style')
    const relative = path.relative(root, file)
    if (!classes.includes('jz-numeric-input')) failures.push(`${relative}: 缺少 jz-numeric-input`)
    if (!placeholderClasses.includes('jz-number-placeholder')) failures.push(`${relative}: 缺少 jz-number-placeholder`)
    if (!/text-align\s*:\s*right/i.test(placeholderStyle)) failures.push(`${relative}: 缺少 placeholder-style text-align: right`)
  }
}

const numberInput = fs.readFileSync(path.join(sourceRoot, 'components/JzNumberInput/JzNumberInput.vue'), 'utf8')
if (!/placeholder-class="jz-number-input__placeholder"/.test(numberInput)) failures.push('JzNumberInput: 缺少组件占位样式类')
if (!/placeholder-style="text-align: right"/.test(numberInput)) failures.push('JzNumberInput: 缺少占位右对齐')
if (!/\.jz-number-input__placeholder\s*\{[^}]*text-align:\s*right/s.test(numberInput)) failures.push('JzNumberInput: 占位样式未右对齐')

const base = fs.readFileSync(path.join(sourceRoot, 'styles/base.scss'), 'utf8')
if (!/\.jz-number-placeholder\s*\{[^}]*text-align:\s*right/s.test(base)) failures.push('base.scss: 缺少 jz-number-placeholder 右对齐')

if (failures.length) {
  console.error(`numeric-input-display FAIL (${failures.length})`)
  failures.forEach((item) => console.error(`- ${item}`))
  process.exit(1)
}

console.log(`numeric-input-display PASS: ${checked} inputs`)
