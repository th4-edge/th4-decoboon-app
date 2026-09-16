<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { identityApi } from '@/domains/identity/api'
import type { Employee } from '@/domains/identity/model'
import { session } from '@/domains/identity/session'
import { ROLE_META } from '@/roles/catalog'
import { toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'

const fromEmpId = ref('')
const from = ref<Employee | null>(null)
const candidates = ref<Employee[]>([])
const toEmpId = ref('')
const transferProjects = ref(false)
const handover = ref<Record<string, any> | null>(null)
const submitting = ref(false)
const isBoss = computed(() => session.role === 'boss')
const selectedIndex = computed(() => candidates.value.findIndex(item => item.id === toEmpId.value))
const items = [
  { key: 'customerCount', label: '客户' }, { key: 'propertyCount', label: '房屋' },
  { key: 'quoteCount', label: '报价' }, { key: 'projectCount', label: '项目' },
  { key: 'taskCount', label: '任务' }, { key: 'receivableCount', label: '应收' }
]

onLoad(async (query) => {
  fromEmpId.value = query?.empId || ''
  if (!fromEmpId.value) { toast('员工参数缺失'); return }
  try {
    const [employee, page, summary] = await Promise.all([
      identityApi.memberInfo(fromEmpId.value),
      identityApi.memberPage({ status: 'Active', current: 1, size: 200 }),
      identityApi.memberHandover(fromEmpId.value)
    ])
    from.value = employee
    candidates.value = page.list.filter(item => item.id !== fromEmpId.value)
    handover.value = summary
  } catch (error) { toastError(error, '交接数据加载失败') }
})

function pick(event: { detail: { value: string } }) {
  toEmpId.value = candidates.value[Number(event.detail.value)]?.id || ''
}

async function submit() {
  if (!toEmpId.value) { toast('请选择接收人'); return }
  submitting.value = true
  try {
    await identityApi.transferMember(fromEmpId.value, toEmpId.value, transferProjects.value)
    toast('交接完成', 'success')
    uni.navigateBack()
  } catch (error) { toastError(error, '交接受理失败') }
  finally { submitting.value = false }
}
</script>

<template>
  <view class="hand-page">
    <JzPageHeader title="离职交接" subtitle="客户、房屋、项目与任务的归属转移" />
    <view class="hand-body">
      <view class="jz-card hand-person">
        <JzIcon name="user" :size="44" color="#E67E22" />
        <view><text class="hand-name">{{ from?.name || '待离职员工' }}</text><text class="hand-role">{{ from?.role ? ROLE_META[from.role]?.label : '' }}</text></view>
      </view>
      <view class="jz-section"><text class="jz-section__title">待交接业务</text></view>
      <view class="jz-card hand-grid">
        <view v-for="item in items" :key="item.key"><text>{{ handover?.[item.key] || 0 }}</text><text>{{ item.label }}</text></view>
      </view>
      <view class="jz-card hand-form">
        <view class="hand-field">
          <text>接收人</text>
          <picker :range="candidates.map(item => `${item.name}（${ROLE_META[item.role]?.short || item.role}）`)" :value="selectedIndex" @change="pick">
            <view class="hand-picker">{{ toEmpId ? candidates[selectedIndex]?.name : '请选择在职员工' }}</view>
          </picker>
        </view>
        <label v-if="isBoss" class="hand-check"><checkbox :checked="transferProjects" @tap="transferProjects = !transferProjects" /><text>同步转移客户、房屋及项目负责人</text></label>
      </view>
      <button class="jz-btn jz-btn--primary jz-btn--block" :loading="submitting" @tap="submit">确认交接</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.hand-page { min-height: 100vh; background: $jzb-bg-page; }
.hand-body { padding: 28rpx; }
.hand-person { display: flex; align-items: center; gap: 20rpx; padding: 28rpx; }
.hand-name { display: block; color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 700; }
.hand-role { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.hand-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24rpx; padding: 28rpx; text-align: center; }
.hand-grid text:first-child { display: block; color: $jzb-text-1; font-size: 42rpx; font-weight: 750; }
.hand-grid text:last-child { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.hand-form { margin-top: 24rpx; padding: 28rpx; }
.hand-field { display: flex; align-items: center; min-height: 90rpx; }
.hand-field > text { width: 130rpx; color: $jzb-text-2; }
.hand-field picker { flex: 1; }
.hand-picker { color: $jzb-text-1; text-align: right; }
.hand-check { display: flex; gap: 12rpx; margin-top: 22rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.hand-body > button { margin-top: 30rpx; }
</style>
