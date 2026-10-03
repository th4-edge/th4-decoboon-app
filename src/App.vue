<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { initSession, loginAsCustomer, loginAsEmployee, loginAsUser, session } from '@/domains/identity/session'
import { identityApi } from '@/domains/identity/api'
import { P } from '@/config'
import { canVisit, hasRouteRule } from '@/roles/guard'

onLaunch(() => {
  initSession()
  console.log('[装得清] App Launch', { role: session.role })
})

onShow(() => {
  refreshIdentity().finally(scheduleRouteGuard)
})

/**
 * uni.addInterceptor 覆盖站内跳转，但无法拦截小程序冷启动直达页。
 * 页面栈形成后补一次能力校验，避免无权限深链打开错误页（XA-20261004-002）。
 */
function scheduleRouteGuard() {
  setTimeout(enforceCurrentPageAccess, 0)
  setTimeout(enforceCurrentPageAccess, 100)
}

function enforceCurrentPageAccess() {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1]
  const route = current?.route
  if (!route) return
  const url = `/${route}`
  if (!hasRouteRule(url)) return
  if (!canVisit(url)) uni.reLaunch({ url: P.home })
}

async function refreshIdentity() {
  if (!session.token || !session.role) return
  try {
    const profile = await identityApi.sessionInfo()
    if (profile.currentEmployee) loginAsEmployee(profile.currentEmployee, session.token, profile)
    else if (profile.sessionType === 'Customer' && profile.customerAccesses?.length) loginAsCustomer(profile, session.token)
    else loginAsUser(profile, session.token)
  } catch {
    // 401 由 HTTP 层统一清理会话；网络异常保留本地会话，避免离线启动被强制退出。
  }
}
</script>

<style lang="scss">
@import '@/styles/base.scss';
</style>
