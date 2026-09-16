<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { initSession, loginAsCustomer, loginAsEmployee, loginAsUser, session } from '@/domains/identity/session'
import { identityApi } from '@/domains/identity/api'

onLaunch(() => {
  initSession()
  console.log('[装得清] App Launch', { role: session.role })
})

onShow(() => {
  refreshIdentity()
})

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
