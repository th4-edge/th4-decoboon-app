<script setup lang="ts">
/**
 * 业主专用入口页（P0 拆分）。
 *
 * 交互要求（用户反馈）：
 * - 业主不再和员工/注册企业共用页面；
 * - 页面上**不出现"邀请码 / 邀请编号 / token / 邀请链接"**等字眼，统一表达为"验证手机号，进入我的家"；
 * - 本次（P0）仍兼容既有的业主邀请参数（inviteId / 邀请链接），保证已发出的邀请不失效；
 *   P1 将改为"手机号 + 客户档案"判定，届时移除参数依赖。
 */
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { identityApi } from '@/domains/identity/api'
import type { InviteCode } from '@/domains/identity/model'
import { loginAsCustomer, loginAsToken, session } from '@/domains/identity/session'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import { useWxPhoneAuth } from '@/composables/useWxAuth'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzBrandLogo from '@/components/JzBrandLogo.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const inviteId = ref('')
const token = ref('')
const invite = ref<InviteCode | null>(null)
const submitting = ref(false)
const loadError = ref('')
const { handlePhoneNumber } = useWxPhoneAuth()

/** 是否带着一条"定向邀请"进来（P0 兼容路径；页面上不以"邀请码"表述） */
const hasDirectInvite = computed(() => !!(inviteId.value || token.value))

onLoad(async (query) => {
  inviteId.value = query?.inviteId || ''
  token.value = query?.token || ''
  // 已是业主身份再次打开：直接进我的家
  if (session.token && session.role === 'customer') {
    uni.reLaunch({ url: P.home })
    return
  }
  if (!hasDirectInvite.value) return // 无参数 → 展示"未找到装修项目"的引导态
  try {
    invite.value = await identityApi.customerInvitationInfo({
      inviteId: inviteId.value || undefined,
      token: token.value || undefined
    })
  } catch (error) {
    loadError.value = '这条邀请已失效或被撤销，请联系您的设计师重新发送'
    toastError(error, loadError.value)
  }
})

async function enter(event: { detail?: { code?: string; errMsg?: string } }) {
  const auth = handlePhoneNumber(event)
  if (!auth || auth.cancelled) return
  submitting.value = true
  loading('正在进入我的家…')
  try {
    const loginResult = await new Promise<UniApp.LoginRes>((resolve, reject) => {
      uni.login({ provider: 'weixin', success: resolve, fail: reject })
    })
    const userProfile = await new Promise<UniApp.GetUserProfileRes>((resolve) => {
      uni.getUserProfile({ desc: '用于业主身份展示', success: resolve, fail: () => resolve({} as UniApp.GetUserProfileRes) })
    })
    const sessionToken = await identityApi.wxLogin({
      code: loginResult.code,
      phoneCode: auth.phoneCode,
      nickname: userProfile.userInfo?.nickName,
      avatarUrl: userProfile.userInfo?.avatarUrl
    })
    loginAsToken(sessionToken.token)
    const profile = await identityApi.sessionInfo(sessionToken.token)
    if (profile.currentEmployee) {
      throw new Error('这个微信已绑定装修公司员工身份，请让业主本人微信进入')
    }
    const accepted = await identityApi.acceptCustomerInvite({
      inviteId: inviteId.value || undefined,
      token: token.value || undefined
    })
    loginAsToken(accepted.token)
    const ownerProfile = await identityApi.sessionInfo(accepted.token)
    if (ownerProfile.sessionType !== 'Customer' || !ownerProfile.customerAccesses?.length) {
      throw new Error('授权未生效，请稍后重试')
    }
    loginAsCustomer(ownerProfile, accepted.token)
    hideLoading()
    toast(`已进入${invite.value?.projectName || '我的家'}`, 'success')
    uni.reLaunch({ url: P.home })
  } catch (error) {
    hideLoading()
    toastError(error, '进入我的家失败')
  } finally {
    submitting.value = false
  }
}

function goJoinCompany() { uni.navigateTo({ url: P.companyJoin }) }
function goRegisterCompany() { uni.navigateTo({ url: P.enterprise }) }
function backToLogin() { uni.reLaunch({ url: P.login }) }
</script>

