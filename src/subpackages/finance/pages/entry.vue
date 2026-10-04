<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { projectApi } from '@/domains/project/api'
import type { Project } from '@/domains/project/model'
import { financeApi } from '@/domains/finance/api'
import {
  consumeFinanceProjectPickerResult,
  type FinanceProjectSelection
} from '@/domains/finance/project-picker'
import {
  consumeLedgerCategoryPickerResult,
  type LedgerCategorySelection
} from '@/domains/finance/ledger-category-picker'
import { laborApi } from '@/domains/labor/api'
import type { Worker } from '@/domains/labor/model'
import type {
  FundAccount, Ledger, LedgerDirection, Payable, PayableType, Receivable
} from '@/domains/finance/model'
import { ACCOUNT_LABEL, PAYABLE_TYPE_META } from '@/domains/finance/meta'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzIcon, { type IconName } from '@/components/JzIcon.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

type EntryType = 'receivable' | 'receipt' | 'payable' | 'payment' | 'ledger'
const today = () => new Date().toISOString().slice(0, 10)
const type = ref<EntryType>('receivable')
const editId = ref('')
const selectedProject = ref<FinanceProjectSelection | null>(null)
const selectedCategory = ref<LedgerCategorySelection | null>(null)
const originalLedger = ref<Ledger | null>(null)
const editReason = ref('')
const receivables = ref<Receivable[]>([])
const payables = ref<Payable[]>([])
const workers = ref<Worker[]>([])
const submitting = ref(false)

const form = reactive({
  projectId: '',
  receivableId: '',
  payableId: '',
  workerId: '',
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
  categoryId: '',
  counterparty: '',
  summary: '',
  remark: ''
})

const title = computed(() => ({
  receivable: editId.value ? '编辑应收节点' : '新增应收节点',
  receipt: '登记客户收款',
  payable: editId.value ? '编辑应付单' : form.payableType === 'salary' ? '新增工人工资' : '新增应付成本',
  payment: '安排业务付款',
  ledger: editId.value ? '更正手工记账' : '手工记账'
}[type.value]))
const subtitle = computed(() => ({
  receivable: '按合同节点安排首期款、进度款与尾款',
  receipt: '收款将自动核销应收并写入资金台账',
  payable: '材料款、项目款、工资与费用形成统一付款义务',
  payment: '付款将自动核销应付并形成项目成本',
  ledger: editId.value ? '元数据更正留痕；金额、方向、日期或账户变化将冲正重记' : '企业通用或项目直接收支，生成不可变资金流水'
}[type.value]))
const receivableOptions = computed(() => receivables.value
  .filter((item) => item.outstandingAmount > 0)
  .map((item) => ({ label: `${item.name} · 待收¥${item.outstandingAmount}`, value: item.id })))
const receivableIndex = computed(() => Math.max(receivableOptions.value.findIndex((item) => item.value === form.receivableId), 0))
const payableOptions = computed(() => payables.value
  .filter((item) => item.outstandingAmount > 0)
  .map((item) => ({ label: `${item.name} · 待付¥${item.outstandingAmount}`, value: item.id })))
const payableIndex = computed(() => Math.max(payableOptions.value.findIndex((item) => item.value === form.payableId), 0))
const selectedPayable = computed(() => payables.value.find((item) => item.id === form.payableId))
/** 工资类应付付款时才需要选择个人工人，用于生成个人工资凭证。 */
const isSalaryPayment = computed(() => type.value === 'payment' && selectedPayable.value?.type === 'salary')
const workerOptions = computed(() => workers.value
  .filter((item) => item.status === 'active')
  .map((item) => ({ label: `${item.name} · ${item.trade || '工种未填'}`, value: item.id })))
const workerIndex = computed(() => Math.max(workerOptions.value.findIndex((item) => item.value === form.workerId), 0))
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

