<script setup lang="ts">
/**
 * 邀请业主同频。
 *
 * 历史坑（FIX-042）：本页曾在结果区展示「业主邀请令牌」明文，与已收敛的口径冲突
 * （员工邀请页 `subpackages/company/pages/invite.vue` 已明确「不使用邀请令牌」）。
 * 现在：页面与分享路径都不再出现令牌——分享/进入只带 `inviteId`，业主凭**本人微信手机号**
 * 与邀请预留手机号一致进入；令牌仍由后端保留（兼容历史已发出的带 token 链接），不再对外展示。
 */
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
import JzTag from '@/components/JzTag.vue'

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
  // FIX-042：路径只带 inviteId（不再带 token）；业主专用页读 inviteId 后由"手机号一致"完成进入。
  const query = [
    'type=customer',
    generated.value.id ? `inviteId=${encodeURIComponent(generated.value.id)}` : ''
  ].filter(Boolean).join('&')
  return `${P.ownerEnter}?${query}`
}

/** 手机号脱敏展示：138****9999。 */
function maskPhone(value: string): string {
  const digits = (value || '').replace(/\D/g, '')
  if (digits.length < 7) return value
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`
}

/**
 * 复制邀请语：只复制**自然语言**文案，不再携带令牌或带参小程序路径
 * （口径同员工邀请页：沟通靠微信卡片，技术参数不进员工视野）。
 */
function copy() {
  if (!generated.value) return
  uni.setClipboardData({
    data: `【装得清】${project.value?.name || ''} 已开通进度同频，请用本机微信打开「装得清」小程序并验证手机号，即可查看装修进度、材料与验收。`,
    success: () => toast('邀请语已复制，可配合邀请卡片发给业主', 'success')
  })
}

/** 邀请卡片是业主进入的唯一入口（令牌不进页面，故不再提供手工令牌）。 */
function share() {
  toast('请用上方「微信分享邀请卡片」发送给业主', 'success')
}

// 邀请一次性，朋友圈分享无法携带页面参数，因此显式关闭朋友圈入口。
useShare(() => ({
  title: `${project.value?.name || '我的家'} · 装得清进度同频`,
  path: invitePath()
}), null)
</script>

<template>
  <view class="pi" v-if="project">
    <view class="pi__card jz-card">
      <text class="pi__title">邀请业主同频</text>
      <text class="pi__sub">填写业主手机号生成邀请，用微信分享邀请卡片；业主授权手机号后仅可见「{{ project.name }}」的进度、动态与验收</text>

      <view class="pi__field"><text class="pi__label">业主称呼</text><input v-model="customerName" placeholder="例：王先生" /></view>
      <view class="pi__field"><text class="pi__label">业主手机</text><input v-model="customerPhone" type="number" maxlength="11" placeholder="必填，用于微信手机号一致性校验" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" /></view>

      <button class="jz-btn jz-btn--primary jz-btn--block pi__gen-btn" @tap="gen"><JzIcon name="user-plus" :size="28" :color="TOKEN_COLOR.white" /><text>生成业主邀请</text></button>

      <view v-if="generated" class="jz-card pi__result">
        <view class="pi__result-head">
          <JzTag text="邀请已创建" :color="TOKEN_COLOR.success" />
          <text class="pi__result-valid">有效期 7 天</text>
        </view>
        <text class="pi__result-name">{{ generated.inviteName || customerName }}</text>
        <text class="pi__result-phone">{{ maskPhone(generated.telNo || customerPhone) }} · 邀请编号 {{ generated.id }}</text>
        <button class="jz-btn jz-btn--primary jz-btn--block" open-type="share">
          <JzIcon name="share" :size="26" :color="TOKEN_COLOR.white" /><text>微信分享邀请卡片</text>
        </button>
        <button class="jz-btn jz-btn--ghost jz-btn--sm pi__copy" @tap="copy">
          <JzIcon name="copy" :size="24" :color="TOKEN_COLOR.primary" /><text>复制邀请语</text>
        </button>
        <text class="pi__result-tip">请用邀请卡片发送给业主：业主点开后授权手机号即可进入「我的家」。</text>
      </view>
    </view>

    <view class="pi__flow jz-card">
      <text class="pi__flow-title">业主同频闭环</text>
      <view class="pi__step"><text class="pi__step-idx">1</text><text class="pi__step-text">填写业主手机号并生成邀请卡片</text></view>
      <view class="pi__step"><text class="pi__step-idx">2</text><text class="pi__step-text">微信分享卡片给业主，业主授权手机号（须与预留号码一致）</text></view>
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
.pi__field input { flex: 1; font-size: $jzb-font-md; text-align: right; }
.pi__result { margin-top: 30rpx; padding: 28rpx; }
.pi__result-head { display: flex; align-items: center; justify-content: space-between; }
.pi__result-valid { color: $jzb-text-3; font-size: $jzb-font-sm; }
.pi__result-name { display: block; margin-top: 18rpx; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 700; }
.pi__result-phone { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.pi__result .jz-btn--block { margin-top: 24rpx; }
.pi__copy { margin: 16rpx auto 0; }
.pi__result-tip { display: block; margin-top: 14rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.6; text-align: center; }
.pi__flow { padding: 26rpx 28rpx; }
.pi__flow-title { font-size: $jzb-font; font-weight: 600; margin-bottom: 18rpx; }
.pi__step { display: flex; flex-direction: row; align-items: center; margin-bottom: 16rpx; }
.pi__step-idx { width: 40rpx; height: 40rpx; border-radius: 50%; background: $jzb-primary-lighter; color: $jzb-primary-dark; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-right: 18rpx; font-size: $jzb-font-sm; }
.pi__step-text { font-size: $jzb-font-sm; color: $jzb-text-2; }
</style>
