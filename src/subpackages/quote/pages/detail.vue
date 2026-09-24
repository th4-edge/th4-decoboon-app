<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import type { Contract, ContractChange, Quote, QuoteGroup, QuoteItem, QuoteMode, QuoteStatus } from '@/domains/trade/model'
import type { Project } from '@/domains/project/model'
import { tradeApi } from '@/domains/trade/api'
import { projectApi } from '@/domains/project/api'
import { documentApi } from '@/domains/document/api'
import { designApi } from '@/domains/design/api'
import { money } from '@/core/format'
import { TOKEN_COLOR } from '@/styles/tokens'
import { confirm, loading, hideLoading, toast, toastError } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzTag from '@/components/JzTag.vue'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import PageState from '@/components/PageState/PageState.vue'
import QuoteItemRow from '@/subpackages/quote/components/QuoteItemRow/QuoteItemRow.vue'

const id = ref('')
const quote = ref<Quote | null>(null)
const loadingQuote = ref(false)
const loadError = ref('')
const busy = ref(false)
const pdfBusy = ref(false)
const project = ref<Project | null>(null)
const contract = ref<Contract | null>(null)
const changes = ref<ContractChange[]>([])
const customerQuotes = ref<Quote[]>([])
const loadingCustomerQuotes = ref(false)
const scrollIntoViewId = ref('')
const STATUS_META: Record<QuoteStatus, { label: string; color: string }> = {
  draft: { label: '草稿', color: TOKEN_COLOR.text3 },
  submitted: { label: '待客户确认', color: TOKEN_COLOR.warning },
  accepted: { label: '客户已接受', color: TOKEN_COLOR.success },
  rejected: { label: '已驳回', color: TOKEN_COLOR.danger },
  superseded: { label: '已被替代', color: '#8B93A1' },
  converted: { label: '已转项目', color: TOKEN_COLOR.purple }
}
const MODE_META: Record<QuoteMode, string> = { package: '套餐报价', custom: '自定义报价', hybrid: '混合报价' }
const canAct = computed(() => can(session.role, 'act:quote'))
const canEdit = computed(() => can(session.role, 'edit:quote'))
const canConvert = computed(() => can(session.role, 'act:convertCustomer'))
const canViewCost = computed(() => can(session.role, 'view:cost'))
const canViewFinance = computed(() => can(session.role, 'view:finance'))
const canApproveChange = computed(() => session.role === 'boss' || session.role === 'finance')
const pendingChanges = computed(() => changes.value.filter((item) => item.status === 'pending'))
const receivablePlanDelta = computed(() => {
  if (!contract.value) return 0
  return contract.value.receivableAmount - (contract.value.paymentPlan?.totalAmount || 0)
})
const CONTRACT_STATUS_META: Record<Contract['status'], string> = {
  draft: '草稿', pendingSign: '待签约', signed: '已签约', effective: '已生效', changing: '变更中',
  active: '已生效', changed: '已变更', completed: '已完工', closed: '已关闭', settled: '已结算',
  terminated: '已终止', void: '已作废'
}
const collapsed = ref<Record<string, boolean>>({})
const detailView = ref<'region' | 'category'>('region')
const ITEM_TYPE_LABEL: Record<string, string> = {
  construction: '施工',
  material: '主材',
  custom: '全屋定制',
  appliance: '电器',
  soft: '软装家具',
  general: '综合',
  other: '其他'
}

interface MergedItemMeta {
  quantity: number
  amount: number
  spaceLabel: string
  sourceCount: number
}

interface CategoryView {
  groups: QuoteGroup[]
  meta: Record<string, MergedItemMeta>
}

function itemAmount(item: QuoteItem): number {
  const amount = Number(item.amount || 0)
  if (amount !== 0) return amount
  return Number(item.price || 0) * Number(item.quantity || 0)
}

function detailItemType(item: QuoteItem): NonNullable<QuoteItem['type']> {
  return item.type || 'general'
}

function detailItemCategory(item: QuoteItem): string {
  const category = item.category?.trim()
  return category || ITEM_TYPE_LABEL[detailItemType(item)] || '其他'
}

function mergeKey(item: QuoteItem): string {
  const components = item.components
    ?.map((component) => `${component.type}:${component.name || ''}:${component.saleAmount}`)
    .join(',') || ''
  return [
    detailItemType(item), detailItemCategory(item), item.name, item.brand || '', item.spec || '', item.unit,
    item.pricingMode || '', item.price, item.role || '', item.differenceType || '',
    item.included === false ? 'excluded' : 'included', components
  ].join('|')
}

const sourceItems = computed<QuoteItem[]>(() => {
  const current = quote.value
  if (!current) return []
  if (current.items?.length) return current.items
  const groups = current.regionGroups || [
    ...(current.constructionGroups || []),
    ...(current.materialGroups || []),
    ...(current.otherGroups || [])
  ]
  return groups.flatMap((group) => group.items.map((item) => item.space ? item : {
    ...item,
    space: { id: group.key, name: group.name }
  }))
})

const regionGroups = computed<QuoteGroup[]>(() => {
  const current = quote.value
  if (current?.regionGroups?.length) return current.regionGroups
  const groups = new Map<string, QuoteGroup>()
  for (const item of sourceItems.value) {
    const key = item.space?.id ? `space-${item.space.id}` : 'general'
    const name = item.space?.name || '综合项目'
    const group = groups.get(key) || { key, name, amount: 0, cost: 0, items: [] }
    group.amount += itemAmount(item)
    group.cost += Number(item.cost || 0)
    group.items.push(item)
    groups.set(key, group)
  }
  return [...groups.values()]
})

