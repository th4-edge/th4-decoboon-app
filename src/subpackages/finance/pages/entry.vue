<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { projectApi } from '@/domains/project/api'
import type { Project } from '@/domains/project/model'
import { financeApi } from '@/domains/finance/api'
import type {
  FundAccount, LedgerDirection, Payable, PayableType, Receivable
} from '@/domains/finance/model'
import { ACCOUNT_LABEL, PAYABLE_TYPE_META } from '@/domains/finance/meta'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

type EntryType = 'receivable' | 'receipt' | 'payable' | 'payment' | 'ledger'
const today = () => new Date().toISOString().slice(0, 10)
const type = ref<EntryType>('receivable')
const editId = ref('')
const projects = ref<Project[]>([])
const receivables = ref<Receivable[]>([])
const payables = ref<Payable[]>([])
const submitting = ref(false)

const form = reactive({
  projectId: '',
  receivableId: '',
  payableId: '',
  name: '',
  stageName: '',
  receivableType: 'first' as Receivable['type'],
  invoiceRequired: false,
  invoiceNo: '',
  amount: '',
  date: today(),
  account: 'companyBank' as FundAccount,
  payerName: '',
  payeeName: '',
  payableType: 'material' as PayableType,
  period: '',
  urgent: false,
  sourceNo: '',
  direction: 'income' as LedgerDirection,
  category: '',
  counterparty: '',
  summary: '',
  remark: ''
})

const title = computed(() => ({
  receivable: editId.value ? '编辑应收节点' : '新增应收节点',
  receipt: '登记客户收款',
  payable: editId.value ? '编辑应付单' : form.payableType === 'salary' ? '新增工人工资' : '新增应付成本',
  payment: '安排业务付款',
  ledger: '手工记账'
}[type.value]))
const subtitle = computed(() => ({
  receivable: '按合同节点安排首期款、进度款与尾款',
  receipt: '收款将自动核销应收并写入资金台账',
  payable: '材料款、项目款、工资与费用形成统一付款义务',
  payment: '付款将自动核销应付并形成项目成本',
  ledger: '企业通用或项目直接收支，生成不可变资金流水'
}[type.value]))
const projectOptions = computed(() => projects.value.map((item) => ({ label: `${item.name} · ${item.no}`, value: item.id })))
const projectIndex = computed(() => Math.max(projectOptions.value.findIndex((item) => item.value === form.projectId), 0))
const selectedProject = computed(() => projects.value.find((item) => item.id === form.projectId))
const receivableOptions = computed(() => receivables.value
  .filter((item) => item.outstandingAmount > 0)
  .map((item) => ({ label: `${item.name} · 待收¥${item.outstandingAmount}`, value: item.id })))
const receivableIndex = computed(() => Math.max(receivableOptions.value.findIndex((item) => item.value === form.receivableId), 0))
const payableOptions = computed(() => payables.value
  .filter((item) => item.outstandingAmount > 0)
  .map((item) => ({ label: `${item.name} · 待付¥${item.outstandingAmount}`, value: item.id })))
const payableIndex = computed(() => Math.max(payableOptions.value.findIndex((item) => item.value === form.payableId), 0))
const receivableTypeOptions = [
  { label: '首期款', value: 'first' }, { label: '进度款', value: 'progress' },
  { label: '尾款', value: 'final' }, { label: '质保金', value: 'retention' }, { label: '其他应收', value: 'other' }
]
const receivableTypeIndex = computed(() => Math.max(receivableTypeOptions.findIndex((item) => item.value === form.receivableType), 0))
const payableTypeOptions = Object.entries(PAYABLE_TYPE_META).map(([value, meta]) => ({ label: meta.label, value }))
const payableTypeIndex = computed(() => Math.max(payableTypeOptions.findIndex((item) => item.value === form.payableType), 0))
const accountOptions = Object.entries(ACCOUNT_LABEL).map(([value, label]) => ({ label, value }))
const accountIndex = computed(() => Math.max(accountOptions.findIndex((item) => item.value === form.account), 0))
const directionOptions = [{ label: '收入', value: 'income' }, { label: '支出', value: 'expense' }]
const directionIndex = computed(() => Math.max(directionOptions.findIndex((item) => item.value === form.direction), 0))

