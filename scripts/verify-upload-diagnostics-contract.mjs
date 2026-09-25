import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

const http = read('src/core/http.ts')
const docs = read('docs/18-生产上传域名排查.md')
const packageJson = JSON.parse(read('package.json'))
const failures = []
const expect = (condition, message) => {
  if (!condition) failures.push(message)
}

// 上传失败必须区分微信 uploadFile 域名配置和普通网络抖动，不能再吞成统一“网络异常”。
expect(http.includes("scope: 'request' | 'upload'"), '上传错误处理缺少 request/upload 场景区分')
expect(http.includes("normalized.includes('url not in domain list')"), '未识别微信 uploadFile 域名未配置错误')
expect(http.includes('微信 uploadFile 合法域名'), '上传域名错误提示不明确')
expect(http.includes("reject(requestFailure(error, 'upload'))"), 'uni.uploadFile fail 未走上传专用错误映射')
expect(http.includes("normalized.includes('ssl')") && http.includes('检查 HTTPS 证书'), '上传证书异常缺少诊断提示')

// 发布文档必须明确 request 与 uploadFile 是两套域名，并包含正式域名和真机验证门禁。
expect(docs.includes('request') && docs.includes('uploadFile') && docs.includes('downloadFile'),
  '生产上传排查文档未覆盖三类微信合法域名')
expect(docs.includes('https://decoboon.joytsing.com'), '生产上传排查文档缺少正式业务域名')
expect(docs.includes('uploadFile 合法域名'), '生产上传排查文档缺少 uploadFile 配置步骤')
expect(docs.includes('仅配置 `request` 域名不得视为上传域名已配置'), '发布门禁未明确 uploadFile 不能由 request 覆盖')

expect(packageJson.scripts['check:upload'] === 'node scripts/verify-upload-diagnostics-contract.mjs',
  'package.json 缺少 check:upload 脚本')
expect(packageJson.scripts['verify:mp-weixin']?.includes('npm run check:upload'),
  '发布前校验未纳入上传诊断契约')

if (failures.length) {
  console.error('上传诊断契约校验失败：')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('上传诊断契约校验通过：uploadFile 域名错误可识别，发布前门禁已明确三类合法域名。')