<template>
  <view class="owner-enter">
    <JzPageHeader title="进入我的家" subtitle="验证手机号后查看您的装修项目" />

    <view class="owner-enter__body">
      <view v-if="invite" class="jz-card owner-enter__card">
        <view class="owner-enter__head">
          <JzBrandLogo class="owner-enter__logo" variant="white" :size="88" />
          <view class="jz-grow">
            <text class="owner-enter__title">{{ invite.projectName || '我的家' }}</text>
            <text class="owner-enter__sub">{{ invite.propertyAddress || '项目进度同频' }}</text>
          </view>
        </view>
        <view class="owner-enter__info">
          <view><text>项目</text><text>{{ invite.projectName || '待确认' }}</text></view>
          <view><text>房屋</text><text>{{ invite.propertyAddress || '以项目地址为准' }}</text></view>
        </view>
        <view class="owner-enter__tip">
          <JzIcon name="shield-check" :size="28" :color="TOKEN_COLOR.primary" />
          <text>用微信授权手机号即可进入。手机号需与装修公司登记的号码一致，仅用于确认您的业主身份。</text>
        </view>
      </view>

      <view v-else-if="loadError" class="jz-card owner-enter__card owner-enter__card--center">
        <JzIcon name="alert-circle" :size="42" :color="TOKEN_COLOR.danger" />
        <text class="owner-enter__error-title">这条邀请已不可用</text>
        <text class="owner-enter__error-text">{{ loadError }}</text>
        <button class="jz-btn jz-btn--ghost jz-btn--block" @tap="backToLogin">返回登录</button>
      </view>

      <view v-else class="jz-card owner-enter__card">
        <JzIcon name="home" :size="46" :color="TOKEN_COLOR.primary" />
        <text class="owner-enter__title owner-enter__title--block">暂时没找到您的装修项目</text>
        <text class="owner-enter__sub owner-enter__sub--block">
          可能装修公司还没有把您的手机号登记到项目里。请联系您的设计师，核对登记的手机号后把进入链接发给您；
          如果您是装修公司，请从下面的入口继续。
        </text>
        <view class="owner-enter__actions">
          <button class="jz-btn jz-btn--plain jz-btn--block" @tap="goJoinCompany">我是装修公司员工</button>
          <button class="jz-btn jz-btn--primary jz-btn--block" @tap="goRegisterCompany">我要注册装修公司</button>
        </view>
      </view>

      <button
        v-if="invite?.status === 'pending'"
        class="jz-btn jz-btn--primary jz-btn--block owner-enter__submit"
        open-type="getPhoneNumber"
        :loading="submitting"
        @getphonenumber="enter"
      >微信授权手机号，进入我的家</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.owner-enter { min-height: 100vh; background: $jzb-bg-page; }
.owner-enter__body { padding: 28rpx; }
.owner-enter__card { padding: 28rpx; }
.owner-enter__card--center { display: flex; flex-direction: column; align-items: center; text-align: center; }
.owner-enter__head { display: flex; align-items: center; gap: 18rpx; padding-bottom: 22rpx; border-bottom: 1rpx solid $jzb-border-light; }
.owner-enter__logo { border-radius: 26rpx; }
.owner-enter__title { display: block; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 750; }
.owner-enter__title--block { margin-top: 18rpx; }
.owner-enter__sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.owner-enter__sub--block { margin-top: 10rpx; text-align: center; }
.owner-enter__info { padding-top: 8rpx; }
.owner-enter__info > view { display: flex; justify-content: space-between; padding: 18rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.owner-enter__info > view text:first-child { color: $jzb-text-3; }
.owner-enter__info > view text:last-child { color: $jzb-text-1; font-weight: 600; }
.owner-enter__tip {
  display: flex; align-items: flex-start; gap: 12rpx; margin-top: 20rpx; padding: 20rpx;
  color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: $jzb-radius-sm;
  font-size: $jzb-font-xs; line-height: 1.65;
}
.owner-enter__error-title { display: block; margin-top: 16rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.owner-enter__error-text { display: block; margin: 10rpx 0 26rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.6; }
.owner-enter__actions { margin-top: 26rpx; display: flex; flex-direction: column; gap: 16rpx; }
.owner-enter__submit { margin-top: 32rpx; }
</style>