const booting = ref(false)
const loadError = ref('')

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  if (!can(session.role, 'edit:finance')) { toast('当前账号仅可查看财务数据'); setTimeout(() => uni.navigateBack(), 600); return }
  type.value = (['receivable', 'receipt', 'payable', 'payment', 'ledger'].includes(query?.type) ? query?.type : 'receivable') as EntryType
  editId.value = query?.id || ''
  form.projectId = query?.projectId || ''
  form.receivableId = query?.receivableId || ''
  form.payableId = query?.payableId || ''
  if (query?.payableType && PAYABLE_TYPE_META[query.payableType as PayableType]) form.payableType = query.payableType as PayableType
  void boot()
})

async function boot() {
  booting.value = true
  loadError.value = ''
  try {
    projects.value = await projectApi.list()
    await hydrate(editId.value)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '表单数据加载失败'
    toastError(error, '表单数据加载失败')
  } finally {
    booting.value = false
  }
}

async function hydrate(id: string) {
  if (type.value === 'receivable') {
    const list = await financeApi.receivables()
    const item = id ? list.find((row) => row.id === id) : undefined
    if (item) {
      form.projectId = item.project.id; form.name = item.name; form.stageName = item.stageName || ''
      form.receivableType = item.type; form.amount = String(item.amount); form.date = item.dueDate
      form.invoiceRequired = item.invoiceRequired; form.invoiceNo = item.invoiceNo || ''; form.remark = item.remark || ''
    } else if (form.projectId) await loadReceivables()
  } else if (type.value === 'receipt') {
    if (form.projectId) await loadReceivables()
    const target = receivables.value.find((item) => item.id === form.receivableId)
    if (target) form.amount = String(target.outstandingAmount)
    form.date = today()
  } else if (type.value === 'payable') {
    const list = await financeApi.payables()
    const item = id ? list.find((row) => row.id === id) : undefined
    if (item) {
      form.projectId = item.project?.id || ''; form.name = item.name; form.payableType = item.type
      form.payeeName = item.payeeEmployee?.name || item.payeeName || ''; form.period = item.period || ''
      form.amount = String(item.amount); form.date = item.dueDate; form.urgent = item.urgent
      form.sourceNo = item.sourceNo || ''; form.remark = item.remark || ''
    }
  } else if (type.value === 'payment') {
    payables.value = await financeApi.payables()
    const target = payables.value.find((item) => item.id === form.payableId)
    if (target) {
      form.projectId = target.project?.id || ''; form.payeeName = target.payeeEmployee?.name || target.payeeName || ''
      form.amount = String(target.outstandingAmount)
    }
    form.date = today()
  } else {
    form.date = today()
  }
}

async function loadReceivables() {
  if (!form.projectId) { receivables.value = []; return }
  receivables.value = await financeApi.receivables({ projectId: form.projectId })
  if (!receivables.value.some((item) => item.id === form.receivableId)) form.receivableId = ''
}
function onProject(event: any) { form.projectId = projectOptions.value[Number(event.detail.value)]?.value || ''; form.receivableId = ''; form.payableId = ''; if (type.value === 'receipt') void loadReceivables() }
function onReceivable(event: any) { form.receivableId = receivableOptions.value[Number(event.detail.value)]?.value || ''; const target = receivables.value.find((item) => item.id === form.receivableId); if (target) form.amount = String(target.outstandingAmount) }
function onPayable(event: any) { form.payableId = payableOptions.value[Number(event.detail.value)]?.value || ''; const target = payables.value.find((item) => item.id === form.payableId); if (target) { form.payeeName = target.payeeEmployee?.name || target.payeeName || ''; form.amount = String(target.outstandingAmount) } }
function onReceivableType(event: any) { form.receivableType = receivableTypeOptions[Number(event.detail.value)]?.value as Receivable['type'] || 'other' }
function onPayableType(event: any) { form.payableType = payableTypeOptions[Number(event.detail.value)]?.value as PayableType || 'other' }
function onAccount(event: any) { form.account = accountOptions[Number(event.detail.value)]?.value as FundAccount || 'companyBank' }
function onDirection(event: any) { form.direction = directionOptions[Number(event.detail.value)]?.value as LedgerDirection || 'income' }
function onInvoiceSwitch(event: any) { form.invoiceRequired = !!event.detail.value }
function onUrgentSwitch(event: any) { form.urgent = !!event.detail.value }
function selectLabel(options: { label: string }[], index: number) { return options[index]?.label || '' }

