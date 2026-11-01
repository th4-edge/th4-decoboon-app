<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { payrollApi } from '@/domains/payroll/api'
import { consumePayrollEmployeePickerResult } from '@/domains/payroll/employee-picker'
import type { Employee } from '@/domains/identity/model'
import { isLoggedIn } from '@/domains/identity/session'
import { toast, toastError } from '@/composables/toast'
import JzEmployeeSelectField from '@/components/JzEmployeeSelectField/JzEmployeeSelectField.vue'
import JzNumberInput from '@/components/JzNumberInput/JzNumberInput.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

const summaryId = ref('')
const selectedEmployee = ref<Employee | null>(null)
const scheduledDays = ref('')
const schemeLoading = ref(false)
const schemeError = ref('')
let schemeRequest = 0
const form = reactive({ month: localMonth(), normalDays: '0', personalLeaveDays: '0', sickLeaveDays: '0', absenceDays: '0', externalDays: '0', annualLeaveDays: '0', compLeaveDays: '0', remark: '' })
const saving = ref(false)
function localMonth(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }
function monthParam(value: unknown): string { const month = String(value || ''); return /^\d{4}-\d{2}$/.test(month) ? month : '' }
function numberFields() { return { normalDays:Number(form.normalDays),personalLeaveDays:Number(form.personalLeaveDays),sickLeaveDays:Number(form.sickLeaveDays),absenceDays:Number(form.absenceDays),externalDays:Number(form.externalDays),annualLeaveDays:Number(form.annualLeaveDays),compLeaveDays:Number(form.compLeaveDays) } }

