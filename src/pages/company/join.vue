<script setup lang="ts">
/**
 * 未归属选择页。
 *
 * 员工加入必须从管理员发送的微信邀请卡片直接进入；本页不再要求粘贴链接或手输编号，
 * 避免把内部邀请标识暴露给一线员工和业主。
 */
import { computed, ref } from 'vue'
import { P } from '@/config'
import { confirm } from '@/composables/toast'
import { logout, session } from '@/domains/identity/session'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'

declare const wx: { reLaunch: (options: { url: string }) => void }

const showEmployeeHelp = ref(false)
const displayName = computed(() => session.user?.nickname || '用户')
const displayPhone = computed(() => session.user?.phone || '未绑定手机号')

function goOwnerEnter() { uni.navigateTo({ url: P.ownerEnter }) }
function goRegisterCompany() { uni.navigateTo({ url: P.enterprise }) }

/** 退出当前页会话后，下一事件循环再重定向，避免当前页同步重渲染吞掉路由。 */
function reLaunchAfterLogout(url: string) {
  setTimeout(() => {
    // #ifdef MP-WEIXIN
    wx.reLaunch({ url })
    // #endif
    // #ifndef MP-WEIXIN
    uni.reLaunch({ url })
    // #endif
  }, 0)
}

function later() {
  if (session.token && session.sessionType === 'user' && !session.emp) logout()
  reLaunchAfterLogout(P.home)
}

async function relogin() {
  const ok = await confirm('切换账号', '将退出当前登录并重新进入，是否继续？', '退出登录')
  if (!ok) return
  logout()
  reLaunchAfterLogout(P.login)
}
</script>

<template>
  <view class="entry-page">
    <JzPageHeader title="选择您的身份" subtitle="装得清同时服务业主和装修公司，请选择您的情况" />

    <view class="entry-body">
      <view class="entry-identity jz-card">
        <view class="entry-identity__avatar"><JzIcon name="user" :size="34" :color="TOKEN_COLOR.text3" /></view>
        <view class="jz-grow">
          <text class="entry-identity__name">{{ displayName }}</text>
          <text class="entry-identity__phone">{{ displayPhone }}</text>
        </view>
        <text class="entry-identity__badge">未归属企业</text>
      </view>

      <!-- 业主 -->
      <view class="entry-card jz-card entry-card--primary" @tap="goOwnerEnter">
        <view class="entry-card__icon entry-card__icon--owner"><JzIcon name="home" :size="36" :color="'#fff'" /></view>
        <view class="jz-grow">
          <text class="entry-card__title">我是业主，要看我的装修</text>
          <text class="entry-card__desc">验证手机号后进入「我的家」，看进度、验收、付款和工地照片</text>
        </view>
        <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text3" />
      </view>

      <!-- 员工 -->
      <view class="entry-card jz-card" @tap="showEmployeeHelp = !showEmployeeHelp">
        <view class="entry-card__icon"><JzIcon name="users" :size="32" :color="TOKEN_COLOR.primary" /></view>
        <view class="jz-grow">
          <text class="entry-card__title">我是装修公司员工，要加入企业</text>
          <text class="entry-card__desc">请直接打开管理员通过微信发送的邀请卡片；没有邀请请联系公司管理员重新发送</text>
        </view>
        <JzIcon :name="showEmployeeHelp ? 'chevron-down' : 'chevron-right'" :size="26" :color="TOKEN_COLOR.text3" />
      </view>
      <view v-if="showEmployeeHelp" class="entry-employee jz-card">
        <view class="entry-employee__guide">
          <JzIcon name="users" :size="34" :color="TOKEN_COLOR.primary" />
          <view class="jz-grow">
            <text class="entry-employee__label">在微信聊天中打开邀请卡片</text>
            <text class="entry-employee__hint">邀请会核对你的微信手机号与管理员预留手机号是否一致，确认后即可加入企业。</text>
          </view>
        </view>
      </view>

      <!-- 注册企业 -->
      <view class="entry-card jz-card" @tap="goRegisterCompany">
        <view class="entry-card__icon"><JzIcon name="building" :size="32" :color="TOKEN_COLOR.purple" /></view>
        <view class="jz-grow">
          <text class="entry-card__title">我是装修公司，要注册企业</text>
          <text class="entry-card__desc">注册后你将成为企业负责人，可邀请员工、管理客户与工地</text>
        </view>
        <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text3" />
      </view>

      <view class="entry-foot">
        <button class="jz-btn jz-btn--text" @tap="later">以后再说，返回首页</button>
        <text class="entry-foot__hint">暂不加入会退出本次未归属登录，先回首页浏览；下次登录时会再询问。</text>
        <text class="entry-foot__link" @tap="relogin">切换账号</text>
      </view>
    </view>
  </view>
    <JzConfirmDialog />
</template>

<style lang="scss" scoped>
.entry-page { min-height: 100vh; background: $jzb-bg-page; }
.entry-body { padding: 24rpx 28rpx 60rpx; }
.entry-identity { display: flex; align-items: center; gap: 16rpx; padding: 22rpx 24rpx; margin-bottom: 24rpx; }
.entry-identity__avatar {
  width: 68rpx; height: 68rpx; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: $jzb-bg-hover;
}
.entry-identity__name { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.entry-identity__phone { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.entry-identity__badge {
  flex-shrink: 0; padding: 4rpx 14rpx; border-radius: 999rpx;
  color: $jzb-text-3; background: $jzb-bg-hover; font-size: 20rpx;
}
.entry-card { display: flex; align-items: center; gap: 18rpx; padding: 26rpx 24rpx; margin-bottom: 18rpx; }
.entry-card:active { background: $jzb-bg-hover; }
.entry-card__icon {
  width: 72rpx; height: 72rpx; flex-shrink: 0; border-radius: 22rpx;
  display: flex; align-items: center; justify-content: center;
  background: $jzb-primary-lighter;
}
.entry-card__icon--owner { background: $jzb-gradient; }
.entry-card__title { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.entry-card__desc { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.entry-employee { padding: 24rpx; margin: -6rpx 0 18rpx; }
.entry-employee__guide { display: flex; align-items: flex-start; gap: 16rpx; }
.entry-employee__label { display: block; color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 600; }
.entry-employee__hint { display: block; margin-top: 10rpx; color: $jzb-text-3; font-size: 20rpx; line-height: 1.6; }
.entry-foot { margin-top: 40rpx; text-align: center; }
.entry-foot__hint { display: block; margin: 6rpx 0 20rpx; color: $jzb-text-4; font-size: 20rpx; line-height: 1.6; }
.entry-foot__link { color: $jzb-primary-dark; font-size: $jzb-font-xs; }
</style>