async function submit() {
  const amount = Number(form.amount)
  if (!amount || amount <= 0) { toast('请输入正确金额'); return }
  if (['receivable', 'receipt'].includes(type.value) && !form.projectId) { toast('请选择项目'); return }
  if (type.value === 'receipt' && !form.receivableId) { toast('请选择应收节点'); return }
  if (type.value === 'payment' && !form.payableId) { toast('请选择应付单'); return }
  if (type.value === 'ledger' && (!form.category.trim() || !form.summary.trim())) { toast('请填写分类和摘要'); return }
  submitting.value = true; loading('保存中...')
  try {
    if (type.value === 'receivable') {
      if (editId.value) await financeApi.updateReceivable({ id: editId.value, name: form.name, stageName: form.stageName, type: form.receivableType, amount, dueDate: form.date, invoiceRequired: form.invoiceRequired, invoiceNo: form.invoiceNo, remark: form.remark })
      else await financeApi.saveReceivable({ projectId: form.projectId, name: form.name, stageName: form.stageName, type: form.receivableType, amount, dueDate: form.date, invoiceRequired: form.invoiceRequired, invoiceNo: form.invoiceNo, remark: form.remark })
    } else if (type.value === 'receipt') {
      await financeApi.createReceipt({ projectId: form.projectId, receivableId: form.receivableId, amount, account: form.account, receivedAt: form.date, payerName: form.payerName, remark: form.remark })
    } else if (type.value === 'payable') {
      if (editId.value) await financeApi.updatePayable({ id: editId.value, name: form.name, amount, dueDate: form.date, urgent: form.urgent, period: form.period, remark: form.remark })
      else await financeApi.savePayable({ projectId: form.projectId || undefined, name: form.name, type: form.payableType, payeeName: form.payeeName, period: form.period, amount, dueDate: form.date, urgent: form.urgent, sourceNo: form.sourceNo, remark: form.remark })
    } else if (type.value === 'payment') {
      await financeApi.createPayment({ payableId: form.payableId, amount, account: form.account, paidAt: form.date, payeeName: form.payeeName, remark: form.remark })
    } else {
      await financeApi.saveLedger({ projectId: form.projectId || undefined, direction: form.direction, category: form.category, amount, account: form.account, occurredAt: form.date, counterparty: form.counterparty, summary: form.summary, remark: form.remark })
    }
    hideLoading(); toast('保存成功', 'success'); setTimeout(() => uni.navigateBack(), 500)
  } catch (error) {
    hideLoading(); toastError(error, '保存失败')
  } finally { submitting.value = false }
}
</script>

