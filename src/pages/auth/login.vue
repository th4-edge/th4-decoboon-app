<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P, goTab, runtime } from '@/config'
import { identityApi } from '@/domains/identity/api'
import { ProviderRequestError } from '@/core/http'
import { agreePrivacy, isLoggedIn, loginAsCustomer, loginAsEmployee, loginAsToken, loginAsUser, session } from '@/domains/identity/session'
import { useSystem } from '@/composables/system'
import { hideLoading, loading, toast } from '@/composables/toast'
import { useWxPhoneAuth } from '@/composables/useWxAuth'
import JzIcon from '@/components/JzIcon.vue'
import JzBrandLogo from '@/components/JzBrandLogo.vue'

const { system } = useSystem()
const padTop = computed(() => `${(system.value.statusBarHeight || 20) + 12}px`)
const agreed = ref(session.agreed)
const submitting = ref(false)
const needPhone = ref(false)
const { handlePhoneNumber } = useWxPhoneAuth()

onLoad(() => {
  if (session.role) goTab(P.home)
  else if (session.token && session.user) uni.redirectTo({ url: P.companyJoin })
})

function ensureAgreed(): boolean {
  if (!agreed.value) {
    toast('请先阅读并同意《用户协议》与《隐私政策》')
    return false
  }
  agreePrivacy()
  return true
}

function toggleAgreed() {
  agreed.value = !agreed.value
}

function openAgreement(path: string) {
  uni.navigateTo({ url: path })
}

async function finishWxLogin(code: string, phoneCode?: string) {
  submitting.value = true
  loading('正在登录…')
  try {
    const token = await identityApi.wxLogin(phoneCode ? { code, phoneCode } : { code })
    loginAsToken(token.token)
    const profile = await identityApi.sessionInfo(token.token)
    if (profile.currentEmployee) {
      loginAsEmployee(profile.currentEmployee, token.token, profile)
      hideLoading()
      goTab(P.home)
    } else if (profile.sessionType === 'Customer' && profile.customerAccesses?.length) {
      loginAsCustomer(profile, token.token)
      hideLoading()
      goTab(P.home)
    } else {
      loginAsUser(profile, token.token)
      hideLoading()
      uni.redirectTo({ url: P.companyJoin })
    }
  } catch (error) {
    hideLoading()
    if (error instanceof ProviderRequestError && error.code === 'PHONE_REQUIRED') {
      needPhone.value = true
      toast('首次使用请授权手机号后继续')
      return
    }
    toast(error instanceof Error ? error.message : '微信登录失败')
  } finally {
    submitting.value = false
  }
}

function requestWxCode(phoneCode?: string) {
  uni.login({
    provider: 'weixin',
    success: (loginResult) => {
      if (!loginResult.code) { toast('微信登录失败，请重试'); return }
      void finishWxLogin(loginResult.code, phoneCode)
    },
    fail: () => toast('微信登录失败，请重试')
  })
}

function wxLogin() {
  if (!ensureAgreed()) return
  needPhone.value = false
  requestWxCode()
}

function wxPhoneLogin(event: { detail?: { code?: string; errMsg?: string } }) {
  if (!ensureAgreed()) return
  const auth = handlePhoneNumber(event)
  if (!auth || auth.cancelled) return
  requestWxCode(auth.phoneCode)
}
</script>

<template>
  <view class="login">
    <view class="login__shell" :style="{ paddingTop: padTop }">
      <view class="login__brand">
        <JzBrandLogo class="login__logo" variant="white" :size="104" />
        <view class="login__brand-copy">
          <text class="login__name">装得清</text>
          <text class="login__tagline">装企数字化协同管理平台</text>
        </view>
      </view>

      <view class="login__hero">
        <text class="login__hero-title">让项目进度、现场协作与验收确认始终同频</text>
        <view class="login__features">
          <view class="login__feature"><JzIcon name="briefcase" :size="28" color="#0E8A7D" /><text>项目经营</text></view>
          <view class="login__feature"><JzIcon name="camera" :size="28" color="#0E8A7D" /><text>现场留证</text></view>
          <view class="login__feature"><JzIcon name="shield-check" :size="28" color="#0E8A7D" /><text>验收闭环</text></view>
        </view>
      </view>

      <view class="login__panel">
        <view class="login__panel-head">
          <text class="login__panel-title">微信登录</text>
          <text class="login__panel-sub">已绑定微信身份直接登录，首次使用再授权手机号</text>
        </view>
        <button v-if="!needPhone" class="login__submit jz-btn jz-btn--primary jz-btn--block"
                :loading="submitting" @tap="wxLogin">
          <JzIcon name="message" :size="30" color="#FFFFFF" />
          <text>微信登录</text>
        </button>
        <button v-else class="login__submit jz-btn jz-btn--primary jz-btn--block" open-type="getPhoneNumber"
                :loading="submitting" @getphonenumber="wxPhoneLogin">
          <JzIcon name="message" :size="30" color="#FFFFFF" />
          <text>首次使用，授权手机号继续</text>
        </button>
        <view class="login__agree" @tap="toggleAgreed">
          <view class="login__checkbox" :class="{ 'login__checkbox--on': agreed }">
            <JzIcon v-if="agreed" name="check" :size="22" color="#FFFFFF" :stroke-width="2.6" />
          </view>
          <text class="login__agree-text">我已阅读并同意</text>
          <text class="login__link" @tap.stop="openAgreement(P.userAgreement)">《用户协议》</text>
          <text class="login__agree-text">与</text>
          <text class="login__link" @tap.stop="openAgreement(P.privacyPolicy)">《隐私政策》</text>
        </view>
      </view>

      <view class="login__version">装得清 v{{ runtime.version }}</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.login { min-height: 100vh; background: radial-gradient(circle at 8% 0%, rgba(43,196,180,.18), transparent 34%), $jzb-bg-page; }
.login__shell { min-height: 100vh; padding-left: 40rpx; padding-right: 40rpx; box-sizing: border-box; }
.login__brand { display: flex; align-items: center; margin-top: 54rpx; }
.login__logo { border-radius: 32rpx; box-shadow: $jzb-shadow-float; }
.login__brand-copy { margin-left: 22rpx; }
.login__name { display: block; color: $jzb-text-1; font-size: 44rpx; font-weight: 780; }
.login__tagline { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.login__hero { margin-top: 80rpx; }
.login__hero-title { display: block; color: $jzb-text-1; font-size: 46rpx; font-weight: 760; line-height: 1.35; }
.login__features { display: flex; justify-content: space-between; margin-top: 38rpx; }
.login__feature { display: flex; align-items: center; gap: 10rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.login__panel { margin-top: 70rpx; padding: 34rpx 30rpx 28rpx; background: rgba(255,255,255,.94); border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-xl; box-shadow: $jzb-shadow-card; }
.login__panel-title { display: block; color: $jzb-text-1; font-size: $jzb-font-xl; font-weight: 750; }
.login__panel-sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.login__submit { display: flex; align-items: center; justify-content: center; gap: 10rpx; margin-top: 36rpx; }
.login__agree { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; margin-top: 28rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.login__checkbox { display: flex; align-items: center; justify-content: center; width: 30rpx; height: 30rpx; margin-right: 10rpx; border: 2rpx solid $jzb-text-4; border-radius: 8rpx; }
.login__checkbox--on { background: $jzb-primary-dark; border-color: $jzb-primary-dark; }
.login__link { color: $jzb-primary-dark; }
.login__version { margin-top: 40rpx; color: $jzb-text-4; text-align: center; font-size: $jzb-font-xs; }
</style>
