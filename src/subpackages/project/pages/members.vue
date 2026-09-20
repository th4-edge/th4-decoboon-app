<script setup lang="ts">
function go(url: string) { uni.navigateTo({ url }) }
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can, isCustomer } from '@/roles/permission'
import type { ProjectMember } from '@/domains/identity/model'
import type { Project } from '@/domains/project/model'
import { projectApi } from '@/domains/project/api'
import JzAvatar from '@/components/JzAvatar.vue'
import JzTag from '@/components/JzTag.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const id = ref('')
const project = ref<Project | null>(null)
const members = ref<ProjectMember[]>([])
const canInviteOwner = computed(() => can(session.role || 'boss', 'act:inviteCustomer') && !isCustomer(session.role))
const canInviteMember = computed(() => can(session.role || 'boss', 'act:inviteMember'))

onLoad((q) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  id.value = q?.id || ''
  load()
})
async function load() {
  const [p, m] = await Promise.all([projectApi.info(id.value), projectApi.members(id.value)])
  project.value = p || null
  members.value = m
}
const emps = computed(() => members.value.filter((m) => m.kind === 'employee'))
const custs = computed(() => members.value.filter((m) => m.kind === 'customer'))
function color(m: ProjectMember) {
  if (m.kind === 'customer') return '#F53F3F'
  return m.emp?.role === 'pm' ? '#FA8C16' : m.emp?.role === 'designer' ? '#722ED1' : m.emp?.role === 'boss' ? TOKEN_COLOR.primaryBase : '#13C2C2'
}

/** 加入时间格式化：后端返回 20260917002637 这类紧凑时间戳时转为 YYYY-MM-DD。 */
function joinedText(value?: string | number) {
  if (!value) return '-'
  const digits = String(value).replace(/\D/g, '')
  if (digits.length >= 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  }
  return String(value).slice(0, 10)
}
</script>

<template>
  <view class="mb">
    <view class="jz-section"><text class="jz-section__title">项目团队（{{ emps.length }}）</text></view>
    <view class="jz-card mb__list">
      <view v-for="m in emps" :key="m.id" class="mb__row">
        <JzAvatar :src="m.emp?.avatarUrl || ''" :name="m.emp?.name" :color="color(m)" :size="76" />
        <view class="jz-grow mb__who">
          <view class="jz-row">
            <text class="mb__name">{{ m.emp?.name }}</text>
            <JzTag :text="m.label" :color="color(m)" />
          </view>
          <text class="mb__meta">{{ m.emp?.title }} · {{ joinedText(m.joinedAt) }} 加入</text>
        </view>
        <text v-if="m.emp?.id === session.emp?.id" class="mb__me">我</text>
      </view>
      <view v-if="!emps.length" class="mb__empty">暂无团队成员</view>
    </view>

    <view class="jz-section"><text class="jz-section__title">业主同频（{{ custs.length }}）</text></view>
    <view class="jz-card mb__list">
      <view v-for="m in custs" :key="m.id" class="mb__row">
        <JzAvatar :name="m.customer?.name" color="#F53F3F" :size="76" />
        <view class="jz-grow mb__who">
          <view class="jz-row"><text class="mb__name">{{ m.customer?.name }}</text><JzTag text="业主" color="#F53F3F" /></view>
          <text class="mb__meta">{{ m.customer?.phone ? m.customer.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '' }} · 仅同频可见</text>
        </view>
      </view>
      <view v-if="!custs.length" class="mb__empty">尚未邀请业主，同频闭环需要业主加入</view>
    </view>

    <view class="mb__actions">
      <button v-if="canInviteOwner" class="jz-btn jz-btn--primary jz-btn--block mb__action" @tap="go(`${P.projectInvite}?id=${id}`)"><JzIcon name="user-plus" :size="28" :color="TOKEN_COLOR.white" /><text>邀请业主同频</text></button>
      <button v-if="canInviteMember" class="jz-btn jz-btn--ghost jz-btn--block mb__action" style="margin-top:16rpx;" @tap="go(P.companyInvite)"><JzIcon name="users" :size="26" :color="TOKEN_COLOR.primary" /><text>邀请设计师 / 项目经理加入团队</text></button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.mb { padding-bottom: 60rpx; }
.mb__list { margin: 0 24rpx; padding: 8rpx 24rpx; }
.mb__row { display: flex; flex-direction: row; align-items: center; padding: 22rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.mb__row:last-child { border-bottom: none; }
.mb__who { margin-left: 18rpx; }
.mb__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mb__meta { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.mb__me { font-size: $jzb-font-xs; color: $jzb-primary; }
.mb__empty { text-align: center; color: $jzb-text-4; font-size: $jzb-font-xs; padding: 30rpx 0; }
.mb__actions { padding: 20rpx 24rpx; }
.mb__action { display: flex; align-items: center; justify-content: center; }
.mb__action text { margin-left: 8rpx; }
</style>
