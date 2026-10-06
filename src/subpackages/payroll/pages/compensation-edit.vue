<script setup lang="ts">
import { reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { payrollApi } from '@/domains/payroll/api'
import type { Employee } from '@/domains/identity/model'
import { isLoggedIn } from '@/domains/identity/session'
import { toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'

const schemeId = ref('')
const employees = ref<Employee[]>([])
const selectedIndex = ref(0)
const form = reactive({ baseSalary: '', effectiveFrom: localDate(), effectiveTo: '', remark: '' })
const saving = ref(false)
const currentDate = () => localDate()
function localDate(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }

onLoad(async (query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  schemeId.value = query?.schemeId || ''
  employees.value = await payrollApi.employeePage()
  if (schemeId.value) {
    const item = await payrollApi.compensationInfo(schemeId.value)
    selectedIndex.value = Math.max(0, employees.value.findIndex((e) => e.id === item.employee.id))
    form.baseSalary = String(item.baseSalary)
    form.effectiveFrom = item.effectiveFrom
    form.effectiveTo = item.effectiveTo || ''
    form.remark = item.remark || ''
  }
})

async function submit() {
  const employee = employees.value[selectedIndex.value]
  if (!employee || !form.baseSalary || !form.effectiveFrom || saving.value) { toast('请选择员工并填写固定工资和生效日期'); return }
  saving.value = true
  try {
    if (schemeId.value) {
      await payrollApi.updateCompensation({ schemeId: schemeId.value, baseSalary: Number(form.baseSalary), effectiveFrom: form.effectiveFrom, effectiveTo: form.effectiveTo || undefined, remark: form.remark })
    } else {
      await payrollApi.saveCompensation({ empId: employee.id, baseSalary: Number(form.baseSalary), effectiveFrom: form.effectiveFrom, effectiveTo: form.effectiveTo || undefined, remark: form.remark })
    }
    toast('薪酬方案已保存', 'success')
    setTimeout(() => uni.navigateBack(), 500)
  } catch (error) { toastError(error, '薪酬方案保存失败') }
  finally { saving.value = false }
}
</script>

<template>
  <view class="pay-page"><JzPageHeader :title="schemeId ? '编辑薪酬方案' : '新增薪酬方案'" subtitle="固定工资按自然月生效" />
    <view class="pay-body">
      <label class="pay-label">员工</label>
      <picker :disabled="!!schemeId" :range="employees.map((item) => `${item.name} · ${item.title || item.role}`)" @change="selectedIndex = Number($event.detail.value)"><view class="pay-input">{{ employees[selectedIndex] ? `${employees[selectedIndex].name} · ${employees[selectedIndex].title || employees[selectedIndex].role}` : '请选择员工' }}</view></picker>
      <label class="pay-label">月固定工资</label><input v-model="form.baseSalary" class="pay-input" type="digit" placeholder="0.00" />
      <label class="pay-label">生效日期</label><picker mode="date" :value="form.effectiveFrom" @change="form.effectiveFrom = $event.detail.value"><view class="pay-input">{{ form.effectiveFrom }}</view></picker>
      <label class="pay-label">失效日期（可空）</label><picker mode="date" :value="form.effectiveTo || currentDate()" @change="form.effectiveTo = $event.detail.value"><view class="pay-input">{{ form.effectiveTo || '长期有效' }}</view></picker>
      <label class="pay-label">备注</label><textarea v-model="form.remark" class="pay-textarea" maxlength="300" placeholder="可选" />
      <button class="jz-btn jz-btn--primary jz-btn--block" :loading="saving" @tap="submit">保存薪酬方案</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.pay-page { min-height:100vh; background:$jzb-bg-page; }.pay-body { padding:24rpx $jzb-page-pad 48rpx; }.pay-label { display:block; margin:24rpx 0 10rpx; color:$jzb-text-2; font-size:26rpx; }.pay-input,.pay-textarea { box-sizing:border-box; width:100%; padding:24rpx; border:1rpx solid $jzb-border-light; border-radius:16rpx; background:#fff; color:$jzb-text-1; }.pay-textarea { min-height:160rpx; }.jz-btn { margin-top:36rpx; }
</style>
