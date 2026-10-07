<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import type { InviteCode } from '@/domains/identity/model'
import type { Project } from '@/domains/project/model'
import { projectApi } from '@/domains/project/api'
import { identityApi } from '@/domains/identity/api'
import { toast, toastError } from '@/composables/toast'
import { useShare } from '@/composables/share'
import JzIcon from '@/components/JzIcon.vue'

const id = ref('')
const project = ref<Project | null>(null)
const customerName = ref('')
const customerPhone = ref('')
const generated = ref<InviteCode | null>(null)

onLoad((q) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  id.value = q?.id || ''
  uni.showShareMenu({ withShareTicket: true })
  void load().catch((error) => toastError(error, '项目信息加载失败，请稍后重试'))
})
async function load() {
  project.value = await projectApi.info(id.value) || null
}

async function gen() {
  if (!customerName.value.trim()) { toast('请填写业主称呼'); return }
  if (!customerPhone.value.trim()) { toast('请填写业主手机号'); return }
  try {
    generated.value = await identityApi.createCustomerInvite(
      id.value,
      customerName.value.trim(),
      customerPhone.value.trim()
    )
    toast('业主邀请已生成', 'success')
  } catch (error) {
    toastError(error, '业主邀请生成失败，请稍后重试')
  }
}
function invitePath() {
  if (!generated.value) return P.home
  // P0：业主邀请链接直接指向**业主专用页**（不再落到员工邀请页再重定向），
  // 业主侧全程只看到"验证手机号，进入我的家"。
  const query = [
    'type=customer',
    generated.value.id ? `inviteId=${encodeURIComponent(generated.value.id)}` : '',
    generated.value.token ? `token=${encodeURIComponent(generated.value.token)}` : ''
  ].filter(Boolean).join('&')
  return `${P.ownerEnter}?${query}`
}
function copy() {
  if (!generated.value) return
  uni.setClipboardData({
    data: `【装得清】${project.value?.name || ''} 邀请您同频查看装修进度。请点击链接或使用小程序路径：${invitePath()}`,
    success: () => toast('邀请链接已复制，可发给业主', 'success')
  })
}
function share() {
  toast('请使用右上角微信分享，邀请链接已绑定本工地', 'success')
}

// 邀请令牌是一次性的，朋友圈分享无法携带页面参数，因此显式关闭朋友圈入口。
useShare(() => ({
  title: `${project.value?.name || '我的家'} · 装得清进度同频`,
  path: invitePath()
}), null)
</script>

<template>
  <view class="pi" v-if="project">
    <view class="pi__card jz-card">
      <text class="pi__title">邀请业主同频</text>
      <text class="pi__sub">业主通过邀请令牌进入后，仅可见「{{ project.name }}」的进度、动态与验收</text>

      <view class="pi__field"><text class="pi__label">业主称呼</text><input v-model="customerName" placeholder="例：王先生" /></view>
      <view class="pi__field"><text class="pi__label">业主手机</text><input v-model="customerPhone" type="number" maxlength="11" placeholder="必填，用于微信手机号一致性校验" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" /></view>

      <button class="jz-btn jz-btn--primary jz-btn--block pi__gen-btn" @tap="gen"><JzIcon name="user-plus" :size="28" :color="TOKEN_COLOR.white" /><text>生成业主邀请</text></button>

      <view v-if="generated" class="pi__code-box">
        <text class="pi__code-label">业主邀请令牌（绑定本工地）</text>
        <text class="pi__code">{{ generated.token || generated.code }}</text>
        <view class="jz-row pi__btns">
          <button class="jz-btn jz-btn--ghost jz-btn--sm" @tap="copy"><JzIcon name="copy" :size="24" :color="TOKEN_COLOR.primary" /><text>复制邀请语</text></button>
          <button class="jz-btn jz-btn--plain jz-btn--sm" @tap="share"><JzIcon name="share" :size="24" :color="TOKEN_COLOR.primary" /><text>微信发给业主</text></button>
        </view>
      </view>
    </view>

    <view class="pi__flow jz-card">
      <text class="pi__flow-title">业主同频闭环</text>
      <view class="pi__step"><text class="pi__step-idx">1</text><text class="pi__step-text">生成邀请/分享卡片</text></view>
      <view class="pi__step"><text class="pi__step-idx">2</text><text class="pi__step-text">业主微信打开，授权手机号，完成邀请令牌绑定</text></view>
      <view class="pi__step"><text class="pi__step-idx">3</text><text class="pi__step-text">业主进入「我的家」随时查看进度与动态</text></view>
      <view class="pi__step"><text class="pi__step-idx">4</text><text class="pi__step-text">阶段验收，业主一键确认，自动进入下一阶段</text></view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.pi { padding: 24rpx; }
.pi__card { padding: 30rpx 28rpx; margin-bottom: 20rpx; }
.pi__title { font-size: $jzb-font-lg; font-weight: 700; }
.pi__sub { display: block; margin-top: 8rpx; font-size: $jzb-font-sm; color: $jzb-text-3; line-height: 1.6; }
.pi__field { display: flex; flex-direction: row; align-items: center; border: 1rpx solid $jzb-border; border-radius: $jzb-radius; padding: 0 22rpx; height: 92rpx; margin: 24rpx 0 16rpx; }
.pi__label { width: 170rpx; font-size: $jzb-font; color: $jzb-text-2; }
.pi__field input { flex: 1; font-size: $jzb-font-md; }
.pi__code-box { margin-top: 30rpx; background: $jzb-gradient-soft; border-radius: $jzb-radius; padding: 28rpx; display: flex; flex-direction: column; align-items: center; }
.pi__code-label { font-size: $jzb-font-sm; color: $jzb-text-2; }
.pi__code { margin: 16rpx 0; font-size: 64rpx; font-weight: 800; letter-spacing: 10rpx; color: $jzb-primary-dark; }
.pi__btns { margin-top: 6rpx; }
.pi__btns .jz-btn { margin: 0 10rpx; }
.pi__flow { padding: 26rpx 28rpx; }
.pi__flow-title { font-size: $jzb-font; font-weight: 600; margin-bottom: 18rpx; }
.pi__step { display: flex; flex-direction: row; align-items: center; margin-bottom: 16rpx; }
.pi__step-idx { width: 40rpx; height: 40rpx; border-radius: 50%; background: $jzb-primary-lighter; color: $jzb-primary-dark; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-right: 18rpx; font-size: $jzb-font-sm; }
.pi__step-text { font-size: $jzb-font-sm; color: $jzb-text-2; }
</style>
