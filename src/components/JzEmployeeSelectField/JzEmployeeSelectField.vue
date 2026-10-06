<script setup lang="ts">
import { computed } from 'vue'
import type { Employee } from '@/domains/identity/model'
import { ROLE_META } from '@/roles/catalog'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const props = withDefaults(defineProps<{
  employee?: Employee | null
  disabled?: boolean
  label?: string
  placeholder?: string
}>(), {
  employee: null,
  disabled: false,
  label: '员工',
  placeholder: '请选择员工'
})

const emit = defineEmits<{
  select: []
  clear: []
}>()

const roleLabel = computed(() => props.employee ? (ROLE_META[props.employee.role]?.label || '岗位待确认') : '')
const storeLabel = computed(() => props.employee?.store?.name || '未分配门店')
const teamLabel = computed(() => props.employee?.team?.name || '未分配团队')

function choose() {
  if (!props.disabled) emit('select')
}
</script>

<template>
  <view class="jz-employee-field" :class="{ 'jz-employee-field--disabled': disabled }" @tap="choose">
    <JzEmployeeAvatar
      v-if="employee"
      :src="employee.avatarUrl || ''"
      :name="employee.name"
      :role="employee.role"
      :status="employee.status"
      :size="72"
    />
    <view v-else class="jz-employee-field__placeholder">
      <JzIcon name="user" :size="34" :color="TOKEN_COLOR.text3" />
    </view>
    <view class="jz-employee-field__main">
      <text class="jz-employee-field__label">{{ label }}</text>
      <text class="jz-employee-field__name" :class="{ 'jz-employee-field__name--empty': !employee }">{{ employee?.name || placeholder }}</text>
      <text v-if="employee" class="jz-employee-field__meta">{{ roleLabel }} · {{ storeLabel }} · {{ teamLabel }}</text>
      <text v-else class="jz-employee-field__hint">按姓名、岗位、门店和状态定位</text>
    </view>
    <view v-if="employee && !disabled" class="jz-employee-field__clear" @tap.stop="emit('clear')">
      <JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" />
    </view>
    <JzIcon v-else-if="!disabled" name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
  </view>
</template>

<style lang="scss" scoped>
.jz-employee-field {
  box-sizing: border-box;
  width: 100%;
  min-height: 148rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx;
  border: 1rpx solid $jzb-border-light;
  border-radius: $jzb-radius-md;
  background: $jzb-bg-card;
  transition: border-color $jzb-duration-fast $jzb-ease-out, background $jzb-duration-fast $jzb-ease-out;
}
.jz-employee-field--disabled { background: $jzb-bg-hover; }
.jz-employee-field:active { border-color: rgba(22, 163, 148, .35); }
.jz-employee-field__placeholder {
  width: 72rpx;
  height: 72rpx;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: $jzb-bg-page;
}
.jz-employee-field__main { flex: 1; min-width: 0; }
.jz-employee-field__label { display: block; color: $jzb-text-3; font-size: $jzb-font-xs; }
.jz-employee-field__name { display: block; margin-top: 4rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.jz-employee-field__name--empty { color: $jzb-text-4; font-weight: 600; }
.jz-employee-field__meta,
.jz-employee-field__hint { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.jz-employee-field__hint { color: $jzb-text-4; }
.jz-employee-field__clear {
  width: 52rpx;
  height: 52rpx;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: $jzb-bg-page;
}
</style>
