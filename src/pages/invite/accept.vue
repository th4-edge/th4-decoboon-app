<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { identityApi } from '@/domains/identity/api'
import type { InviteCode } from '@/domains/identity/model'
import { loginAsEmployee, loginAsToken, session } from '@/domains/identity/session'
import { ROLE_META } from '@/roles/catalog'
import { confirm, hideLoading, loading, toast, toastError } from '@/composables/toast'
import { useWxPhoneAuth } from '@/composables/useWxAuth'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzTag from '@/components/JzTag.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzBrandLogo from '@/components/JzBrandLogo.vue'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'

const inviteId = ref('')
const token = ref('')
const invite = ref<InviteCode | null>(null)
const submitting = ref(false)
const loadError = ref('')
const { handlePhoneNumber } = useWxPhoneAuth()
const statusText = computed(() => {
  const status = invite.value?.status
  if (status === 'pending') return '邀请有效'
  if (status === 'accepted') return '邀请已使用'
  if (status === 'expired') return '邀请已过期'
  if (status === 'cancelled') return '邀请已撤销'
  if (status === 'rejected') return '邀请已拒绝'
  return '邀请不可用'
})

onLoad(async (query) => {
  inviteId.value = query?.inviteId || ''
  token.value = query?.token || ''
  // P0：业主邀请不再走本页。历史链接（type=customer 或带邀请串）自动转到业主专用页，
  // 既保证已发出的邀请不失效，也让本页只服务员工邀请，不再"猜参数"。
  if (query?.type === 'customer' || token.value) {
    const qs = [inviteId.value ? `inviteId=${encodeURIComponent(inviteId.value)}` : '',
      token.value ? `token=${encodeURIComponent(token.value)}` : ''].filter(Boolean).join('&')
    // 注意：onLoad 期间 redirectTo 可能因为页面尚未入栈而静默失败，这里用 reLaunch
    uni.reLaunch({ url: `${P.ownerEnter}${qs ? '?' + qs : ''}` })
    return
  }
  if (!inviteId.value && !token.value) {
    loadError.value = '邀请参数缺失，请重新打开邀请人发送的完整链接。'
    return
  }

  // 业主：已完成绑定（当前已是业主身份）时再次打开邀请链接，直接进入我的家
  try {
    await loadInvite()
    // 员工：已完成手机号授权并加入企业（邀请已使用 + 当前已有员工身份）时，
    // 再次点开邀请链接不再重复授权，直接进入工作台
    if (session.token && session.role && invite.value?.status === 'accepted') {
      uni.reLaunch({ url: P.home })
    }
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '邀请加载失败'
    toastError(error, '邀请加载失败')
  }
})

async function loadInvite() {
  invite.value = await identityApi.invitationInfo(inviteId.value)
}

async function accept(event: { detail?: { code?: string; errMsg?: string } }) {
  const auth = handlePhoneNumber(event)
  if (!auth || auth.cancelled) return
  const phoneCode = auth.phoneCode
  submitting.value = true
  loading('正在校验邀请…')
  try {
    const loginResult = await new Promise<UniApp.LoginRes>((resolve, reject) => {
      uni.login({ provider: 'weixin', success: resolve, fail: reject })
    })
    const userProfile = await new Promise<UniApp.GetUserProfileRes>((resolve) => {
      uni.getUserProfile({ desc: '用于员工头像和姓名展示', success: resolve, fail: () => resolve({} as UniApp.GetUserProfileRes) })
    })
    const nickname = userProfile.userInfo?.nickName
    const avatarUrl = userProfile.userInfo?.avatarUrl
    const sessionToken = await identityApi.wxLogin({ code: loginResult.code, phoneCode, nickname, avatarUrl })
    loginAsToken(sessionToken.token)
    const profile = await identityApi.sessionInfo(sessionToken.token)

    const switching = !!profile.currentEmployee
    if (switching) {
      hideLoading()
      const ok = await confirm('确认切换企业',
        `将从 ${profile.currentEmployee?.company?.name || '当前企业'} 退出，并加入 ${invite.value?.company?.name || '目标企业'}。退出后原企业数据不可访问，且受冷却期与频率限制。`,
        '确认切换')
      if (!ok) { submitting.value = false; return }
      loading('正在切换企业…')
    }
    const employeeToken = await identityApi.acceptInvite({
      inviteId: inviteId.value,
      name: invite.value?.inviteName || nickname,
      avatarUrl,
      confirmSwitch: switching,
      reason: switching ? '用户主动切换企业' : undefined
    })
    loginAsToken(employeeToken.token)
    const accepted = await identityApi.sessionInfo(employeeToken.token)
    if (!accepted.currentEmployee) throw new Error('加入企业失败')
    loginAsEmployee(accepted.currentEmployee, employeeToken.token, accepted)
    hideLoading()
    toast(`已加入${accepted.currentEmployee.company?.name || '企业'}`, 'success')
    uni.reLaunch({ url: P.home })
  } catch (error) {
    hideLoading()
    toastError(error, session.token ? '加入企业失败' : '手机号快捷登录失败')
  } finally {
    submitting.value = false
  }
}

