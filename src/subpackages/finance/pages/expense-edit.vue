<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { expenseApi } from '@/domains/expense/api'
import {
  EXPENSE_DOCUMENT_TYPES,
  EXPENSE_DOCUMENT_TYPE_META,
  EXPENSE_PAYMENT_MODE_META,
  expensePaymentModeLabel
} from '@/domains/expense/meta'
import type {
  Expense,
  ExpenseAttachment,
  ExpenseAttachmentInput,
  ExpenseCategory,
  ExpenseDocumentType,
  ExpensePaymentMode
} from '@/domains/expense/model'
import { chooseImages } from '@/domains/file/choose-media'
import { fileApi } from '@/domains/file/api'
import type { Employee } from '@/domains/identity/model'
import { isLoggedIn, session } from '@/domains/identity/session'
import { consumeEmployeePickerResult } from '@/domains/identity/employee-picker'
import {
  consumeFinanceProjectPickerResult,
  type FinanceProjectSelection
} from '@/domains/finance/project-picker'
import { consumeExpenseCategoryPickerResult } from '@/domains/finance/expense-category-picker'
import { can } from '@/roles/permission'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'
import JzMoneyInput from '@/components/JzMoneyInput/JzMoneyInput.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

type Assignment = 'company' | 'project'
type StoreAssignment = 'current' | 'unassigned'

