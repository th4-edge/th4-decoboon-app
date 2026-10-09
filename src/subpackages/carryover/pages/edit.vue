<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { identityApi } from '@/domains/identity/api'
import type { Employee } from '@/domains/identity/model'
import { consumeEmployeePickerResult } from '@/domains/identity/employee-picker'
import { carryoverApi } from '@/domains/carryover/api'
import type { CarryoverAdjustment, CarryoverAttachment, CarryoverAttachmentCategory, CarryoverAdjustmentType, CarryoverCostStatus, CarryoverProjectInput, CarryoverProjectStatus } from '@/domains/carryover/model'
import type { ProjectStatus } from '@/domains/project/model'
import { fileApi } from '@/domains/file/api'
import { chooseImages } from '@/domains/file/choose-media'
import { confirm, confirmDanger, toast, toastError, loading, hideLoading } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

const id = ref('')
const batchId = ref('')
const employees = ref<Employee[]>([])
const customerName = ref('')
const customerPhone = ref('')
const community = ref('')
const address = ref('')
const area = ref('')
const owner = ref<Employee>()
const manager = ref<Employee>()
const designer = ref<Employee>()
const contractNo = ref('')
const signedAmount = ref('')
const currentAmount = ref('')
const signedAt = ref('')
const startDate = ref('')
const planEndDate = ref('')
const projectName = ref('')
const projectStatus = ref<ProjectStatus>('ongoing')
const currentStageName = ref('')
const progress = ref(0)
const remainingWork = ref('')
const currentIssue = ref('')
const receivableOutstanding = ref('')
const receivableDueDate = ref('')
const receivableSourceNo = ref('')
const receivableConfirmed = ref(false)
const payableOutstanding = ref('')
const payableDueDate = ref('')
const payablePayeeName = ref('')
const payableSourceNo = ref('')
const payableConfirmed = ref(false)
const costTotal = ref('')
const costStatus = ref<CarryoverCostStatus>('unknown')
const costMissingNote = ref('')
const legacyId = ref('')
const legacyProjectNo = ref('')
const legacyAccountNote = ref('')
const saving = ref(false)
const financialHelpVisible = ref(false)
const status = ref<CarryoverProjectStatus>('draft')
const attachments = ref<CarryoverAttachment[]>([])
const adjustments = ref<CarryoverAdjustment[]>([])
const adjustmentType = ref<CarryoverAdjustmentType>('receivable')
const adjustmentAmount = ref('')
const adjustmentReason = ref('')
const ADJUSTMENT_TYPES: { value: CarryoverAdjustmentType; label: string }[] = [
  { value: 'receivable', label: '期初应收' },
  { value: 'payable', label: '期初应付' },
  { value: 'cost', label: '接管前成本' },
  { value: 'other', label: '其他更正' }
]
onShow(() => { applyEmployeePickerResult() })
function onProgressChange(event: any) { progress.value = Number(event?.detail?.value ?? 0) }
const adjustmentTypeIndex = computed(() => Math.max(0, ADJUSTMENT_TYPES.findIndex(item => item.value === adjustmentType.value)))
const adjustmentTypeLabels = ADJUSTMENT_TYPES.map((item) => item.label)
function pickAdjustmentType(label: string) {
  const hit = ADJUSTMENT_TYPES.find((item) => item.label === label)
  if (hit) adjustmentType.value = hit.value
}
function onReceivableConfirmedChange(event: any) { receivableConfirmed.value = !!event?.detail?.value }
function onPayableConfirmedChange(event: any) { payableConfirmed.value = !!event?.detail?.value }