const categoryView = computed<CategoryView>(() => {
  const groups = new Map<string, QuoteGroup>()
  const merged = new Map<string, { item: QuoteItem; meta: MergedItemMeta }>()
  const meta: Record<string, MergedItemMeta> = {}

  for (const source of sourceItems.value) {
    const type = detailItemType(source)
    const category = detailItemCategory(source)
    const groupKey = `${type}-${category}`
    let group = groups.get(groupKey)
    if (!group) {
      group = { key: groupKey, name: category, type, category, amount: 0, cost: 0, items: [] }
      groups.set(groupKey, group)
    }
    group.amount += itemAmount(source)
    group.cost += Number(source.cost || 0)

    const identity = mergeKey(source)
    const existing = merged.get(identity)
    const spaceName = source.space?.name || '综合项目'
    if (existing) {
      existing.item.quantity = Number(existing.item.quantity || 0) + Number(source.quantity || 0)
      existing.item.amount = Number(existing.item.amount || 0) + itemAmount(source)
      existing.item.cost = Number(existing.item.cost || 0) + Number(source.cost || 0)
      existing.meta.quantity += Number(source.quantity || 0)
      existing.meta.amount += itemAmount(source)
      existing.meta.sourceCount += 1
      if (!existing.meta.spaceLabel.split('、').includes(spaceName)) {
        existing.meta.spaceLabel += `、${spaceName}`
      }
      meta[existing.item.id] = existing.meta
      continue
    }

    const item = { ...source, amount: itemAmount(source) }
    const itemMeta: MergedItemMeta = {
      quantity: Number(source.quantity || 0),
      amount: itemAmount(source),
      spaceLabel: spaceName,
      sourceCount: 1
    }
    group.items.push(item)
    merged.set(identity, { item, meta: itemMeta })
    meta[item.id] = itemMeta
  }

  return { groups: [...groups.values()], meta }
})

const detailGroups = computed<QuoteGroup[]>(() => detailView.value === 'region' ? regionGroups.value : categoryView.value.groups)
const categoryMeta = computed(() => categoryView.value.meta)

/** 同客户是否有多份报价（切换条仅在 >1 时显示） */
const hasMultipleQuotes = computed(() => customerQuotes.value.length > 1)

/** 套餐基准价（packageTemplate.price = 标准面积折前牌价） */
const hasPackage = computed(() => !!quote.value?.packageTemplate)
const packageBaseline = computed(() => quote.value?.packageTemplate?.price ?? 0)
/** 调整增减 = 分项合计（折前）- 套餐基准牌价；正数为增项，负数为扣减 */
const adjustDelta = computed(() => {
  if (!quote.value?.packageTemplate) return 0
  return (quote.value.subtotal ?? quote.value.amount) - quote.value.packageTemplate.price
})

/** 项目经理视角下分组类型前缀 */
function groupTypeLabel(type: string): string {
  return ITEM_TYPE_LABEL[type] || type
}

/** 加载当前客户的全部报价，用于详情页内切换 */
async function loadCustomerQuotes() {
  if (!quote.value?.customer?.id) return
  loadingCustomerQuotes.value = true
  try {
    customerQuotes.value = await tradeApi.quotes({ customerId: quote.value.customer.id })
    await nextTick()
    scrollIntoViewId.value = `cq-${id.value}`
  } catch {
    customerQuotes.value = []
  } finally {
    loadingCustomerQuotes.value = false
  }
}

/** 切换到同客户的另一份报价（redirectTo 避免页面栈叠加） */
function switchQuote(targetId: string) {
  if (targetId === id.value) return
  uni.redirectTo({ url: `${P.quoteDetail}?id=${targetId}` })
}

onLoad((query) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  id.value = query?.id || ''
})
onShow(() => { if (id.value) void load() })

async function load() {
  if (!id.value) return
  loadingQuote.value = true
  loadError.value = ''
  try {
    quote.value = await tradeApi.quote(id.value) || null
    if (!quote.value) loadError.value = '报价不存在或无权访问'
    else {
      await loadDownstream()
      await loadCustomerQuotes()
    }
  } catch (error) {
    quote.value = null
    loadError.value = error instanceof Error ? error.message : '报价详情加载失败'
    toastError(error, '报价详情加载失败')
  } finally {
    loadingQuote.value = false
  }
}

async function loadDownstream() {
  project.value = null
  contract.value = null
  changes.value = []
  if (!quote.value || !['accepted', 'converted'].includes(quote.value.status)) return
  const projects = await projectApi.list().catch(() => [])
  project.value = projects.find((item) => item.quote?.id === quote.value?.id) || null
  contract.value = project.value
    ? await tradeApi.contractByProject(project.value.id).catch(() => null)
    : await tradeApi.contractByQuote(quote.value.id).catch(() => null)
  if (!project.value) return
  changes.value = await tradeApi.contractChanges(project.value.id).catch(() => [])
}

async function transition(status: QuoteStatus, title: string, content: string) {
  if (!quote.value || busy.value) return
  const ok = await confirm(title, content, '确认')
  if (!ok) return
  busy.value = true
  loading('处理中…')
  try {
    await tradeApi.transition(quote.value.id, status)
    await load()
    hideLoading()
    toast('状态已更新', 'success')
  } catch (error) {
    hideLoading()
    toastError(error, '报价状态更新失败')
  } finally { busy.value = false }
}

async function rebaseRejected() {
  if (!quote.value || busy.value || quote.value.status !== 'rejected') return
  const ok = await confirm('改版重报', `基于历史报价 ${quote.value.no} 生成新的草稿版本？原驳回记录会保留。`, '生成新版本')
  if (!ok) return
  busy.value = true
  loading('生成新版本…')
  try {
    const next = await tradeApi.rebaseQuote(quote.value.id)
    hideLoading()
    toast(`已生成新报价 ${next.no}`, 'success')
    setTimeout(() => uni.redirectTo({ url: `${P.quoteDetail}?id=${next.id}` }), 350)
  } catch (error) {
    hideLoading()
    toastError(error, '改版重报失败')
  } finally {
    busy.value = false
  }
}

function toProject() {
  if (!quote.value) return
  uni.navigateTo({ url: `${P.projectCreate}?customerId=${quote.value.customer?.id || ''}&quoteId=${quote.value.id}` })
}
function toggleGroup(key: string) {
  collapsed.value[key] = !isGroupCollapsed(key)
}
function isGroupCollapsed(key: string) {
  return collapsed.value[key] !== false
}
function openDesign() {
  if (!quote.value?.design?.id) return
  uni.navigateTo({ url: `${P.designScheme}?customerId=${quote.value.customer?.id || ''}&designId=${quote.value.design.id}` })
}
async function openTalk() {
  const designId = quote.value?.design?.id
  if (!designId) return
  try {
    const talks = await designApi.talks(designId)
    const latest = [...talks].sort((left, right) => {
      const timeCompare = String(right.builtAt || '').localeCompare(String(left.builtAt || ''))
      return timeCompare || String(right.id).localeCompare(String(left.id))
    })[0]
    if (latest?.id) {
      uni.navigateTo({ url: `${P.designTalk}?talkId=${latest.id}` })
      return
    }
  } catch (error) {
    toastError(error, '谈单PPT查询失败')
    return
  }
  uni.navigateTo({ url: `${P.designTalk}?designId=${designId}&quoteId=${quote.value?.id || ''}` })
}
function openProject() {
  if (project.value) uni.navigateTo({ url: `${P.projectDetail}?id=${project.value.id}` })
}
function openAdjust() {
  if (quote.value) uni.navigateTo({ url: `${P.quoteAdjust}?id=${quote.value.id}` })
}
async function openQuotePdf() {
  if (!quote.value || pdfBusy.value) return
  pdfBusy.value = true
  loading('生成报价打印稿…')
  try {
    const record = await documentApi.buildQuote(quote.value.id)
    hideLoading()
    await openPdf(record.url, record.fileName)
  } catch (error) {
    hideLoading()
    toastError(error, '报价打印稿生成失败')
  } finally {
    pdfBusy.value = false
  }
}

