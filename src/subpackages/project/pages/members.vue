<script setup lang="ts">
function go(url: string) { uni.navigateTo({ url }) }
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can, isCustomer } from '@/roles/permission'
import { ROLE_META } from '@/roles/catalog'
import type { Employee, ProjectMember } from '@/domains/identity/model'
import type { Project } from '@/domains/project/model'
import { identityApi } from '@/domains/identity/api'
import { projectApi } from '@/domains/project/api'
import { toast, toastError } from '@/composables/toast'
import JzAvatar from '@/components/JzAvatar.vue'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import JzTag from '@/components/JzTag.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzSheet from '@/components/JzSheet.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const id = ref('')
const project = ref<Project | null>(null)
const members = ref<ProjectMember[]>([])
const employees = ref<Employee[]>([])
const picking = ref<'' | 'pm' | 'designer'>('')
const canInviteOwner = computed(() => can(session.role || 'boss', 'act:inviteCustomer') && !isCustomer(session.role))
const canInviteMember = computed(() => can(session.role || 'boss', 'act:inviteMember'))
/** 成员切换：企业负责人或本门店店长（服务端 requireMemberEditor 强校验） */
const canSwitchMember = computed(() => ['boss', 'storeManager'].includes(session.role || '') && !isCustomer(session.role))
const manager = computed(() => project.value?.manager)
const designer = computed(() => project.value?.designer)
const candidates = computed(() => {
  if (!picking.value) return []
  const active = employees.value.filter((e) => e.status === 'active')
  if (picking.value === 'pm') return active.filter((e) => ['pm', 'boss'].includes(e.role))
  return active
})
const pickingTitle = computed(() => (picking.value === 'pm' ? '项目经理' : '设计师'))