<template>
  <view class="fin-page">
    <view class="fe-head">
      <text class="fe-head__title">{{ title }}</text>
      <text class="fe-head__sub">{{ subtitle }}</text>
    </view>

    <PageState v-if="loadError" state="error" title="表单数据加载失败" :subtitle="loadError" @retry="boot" />
    <JzSkeleton v-else-if="booting" :rows="5" />
    <template v-else>
    <view class="fin-form-card">
      <view v-if="type !== 'payment' || !form.projectId" class="fin-field">
        <text class="fin-field__label">所属项目</text>
        <picker :range="projectOptions" range-key="label" :value="projectIndex" @change="onProject">
          <view class="fin-field__value" :class="{ 'fin-field__placeholder': !form.projectId }">{{ form.projectId ? selectLabel(projectOptions, projectIndex) : '企业通用账务' }}</view>
        </picker>
        <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
      </view>

      <template v-if="type === 'receivable'">
        <view class="fin-field"><text class="fin-field__label">节点名称</text><input v-model="form.name" maxlength="64" placeholder="如 合同首期款" /></view>
        <view class="fin-field"><text class="fin-field__label">施工节点</text><input v-model="form.stageName" maxlength="64" placeholder="如 签订合同 / 水电验收" /></view>
        <view class="fin-field"><text class="fin-field__label">应收类型</text><picker :range="receivableTypeOptions" range-key="label" :value="receivableTypeIndex" @change="onReceivableType"><view class="fin-field__value">{{ selectLabel(receivableTypeOptions, receivableTypeIndex) }}</view></picker><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view class="fin-field"><text class="fin-field__label">应收金额</text><input v-model="form.amount" type="digit" placeholder="0.00" /><text class="fe-unit">元</text></view>
        <view class="fin-field"><text class="fin-field__label">约定收款日</text><picker mode="date" :value="form.date" @change="form.date = $event.detail.value"><view class="fin-field__value">{{ form.date }}</view></picker><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view class="fin-field"><text class="fin-field__label">需要开票</text><switch :checked="form.invoiceRequired" :color="TOKEN_COLOR.primary" @change="onInvoiceSwitch" /><text v-if="form.invoiceRequired" class="fin-field__label" style="width:auto;">发票号</text><input v-if="form.invoiceRequired" v-model="form.invoiceNo" placeholder="可选" /></view>
      </template>

      <template v-else-if="type === 'receipt'">
        <view class="fin-field"><text class="fin-field__label">应收节点</text><picker :range="receivableOptions" range-key="label" :value="receivableIndex" @change="onReceivable"><view class="fin-field__value" :class="{ 'fin-field__placeholder': !form.receivableId }">{{ form.receivableId ? selectLabel(receivableOptions, receivableIndex) : (form.projectId ? '请选择待收节点' : '请先选择项目') }}</view></picker><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view class="fin-field"><text class="fin-field__label">收款金额</text><input v-model="form.amount" type="digit" placeholder="0.00" /><text class="fe-unit">元</text></view>
        <view class="fin-field"><text class="fin-field__label">收款账户</text><picker :range="accountOptions" range-key="label" :value="accountIndex" @change="onAccount"><view class="fin-field__value">{{ selectLabel(accountOptions, accountIndex) }}</view></picker><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view class="fin-field"><text class="fin-field__label">收款日期</text><picker mode="date" :value="form.date" @change="form.date = $event.detail.value"><view class="fin-field__value">{{ form.date }}</view></picker><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view class="fin-field"><text class="fin-field__label">付款方</text><input v-model="form.payerName" maxlength="64" :placeholder="selectedProject?.customer?.name || '默认项目客户'" /></view>
      </template>

      <template v-else-if="type === 'payable'">
        <view class="fin-field"><text class="fin-field__label">应付名称</text><input v-model="form.name" maxlength="64" :placeholder="form.payableType === 'salary' ? '如 9月水电工工资' : '如 瓷砖材料款'" /></view>
        <view class="fin-field"><text class="fin-field__label">费用类型</text><picker :range="payableTypeOptions" range-key="label" :value="payableTypeIndex" @change="onPayableType"><view class="fin-field__value">{{ selectLabel(payableTypeOptions, payableTypeIndex) }}</view></picker><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view class="fin-field"><text class="fin-field__label">收款方</text><input v-model="form.payeeName" maxlength="64" :placeholder="form.payableType === 'salary' ? '工人姓名' : '供应商/班组'" /></view>
        <view v-if="form.payableType === 'salary'" class="fin-field"><text class="fin-field__label">工资周期</text><input v-model="form.period" maxlength="32" placeholder="如 2026年8月" /></view>
        <view class="fin-field"><text class="fin-field__label">应付金额</text><input v-model="form.amount" type="digit" placeholder="0.00" /><text class="fe-unit">元</text></view>
        <view class="fin-field"><text class="fin-field__label">约定付款日</text><picker mode="date" :value="form.date" @change="form.date = $event.detail.value"><view class="fin-field__value">{{ form.date }}</view></picker><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view v-if="form.payableType !== 'salary'" class="fin-field"><text class="fin-field__label">来源单号</text><input v-model="form.sourceNo" maxlength="64" placeholder="采购单/合同单号，可选" /></view>
        <view class="fin-field"><text class="fin-field__label">加急</text><switch :checked="form.urgent" :color="TOKEN_COLOR.danger" @change="onUrgentSwitch" /></view>
      </template>

      <template v-else-if="type === 'payment'">
        <view class="fin-field"><text class="fin-field__label">应付单</text><picker :range="payableOptions" range-key="label" :value="payableIndex" @change="onPayable"><view class="fin-field__value" :class="{ 'fin-field__placeholder': !form.payableId }">{{ form.payableId ? selectLabel(payableOptions, payableIndex) : '请选择待付账款' }}</view></picker><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view class="fin-field"><text class="fin-field__label">付款金额</text><input v-model="form.amount" type="digit" placeholder="0.00" /><text class="fe-unit">元</text></view>
        <view class="fin-field"><text class="fin-field__label">付款账户</text><picker :range="accountOptions" range-key="label" :value="accountIndex" @change="onAccount"><view class="fin-field__value">{{ selectLabel(accountOptions, accountIndex) }}</view></picker><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view class="fin-field"><text class="fin-field__label">付款日期</text><picker mode="date" :value="form.date" @change="form.date = $event.detail.value"><view class="fin-field__value">{{ form.date }}</view></picker><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view class="fin-field"><text class="fin-field__label">收款方</text><input v-model="form.payeeName" maxlength="64" placeholder="默认应付收款方" /></view>
      </template>

      <template v-else>
        <view class="fin-field"><text class="fin-field__label">收支方向</text><picker :range="directionOptions" range-key="label" :value="directionIndex" @change="onDirection"><view class="fin-field__value">{{ selectLabel(directionOptions, directionIndex) }}</view></picker><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view class="fin-field"><text class="fin-field__label">业务分类</text><input v-model="form.category" maxlength="32" placeholder="如 办公费用 / 其他收入" /></view>
        <view class="fin-field"><text class="fin-field__label">金额</text><input v-model="form.amount" type="digit" placeholder="0.00" /><text class="fe-unit">元</text></view>
        <view class="fin-field"><text class="fin-field__label">资金账户</text><picker :range="accountOptions" range-key="label" :value="accountIndex" @change="onAccount"><view class="fin-field__value">{{ selectLabel(accountOptions, accountIndex) }}</view></picker><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view class="fin-field"><text class="fin-field__label">发生日期</text><picker mode="date" :value="form.date" @change="form.date = $event.detail.value"><view class="fin-field__value">{{ form.date }}</view></picker><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view class="fin-field"><text class="fin-field__label">往来对象</text><input v-model="form.counterparty" maxlength="64" placeholder="供应商/客户/个人" /></view>
        <view class="fin-field"><text class="fin-field__label">摘要</text><input v-model="form.summary" maxlength="128" placeholder="一句话说明资金用途" /></view>
      </template>

      <view class="fin-field fe-remark"><text class="fin-field__label">备注</text><textarea v-model="form.remark" maxlength="500" auto-height placeholder="可选，记录凭证、批次或补充说明" /></view>
    </view>

    <view class="fe-tip"><JzIcon name="info" :size="26" :color="TOKEN_COLOR.primary" /><text>保存后金额不可随意调整；已收/已付金额不能被改小，错误业务应通过反向流水冲销。</text></view>

    <view class="fin-form-actions">
      <button class="jz-btn jz-btn--primary jz-btn--block" :disabled="submitting" @tap="submit">{{ submitting ? '保存中...' : '确认保存' }}</button>
    </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';
.fe-head { padding: 34rpx $jzb-page-pad 12rpx; }
.fe-head__title { display: block; color: $jzb-text-1; font-size: $jzb-font-xl; font-weight: 750; }
.fe-head__sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.fe-unit { margin-left: 8rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.fe-remark { min-height: 150rpx; align-items: flex-start; padding-top: 28rpx; }
.fe-remark textarea { min-height: 90rpx; }
.fe-tip { display: flex; align-items: flex-start; margin: 20rpx $jzb-page-pad 0; padding: 20rpx; color: $jzb-text-3; background: $jzb-primary-lighter; border-radius: $jzb-radius-sm; font-size: $jzb-font-xs; line-height: 1.6; }
.fe-tip text { margin-left: 10rpx; }
</style>