function openPdf(url: string, fileName?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('打印稿访问地址为空'))
      return
    }
    uni.downloadFile({
      url,
      success: (result) => {
        if (result.statusCode !== 200) {
          reject(new Error(`打印稿下载失败(${result.statusCode})`))
          return
        }
        openDownloadedPdf(result.tempFilePath, fileName, resolve, reject)
      },
      fail: (error) => reject(new Error(error.errMsg || '打印稿下载失败'))
    })
  })
}

/** 打印稿在沙箱内按业务文件名落盘，转发或保存到手机时才不是随机临时名。 */
function openDownloadedPdf(tempFilePath: string, fileName: string | undefined, resolve: () => void, reject: (error: Error) => void) {
  const open = (filePath: string) => uni.openDocument({
    filePath,
    fileType: 'pdf',
    showMenu: true,
    success: () => resolve(),
    fail: (error) => reject(new Error(error.errMsg || '打印稿打开失败'))
  })
  const safeName = safePdfName(fileName)
  const fs = uni.getFileSystemManager ? uni.getFileSystemManager() : undefined
  const userDataPath = (uni as unknown as { env?: { USER_DATA_PATH?: string } }).env?.USER_DATA_PATH
  if (!fs || !safeName || !userDataPath) {
    open(tempFilePath)
    return
  }
  const filePath = `${userDataPath}/${safeName}`
  try {
    fs.unlinkSync(filePath)
  } catch {
    // 目标文件不存在时无需处理，直接保存即可
  }
  fs.saveFile({
    tempFilePath,
    filePath,
    success: (saved) => open(saved.savedFilePath || tempFilePath),
    fail: () => open(tempFilePath)
  })
}

