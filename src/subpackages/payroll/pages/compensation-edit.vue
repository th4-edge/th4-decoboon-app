<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { payrollApi } from '@/domains/payroll/api'
import { consumePayrollEmployeePickerResult } from '@/domains/payroll/employee-picker'
import type { Employee } from '@/domains/identity/model'
import { isLoggedIn } from '@/domains/identity/session'
import { toast, toastError } from '@/composables/toast'
import JzEmployeeSelectField from '@/components/JzEmployeeSelectField/JzEmployeeSelectField.vue'
import JzMoneyInput from '@/components/JzMoneyInput/JzMoneyInput.vue'
import JzNumberInput from '@/components/JzNumberInput/JzNumberInput.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

const schemeId = ref('')
const successorId = ref('')
const selectedEmployee = ref<Employee | null>(null)
const form = reactive({ baseSalary: '', scheduledDays: '', effectiveFrom: localDate(), effectiveTo: '', remark: '' })
const saving = ref(false)
const currentDate = () => localDate()
const pageTitle = computed(() => schemeId.value ? '编辑薪酬方案' : successorId.value ? '新增后续薪酬方案' : '新增薪酬方案')
function localDate(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }

function suggestedSuccessorDate(item: { effectiveFrom: string; effectiveTo?: string }): string {
  const today = localDate()
  const base = item.effectiveTo || item.effectiveFrom
  const [year, month, day] = base.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + 1)
  const candidate = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
  return candidate > today ? candidate : today
}

onLoad(async (query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  schemeId.value = query?.schemeId || ''
  successorId.value = query?.successorId || ''
  if (schemeId.value || successorId.value) {
    const item = await payrollApi.compensationInfo(schemeId.value || successorId.value)
    selectedEmployee.value = item.employee
    form.baseSalary = item.baseSalary.toFixed(2)
    form.scheduledDays = String(item.scheduledDays || '')
    form.effectiveFrom = schemeId.value ? item.effectiveFrom : suggestedSuccessorDate(item)
    form.effectiveTo = schemeId.value ? item.effectiveTo || '' : ''
    form.remark = schemeId.value ? item.remark || '' : ''
  }
})

onShow(() => {
  if (!isLoggedIn()) return
  const result = consumePayrollEmployeePickerResult()
  if (!result) return
  if (result.action === 'clear') selectedEmployee.value = null
  else selectedEmployee.value = result.value
})

function chooseEmployee() {
  if (schemeId.value) return
  const params: string[] = []
  if (selectedEmployee.value?.id) {
    params.push(`selectedId=${encodeURIComponent(selectedEmployee.value.id)}`)
    params.push(`selectedName=${encodeURIComponent(selectedEmployee.value.name)}`)
  }
  uni.navigateTo({ url: `${P.payrollEmployeePicker}${params.length ? `?${params.join('&')}` : ''}` })
}

function clearEmployee() {
  if (!schemeId.value) selectedEmployee.value = null
}

async function submit() {
  const employee = selectedEmployee.value
  const scheduledDays = Number(form.scheduledDays)
  if (!employee || !form.baseSalary || !Number.isInteger(scheduledDays) || scheduledDays < 1 || scheduledDays > 31 || !form.effectiveFrom || saving.value) {
    toast('请选择员工，并填写固定工资、1 至 31 天的月应出勤天数和生效日期')
    return
  }
  saving.value = true
  try {
    if (schemeId.value) {
      await payrollApi.updateCompensation({ schemeId: schemeId.value, baseSalary: Number(form.baseSalary), scheduledDays, effectiveFrom: form.effectiveFrom, effectiveTo: form.effectiveTo || undefined, remark: form.remark })
    } else {
      await payrollApi.saveCompensation({ empId: employee.id, baseSalary: Number(form.baseSalary), scheduledDays, effectiveFrom: form.effectiveFrom, effectiveTo: form.effectiveTo || undefined, remark: form.remark })
    }
    toast('薪酬方案已保存', 'success')
    setTimeout(() => uni.navigateBack(), 500)
  } catch (error) { toastError(error, '薪酬方案保存失败') }
  finally { saving.value = false }
}
</script>

<template>
  <view class="pay-page">
    <JzPageHeader :title="pageTitle" subtitle="固定工资按自然月生效，应出勤天数由本方案统一配置" />
    <view class="pay-body">
      <view v-if="successorId" class="pay-successor-tip">原方案和既有工资事实保持不变；请确认新的生效日期，系统按最新生效日期匹配后续工资月份。</view>
      <JzEmployeeSelectField
        :employee="selectedEmployee"
        :disabled="!!schemeId || !!successorId"
        label="发薪员工"
        placeholder="请选择员工"
        @select="chooseEmployee"
        @clear="clearEmployee"
      />

      <label class="pay-label">月固定工资</label>
      <JzMoneyInput v-model="form.baseSalary" placeholder="请输入月固定工资" />

      <label class="pay-label">月应出勤天数</label>
      <JzNumberInput v-model="form.scheduledDays" :precision="0" :min="1" :max="31" suffix="天" placeholder="按企业实际考勤制度填写" />
      <text class="pay-field-tip">考勤录入时，应出勤天数将按本方案读取，不再默认 22 天。</text>

      <label class="pay-label">生效日期</label>
      <JzSelectField mode="date" variant="boxed" :value="form.effectiveFrom" :display="form.effectiveFrom" placeholder="选择生效日期" @change="form.effectiveFrom = $event" />

      <label class="pay-label">失效日期（可空）</label>
      <JzSelectField mode="date" variant="boxed" :value="form.effectiveTo || currentDate()" :display="form.effectiveTo" placeholder="长期有效" @change="form.effectiveTo = $event" />

      <label class="pay-label">备注</label>
      <textarea v-model="form.remark" class="pay-textarea" maxlength="300" placeholder="可选" />

      <button class="jz-btn jz-btn--primary jz-btn--block" :loading="saving" @tap="submit">保存薪酬方案</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.pay-page { min-height: 100vh; background: $jzb-bg-page; }
.pay-body { padding: 24rpx $jzb-page-pad 48rpx; }
.pay-label { display: block; margin: 24rpx 0 10rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.pay-input,
.pay-textarea { box-sizing: border-box; width: 100%; padding: 24rpx; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-md; background: $jzb-bg-card; color: $jzb-text-1; }
.pay-textarea { min-height: 160rpx; }
.pay-successor-tip { margin-bottom: 20rpx; padding: 20rpx; border-radius: $jzb-radius-md; background: $jzb-primary-lightest; color: $jzb-text-2; font-size: $jzb-font-sm; line-height: 1.6; }
.pay-field-tip { display: block; margin-top: 10rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.55; }
.jz-btn { margin-top: 36rpx; }
</style>
