<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { payrollApi } from '@/domains/payroll/api'
import { consumePayrollEmployeePickerResult } from '@/domains/payroll/employee-picker'
import { consumeFinanceProjectPickerResult, type FinanceProjectSelection } from '@/domains/finance/project-picker'
import type { Employee } from '@/domains/identity/model'
import { isLoggedIn } from '@/domains/identity/session'
import { toast, toastError } from '@/composables/toast'
import JzEmployeeSelectField from '@/components/JzEmployeeSelectField/JzEmployeeSelectField.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzMoneyInput from '@/components/JzMoneyInput/JzMoneyInput.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const selectedEmployee = ref<Employee | null>(null)
const selectedProject = ref<FinanceProjectSelection | null>(null)
const saving = ref(false)
const form = reactive({ contractAmount: '', manualRate: '2', commissionAmount: '', remark: '' })
const estimated = computed(() => (Number(form.contractAmount || 0) * Number(form.manualRate || 0) / 100).toFixed(2))

onLoad(() => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
})

onShow(() => {
  if (!isLoggedIn()) return
  const employeeResult = consumePayrollEmployeePickerResult()
  if (employeeResult?.action === 'select') selectedEmployee.value = employeeResult.value
  if (employeeResult?.action === 'clear') selectedEmployee.value = null

  const projectResult = consumeFinanceProjectPickerResult()
  if (projectResult?.action === 'select') selectedProject.value = projectResult.value
  if (projectResult?.action === 'clear') selectedProject.value = null
})

function chooseEmployee() {
  const params: string[] = []
  if (selectedEmployee.value?.id) params.push(`selectedId=${encodeURIComponent(selectedEmployee.value.id)}`)
  uni.navigateTo({ url: `${P.payrollEmployeePicker}${params.length ? `?${params.join('&')}` : ''}` })
}

function chooseProject() {
  const params: string[] = []
  if (selectedProject.value?.id) {
    params.push(`selectedId=${encodeURIComponent(selectedProject.value.id)}`)
    params.push(`selectedName=${encodeURIComponent(selectedProject.value.name)}`)
    if (selectedProject.value.no) params.push(`selectedNo=${encodeURIComponent(selectedProject.value.no)}`)
  }
  uni.navigateTo({ url: `${P.financeProjectPicker}${params.length ? `?${params.join('&')}` : ''}` })
}

async function submit() {
  if (!selectedEmployee.value || !selectedProject.value || !form.contractAmount || !form.manualRate || saving.value) {
    toast('请选择员工、项目并填写签约额和比例')
    return
  }
  saving.value = true
  try {
    await payrollApi.saveCommission({
      empId: selectedEmployee.value.id,
      projectId: selectedProject.value.id,
      contractAmount: Number(form.contractAmount),
      manualRate: Number(form.manualRate),
      commissionAmount: form.commissionAmount ? Number(form.commissionAmount) : undefined,
      remark: form.remark
    })
    toast('提成已计提', 'success')
    setTimeout(() => uni.navigateBack(), 500)
  } catch (error) { toastError(error, '提成计提失败') }
  finally { saving.value = false }
}
</script>

<template>
  <view class="pay-page">
    <JzPageHeader title="提成计提" subtitle="只按主合同签约额和手工比例计算" />
    <view class="pay-body">
      <JzEmployeeSelectField
        :employee="selectedEmployee"
        label="提成员工"
        placeholder="请选择员工"
        @select="chooseEmployee"
        @clear="selectedEmployee = null"
      />

      <label class="pay-label">归属项目</label>
      <view class="pay-project-card" :class="{ 'pay-project-card--empty': !selectedProject }" @tap="chooseProject">
        <view class="pay-project-card__icon"><JzIcon name="briefcase" :size="32" :color="selectedProject ? TOKEN_COLOR.primary : TOKEN_COLOR.text3" /></view>
        <view class="pay-project-card__main">
          <text class="pay-project-card__name">{{ selectedProject?.name || '请选择项目' }}</text>
          <text v-if="selectedProject" class="pay-project-card__meta">{{ [selectedProject.no, selectedProject.customerName].filter(Boolean).join(' · ') || '项目信息待完善' }}</text>
          <text v-else class="pay-project-card__hint">按项目状态、类型、设计师和常用项目定位</text>
        </view>
        <view v-if="selectedProject" class="pay-project-card__clear" @tap.stop="selectedProject = null"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text3" /></view>
        <JzIcon v-else name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
      </view>

      <label class="pay-label">主合同签约额</label>
      <JzMoneyInput v-model="form.contractAmount" placeholder="请输入主合同签约额" />

      <label class="pay-label">手工比例</label>
      <view class="pay-rate-field">
        <input v-model="form.manualRate" type="digit" placeholder="2.00" />
        <text>%</text>
      </view>

      <label class="pay-label">提成金额（留空自动计算）</label>
      <JzMoneyInput v-model="form.commissionAmount" :placeholder="estimated" />

      <view class="pay-preview"><text>预计提成</text><text>¥{{ form.commissionAmount || estimated }}</text></view>

      <label class="pay-label">备注</label>
      <textarea v-model="form.remark" class="pay-textarea" maxlength="300" placeholder="可选" />
      <button class="jz-btn jz-btn--primary jz-btn--block" :loading="saving" @tap="submit">确认计提提成</button>
    </view>
  </view>
</template>
<style lang="scss" scoped>
.pay-page { min-height: 100vh; background: $jzb-bg-page; }
.pay-body { padding: 24rpx $jzb-page-pad 48rpx; }
.pay-label { display: block; margin: 20rpx 0 10rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.pay-project-card { display: flex; align-items: center; gap: 18rpx; min-height: 136rpx; padding: 24rpx; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-md; background: $jzb-bg-card; }
.pay-project-card--empty { border-style: dashed; }
.pay-project-card__icon { width: 64rpx; height: 64rpx; flex: none; display: flex; align-items: center; justify-content: center; border-radius: $jzb-radius-sm; background: $jzb-bg-page; }
.pay-project-card__main { flex: 1; min-width: 0; }
.pay-project-card__name { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.pay-project-card__meta,
.pay-project-card__hint { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.pay-project-card__hint { color: $jzb-text-4; }
.pay-project-card__clear { width: 52rpx; height: 52rpx; flex: none; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: $jzb-bg-page; }
.pay-rate-field { box-sizing: border-box; min-height: $jzb-control-height; display: flex; align-items: center; gap: 12rpx; padding: 0 24rpx; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-md; background: $jzb-bg-card; }
.pay-rate-field input { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font-lg; text-align: right; }
.pay-rate-field text { flex: none; color: $jzb-text-3; font-size: $jzb-font-sm; }
.pay-textarea { box-sizing: border-box; width: 100%; min-height: 150rpx; padding: 22rpx; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-md; background: $jzb-bg-card; }
.pay-preview { display: flex; justify-content: space-between; margin-top: 24rpx; padding: 24rpx; border-radius: $jzb-radius-md; background: $jzb-primary-lightest; color: $jzb-primary; font-weight: 700; }
.jz-btn { margin-top: 36rpx; }
</style>
