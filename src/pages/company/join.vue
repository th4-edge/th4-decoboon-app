<script setup lang="ts">
import { computed, ref } from 'vue'
import { P } from '@/config'
import { identityApi } from '@/domains/identity/api'
import { logout, session } from '@/domains/identity/session'
import { confirm, hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'

const inviteInput = ref('')
const submitting = ref(false)

const displayName = computed(() => session.user?.nickname || '微信用户')
const displayPhone = computed(() => session.user?.phone || '未授权手机号')
const avatarText = computed(() => displayName.value.slice(0, 1))

/** 从链接或 query 串中提取参数（小程序环境不保证 URLSearchParams 可用）。 */
function pickParam(source: string, key: string): string {
  const match = new RegExp(`[?&]${key}=([^&#]+)`).exec(source)
  return match ? decodeURIComponent(match[1]) : ''
}

/**
 * 支持三种输入：
 * 1. 邀请编号（纯数字）→ 员工邀请
 * 2. 邀请链接（含 inviteId / token 参数）→ 自动识别邀请类型
 * 3. 纯 token 随机串（含字母的长串）→ 业主邀请
 */
function parseInvite(raw: string): { inviteId?: string; token?: string } | null {
  const value = raw.trim()
  if (!value) return null
  const inviteId = pickParam(value, 'inviteId')
  if (inviteId) return { inviteId }
  const token = pickParam(value, 'token')
  if (token) return { token }
  if (/^\d{6,}$/.test(value)) return { inviteId: value }
  if (/^[A-Za-z0-9_-]{16,}$/.test(value)) return { token: value }
  return { inviteId: value }
}

async function openInvite() {
  const parsed = parseInvite(inviteInput.value)
  if (!parsed) {
    toast('请输入邀请编号或粘贴邀请链接')
    return
  }
  if (submitting.value) return
  submitting.value = true
  loading('正在校验邀请…')
  try {
    if (parsed.inviteId) {
      await identityApi.invitationInfo(parsed.inviteId)
      hideLoading()
      uni.navigateTo({ url: `${P.inviteAccept}?inviteId=${encodeURIComponent(parsed.inviteId)}` })
      return
    }
    await identityApi.customerInvitationInfo({ token: parsed.token })
    hideLoading()
    uni.navigateTo({ url: `${P.inviteAccept}?token=${encodeURIComponent(parsed.token as string)}` })
  } catch (error) {
    hideLoading()
    toastError(error, '邀请不存在或已失效')
  } finally {
    submitting.value = false
  }
}

function createCompany() {
  uni.navigateTo({ url: P.enterprise })
}

async function relogin() {
  const confirmed = await confirm('切换微信账号', '将退出当前登录，重新使用微信授权进入。是否继续？', '退出登录')
  if (!confirmed) return
  logout()
  uni.reLaunch({ url: P.login })
}
</script>

<template>
  <view class="join-page">
    <JzPageHeader title="加入企业" subtitle="微信身份已登录，等待加入企业" />

    <view class="join-body">
      <view class="join-identity jz-card">
        <view class="join-identity__avatar"><text>{{ avatarText }}</text></view>
        <view class="join-identity__meta">
          <text class="join-identity__name">{{ displayName }}</text>
          <text class="join-identity__phone">{{ displayPhone }}</text>
        </view>
        <view class="join-identity__badge">
          <JzIcon name="info" :size="24" color="#778390" />
          <text>未归属企业</text>
        </view>
      </view>

      <view class="join-invite jz-card">
        <text class="join-invite__title">使用邀请加入</text>
        <text class="join-invite__desc">粘贴企业分享的邀请编号或邀请链接，即可查看邀请并加入。</text>
        <input
          v-model="inviteInput"
          class="join-invite__input"
          type="text"
          placeholder="邀请编号 / 邀请链接"
          placeholder-class="join-invite__placeholder"
          confirm-type="done"
          @confirm="openInvite"
        />
        <button
          class="jz-btn jz-btn--primary jz-btn--block join-invite__submit"
          :loading="submitting"
          :disabled="submitting"
          @tap="openInvite"
        >
          查看邀请
        </button>
        <text class="join-invite__hint">支持邀请编号与邀请链接两种形式；链接会自动识别邀请类型。</text>
      </view>

      <view class="join-actions">
        <button class="jz-btn jz-btn--ghost join-actions__item" @tap="createCompany">
          <JzIcon name="building" :size="28" color="#0E8A7D" />
          <text>创建新企业</text>
        </button>
        <button class="jz-btn jz-btn--neutral join-actions__item" @tap="relogin">
          <JzIcon name="logout" :size="28" color="#465260" />
          <text>切换微信账号</text>
        </button>
      </view>

      <text class="join-footnote">没有邀请？请联系企业管理员在「成员管理 - 邀请成员」中生成邀请。</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.join-page { min-height: 100vh; background: $jzb-bg-page; }
.join-body { padding: 32rpx $jzb-page-pad 48rpx; }

.join-identity { display: flex; align-items: center; padding: 32rpx; }
.join-identity__avatar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96rpx;
  height: 96rpx;
  background: $jzb-primary-lighter;
  border-radius: $jzb-radius-sm;
}
.join-identity__avatar text { color: $jzb-primary-dark; font-size: 40rpx; font-weight: 700; }
.join-identity__meta { flex: 1; min-width: 0; margin-left: 24rpx; }
.join-identity__name { display: block; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 700; }
.join-identity__phone { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.join-identity__badge {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 16rpx;
  background: $jzb-bg-hover;
  border-radius: $jzb-radius-sm;
}
.join-identity__badge text { color: $jzb-text-3; font-size: $jzb-font-xs; }

.join-invite { margin-top: 24rpx; padding: 32rpx; }
.join-invite__title { display: block; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 700; }
.join-invite__desc { display: block; margin-top: 12rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.7; }
.join-invite__input {
  width: 100%;
  height: 88rpx;
  margin-top: 24rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
  color: $jzb-text-1;
  font-size: $jzb-font;
  background: $jzb-bg-hover;
  border-radius: $jzb-radius-sm;
}
.join-invite__placeholder { color: $jzb-text-4; }
.join-invite__submit { margin-top: 24rpx; }
.join-invite__hint { display: block; margin-top: 16rpx; color: $jzb-text-4; font-size: $jzb-font-xs; line-height: 1.6; }

.join-actions { display: flex; gap: 16rpx; margin-top: 32rpx; }
.join-actions__item { flex: 1; min-width: 0; }
.join-actions__item .jz-icon { flex-shrink: 0; }

.join-footnote { display: block; margin-top: 32rpx; color: $jzb-text-4; font-size: $jzb-font-xs; line-height: 1.7; text-align: center; }
</style>
