<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
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

onLoad(async (query) => {
  // 本地联调：使用真实员工令牌快速切换角色；生产构建不会执行该分支。
  if (import.meta.env.DEV && query?.devToken) {
    const token = String(query.devToken)
    try {
      agreePrivacy()
      loginAsToken(token)
      const profile = await identityApi.sessionInfo(token)
      if (profile.currentEmployee) {
        loginAsEmployee(profile.currentEmployee, token, profile)
        goTab(P.home)
        return
      }
    } catch {
      // 开发令牌失效时回到普通登录流程。
    }
  }
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

function exitLogin() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: P.home }) })
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
      toast('请使用手机号快捷登录后继续')
      return
    }
    toast(error instanceof Error ? error.message : '登录失败')
  } finally {
    submitting.value = false
  }
}

function requestWxCode(phoneCode?: string) {
  uni.login({
    provider: 'weixin',
    success: (loginResult) => {
      if (!loginResult.code) { toast('登录失败，请重试'); return }
      void finishWxLogin(loginResult.code, phoneCode)
    },
    fail: () => toast('登录失败，请重试')
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
      <view class="login__nav">
        <view class="login__back" @tap="exitLogin">
          <JzIcon name="arrow-left" :size="32" :color="TOKEN_COLOR.text2" />
          <text>返回</text>
        </view>
      </view>

      <view class="login__brand">
        <JzBrandLogo class="login__logo" variant="white" :size="92" />
        <view class="login__brand-copy">
          <text class="login__name">装得清</text>
          <text class="login__tagline">装企数字化协同管理平台</text>
        </view>
      </view>

      <view class="login__scope">
        <view class="login__scope-title">
          <JzIcon name="building" :size="30" :color="TOKEN_COLOR.primary" />
          <text>装企经营与项目协同系统</text>
        </view>
        <text class="login__scope-text">面向企业负责人、被邀请员工及经项目授权的业主；新用户需经企业或项目邀请后使用</text>
      </view>

      <view class="login__panel">
        <view class="login__panel-head">
          <text class="login__panel-title">手机号快捷登录</text>
          <text class="login__panel-sub">请先确认您的使用身份，再选择是否继续</text>
        </view>
        <view class="login__audience">
          <view class="login__audience-item">
            <view class="login__audience-icon"><JzIcon name="building" :size="32" :color="TOKEN_COLOR.primary" /></view>
            <view class="jz-grow">
              <text class="login__audience-title">企业负责人开通</text>
              <text class="login__audience-desc">在本小程序创建企业、配置组织并邀请员工。</text>
            </view>
          </view>
          <view class="login__audience-item">
            <view class="login__audience-icon"><JzIcon name="user-plus" :size="32" :color="TOKEN_COLOR.primary" /></view>
            <view class="jz-grow">
              <text class="login__audience-title">被邀请员工使用</text>
              <text class="login__audience-desc">接受企业邀请后，使用登记的本人手机号登录。</text>
            </view>
          </view>
          <view class="login__audience-item">
            <view class="login__audience-icon"><JzIcon name="home" :size="32" :color="TOKEN_COLOR.primary" /></view>
            <view class="jz-grow">
              <text class="login__audience-title">经项目授权的业主使用</text>
              <text class="login__audience-desc">接受项目邀请后，仅查看本人项目的进度、动态和验收。</text>
            </view>
          </view>
        </view>
        <button v-if="!needPhone" class="login__submit jz-btn jz-btn--primary jz-btn--block"
                :loading="submitting" @tap="wxLogin">
          <text>手机号快捷登录</text>
        </button>
        <button v-else class="login__submit jz-btn jz-btn--primary jz-btn--block" open-type="getPhoneNumber"
                :loading="submitting" @getphonenumber="wxPhoneLogin">
          <text>手机号快捷登录</text>
        </button>
        <view class="login__agree">
          <view class="login__agree-toggle" @tap="toggleAgreed">
            <view class="login__checkbox" :class="{ 'login__checkbox--on': agreed }">
              <JzIcon v-if="agreed" name="check" :size="22" :color="TOKEN_COLOR.white" :stroke-width="2.6" />
            </view>
            <text class="login__agree-text">我已阅读并同意</text>
          </view>
          <view class="login__agree-links">
            <navigator class="login__link" :url="P.userAgreement" hover-class="none">《用户协议》</navigator>
            <text class="login__agree-text">与</text>
            <navigator class="login__link" :url="P.privacyPolicy" hover-class="none">《隐私政策》</navigator>
          </view>
        </view>
      </view>

      <button class="jz-btn jz-btn--ghost jz-btn--block login__cancel" @tap="exitLogin">暂不登录，返回浏览</button>

      <view class="login__version">装得清 v{{ runtime.version }}</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.login { min-height: 100vh; background: radial-gradient(circle at 8% 0%, rgba(43,196,180,.18), transparent 34%), $jzb-bg-page; }
.login__shell { min-height: 100vh; padding-left: 40rpx; padding-right: 40rpx; box-sizing: border-box; }
.login__nav { display: flex; align-items: center; min-height: 72rpx; }
.login__back { display: inline-flex; align-items: center; gap: 8rpx; min-height: 64rpx; padding: 0 18rpx 0 4rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.login__brand { display: flex; align-items: center; margin-top: 20rpx; }
.login__logo { border-radius: 32rpx; box-shadow: $jzb-shadow-float; }
.login__brand-copy { margin-left: 22rpx; }
.login__name { display: block; color: $jzb-text-1; font-size: 44rpx; font-weight: 780; }
.login__tagline { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.login__scope { margin-top: 22rpx; padding: 20rpx 24rpx; background: rgba(43,196,180,.11); border: 1rpx solid rgba(43,196,180,.24); border-radius: $jzb-radius-lg; }
.login__scope-title { display: flex; align-items: center; gap: 10rpx; color: $jzb-primary-dark; font-size: $jzb-font-md; font-weight: 720; }
.login__scope-text { display: block; margin-top: 10rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 690; line-height: 1.5; }
.login__hero-title { display: block; color: $jzb-text-1; font-size: 46rpx; font-weight: 760; line-height: 1.35; }
.login__features { display: flex; justify-content: space-between; margin-top: 38rpx; }
.login__feature { display: flex; align-items: center; gap: 10rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.login__panel { margin-top: 30rpx; padding: 28rpx 26rpx 24rpx; background: rgba(255,255,255,.94); border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-xl; box-shadow: $jzb-shadow-card; }
.login__panel-title { display: block; color: $jzb-text-1; font-size: $jzb-font-xl; font-weight: 750; }
.login__panel-sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.login__audience { margin-top: 20rpx; padding: 4rpx 0; border-top: 1rpx solid $jzb-border-light; border-bottom: 1rpx solid $jzb-border-light; }
.login__audience-item { display: flex; align-items: flex-start; padding: 11rpx 0; }
.login__audience-icon { display: flex; align-items: center; justify-content: center; width: 52rpx; height: 52rpx; margin-right: 14rpx; background: $jzb-primary-lighter; border-radius: 18rpx; }
.login__audience-title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.login__audience-desc { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: 21rpx; line-height: 1.42; }
.login__submit { display: flex; align-items: center; justify-content: center; gap: 10rpx; margin-top: 28rpx; }
.login__agree { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4rpx 0; margin-top: 28rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.login__agree-toggle, .login__agree-links { display: flex; align-items: center; justify-content: center; min-height: 44rpx; }
.login__checkbox { display: flex; align-items: center; justify-content: center; width: 30rpx; height: 30rpx; margin-right: 10rpx; border: 2rpx solid $jzb-text-4; border-radius: 8rpx; }
.login__checkbox--on { background: $jzb-primary-dark; border-color: $jzb-primary-dark; }
.login__link { display: inline-flex; align-items: center; min-height: 44rpx; padding: 4rpx 2rpx; color: $jzb-primary-dark; }
.login__cancel { margin-top: 30rpx; }
.login__version { margin-top: 28rpx; color: $jzb-text-4; text-align: center; font-size: $jzb-font-xs; }
</style>