const employeePickerTarget = ref<'owner' | 'manager' | 'designer'>('owner')
function openEmployeePicker(target: 'owner' | 'manager' | 'designer') {
  employeePickerTarget.value = target
  const selected = target === 'owner' ? owner.value : target === 'manager' ? manager.value : designer.value
  uni.navigateTo({ url: `${P.employeePicker}?selectedId=${encodeURIComponent(selected?.id || '')}&selectedName=${encodeURIComponent(selected?.name || '')}` })
}
function applyEmployeePickerResult() {
  const result = consumeEmployeePickerResult()
  if (!result) return
  const value = result.action === 'clear' ? undefined : result.value
  if (employeePickerTarget.value === 'owner') owner.value = value
  else if (employeePickerTarget.value === 'manager') manager.value = value
  else designer.value = value
}
const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: 'preparing', label: '待开工' }, { value: 'ongoing', label: '施工中' },
  { value: 'suspended', label: '已停工' }, { value: 'accepting', label: '待验收' },
  { value: 'finished', label: '已完工' }, { value: 'settled', label: '已结算' }
]
const COST_STATUSES: { value: CarryoverCostStatus; label: string; description: string }[] = [
  { value: 'complete', label: '已确认完整', description: '已发生成本都能核对，系统可以计算项目利润' },
  { value: 'totalOnly', label: '只知道总额', description: '只掌握总金额，明细未完整，利润暂不计算' },
  { value: 'unknown', label: '暂不确认', description: '接管前成本尚不清楚，先承接，利润暂不计算' }
]
const employeeNames = computed(() => employees.value.map(item => `${item.name}（${item.title || item.role}）`))
const ownerIndex = computed(() => Math.max(0, employees.value.findIndex(item => item.id === owner.value?.id)))
const managerIndex = computed(() => Math.max(0, employees.value.findIndex(item => item.id === manager.value?.id)))
const designerIndex = computed(() => Math.max(0, employees.value.findIndex(item => item.id === designer.value?.id)))
const projectStatusIndex = computed(() => Math.max(0, PROJECT_STATUSES.findIndex(item => item.value === projectStatus.value)))
const projectStatusLabels = PROJECT_STATUSES.map((item) => item.label)
function pickProjectStatus(label: string) {
  const hit = PROJECT_STATUSES.find((item) => item.label === label)
  if (hit) projectStatus.value = hit.value
}
const costStatusIndex = computed(() => Math.max(0, COST_STATUSES.findIndex(item => item.value === costStatus.value)))
const amountNumber = (value: string) => value === '' ? 0 : Number(value)
const contractAmountNumber = computed(() => amountNumber(currentAmount.value) || 0)
const receivableNumber = computed(() => amountNumber(receivableOutstanding.value) || 0)
const payableNumber = computed(() => amountNumber(payableOutstanding.value) || 0)
const costNumber = computed(() => amountNumber(costTotal.value) || 0)
const receivableExceedsContract = computed(() => contractAmountNumber.value > 0 && receivableNumber.value > contractAmountNumber.value)
function acceptZeroReceivable() { receivableOutstanding.value = '0'; receivableConfirmed.value = true }
function acceptZeroPayable() { payableOutstanding.value = '0'; payableConfirmed.value = true }

onLoad(async (query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  if (session.role !== 'boss') { toast('仅企业负责人可以办理业务承接'); setTimeout(() => uni.navigateBack(), 500); return }
  id.value = query?.id || ''
  batchId.value = query?.batchId || ''
  await loadEmployees()
  if (id.value) await load()
})

async function loadEmployees() {
  try { employees.value = await identityApi.employees() } catch { employees.value = [] }
}

async function load() {
  loading('加载项目…')
  try {
    const item = await carryoverApi.info(id.value)
    status.value = item.status
    batchId.value = item.batchId || batchId.value
    customerName.value = item.customerName
    customerPhone.value = item.customerPhone
    community.value = item.community || ''
    address.value = item.address
    area.value = item.area == null ? '' : `${item.area}`
    owner.value = employees.value.find(emp => emp.id === item.owner?.id)
    manager.value = employees.value.find(emp => emp.id === item.manager?.id)
    designer.value = employees.value.find(emp => emp.id === item.designer?.id)
    contractNo.value = item.contractNo
    signedAmount.value = item.signedAmount == null ? '' : `${item.signedAmount}`
    currentAmount.value = item.currentAmount == null ? '' : `${item.currentAmount}`
    signedAt.value = item.signedAt || ''
    startDate.value = item.startDate || ''
    planEndDate.value = item.planEndDate || ''
    projectName.value = item.projectName || ''
    projectStatus.value = item.projectStatus || 'ongoing'
    currentStageName.value = item.currentStageName || ''
    progress.value = item.progress
    remainingWork.value = item.remainingWork || ''
    currentIssue.value = item.currentIssue || ''
    receivableOutstanding.value = item.receivableOutstanding == null ? '' : `${item.receivableOutstanding}`
    receivableDueDate.value = item.receivableDueDate || ''
    receivableSourceNo.value = item.receivableSourceNo || ''
    receivableConfirmed.value = item.receivableConfirmed
    payableOutstanding.value = item.payableOutstanding == null ? '' : `${item.payableOutstanding}`
    payableDueDate.value = item.payableDueDate || ''
    payablePayeeName.value = item.payablePayeeName || ''
    payableSourceNo.value = item.payableSourceNo || ''
    payableConfirmed.value = item.payableConfirmed
    costTotal.value = item.costTotal == null ? '' : `${item.costTotal}`
    costStatus.value = item.costStatus
    costMissingNote.value = item.costMissingNote || ''
    legacyAccountNote.value = item.legacyAccountNote || ''
    legacyId.value = item.legacyId || ''
    legacyProjectNo.value = item.legacyProjectNo || ''
    attachments.value = await carryoverApi.attachmentPage(id.value)
    adjustments.value = await carryoverApi.adjustmentPage(id.value)
  } catch (error) {
    toastError(error, '项目加载失败')
  } finally {
    hideLoading()
  }
}

