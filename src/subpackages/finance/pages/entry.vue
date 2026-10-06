<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { dueText, money } from '@/core/format'
import { projectApi } from '@/domains/project/api'
import type { Project } from '@/domains/project/model'
import { financeApi } from '@/domains/finance/api'
import {
  consumeFinanceProjectPickerResult,
  type FinanceProjectSelection
} from '@/domains/finance/project-picker'
import { consumeFinanceReceivablePickerResult } from '@/domains/finance/receivable-picker'
import { consumeFinancePayablePickerResult } from '@/domains/finance/payable-picker'
import { laborApi } from '@/domains/labor/api'
import type { Worker } from '@/domains/labor/model'
import type {
  FundAccount, Ledger, LedgerDirection, LedgerManualPurpose, Payable, PayableType, Receivable
} from '@/domains/finance/model'
import {
  ACCOUNT_LABEL,
  LEDGER_PURPOSE_META,
  PAYABLE_STATUS_META,
  PAYABLE_TYPE_META,
  RECEIVABLE_STATUS_META,
  RECEIVABLE_TYPE_META
} from '@/domains/finance/meta'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzIcon, { type IconName } from '@/components/JzIcon.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

type EntryType = 'receivable' | 'receipt' | 'payable' | 'payment' | 'ledger'
type ReceivableState = 'unknown' | 'ready' | 'empty' | 'settled'
type PayableState = 'unknown' | 'ready' | 'empty' | 'settled'
const today = () => new Date().toISOString().slice(0, 10)
/** 提交意图 ID：同一次提交的失败重试复用，成功后清空。 */
let submitIntentId = ''
const newSubmitIntentId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`
const type = ref<EntryType>('receivable')
const editId = ref('')
const selectedProject = ref<FinanceProjectSelection | null>(null)
const originalLedger = ref<Ledger | null>(null)
const editReason = ref('')
const selectedReceivable = ref<Receivable | null>(null)
const selectedPayable = ref<Payable | null>(null)
const receivableState = ref<ReceivableState>('unknown')
const payableState = ref<PayableState>('unknown')
const receivableChecking = ref(false)
const payableChecking = ref(false)
const receivableInlineError = ref('')
const payableInlineError = ref('')
const workers = ref<Worker[]>([])
const submitting = ref(false)
let pendingReceivableAfterProject = false
let receivableLoadVersion = 0
let payableLoadVersion = 0

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
  purpose: 'other' as LedgerManualPurpose,
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
  payment: '付款核销应付并写入资金台账；项目成本按应付/到货口径归集',
  ledger: editId.value ? '元数据更正留痕；金额、方向、日期或账户变化将冲正重记' : '企业通用或项目直接收支，生成不可变资金流水'
}[type.value]))
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
const purposeOptions = (Object.entries(LEDGER_PURPOSE_META) as Array<[LedgerManualPurpose, { label: string; hint: string }]>)
  .map(([value, meta]) => ({ value, label: meta.label, hint: meta.hint }))
const purposeIndex = computed(() => Math.max(purposeOptions.findIndex((item) => item.value === form.purpose), 0))

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

onShow(async () => {
  const projectResult = consumeFinanceProjectPickerResult()
  const receivableResult = consumeFinanceReceivablePickerResult()
  const payableResult = consumeFinancePayablePickerResult()
  let contextLoaded = false
  if (!projectResult) pendingReceivableAfterProject = false

  if (projectResult) {
    const shouldOpenReceivable = pendingReceivableAfterProject && type.value === 'receipt'
    pendingReceivableAfterProject = false
    if (projectResult.action === 'clear') setProject(null)
    else setProject(projectResult.project)
    if (type.value === 'receipt' && form.projectId) {
      await loadReceivableContext()
      contextLoaded = true
      if (shouldOpenReceivable) {
        if (receivableState.value === 'ready') openReceivablePicker()
        else if (receivableState.value === 'empty') toast('该项目还没有应收节点，请先新增')
        else if (receivableState.value === 'settled') toast('该项目应收已全部收清')
      }
    }
    if (type.value === 'payment') {
      await loadPayableContext()
      contextLoaded = true
    }
  }

  if (receivableResult && type.value === 'receipt') {
    if (receivableResult.action === 'clear') clearReceivableSelection()
    else setSelectedReceivable(receivableResult.receivable)
  }
  if (payableResult && type.value === 'payment') {
    if (payableResult.action === 'clear') clearPayableSelection()
    else setSelectedPayable(payableResult.payable)
  }

  if (booting.value || contextLoaded) return
  if (type.value === 'receipt' && form.projectId) void loadReceivableContext()
  if (type.value === 'payment') void loadPayableContext()
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

async function fetchAllReceivables(projectId?: string): Promise<Receivable[]> {
  const size = 200
  const rows: Receivable[] = []
  for (let current = 1; current <= 5; current += 1) {
    const page = await financeApi.receivables({ projectId, current, size })
    rows.push(...page)
    if (page.length < size) break
  }
  return rows
}

async function fetchAllPayables(projectId?: string): Promise<Payable[]> {
  const size = 200
  const rows: Payable[] = []
  for (let current = 1; current <= 5; current += 1) {
    const page = await financeApi.payables({ projectId, current, size })
    rows.push(...page)
    if (page.length < size) break
  }
  return rows
}

async function hydrate(id: string) {
  if (type.value === 'receivable') {
    const list = await fetchAllReceivables()
    const item = id ? list.find((row) => row.id === id) : undefined
    if (item) {
      form.projectId = item.project.id
      setProject(projectSelection(item.project))
      form.name = item.name
      form.stageName = item.stageName || ''
      form.receivableType = item.type
      form.amount = String(item.amount)
      form.date = item.dueDate
      form.invoiceRequired = item.invoiceRequired
      form.invoiceNo = item.invoiceNo || ''
      form.remark = item.remark || ''
    } else if (form.projectId) {
      await loadReceivableContext()
    }
  } else if (type.value === 'receipt') {
    if (form.projectId) await loadReceivableContext()
    form.date = today()
  } else if (type.value === 'payable') {
    const list = await fetchAllPayables()
    const item = id ? list.find((row) => row.id === id) : undefined
    if (item) {
      form.projectId = item.project?.id || ''
      setProject(projectSelection(item.project))
      form.name = item.name
      form.payableType = item.type
      form.payeeName = item.payeeEmployee?.name || item.payeeName || ''
      form.period = item.period || ''
      form.amount = String(item.amount)
      form.date = item.dueDate
      form.urgent = item.urgent
      form.sourceNo = item.sourceNo || ''
      form.remark = item.remark || ''
    }
  } else if (type.value === 'payment') {
    await loadPayableContext()
    form.date = today()
  } else if (type.value === 'ledger') {
    if (id) {
      const item = await financeApi.ledgerInfo(id)
      originalLedger.value = item
      form.projectId = item.project?.id || ''
      setProject(projectSelection(item.project))
      form.direction = item.direction
      form.purpose = item.purpose || 'other'
      form.category = item.category
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

async function loadReceivableContext() {
  const version = ++receivableLoadVersion
  if (!form.projectId) {
    receivableState.value = 'unknown'
    receivableInlineError.value = ''
    selectedReceivable.value = null
    form.receivableId = ''
    return
  }
  receivableChecking.value = true
  receivableInlineError.value = ''
  try {
    const list = await fetchAllReceivables(form.projectId)
    if (version !== receivableLoadVersion) return
    const pending = list.filter((item) => item.outstandingAmount > 0)
    receivableState.value = !list.length ? 'empty' : pending.length ? 'ready' : 'settled'
    if (form.receivableId) {
      const target = list.find((item) => item.id === form.receivableId && item.outstandingAmount > 0)
      if (target) {
        selectedReceivable.value = target
        if (!form.amount) form.amount = String(target.outstandingAmount)
      } else {
        selectedReceivable.value = null
        form.receivableId = ''
      }
    }
  } catch (error) {
    if (version !== receivableLoadVersion) return
    receivableInlineError.value = error instanceof Error ? error.message : '应收节点读取失败'
  } finally {
    if (version === receivableLoadVersion) receivableChecking.value = false
  }
}

async function loadPayableContext() {
  const version = ++payableLoadVersion
  payableChecking.value = true
  payableInlineError.value = ''
  try {
    const list = await fetchAllPayables(form.projectId || undefined)
    if (version !== payableLoadVersion) return
    const pending = list.filter((item) => item.outstandingAmount > 0)
    payableState.value = !list.length ? 'empty' : pending.length ? 'ready' : 'settled'
    if (form.payableId) {
      const target = list.find((item) => item.id === form.payableId && item.outstandingAmount > 0)
      if (target) {
        selectedPayable.value = target
        if (target.project?.id) {
          form.projectId = target.project.id
          selectedProject.value = projectSelection(target.project)
        }
        if (!form.amount) form.amount = String(target.outstandingAmount)
        if (!form.payeeName) form.payeeName = target.payeeEmployee?.name || target.payeeName || ''
      } else {
        selectedPayable.value = null
        form.payableId = ''
      }
    }
  } catch (error) {
    if (version !== payableLoadVersion) return
    payableInlineError.value = error instanceof Error ? error.message : '应付单读取失败'
  } finally {
    if (version === payableLoadVersion) payableChecking.value = false
  }
}

function setSelectedReceivable(item: Receivable) {
  selectedReceivable.value = item
  form.receivableId = item.id
  if (!form.projectId || form.projectId !== item.project.id) {
    form.projectId = item.project.id
    selectedProject.value = projectSelection(item.project)
  }
  form.amount = String(item.outstandingAmount)
}

function clearReceivableSelection() {
  selectedReceivable.value = null
  form.receivableId = ''
  if (type.value === 'receipt') form.amount = ''
}

function setSelectedPayable(item: Payable) {
  selectedPayable.value = item
  form.payableId = item.id
  form.payeeName = item.payeeEmployee?.name || item.payeeName || ''
  form.amount = String(item.outstandingAmount)
  if (item.project?.id) {
    form.projectId = item.project.id
    selectedProject.value = projectSelection(item.project)
  } else {
    form.projectId = ''
    selectedProject.value = null
  }
}

function clearPayableSelection() {
  selectedPayable.value = null
  form.payableId = ''
  form.payeeName = ''
  if (type.value === 'payment') form.amount = ''
}

function openReceivablePicker() {
  if (!form.projectId) {
    pendingReceivableAfterProject = true
    toast('请先选择项目')
    openProjectPicker()
    return
  }
  if (receivableState.value === 'empty') { toast('该项目还没有应收节点，请先新增'); return }
  if (receivableState.value === 'settled') { toast('该项目应收已全部收清'); return }
  const params = [`projectId=${encodeURIComponent(form.projectId)}`]
  if (form.receivableId) params.push(`selectedId=${encodeURIComponent(form.receivableId)}`)
  if (selectedProject.value?.name) params.push(`projectName=${encodeURIComponent(selectedProject.value.name)}`)
  if (selectedProject.value?.no) params.push(`projectNo=${encodeURIComponent(selectedProject.value.no)}`)
  if (selectedProject.value?.customerName) params.push(`customerName=${encodeURIComponent(selectedProject.value.customerName)}`)
  uni.navigateTo({ url: `${P.financeReceivablePicker}?${params.join('&')}` })
}

function openPayablePicker() {
  if (payableState.value === 'empty') { toast('当前没有待付应付单，请先新增'); return }
  if (payableState.value === 'settled') { toast('应付账款已全部结清'); return }
  const params: string[] = []
  if (form.projectId) params.push(`projectId=${encodeURIComponent(form.projectId)}`)
  if (form.payableId) params.push(`selectedId=${encodeURIComponent(form.payableId)}`)
  if (selectedProject.value?.name) params.push(`projectName=${encodeURIComponent(selectedProject.value.name)}`)
  if (selectedProject.value?.no) params.push(`projectNo=${encodeURIComponent(selectedProject.value.no)}`)
  if (selectedProject.value?.customerName) params.push(`customerName=${encodeURIComponent(selectedProject.value.customerName)}`)
  uni.navigateTo({ url: `${P.financePayablePicker}${params.length ? `?${params.join('&')}` : ''}` })
}

function goCreateReceivable() {
  if (!form.projectId) return
  uni.navigateTo({ url: `${P.financeEntry}?type=receivable&projectId=${encodeURIComponent(form.projectId)}` })
}

function goReceivables() {
  const suffix = form.projectId ? `?projectId=${encodeURIComponent(form.projectId)}` : ''
  uni.navigateTo({ url: `${P.financeReceivables}${suffix}` })
}

function goCreatePayable() {
  const params = ['type=payable', `payableType=${form.payableType}`]
  if (form.projectId) params.push(`projectId=${encodeURIComponent(form.projectId)}`)
  uni.navigateTo({ url: `${P.financeEntry}?${params.join('&')}` })
}

function goPayables() {
  const params: string[] = []
  if (form.projectId) params.push(`projectId=${encodeURIComponent(form.projectId)}`)
  if (form.payableType === 'salary') params.push('type=salary')
  uni.navigateTo({ url: `${P.financePayables}${params.length ? `?${params.join('&')}` : ''}` })
}

function onReceivableType(event: any) { form.receivableType = receivableTypeOptions[Number(event.detail.value)]?.value as Receivable['type'] || 'other' }
function onPayableType(event: any) { form.payableType = payableTypeOptions[Number(event.detail.value)]?.value as PayableType || 'other' }
function onWorker(event: any) { form.workerId = workerOptions.value[Number(event.detail.value)]?.value || '' }
function onAccount(event: any) { form.account = accountOptions[Number(event.detail.value)]?.value as FundAccount || 'companyBank' }
function onDirection(event: any) {
  form.direction = directionOptions[Number(event.detail.value)]?.value as LedgerDirection || 'income'
}
function onPurpose(event: any) {
  form.purpose = purposeOptions[Number(event.detail.value)]?.value || 'other'
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
  const changed = form.projectId !== (project?.id || '')
  form.projectId = project?.id || ''
  selectedProject.value = project
  if (type.value === 'receipt') {
    form.receivableId = ''
    form.payableId = ''
    selectedReceivable.value = null
    receivableState.value = 'unknown'
    receivableInlineError.value = ''
    if (changed) form.amount = ''
  }
  if (type.value === 'payment' && changed) {
    form.payableId = ''
    selectedPayable.value = null
    payableState.value = 'unknown'
    payableInlineError.value = ''
    form.amount = ''
  }
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
  if (type.value === 'receipt' && selectedReceivable.value && amount > selectedReceivable.value.outstandingAmount) {
    toast('收款金额不能超过待收余额'); return
  }
  if (type.value === 'payment' && !form.payableId) { toast('请选择应付单'); return }
  if (type.value === 'payment' && selectedPayable.value && amount > selectedPayable.value.outstandingAmount) {
    toast('付款金额不能超过待付余额'); return
  }
  if (type.value === 'ledger' && (!form.category.trim() || !form.summary.trim())) { toast('请填写分类说明和摘要'); return }
  if (type.value === 'ledger' && form.purpose === 'projectIncidentalCost' && !form.projectId) { toast('项目零星成本必须关联项目'); return }
  if (type.value === 'ledger' && editId.value && !editReason.value.trim()) { toast('请填写更正原因'); return }
  if (!submitIntentId) submitIntentId = newSubmitIntentId()
  submitting.value = true; loading('保存中...')
  try {
    if (type.value === 'receivable') {
      if (editId.value) await financeApi.updateReceivable({ id: editId.value, name: form.name, stageName: form.stageName, type: form.receivableType, amount, dueDate: form.date, invoiceRequired: form.invoiceRequired, invoiceNo: form.invoiceNo, remark: form.remark })
      else await financeApi.saveReceivable({ projectId: form.projectId, name: form.name, stageName: form.stageName, type: form.receivableType, amount, dueDate: form.date, invoiceRequired: form.invoiceRequired, invoiceNo: form.invoiceNo, remark: form.remark })
    } else if (type.value === 'receipt') {
      await financeApi.createReceipt({ projectId: form.projectId, receivableId: form.receivableId, amount, account: form.account, receivedAt: form.date, payerName: form.payerName, remark: form.remark, idempotencyKey: submitIntentId })
    } else if (type.value === 'payable') {
      if (editId.value) await financeApi.updatePayable({ id: editId.value, name: form.name, amount, dueDate: form.date, urgent: form.urgent, period: form.period, remark: form.remark })
      else await financeApi.savePayable({ projectId: form.projectId || undefined, name: form.name, type: form.payableType, payeeName: form.payeeName, period: form.period, amount, dueDate: form.date, urgent: form.urgent, sourceNo: form.sourceNo, remark: form.remark })
    } else if (type.value === 'payment') {
      await financeApi.createPayment({ payableId: form.payableId, amount, account: form.account, paidAt: form.date, payeeName: form.payeeName, workerId: isSalaryPayment.value ? form.workerId : undefined, remark: form.remark, idempotencyKey: submitIntentId })
    } else {
      const payload = {
        projectId: form.projectId || '0',
        direction: form.direction,
        purpose: form.purpose,
        category: form.category.trim(),
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
        await financeApi.saveLedger({ ...payload, projectId: form.projectId || undefined })
      }
    }
    submitIntentId = ''
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
        <view class="fin-field fin-field--tap" @tap="openReceivablePicker">
          <text class="fin-field__label">应收节点</text>
          <view class="fe-entity">
            <view class="fe-entity__main">
              <text class="fe-entity__name" :class="{ 'fin-field__placeholder': !selectedReceivable }">{{ selectedReceivable?.name || (form.projectId ? '请选择待收节点' : '请先选择项目') }}</text>
              <text v-if="selectedReceivable" class="fe-entity__meta">{{ RECEIVABLE_TYPE_META[selectedReceivable.type].label }} · 待收 {{ money(selectedReceivable.outstandingAmount) }}</text>
            </view>
            <view v-if="selectedReceivable" class="fe-entity__clear" @tap.stop="clearReceivableSelection"><JzIcon name="close" :size="22" :color="TOKEN_COLOR.text3" /></view>
            <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
          </view>
        </view>

        <view v-if="receivableChecking" class="fe-inline-hint">正在读取该项目应收节点...</view>
        <view v-else-if="receivableInlineError" class="fe-inline-state fe-inline-state--error">
          <text class="fe-inline-state__title">应收节点暂不可确认</text>
          <text class="fe-inline-state__sub">{{ receivableInlineError }}</text>
          <view class="fe-inline-state__actions"><view class="fe-inline-btn" @tap="loadReceivableContext">重试</view></view>
        </view>
        <view v-else-if="form.projectId && receivableState === 'empty'" class="fe-inline-state">
          <text class="fe-inline-state__title">该项目还没有应收节点</text>
          <text class="fe-inline-state__sub">先在应收计划建立合同节点，再回来登记收款</text>
          <view class="fe-inline-state__actions">
            <view class="fe-inline-btn fe-inline-btn--primary" @tap="goCreateReceivable">去新增应收节点</view>
            <view class="fe-inline-btn" @tap="goReceivables">查看应收计划</view>
          </view>
        </view>
        <view v-else-if="form.projectId && receivableState === 'settled'" class="fe-inline-state fe-inline-state--success">
          <text class="fe-inline-state__title">该项目应收已全部收清</text>
          <text class="fe-inline-state__sub">已收清节点不会进入本次核销范围，可查看应收计划确认明细</text>
          <view class="fe-inline-state__actions"><view class="fe-inline-btn" @tap="goReceivables">查看应收计划</view></view>
        </view>

        <view v-if="selectedReceivable" class="fe-summary">
          <view class="fe-summary__head">
            <view class="fe-summary__title-wrap">
              <text class="fe-summary__title">{{ selectedReceivable.name }}</text>
              <view class="fe-summary__tags">
                <text class="fe-summary__tag" :style="{ color: RECEIVABLE_TYPE_META[selectedReceivable.type].color }">{{ RECEIVABLE_TYPE_META[selectedReceivable.type].label }}</text>
                <text class="fe-summary__tag" :style="{ color: RECEIVABLE_STATUS_META[selectedReceivable.status].color }">{{ RECEIVABLE_STATUS_META[selectedReceivable.status].label }}</text>
              </view>
            </view>
            <view class="fe-summary__clear" @tap.stop="clearReceivableSelection">清除</view>
          </view>
          <view class="fe-summary__amount"><text class="fe-summary__amount-label">待收余额</text><text class="fe-summary__amount-value">{{ money(selectedReceivable.outstandingAmount) }}</text></view>
          <view class="fe-summary__facts">
            <text>应收 {{ money(selectedReceivable.amount) }}</text>
            <text>已收 {{ money(selectedReceivable.receivedAmount) }}</text>
            <text :class="{ 'fe-summary__danger': selectedReceivable.status === 'overdue' || dueText(selectedReceivable.dueDate).includes('逾期') }">{{ selectedReceivable.dueDate || '未设置' }} · {{ dueText(selectedReceivable.dueDate) }}</text>
            <text v-if="selectedReceivable.stageName">施工节点 {{ selectedReceivable.stageName }}</text>
            <text>{{ selectedReceivable.invoiceRequired ? (selectedReceivable.invoiceNo ? `需开票 · ${selectedReceivable.invoiceNo}` : '需开票') : '无需开票' }}</text>
          </view>
        </view>

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
        <view class="fin-field fin-field--tap" @tap="openPayablePicker">
          <text class="fin-field__label">应付单</text>
          <view class="fe-entity">
            <view class="fe-entity__main">
              <text class="fe-entity__name" :class="{ 'fin-field__placeholder': !selectedPayable }">{{ selectedPayable?.name || '请选择待付账款' }}</text>
              <text v-if="selectedPayable" class="fe-entity__meta">{{ PAYABLE_TYPE_META[selectedPayable.type].label }} · 待付 {{ money(selectedPayable.outstandingAmount) }}</text>
            </view>
            <view v-if="selectedPayable" class="fe-entity__clear" @tap.stop="clearPayableSelection"><JzIcon name="close" :size="22" :color="TOKEN_COLOR.text3" /></view>
            <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
          </view>
        </view>

        <view v-if="payableChecking" class="fe-inline-hint">正在读取待付应付单...</view>
        <view v-else-if="payableInlineError" class="fe-inline-state fe-inline-state--error">
          <text class="fe-inline-state__title">应付单暂不可确认</text>
          <text class="fe-inline-state__sub">{{ payableInlineError }}</text>
          <view class="fe-inline-state__actions"><view class="fe-inline-btn" @tap="loadPayableContext">重试</view></view>
        </view>
        <view v-else-if="payableState === 'empty'" class="fe-inline-state">
          <text class="fe-inline-state__title">当前没有待付应付单</text>
          <text class="fe-inline-state__sub">先建立材料款、项目款、工资或费用应付，再安排付款</text>
          <view class="fe-inline-state__actions">
            <view class="fe-inline-btn fe-inline-btn--primary" @tap="goCreatePayable">去新增应付</view>
            <view class="fe-inline-btn" @tap="goPayables">查看应付账款</view>
          </view>
        </view>
        <view v-else-if="payableState === 'settled'" class="fe-inline-state fe-inline-state--success">
          <text class="fe-inline-state__title">应付账款已全部结清</text>
          <text class="fe-inline-state__sub">已付清应付单不会进入本次核销范围，可查看应付账款确认明细</text>
          <view class="fe-inline-state__actions"><view class="fe-inline-btn" @tap="goPayables">查看应付账款</view></view>
        </view>

        <view v-if="selectedPayable" class="fe-summary">
          <view class="fe-summary__head">
            <view class="fe-summary__title-wrap">
              <text class="fe-summary__title">{{ selectedPayable.name }}</text>
              <view class="fe-summary__tags">
                <text class="fe-summary__tag" :style="{ color: PAYABLE_TYPE_META[selectedPayable.type].color }">{{ PAYABLE_TYPE_META[selectedPayable.type].label }}</text>
                <text class="fe-summary__tag" :style="{ color: PAYABLE_STATUS_META[selectedPayable.status].color }">{{ PAYABLE_STATUS_META[selectedPayable.status].label }}</text>
                <text v-if="selectedPayable.urgent" class="fe-summary__tag fe-summary__tag--danger">加急</text>
              </view>
            </view>
            <view class="fe-summary__clear" @tap.stop="clearPayableSelection">清除</view>
          </view>
          <view class="fe-summary__amount"><text class="fe-summary__amount-label">待付余额</text><text class="fe-summary__amount-value">{{ money(selectedPayable.outstandingAmount) }}</text></view>
          <view class="fe-summary__facts">
            <text>应付 {{ money(selectedPayable.amount) }}</text>
            <text>已付 {{ money(selectedPayable.paidAmount) }}</text>
            <text :class="{ 'fe-summary__danger': selectedPayable.status === 'overdue' || dueText(selectedPayable.dueDate).includes('逾期') }">{{ selectedPayable.dueDate || '未设置' }} · {{ dueText(selectedPayable.dueDate) }}</text>
            <text>收款方 {{ selectedPayable.payeeEmployee?.name || selectedPayable.payeeName || '未指定' }}</text>
            <text>项目 {{ selectedPayable.project?.name || '企业通用费用' }}</text>
            <text v-if="selectedPayable.period">工资周期 {{ selectedPayable.period }}</text>
            <text v-if="selectedPayable.sourceNo">来源单号 {{ selectedPayable.sourceNo }}</text>
          </view>
        </view>

        <view class="fin-field"><text class="fin-field__label">付款金额</text><input v-model="form.amount" type="digit" placeholder="0.00" /><text class="fe-unit">元</text></view>
        <view class="fin-field"><text class="fin-field__label">付款账户</text><picker :range="accountOptions" range-key="label" :value="accountIndex" @change="onAccount"><view class="fin-field__value">{{ selectLabel(accountOptions, accountIndex) }}</view></picker><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view class="fin-field"><text class="fin-field__label">付款日期</text><picker mode="date" :value="form.date" @change="form.date = $event.detail.value"><view class="fin-field__value">{{ form.date }}</view></picker><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view v-if="isSalaryPayment" class="fin-field"><text class="fin-field__label">发放工人</text><picker :range="workerOptions" range-key="label" :value="workerIndex" @change="onWorker"><view class="fin-field__value" :class="{ 'fin-field__placeholder': !form.workerId }">{{ form.workerId ? selectLabel(workerOptions, workerIndex) : '选填：请选择工人（用于工资凭证）' }}</view></picker><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view v-if="isSalaryPayment && !form.workerId" class="fe-inline-hint fe-inline-hint--worker">未选择工人，工资凭证的身份证号/工种/银行账号栏位将留空，可稍后补录。</view>
        <view class="fin-field"><text class="fin-field__label">收款方</text><input v-model="form.payeeName" maxlength="64" placeholder="默认应付收款方" /></view>
      </template>

      <template v-else>
        <view class="fin-field"><text class="fin-field__label">收支方向</text><picker :range="directionOptions" range-key="label" :value="directionIndex" @change="onDirection"><view class="fin-field__value">{{ selectLabel(directionOptions, directionIndex) }}</view></picker><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view class="fin-field"><text class="fin-field__label">账务用途</text><picker :range="purposeOptions" range-key="label" :value="purposeIndex" @change="onPurpose"><view class="fin-field__value">{{ selectLabel(purposeOptions, purposeIndex) }}</view></picker><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view class="fe-purpose-hint">{{ purposeOptions[purposeIndex]?.hint }}</view>
        <view class="fin-field"><text class="fin-field__label">分类说明</text><input v-model="form.category" maxlength="128" placeholder="如 银行手续费、临时保洁、股东借款" /></view>
        <view v-if="form.purpose === 'projectIncidentalCost' && !form.projectId" class="fe-purpose-warn">项目零星成本必须关联项目</view>
        <view class="fin-field"><text class="fin-field__label">金额</text><input v-model="form.amount" type="digit" placeholder="0.00" /><text class="fe-unit">元</text></view>
        <view class="fin-field"><text class="fin-field__label">资金账户</text><picker :range="accountOptions" range-key="label" :value="accountIndex" @change="onAccount"><view class="fin-field__value">{{ selectLabel(accountOptions, accountIndex) }}</view></picker><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view class="fin-field"><text class="fin-field__label">发生日期</text><picker mode="date" :value="form.date" @change="form.date = $event.detail.value"><view class="fin-field__value">{{ form.date }}</view></picker><JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" /></view>
        <view class="fin-field"><text class="fin-field__label">往来对象</text><input v-model="form.counterparty" maxlength="64" placeholder="供应商/客户/个人" /></view>
        <view class="fin-field"><text class="fin-field__label">摘要</text><input v-model="form.summary" maxlength="128" placeholder="一句话说明资金用途" /></view>
      </template>

      <view v-if="type === 'ledger' && editId" class="fin-field"><text class="fin-field__label">更正原因</text><input v-model="editReason" maxlength="500" placeholder="必填，说明记错原因" /></view>
      <view class="fin-field fe-remark"><text class="fin-field__label">备注</text><textarea v-model="form.remark" maxlength="500" auto-height placeholder="可选，记录凭证、批次或补充说明" /></view>
    </view>

    <view class="fe-tip"><JzIcon name="info" :size="26" :color="TOKEN_COLOR.primary" /><text v-if="type === 'ledger' && editId">企业负责人、财务可更正分类与账务用途；其他元数据更正仅企业负责人可操作，且全程留痕。金额、方向、日期或账户变化将自动冲正重记。</text><text v-else-if="type === 'ledger'">手工记账只登记非计划内其他账务；工程款、材料款、工资、项目款请走应收/应付闭环。</text><text v-else>保存后金额不可随意调整；已收/已付金额不能被改小，错误业务应通过反向流水冲销。</text></view>

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
.fe-entity { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10rpx; }
.fe-entity__main { flex: 1; min-width: 0; text-align: right; }
.fe-entity__name { display: block; color: $jzb-text-1; font-size: $jzb-font; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.fe-entity__meta { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.fe-entity__clear { flex: none; display: flex; align-items: center; justify-content: center; width: 48rpx; height: 48rpx; border-radius: 50%; background: $jzb-bg-page; }
.fe-inline-hint { margin: -2rpx 0 16rpx 142rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.fe-inline-hint--worker { margin-top: -4rpx; padding: 12rpx 16rpx; color: $jzb-warning; background: $jzb-warning-soft; border-radius: $jzb-radius-sm; line-height: 1.5; }
.fe-inline-state { margin: -2rpx 0 20rpx 142rpx; padding: 18rpx; background: $jzb-bg-page; border-radius: $jzb-radius-sm; }
.fe-inline-state--error { background: $jzb-danger-soft; }
.fe-inline-state--success { background: $jzb-success-soft; }
.fe-inline-state__title { display: block; color: $jzb-text-1; font-size: $jzb-font-xs; font-weight: 650; }
.fe-inline-state__sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: 20rpx; line-height: 1.5; }
.fe-inline-state__actions { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 14rpx; }
.fe-inline-btn { min-height: 56rpx; display: inline-flex; align-items: center; justify-content: center; padding: 0 18rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; font-weight: 600; }
.fe-inline-btn--primary { color: $jzb-text-inverse; background: $jzb-gradient; }
.fe-summary { margin: 0 0 18rpx; padding: 20rpx; background: $jzb-primary-lightest; border: 1rpx solid rgba(22, 163, 148, .2); border-radius: $jzb-radius-sm; }
.fe-summary__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; }
.fe-summary__title-wrap { flex: 1; min-width: 0; }
.fe-summary__title { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.fe-summary__tags { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 8rpx; }
.fe-summary__tag { padding: 2rpx 10rpx; background: $jzb-bg-card; border-radius: $jzb-radius-pill; font-size: 20rpx; }
.fe-summary__tag--danger { color: $jzb-danger; background: $jzb-danger-soft; }
.fe-summary__clear { flex: none; color: $jzb-danger; font-size: $jzb-font-xs; }
.fe-summary__amount { display: flex; align-items: baseline; justify-content: space-between; margin-top: 16rpx; padding-top: 16rpx; border-top: 1rpx solid rgba(22, 163, 148, .14); }
.fe-summary__amount-label { color: $jzb-text-3; font-size: $jzb-font-xs; }
.fe-summary__amount-value { color: $jzb-text-1; font-size: 34rpx; font-weight: 750; }
.fe-summary__facts { display: flex; flex-wrap: wrap; gap: 10rpx 20rpx; margin-top: 14rpx; color: $jzb-text-3; font-size: 20rpx; line-height: 1.45; }
.fe-summary__danger { color: $jzb-danger; }
.fin-field--tap { cursor: pointer; }
.fe-category-field { gap: 8rpx; }
.fe-purpose-hint { margin: -2rpx 0 0 142rpx; padding: 0 0 16rpx; color: $jzb-text-3; font-size: 21rpx; line-height: 1.5; }
.fe-purpose-warn { margin: -2rpx 0 0 142rpx; padding: 0 0 16rpx; color: $jzb-danger; font-size: 21rpx; }
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