function backToLogin() { uni.reLaunch({ url: P.login }) }

function roleLabel() {
  const role = invite.value?.role
  return role && role !== 'customer' && ROLE_META[role] ? ROLE_META[role].label : '企业成员'
}
</script>

<template>
  <view class="invite-page">
    <JzPageHeader title="加入企业" subtitle="手机号快捷登录后校验邀请归属" />
    <view class="invite-body">
      <view v-if="invite" class="invite-card jz-card">
        <view class="invite-company">
          <JzBrandLogo class="invite-logo" variant="white" :size="92" />
          <view class="jz-grow">
            <text class="invite-company__name">{{ invite.company?.name || invite.companyId || '邀请企业' }}</text>
            <text class="invite-company__sub">邀请人 {{ invite.inviter?.name || '企业管理员' }}</text>
          </view>
          <JzTag :text="statusText" :color="invite.status === 'pending' ? TOKEN_COLOR.success : TOKEN_COLOR.danger" />
        </view>
        <view class="invite-info">
          <view><text>被邀请人</text><text>{{ invite.inviteName || '待授权' }}</text></view>
          <view><text>手机号</text><text>{{ invite.telNo }}</text></view>
          <view><text>岗位</text><text>{{ roleLabel() }}</text></view>
          <view><text>门店</text><text>{{ invite.store?.name || '默认门店' }}</text></view>
          <view><text>团队</text><text>{{ invite.team?.name || '未分配' }}</text></view>
        </view>
        <view class="invite-check"><JzIcon name="shield-check" :size="30" :color="TOKEN_COLOR.primary" /><text>系统会核对快捷登录手机号与邀请手机号是否一致</text></view>
      </view>
      <view v-else-if="loadError" class="invite-error jz-card">
        <JzIcon name="alert-circle" :size="42" :color="TOKEN_COLOR.danger" />
        <text class="invite-error__title">邀请不可用</text>
        <text class="invite-error__text">{{ loadError }}</text>
        <button class="jz-btn jz-btn--ghost jz-btn--block" @tap="backToLogin">返回登录</button>
      </view>
      <view v-else class="invite-loading jz-card"><text>正在加载邀请…</text></view>

      <button v-if="invite?.status === 'pending'" class="jz-btn jz-btn--primary jz-btn--block invite-submit"
              open-type="getPhoneNumber" :loading="submitting" @getphonenumber="accept">
        手机号快捷登录并加入
      </button>
    </view>
  </view>
    <JzConfirmDialog />
</template>

<style lang="scss" scoped>
.invite-page { min-height: 100vh; background: $jzb-bg-page; }
.invite-body { padding: 28rpx; }
.invite-card { padding: 28rpx; }
.invite-company { display: flex; align-items: center; gap: 18rpx; padding-bottom: 24rpx; border-bottom: 1rpx solid $jzb-border-light; }
.invite-logo { border-radius: 28rpx; }
.invite-company__name { display: block; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 750; }
.invite-company__sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.invite-info { padding-top: 10rpx; }
.invite-info > view { display: flex; justify-content: space-between; padding: 20rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.invite-info > view text:first-child { color: $jzb-text-3; }
.invite-info > view text:last-child { color: $jzb-text-1; font-weight: 600; }
.invite-check { display: flex; align-items: flex-start; gap: 12rpx; margin-top: 24rpx; padding: 20rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: $jzb-radius-sm; font-size: $jzb-font-xs; line-height: 1.6; }
.invite-submit { margin-top: 32rpx; }
.invite-loading { padding: 80rpx; color: $jzb-text-3; text-align: center; }
.invite-error { padding: 48rpx 28rpx; display: flex; flex-direction: column; align-items: center; text-align: center; }
.invite-error__title { display: block; margin-top: 18rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.invite-error__text { display: block; margin: 12rpx 0 28rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.6; }
</style>