function payload(): CarryoverProjectInput {
  return {
    itemId: id.value || undefined,
    batchId: batchId.value || undefined,
    customerName: customerName.value.trim(),
    customerPhone: customerPhone.value.trim(),
    community: community.value.trim(),
    address: address.value.trim(),
    area: area.value ? Number(area.value) : undefined,
    ownerId: owner.value?.id,
    managerId: manager.value?.id,
    designerId: designer.value?.id,
    contractNo: contractNo.value.trim(),
    signedAmount: signedAmount.value ? Number(signedAmount.value) : undefined,
    currentAmount: currentAmount.value ? Number(currentAmount.value) : undefined,
    signedAt: signedAt.value || undefined,
    startDate: startDate.value || undefined,
    planEndDate: planEndDate.value || undefined,
    projectName: projectName.value.trim() || undefined,
    projectStatus: projectStatus.value,
    currentStageName: currentStageName.value.trim(),
    progress: progress.value,
    remainingWork: remainingWork.value.trim(),
    currentIssue: currentIssue.value.trim() || undefined,
    receivableOutstanding: receivableConfirmed.value && receivableOutstanding.value !== '' ? Number(receivableOutstanding.value) : undefined,
    receivableDueDate: receivableDueDate.value || undefined,
    receivableSourceNo: receivableSourceNo.value.trim() || undefined,
    receivableConfirmed: receivableConfirmed.value,
    payableOutstanding: payableConfirmed.value && payableOutstanding.value !== '' ? Number(payableOutstanding.value) : undefined,
    payableDueDate: payableDueDate.value || undefined,
    payablePayeeName: payablePayeeName.value.trim() || undefined,
    payableSourceNo: payableSourceNo.value.trim() || undefined,
    payableConfirmed: payableConfirmed.value,
    costTotal: costTotal.value ? Number(costTotal.value) : undefined,
    costStatus: costStatus.value,
    costMissingNote: costMissingNote.value.trim() || undefined,
    legacyId: legacyId.value.trim() || undefined,
    legacyProjectNo: legacyProjectNo.value.trim() || undefined,
    legacyAccountNote: legacyAccountNote.value.trim() || undefined
  }
}

function validateBasics() {
  if (!customerName.value.trim()) return '请填写客户姓名'
  if (!/^1\d{10}$/.test(customerPhone.value.trim())) return '请填写正确客户手机号'
  if (!address.value.trim()) return '请填写房屋地址'
  if (!owner.value) return '请选择经营负责人'
  if (!manager.value) return '请选择项目经理'
  if (!contractNo.value.trim()) return '请填写合同编号'
  if (!currentAmount.value || Number(currentAmount.value) <= 0) return '请填写当前合同金额'
  if (!signedAt.value) return '请选择签约日期'
  if (!currentStageName.value.trim()) return '请填写当前施工阶段'
  if (!remainingWork.value.trim()) return '请填写剩余工作摘要'
  if (!receivableConfirmed.value || receivableOutstanding.value === '') return '请确认当前未收金额，无余额请填写 0'
  if (!payableConfirmed.value || payableOutstanding.value === '') return '请确认当前未付金额，无余额请填写 0'
  if (costStatus.value !== 'unknown' && !costTotal.value) return '请填写接管前成本总额'
  return ''
}

function openPaymentPlan() {
  if (!id.value) { toast('请先保存项目草稿'); return }
  uni.navigateTo({ url: `${P.carryoverPaymentPlan}?itemId=${id.value}` })
}

async function chooseAttachment() {
  if (!id.value) { toast('请先保存项目草稿'); return }
  let paths: string[] = []
  try { paths = await chooseImages({ count: 9 }) } catch (error) {
    toast(error instanceof Error ? error.message : '照片选择失败，请重试')
    return
  }
  if (!paths.length) return
  loading('上传附件…')
  try {
    for (const path of paths) {
      const uploaded = await fileApi.upload('Carryover', path)
      const category: CarryoverAttachmentCategory = 'other'
      attachments.value.push(await carryoverApi.attachmentSave({
        itemId: id.value,
        category,
        fileUrl: uploaded.path,
        originalName: uploaded.name || '承接附件'
      }))
    }
    toast('附件已上传', 'success')
  } catch (error) {
    toastError(error, '附件上传失败')
  } finally {
    hideLoading()
  }
}

