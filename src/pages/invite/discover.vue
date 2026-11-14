<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { identityApi } from '@/domains/identity/api'
import type { PendingEntryInvite } from '@/domains/identity/model'
import { pendingInviteLandingUrl } from '@/domains/identity/inviteContext'
import { session } from '@/domains/identity/session'
import { createInviteTraceId, traceInvite } from '@/domains/identity/inviteTrace'
import { toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import CompanyBrandMark from '@/components/CompanyBrandMark.vue'

const loading = ref(true)
const error = ref('')
const invites = ref<PendingEntryInvite[]>([])

onLoad(async () => {
  if (!session.token || !session.user) {
    uni.reLaunch({ url: P.login })
    return
  }
  await load()
})

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const list = await identityApi.pendingEntryInvites()
    traceInvite('invite_discovery_loaded', {
      source: 'pending_discovery',
      stage: 'discover',
      result: list.length ? 'success' : 'empty'
    })
    if (list.length === 1) {
      uni.redirectTo({ url: pendingInviteLandingUrl(list[0]) })
      return
    }
    invites.value = list
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : '邀请暂不可确认，请稍后重试'
    toastError(loadError, error.value)
  } finally {
    loading.value = false
  }
}

function typeLabel(invite: PendingEntryInvite): string {
  return invite.type === 'customer' ? '业主项目' : '员工邀请'
}

function subtitle(invite: PendingEntryInvite): string {
  if (invite.type === 'customer') return invite.projectName || '查看我的家'
  return [invite.role ? roleName(invite.role) : '员工', invite.storeName].filter(Boolean).join(' · ')
}

function roleName(role: string): string {
  const names: Record<string, string> = {
    boss: '企业负责人',
    storeManager: '店长',
    designer: '设计师',
    marketer: '业务员',
    pm: '项目经理',
    finance: '财务',
    teamLeader: '团队负责人'
  }
  return names[role] || '员工'
}

function open(invite: PendingEntryInvite): void {
  const source = 'pending_discovery'
  const traceId = createInviteTraceId(invite.id, source)
  traceInvite('invite_discovery_opened', {
    inviteId: invite.id,
    traceId,
    source,
    stage: 'discover',
    result: 'success'
  })
  uni.navigateTo({ url: pendingInviteLandingUrl(invite, { source, traceId }) })
}

function returnJoin(): void {
  uni.reLaunch({ url: P.companyJoin })
}
</script>

<template>
  <view class="discover">
    <JzPageHeader title="待加入邀请" subtitle="当前微信已验证手机号下找到的邀请" back />
    <view class="discover__body">
      <view v-if="loading" class="discover__state jz-card">
        <text>正在查询可加入的企业和项目…</text>
      </view>

      <view v-else-if="error" class="discover__state discover__state--error jz-card">
        <JzIcon name="alert-circle" :size="42" :color="TOKEN_COLOR.danger" />
        <text class="discover__state-title">邀请暂不可确认</text>
        <text class="discover__state-text">{{ error }}</text>
        <button class="jz-btn jz-btn--primary jz-btn--block" @tap="load">重新查询</button>
      </view>

      <template v-else>
        <view class="discover__intro">
          <text class="discover__title">请选择要处理的邀请</text>
          <text class="discover__subtitle">当前手机号匹配到 {{ invites.length }} 条待接受邀请</text>
        </view>

        <view v-for="invite in invites" :key="`${invite.type}-${invite.id}`" class="discover__card jz-card">
          <view class="discover__head">
            <CompanyBrandMark
              :name="invite.companyName"
              :logo="invite.companyLogo || ''"
              :color="invite.companyColor || ''"
              :size="82"
            />
            <view class="discover__copy">
              <view class="discover__tag">{{ typeLabel(invite) }}</view>
              <text class="discover__company">{{ invite.companyName }}</text>
              <text class="discover__subtitle-line">{{ subtitle(invite) }}</text>
            </view>
          </view>
          <view class="discover__facts">
            <view><text>邀请人</text><text>{{ invite.inviterName || '企业管理员' }}</text></view>
            <view v-if="invite.type === 'customer'"><text>房屋</text><text>{{ invite.propertyAddress || '以项目登记为准' }}</text></view>
            <view><text>手机号</text><text>{{ invite.maskedPhone || '待确认' }}</text></view>
          </view>
          <button class="jz-btn jz-btn--primary jz-btn--block" @tap="open(invite)">查看并接受</button>
        </view>

        <view v-if="!invites.length" class="discover__state jz-card">
          <JzIcon name="inbox" :size="42" :color="TOKEN_COLOR.text3" />
          <text class="discover__state-title">当前手机号没有待接受邀请</text>
          <text class="discover__state-text">可以返回未加入企业页，选择创建企业或联系邀请人重新发送。</text>
          <button class="jz-btn jz-btn--ghost jz-btn--block" @tap="returnJoin">返回未加入企业页</button>
        </view>
      </template>
    </view>
  </view>
</template>

<style scoped lang="scss">
.discover { min-height: 100vh; background: $jzb-bg-page; }
.discover__body { padding: 28rpx; }
.discover__intro { padding: 0 8rpx 24rpx; }
.discover__title { display: block; color: $jzb-text-1; font-size: $jzb-font-xl; font-weight: 750; }
.discover__subtitle { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.discover__card { padding: 28rpx; margin-bottom: 22rpx; }
.discover__head { display: flex; align-items: center; gap: 20rpx; }
.discover__copy { min-width: 0; flex: 1; }
.discover__tag { display: inline-flex; padding: 4rpx 12rpx; border-radius: 999rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter; font-size: 20rpx; }
.discover__company { display: block; margin-top: 10rpx; overflow: hidden; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 720; text-overflow: ellipsis; white-space: nowrap; }
.discover__subtitle-line { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.discover__facts { margin: 22rpx 0; padding: 8rpx 0; border-top: 1rpx solid $jzb-border-light; border-bottom: 1rpx solid $jzb-border-light; }
.discover__facts > view { display: flex; justify-content: space-between; gap: 20rpx; padding: 10rpx 0; font-size: $jzb-font-sm; }
.discover__facts > view text:first-child { color: $jzb-text-3; }
.discover__facts > view text:last-child { overflow: hidden; color: $jzb-text-1; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.discover__state { min-height: 300rpx; padding: 48rpx 28rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; color: $jzb-text-3; text-align: center; }
.discover__state-title { margin-top: 18rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.discover__state-text { margin: 12rpx 0 28rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.6; }
</style>
