<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { identityApi } from '@/domains/identity/api'
import type { Employee } from '@/domains/identity/model'
import { ROLE_META } from '@/roles/catalog'
import type { EmployeeRole } from '@/domains/identity/model'
import { toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzTag from '@/components/JzTag.vue'

const member = ref<Employee | null>(null)
const empId = ref('')
const editableRoles: { value: EmployeeRole; label: string }[] = [
  { value: 'marketer', label: '家装顾问' }, { value: 'designer', label: '设计师' },
  { value: 'pm', label: '项目经理' }, { value: 'projectSupport', label: '履约专员' },
  { value: 'finance', label: '财务' }
]
const roleIndex = ref(0)
const status = { active: ['在职', TOKEN_COLOR.success], suspended: ['停用', TOKEN_COLOR.warning], resigned: ['已离职', TOKEN_COLOR.danger] }
onLoad(async (query) => {
  empId.value = query?.empId || ''
  try {
    member.value = await identityApi.memberInfo(empId.value)
    roleIndex.value = Math.max(0, editableRoles.findIndex(item => item.value === member.value?.role))
  }
  catch (error) { toastError(error, '员工详情加载失败') }
})
async function changeRole(event: { detail: { value: string } }) {
  roleIndex.value = Number(event.detail.value)
  if (!member.value) return
  try {
    member.value = await identityApi.updateMember(member.value.id, editableRoles[roleIndex.value].value)
    toast('岗位已调整', 'success')
  } catch (error) { toastError(error, '岗位调整失败') }
}

function handover() { uni.navigateTo({ url: `${P.companyHandover}?empId=${empId.value}` }) }
</script>

<template>
  <view class="md-page">
    <JzPageHeader title="员工详情" subtitle="企业归属、状态与交接入口" />
    <view v-if="member" class="md-body">
      <view class="jz-card md-card">
        <view class="md-head"><view class="md-avatar">{{ member.name.slice(0, 1) }}</view><view><text class="md-name">{{ member.name }}</text><text class="md-role">{{ ROLE_META[member.role]?.label || member.role }}</text></view><JzTag :text="status[member.status || 'active'][0]" :color="status[member.status || 'active'][1]" /></view>
        <view class="md-row"><text>手机号</text><text>{{ member.phone }}</text></view>
        <view v-if="member.role !== 'boss'" class="md-row"><text>岗位</text><picker :range="editableRoles.map(item => item.label)" :value="roleIndex" @change="changeRole"><text>{{ editableRoles[roleIndex]?.label }}</text></picker></view>
        <view class="md-row"><text>所属企业</text><text>{{ member.company?.name || '-' }}</text></view>
        <view class="md-row"><text>门店</text><text>{{ member.store?.name || '-' }}</text></view>
        <view class="md-row"><text>团队</text><text>{{ member.team?.name || '-' }}</text></view>
        <view class="md-row"><text>加入时间</text><text>{{ member.joinDate || '-' }}</text></view>
        <view v-if="member.resignedAt" class="md-row"><text>离职时间</text><text>{{ member.resignedAt }}</text></view>
        <view v-if="member.resignReason" class="md-row"><text>离职原因</text><text>{{ member.resignReason }}</text></view>
      </view>
      <button v-if="member.status === 'active'" class="jz-btn jz-btn--primary jz-btn--block" @tap="handover">发起交接</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.md-page { min-height: 100vh; background: $jzb-bg-page; }
.md-body { padding: 28rpx; }
.md-card { padding: 28rpx; }
.md-head { display: flex; align-items: center; gap: 18rpx; padding-bottom: 24rpx; border-bottom: 1rpx solid $jzb-border-light; }
.md-avatar { display: flex; align-items: center; justify-content: center; width: 90rpx; height: 90rpx; color: $jzb-text-inverse; background: $jzb-gradient; border-radius: 30rpx; font-size: 40rpx; font-weight: 750; }
.md-name { display: block; color: $jzb-text-1; font-size: $jzb-font-xl; font-weight: 750; }
.md-role { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.md-row { display: flex; justify-content: space-between; padding: 20rpx 0; border-bottom: 1rpx solid $jzb-border-light; font-size: $jzb-font-sm; }
.md-row text:first-child { color: $jzb-text-3; }
.md-row text:last-child { max-width: 65%; color: $jzb-text-1; text-align: right; }
.md-body > button { margin-top: 28rpx; }
</style>