async function removeAttachment(item: CarryoverAttachment) {
  try {
    await carryoverApi.attachmentDelete(item.id)
    attachments.value = attachments.value.filter(current => current.id !== item.id)
    toast('附件已删除', 'success')
  } catch (error) {
    toastError(error, '附件删除失败')
  }
}

async function withdraw() {
  if (!id.value) return
  const result = await confirmDanger('撤回承接项目', '撤回后项目不会生成正式工地，确认撤回？', '确认撤回')
  if (!result) return
  try {
    status.value = (await carryoverApi.cancel(id.value, '用户撤回未提交承接项目')).status
    toast('已撤回', 'success')
    setTimeout(() => uni.navigateBack(), 400)
  } catch (error) {
    toastError(error, '撤回失败')
  }
}

async function adjust() {
  if (!id.value) return
  if (!adjustmentReason.value.trim()) { toast('请填写调整原因'); return }
  if (!adjustmentAmount.value) { toast('请填写调整后金额'); return }
  try {
    const saved = await carryoverApi.adjustmentSave({
      itemId: id.value,
      type: adjustmentType.value,
      afterAmount: Number(adjustmentAmount.value),
      reason: adjustmentReason.value.trim()
    })
    adjustments.value.unshift(saved)
    adjustmentAmount.value = ''
    adjustmentReason.value = ''
    toast('调整已记录', 'success')
  } catch (error) {
    toastError(error, '调整失败')
  }
}

async function saveDraft(showToast = true) {
  const error = validateBasics()
  if (error) { toast(error); return undefined }
  saving.value = true
  try {
    const saved = await carryoverApi.save(payload())
    id.value = saved.id || id.value
    batchId.value = saved.batchId || batchId.value
    if (showToast) toast('草稿已保存', 'success')
    return saved
  } catch (error) {
    toastError(error, '保存失败')
    return undefined
  } finally {
    saving.value = false
  }
}

async function confirmFinancialFacts() {
  const content = [
    `当前合同金额：${contractAmountNumber.value} 元`,
    `客户未收工程款：${receivableNumber.value} 元`,
    `当前未付款：${payableNumber.value} 元`,
    `接管前已发生成本：${costTotal.value || '未填写'} 元`,
    `成本状态：${COST_STATUSES[costStatusIndex.value].label}`,
    '',
    '请确认以上是接管日尚未结清的余额和已发生成本，不是历史累计收款、历史累计付款或未来预算。'
  ].join('\n')
  return confirm('提交前核对财务数据', content, '确认无误')
}

async function submitCarryover() {
  const error = validateBasics()
  if (error) { toast(error); return }
  if (!(await confirmFinancialFacts())) return
  const item = await saveDraft(false)
  if (!item?.id) return
  loading('正在确认并承接…')
  try {
    await carryoverApi.confirm(item.id, 'boss', '企业负责人确认项目范围')
    await carryoverApi.confirm(item.id, 'finance', 'BOSS代财务确认期初余额与成本状态')
    await carryoverApi.confirm(item.id, 'pm', 'BOSS代项目经理确认当前工地')
    await carryoverApi.build(item.id)
    toast('项目已承接，可进入工地和财务继续经营', 'success')
    setTimeout(() => uni.navigateBack(), 500)
  } catch (error) {
    toastError(error, '承接失败，请检查待补齐事项')
  } finally {
    hideLoading()
  }
}
</script>