const MAX_ATTACHMENTS = 9
const today = () => {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const expenseId = ref('')
const pendingCreatedId = ref('')
const idempotencyKey = ref(`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`)
const booting = ref(true)
const loadError = ref('')
const selectedCategory = ref<ExpenseCategory | null>(null)
const categoryPickerOpen = ref(false)
const selectedProject = ref<FinanceProjectSelection | null>(null)
const owner = ref<Employee | null>(session.emp)
const attachments = ref<ExpenseAttachment[]>([])
const uploading = ref(false)
const saving = ref(false)
const saveNotice = ref('')
const nextUploadType = ref<ExpenseDocumentType>('Invoice')

const form = reactive({
  paymentMode: 'Direct' as Exclude<ExpensePaymentMode, 'Unknown'>,
  amount: '',
  expenseDate: today(),
  description: '',
  categoryId: '',
  assignment: 'company' as Assignment,
  storeAssignment: 'current' as StoreAssignment
})

const canProxyEmployee = computed(() => session.role === 'boss' || session.role === 'storeManager')
const canChooseUnassignedStore = computed(() => session.role === 'boss'
  || (session.role === 'finance' && session.emp?.store?.defaultStore === true))
const paymentOptions = Object.entries(EXPENSE_PAYMENT_MODE_META).map(([value, meta]) => ({
  value: value as Exclude<ExpensePaymentMode, 'Unknown'>,
  label: meta.label,
  hint: meta.hint
}))
const documentTypeLabels = EXPENSE_DOCUMENT_TYPES.map((item) => item.label)
const documentTypeIndex = computed(() => Math.max(0, EXPENSE_DOCUMENT_TYPES.findIndex((item) => item.value === nextUploadType.value)))
const selectedDocumentTypeLabel = computed(() => EXPENSE_DOCUMENT_TYPE_META[nextUploadType.value])
const ownerLabel = computed(() => owner.value?.name || session.emp?.name || '本人')
const projectLabel = computed(() => selectedProject.value?.name || '选择项目')
const attachmentCountText = computed(() => `${attachments.value.length}/${MAX_ATTACHMENTS}`)
const storeOptions = computed(() => [
  { value: 'current' as const, label: `当前门店（${session.emp?.store?.name || '登录员工门店'}）` },
  { value: 'unassigned' as const, label: '未归属门店（仅企业负责人/总部财务）' }
])
const storeLabels = computed(() => storeOptions.value.map((item) => item.label))
const storeIndex = computed(() => Math.max(0, storeOptions.value.findIndex((item) => item.value === form.storeAssignment)))
const selectedStoreLabel = computed(() => storeOptions.value.find((item) => item.value === form.storeAssignment)?.label || '')

onLoad((query) => {
  if (!isLoggedIn()) {
    uni.reLaunch({ url: P.login })
    return
  }
  if (!can(session.role, 'edit:expense')) {
    toast('当前账号无权新建或修改费用')
    setTimeout(() => uni.navigateBack(), 600)
    return
  }
  expenseId.value = query?.expenseId || ''
  void boot()
})

onShow(() => {
  applyPickerResults()
})

async function boot() {
  booting.value = true
  loadError.value = ''
  try {
    if (expenseId.value) await loadExpense()
  } finally {
    booting.value = false
  }
}

async function loadExpense() {
  try {
    const item = await expenseApi.info(expenseId.value)
    if (item.status !== 'Draft' && item.status !== 'Returned') {
      loadError.value = '当前费用状态不能编辑，请返回详情查看'
      return
    }
    if (!item.allowedActions.includes('edit')) {
      loadError.value = '当前账号无权修改该费用'
      return
    }
    applyExpense(item)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '费用详情暂不可确认'
  }
}

function applyExpense(item: Expense) {
  form.paymentMode = item.paymentMode === 'Reimbursement' ? 'Reimbursement' : 'Direct'
  form.amount = item.amount ? Number(item.amount).toFixed(2) : ''
  form.expenseDate = item.expenseDate || today()
  form.description = item.description || ''
  form.categoryId = item.category?.categoryId || ''
  selectedCategory.value = item.category || null
  form.assignment = item.project ? 'project' : 'company'
  form.storeAssignment = canChooseUnassignedStore.value && !item.store ? 'unassigned' : 'current'
  selectedProject.value = item.project ? {
    id: item.project.id,
    name: item.project.name,
    no: item.project.no
  } : null
  owner.value = employeeFromExpense(item.owner) || session.emp || null
  attachments.value = item.attachments.map((attachment) => ({ ...attachment }))
  void grantExistingAttachmentUrls(item.expenseId)
}

async function grantExistingAttachmentUrls(id: string) {
  if (!attachments.value.length) return
  try {
    const urls = await fileApi.grant('Expense', id, attachments.value.map((item) => item.fileUrl))
    attachments.value = attachments.value.map((item, index) => ({
      ...item,
      previewUrl: urls[index] || fileApi.absolute(item.fileUrl)
    }))
  } catch {
    attachments.value = attachments.value.map((item) => ({
      ...item,
      previewUrl: fileApi.absolute(item.fileUrl)
    }))
  }
}

function employeeFromExpense(value?: Expense['owner']): Employee | null {
  if (!value) return null
  return {
    id: value.id,
    name: value.name,
    phone: '',
    role: value.role || (session.role && session.role !== 'customer' ? session.role : 'pm'),
    status: 'active'
  }
}

function applyPickerResults() {
  const categoryResult = categoryPickerOpen.value ? consumeExpenseCategoryPickerResult() : null
  categoryPickerOpen.value = false
  if (categoryResult) {
    selectedCategory.value = categoryResult.action === 'clear' ? null : categoryResult.value
    form.categoryId = categoryResult.action === 'clear' ? '' : categoryResult.value.categoryId
  }
  const projectResult = consumeFinanceProjectPickerResult()
  if (projectResult) {
    if (projectResult.action === 'clear') setCompanyAssignment()
    else {
      selectedProject.value = projectResult.value
      form.assignment = 'project'
    }
  }

  const employeeResult = consumeEmployeePickerResult()
  if (employeeResult && canProxyEmployee.value) {
    if (employeeResult.action === 'clear') {
      owner.value = session.emp || null
    } else {
      owner.value = employeeResult.value
    }
  }
}

function selectPayment(value: Exclude<ExpensePaymentMode, 'Unknown'>) {
  form.paymentMode = value
}

function pickExpenseDate(value: string) {
  form.expenseDate = value
}

function pickNextDocumentType(label: string) {
  const hit = EXPENSE_DOCUMENT_TYPES.find((item) => item.label === label)
  if (hit) nextUploadType.value = hit.value
}

function pickStore(label: string) {
  const hit = storeOptions.value.find((item) => item.label === label)
  if (hit) form.storeAssignment = hit.value
}

function setCompanyAssignment() {
  form.assignment = 'company'
  selectedProject.value = null
}

function selectProjectAssignment() {
  form.assignment = 'project'
  openProjectPicker()
}

function openCategoryPicker() {
  categoryPickerOpen.value = true
  const category = selectedCategory.value
  const params = [
    `selectedId=${encodeURIComponent(category?.categoryId || '')}`,
    `selectedName=${encodeURIComponent(category?.name || '')}`,
    `selectedMeta=${encodeURIComponent(category?.description || '')}`
  ]
  uni.navigateTo({ url: `${P.expenseCategoryPicker}?${params.join('&')}` })
}

function openProjectPicker() {
  const params: string[] = []
  if (selectedProject.value) {
    params.push(`selectedId=${encodeURIComponent(selectedProject.value.id)}`)
    params.push(`selectedName=${encodeURIComponent(selectedProject.value.name)}`)
    if (selectedProject.value.no) params.push(`selectedNo=${encodeURIComponent(selectedProject.value.no)}`)
  }
  uni.navigateTo({ url: `${P.financeProjectPicker}${params.length ? `?${params.join('&')}` : ''}` })
}

function openEmployeePicker() {
  if (!canProxyEmployee.value) return
  const params: string[] = []
  if (owner.value?.id) params.push(`selectedId=${encodeURIComponent(owner.value.id)}`)
  if (owner.value?.name) params.push(`selectedName=${encodeURIComponent(owner.value.name)}`)
  uni.navigateTo({ url: `${P.employeePicker}${params.length ? `?${params.join('&')}` : ''}` })
}

async function chooseAttachments() {
  const remain = MAX_ATTACHMENTS - attachments.value.length
  if (remain <= 0) {
    toast(`最多上传 ${MAX_ATTACHMENTS} 份证据`)
    return
  }
  let paths: string[] = []
  try {
    paths = await chooseImages({
      count: remain,
      sourceType: ['camera', 'album'],
      sizeType: ['compressed']
    })
  } catch (error) {
    toastError(error, '照片选择失败，请重试')
    return
  }
  if (!paths.length) return

  uploading.value = true
  loading('上传费用证据…')
  try {
    for (const path of paths) {
      const uploaded = await fileApi.upload('Expense', path, {
        projectId: form.assignment === 'project' ? selectedProject.value?.id : undefined
      })
      const fallbackName = `费用证据-${attachments.value.length + 1}`
      attachments.value.push({
        documentType: nextUploadType.value,
        fileUrl: uploaded.path,
        fileName: uploaded.name || fallbackName,
        size: uploaded.size || 0,
        previewUrl: uploaded.url
      })
    }
    toast('证据已上传', 'success')
  } catch (error) {
    toastError(error, '费用证据上传失败')
  } finally {
    uploading.value = false
    hideLoading()
  }
}

function removeAttachment(index: number) {
  attachments.value.splice(index, 1)
}

function previewAttachment(index: number) {
  const urls = attachments.value.map((item) => item.previewUrl || fileApi.absolute(item.fileUrl)).filter(Boolean)
  if (!urls.length) return
  uni.previewImage({ current: urls[index], urls })
}

function attachmentInputs(): ExpenseAttachmentInput[] {
  return attachments.value.map((item) => ({
    documentType: item.documentType,
    fileUrl: item.fileUrl,
    fileName: item.fileName,
    size: item.size || 0,
    sha256: item.sha256
  }))
}

function validate() {
  if (!form.categoryId) return '请选择费用分类'
  if (!form.amount || Number(form.amount) <= 0) return '请输入大于 0 的费用金额'
  if (!form.expenseDate) return '请选择费用发生日期'
  if (!form.description.trim()) return '请填写费用说明'
  if (form.assignment === 'project' && !selectedProject.value?.id) return '请选择项目，或切换为企业费用'
  if (form.paymentMode === 'Reimbursement' && !owner.value?.id) return '请选择报销归属员工'
  return ''
}

function payload() {
  const ownerId = canProxyEmployee.value ? owner.value?.id : undefined
  const payeeEmployeeId = form.paymentMode === 'Reimbursement' ? ownerId : undefined
  const storeId = form.assignment === 'project'
    ? undefined
    : canChooseUnassignedStore.value
      ? form.storeAssignment === 'unassigned' ? 0 : session.emp?.store?.id
      : undefined
  return {
    paymentMode: form.paymentMode,
    amount: Number(form.amount),
    expenseDate: form.expenseDate,
    description: form.description.trim(),
    categoryId: form.categoryId,
    projectId: form.assignment === 'project' ? selectedProject.value?.id || 0 : 0,
    storeId,
    employeeId: ownerId,
    payeeEmployeeId,
    attachments: attachmentInputs()
  }
}

async function saveDraft() {
  if (saving.value) return
  const invalid = validate()
  if (invalid) {
    toast(invalid)
    return
  }
  saving.value = true
  saveNotice.value = ''
  try {
    const data = payload()
    const saved = expenseId.value
      ? await expenseApi.update({ expenseId: expenseId.value, ...data })
      : await expenseApi.save({ ...data, idempotencyKey: idempotencyKey.value })
    if (!expenseId.value && saved.expenseId) pendingCreatedId.value = saved.expenseId
    const verified = await expenseApi.info(saved.expenseId)
    if (verified.status !== 'Draft' && verified.status !== 'Returned') {
      saveNotice.value = `保存结果暂不可确认：当前状态为“${verified.status}”，请重新读取详情。`
      return
    }
    expenseId.value = verified.expenseId
    saving.value = false
    uni.redirectTo({ url: `${P.financeExpenseDetail}?expenseId=${encodeURIComponent(verified.expenseId)}` })
  } catch (error) {
    const message = error instanceof Error ? error.message : '网络或服务异常'
    saveNotice.value = `保存结果暂不可确认：${message}。请重新读取保存结果后决定是否重试。`
    toast('保存结果暂不可确认，请重新读取')
  } finally {
    saving.value = false
  }
}

async function recoverSave() {
  if (!pendingCreatedId.value) {
    await saveDraft()
    return
  }
  saving.value = true
  saveNotice.value = ''
  try {
    const verified = await expenseApi.info(pendingCreatedId.value)
    expenseId.value = verified.expenseId
    saving.value = false
    uni.redirectTo({ url: `${P.financeExpenseDetail}?expenseId=${encodeURIComponent(verified.expenseId)}` })
  } catch (error) {
    const message = error instanceof Error ? error.message : '费用详情仍暂不可确认'
    saveNotice.value = `保存结果仍暂不可确认：${message}。请保留当前页面稍后重试。`
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <view class="expense-page expense-edit-page">
    <JzPageHeader
      :title="expenseId ? '编辑费用草稿' : '新建费用'"
      subtitle="保存为草稿后，在详情中核对并提交审批"
      back
    />

    <JzSkeleton v-if="booting" :rows="7" />
    <PageState
      v-else-if="loadError"
      state="error"
      title="费用详情暂不可确认"
      :subtitle="loadError"
      @retry="boot"
    />

    <template v-else>
      <view class="expense-tip expense-edit-page__guide">
        项目费用只关联一个项目；企业费用不进入任何项目。报销时收款员工自动等于费用归属员工。
      </view>

      <view class="expense-form-section">
        <view class="expense-form-section__head">
          <text class="expense-form-section__title">费用信息</text>
          <text class="expense-form-section__hint">金额、发生日期和分类共同构成费用事实</text>
        </view>

        <view class="expense-form-row--col">
          <text class="expense-form-label">付款方式 *</text>
          <view class="expense-segment">
            <view
              v-for="option in paymentOptions"
              :key="option.value"
              class="expense-segment__item"
              :class="{ 'expense-segment__item--on': form.paymentMode === option.value }"
              @tap="selectPayment(option.value)"
            >
              <text class="expense-segment__label">{{ option.label }}</text>
              <text class="expense-segment__hint">{{ option.hint }}</text>
            </view>
          </view>
          <view class="expense-tip">当前选择：{{ expensePaymentModeLabel(form.paymentMode) }}</view>
        </view>

        <view class="expense-form-row--col">
          <text class="expense-form-label">金额 *</text>
          <JzMoneyInput v-model="form.amount" placeholder="请输入费用金额" :disabled="saving" />
        </view>

        <view class="expense-form-row--col">
          <text class="expense-form-label">费用分类 *</text>
          <view v-if="selectedCategory" class="expense-category-card" @tap="openCategoryPicker">
            <view class="expense-category-card__main">
              <text class="expense-category-card__name">{{ selectedCategory.name }}</text>
              <text class="expense-category-card__meta">{{ selectedCategory.description || (selectedCategory.builtIn ? '平台基础分类' : '企业自定义分类') }}</text>
            </view>
            <text class="expense-category-card__action">更换</text>
          </view>
          <view v-else class="expense-category-card expense-category-card--empty" @tap="openCategoryPicker">
            <view class="expense-category-card__main">
              <text class="expense-category-card__name">选择费用分类</text>
              <text class="expense-category-card__meta">按名称和说明选择启用的费用归属</text>
            </view>
            <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
          </view>
        </view>

        <view class="expense-form-row">
          <text class="expense-form-label">发生日期 *</text>
          <JzSelectField
            mode="date"
            :display="form.expenseDate"
            :value="form.expenseDate"
            placeholder="请选择发生日期"
            :disabled="saving"
            @change="pickExpenseDate"
          />
        </view>
      </view>

      <view class="expense-form-section">
        <view class="expense-form-section__head">
          <text class="expense-form-section__title">费用归属</text>
          <text class="expense-form-section__hint">项目与企业二选一，提交后归属将锁定</text>
        </view>

        <view class="expense-form-row--col">
          <text class="expense-form-label">项目 / 企业 *</text>
          <view class="expense-assignment">
            <view
              class="expense-assignment__item"
              :class="{ 'expense-assignment__item--on': form.assignment === 'company' }"
              @tap="setCompanyAssignment"
            >
              <JzIcon name="building" :size="30" :color="form.assignment === 'company' ? TOKEN_COLOR.primary : TOKEN_COLOR.text3" />
              <view class="expense-assignment__text">
                <text class="expense-assignment__title">企业费用</text>
                <text class="expense-assignment__hint">不进入项目成本</text>
              </view>
            </view>
            <view
              class="expense-assignment__item"
              :class="{ 'expense-assignment__item--on': form.assignment === 'project' }"
              @tap="selectProjectAssignment"
            >
              <JzIcon name="briefcase" :size="30" :color="form.assignment === 'project' ? TOKEN_COLOR.primary : TOKEN_COLOR.text3" />
              <view class="expense-assignment__text">
                <text class="expense-assignment__title">项目费用</text>
                <text class="expense-assignment__hint">只进入所选项目</text>
              </view>
            </view>
          </view>
        </view>

        <view v-if="form.assignment === 'project'" class="expense-form-row" @tap="openProjectPicker">
          <text class="expense-form-label">所属项目 *</text>
          <text class="expense-form-control" :class="{ 'expense-form-control--placeholder': !selectedProject }">{{ projectLabel }}</text>
          <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
        </view>

        <view v-if="form.assignment === 'project'" class="expense-form-row">
          <text class="expense-form-label">门店归属</text>
          <text class="expense-form-control">项目门店（自动）</text>
          <JzTag text="不可改" :color="TOKEN_COLOR.text3" />
        </view>
        <view v-else-if="canChooseUnassignedStore" class="expense-form-row">
          <text class="expense-form-label">门店归属</text>
          <JzSelectField
            :display="selectedStoreLabel"
            :range="storeLabels"
            :index="storeIndex"
            placeholder="选择企业费用门店"
            :disabled="saving"
            @change="pickStore"
          />
        </view>
        <view v-else class="expense-form-row">
          <text class="expense-form-label">门店归属</text>
          <text class="expense-form-control">{{ session.emp?.store?.name || '登录员工门店' }}</text>
          <JzTag text="自动" :color="TOKEN_COLOR.text3" />
        </view>

        <view class="expense-form-row" @tap="openEmployeePicker">
          <text class="expense-form-label">费用归属员工</text>
          <text class="expense-form-control">{{ ownerLabel }}</text>
          <JzIcon v-if="canProxyEmployee" name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
          <JzTag v-else text="本人" :color="TOKEN_COLOR.text3" />
        </view>

        <view v-if="form.paymentMode === 'Reimbursement'" class="expense-form-row">
          <text class="expense-form-label">报销收款员工</text>
          <text class="expense-form-control">{{ ownerLabel }}</text>
          <JzTag text="自动一致" :color="TOKEN_COLOR.success" />
        </view>
        <view v-if="!canProxyEmployee" class="expense-tip">普通员工和财务只能提交本人费用，归属员工与收款员工由登录身份确定。</view>
        <view v-else class="expense-tip">负责人可代企业范围员工提交，店长只能代本店员工提交；报销收款员工必须与归属员工一致。</view>
        <view v-if="canChooseUnassignedStore && form.assignment === 'company'" class="expense-tip">只有企业负责人和总部财务可将企业费用设为“未归属门店”；普通员工、店长和门店财务始终归属当前门店。</view>
      </view>

      <view class="expense-form-section">
        <view class="expense-form-section__head">
          <text class="expense-form-section__title">说明与证据</text>
          <text class="expense-form-section__hint">提交前至少需要一份发票、收据、支付截图或其他说明</text>
        </view>

        <view class="expense-form-row--col">
          <text class="expense-form-label">费用说明 *</text>
          <textarea
            v-model="form.description"
            class="expense-form-textarea"
            maxlength="5000"
            placeholder="写清费用用途、时间、地点或业务事项，便于审批人核对"
          />
        </view>

        <view class="expense-form-row">
          <text class="expense-form-label">证据类型</text>
          <JzSelectField
            :display="selectedDocumentTypeLabel"
            :range="documentTypeLabels"
            :index="documentTypeIndex"
            placeholder="选择证据类型"
            :disabled="uploading || saving"
            @change="pickNextDocumentType"
          />
        </view>

        <view class="expense-form-row--col">
          <view class="expense-detail-section__head expense-evidence-head">
            <text class="expense-form-label">证据附件</text>
            <text class="expense-detail-section__meta">{{ attachmentCountText }}</text>
          </view>
          <view class="expense-evidence-grid">
            <view v-for="(item, index) in attachments" :key="`${item.fileUrl}-${index}`" class="expense-evidence-item">
              <image
                class="expense-evidence-item__image"
                :src="item.previewUrl || fileApi.absolute(item.fileUrl)"
                mode="aspectFill"
                @tap="previewAttachment(index)"
              />
              <text class="expense-evidence-item__type">{{ EXPENSE_DOCUMENT_TYPE_META[item.documentType] }}</text>
              <view class="expense-evidence-item__remove" @tap.stop="removeAttachment(index)">
                <JzIcon name="close" :size="22" :color="TOKEN_COLOR.white" />
              </view>
            </view>
            <view v-if="attachments.length < MAX_ATTACHMENTS" class="expense-evidence-add" @tap="chooseAttachments">
              <JzIcon name="camera" :size="32" :color="TOKEN_COLOR.primary" />
              <text>{{ uploading ? '上传中' : '拍照或相册' }}</text>
            </view>
          </view>
          <view v-if="!attachments.length" class="expense-evidence-empty">保存草稿可暂不上传；提交审批前必须至少上传一份证据。</view>
        </view>
      </view>

      <view v-if="saveNotice" class="expense-inline-error expense-edit-page__notice">
        {{ saveNotice }}
        <text class="expense-inline-error__action" @tap="recoverSave">重新读取 / 重试</text>
      </view>

      <view class="jz-actionbar">
        <view class="jz-actionbar__inner">
          <button class="jz-btn jz-btn--primary jz-btn--block" :loading="saving" :disabled="saving || uploading" @tap="saveDraft">
            保存草稿
          </button>
        </view>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';
@import '@/subpackages/finance/styles/expense.scss';

.expense-edit-page { padding-bottom: calc(150rpx + #{$jzb-safe-bottom}); }
.expense-edit-page__guide { margin: $jzb-space-4 $jzb-page-pad 0; }
.expense-edit-page__notice { margin: $jzb-space-4 $jzb-page-pad; }
.expense-evidence-head { margin-bottom: 0; }
.expense-category-card { display: flex; align-items: center; gap: 16rpx; min-height: 88rpx; padding: 18rpx 20rpx; background: $jzb-primary-lightest; border: 1rpx solid var(--jzb-primary-a18, rgba(22,163,148,.18)); border-radius: $jzb-radius-sm; }
.expense-category-card--empty { background: $jzb-bg-hover; border-color: $jzb-border-light; }
.expense-category-card__main { flex: 1; min-width: 0; }
.expense-category-card__name { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.expense-category-card__meta { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.expense-category-card__action { flex: none; color: $jzb-primary; font-size: $jzb-font-xs; font-weight: 650; }
</style>