onLoad(async (query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  const queryMonth = monthParam(query?.month)
  if (queryMonth) form.month = queryMonth
  summaryId.value = query?.summaryId || ''
  if (summaryId.value) {
    const item = await payrollApi.attendanceInfo(summaryId.value)
    selectedEmployee.value = item.employee
    scheduledDays.value = String(item.scheduledDays)
    form.month = item.payrollMonth || form.month
    Object.assign(form, { normalDays:String(item.normalDays), personalLeaveDays:String(item.personalLeaveDays), sickLeaveDays:String(item.sickLeaveDays), absenceDays:String(item.absenceDays), externalDays:String(item.externalDays), annualLeaveDays:String(item.annualLeaveDays), compLeaveDays:String(item.compLeaveDays), remark:item.remark || '' })
  } else {
    void loadEffectiveScheme()
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
  if (summaryId.value) return
  const params: string[] = []
  if (selectedEmployee.value?.id) {
    params.push(`selectedId=${encodeURIComponent(selectedEmployee.value.id)}`)
    params.push(`selectedName=${encodeURIComponent(selectedEmployee.value.name)}`)
  }
  uni.navigateTo({ url: `${P.payrollEmployeePicker}${params.length ? `?${params.join('&')}` : ''}` })
}

function clearEmployee() {
  if (!summaryId.value) {
    selectedEmployee.value = null
    scheduledDays.value = ''
    schemeError.value = ''
    schemeRequest += 1
    schemeLoading.value = false
  }
}

async function loadEffectiveScheme() {
  const empId = selectedEmployee.value?.id
  if (summaryId.value || !empId || !form.month) {
    scheduledDays.value = ''
    schemeError.value = ''
    return
  }
  const version = ++schemeRequest
  schemeLoading.value = true
  schemeError.value = ''
  try {
    const scheme = await payrollApi.compensationForMonth(empId, form.month)
    if (version !== schemeRequest) return
    scheduledDays.value = String(scheme.scheduledDays)
  } catch {
    if (version === schemeRequest) {
      scheduledDays.value = ''
      schemeError.value = '该工资月份没有生效薪酬方案，请先配置对应薪酬方案'
    }
  } finally {
    if (version === schemeRequest) schemeLoading.value = false
  }
}

watch([() => selectedEmployee.value?.id, () => form.month], () => {
  if (!summaryId.value) void loadEffectiveScheme()
})

async function submit() {
  const employee = selectedEmployee.value
  if (!employee || !form.month || saving.value) { toast('请选择员工和工资月份'); return }
  if (!summaryId.value && schemeError.value) { toast(schemeError.value); return }
  if (schemeLoading.value) { toast('正在读取当月薪酬方案，请稍候'); return }
  const scheduledDaysValue = Number(scheduledDays.value)
  if (!Number.isInteger(scheduledDaysValue) || scheduledDaysValue < 1 || scheduledDaysValue > 31) {
    toast('月应出勤天数必须为 1 至 31 天的整数')
    return
  }
  saving.value = true
  try {
    if (summaryId.value) await payrollApi.updateAttendance({ summaryId:summaryId.value, scheduledDays:scheduledDaysValue, ...numberFields(), remark:form.remark })
    else await payrollApi.saveAttendance({ empId:employee.id, month:form.month, scheduledDays:scheduledDaysValue, ...numberFields(), remark:form.remark })
    toast('考勤已保存', 'success'); setTimeout(() => uni.navigateBack(), 500)
  } catch (error) { toastError(error, '考勤保存失败') }
  finally { saving.value = false }
}
</script>

<template>
  <view class="pay-page">
    <JzPageHeader :title="summaryId ? '编辑月度考勤' : '录入月度考勤'" subtitle="应出勤天数由员工薪酬方案带出，异常考勤确认后进入工资单" />
    <view class="pay-body">
      <JzEmployeeSelectField
        :employee="selectedEmployee"
        :disabled="!!summaryId"
        label="考勤员工"
        placeholder="请选择员工"
        @select="chooseEmployee"
        @clear="clearEmployee"
      />

      <label class="pay-label">工资月份</label>
      <JzSelectField mode="date" fields="month" variant="boxed" :value="form.month" :disabled="!!summaryId" :display="form.month" placeholder="选择月份" @change="form.month = $event" />

      <view class="pay-scheme-days">
        <view class="pay-scheme-days__main">
          <text class="pay-scheme-days__label">应出勤天数</text>
          <JzNumberInput
            v-model="scheduledDays"
            class="pay-scheme-days__input"
            :precision="0"
            :min="1"
            :max="31"
            :disabled="schemeLoading || (!summaryId && Boolean(schemeError))"
            placeholder="按当月方案带出，可调整"
            suffix="天"
          />
        </view>
        <text class="pay-scheme-days__tip">{{ summaryId ? '保存后以本考勤单的快照为准；已进入工资单后不可修改' : '默认按所选工资月份匹配生效薪酬方案，可结合当月实际调整；保存后写入考勤快照' }}</text>
        <text v-if="schemeError && !summaryId" class="pay-scheme-days__error">{{ schemeError }}</text>
      </view>

      <view class="pay-grid">
        <view><label class="pay-label">正常出勤</label><JzNumberInput v-model="form.normalDays" :precision="0" :min="0" :max="31" suffix="天" compact /></view>
        <view><label class="pay-label">事假</label><JzNumberInput v-model="form.personalLeaveDays" :precision="0" :min="0" :max="31" suffix="天" compact /></view>
        <view><label class="pay-label">病假</label><JzNumberInput v-model="form.sickLeaveDays" :precision="0" :min="0" :max="31" suffix="天" compact /></view>
        <view><label class="pay-label">旷工</label><JzNumberInput v-model="form.absenceDays" :precision="0" :min="0" :max="31" suffix="天" compact /></view>
        <view><label class="pay-label">外勤</label><JzNumberInput v-model="form.externalDays" :precision="0" :min="0" :max="31" suffix="天" compact /></view>
        <view><label class="pay-label">年假</label><JzNumberInput v-model="form.annualLeaveDays" :precision="0" :min="0" :max="31" suffix="天" compact /></view>
        <view><label class="pay-label">调休</label><JzNumberInput v-model="form.compLeaveDays" :precision="0" :min="0" :max="31" suffix="天" compact /></view>
      </view>

      <label class="pay-label">备注</label><textarea v-model="form.remark" class="pay-textarea" maxlength="300" placeholder="可选" />
      <button class="jz-btn jz-btn--primary jz-btn--block" :loading="saving" @tap="submit">保存考勤</button>
    </view>
  </view>
</template>
<style lang="scss" scoped>
.pay-page { min-height: 100vh; background: $jzb-bg-page; }
.pay-body { padding: 24rpx $jzb-page-pad 48rpx; }
.pay-label { display: block; margin: 20rpx 0 10rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.pay-input,
.pay-textarea { box-sizing: border-box; width: 100%; padding: 22rpx; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-md; background: $jzb-bg-card; color: $jzb-text-1; }
.pay-textarea { min-height: 150rpx; }
.pay-scheme-days { margin-top: 24rpx; padding: 24rpx; border: 1rpx solid var(--jzb-primary-a20, rgba(22, 163, 148, .2)); border-radius: $jzb-radius-md; background: $jzb-primary-lightest; }
.pay-scheme-days__main { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; }
.pay-scheme-days__label { color: $jzb-text-2; font-size: $jzb-font-sm; }
.pay-scheme-days__input { flex: 1; max-width: 260rpx; }
.pay-scheme-days__tip { display: block; margin-top: 10rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.55; }
.pay-scheme-days__error { display: block; margin-top: 10rpx; color: $jzb-danger; font-size: $jzb-font-xs; line-height: 1.55; }
.pay-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18rpx; }
.pay-grid view { min-width: 0; }
.jz-btn { margin-top: 36rpx; }
</style>
