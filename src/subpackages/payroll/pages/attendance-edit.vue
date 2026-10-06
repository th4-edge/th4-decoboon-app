<script setup lang="ts">
import { reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { payrollApi } from '@/domains/payroll/api'
import type { Employee } from '@/domains/identity/model'
import { isLoggedIn } from '@/domains/identity/session'
import { toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'

const summaryId = ref('')
const employees = ref<Employee[]>([])
const selectedIndex = ref(0)
const form = reactive({ month: localMonth(), scheduledDays: '22', normalDays: '22', personalLeaveDays: '0', sickLeaveDays: '0', absenceDays: '0', externalDays: '0', annualLeaveDays: '0', compLeaveDays: '0', remark: '' })
const saving = ref(false)
function localMonth(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }
function numberFields() { return { scheduledDays:Number(form.scheduledDays),normalDays:Number(form.normalDays),personalLeaveDays:Number(form.personalLeaveDays),sickLeaveDays:Number(form.sickLeaveDays),absenceDays:Number(form.absenceDays),externalDays:Number(form.externalDays),annualLeaveDays:Number(form.annualLeaveDays),compLeaveDays:Number(form.compLeaveDays) } }

onLoad(async (query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  summaryId.value = query?.summaryId || ''
  employees.value = await payrollApi.employeePage()
  if (summaryId.value) {
    const item = await payrollApi.attendanceInfo(summaryId.value)
    selectedIndex.value = Math.max(0, employees.value.findIndex((e) => e.id === item.employee.id))
    form.month = item.payrollMonth
    Object.assign(form, { scheduledDays:String(item.scheduledDays), normalDays:String(item.normalDays), personalLeaveDays:String(item.personalLeaveDays), sickLeaveDays:String(item.sickLeaveDays), absenceDays:String(item.absenceDays), externalDays:String(item.externalDays), annualLeaveDays:String(item.annualLeaveDays), compLeaveDays:String(item.compLeaveDays), remark:item.remark || '' })
  }
})
async function submit() {
  const employee = employees.value[selectedIndex.value]
  if (!employee || !form.month || saving.value) { toast('请选择员工和工资月份'); return }
  saving.value = true
  try {
    if (summaryId.value) await payrollApi.updateAttendance({ summaryId:summaryId.value, ...numberFields(), remark:form.remark })
    else await payrollApi.saveAttendance({ empId:employee.id, month:form.month, ...numberFields(), remark:form.remark })
    toast('考勤已保存', 'success'); setTimeout(() => uni.navigateBack(), 500)
  } catch (error) { toastError(error, '考勤保存失败') }
  finally { saving.value = false }
}
</script>

<template>
  <view class="pay-page"><JzPageHeader :title="summaryId ? '编辑月度考勤' : '录入月度考勤'" subtitle="异常考勤确认后进入工资单" />
    <view class="pay-body">
      <label class="pay-label">员工</label><picker :disabled="!!summaryId" :range="employees.map((item) => item.name)" @change="selectedIndex = Number($event.detail.value)"><view class="pay-input">{{ employees[selectedIndex]?.name || '请选择员工' }}</view></picker>
      <label class="pay-label">工资月份</label><picker mode="date" fields="month" :value="form.month" :disabled="!!summaryId" @change="form.month = $event.detail.value"><view class="pay-input">{{ form.month }}</view></picker>
      <view class="pay-grid"><view><label class="pay-label">应出勤天数</label><input v-model="form.scheduledDays" class="pay-input" type="number" /></view><view><label class="pay-label">正常出勤</label><input v-model="form.normalDays" class="pay-input" type="number" /></view><view><label class="pay-label">事假</label><input v-model="form.personalLeaveDays" class="pay-input" type="number" /></view><view><label class="pay-label">病假</label><input v-model="form.sickLeaveDays" class="pay-input" type="number" /></view><view><label class="pay-label">旷工</label><input v-model="form.absenceDays" class="pay-input" type="number" /></view><view><label class="pay-label">外勤</label><input v-model="form.externalDays" class="pay-input" type="number" /></view><view><label class="pay-label">年假</label><input v-model="form.annualLeaveDays" class="pay-input" type="number" /></view><view><label class="pay-label">调休</label><input v-model="form.compLeaveDays" class="pay-input" type="number" /></view></view>
      <label class="pay-label">备注</label><textarea v-model="form.remark" class="pay-textarea" maxlength="300" placeholder="可选" />
      <button class="jz-btn jz-btn--primary jz-btn--block" :loading="saving" @tap="submit">保存考勤</button>
    </view>
  </view>
</template>
<style lang="scss" scoped>
.pay-page{min-height:100vh;background:$jzb-bg-page}.pay-body{padding:24rpx $jzb-page-pad 48rpx}.pay-label{display:block;margin:20rpx 0 10rpx;color:$jzb-text-2;font-size:26rpx}.pay-input,.pay-textarea{box-sizing:border-box;width:100%;padding:22rpx;border:1rpx solid $jzb-border-light;border-radius:16rpx;background:#fff}.pay-textarea{min-height:150rpx}.pay-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 20rpx}.jz-btn{margin-top:36rpx}
</style>