<template>
  <view class="co-edit">
    <JzPageHeader back title="承接在建项目" subtitle="录入当前仍需继续管理的事实，不重建历史过程" />
    <view class="co-edit__notice jz-card">历史已结清流水不需要录入；只填写当前未收、未付和已经发生的成本。成本完整性未确认时不会计算利润。</view>

    <view class="co-edit__section jz-card">
      <text class="co-edit__title">1. 客户与房屋</text>
      <view class="co-edit__row"><text>客户姓名 *</text><input v-model="customerName" maxlength="32" placeholder="请输入" /></view>
      <view class="co-edit__row"><text>手机号 *</text><input v-model="customerPhone" type="number" maxlength="11" placeholder="11 位手机号" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" /></view>
      <view class="co-edit__row"><text>小区</text><input v-model="community" maxlength="128" placeholder="选填" /></view>
      <view class="co-edit__row"><text>房屋地址 *</text><input v-model="address" maxlength="256" placeholder="完整地址" /></view>
      <view class="co-edit__row"><text>面积㎡</text><input v-model="area" type="digit" placeholder="选填" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" /></view>
      <view class="co-edit__row" @tap="openEmployeePicker('owner')"><text>经营负责人 *</text><view class="co-edit__picker">{{ owner?.name || '选择经营负责人' }}<JzIcon name="chevron-right" :size="24" color="#94A3B8" /></view></view>
      <view class="co-edit__row" @tap="openEmployeePicker('manager')"><text>项目经理 *</text><view class="co-edit__picker">{{ manager?.name || '选择项目经理' }}<JzIcon name="chevron-right" :size="24" color="#94A3B8" /></view></view>
      <view class="co-edit__row" @tap="openEmployeePicker('designer')"><text>设计师</text><view class="co-edit__picker">{{ designer?.name || '选择设计师（选填）' }}<JzIcon name="chevron-right" :size="24" color="#94A3B8" /></view></view>
    </view>

    <view class="co-edit__section jz-card">
      <text class="co-edit__title">2. 报价与合同基线</text>
      <view class="co-edit__row"><text>合同编号 *</text><input v-model="contractNo" maxlength="64" placeholder="原合同编号" /></view>
      <view class="co-edit__row"><text>原签约金额</text><input v-model="signedAmount" type="digit" placeholder="选填" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" /></view>
      <view class="co-edit__row"><text>当前金额 *</text><input v-model="currentAmount" type="digit" placeholder="含有效变更" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" /></view>
      <view class="co-edit__row"><text>签约日期 *</text><JzSelectField mode="date" variant="boxed" :value="signedAt" :display="signedAt" placeholder="请选择" @change="signedAt = $event" /></view>
    </view>

    <view class="co-edit__section jz-card">
      <text class="co-edit__title">3. 当前工地</text>
      <view class="co-edit__row"><text>项目名称</text><input v-model="projectName" maxlength="128" placeholder="默认客户 + 地址" /></view>
      <view class="co-edit__row"><text>项目状态 *</text><JzSelectField variant="boxed" :display="PROJECT_STATUSES[projectStatusIndex].label" :range="projectStatusLabels" :index="projectStatusIndex" @change="pickProjectStatus" /></view>
      <view class="co-edit__row"><text>当前阶段 *</text><input v-model="currentStageName" maxlength="128" placeholder="例：泥木阶段" /></view>
      <view class="co-edit__progress"><text>当前进度 {{ progress }}%</text><slider :value="progress" min="0" max="100" activeColor="#16A394" @changing="onProgressChange" @change="onProgressChange" /></view>
      <view class="co-edit__row co-edit__row--col"><text>剩余工作摘要 *</text><textarea v-model="remainingWork" maxlength="1000" placeholder="当前还需要完成哪些施工、材料、验收事项" /></view>
      <view class="co-edit__row co-edit__row--col"><text>当前问题</text><textarea v-model="currentIssue" maxlength="1000" placeholder="选填：风险、待协调事项" /></view>
    </view>

    <view class="co-edit__section jz-card">
      <view class="co-edit__finance-head">
        <text class="co-edit__title co-edit__title--inline">4. 期初财务与接管前成本</text>
        <view class="co-edit__help-toggle" @tap="financialHelpVisible = !financialHelpVisible">
          <JzIcon name="info" :size="26" color="#16A394" />
          <text>{{ financialHelpVisible ? '收起说明' : '财务名词说明' }}</text>
        </view>
      </view>
      <view class="co-edit__finance-intro">
        这里只填写<text>接管日仍未结清</text>和<text>已经发生</text>的金额。已经收过、已经付过的历史流水不要重复填写。
      </view>
      <view v-if="financialHelpVisible" class="co-edit__finance-help">
        <text class="co-edit__help-item"><text>客户未收工程款：</text>应收未收、尾款、客户欠款、工程款未收，都是同一件事。填写“总额减已收”。</text>
        <text class="co-edit__help-item"><text>当前未付款：</text>应付未付、供应商欠款、工人工资待付、项目款待付。填写“应付总额减已付”。</text>
        <text class="co-edit__help-item"><text>接管前已发生成本：</text>项目至今已经产生的材料、人工、项目及其他成本，包含已付和未付，不等于下面的未付款。</text>
        <text class="co-edit__help-item"><text>举例：</text>合同30万，客户已收18万，则客户未收填12万；供应商应付10万、已付4万，则当前未付填6万。</text>
      </view>

      <view class="co-edit__finance-summary">
        <view><text>当前合同</text><text>{{ currentAmount ? `${currentAmount} 元` : '待填写' }}</text></view>
        <view><text>客户未收</text><text>{{ receivableOutstanding || '待填写' }} 元</text></view>
        <view><text>当前未付</text><text>{{ payableOutstanding || '待填写' }} 元</text></view>
        <view><text>接管前成本</text><text>{{ costTotal || '待填写' }} 元</text></view>
      </view>

      <view class="co-edit__finance-block">
        <view class="co-edit__block-head">
          <view><text class="co-edit__block-title">客户未收工程款</text><text class="co-edit__block-sub">= 应收账款总额 - 已收款合计</text></view>
          <view class="co-edit__quick" @tap="acceptZeroReceivable">无未收款</view>
        </view>
        <view class="co-edit__row"><text>客户未收工程款 *</text><input v-model="receivableOutstanding" type="digit" placeholder="合同30万、已收18万，这里填12万" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" /></view>
        <view v-if="receivableExceedsContract" class="co-edit__field-warning">未收金额超过当前合同金额，请检查是否将累计已收填成了未收余额。</view>
        <view class="co-edit__row"><text>约定收款日</text><JzSelectField mode="date" variant="boxed" :value="receivableDueDate" :display="receivableDueDate" placeholder="选填" @change="receivableDueDate = $event" /></view>
        <view class="co-edit__row"><text>原应收单号</text><input v-model="receivableSourceNo" maxlength="64" placeholder="选填，便于对账追溯" /></view>
        <view class="co-edit__switch co-edit__switch--check"><view><text>我已核对客户未收工程款</text><text class="co-edit__switch-note">无未收款也必须点击左侧“无未收款”或填写 0 并确认</text></view><switch :checked="receivableConfirmed" color="#16A394" @change="onReceivableConfirmedChange" /></view>
      </view>

      <view class="co-edit__finance-block">
        <view class="co-edit__block-head">
          <view><text class="co-edit__block-title">当前未付款</text><text class="co-edit__block-sub">= 应付总额 - 已付款合计</text></view>
          <view class="co-edit__quick" @tap="acceptZeroPayable">无未付款</view>
        </view>
        <view class="co-edit__row"><text>当前未付款 *</text><input v-model="payableOutstanding" type="digit" placeholder="应付10万、已付4万，这里填6万" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" /></view>
        <view class="co-edit__row"><text>约定付款日</text><JzSelectField mode="date" variant="boxed" :value="payableDueDate" :display="payableDueDate" placeholder="选填" @change="payableDueDate = $event" /></view>
        <view class="co-edit__row"><text>收款方</text><input v-model="payablePayeeName" maxlength="128" placeholder="供应商、工人或项目班组" /></view>
        <view class="co-edit__row"><text>原应付单号</text><input v-model="payableSourceNo" maxlength="64" placeholder="选填，便于对账追溯" /></view>
        <view class="co-edit__switch co-edit__switch--check"><view><text>我已核对当前未付款</text><text class="co-edit__switch-note">无未付款也必须点击左侧“无未付款”或填写 0 并确认</text></view><switch :checked="payableConfirmed" color="#16A394" @change="onPayableConfirmedChange" /></view>
      </view>

      <view class="co-edit__finance-block">
        <text class="co-edit__block-title">接管前已发生成本</text>
        <text class="co-edit__block-sub">包含已付与未付，不是上面的未付款，也不包含未来预算。</text>
        <view class="co-edit__row"><text>已发生成本总额</text><input v-model="costTotal" type="digit" placeholder="只知总额也可填写，未知可留空" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" /></view>
        <view class="co-edit__cost-options">
          <view v-for="option in COST_STATUSES" :key="option.value" class="co-edit__cost-option" :class="{ 'co-edit__cost-option--on': costStatus === option.value }" @tap="costStatus = option.value">
            <view class="co-edit__cost-radio" />
            <view class="jz-grow"><text class="co-edit__cost-label">{{ option.label }}</text><text class="co-edit__cost-desc">{{ option.description }}</text></view>
          </view>
        </view>
        <view class="co-edit__row co-edit__row--col"><text>成本缺失说明</text><textarea v-model="costMissingNote" maxlength="500" placeholder="例如：历史人工成本只有总额，材料明细缺失" /></view>
      </view>
    </view>

    <view v-if="id" class="co-edit__finance-link jz-card" @tap="openPaymentPlan">
      <view class="jz-grow">
        <text class="co-edit__finance-link-title">剩余收付款计划</text>
        <text class="co-edit__finance-link-desc">把期初应收/应付拆成未来时间计划；合计不得超过期初余额</text>
      </view>
      <text class="co-edit__finance-link-action">去制定</text>
    </view>

    <view class="co-edit__section jz-card">
      <text class="co-edit__title">5. 来源追溯</text>
      <view class="co-edit__row"><text>原系统项目号</text><input v-model="legacyProjectNo" maxlength="64" placeholder="选填" /></view>
      <view class="co-edit__row"><text>原系统 ID</text><input v-model="legacyId" maxlength="128" placeholder="选填" /></view>
      <view class="co-edit__row co-edit__row--col"><text>原账口径备注</text><textarea v-model="legacyAccountNote" maxlength="1000" placeholder="例如：应收对应原账“应收账款-工程款”，应付对应“应付账款-材料商A”；不影响金额计算" /></view>
    </view>

    <view v-if="id" class="co-edit__section jz-card">
      <text class="co-edit__title">附件资料</text>
      <view class="co-edit__attachments">
        <view v-for="item in attachments" :key="item.id" class="co-edit__attachment">
          <JzIcon name="file-text" :size="30" color="#16A394" />
          <text class="jz-grow">{{ item.originalName || item.category }}</text>
          <text v-if="status === 'draft' || status === 'ready' || status === 'confirmed'" class="co-edit__attachment-del" @tap="removeAttachment(item)">删除</text>
        </view>
        <view v-if="!attachments.length" class="co-edit__empty">暂未上传合同、报价或现场资料</view>
      </view>
      <button class="jz-btn jz-btn--ghost jz-btn--block co-edit__upload" @tap="chooseAttachment">上传图片或资料</button>
    </view>

    <view v-if="id && status === 'locked'" class="co-edit__section jz-card">
      <text class="co-edit__title">锁定后调整</text>
      <view class="co-edit__row"><text>调整类型</text><JzSelectField variant="boxed" :display="ADJUSTMENT_TYPES[adjustmentTypeIndex].label" :range="adjustmentTypeLabels" :index="adjustmentTypeIndex" @change="pickAdjustmentType" /></view>
      <view class="co-edit__row"><text>调整后金额 *</text><input v-model="adjustmentAmount" type="digit" placeholder="请输入" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" /></view>
      <view class="co-edit__row co-edit__row--col"><text>调整原因 *</text><textarea v-model="adjustmentReason" maxlength="500" placeholder="说明调整依据" /></view>
      <button class="jz-btn jz-btn--primary jz-btn--block co-edit__upload" @tap="adjust">记录调整</button>
      <view v-if="adjustments.length" class="co-edit__history">
        <text class="co-edit__history-title">调整记录</text>
        <view v-for="item in adjustments" :key="item.id" class="co-edit__history-item">
          <view class="jz-between"><text>{{ item.type }}</text><text>{{ item.deltaAmount }}</text></view>
          <text>{{ item.reason }}</text>
        </view>
      </view>
    </view>

    <view v-if="id && (status === 'draft' || status === 'ready' || status === 'confirmed')" class="co-edit__section jz-card">
      <text class="co-edit__title">撤回承接</text>
      <text class="co-edit__empty">撤回后不会生成正式工地，可修改后重新提交。已承接项目不能在这里撤回。</text>
      <button class="jz-btn jz-btn--ghost jz-btn--block co-edit__upload" @tap="withdraw">撤回当前项目</button>
    </view>

    <view class="jz-actionbar">
      <view class="jz-actionbar__inner co-edit__actions">
        <button v-if="status === 'draft' || status === 'ready' || status === 'confirmed'" class="jz-btn jz-btn--ghost jz-grow" :loading="saving" @tap="saveDraft()">保存草稿</button>
        <button v-if="status === 'draft' || status === 'ready' || status === 'confirmed'" class="jz-btn jz-btn--primary jz-grow" :loading="saving" @tap="submitCarryover">提交承接</button>
        <button v-else class="jz-btn jz-btn--primary jz-grow" disabled>{{ status === 'locked' ? '项目已续营，仅可调整' : '项目已承接' }}</button>
      </view>
    </view>
  </view>
    <JzConfirmDialog />
