/// <reference types="vite/client" />

/** 构建期注入的发布版本号，来源 package.json#version（见 vite.config.ts）。 */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_API_BASE: string
  readonly VITE_APP_ENV: 'development' | 'production'
  readonly VITE_AGREEMENT_VERSION: string
  readonly VITE_PRIVACY_VERSION: string
  readonly VITE_LEGAL_REVIEWED: string
  readonly VITE_LEGAL_SUBJECT: string
  readonly VITE_LEGAL_CONTACT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
