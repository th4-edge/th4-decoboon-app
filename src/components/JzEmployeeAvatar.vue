<script setup lang="ts">
import { computed } from 'vue'
import type { EmployeeRole } from '@/domains/identity/model'
import { ROLE_META } from '@/roles/catalog'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzAvatar from './JzAvatar.vue'

/**
 * 装企员工统一头像。
 *
 * 员工与业主在协同场景中的视觉语义不同：员工头像带角色色环和岗位色点，
 * 便于在客户、项目、任务、验收与绩效列表中快速识别责任岗位。
 */
const props = withDefaults(defineProps<{
  name?: string
  src?: string
  role?: EmployeeRole | string
  status?: 'active' | 'suspended' | 'resigned' | string
  size?: number
  showRole?: boolean
}>(), {
  name: '员工',
  src: '',
  role: 'marketer',
  status: 'active',
  size: 72,
  showRole: true
})

const ROLE_ALIAS: Record<string, EmployeeRole> = {
  boss: 'boss', '企业负责人': 'boss', '老板': 'boss',
  storemanager: 'storeManager', '店长': 'storeManager',
  teamleader: 'teamLeader', '团队负责人': 'teamLeader', '团队长': 'teamLeader',
  marketer: 'marketer', '业务员': 'marketer', '顾问': 'marketer', '家装顾问': 'marketer',
  designer: 'designer', '设计师': 'designer',
  pm: 'pm', '项目经理': 'pm',
  finance: 'finance', '财务': 'finance'
}
const roleKey = computed(() => {
  const value = String(props.role || '').trim()
  return ROLE_ALIAS[value] || ROLE_ALIAS[value.toLowerCase()] || 'marketer'
})
const roleMeta = computed(() => ROLE_META[roleKey.value])
const roleColor = computed(() => roleMeta.value?.color || TOKEN_COLOR.primary)
/** 装企员工默认头像统一使用企业主题色；岗位色只保留在右下角状态点。 */
const avatarColor = computed(() => TOKEN_COLOR.primary)
const unit = computed(() => `${props.size}rpx`)
const avatarSize = computed(() => Math.max(20, props.size - 8))
const dotSize = computed(() => props.size <= 44 ? 14 : 18)
const dotColor = computed(() => {
  if (props.status === 'suspended') return TOKEN_COLOR.warning
  if (props.status === 'resigned') return TOKEN_COLOR.text4
  return roleColor.value
})
</script>

<template>
  <view
    class="jz-employee-avatar"
    :class="{ 'jz-employee-avatar--inactive': status === 'suspended' || status === 'resigned' }"
    :style="{ width: unit, height: unit }"
  >
    <JzAvatar :src="src" :name="name" :color="avatarColor" :size="avatarSize" />
    <view v-if="showRole" class="jz-employee-avatar__role" :style="{ width: `${dotSize}rpx`, height: `${dotSize}rpx`, backgroundColor: dotColor }" />
  </view>
</template>

<style lang="scss" scoped>
.jz-employee-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;
  padding: 4rpx;
  background: $jzb-bg-card;
  border-radius: 50%;
  box-shadow: 0 4rpx 14rpx var(--jzb-primary-a14, rgba(14, 138, 125, .14));
}
.jz-employee-avatar--inactive { opacity: .72; }
.jz-employee-avatar__role {
  position: absolute;
  right: 0;
  bottom: 0;
  box-sizing: border-box;
  border: 3rpx solid $jzb-bg-card;
  border-radius: 50%;
}
</style>
