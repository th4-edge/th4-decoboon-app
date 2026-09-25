<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P, goTab } from '@/config'
import { identityApi } from '@/domains/identity/api'
import { loginAsEmployee, loginAsToken, session } from '@/domains/identity/session'
import { hideLoading, loading, toast } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'
import JzBrandLogo from '@/components/JzBrandLogo.vue'

const companyTitle = ref('')
const companyName = ref('')
const companyAddr = ref('')
const storeName = ref('')
const name = ref('')
const submitting = ref(false)
const hasRunningProjects = ref(false)
function onRunningProjectsChange(event: any) { hasRunningProjects.value = !!event?.detail?.value }

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
    setTimeout(() => goTab(hasRunningProjects.value ? P.carryoverHome : P.home), 400)
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
    <view class="ent__hero">
      <view class="ent__hero-main">
        <view class="ent__hero-logo"><JzBrandLogo variant="white" :size="84" /></view>
        <view class="jz-grow">
          <text class="ent__hero-eyebrow">企业负责人开通</text>
          <text class="ent__hero-title">创建您的装修企业</text>
          <text class="ent__hero-sub">一次完成企业、总店与负责人档案</text>
        </view>
      </view>
      <view class="ent__hero-meta">
        <view class="ent__hero-chip">
          <JzIcon name="shield-check" :size="26" :color="TOKEN_COLOR.white" />
          <text>{{ session.user?.phone || '手机号' }} 已验证</text>
        </view>
        <view class="ent__hero-chip">
          <JzIcon name="clock" :size="26" :color="TOKEN_COLOR.white" />
          <text>约 1 分钟完成</text>
        </view>
      </view>
      <view class="ent__hero-points">
        <view><JzIcon name="users" :size="28" :color="TOKEN_COLOR.white" /><text>邀请员工</text></view>
        <view><JzIcon name="briefcase" :size="28" :color="TOKEN_COLOR.white" /><text>管理项目</text></view>
        <view><JzIcon name="chart" :size="28" :color="TOKEN_COLOR.white" /><text>经营分析</text></view>
      </view>
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
      <view class="ent__field ent__field--switch">
        <view class="jz-grow">
          <text class="ent__label">已有在建项目</text>
          <text class="ent__switch-note">开启后，创建企业将进入“业务承接”，逐个录入项目。</text>
        </view>
        <switch :checked="hasRunningProjects" color="#16A394" @change="onRunningProjectsChange" />
      </view>
    </view>

    <button class="jz-btn jz-btn--primary jz-btn--block ent__submit" :loading="submitting" @tap="submit">
      创建企业并进入工作台
    </button>
    <view class="ent__tip">企业注册仅使用手机号快捷登录校验负责人身份，不会读取通讯录。</view>
  </view>
</template>

<style lang="scss" scoped>
.ent { min-height: 100vh; padding: 32rpx 24rpx 80rpx; box-sizing: border-box; background: $jzb-bg-page; }
.ent__hero {
  position: relative; overflow: hidden; padding: 32rpx 30rpx 28rpx; margin-bottom: 24rpx;
  color: $jzb-text-inverse; background: $jzb-gradient; border-radius: $jzb-radius-xl;
  box-shadow: 0 18rpx 48rpx rgba(14, 138, 125, .20);
}
.ent__hero::after {
  content: ''; position: absolute; right: -90rpx; top: -120rpx; width: 320rpx; height: 320rpx;
  border-radius: 50%; background: rgba(255, 255, 255, .10); pointer-events: none;
}
.ent__hero-main { position: relative; z-index: 1; display: flex; align-items: center; }
.ent__hero-logo {
  display: flex; align-items: center; justify-content: center; width: 104rpx; height: 104rpx; margin-right: 22rpx;
  background: rgba(255, 255, 255, .14); border: 1rpx solid rgba(255, 255, 255, .18); border-radius: 30rpx;
}
.ent__hero-eyebrow { display: block; color: rgba(255, 255, 255, .78); font-size: $jzb-font-xs; font-weight: 650; }
.ent__hero-title { display: block; margin-top: 6rpx; font-size: 42rpx; font-weight: 780; line-height: 1.25; }
.ent__hero-sub { display: block; margin-top: 8rpx; color: rgba(255, 255, 255, .78); font-size: $jzb-font-xs; }
.ent__hero-meta { position: relative; z-index: 1; display: flex; flex-wrap: wrap; gap: 14rpx; margin-top: 26rpx; }
.ent__hero-chip {
  display: flex; align-items: center; gap: 8rpx; min-height: 48rpx; padding: 0 16rpx;
  color: $jzb-text-inverse; background: rgba(255, 255, 255, .14); border-radius: 999rpx;
  font-size: 21rpx;
}
.ent__hero-points {
  position: relative; z-index: 1; display: flex; justify-content: space-between; margin-top: 26rpx;
  padding-top: 22rpx; border-top: 1rpx solid rgba(255, 255, 255, .18);
}
.ent__hero-points > view { display: flex; align-items: center; gap: 8rpx; color: rgba(255, 255, 255, .88); font-size: $jzb-font-xs; }
.ent__card { padding: 6rpx 28rpx 20rpx; background: $jzb-text-inverse; border-radius: $jzb-radius-lg; }
.ent__group { display: block; padding: 24rpx 0 10rpx; font-size: $jzb-font-sm; font-weight: 650; color: $jzb-primary-dark; }
.ent__group--gap { margin-top: 12rpx; border-top: 1rpx solid $jzb-border-light; }
.ent__field { display: flex; align-items: center; min-height: 92rpx; border-bottom: 1rpx solid $jzb-border-light; }
.ent__label { width: 160rpx; color: $jzb-text-2; font-size: $jzb-font; }
.ent__field input { flex: 1; color: $jzb-text-1; text-align: right; }
.ent__submit { margin-top: 32rpx; }
.ent__tip { margin-top: 20rpx; color: $jzb-text-3; text-align: center; font-size: $jzb-font-xs; }
</style>