const submitLabel = computed(() => {
  if (submitting.value) return '处理中…'
  if (type.value === 'receivable') return editId.value ? '保存应收节点' : '创建应收节点'
  if (type.value === 'receipt') return '确认收款登记'
  if (type.value === 'payable') {
    if (editId.value) return '保存应付成本'
    return form.payableType === 'salary' ? '创建工资应付' : '创建应付成本'
  }
  if (type.value === 'payment') return '确认付款并核销'
  if (!editId.value) return '保存手工流水'
  return ledgerFinanciallyChanged() ? '冲正并重记' : '保存更正'
})
const submitIcon = computed<IconName>(() =>
  type.value === 'ledger' && editId.value && ledgerFinanciallyChanged() ? 'history' : 'check-circle'
)
const submitHint = computed(() => {
  if (type.value !== 'ledger' || !editId.value) return ''
  if (!editReason.value.trim()) return '请先填写更正原因，系统会记录操作人和修订前后内容。'
  return ledgerFinanciallyChanged()
    ? '金额、方向、日期或账户发生变化，保存后将生成冲正流水并重新登记。'
    : '本次仅更正分类、摘要等元数据，系统会保留原流水和修订记录。'
})

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

onShow(() => {
  const projectResult = consumeFinanceProjectPickerResult()
  if (projectResult) {
    if (projectResult.action === 'clear') setProject(null)
    else setProject(projectResult.project)
  }
  const categoryResult = consumeLedgerCategoryPickerResult()
  if (categoryResult) {
    if (categoryResult.action === 'clear') clearCategory()
    else setCategory(categoryResult.category)
  }
})

async function boot() {
  booting.value = true
  loadError.value = ''
  try {
    if (can(session.role, 'view:worker')) workers.value = await laborApi.workers()
    await hydrate(editId.value)
    if (form.projectId && selectedProject.value?.id !== form.projectId) await loadProjectSelection()
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
      form.projectId = item.project.id; setProject(projectSelection(item.project)); form.name = item.name; form.stageName = item.stageName || ''
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
      form.projectId = item.project?.id || ''; setProject(projectSelection(item.project)); form.name = item.name; form.payableType = item.type
      form.payeeName = item.payeeEmployee?.name || item.payeeName || ''; form.period = item.period || ''
      form.amount = String(item.amount); form.date = item.dueDate; form.urgent = item.urgent
      form.sourceNo = item.sourceNo || ''; form.remark = item.remark || ''
    }
  } else if (type.value === 'payment') {
    payables.value = await financeApi.payables()
    const target = payables.value.find((item) => item.id === form.payableId)
    if (target) {
      form.projectId = target.project?.id || ''; setProject(projectSelection(target.project)); form.payeeName = target.payeeEmployee?.name || target.payeeName || ''
      form.amount = String(target.outstandingAmount)
    }
    form.date = today()
  } else if (type.value === 'ledger') {
    if (id) {
      const item = await financeApi.ledgerInfo(id)
      originalLedger.value = item
      form.projectId = item.project?.id || ''
      setProject(projectSelection(item.project))
      form.direction = item.direction
      form.categoryId = item.categoryNode?.id || ''
      form.category = item.category
      selectedCategory.value = item.categoryNode ? {
        id: item.categoryNode.id,
        name: item.categoryNode.name,
        path: item.categoryNode.name,
        direction: item.categoryNode.direction
      } : null
      form.amount = String(item.amount)
      form.account = item.account
      form.date = item.occurredAt
      form.counterparty = item.counterparty || ''
      form.summary = item.summary
      form.remark = item.remark || ''
    } else {
      form.date = today()
    }
  } else {
    form.date = today()
  }
}

