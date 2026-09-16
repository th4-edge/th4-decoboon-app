#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const errors = []
const warnings = []
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(root, file))

function walk(dir) {
  const full = path.join(root, dir)
  if (!fs.existsSync(full)) return []
  const files = []
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const child = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(child))
    else files.push(child.replaceAll(path.sep, '/'))
  }
  return files
}

function dirSize(dir) {
  const full = path.join(root, dir)
  if (!fs.existsSync(full)) return 0
  let size = 0
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const child = path.join(dir, entry.name)
    size += entry.isDirectory() ? dirSize(child) : fs.statSync(path.join(root, child)).size
  }
  return size
}

const pagesJson = JSON.parse(read('src/pages.json'))
const mainPages = (pagesJson.pages || []).map((page) => page.path)
const subPackages = pagesJson.subPackages || []
const subPages = subPackages.flatMap((pkg) => pkg.pages.map((page) => `${pkg.root}/${page.path}`))
const listedPages = [...mainPages, ...subPages]
const listedSet = new Set(listedPages)

if (!exists('src/config/index.ts')) errors.push('缺少 src/config/index.ts')
const config = read('src/config/index.ts')
const routeLiterals = [...config.matchAll(/['"](\/(?:pages|subpackages)\/[^'"]+)['"]/g)].map((match) => match[1].slice(1))

for (const page of listedPages) {
  if (!exists(`src/${page}.vue`)) errors.push(`pages.json 登记但文件不存在: src/${page}.vue`)
}
if (new Set(listedPages).size !== listedPages.length) errors.push('pages.json 存在重复页面路径')

const physicalPages = [
  ...walk('src/pages').filter((file) => file.endsWith('.vue')),
  ...walk('src/subpackages').filter((file) => /\/pages\/.*\.vue$/.test(file))
].map((file) => file.replace(/^src\//, '').replace(/\.vue$/, ''))

for (const page of physicalPages) {
  if (!listedSet.has(page)) errors.push(`页面文件未登记到 pages.json: src/${page}.vue`)
}

for (const route of routeLiterals) {
  if (!listedSet.has(route)) errors.push(`路由常量指向未登记页面: /${route}`)
}
for (const page of listedPages) {
  if (!routeLiterals.includes(page)) errors.push(`pages.json 页面缺少集中路由常量: /${page}`)
}

const requiredMainTabs = [
  'pages/index/index',
  'pages/project/list',
  'pages/customer/list',
  'pages/dynamic/index',
  'pages/mine/index',
  'pages/finance/index'
]
for (const page of requiredMainTabs) {
  if (!mainPages.includes(page)) errors.push(`自定义 Tab/主包页面不得下沉: ${page}`)
}

const sourceFiles = walk('src').filter((file) => /\.(vue|ts|js)$/.test(file))
for (const file of sourceFiles) {
  const source = read(file)
  for (const match of source.matchAll(/@\/subpackages\/([^/'"`]+)/g)) {
    const owner = file.startsWith('src/subpackages/') ? file.split('/')[2] : null
    if (owner !== match[1]) {
      errors.push(`${owner ? '跨分包' : '主包'}私有引用: ${file} -> @/subpackages/${match[1]}`)
    }
  }
}

const preload = pagesJson.preloadRule || {}
const packageRoots = new Set(subPackages.map((pkg) => pkg.root))
for (const [page, rule] of Object.entries(preload)) {
  if (!mainPages.includes(page)) errors.push(`preloadRule 只能配置主包页面: ${page}`)
  for (const target of rule.packages || []) {
    if (!packageRoots.has(target)) errors.push(`preloadRule 引用了不存在的分包: ${page} -> ${target}`)
  }
}

const builtRoot = 'dist/build/mp-weixin'
if (exists(`${builtRoot}/app.json`)) {
  const builtApp = JSON.parse(read(`${builtRoot}/app.json`))
  const builtTotal = dirSize(builtRoot)
  const builtSubs = (builtApp.subPackages || []).map((pkg) => [pkg.root, dirSize(`${builtRoot}/${pkg.root}`)])
  const subTotal = builtSubs.reduce((sum, [, size]) => sum + size, 0)
  const mainSize = builtTotal - subTotal
  const limits = {
    main: 2 * 1024 * 1024,
    sub: 2 * 1024 * 1024,
    total: 20 * 1024 * 1024
  }
  if (mainSize > limits.main) errors.push(`主包超限: ${mainSize} bytes > ${limits.main}`)
  for (const [name, size] of builtSubs) {
    if (size > limits.sub) errors.push(`分包超限: ${name} ${size} bytes > ${limits.sub}`)
  }
  if (builtTotal > limits.total) errors.push(`总包超限: ${builtTotal} bytes > ${limits.total}`)
  console.log(`构建体积: 主包 ${mainSize} B, 最大分包 ${Math.max(...builtSubs.map(([, size]) => size))} B, 总包 ${builtTotal} B`)
} else {
  warnings.push('未找到 dist/build/mp-weixin/app.json，体积检查已跳过；请先执行 npm run build:mp-weixin')
}

console.log(`分包清单: 主包 ${mainPages.length} 页, 分包 ${subPackages.length} 个 / ${subPages.length} 页`)
for (const warning of warnings) console.warn(`警告: ${warning}`)
if (errors.length) {
  for (const error of errors) console.error(`错误: ${error}`)
  process.exit(1)
}
console.log('分包规范检查通过')