onLoad((q) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  id.value = q?.id || ''
  if (q?.mode === 'assign') picking.value = 'pm'
  load()
})
async function load() {
  let p: Project | null = null
  let m: ProjectMember[] = []
  try {
    [p, m] = await Promise.all([projectApi.info(id.value), projectApi.members(id.value)])
  } catch (error) {
    toastError(error, '项目成员加载失败')
  }
  project.value = p
  members.value = m
  if (canSwitchMember.value && !employees.value.length) {
    employees.value = await identityApi.employees().catch(() => [])
  }
}
function openPicker(role: 'pm' | 'designer') {
  if (!canSwitchMember.value) return
  picking.value = role
}
async function choose(emp: Employee) {
  const target = picking.value
  if (!target) return
  try {
    // 后端 project/member/save 需要 empId + EmployeeRole 枚举名（Pm / Designer）
    await projectApi.addMember(id.value, { empId: emp.id, role: target === 'pm' ? 'Pm' : 'Designer' } as never)
    picking.value = ''
    toast(target === 'pm' ? `项目经理已切换为 ${emp.name}` : `设计师已切换为 ${emp.name}`, 'success')
    await load()
  } catch (error) {
    toastError(error, '切换失败')
  }
}
const emps = computed(() => members.value.filter((m) => m.kind === 'employee'))
const custs = computed(() => members.value.filter((m) => m.kind === 'customer'))
function color(m: ProjectMember) {
  if (m.kind === 'customer') return ROLE_META.customer.color
  return ROLE_META[m.emp?.role || m.role].color
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
    <view class="jz-section"><text class="jz-section__title">工地岗位</text></view>
    <view class="jz-card mb__roles">
      <view class="mb__role-row" @tap="openPicker('pm')">
        <JzEmployeeAvatar v-if="manager" :src="manager.avatarUrl || ''" :name="manager.name" :role="manager.role" :status="manager.status" :size="72" />
        <view class="jz-grow mb__role-person">
          <text class="mb__role-label">项目经理</text>
          <text class="mb__role-value" :class="{ 'mb__role-value--empty': !manager }">{{ manager?.name || '未指定（工地无法开工）' }}</text>
        </view>
        <text v-if="canSwitchMember" class="mb__role-action">{{ manager ? '切换' : '指定' }}</text>
      </view>
      <view class="mb__role-row" @tap="openPicker('designer')">
        <JzEmployeeAvatar v-if="designer" :src="designer.avatarUrl || ''" :name="designer.name" :role="designer.role" :status="designer.status" :size="72" />
        <view class="jz-grow mb__role-person">
          <text class="mb__role-label">设计师</text>
          <text class="mb__role-value" :class="{ 'mb__role-value--empty': !designer }">{{ designer?.name || '未指定' }}</text>
        </view>
        <text v-if="canSwitchMember" class="mb__role-action">{{ designer ? '切换' : '指定' }}</text>
      </view>
      <text v-if="!canSwitchMember" class="mb__role-tip">仅企业负责人或本门店店长可以切换工地岗位</text>
    </view>

    <view class="jz-section"><text class="jz-section__title">项目团队（{{ emps.length }}）</text></view>
    <view class="jz-card mb__list">
      <view v-for="m in emps" :key="m.id" class="mb__row">
        <JzEmployeeAvatar :src="m.emp?.avatarUrl || ''" :name="m.emp?.name" :role="m.emp?.role || m.role" :status="m.emp?.status" :size="84" />
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
        <JzAvatar :name="m.customer?.name" :color="ROLE_META.customer.color" :size="76" />
        <view class="jz-grow mb__who">
          <view class="jz-row"><text class="mb__name">{{ m.customer?.name }}</text><JzTag text="业主" :color="ROLE_META.customer.color" /></view>
          <text class="mb__meta">{{ m.customer?.phone ? m.customer.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '' }} · 仅同频可见</text>
        </view>
      </view>
      <view v-if="!custs.length" class="mb__empty">尚未邀请业主，同频闭环需要业主加入</view>
    </view>

    <view class="mb__actions">
      <button v-if="canInviteOwner" class="jz-btn jz-btn--primary jz-btn--block mb__action" @tap="go(`${P.projectInvite}?id=${id}`)"><JzIcon name="user-plus" :size="28" :color="TOKEN_COLOR.white" /><text>邀请业主同频</text></button>
      <button v-if="canInviteMember" class="jz-btn jz-btn--ghost jz-btn--block mb__action" style="margin-top:16rpx;" @tap="go(P.companyInvite)"><JzIcon name="users" :size="26" :color="TOKEN_COLOR.primary" /><text>邀请设计师 / 项目经理加入团队</text></button>
    </view>
    <!-- 员工选择（工地下发岗位） -->
    <JzSheet :visible="Boolean(picking)" :title="`选择${pickingTitle}`" @close="picking = ''">
      <view class="mb__editor">
        <scroll-view scroll-y class="mb__sheet-list">
          <view v-for="e in candidates" :key="e.id" class="mb__sheet-item" @tap="choose(e)">
            <JzEmployeeAvatar :src="e.avatarUrl || ''" :name="e.name" :role="e.role" :status="e.status" :size="76" />
            <view class="jz-grow mb__sheet-who">
              <text class="mb__sheet-name">{{ e.name }}</text>
              <text class="mb__sheet-role">{{ e.title || e.role }} · {{ e.store?.name || '总店' }}</text>
            </view>
            <JzIcon v-if="(picking === 'pm' ? manager?.id : designer?.id) === e.id" name="check" :size="30" :color="TOKEN_COLOR.primary" />
          </view>
          <view v-if="!candidates.length" class="mb__empty">暂无当前范围可选的在职员工（可先在「我的-企业成员」添加）</view>
        </scroll-view>
      </view>
    </JzSheet>
  </view>
</template>

<style lang="scss" scoped>
.mb { padding-bottom: 60rpx; }
.mb__roles { margin: 0 24rpx; padding: 8rpx 24rpx; }
.mb__role-row { display: flex; flex-direction: row; align-items: center; padding: 24rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.mb__role-row:last-child { border-bottom: none; }
.mb__role-label { display: block; font-size: $jzb-font-xs; color: $jzb-text-3; }
.mb__role-value { display: block; margin-top: 6rpx; font-size: $jzb-font-sm; font-weight: 700; color: $jzb-text-1; }
.mb__role-value--empty { color: $jzb-danger; }
.mb__role-action { font-size: $jzb-font-xs; color: $jzb-primary; padding: 6rpx 18rpx; background: $jzb-primary-lighter; border-radius: $jzb-radius-pill; }
.mb__role-person { margin-left: 18rpx; }
.mb__role-tip { display: block; padding: 14rpx 0 6rpx; font-size: $jzb-font-xs; color: $jzb-text-4; }
.mb__editor { display: flex; flex-direction: column; max-height: 60vh; }
.mb__sheet-list { flex: 1; min-height: 0; height: 0; }
.mb__sheet-item { display: flex; flex-direction: row; align-items: center; padding: 20rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.mb__sheet-who { margin-left: 18rpx; }
.mb__sheet-name { display: block; font-size: $jzb-font-sm; font-weight: 600; color: $jzb-text-1; }
.mb__sheet-role { display: block; margin-top: 4rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
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