async function loadReceivables() {
  if (!form.projectId) { receivables.value = []; return }
  receivables.value = await financeApi.receivables({ projectId: form.projectId })
  if (!receivables.value.some((item) => item.id === form.receivableId)) form.receivableId = ''
}
function onReceivable(event: any) { form.receivableId = receivableOptions.value[Number(event.detail.value)]?.value || ''; const target = receivables.value.find((item) => item.id === form.receivableId); if (target) form.amount = String(target.outstandingAmount) }
function onPayable(event: any) { form.payableId = payableOptions.value[Number(event.detail.value)]?.value || ''; const target = payables.value.find((item) => item.id === form.payableId); if (target) { form.payeeName = target.payeeEmployee?.name || target.payeeName || ''; form.amount = String(target.outstandingAmount) } }
function onReceivableType(event: any) { form.receivableType = receivableTypeOptions[Number(event.detail.value)]?.value as Receivable['type'] || 'other' }
function onPayableType(event: any) { form.payableType = payableTypeOptions[Number(event.detail.value)]?.value as PayableType || 'other' }
function onWorker(event: any) { form.workerId = workerOptions.value[Number(event.detail.value)]?.value || '' }
function onAccount(event: any) { form.account = accountOptions[Number(event.detail.value)]?.value as FundAccount || 'companyBank' }
function onDirection(event: any) {
  form.direction = directionOptions[Number(event.detail.value)]?.value as LedgerDirection || 'income'
  if (type.value === 'ledger') clearCategory()
}
function onInvoiceSwitch(event: any) { form.invoiceRequired = !!event.detail.value }
function onUrgentSwitch(event: any) { form.urgent = !!event.detail.value }
function selectLabel(options: { label: string }[], index: number) { return options[index]?.label || '' }

function projectSelection(project?: Project | null): FinanceProjectSelection | null {
  if (!project?.id) return null
  return {
    id: project.id,
    name: project.name,
    no: project.no,
    customerName: project.customer?.name
  }
}

function setProject(project: FinanceProjectSelection | null) {
  form.projectId = project?.id || ''
  selectedProject.value = project
  form.receivableId = ''
  form.payableId = ''
  if (type.value === 'receipt') void loadReceivables()
}

async function loadProjectSelection() {
  if (!form.projectId) { selectedProject.value = null; return }
  try {
    selectedProject.value = projectSelection(await projectApi.info(form.projectId))
      || { id: form.projectId, name: '已选项目' }
  } catch {
    selectedProject.value = { id: form.projectId, name: '已选项目' }
  }
}

function openProjectPicker() {
  const params = [`selectedId=${encodeURIComponent(form.projectId)}`]
  if (selectedProject.value) {
    params.push(`selectedName=${encodeURIComponent(selectedProject.value.name)}`)
    if (selectedProject.value.no) params.push(`selectedNo=${encodeURIComponent(selectedProject.value.no)}`)
  }
  uni.navigateTo({ url: `${P.financeProjectPicker}?${params.join('&')}` })
}

function clearProject() {
  setProject(null)
}

function setCategory(category: LedgerCategorySelection | null) {
  selectedCategory.value = category
  form.categoryId = category?.id || ''
  if (category) form.category = category.name
}

function clearCategory() {
  setCategory(null)
  form.category = ''
}

function onCategoryInput() {
  selectedCategory.value = null
  form.categoryId = ''
}

function openCategoryPicker() {
  const params = [`direction=${form.direction}`]
  if (form.categoryId) {
    params.push(`selectedId=${encodeURIComponent(form.categoryId)}`)
    if (selectedCategory.value?.name) params.push(`selectedName=${encodeURIComponent(selectedCategory.value.name)}`)
    if (selectedCategory.value?.path) params.push(`selectedPath=${encodeURIComponent(selectedCategory.value.path)}`)
  } else if (form.category.trim()) {
    params.push(`selectedText=${encodeURIComponent(form.category.trim())}`)
  }
  uni.navigateTo({ url: `${P.financeLedgerCategoryPicker}?${params.join('&')}` })
}

function ledgerFinanciallyChanged() {
  const original = originalLedger.value
  if (!original) return false
  return form.direction !== original.direction
    || Number(form.amount) !== original.amount
    || form.account !== original.account
    || form.date !== original.occurredAt
}

