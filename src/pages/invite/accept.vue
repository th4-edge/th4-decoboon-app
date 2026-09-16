<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { identityApi } from '@/domains/identity/api'
import type { InviteCode } from '@/domains/identity/model'
import { loginAsCustomer, loginAsEmployee, loginAsToken, session } from '@/domains/identity/session'
import { ROLE_META } from '@/roles/catalog'
import { confirm, hideLoading, loading, toast, toastError } from '@/composables/toast'
import { useWxPhoneAuth } from '@/composables/useWxAuth'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzTag from '@/components/JzTag.vue'
import JzIcon from '@/components/JzIcon.vue'

const inviteId = ref('')
const token = ref('')
const inviteMode = ref<'member' | 'customer'>('member')
const invite = ref<InviteCode | null>(null)
const submitting = ref(false)
const { handlePhoneNumber } = useWxPhoneAuth()
const isCustomerInvite = computed(() => inviteMode.value === 'customer')
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
  inviteMode.value = query?.type === 'customer' || token.value ? 'customer' : 'member'
  if (!inviteId.value && !token.value) { toast('邀请参数缺失'); return }

  // 业主：已完成绑定（当前已是业主身份）时再次打开邀请链接，直接进入我的家
  if (isCustomerInvite.value && session.token && session.role === 'customer') {
    uni.reLaunch({ url: P.home })
    return
  }

  try {
    await loadInvite()
    // 员工：已完成手机号授权并加入企业（邀请已使用 + 当前已有员工身份）时，
    // 再次点开邀请链接不再重复授权，直接进入工作台
    if (!isCustomerInvite.value && session.token && session.role && invite.value?.status === 'accepted') {
      uni.reLaunch({ url: P.home })
    }
  } catch (error) {
    toastError(error, '邀请加载失败')
  }
})

async function loadInvite() {
  invite.value = isCustomerInvite.value
    ? await identityApi.customerInvitationInfo({ inviteId: inviteId.value || undefined, token: token.value || undefined })
    : await identityApi.invitationInfo(inviteId.value)
}

async function accept(event: { detail?: { code?: string; errMsg?: string } }) {
  const auth = handlePhoneNumber(event)
  if (!auth || auth.cancelled) return
  const phoneCode = auth.phoneCode
  submitting.value = true
  loading(isCustomerInvite.value ? '正在绑定我的家…' : '正在校验邀请…')
  try {
    const loginResult = await new Promise<UniApp.LoginRes>((resolve, reject) => {
      uni.login({ provider: 'weixin', success: resolve, fail: reject })
    })
    const userProfile = await new Promise<UniApp.GetUserProfileRes>((resolve) => {
      uni.getUserProfile({ desc: isCustomerInvite.value ? '用于业主身份展示' : '用于员工头像和姓名展示', success: resolve, fail: () => resolve({} as UniApp.GetUserProfileRes) })
    })
    const nickname = userProfile.userInfo?.nickName
    const avatarUrl = userProfile.userInfo?.avatarUrl
    const sessionToken = await identityApi.wxLogin({ code: loginResult.code, phoneCode, nickname, avatarUrl })
    loginAsToken(sessionToken.token)
    const profile = await identityApi.sessionInfo(sessionToken.token)

    if (isCustomerInvite.value) {
      if (profile.currentEmployee) throw new Error('当前微信已绑定企业员工身份，请使用业主本人微信接受邀请')
      const acceptedToken = await identityApi.acceptCustomerInvite({
        inviteId: inviteId.value || undefined,
        token: token.value || undefined
      })
      loginAsToken(acceptedToken.token)
      const ownerProfile = await identityApi.sessionInfo(acceptedToken.token)
      if (ownerProfile.sessionType !== 'Customer' || !ownerProfile.customerAccesses?.length) {
        throw new Error('业主授权未生效，请稍后重试')
      }
      loginAsCustomer(ownerProfile, acceptedToken.token)
      hideLoading()
      toast(`已绑定${invite.value?.projectName || '我的家'}`, 'success')
      uni.reLaunch({ url: P.home })
      return
    }

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
    toastError(error, isCustomerInvite.value ? '绑定我的家失败' : session.token ? '加入企业失败' : '微信登录失败')
  } finally {
    submitting.value = false
  }
}

