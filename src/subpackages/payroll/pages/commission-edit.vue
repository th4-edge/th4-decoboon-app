<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { payrollApi } from '@/domains/payroll/api'
import { financeApi } from '@/domains/finance/api'
import type { Employee } from '@/domains/identity/model'
import type { Project } from '@/domains/project/model'
import { isLoggedIn } from '@/domains/identity/session'
import { toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'

const employees = ref<Employee[]>([])
const projects = ref<Project[]>([])
const employeeIndex = ref(0)
const projectIndex = ref(0)
const saving = ref(false)
const form = reactive({ contractAmount: '', manualRate: '2', commissionAmount: '', remark: '' })
const estimated = computed(() => (Number(form.contractAmount || 0) * Number(form.manualRate || 0) / 100).toFixed(2))
onLoad(async () => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  const [employeeList, projectPage] = await Promise.all([payrollApi.employeePage(), financeApi.projectPage({ size: 200 })])
  employees.value = employeeList
  projects.value = projectPage.map((item) => item.project)
})
async function submit() {
  const employee = employees.value[employeeIndex.value]
  const project = projects.value[projectIndex.value]
  if (!employee || !project || !form.contractAmount || !form.manualRate || saving.value) { toast('请选择员工、项目并填写签约额和比例'); return }
  saving.value = true
  try {
    await payrollApi.saveCommission({ empId: employee.id, projectId: project.id, contractAmount: Number(form.contractAmount), manualRate: Number(form.manualRate), commissionAmount: form.commissionAmount ? Number(form.commissionAmount) : undefined, remark: form.remark })
    toast('提成已计提', 'success'); setTimeout(() => uni.navigateBack(), 500)
  } catch (error) { toastError(error, '提成计提失败') }
  finally { saving.value = false }
}
</script>

<template>
  <view class="pay-page"><JzPageHeader title="提成计提" subtitle="只按主合同签约额和手工比例计算" />
    <view class="pay-body">
      <label class="pay-label">员工</label><picker :range="employees.map((item) => item.name)" @change="employeeIndex = Number($event.detail.value)"><view class="pay-input">{{ employees[employeeIndex]?.name || '请选择员工' }}</view></picker>
      <label class="pay-label">项目</label><picker :range="projects.map((item) => item.name)" @change="projectIndex = Number($event.detail.value)"><view class="pay-input">{{ projects[projectIndex]?.name || '请选择项目' }}</view></picker>
      <label class="pay-label">主合同签约额</label><input v-model="form.contractAmount" class="pay-input" type="digit" placeholder="0.00" />
      <label class="pay-label">手工比例（%）</label><input v-model="form.manualRate" class="pay-input" type="digit" placeholder="2.00" />
      <label class="pay-label">提成金额（留空自动计算）</label><input v-model="form.commissionAmount" class="pay-input" type="digit" :placeholder="estimated" />
      <view class="pay-preview"><text>预计提成</text><text>¥{{ form.commissionAmount || estimated }}</text></view>
      <label class="pay-label">备注</label><textarea v-model="form.remark" class="pay-textarea" maxlength="300" placeholder="可选" />
      <button class="jz-btn jz-btn--primary jz-btn--block" :loading="saving" @tap="submit">确认计提提成</button>
    </view>
  </view>
</template>
<style lang="scss" scoped>
.pay-page{min-height:100vh;background:$jzb-bg-page}.pay-body{padding:24rpx $jzb-page-pad 48rpx}.pay-label{display:block;margin:20rpx 0 10rpx;color:$jzb-text-2;font-size:26rpx}.pay-input,.pay-textarea{box-sizing:border-box;width:100%;padding:22rpx;border:1rpx solid $jzb-border-light;border-radius:16rpx;background:#fff}.pay-textarea{min-height:150rpx}.pay-preview{display:flex;justify-content:space-between;margin-top:24rpx;padding:24rpx;border-radius:16rpx;background:$jzb-primary-lightest;color:$jzb-primary;font-weight:700}.jz-btn{margin-top:36rpx}
</style>
