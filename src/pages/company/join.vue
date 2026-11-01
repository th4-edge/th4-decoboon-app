<script setup lang="ts">
/**
 * 未归属选择页。
 *
 * 邀请链接是本页的门禁输入：带业主邀请上下文时直接去业主端；带员工邀请上下文时
 * 直接去员工邀请确认页。只有没有邀请上下文的普通未归属用户才停留在这里选择身份。
 */
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { confirm } from '@/composables/toast'
import { logout, session } from '@/domains/identity/session'
import { inviteLandingUrl, readInviteIntent } from '@/domains/identity/inviteContext'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'

declare const wx: { reLaunch: (options: { url: string }) => void }

const redirecting = ref(false)
const displayName = computed(() => session.user?.nickname || '用户')
const displayPhone = computed(() => session.user?.phone || '未绑定手机号')

function routeInviteIntent() {
  if (redirecting.value) return
  const intent = readInviteIntent()
  if (!intent) return
  redirecting.value = true
  uni.reLaunch({ url: inviteLandingUrl(intent) })
}

onLoad(routeInviteIntent)
onShow(routeInviteIntent)

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
  if (session.token && session.sessionType === 'user' && !session.emp) void logout()
  reLaunchAfterLogout(P.home)
}

async function relogin() {
  const ok = await confirm('切换账号', '将退出当前登录并重新进入，是否继续？', '退出登录')
  if (!ok) return
  await logout()
  reLaunchAfterLogout(P.login)
}
</script>

<template>
  <view v-if="!redirecting" class="entry-page">
    <JzPageHeader title="加入装得清" subtitle="先确认当前身份，业主不会进入企业工作台" />

    <view class="entry-body">
      <view class="entry-identity jz-card">
        <view class="entry-identity__avatar"><JzIcon name="user" :size="32" :color="TOKEN_COLOR.text3" /></view>
        <view class="jz-grow">
          <text class="entry-identity__name">{{ displayName }}</text>
          <text class="entry-identity__phone">{{ displayPhone }}</text>
        </view>
        <text class="entry-identity__badge">未归属企业</text>
      </view>

      <text class="entry-section__title">已收到装修公司邀请</text>

      <view class="entry-card jz-card entry-card--primary" @tap="goOwnerEnter">
        <view class="entry-card__icon">
          <JzIcon name="home" :size="32" :color="TOKEN_COLOR.primary" />
        </view>
        <view class="jz-grow">
          <view class="entry-card__head">
            <text class="entry-card__title">我是业主，查看我的装修</text>
            <text class="entry-card__role">业主</text>
          </view>
          <text class="entry-card__desc">打开装修公司发送的邀请卡片或项目码，只会进入本人项目，查看进度、照片、付款与验收。</text>
        </view>
        <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text3" />
      </view>

      <view class="entry-card jz-card">
        <view class="entry-card__icon">
          <JzIcon name="users" :size="32" :color="TOKEN_COLOR.primary" />
        </view>
        <view class="jz-grow">
          <view class="entry-card__head">
            <text class="entry-card__title">我是装修公司员工</text>
            <text class="entry-card__role">员工</text>
          </view>
          <text class="entry-card__desc">直接打开管理员通过微信发送的邀请卡片。手机号与预留号码一致后，会直接进入所属企业首页。</text>
          <text class="entry-card__note">未收到邀请时，请联系企业管理员重新发送。</text>
        </view>
      </view>

      <text class="entry-section__title entry-section__title--spaced">还没有加入企业</text>

      <view class="entry-card jz-card" @tap="goRegisterCompany">
        <view class="entry-card__icon">
          <JzIcon name="building" :size="32" :color="TOKEN_COLOR.primary" />
        </view>
        <view class="jz-grow">
          <view class="entry-card__head">
            <text class="entry-card__title">注册新的装修公司</text>
            <text class="entry-card__role">企业负责人</text>
          </view>
          <text class="entry-card__desc">注册后你将成为企业负责人，可邀请员工、维护客户、项目和工地。</text>
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
.entry-identity {
  display: flex; align-items: center; gap: 16rpx; padding: 22rpx 24rpx; margin-bottom: 28rpx;
  border-color: $jzb-border-light;
}
.entry-identity__avatar {
  width: 66rpx; height: 66rpx; border-radius: 22rpx;
  display: flex; align-items: center; justify-content: center;
  background: $jzb-bg-hover;
}
.entry-identity__name { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.entry-identity__phone { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.entry-identity__badge {
  flex-shrink: 0; padding: 5rpx 14rpx; border-radius: 999rpx;
  color: $jzb-text-3; background: $jzb-bg-hover; font-size: 20rpx;
}
.entry-section__title {
  display: block; margin: 0 4rpx 14rpx; color: $jzb-text-2;
  font-size: $jzb-font-xs; font-weight: 700; letter-spacing: .04em;
}
.entry-section__title--spaced { margin-top: 28rpx; }
.entry-card {
  display: flex; align-items: center; gap: 18rpx; padding: 24rpx;
  margin-bottom: 16rpx; border-color: $jzb-border-light;
}
.entry-card:active { background: $jzb-bg-hover; }
.entry-card--primary {
  background: linear-gradient(135deg, $jzb-primary-lightest, $jzb-bg-card 72%);
  border-color: var(--jzb-primary-a24, rgba(22, 163, 148, .24));
}
.entry-card__icon {
  width: 70rpx; height: 70rpx; flex-shrink: 0; border-radius: 22rpx;
  display: flex; align-items: center; justify-content: center;
  background: $jzb-primary-lighter;
}
.entry-card__head { display: flex; align-items: center; gap: 10rpx; }
.entry-card__title { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.entry-card__role {
  flex-shrink: 0; padding: 3rpx 10rpx; border-radius: 999rpx;
  color: $jzb-primary-dark; background: $jzb-primary-lightest; font-size: 19rpx; font-weight: 600;
}
.entry-card__desc { display: block; margin-top: 7rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.entry-card__note { display: block; margin-top: 8rpx; color: $jzb-text-4; font-size: 20rpx; line-height: 1.5; }
.entry-foot { margin-top: 38rpx; text-align: center; }
.entry-foot__hint { display: block; margin: 6rpx 0 20rpx; color: $jzb-text-4; font-size: 20rpx; line-height: 1.6; }
.entry-foot__link { color: $jzb-primary-dark; font-size: $jzb-font-xs; }
</style>
