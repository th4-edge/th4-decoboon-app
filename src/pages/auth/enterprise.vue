<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P, goTab } from '@/config'
import { identityApi } from '@/domains/identity/api'
import { loginAsEmployee, loginAsToken, session } from '@/domains/identity/session'
import { hideLoading, loading, toast } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'

const companyTitle = ref('')
const companyName = ref('')
const companyAddr = ref('')
const storeName = ref('')
const name = ref('')
const submitting = ref(false)

onLoad((query) => {
  if (!session.token || !session.user?.phone) {
    uni.reLaunch({ url: P.login })
    return
  }
  name.value = query?.name || session.user.nickname || ''
})

async function submit() {
  if (!companyTitle.value.trim()) { toast('请填写企业全称'); return }
  if (!companyName.value.trim()) { toast('请填写企业简称'); return }
  if (!name.value.trim()) { toast('请填写负责人姓名'); return }
  submitting.value = true
  loading('正在创建企业…')
  try {
    let avatarUrl = session.user?.avatarUrl
    try {
      const profile = await new Promise<UniApp.GetUserProfileRes>((resolve, reject) => {
        uni.getUserProfile({ desc: '用于企业负责人头像展示', success: resolve, fail: reject })
      })
      avatarUrl = profile.userInfo.avatarUrl || avatarUrl
      if (!name.value.trim() && profile.userInfo.nickName) name.value = profile.userInfo.nickName
    } catch {
      // 微信未授权头像不阻断企业创建。
    }
    const token = await identityApi.registerCompany({
      bossName: name.value.trim(),
      companyTitle: companyTitle.value.trim(),
      companyName: companyName.value.trim(),
      companyAddr: companyAddr.value.trim(),
      storeName: storeName.value.trim() || '总店',
      size: 'A',
      avatarUrl
    })
    loginAsToken(token.token)
    const profile = await identityApi.sessionInfo(token.token)
    if (!profile.currentEmployee) throw new Error('企业创建后未返回员工身份')
    loginAsEmployee(profile.currentEmployee, token.token, profile)
    hideLoading()
    toast('创建成功，已赠送免费试用', 'success')
    setTimeout(() => goTab(P.home), 400)
  } catch (error) {
    hideLoading()
    toast(error instanceof Error ? error.message : '创建失败，请重试')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="ent">
    <view class="ent__head">
      <view class="ent__icon"><JzIcon name="building" :size="52" color="#0E8A7D" /></view>
      <text class="ent__title">创建企业</text>
      <text class="ent__sub">{{ session.user?.phone }} 已通过微信授权验证</text>
    </view>

    <view class="ent__card">
      <text class="ent__group">负责人</text>
      <view class="ent__field">
        <text class="ent__label">姓名</text>
        <input v-model="name" maxlength="15" placeholder="请输入负责人姓名" />
      </view>

      <text class="ent__group ent__group--gap">企业信息</text>
      <view class="ent__field">
        <text class="ent__label">企业全称</text>
        <input v-model="companyTitle" maxlength="128" placeholder="例：安徽某某装饰工程有限公司" />
      </view>
      <view class="ent__field">
        <text class="ent__label">企业简称</text>
        <input v-model="companyName" maxlength="12" placeholder="最多 12 字" />
      </view>
      <view class="ent__field">
        <text class="ent__label">门店名称</text>
        <input v-model="storeName" maxlength="16" placeholder="默认总店" />
      </view>
      <view class="ent__field">
        <text class="ent__label">企业地址</text>
        <input v-model="companyAddr" maxlength="256" placeholder="选填" />
      </view>
    </view>

    <button class="jz-btn jz-btn--primary jz-btn--block ent__submit" :loading="submitting" @tap="submit">
      创建企业并进入工作台
    </button>
    <view class="ent__tip">企业注册使用微信身份 + 授权手机号双重校验。</view>
  </view>
</template>

<style lang="scss" scoped>
.ent { min-height: 100vh; padding: 48rpx 24rpx 80rpx; box-sizing: border-box; background: $jzb-bg-page; }
.ent__head { padding: 0 16rpx 32rpx; }
.ent__icon { display: flex; align-items: center; justify-content: center; width: 104rpx; height: 104rpx; background: $jzb-primary-lighter; border-radius: 32rpx; }
.ent__title { display: block; margin-top: 24rpx; font-size: 48rpx; font-weight: 750; color: $jzb-text-1; }
.ent__sub { display: block; margin-top: 10rpx; font-size: $jzb-font-sm; color: $jzb-text-3; }
.ent__card { padding: 6rpx 28rpx 20rpx; background: #fff; border-radius: $jzb-radius-lg; }
.ent__group { display: block; padding: 24rpx 0 10rpx; font-size: $jzb-font-sm; font-weight: 650; color: $jzb-primary-dark; }
.ent__group--gap { margin-top: 12rpx; border-top: 1rpx solid $jzb-border-light; }
.ent__field { display: flex; align-items: center; min-height: 92rpx; border-bottom: 1rpx solid $jzb-border-light; }
.ent__label { width: 160rpx; color: $jzb-text-2; font-size: $jzb-font; }
.ent__field input { flex: 1; color: $jzb-text-1; text-align: right; }
.ent__submit { margin-top: 32rpx; }
.ent__tip { margin-top: 20rpx; color: $jzb-text-3; text-align: center; font-size: $jzb-font-xs; }
</style>
