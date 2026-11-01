import { createSSRApp } from 'vue'
import App from './App.vue'
import { toastError } from '@/composables/toast'
import { installPermissionGuard } from '@/roles/guard'
import { brandPageStyle } from '@/domains/identity/brandTheme'

export function createApp() {
  installPermissionGuard()
  const app = createSSRApp(App)
  Object.defineProperty(app.config.globalProperties, '$brandThemePageStyle', {
    get: () => brandPageStyle.value,
    enumerable: true
  })
  app.config.errorHandler = (error) => {
    console.error('[装得清] 未处理异常', error)
    toastError(error)
  }
  return { app }
}
