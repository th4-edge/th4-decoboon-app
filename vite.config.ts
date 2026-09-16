import { defineConfig, loadEnv } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBase = (env.VITE_API_BASE || '').trim()
  if (!apiBase) throw new Error('VITE_API_BASE 不能为空')
  if (!apiBase.endsWith('/')) throw new Error('VITE_API_BASE 必须以 / 结尾')
  if (mode === 'production' && !apiBase.startsWith('https://')) {
    throw new Error('生产构建 VITE_API_BASE 必须使用 HTTPS')
  }
  if (mode !== 'production' && !apiBase.startsWith('http://') && !apiBase.startsWith('https://')) {
    throw new Error('开发构建 VITE_API_BASE 必须是可访问的 HTTP(S) 地址')
  }
  const required = [
    'VITE_AGREEMENT_VERSION',
    'VITE_PRIVACY_VERSION',
    'VITE_LEGAL_REVIEWED',
    'VITE_LEGAL_SUBJECT',
    'VITE_LEGAL_CONTACT'
  ]
  const missing = required.filter((key) => !(env[key] || '').trim())
  if (missing.length) throw new Error(`缺少发布合规配置: ${missing.join(', ')}`)

  return {
    plugins: [uni()],
    server: {
      port: 8080,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8090',
          changeOrigin: true
        }
      }
    }
  }
})