function roleLabel() {
  const role = invite.value?.role
  return role && role !== 'customer' && ROLE_META[role] ? ROLE_META[role].label : '企业成员'
}
</script>

<template>
  <view class="invite-page">
    <JzPageHeader :title="isCustomerInvite ? '绑定我的家' : '加入企业'" :subtitle="isCustomerInvite ? '微信授权手机号后绑定业主项目' : '微信授权手机号后校验邀请归属'" />
    <view class="invite-body">
      <view v-if="invite" class="invite-card jz-card">
        <view class="invite-company">
          <view class="invite-logo"><JzIcon :name="isCustomerInvite ? 'home' : 'building'" :size="48" color="#FFFFFF" /></view>
          <view class="jz-grow">
            <text class="invite-company__name">{{ isCustomerInvite ? (invite.projectName || '我的家') : (invite.companyId || invite.company?.name || '邀请企业') }}</text>
            <text class="invite-company__sub">{{ isCustomerInvite ? (invite.propertyAddress || '项目进度同频授权') : `邀请人 ${invite.inviter?.name || '企业管理员'}` }}</text>
          </view>
          <JzTag :text="statusText" :color="invite.status === 'pending' ? '#07A35A' : '#E5484D'" />
        </view>
        <view v-if="isCustomerInvite" class="invite-info">
          <view><text>项目</text><text>{{ invite.projectName || '待绑定' }}</text></view>
          <view><text>房屋</text><text>{{ invite.propertyAddress || '以项目地址为准' }}</text></view>
          <view><text>业主</text><text>{{ invite.customerName || invite.inviteName || '待授权' }}</text></view>
          <view><text>手机号</text><text>{{ invite.maskedTelNo || '微信授权后校验' }}</text></view>
        </view>
        <view v-else class="invite-info">
          <view><text>被邀请人</text><text>{{ invite.inviteName || '待授权' }}</text></view>
          <view><text>手机号</text><text>{{ invite.telNo }}</text></view>
          <view><text>岗位</text><text>{{ roleLabel() }}</text></view>
          <view><text>门店</text><text>{{ invite.store?.name || '默认门店' }}</text></view>
          <view><text>团队</text><text>{{ invite.team?.name || '未分配' }}</text></view>
        </view>
        <view class="invite-check"><JzIcon name="shield-check" :size="30" color="#0E8A7D" /><text>{{ isCustomerInvite ? '绑定后仅可查看本项目已授权内容，手机号由服务端校验' : '服务端将校验微信授权手机号与邀请手机号一致' }}</text></view>
      </view>
      <view v-else class="invite-loading jz-card"><text>正在加载邀请…</text></view>

      <button v-if="invite?.status === 'pending'" class="jz-btn jz-btn--primary jz-btn--block invite-submit"
              open-type="getPhoneNumber" :loading="submitting" @getphonenumber="accept">
        {{ isCustomerInvite ? '微信授权手机号并绑定我的家' : '微信授权手机号并加入' }}
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.invite-page { min-height: 100vh; background: $jzb-bg-page; }
.invite-body { padding: 28rpx; }
.invite-card { padding: 28rpx; }
.invite-company { display: flex; align-items: center; gap: 18rpx; padding-bottom: 24rpx; border-bottom: 1rpx solid $jzb-border-light; }
.invite-logo { display: flex; align-items: center; justify-content: center; width: 92rpx; height: 92rpx; background: $jzb-gradient; border-radius: 28rpx; }
.invite-company__name { display: block; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 750; }
.invite-company__sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.invite-info { padding-top: 10rpx; }
.invite-info > view { display: flex; justify-content: space-between; padding: 20rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.invite-info > view text:first-child { color: $jzb-text-3; }
.invite-info > view text:last-child { color: $jzb-text-1; font-weight: 600; }
.invite-check { display: flex; align-items: flex-start; gap: 12rpx; margin-top: 24rpx; padding: 20rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: $jzb-radius-sm; font-size: $jzb-font-xs; line-height: 1.6; }
.invite-submit { margin-top: 32rpx; }
.invite-loading { padding: 80rpx; color: $jzb-text-3; text-align: center; }
</style>