async function submit() {
  const amount = Number(form.amount)
  if (!amount || amount <= 0) { toast('请输入正确金额'); return }
  if (['receivable', 'receipt'].includes(type.value) && !form.projectId) { toast('请选择项目'); return }
  if (type.value === 'receipt' && !form.receivableId) { toast('请选择应收节点'); return }
  if (type.value === 'payment' && !form.payableId) { toast('请选择应付单'); return }
  if (type.value === 'ledger' && (!form.category.trim() || !form.summary.trim())) { toast('请填写分类和摘要'); return }
  if (type.value === 'ledger' && editId.value && !editReason.value.trim()) { toast('请填写更正原因'); return }
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
      if (isSalaryPayment.value && !form.workerId) { toast('工资付款请选择发放工人'); return }
      await financeApi.createPayment({ payableId: form.payableId, amount, account: form.account, paidAt: form.date, payeeName: form.payeeName, workerId: isSalaryPayment.value ? form.workerId : undefined, remark: form.remark })
    } else {
      const payload = {
        projectId: form.projectId || '0',
        direction: form.direction,
        category: form.category.trim(),
        categoryId: form.categoryId || '0',
        amount,
        account: form.account,
        occurredAt: form.date,
        counterparty: form.counterparty,
        summary: form.summary.trim(),
        remark: form.remark
      }
      if (editId.value) {
        if (ledgerFinanciallyChanged()) {
          await financeApi.correctLedger({ ...payload, ledgerId: editId.value, reason: editReason.value.trim() })
        } else {
          await financeApi.updateLedger({ ...payload, ledgerId: editId.value, reason: editReason.value.trim() })
        }
      } else {
        await financeApi.saveLedger({ ...payload, projectId: form.projectId || undefined, categoryId: form.categoryId || undefined })
      }
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
      <view v-if="type !== 'payment' || !form.projectId" class="fin-field fin-field--tap" @tap="openProjectPicker">
        <text class="fin-field__label">所属项目</text>
        <view class="fe-project">
          <view class="fe-project__main">
            <text class="fe-project__name" :class="{ 'fin-field__placeholder': !form.projectId }">{{ selectedProject?.name || '企业通用账务' }}</text>
            <text v-if="selectedProject?.no" class="fe-project__meta">{{ selectedProject.no }}{{ selectedProject.customerName ? ` · ${selectedProject.customerName}` : '' }}</text>
          </view>
          <view v-if="form.projectId" class="fe-project__clear" @tap.stop="clearProject"><JzIcon name="close" :size="22" :color="TOKEN_COLOR.text3" /><text>取消</text></view>
          <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
        </view>
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
        <view class="fin-field"><text class="fin-field__label">付款方</text><input v-model="form.payerName" maxlength="64" :placeholder="selectedProject?.customerName || '默认项目客户'" /></view>
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
        <view v-if="isSalaryPayment" class="fin-field"><text class="fin-field__label">发放工人</text><picker :range="workerOptions" range-key="label" :value="workerIndex" @change="onWorker"><view class="fin-field__value" :class="{ 'fin-field__placeholder': !form.workerId }">{{ form.workerId ? selectLabel(workerOptions, workerIndex) : '请选择工人（用于工资凭证）' }}</view></picker><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view class="fin-field"><text class="fin-field__label">收款方</text><input v-model="form.payeeName" maxlength="64" placeholder="默认应付收款方" /></view>
      </template>

      <template v-else>
        <view class="fin-field"><text class="fin-field__label">收支方向</text><picker :range="directionOptions" range-key="label" :value="directionIndex" @change="onDirection"><view class="fin-field__value">{{ selectLabel(directionOptions, directionIndex) }}</view></picker><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view class="fin-field fe-category-field">
          <text class="fin-field__label">业务分类</text>
          <input v-model="form.category" maxlength="128" placeholder="输入或选择业务分类" @input="onCategoryInput" />
          <view class="fe-category-pick" @tap.stop="openCategoryPicker"><JzIcon name="clipboard" :size="24" :color="TOKEN_COLOR.primary" /><text>选择</text></view>
        </view>
        <view v-if="selectedCategory" class="fe-category-path">
          <JzIcon name="folder" :size="22" :color="TOKEN_COLOR.primary" />
          <text>已选：{{ selectedCategory.path }}</text>
        </view>
        <view class="fin-field"><text class="fin-field__label">金额</text><input v-model="form.amount" type="digit" placeholder="0.00" /><text class="fe-unit">元</text></view>
        <view class="fin-field"><text class="fin-field__label">资金账户</text><picker :range="accountOptions" range-key="label" :value="accountIndex" @change="onAccount"><view class="fin-field__value">{{ selectLabel(accountOptions, accountIndex) }}</view></picker><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view class="fin-field"><text class="fin-field__label">发生日期</text><picker mode="date" :value="form.date" @change="form.date = $event.detail.value"><view class="fin-field__value">{{ form.date }}</view></picker><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view class="fin-field"><text class="fin-field__label">往来对象</text><input v-model="form.counterparty" maxlength="64" placeholder="供应商/客户/个人" /></view>
        <view class="fin-field"><text class="fin-field__label">摘要</text><input v-model="form.summary" maxlength="128" placeholder="一句话说明资金用途" /></view>
      </template>

      <view v-if="type === 'ledger' && editId" class="fin-field"><text class="fin-field__label">更正原因</text><input v-model="editReason" maxlength="500" placeholder="必填，说明记错原因" /></view>
      <view class="fin-field fe-remark"><text class="fin-field__label">备注</text><textarea v-model="form.remark" maxlength="500" auto-height placeholder="可选，记录凭证、批次或补充说明" /></view>
    </view>

    <view class="fe-tip"><JzIcon name="info" :size="26" :color="TOKEN_COLOR.primary" /><text v-if="type === 'ledger' && editId">仅企业负责人可更正手工记账。分类、摘要等元数据修改会留痕；金额、方向、日期或账户变化将自动冲正重记。</text><text v-else>保存后金额不可随意调整；已收/已付金额不能被改小，错误业务应通过反向流水冲销。</text></view>

    <view class="fin-form-actions">
      <view v-if="submitHint" class="fe-submit-note">
        <JzIcon name="info" :size="24" :color="TOKEN_COLOR.primary" />
        <text>{{ submitHint }}</text>
      </view>
      <button class="jz-btn jz-btn--primary jz-btn--block" :disabled="submitting" @tap="submit">
        <JzIcon :name="submitIcon" :size="28" :color="TOKEN_COLOR.white" />
        <text>{{ submitLabel }}</text>
      </button>
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
.fin-field--tap { cursor: pointer; }
.fe-category-field { gap: 8rpx; }
.fe-category-pick { flex: none; display: flex; align-items: center; gap: 4rpx; padding: 12rpx 0 12rpx 12rpx; color: $jzb-primary; font-size: $jzb-font-xs; }
.fe-category-path { display: flex; align-items: center; gap: 8rpx; margin: -1rpx 0 0; padding: 14rpx 0 18rpx 142rpx; color: $jzb-text-3; border-top: 1rpx solid $jzb-border-light; font-size: $jzb-font-xs; }
.fe-project { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12rpx; }
.fe-project__main { flex: 1; min-width: 0; text-align: right; }
.fe-project__name { display: block; color: $jzb-text-1; font-size: $jzb-font; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.fe-project__meta { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.fe-project__clear { flex: none; display: flex; align-items: center; gap: 4rpx; padding: 12rpx 0 12rpx 12rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.fe-remark { min-height: 150rpx; align-items: flex-start; padding-top: 28rpx; }
.fe-remark textarea { min-height: 90rpx; }
.fe-submit-note { display: flex; align-items: flex-start; gap: 8rpx; margin-bottom: 18rpx; padding: 16rpx 18rpx; color: $jzb-text-3; background: $jzb-primary-lighter; border-radius: $jzb-radius-sm; font-size: $jzb-font-xs; line-height: 1.5; }
.fe-tip { display: flex; align-items: flex-start; margin: 20rpx $jzb-page-pad 0; padding: 20rpx; color: $jzb-text-3; background: $jzb-primary-lighter; border-radius: $jzb-radius-sm; font-size: $jzb-font-xs; line-height: 1.6; }
.fe-tip text { margin-left: 10rpx; }
</style>
