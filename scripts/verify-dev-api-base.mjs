import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const envFile = ['.env.development', '.env'].find((file) => fs.existsSync(path.join(root, file)))

if (!envFile) {
  console.error('开发环境 API 校验失败：缺少 .env.development 或 .env')
  process.exit(1)
}

const content = fs.readFileSync(path.join(root, envFile), 'utf8')
const match = content.match(/^\s*VITE_API_BASE\s*=\s*(.+?)\s*$/m)
if (!match) {
  console.error(`开发环境 API 校验失败：${envFile} 缺少 VITE_API_BASE`)
  process.exit(1)
}

let url
try {
  url = new URL(match[1])
} catch {
  console.error(`开发环境 API 校验失败：VITE_API_BASE 不是合法 URL：${match[1]}`)
  process.exit(1)
}



console.log(`开发环境 API 校验通过：${envFile} -> ${url.origin}`)