</template>

<style lang="scss" scoped>
.co-edit { min-height: 100vh; padding-bottom: 180rpx; background: $jzb-bg-page; }
.co-edit__notice { margin: 24rpx 28rpx; padding: 22rpx 24rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.65; }
.co-edit__section { margin: 0 28rpx 22rpx; padding: 0 26rpx; }
.co-edit__title { display: block; padding: 26rpx 0 10rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 720; }
.co-edit__row { display: flex; align-items: center; min-height: 94rpx; border-bottom: 1rpx solid $jzb-border-light; }
.co-edit__row > text { width: 220rpx; color: $jzb-text-2; font-size: $jzb-font-sm; flex-shrink: 0; }
.co-edit__row input, .co-edit__row picker { flex: 1; min-width: 0; }
.co-edit__row input { text-align: right; color: $jzb-text-1; }
.co-edit__row--col { flex-direction: column; align-items: stretch; padding: 20rpx 0; }
.co-edit__row--col > text { width: auto; }
.co-edit__row textarea { width: 100%; height: 150rpx; margin-top: 14rpx; padding: 16rpx 18rpx; box-sizing: border-box; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; font-size: $jzb-font; }
.co-edit__picker { display: flex; align-items: center; justify-content: flex-end; gap: 8rpx; color: $jzb-text-1; font-size: $jzb-font; }
.co-edit__progress { padding: 20rpx 0; border-bottom: 1rpx solid $jzb-border-light; color: $jzb-text-2; font-size: $jzb-font-sm; }
.co-edit__switch { display: flex; align-items: center; justify-content: space-between; min-height: 94rpx; border-bottom: 1rpx solid $jzb-border-light; color: $jzb-text-2; font-size: $jzb-font-sm; }
.co-edit__actions { display: flex; gap: 18rpx; }
.co-edit__finance-head { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; padding: 26rpx 0 10rpx; }
.co-edit__title--inline { padding: 0; }
.co-edit__help-toggle { display: flex; align-items: center; gap: 6rpx; color: $jzb-primary-dark; font-size: 22rpx; }
.co-edit__finance-intro { margin: 12rpx 0 20rpx; padding: 20rpx 22rpx; color: $jzb-text-2; background: $jzb-primary-lightest; border-radius: $jzb-radius-sm; font-size: $jzb-font-xs; line-height: 1.65; }
.co-edit__finance-intro text { color: $jzb-primary-dark; font-weight: 650; }
.co-edit__finance-help { margin-bottom: 20rpx; padding: 18rpx 20rpx; border: 1rpx dashed rgba(22,163,148,.28); border-radius: $jzb-radius-sm; background: #FAFDFC; }
.co-edit__help-item { display: block; margin-bottom: 12rpx; color: $jzb-text-3; font-size: 22rpx; line-height: 1.6; }
.co-edit__help-item:last-child { margin-bottom: 0; }
.co-edit__help-item text { color: $jzb-text-1; font-weight: 650; }
.co-edit__finance-summary { display: grid; grid-template-columns: 1fr 1fr; gap: 14rpx; margin-bottom: 22rpx; }
.co-edit__finance-summary > view { min-width: 0; padding: 18rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; }
.co-edit__finance-summary text:first-child { display: block; color: $jzb-text-3; font-size: 20rpx; }
.co-edit__finance-summary text:last-child { display: block; margin-top: 8rpx; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.co-edit__finance-block { margin-top: 24rpx; padding-top: 20rpx; border-top: 1rpx solid $jzb-border-light; }
.co-edit__finance-block:first-of-type { margin-top: 0; }
.co-edit__block-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; }
.co-edit__block-title { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.co-edit__block-sub { display: block; margin-top: 6rpx; color: $jzb-text-4; font-size: 20rpx; line-height: 1.45; }
.co-edit__quick { flex-shrink: 0; padding: 10rpx 16rpx; color: $jzb-primary-dark; background: $jzb-primary-lightest; border-radius: $jzb-radius-pill; font-size: 20rpx; }
.co-edit__field-warning { margin: 4rpx 0 14rpx; padding: 14rpx 16rpx; color: $jzb-danger; background: $jzb-danger-soft; border-radius: $jzb-radius-sm; font-size: 21rpx; line-height: 1.5; }
.co-edit__switch--check { align-items: flex-start; padding: 18rpx 0; }
.co-edit__switch--check > view { flex: 1; min-width: 0; }
.co-edit__switch-note { display: block; margin-top: 6rpx; color: $jzb-text-4; font-size: 20rpx; line-height: 1.45; }
.co-edit__cost-options { margin: 16rpx 0 4rpx; }
.co-edit__cost-option { display: flex; align-items: flex-start; gap: 14rpx; padding: 18rpx; margin-bottom: 12rpx; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; background: $jzb-text-inverse; }
.co-edit__cost-option--on { border-color: rgba(22,163,148,.55); background: $jzb-primary-lightest; }
.co-edit__cost-radio { width: 28rpx; height: 28rpx; margin-top: 4rpx; border: 2rpx solid $jzb-border-light; border-radius: 50%; flex-shrink: 0; }
.co-edit__cost-option--on .co-edit__cost-radio { border: 8rpx solid $jzb-primary; }
.co-edit__cost-label { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.co-edit__cost-desc { display: block; margin-top: 5rpx; color: $jzb-text-3; font-size: 20rpx; line-height: 1.5; }

.co-edit__finance-link { display: flex; align-items: center; margin: 0 0 18rpx; padding: 22rpx; }
.co-edit__finance-link-title { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.co-edit__finance-link-desc { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.co-edit__finance-link-action { flex: none; color: $jzb-primary-deep; font-size: $jzb-font-xs; font-weight: 700; }
</style>
