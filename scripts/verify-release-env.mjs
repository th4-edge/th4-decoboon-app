import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const envFile = process.env.RELEASE_ENV_FILE || path.join(root, '.env.production')
const failures = []

function parseEnv(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`发布环境文件不存在: ${file}`)
  }
  const values = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index < 1) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    values[key] = value
  }
  return values
}

function value(env, key) {
  return (process.env[key] ?? env[key] ?? '').trim()
}

function placeholder(valueToCheck) {
  const normalized = valueToCheck.toLowerCase()
  return !valueToCheck
    || normalized.includes('待')
    || normalized.includes('placeholder')
    || normalized.includes('example')
    || normalized.includes('draft')
    || normalized === 'todo'
    || normalized === 'tbd'
    || normalized === 'test'
}

function reservedHost(hostname) {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === 'api.invalid' || host.endsWith('.invalid')) return true
  if (host.endsWith('.test') || host.endsWith('.example')) return true
  if (host === 'example.com' || host.endsWith('.example.com')) return true
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true
  const private172 = host.match(/^172\.(\d+)\./)
  return !!private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31
}

let env = {}
try {
  env = parseEnv(envFile)
} catch (error) {
  console.error(`Release gate failed:\n- ${error.message}`)
  process.exit(1)
}

if (value(env, 'VITE_APP_ENV') !== 'production') {
  failures.push('VITE_APP_ENV 必须为 production')
}

const apiBase = value(env, 'VITE_API_BASE')
try {
  const parsed = new URL(apiBase)
  if (parsed.protocol !== 'https:') failures.push('VITE_API_BASE 必须使用 HTTPS')
  if (reservedHost(parsed.hostname)) failures.push(`VITE_API_BASE 不得使用保留或占位域名: ${parsed.hostname}`)
  if (!parsed.pathname.endsWith('/')) failures.push('VITE_API_BASE 路径必须以 / 结尾')
} catch {
  failures.push('VITE_API_BASE 不是有效 URL')
}

const manifestPath = path.join(root, 'src/manifest.json')
let appid = ''
try {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  appid = String(manifest?.['mp-weixin']?.appid || '').trim()
} catch (error) {
  failures.push(`无法读取 src/manifest.json: ${error.message}`)
}
if (!/^wx[a-fA-F0-9]{16}$/.test(appid)) {
  failures.push(`微信 AppID 非法或仍为占位值: ${appid || '<empty>'}`)
}

for (const key of ['VITE_AGREEMENT_VERSION', 'VITE_PRIVACY_VERSION', 'VITE_LEGAL_SUBJECT', 'VITE_LEGAL_CONTACT']) {
  const current = value(env, key)
  if (placeholder(current)) failures.push(`${key} 缺失或仍为占位值: ${current || '<empty>'}`)
}
if (value(env, 'VITE_LEGAL_REVIEWED') !== 'true') {
  failures.push('VITE_LEGAL_REVIEWED 必须为 true')
}

const placeholderTerms = ['待法务审核', '待补充', 'touristappid', 'api.invalid']
const releaseCriticalFiles = [
  path.join(root, 'src/pages/legal/agreement.vue'),
  path.join(root, 'src/pages/legal/privacy.vue'),
  manifestPath,
  path.join(root, 'src/config/index.ts')
]
for (const file of releaseCriticalFiles) {
  if (!fs.existsSync(file)) {
    failures.push(`发布关键文件不存在: ${path.relative(root, file)}`)
    continue
  }
  const text = fs.readFileSync(file, 'utf8')
  for (const term of placeholderTerms) {
    if (text.includes(term)) failures.push(`${path.relative(root, file)} 仍包含发布占位文本: ${term}`)
  }
}

if (failures.length) {
  console.error('Release gate failed:')
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Release gate passed: production environment and compliance inputs are complete.')
