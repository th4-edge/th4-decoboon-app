<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P, goTab } from '@/config'
import { identityApi } from '@/domains/identity/api'
import { loginAsEmployee, loginAsToken, session } from '@/domains/identity/session'
import { hideLoading, loading, toast } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'
import JzBrandLogo from '@/components/JzBrandLogo.vue'

const companyName = ref('')
const name = ref('')
const submitting = ref(false)
const wechatNameApplied = computed(() => !!session.user?.nickname && name.value === session.user.nickname)

onLoad((query) => {
  if (!session.token || !session.user?.phone) {
    uni.reLaunch({ url: P.login })
    return
  }
  name.value = query?.name || session.user.nickname || ''
})

async function submit() {
  if (!name.value.trim()) { toast('请填写负责人姓名'); return }
  if (!companyName.value.trim()) { toast('请填写企业名称'); return }
  submitting.value = true
  loading('正在创建企业…')
  try {
    const displayName = companyName.value.trim()
    const token = await identityApi.registerCompany({
      bossName: name.value.trim(),
      // 快速入驻阶段只填写对外展示名称；法定全称在“我的 → 企业信息”后续完善。
      companyTitle: displayName,
      companyName: displayName,
      companyAddr: '',
      storeName: '总店',
      size: 'A',
      avatarUrl: session.user?.avatarUrl
    })
    loginAsToken(token.token)
    const profile = await identityApi.sessionInfo(token.token)
    if (!profile.currentEmployee) throw new Error('企业已创建，但账号信息加载失败，请重新登录后查看')
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
    <view class="ent__hero">
      <view class="ent__hero-main">
        <view class="ent__hero-logo"><JzBrandLogo variant="white" :size="84" /></view>
        <view class="jz-grow">
          <text class="ent__hero-eyebrow">企业负责人开通</text>
          <text class="ent__hero-title">先创建企业，马上开始使用</text>
          <text class="ent__hero-sub">企业全称、Logo、地址等资料可以入驻后继续完善</text>
        </view>
      </view>
      <view class="ent__hero-meta">
        <view class="ent__hero-chip">
          <JzIcon name="shield-check" :size="26" :color="TOKEN_COLOR.white" />
          <text>{{ session.user?.phone || '手机号' }} 已验证</text>
        </view>
        <view class="ent__hero-chip">
          <JzIcon name="clock" :size="26" :color="TOKEN_COLOR.white" />
          <text>快速开通</text>
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
      <view class="ent__field ent__field--stack">
        <text class="ent__label">负责人姓名</text>
        <input v-model="name" type="nickname" maxlength="15" placeholder="请选择或输入负责人姓名" />
        <text v-if="wechatNameApplied" class="ent__hint">已从微信自动填入，可修改</text>
      </view>

      <text class="ent__group ent__group--gap">企业信息</text>
      <view class="ent__field ent__field--stack">
        <text class="ent__label">企业名称</text>
        <input v-model="companyName" maxlength="12" placeholder="请输入企业展示名称，最多 12 字" />
        <text class="ent__hint">先用于首页、邀请和员工识别，后续可补充企业全称。</text>
      </view>

      <view class="ent__later">
        <JzIcon name="shield-check" :size="30" :color="TOKEN_COLOR.primary" />
        <text>企业全称、Logo、品牌色、地址和对外服务信息，可在“我的 → 企业信息”逐步完善。</text>
      </view>
    </view>

    <button class="jz-btn jz-btn--primary jz-btn--block ent__submit" :loading="submitting" @tap="submit">
      创建企业并进入工作台
    </button>
    <view class="ent__tip">企业创建不会读取通讯录；更多企业资料可入驻后逐步完善。</view>
  </view>
</template>

<style lang="scss" scoped>
.ent { min-height: 100vh; padding: 32rpx 24rpx 80rpx; box-sizing: border-box; background: $jzb-bg-page; }
.ent__hero {
  position: relative; overflow: hidden; padding: 32rpx 30rpx 28rpx; margin-bottom: 24rpx;
  color: $jzb-text-inverse; background: $jzb-gradient; border-radius: $jzb-radius-xl;
  box-shadow: 0 18rpx 48rpx var(--jzb-primary-a20, rgba(14, 138, 125, .20));
}
.ent__hero::after {
  content: ''; position: absolute; right: -90rpx; top: -120rpx; width: 320rpx; height: 320rpx;
  border-radius: 50%; background: rgba(255, 255, 255, .10); pointer-events: none;
}
.ent__hero-main { position: relative; z-index: $jzb-z-content; display: flex; align-items: center; }
.ent__hero-logo {
  display: flex; align-items: center; justify-content: center; width: 104rpx; height: 104rpx; margin-right: 22rpx;
  background: rgba(255, 255, 255, .14); border: 1rpx solid rgba(255, 255, 255, .18); border-radius: 30rpx;
}
.ent__hero-eyebrow { display: block; color: rgba(255, 255, 255, .78); font-size: $jzb-font-xs; font-weight: 650; }
.ent__hero-title { display: block; margin-top: 6rpx; font-size: 42rpx; font-weight: 780; line-height: 1.25; }
.ent__hero-sub { display: block; margin-top: 8rpx; color: rgba(255, 255, 255, .78); font-size: $jzb-font-xs; line-height: 1.55; }
.ent__hero-meta { position: relative; z-index: $jzb-z-content; display: flex; flex-wrap: wrap; gap: 14rpx; margin-top: 26rpx; }
.ent__hero-chip {
  display: flex; align-items: center; gap: 8rpx; min-height: 48rpx; padding: 0 16rpx;
  color: $jzb-text-inverse; background: rgba(255, 255, 255, .14); border-radius: 999rpx;
  font-size: 21rpx;
}
.ent__hero-points {
  position: relative; z-index: $jzb-z-content; display: flex; justify-content: space-between; margin-top: 26rpx;
  padding-top: 22rpx; border-top: 1rpx solid rgba(255, 255, 255, .18);
}
.ent__hero-points > view { display: flex; align-items: center; gap: 8rpx; color: rgba(255, 255, 255, .88); font-size: $jzb-font-xs; }
.ent__card { padding: 6rpx 28rpx 20rpx; background: $jzb-text-inverse; border-radius: $jzb-radius-lg; }
.ent__group { display: block; padding: 24rpx 0 10rpx; font-size: $jzb-font-sm; font-weight: 650; color: $jzb-primary-dark; }
.ent__group--gap { margin-top: 12rpx; border-top: 1rpx solid $jzb-border-light; }
.ent__field { display: flex; align-items: center; min-height: 92rpx; border-bottom: 1rpx solid $jzb-border-light; }
.ent__field--stack { display: block; padding: 18rpx 0 16rpx; }
.ent__label { display: block; width: 160rpx; color: $jzb-text-2; font-size: $jzb-font; }
.ent__field input { flex: 1; width: 100%; color: $jzb-text-1; text-align: right; }
.ent__field--stack input { margin-top: 12rpx; text-align: left; }
.ent__hint { display: block; margin-top: 8rpx; color: $jzb-text-4; font-size: 20rpx; line-height: 1.5; }
.ent__later {
  display: flex; align-items: flex-start; gap: 12rpx; margin-top: 22rpx; padding: 20rpx;
  color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: $jzb-radius-sm;
  font-size: $jzb-font-xs; line-height: 1.6;
}
.ent__submit { margin-top: 32rpx; }
.ent__tip { margin-top: 20rpx; color: $jzb-text-3; text-align: center; font-size: $jzb-font-xs; line-height: 1.6; }
</style>
