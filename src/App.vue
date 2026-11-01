<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { watch } from 'vue'
import { clearSession, initSession, loginAsCustomer, loginAsEmployee, loginAsUser, logout, session } from '@/domains/identity/session'
import { identityApi } from '@/domains/identity/api'
import { loadStoreScope } from '@/domains/identity/storeScope'
import { P } from '@/config'
import type { PendingEntryInvite } from '@/domains/identity/model'
import { canVisit, hasRouteRule } from '@/roles/guard'
import { ProviderRequestError, setUnauthorizedHandler } from '@/core/http'
import { applyBrandTheme } from '@/domains/identity/brandTheme'

setUnauthorizedHandler(clearSession)

watch(
  () => session.company?.color,
  (color) => applyBrandTheme(color),
  { immediate: true }
)

onLaunch(() => {
  initSession()
  console.log('[装得清] App Launch', { role: session.role })
})

onShow(() => {
  if (session.role === 'teamLeader') {
    rejectFrozenRole('团队负责人角色已冻结，请联系企业负责人改为其他岗位')
    return
  }
  refreshIdentity().finally(() => {
    if (session.token && session.role) void loadStoreScope()
    scheduleRouteGuard()
  })
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
  if (!session.token) return
  try {
    const profile = await identityApi.sessionInfo()
    if (profile.currentEmployee) {
      loginAsEmployee(profile.currentEmployee, session.token, profile)
      redirectJoinedUserHome()
    } else if (profile.sessionType === 'Customer' && profile.customerAccesses?.length) {
      loginAsCustomer(profile, session.token)
      redirectJoinedUserHome()
    } else {
      loginAsUser(profile, session.token)
      const pending = await identityApi.pendingEntryInvites()
      if (pending.length) uni.reLaunch({ url: pendingEntriesLandingUrl(pending) })
    }
  } catch (error) {
    if (error instanceof ProviderRequestError && error.code === '403') {
      rejectFrozenRole(error.message)
      return
    }
    // 401 由 HTTP 层统一清理会话；网络异常保留本地会话，避免离线启动被强制退出。
  }
}

function pendingEntriesLandingUrl(invites: PendingEntryInvite[]): string {
  if (invites.length !== 1) return P.inviteDiscover
  const invite = invites[0]
  const query = `inviteId=${encodeURIComponent(invite.id)}`
  return invite.type === 'customer' ? `${P.ownerEnter}?${query}` : `${P.inviteAccept}?${query}`
}

function redirectJoinedUserHome(): void {
  if (!session.role) return
  const current = getCurrentPages()[getCurrentPages().length - 1]
  const route = current?.route ? `/${current.route}` : ''
  const entryPages = new Set<string>([P.login, P.companyJoin, P.inviteAccept, P.inviteDiscover, P.ownerEnter])
  if (!entryPages.has(route)) return
  uni.reLaunch({
    url: P.home,
    fail: () => uni.switchTab({ url: P.home })
  })
}

let frozenRoleRedirecting = false
function rejectFrozenRole(message: string): void {
  if (frozenRoleRedirecting) return
  frozenRoleRedirecting = true
  void logout()
  uni.reLaunch({
    url: P.login,
    complete: () => {
      frozenRoleRedirecting = false
      uni.showToast({
        title: message || '团队负责人角色已冻结，请联系企业负责人改为其他岗位',
        icon: 'none',
        duration: 3000
      })
    }
  })
}
</script>

<style lang="scss">
@import '@/styles/base.scss';
@import '@/styles/owner.scss';
</style>
