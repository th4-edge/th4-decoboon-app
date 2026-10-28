<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { identityApi } from '@/domains/identity/api'
import type { Employee, Store } from '@/domains/identity/model'
import { ROLE_META } from '@/roles/catalog'
import type { EmployeeRole } from '@/domains/identity/model'
import { toast, toastError } from '@/composables/toast'
import { session } from '@/domains/identity/session'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzTag from '@/components/JzTag.vue'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

const member = ref<Employee | null>(null)
const empId = ref('')
const allEditableRoles: { value: EmployeeRole; label: string }[] = [
  { value: 'storeManager', label: '店长' }, { value: 'designer', label: '设计师' },
  { value: 'marketer', label: '业务员' }, { value: 'pm', label: '项目经理' },
  { value: 'finance', label: '财务' }
]
const editableRoles = computed(() => session.role === 'boss'
  ? allEditableRoles
  : allEditableRoles.filter(item => item.value !== 'storeManager'))
const roleIndex = ref(-1)
const stores = ref<Store[]>([])
const storeIndex = ref(0)
const canManageTarget = computed(() => !!member.value && member.value.id !== session.emp?.id && (session.role === 'boss' || (session.role === 'storeManager' && member.value.role !== 'storeManager' && member.value.role !== 'boss')))
const canChangeRole = computed(() => canManageTarget.value && member.value?.role !== 'boss')
const canMoveStore = computed(() => session.role === 'boss' && canManageTarget.value)
const isFrozenRole = computed(() => member.value?.role === 'teamLeader')
const roleSelectLabel = computed(() => editableRoles.value[roleIndex.value]?.label || (isFrozenRole.value ? '请选择新岗位' : ''))
const storeLabel = computed(() => stores.value[storeIndex.value]?.name || member.value?.store?.name || '-')
const status = { active: ['在职', TOKEN_COLOR.success], suspended: ['停用', TOKEN_COLOR.warning], resigned: ['已离职', TOKEN_COLOR.danger] }
onLoad(async (query) => {
  empId.value = query?.empId || ''
  try {
    member.value = await identityApi.memberInfo(empId.value)
    roleIndex.value = editableRoles.value.findIndex(item => item.value === member.value?.role)
    if (canMoveStore.value) {
      stores.value = await identityApi.storeList()
      storeIndex.value = Math.max(0, stores.value.findIndex(item => item.id === member.value?.store?.id))
    }
  }
  catch (error) { toastError(error, '员工详情加载失败') }
})
async function changeRole(label: string) {
  const nextIndex = editableRoles.value.findIndex((item) => item.label === label)
  if (nextIndex < 0) return
  roleIndex.value = nextIndex
  if (!member.value) return
  try {
    member.value = await identityApi.updateMember(member.value.id, editableRoles.value[roleIndex.value].value)
    toast('岗位已调整', 'success')
  } catch (error) { toastError(error, '岗位调整失败') }
}

async function changeStore(label: string) {
  if (!member.value || !canMoveStore.value) return
  const next = stores.value.find(item => item.name === label)
  if (!next || next.id === member.value.store?.id) return
  try {
    member.value = await identityApi.updateMember(member.value.id, member.value.role, { storeId: next.id })
    storeIndex.value = Math.max(0, stores.value.findIndex(item => item.id === next.id))
    toast('员工门店已调整，历史业务门店不会回溯', 'success')
  } catch (error) { toastError(error, '门店调整失败') }
}

function handover() { uni.navigateTo({ url: `${P.companyHandover}?empId=${empId.value}` }) }
</script>

<template>
  <view class="md-page">
    <JzPageHeader title="员工详情" subtitle="企业归属、状态与交接入口" />
    <view v-if="member" class="md-body">
      <view class="jz-card md-card">
        <view class="md-head"><JzEmployeeAvatar :src="member.avatarUrl || ''" :name="member.name" :role="member.role" :status="member.status" :size="104" /><view><text class="md-name">{{ member.name }}</text><text class="md-role">{{ ROLE_META[member.role]?.label || '未知岗位' }}</text></view><JzTag :text="status[member.status || 'active'][0]" :color="status[member.status || 'active'][1]" /></view>
        <view class="md-row"><text>手机号</text><text>{{ member.phone }}</text></view>
        <view v-if="canChangeRole" class="md-row"><text>岗位</text><JzSelectField variant="plain" :display="roleSelectLabel" :range="editableRoles.map(item => item.label)" :index="roleIndex" @change="changeRole" /></view>
        <view v-if="isFrozenRole" class="md-note">团队负责人角色已冻结。请选择店长、设计师、业务员、项目经理或财务之一；历史客户和项目不会自动转交。</view>
        <view class="md-row"><text>所属企业</text><text>{{ member.company?.name || '-' }}</text></view>
        <view v-if="canMoveStore" class="md-row"><text>门店</text><JzSelectField variant="plain" :display="storeLabel" :range="stores.map(item => item.name)" :index="storeIndex" @change="changeStore" /></view>
        <view v-else class="md-row"><text>门店</text><text>{{ member.store?.name || '-' }}</text></view>
        <view class="md-row"><text>团队</text><text>{{ member.team?.name || '-' }}</text></view>
        <view class="md-row"><text>加入时间</text><text>{{ member.joinDate || '-' }}</text></view>
        <view v-if="member.resignedAt" class="md-row"><text>离职时间</text><text>{{ member.resignedAt }}</text></view>
        <view v-if="member.resignReason" class="md-row"><text>离职原因</text><text>{{ member.resignReason }}</text></view>
      </view>
      <button v-if="canManageTarget && member.status === 'active'" class="jz-btn jz-btn--primary jz-btn--block" @tap="handover">发起交接</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.md-page { min-height: 100vh; background: $jzb-bg-page; }
.md-body { padding: 28rpx; }
.md-card { padding: 28rpx; }
.md-head { display: flex; align-items: center; gap: 18rpx; padding-bottom: 24rpx; border-bottom: 1rpx solid $jzb-border-light; }
.md-name { display: block; color: $jzb-text-1; font-size: $jzb-font-xl; font-weight: 750; }
.md-role { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.md-row { display: flex; justify-content: space-between; padding: 20rpx 0; border-bottom: 1rpx solid $jzb-border-light; font-size: $jzb-font-sm; }
.md-row text:first-child { color: $jzb-text-3; }
.md-row text:last-child { max-width: 65%; color: $jzb-text-1; text-align: right; }
.md-note { margin-top: 20rpx; padding: 18rpx 20rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.7; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; }
.md-body > button { margin-top: 28rpx; }
</style>