function safePdfName(fileName?: string): string {
  const safe = (fileName || '').replace(/[\\/:*?"<>|\s]/g, '').slice(0, 100)
  if (!safe) return ''
  return safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`
}
function openFinance() {
  if (project.value && canViewFinance.value) uni.navigateTo({ url: `${P.financeProject}?projectId=${project.value.id}` })
}
async function generateContract() {
  toProject()
}

async function effectiveContract() {
  if (!contract.value || busy.value) return
  const ok = await confirm('合同生效', '合同生效后将创建唯一施工项目，并生成材料预计划和应收计划。', '确认生效')
  if (!ok) return
  busy.value = true
  try {
    contract.value = await tradeApi.updateContract(contract.value.id, 'effective')
    await loadDownstream()
    toast('合同已生效，项目已创建', 'success')
  } catch (error) {
    toastError(error, '合同生效失败')
  } finally { busy.value = false }
}
async function createChange() {
  if (!contract.value || busy.value) return
  const amountText = await new Promise<string | null>((resolve) => {
    uni.showModal({
      title: '发起合同变更', content: '', editable: true, placeholderText: '变更金额，增加填正数，减少填负数',
      success: (res) => resolve(res.confirm ? ((res as any).content || '') : null), fail: () => resolve(null)
    })
  })
  if (amountText === null) return
  const amount = Number(amountText)
  if (!Number.isFinite(amount) || amount === 0) { uni.showToast({ title: '请输入非 0 变更金额', icon: 'none' }); return }
  const reason = await new Promise<string | null>((resolve) => {
    uni.showModal({
      title: '变更原因', content: '', editable: true, placeholderText: '如增项、减项、材料升级',
      success: (res) => resolve(res.confirm ? ((res as any).content || '') : null), fail: () => resolve(null)
    })
  })
  if (!reason?.trim()) { uni.showToast({ title: '请填写变更原因', icon: 'none' }); return }
  busy.value = true
  try {
    await tradeApi.createContractChange(contract.value.id, amount, reason.trim())
    await loadDownstream()
    toast('变更单已提交审批', 'success')
  } catch (error) {
    toastError(error, '变更单提交失败')
  } finally { busy.value = false }
}
async function reviewChange(change: ContractChange, approved: boolean) {
  if (!canApproveChange.value || busy.value) return
  const ok = await confirm(approved ? '通过变更单' : '驳回变更单', `${change.no} · ${change.reason}`, approved ? '通过' : '驳回')
  if (!ok) return
  busy.value = true
  try {
    await tradeApi.confirmContractChange(change.id, approved)
    await loadDownstream()
    toast(approved ? '变更审批已通过，等待客户确认' : '变更已驳回', 'success')
  } catch (error) {
    toastError(error, '变更审批失败')
  } finally { busy.value = false }
}

async function confirmCustomerChange(change: ContractChange) {
  if (busy.value) return
  const ok = await confirm('客户确认变更', `${change.no} · ${change.reason}\n确认客户已认可本次变更报价？`, '确认已认可')
  if (!ok) return
  busy.value = true
  try {
    await tradeApi.customerConfirmContractChange(change.id)
    await loadDownstream()
    toast('客户确认已登记，合同与应收已同步', 'success')
  } catch (error) {
    toastError(error, '客户确认登记失败')
  } finally { busy.value = false }
}
</script>

<template>
  <view class="qd" :class="{ 'qd--with-tools': quote.design }" v-if="quote">
    <view class="qd__hero">
      <view class="jz-between">
        <text class="qd__no">{{ quote.no }} · V{{ quote.version }}</text>
        <text class="qd__status">{{ MODE_META[quote.mode] }} · {{ STATUS_META[quote.status].label }}</text>
      </view>
      <text class="qd__amount">{{ money(quote.amount) }}</text>
      <text class="qd__title jz-clamp-2">{{ quote.title || quote.design?.name || '设计报价' }}</text>
      <!-- 套餐来源条：仅套餐/混合模式且有 packageTemplate 时显示 -->
      <view v-if="hasPackage" class="qd__package-source">
        <text class="qd__package-label">套餐来源</text>
        <text class="qd__package-name">{{ quote.packageTemplate!.name }}</text>
        <text class="qd__package-meta">基准 {{ quote.packageTemplate!.area }}㎡ · 牌价 {{ money(packageBaseline) }}</text>
      </view>
      <view class="qd__hero-foot">
        <text>{{ quote.customer?.name || '未关联客户' }}</text>
        <view class="qd__person"><JzEmployeeAvatar v-if="quote.owner" :src="quote.owner.avatarUrl || ''" :name="quote.owner.name" :role="quote.owner.role" :status="quote.owner.status" :size="40" /><text>{{ quote.area }}㎡ · {{ quote.owner?.name || '未指派' }}</text></view>
      </view>
    </view>

    <!-- 同客户报价切换：突出版本、状态和当前查看项 -->
    <view v-if="hasMultipleQuotes" class="qd__customer-quotes">
      <view class="qd__cq-header">
        <view>
          <text class="qd__cq-title">该客户报价</text>
          <text class="qd__cq-subtitle">共 {{ customerQuotes.length }} 个版本，点击卡片切换</text>
        </view>
        <JzTag text="版本对比" :color="TOKEN_COLOR.primary" size="sm" />
      </view>
      <scroll-view
        scroll-x
        class="qd__cq-scroll"
        show-scrollbar="false"
        :scroll-into-view="scrollIntoViewId"
        scroll-with-animation
      >
        <view class="qd__cq-track">
          <view
            v-for="q in customerQuotes"
            :key="q.id"
            :id="`cq-${q.id}`"
            class="qd__cq-card"
            :class="{ 'qd__cq-card--active': q.id === id }"
            @tap="q.id !== id && switchQuote(q.id)"
          >
            <view class="qd__cq-top">
              <text class="qd__cq-version">V{{ q.version }}</text>
              <JzTag :text="STATUS_META[q.status].label" :color="STATUS_META[q.status].color" size="sm" />
            </view>
            <text class="qd__cq-amount">{{ money(q.amount) }}</text>
            <view class="qd__cq-meta">
              <text>{{ MODE_META[q.mode] }}</text>
              <text>{{ q.no }}</text>
            </view>
            <view class="qd__cq-foot" :class="{ 'qd__cq-foot--active': q.id === id }">
              <template v-if="q.id === id">
                <JzIcon name="check-circle" :size="24" :color="TOKEN_COLOR.primary" />
                <text>当前查看</text>
              </template>
              <template v-else>
                <text>查看此版本</text>
                <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text3" />
              </template>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>

    <view v-if="quote.status === 'accepted'" class="jz-card qd__handoff qd__handoff--accepted">
      <JzIcon name="check-circle" :size="34" :color="TOKEN_COLOR.primary" />
      <view class="jz-grow"><text class="qd__handoff-title">客户已确认报价，房屋报价已锁定</text><text class="qd__handoff-tip">该房屋不能再确认其他报价；生成唯一项目后，将通过合同基线、变更单和应收计划承接后续金额调整。</text></view>
      <button v-if="canConvert && !contract" class="jz-btn jz-btn--ghost jz-btn--sm" @tap="generateContract">生成合同</button>
      <button v-else-if="canConvert && contract && contract.status !== 'effective'" class="jz-btn jz-btn--ghost jz-btn--sm" @tap="effectiveContract">合同生效并生成项目</button>
      <button v-else-if="project" class="jz-btn jz-btn--ghost jz-btn--sm" @tap="openProject">查看项目</button>
    </view>

    <view v-if="quote.status === 'accepted' && contract" class="jz-card qd__contract">
      <view class="jz-between">
        <view><text class="qd__down-eyebrow">合同进度</text><text class="qd__down-title">{{ contract.no }}</text></view>
        <JzTag :text="CONTRACT_STATUS_META[contract.status]" :color="contract.status === 'effective' ? TOKEN_COLOR.success : TOKEN_COLOR.warning" />
      </view>
      <view class="qd__down-grid">
        <view><text>{{ money(contract.signedAmount ?? contract.currentAmount) }}</text><text>最终签约价</text></view>
        <view><text>{{ money(contract.currentAmount) }}</text><text>当前合同额</text></view>
        <view><text>{{ contract.signedAt || '待签约' }}</text><text>签约日期</text></view>
      </view>
      <text class="qd__down-sub">合同生效前不会创建项目；生效后由合同基线生成项目、材料预计划和应收计划。</text>
    </view>

    <view v-if="quote.status === 'converted'" class="jz-card qd__handoff qd__handoff--converted">
      <JzIcon name="briefcase" :size="34" :color="TOKEN_COLOR.primary" />
      <view class="jz-grow"><text class="qd__handoff-title">{{ project ? `已转唯一项目 ${project.no}` : '报价已转项目，正在同步项目' }}</text><text class="qd__handoff-tip">设计与报价转为只读基线；所有金额调整进入合同变更单，应收由财务计划承接。</text></view>
      <button v-if="project" class="jz-btn jz-btn--ghost jz-btn--sm" @tap="openProject">查看工地</button>
    </view>

    <template v-if="quote.status === 'converted' && project">
      <view class="jz-section"><text class="jz-section__title">报价 · 项目衔接</text><text class="jz-section__more">基线 / 变更 / 应收</text></view>

      <view v-if="!contract" class="jz-card qd__contract-empty">
        <view class="jz-grow"><text class="qd__down-title">尚未生成合同基线</text><text class="qd__down-sub">合同基线冻结客户确认报价、合同金额和项目执行基准。</text></view>
        <button v-if="canAct" class="jz-btn jz-btn--primary jz-btn--sm" :loading="busy" @tap="generateContract">生成合同基线</button>
      </view>

      <view v-else class="jz-card qd__contract">
        <view class="jz-between">
          <view><text class="qd__down-eyebrow">合同基线</text><text class="qd__down-title">{{ contract.no }}</text></view>
          <JzTag :text="CONTRACT_STATUS_META[contract.status]" :color="contract.status === 'changed' ? TOKEN_COLOR.warning : TOKEN_COLOR.success" />
        </view>
        <view class="qd__down-grid">
          <view><text>{{ money(contract.baselineAmount) }}</text><text>原始合同额</text></view>
          <view><text>{{ money(contract.signedAmount ?? contract.baselineAmount) }}</text><text>最终签约价</text></view>
          <view><text>{{ money(contract.currentAmount) }}</text><text>当前合同额</text></view>
        </view>
        <view class="qd__down-actions">
          <button class="jz-btn jz-btn--text jz-btn--sm qd__change-link" @tap="createChange"><JzIcon name="file-text" :size="26" :color="TOKEN_COLOR.text2" /><text>发起变更单</text></button>
          <text class="qd__change-state">{{ pendingChanges.length ? `${pendingChanges.length} 份变更待审批` : '合同金额与原报价基线一致' }}</text>
        </view>

        <view class="qd__collection" :class="{ 'qd__collection--link': canViewFinance }" @tap="openFinance">
          <view class="qd__collection-head">
            <view class="jz-grow">
              <text class="qd__collection-title">收款节点金额</text>
              <text class="qd__collection-summary">应收 {{ money(contract.receivableAmount) }} · 已收 {{ money(contract.receivedAmount) }}</text>
            </view>
            <view v-if="canViewFinance" class="qd__collection-action">
              <text>应收计划</text>
              <JzIcon name="chevron-right" :size="22" :color="TOKEN_COLOR.primary" />
            </view>
          </view>
          <view v-if="contract.paymentPlan?.nodes?.length" class="qd__collection-list">
            <view v-for="node in contract.paymentPlan.nodes" :key="node.nodeId || node.code" class="qd__collection-node">
              <view class="qd__collection-node-main">
                <text>{{ node.name }}</text>
                <text>{{ node.triggerStageName || node.triggerType }}<template v-if="node.dueDate"> · {{ node.dueDate }}</template></text>
              </view>
              <text class="qd__collection-ratio">{{ (node.ratio * 100).toFixed(0) }}%</text>
              <text class="qd__collection-amount">{{ money(node.amount) }}</text>
            </view>
            <view v-if="Math.abs(receivablePlanDelta) > 0.01" class="qd__collection-node qd__collection-node--adjusted">
              <view class="qd__collection-node-main">
                <text>节点外调整</text>
                <text>合同变更款或应收调整</text>
              </view>
              <text class="qd__collection-ratio">-</text>
              <text class="qd__collection-amount" :class="{ 'qd__collection-amount--down': receivablePlanDelta < 0 }">{{ receivablePlanDelta > 0 ? '+' : '' }}{{ money(receivablePlanDelta) }}</text>
            </view>
          </view>
          <view v-else class="qd__collection-empty">
            <text>{{ contract.receivableCount ? `已建立 ${contract.receivableCount} 项应收` : '应收计划尚未生成' }}</text>
            <text v-if="canViewFinance">点击进入财务查看节点</text>
          </view>
        </view>
      </view>

      <view v-if="contract" class="jz-card qd__changes">
        <view class="jz-between"><text class="qd__down-title">合同变更单</text><text class="qd__down-sub">{{ pendingChanges.length }} 份待审批</text></view>
        <view v-if="changes.length" class="qd__change-list">
          <view v-for="change in changes.slice(0, 3)" :key="change.id" class="qd__change">
            <view class="jz-grow"><text class="qd__change-reason jz-clamp-2">{{ change.reason }}</text><text class="qd__down-sub">{{ change.no }} · {{ change.status === 'pending' ? '待审批' : change.status === 'approved' ? '待客户确认' : change.status === 'customerConfirmed' ? '客户已确认' : change.status === 'cancelled' ? '已取消' : '已驳回' }}</text></view>
            <text class="qd__change-amount" :class="{ 'qd__change-amount--down': change.amount < 0 }">{{ change.amount > 0 ? '+' : '' }}{{ money(change.amount) }}</text>
            <view v-if="change.status === 'pending' && canApproveChange" class="qd__change-actions">
              <text @tap.stop="reviewChange(change, true)">通过</text><text @tap.stop="reviewChange(change, false)">驳回</text>
            </view>
            <view v-else-if="change.status === 'approved' && (session.role === 'boss' || session.role === 'pm' || session.role === 'designer')" class="qd__change-actions">
              <text @tap.stop="confirmCustomerChange(change)">客户确认</text>
            </view>
          </view>
        </view>
        <text v-else class="qd__down-sub">暂无变更单，合同金额与报价基线一致。</text>
      </view>

    </template>

    <view v-if="quote.design" class="jz-card qd__design" @tap="openDesign">
      <view class="jz-grow"><text class="qd__design-name jz-clamp-1">{{ quote.design.name }}</text><text class="qd__design-sub jz-clamp-1">V{{ quote.design.version }} · {{ quote.design.style || '风格待定' }}</text></view>
      <text class="qd__link">查看方案</text>
      <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.text4" />
    </view>

    <view class="qd__detail-head">
      <view class="qd__detail-title">
        <text class="qd__detail-heading">分项报价</text>
        <text class="qd__detail-count">{{ detailGroups.length }} 组 · 默认收起</text>
      </view>
      <view class="qd__view-tools">
        <view class="qd__view-tool" :class="{ 'qd__view-tool--active': detailView === 'region' }" @tap="detailView = 'region'">
          <JzIcon name="map-pin" :size="24" :color="detailView === 'region' ? TOKEN_COLOR.primary : TOKEN_COLOR.text3" />
          <text>区域</text>
          <text class="qd__view-count">{{ regionGroups.length }}</text>
        </view>
        <view class="qd__view-tool" :class="{ 'qd__view-tool--active': detailView === 'category' }" @tap="detailView = 'category'">
          <JzIcon name="folder" :size="24" :color="detailView === 'category' ? TOKEN_COLOR.primary : TOKEN_COLOR.text3" />
          <text>分类</text>
          <text class="qd__view-count">{{ categoryView.groups.length }}</text>
        </view>
      </view>
    </view>
    <view v-if="detailGroups.length" class="qd__groups">
      <view v-for="group in detailGroups" :key="group.key" class="jz-card qd__group" :class="{ 'qd__group--open': !isGroupCollapsed(group.key) }">
        <view class="jz-between qd__group-head" @tap="toggleGroup(group.key)">
          <view class="qd__group-title">
            <text class="qd__group-name jz-clamp-1">
              <text v-if="group.type" class="qd__group-type">{{ groupTypeLabel(group.type) }} · </text>{{ group.name }}
            </text>
            <text class="qd__group-count">
              {{ group.items.length }} 项<text v-if="detailView === 'category'"> · 已合并</text>
            </text>
          </view>
          <view class="qd__group-right"><text class="qd__group-amount">{{ money(group.amount) }}</text><JzIcon :name="isGroupCollapsed(group.key) ? 'chevron-right' : 'chevron-down'" :size="24" :color="TOKEN_COLOR.text4" /></view>
        </view>
        <template v-if="!isGroupCollapsed(group.key)">
          <QuoteItemRow
            v-for="item in group.items"
            :key="item.id"
            :item="item"
            :display-quantity="detailView === 'category' ? categoryMeta[item.id]?.quantity : undefined"
            :display-amount="detailView === 'category' ? categoryMeta[item.id]?.amount : undefined"
            :space-label="detailView === 'category' ? categoryMeta[item.id]?.spaceLabel : undefined"
            :source-count="detailView === 'category' ? categoryMeta[item.id]?.sourceCount : undefined"
            :quote-mode="quote.mode"
          />
        </template>
      </view>
    </view>
    <JzEmpty v-else text="暂无报价明细" sub="设计报价由方案区域中的施工/材料分项自动生成" />

    <view class="jz-card qd__facts">
      <view v-if="hasPackage"><text>套餐基准价</text><text>{{ money(packageBaseline) }}</text></view>
      <view v-if="hasPackage"><text>调整增减</text><text :class="{ 'qd__delta--down': adjustDelta < 0 }">{{ adjustDelta > 0 ? '+' : '' }}{{ money(adjustDelta) }}</text></view>
      <view><text>分项合计</text><text>{{ money(quote.subtotal || quote.amount) }}</text></view>
      <view><text>折扣率</text><text>{{ quote.discount ? (quote.discount * 100).toFixed(0) + '%' : '-' }}</text></view>
      <view><text>税金</text><text>{{ money(quote.taxAmount || 0) }}</text></view>
      <view v-if="canViewCost"><text>报价成本</text><text v-if="quote.costComplete !== false">{{ money(quote.cost) }}</text><JzCostIncomplete v-else :count="1" reason="本报价存在未维护成本的报价项目，补齐后才能计算成本和利润。" /></view>
      <view v-if="canViewCost"><text>成本状态</text><text v-if="quote.costComplete !== false">成本完整</text><JzCostIncomplete v-else :count="1" reason="本报价成本不完整，利润和毛利率暂不展示。" /></view>
      <view><text>创建时间</text><text>{{ quote.createdAt?.slice(0, 16) || '-' }}</text></view>
    </view>

    <view v-if="quote.design" class="jz-card qd__talk" @tap="openTalk">
      <view class="qd__talk-icon"><JzIcon name="file-text" :size="38" :color="TOKEN_COLOR.purple" /></view>
      <view class="jz-grow"><text class="qd__talk-title">谈单 PPT 方案</text><text class="qd__talk-sub">把客户诉求、量房问题、区域设计与装修投入串成一套讲解顺序</text></view>
      <JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text4" />
    </view>

    <view class="jz-card qd__talk" @tap="openQuotePdf">
      <view class="qd__talk-icon"><JzIcon name="file-text" :size="38" :color="TOKEN_COLOR.primary" /></view>
      <view class="jz-grow"><text class="qd__talk-title">报价打印稿</text><text class="qd__talk-sub">{{ pdfBusy ? '正在生成归档文件…' : '生成客户版 PDF，仅含销售价，不含成本；用于线下打印和盖章' }}</text></view>
      <JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text4" />
    </view>

    <view class="jz-actionbar qd__actionbar">
      <view class="jz-actionbar__inner qd__actionbar-inner">
        <view v-if="quote.design" class="qd__tool-row">
          <button class="qd__tool-btn" @tap="openDesign">
            <JzIcon name="edit" :size="30" :color="TOKEN_COLOR.primary" />
            <text>查看方案</text>
          </button>
          <button class="qd__tool-btn" @tap="openTalk">
            <JzIcon name="file-text" :size="30" :color="TOKEN_COLOR.purple" />
            <text>谈单 PPT</text>
          </button>
          <button class="qd__tool-btn" :disabled="pdfBusy" @tap="openQuotePdf">
            <JzIcon name="download" :size="30" :color="TOKEN_COLOR.primary" />
            <text>{{ pdfBusy ? '生成中' : '打印稿' }}</text>
          </button>
        </view>
        <view class="qd__workflow-row">
          <button v-if="canAct && quote.status === 'draft'" class="jz-btn jz-btn--primary qd__workflow-primary" @tap="transition('submitted', '提交报价', '确认提交给客户确认？')">提交客户确认</button>
          <button v-if="canEdit && quote.status === 'draft' && ['package', 'hybrid'].includes(quote.mode)" class="jz-btn jz-btn--neutral qd__workflow-secondary" @tap="openAdjust">调整套餐</button>
          <template v-else-if="canAct && quote.status === 'submitted'">
            <button class="jz-btn jz-btn--ghost qd__workflow-secondary" @tap="transition('rejected', '驳回报价', '确认驳回该报价？')">驳回</button>
            <button class="jz-btn jz-btn--primary qd__workflow-primary" @tap="transition('accepted', '确认客户接受', '确认客户已接受该报价？')">客户已接受</button>
          </template>
          <button v-else-if="canConvert && quote.status === 'accepted'" class="jz-btn jz-btn--primary qd__workflow-primary" @tap="toProject">转为施工项目</button>
          <button v-else-if="canEdit && quote.status === 'rejected'" class="jz-btn jz-btn--primary qd__workflow-primary" @tap="rebaseRejected">改版重报</button>
          <view v-else class="qd__action-state"><JzIcon name="check-circle" :size="28" :color="TOKEN_COLOR.success" /><text>{{ quote.status === 'converted' ? '已转为施工项目' : quote.status === 'superseded' ? '该报价已被确认报价替代，仅保留历史记录' : '报价推进中' }}</text></view>
        </view>
      </view>
    </view>
  </view>
  <PageState v-else-if="loadingQuote" state="loading" :rows="5" />
  <PageState v-else-if="loadError" state="error" title="报价加载失败" :subtitle="loadError" @retry="load" />
  <PageState v-else state="empty" title="报价不存在或无权访问" />
</template>

<style lang="scss" scoped>
.qd { min-height: 100vh; padding: 24rpx 24rpx 176rpx; background: $jzb-bg-page; width: 100%; overflow-x: hidden; }
.qd--with-tools { padding-bottom: 296rpx; }
.qd__hero { padding: 34rpx 30rpx; color: $jzb-text-inverse; border-radius: $jzb-radius-lg; background: $jzb-gradient; box-shadow: $jzb-shadow-card; }
.qd__no { flex: 1; min-width: 0; font-size: $jzb-font-sm; opacity: .84; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.qd__status { flex-shrink: 0; margin-left: 12rpx; padding: 6rpx 16rpx; border-radius: $jzb-radius-pill; background: rgba(255,255,255,.18); font-size: $jzb-font-xs; }
.qd__amount { display: block; margin-top: 20rpx; font-size: 64rpx; font-weight: 750; letter-spacing: -2rpx; }
.qd__title { display: block; margin-top: 6rpx; font-size: $jzb-font-sm; opacity: .88; line-height: 1.45; }

/* 套餐来源条 */
.qd__package-source {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 16rpx;
  padding: 16rpx;
  border-radius: $jzb-radius-sm;
  background: rgba(255, 255, 255, 0.14);
  font-size: $jzb-font-xs;
}
.qd__package-label {
  flex-shrink: 0;
  padding: 4rpx 12rpx;
  border-radius: $jzb-radius-xs;
  background: rgba(255, 255, 255, 0.22);
  font-weight: 600;
}
.qd__package-name { flex: 1; min-width: 0; font-weight: 650; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.qd__package-meta { flex-shrink: 0; opacity: .82; white-space: nowrap; }

/* 同客户报价版本切换 */
.qd__customer-quotes { margin-top: 20rpx; }
.qd__cq-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 14rpx;
  padding: 0 4rpx;
}
.qd__cq-title { display: block; font-size: $jzb-font-md; font-weight: 700; color: $jzb-text-1; }
.qd__cq-subtitle { display: block; margin-top: 4rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.qd__cq-scroll { width: 100%; white-space: nowrap; }
.qd__cq-track { display: inline-flex; gap: 14rpx; padding: 4rpx 0 8rpx; }
.qd__cq-card {
  position: relative;
  flex-shrink: 0;
  width: 310rpx;
  padding: 22rpx;
  border-radius: $jzb-radius;
  background: $jzb-bg-card;
  border: 1rpx solid $jzb-border-light;
  box-shadow: $jzb-shadow-xs;
  transition: transform $jzb-duration-fast $jzb-ease-out;
  overflow: hidden;
}
.qd__cq-card:active { transform: scale(.97); }
.qd__cq-card--active {
  border-color: $jzb-primary;
  background: linear-gradient(135deg, $jzb-text-inverse, $jzb-primary-lightest);
  box-shadow: $jzb-shadow-float;
}
.qd__cq-card--active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20rpx;
  bottom: 20rpx;
  width: 6rpx;
  border-radius: 0 4rpx 4rpx 0;
  background: $jzb-primary;
}
.qd__cq-top { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.qd__cq-version { color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 700; }
.qd__cq-amount {
  display: block;
  margin-top: 14rpx;
  font-size: 42rpx;
  font-weight: 750;
  color: $jzb-text-1;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}
.qd__cq-meta {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 10rpx;
  color: $jzb-text-3;
  font-size: $jzb-font-xs;
}
.qd__cq-meta text { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.qd__cq-meta text:first-child { flex-shrink: 0; color: $jzb-primary-dark; font-weight: 650; }
.qd__cq-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6rpx;
  min-height: 50rpx;
  margin-top: 12rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid $jzb-border-light;
  color: $jzb-text-3;
  font-size: $jzb-font-xs;
}
.qd__cq-foot--active {
  justify-content: flex-start;
  color: $jzb-primary-dark;
  font-weight: 650;
}

.qd__hero-foot { display: flex; justify-content: space-between; gap: 14rpx; margin-top: 20rpx; font-size: $jzb-font-xs; opacity: .9; }
.qd__hero-foot text { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.qd__person { display: inline-flex; align-items: center; gap: 8rpx; min-width: 0; }
.qd__design { margin-top: 20rpx; padding: 24rpx; display: flex; align-items: center; transition: transform $jzb-duration-fast $jzb-ease-out; }
.qd__design:active { transform: scale(.988); background: $jzb-bg-hover; }
.qd__design-name { display: block; font-size: $jzb-font; font-weight: 650; line-height: 1.4; }
.qd__design-sub { display: block; margin-top: 5rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.qd__link { flex-shrink: 0; margin-left: 12rpx; color: $jzb-primary-dark; font-size: $jzb-font-xs; white-space: nowrap; }
.qd__detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 24rpx;
  padding: 0 4rpx;
}
.qd__detail-title { min-width: 0; }
.qd__detail-heading { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; line-height: 1.3; }
.qd__detail-count { display: block; margin-top: 3rpx; color: $jzb-text-4; font-size: 20rpx; line-height: 1.3; }
.qd__view-tools { display: flex; flex-shrink: 0; gap: 6rpx; padding: 4rpx; background: $jzb-primary-lightest; border-radius: $jzb-radius-sm; }
.qd__view-tool {
  min-height: 60rpx;
  padding: 0 12rpx;
  display: flex;
  align-items: center;
  gap: 6rpx;
  color: $jzb-text-3;
  border-radius: $jzb-radius-xs;
  font-size: 20rpx;
  font-weight: 600;
}
.qd__view-tool--active { color: $jzb-primary-dark; background: $jzb-text-inverse; box-shadow: $jzb-shadow-xs; }
.qd__view-count { opacity: .7; font-variant-numeric: tabular-nums; }
.qd__groups { display: flex; flex-direction: column; gap: 10rpx; }
.qd__group { padding: 14rpx 20rpx; }
.qd__group--open { padding-bottom: 2rpx; }
.qd__group-head { min-height: 60rpx; align-items: center; }
.qd__group--open .qd__group-head { padding-bottom: 16rpx; border-bottom: 1rpx solid $jzb-border-light; }
.qd__group-right { flex-shrink: 0; display: flex; align-items: center; gap: 10rpx; }
.qd__group-title { flex: 1; min-width: 0; display: flex; align-items: baseline; }
.qd__group-name { flex: 1; min-width: 0; font-size: $jzb-font; font-weight: 650; line-height: 1.35; }
.qd__group-type { color: $jzb-text-3; font-weight: 500; font-size: $jzb-font-xs; }
.qd__group-count { flex-shrink: 0; margin-left: 8rpx; color: $jzb-text-4; font-size: 20rpx; }
.qd__group-amount { color: $jzb-primary-dark; font-size: $jzb-font-sm; font-weight: 700; white-space: nowrap; }

.qd__delta--down { color: $jzb-danger !important; }

.qd__facts { margin-top: 22rpx; padding: 8rpx 26rpx; }
.qd__facts > view { display: flex; justify-content: space-between; gap: 16rpx; min-height: 82rpx; align-items: center; border-bottom: 1rpx solid $jzb-border-light; font-size: $jzb-font-sm; color: $jzb-text-2; }
.qd__facts > view text:first-child { flex-shrink: 0; }
.qd__facts > view text:last-child { min-width: 0; text-align: right; word-break: break-all; }
.qd__facts > view:last-child { border-bottom: none; }
.qd__facts > view text:last-child { color: $jzb-text-1; font-weight: 600; }
.qd__talk { margin-top: 22rpx; padding: 24rpx; display: flex; align-items: center; }
.qd__talk-icon { width: 76rpx; height: 76rpx; margin-right: 18rpx; display: flex; align-items: center; justify-content: center; background: $jzb-primary-lighter; border-radius: 22rpx; }
.qd__talk-title { display: block; font-size: $jzb-font; font-weight: 650; }
.qd__talk-sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.qd__gap { margin-top: 16rpx; }
.qd__actionbar { padding-top: 12rpx; }
.qd__actionbar-inner { flex-direction: column; align-items: stretch; gap: 12rpx; }
.qd__tool-row,
.qd__workflow-row { display: flex; align-items: stretch; gap: 12rpx; width: 100%; }
.qd__tool-btn {
  flex: 1;
  min-width: 0;
  height: 92rpx;
  margin: 0;
  padding: 0 10rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  border: none;
  border-radius: $jzb-radius-sm;
  color: $jzb-text-2;
  background: $jzb-primary-lightest;
  font-size: $jzb-font-xs;
  font-weight: 650;
  line-height: 1;
}
.qd__tool-btn::after { border: none; }
.qd__tool-btn[disabled] { opacity: .52; }
.qd__workflow-row .jz-btn { flex: 1; min-height: 92rpx; height: 92rpx; margin: 0; padding: 0 16rpx; font-size: $jzb-font-sm; }
.qd__workflow-primary { flex: 1.3 !important; }
.qd__action-state { flex: 1; min-height: 92rpx; display: flex; align-items: center; justify-content: center; gap: 8rpx; padding: 0 18rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; }
.qd__handoff { margin-top: 20rpx; padding: 24rpx; display: flex; align-items: center; gap: 16rpx; }
.qd__handoff--accepted { border: 1rpx solid rgba(14,138,125,.18); background: linear-gradient(135deg, $jzb-text-inverse, $jzb-primary-lightest); }
.qd__handoff--converted { border: 1rpx solid rgba(14,138,125,.18); background: linear-gradient(135deg, $jzb-text-inverse, $jzb-primary-lightest); }
.qd__handoff-title { display: block; font-size: $jzb-font; font-weight: 750; }
.qd__handoff-tip { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.qd__contract-empty, .qd__contract, .qd__changes { margin-bottom: 16rpx; padding: 24rpx; }
.qd__contract-empty { display: flex; align-items: center; gap: 16rpx; border: 1rpx dashed rgba(22,163,148,.28); background: $jzb-primary-lightest; }
.qd__down-eyebrow { display: block; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 700; }
.qd__down-title { display: block; margin-top: 5rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 750; }
.qd__down-sub { display: block; margin-top: 5rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.qd__down-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10rpx; margin-top: 18rpx; }
.qd__down-grid > view { padding: 16rpx 10rpx; text-align: center; background: $jzb-primary-lightest; border-radius: $jzb-radius-sm; }
.qd__down-grid text { display: block; }
.qd__down-grid text:first-child { font-size: $jzb-font-sm; font-weight: 700; word-break: break-all; }
.qd__down-grid text:last-child { margin-top: 4rpx; color: $jzb-text-3; font-size: 20rpx; }
.qd__down-actions { display: flex; align-items: center; gap: 12rpx; margin-top: 18rpx; }
.qd__change-link { flex: 0 0 auto; min-height: 64rpx; }
.qd__change-link text { margin-left: 6rpx; }
.qd__change-state { margin-left: auto; color: $jzb-text-3; font-size: $jzb-font-xs; text-align: right; }
.qd__collection { margin-top: 16rpx; padding: 16rpx 18rpx; border: 1rpx solid rgba(22,163,148,.16); border-radius: $jzb-radius-sm; background: $jzb-primary-lightest; }
.qd__collection--link:active { opacity: .82; }
.qd__collection-head { display: flex; align-items: center; gap: 12rpx; }
.qd__collection-title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.qd__collection-summary { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: 20rpx; }
.qd__collection-action { flex-shrink: 0; display: flex; align-items: center; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 650; }
.qd__collection-list { margin-top: 10rpx; border-top: 1rpx solid rgba(22,163,148,.12); }
.qd__collection-node { display: flex; align-items: center; gap: 10rpx; min-height: 54rpx; border-bottom: 1rpx solid rgba(22,163,148,.1); }
.qd__collection-node:last-child { border-bottom: none; }
.qd__collection-node-main { flex: 1; min-width: 0; }
.qd__collection-node-main text { display: block; }
.qd__collection-node-main text:first-child { overflow: hidden; color: $jzb-text-1; font-size: 22rpx; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.qd__collection-node-main text:last-child { margin-top: 2rpx; overflow: hidden; color: $jzb-text-3; font-size: 18rpx; text-overflow: ellipsis; white-space: nowrap; }
.qd__collection-ratio { flex: 0 0 54rpx; color: $jzb-primary-dark; font-size: 20rpx; font-weight: 650; text-align: right; }
.qd__collection-amount { flex: 0 0 120rpx; color: $jzb-text-1; font-size: 22rpx; font-weight: 700; text-align: right; }
.qd__collection-amount--down { color: $jzb-success; }
.qd__collection-node--adjusted { color: $jzb-warning; }
.qd__collection-empty { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; padding-top: 12rpx; color: $jzb-text-3; font-size: 20rpx; }
.qd__change-list { margin-top: 12rpx; }
.qd__change { display: flex; align-items: center; gap: 12rpx; padding: 16rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.qd__change:last-child { border-bottom: none; }
.qd__change-reason { display: block; font-size: $jzb-font-sm; font-weight: 650; }
.qd__change-amount { flex-shrink: 0; color: $jzb-danger; font-size: $jzb-font-sm; font-weight: 700; white-space: nowrap; }
.qd__change-amount--down { color: $jzb-success; }
.qd__change-actions { display: flex; gap: 12rpx; color: $jzb-primary-dark; font-size: $jzb-font-xs; }

</style>
