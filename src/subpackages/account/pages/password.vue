<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P, goTab } from '@/config'
import { identityApi } from '@/domains/identity/api'
import { session } from '@/domains/identity/session'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'

const passwordSet = ref(session.user?.passwordSet === true)
const newPassword = ref('')
const confirmPassword = ref('')
const showNew = ref(false)
const showConfirm = ref(false)
const submitting = ref(false)

onLoad(async () => {
  if (!session.token || !session.emp) {
    goTab(P.mine)
    return
  }
  try {
    const profile = await identityApi.sessionInfo()
    passwordSet.value = profile.passwordSet === true
    session.user = profile
  } catch (error) {
    toastError(error, '密码状态加载失败')
  }
})

function validate(): boolean {
  if (newPassword.value.length < 8 || newPassword.value.length > 64) {
    toast('密码长度必须为 8-64 位')
    return false
  }
  if (!/[A-Za-z]/.test(newPassword.value) || !/\d/.test(newPassword.value)) {
    toast('密码必须同时包含字母和数字')
    return false
  }
  if (newPassword.value !== confirmPassword.value) {
    toast('两次输入的新密码不一致')
    return false
  }
  return true
}

async function submit() {
  if (submitting.value || !validate()) return
  submitting.value = true
  loading(passwordSet.value ? '正在修改密码…' : '正在设置密码…')
  try {
    // App 端微信登录已验证身份，密码设置/修改均不要求原密码，后端同步去除原密码校验
    await identityApi.setPassword(newPassword.value, confirmPassword.value)
    passwordSet.value = true
    newPassword.value = ''
    confirmPassword.value = ''
    if (session.user) session.user.passwordSet = true
    hideLoading()
    toast('密码已保存，可在 Web 工作台使用手机号密码登录', 'success')
  } catch (error) {
    hideLoading()
    toastError(error, '密码保存失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="password-page">
    <JzPageHeader title="账号密码" subtitle="用于装得清 Web 工作台登录" />
    <view class="password-body">
      <view class="jz-card password-status">
        <view class="password-status__icon">
          <JzIcon name="shield-check" :size="42" :color="TOKEN_COLOR.primary" />
        </view>
        <view class="jz-grow">
          <text class="password-status__title">{{ passwordSet ? '已设置 Web 登录密码' : '尚未设置 Web 登录密码' }}</text>
          <text class="password-status__desc">
            {{ passwordSet ? '如需更换密码，直接输入新密码即可。' : '设置后可使用手机号和密码登录 Web 工作台。' }}
          </text>
        </view>
      </view>

      <view class="jz-card password-form">
        <view class="password-form__account">
          <text>登录手机号</text>
          <text>{{ session.user?.phone || session.emp?.phone || '-' }}</text>
        </view>

        <view class="password-field">
          <text class="password-field__label">新密码</text>
          <input v-model="newPassword" :password="!showNew" maxlength="64" placeholder="8-64 位，同时包含字母和数字" />
          <view class="password-field__toggle" @tap="showNew = !showNew">
            <JzIcon :name="showNew ? 'eye-off' : 'eye'" :size="34" color="TOKEN_COLOR.text3" />
          </view>
        </view>

        <view class="password-field">
          <text class="password-field__label">确认密码</text>
          <input v-model="confirmPassword" :password="!showConfirm" maxlength="64" placeholder="请再次输入新密码" />
          <view class="password-field__toggle" @tap="showConfirm = !showConfirm">
            <JzIcon :name="showConfirm ? 'eye-off' : 'eye'" :size="34" color="TOKEN_COLOR.text3" />
          </view>
        </view>
      </view>

      <button class="jz-btn jz-btn--primary jz-btn--block password-submit" :loading="submitting" @tap="submit">
        {{ passwordSet ? '保存新密码' : '设置密码' }}
      </button>
      <text class="password-tip">密码仅以加密形式保存，页面不会展示明文密码。</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.password-page { min-height: 100vh; background: $jzb-bg-page; }
.password-body { padding: 28rpx $jzb-page-pad 80rpx; }
.password-status { padding: 28rpx; display: flex; align-items: center; }
.password-status__icon { width: 80rpx; height: 80rpx; margin-right: 20rpx; display: flex; align-items: center; justify-content: center; background: $jzb-primary-lightest; border-radius: 24rpx; }
.password-status__title { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.password-status__desc { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.password-form { margin-top: 24rpx; padding: 8rpx 28rpx 16rpx; }
.password-form__account { min-height: 92rpx; display: flex; align-items: center; justify-content: space-between; border-bottom: 1rpx solid $jzb-border-light; }
.password-form__account text:first-child { color: $jzb-text-3; font-size: $jzb-font-sm; }
.password-form__account text:last-child { color: $jzb-text-1; font-size: $jzb-font; }
.password-field { min-height: 108rpx; display: flex; align-items: center; border-bottom: 1rpx solid $jzb-border-light; }
.password-field:last-child { border-bottom: none; }
.password-field__label { width: 150rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.password-field input { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font-sm; }
.password-field__toggle { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; }
.password-submit { margin-top: 32rpx; }
.password-tip { display: block; margin-top: 22rpx; padding: 0 12rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.7; text-align: center; }
</style>
