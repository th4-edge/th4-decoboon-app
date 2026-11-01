import { defineConfig, loadEnv } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import pkg from './package.json'

/** 所有页面在编译期注入 page-meta，让同一套品牌 CSS 变量覆盖主包与全部分包页面。 */
function brandThemePageMeta() {
  return {
    name: 'zdq-brand-theme-page-meta',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      const normalized = id.replace(/\\/g, '/')
      if (!/\/src\/(?:pages|subpackages\/[^/]+\/pages)\/.+\.vue$/.test(normalized)) return null
      if (!code.includes('<template>') || code.includes('$brandThemePageStyle')) return null
      return code.replace('<template>', '<template>\n  <page-meta :page-style="$brandThemePageStyle" />')
    }
  }
}

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
    // 发布版本唯一真源：package.json#version，避免「我的-关于装得清」等处版本与发版号漂移。
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version)
    },
    plugins: [brandThemePageMeta(), uni()],
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
