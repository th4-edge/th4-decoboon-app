<script setup lang="ts">
import { computed, ref } from 'vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import type { Customer, CustomerFollow } from '@/domains/crm/model'
import type { ContentAttributionConfidence, ContentAttributionType, LeadTouch } from '@/domains/content/model'
import type { Project } from '@/domains/project/model'
import type { Property } from '@/domains/property/model'
import type { Quote, QuoteStatus } from '@/domains/trade/model'
import type { Employee } from '@/domains/identity/model'
import { CUSTOMER_SOURCE_META, CUSTOMER_STAGE_META } from '@/domains/crm/meta'
import { crmApi } from '@/domains/crm/api'
import { leadTouchApi } from '@/domains/content/api'
import { identityApi } from '@/domains/identity/api'
import { projectApi } from '@/domains/project/api'
import { propertyApi } from '@/domains/property/api'
import { tradeApi } from '@/domains/trade/api'
import JzActionSheet from '@/components/JzActionSheet.vue'
import JzInputDialog from '@/components/JzInputDialog.vue'
import JzAvatar from '@/components/JzAvatar.vue'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzFloatAdd from '@/components/JzFloatAdd.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzTag from '@/components/JzTag.vue'
import HouseCard from '@/subpackages/customer/components/HouseCard/HouseCard.vue'
import SalesSteps, { type SalesStageKey } from '@/subpackages/customer/components/SalesSteps/SalesSteps.vue'
import { confirm, hideLoading, loading, toast, toastError } from '@/composables/toast'
import { followImageUrls, previewFollowImage } from '@/composables/useFollowImages'
import { designApi } from '@/domains/design/api'
import type { DesignScheme } from '@/domains/design/model'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'

type PrimaryActionKind = 'follow' | 'scheduleMeasure' | 'assignDesigner' | 'recordMeasure' | 'design' | 'quote' | 'project' | 'edit' | 'viewFlow'

interface PrimaryAction {
  kind: PrimaryActionKind
  label: string
}

const id = ref('')
const customer = ref<Customer | null>(null)
const follows = ref<CustomerFollow[]>([])
const contentTouches = ref<LeadTouch[]>([])
const contentTouchError = ref('')
const quotes = ref<Quote[]>([])
const designs = ref<DesignScheme[]>([])
const talkCount = ref(0)
const customerProjects = ref<Project[]>([])
const properties = ref<Property[]>([])
const activePropertyId = ref('')
const designers = ref<Employee[]>([])
const owners = ref<Employee[]>([])
const booted = ref(false)
const loadError = ref('')
const sectionError = ref('')
const actionLoading = ref(false)
const openDesignerOnLoad = ref(false)
const designerSheetOpen = ref(false)
const ownerSheetOpen = ref(false)
const dormantSheetOpen = ref(false)
const dormantTextOpen = ref(false)
const dormantReason = ref('')
const dormantReasonText = ref('')
/** FIX-006：评级依据从独立卡片改为评级标签旁的 ? 图标，点击弹出浮层。 */
const showGradePopup = ref(false)

const WAY_META: Record<CustomerFollow['way'], string> = {
  phone: '电话',
  visit: '到店/拜访',
  wechat: '微信',
  video: '视频',
  other: '其他'
}
const CONTENT_ATTRIBUTION_META: Record<ContentAttributionType, string> = {
  platform: '平台回传', uniqueCode: '专属入口', manual: '人工确认', selfReport: '客户自述', inference: '仅推断'
}
const CONTENT_CONFIDENCE_META: Record<ContentAttributionConfidence, { label: string; color: string }> = {
  high: { label: '高置信', color: TOKEN_COLOR.success },
  medium: { label: '中置信', color: TOKEN_COLOR.warning },
  low: { label: '低置信', color: TOKEN_COLOR.text3 }
}
const QUOTE_STATUS_META: Record<QuoteStatus, { label: string; color: string }> = {
  draft: { label: '草稿', color: TOKEN_COLOR.text3 },
  submitted: { label: '待客户确认', color: TOKEN_COLOR.warning },
  accepted: { label: '客户已接受', color: TOKEN_COLOR.success },
  rejected: { label: '已驳回', color: TOKEN_COLOR.danger },
  superseded: { label: '已被替代', color: TOKEN_COLOR.text3 },
  converted: { label: '已转项目', color: TOKEN_COLOR.purple }
}

const isMarketer = computed(() => session.role === 'marketer')
const isStoreManager = computed(() => session.role === 'storeManager')
const isTeamLeader = computed(() => session.role === 'teamLeader')
const isBoss = computed(() => session.role === 'boss')
const isDesigner = computed(() => session.role === 'designer')
const isFinance = computed(() => session.role === 'finance')
const canManageDormant = computed(() => isBoss.value || isMarketer.value || isStoreManager.value || isDesigner.value || isFinance.value)
const canSetDormant = computed(() => Boolean(customer.value && canManageDormant.value && !['sign', 'construction', 'done', 'lost', 'dormant'].includes(customer.value.stage)))
const dormantReasonActions = [
  { label: '装修计划延期', value: 'PlanPostponed' },
  { label: '预算或方案未定', value: 'BudgetUndecided' },
  { label: '决策未确定', value: 'DecisionPending' },
  { label: '客户要求暂缓联系', value: 'CustomerRequestedPause' },
  { label: '长期无法有效联系', value: 'ContactUnreachable' },
  { label: '线索待核实', value: 'LeadPendingVerification' },
  { label: '其他', value: 'Other' }
]
const isCustomerOwner = computed(() => Boolean(customer.value?.owner?.id && customer.value.owner.id === session.emp?.id))
const isAssignedDesigner = computed(() => Boolean(customer.value?.designer?.id && customer.value.designer.id === session.emp?.id))
const showMarketing = computed(() => isMarketer.value || isStoreManager.value || isFinance.value || isTeamLeader.value)
const canFollow = computed(() => can(session.role, 'act:followCustomer') && customer.value?.stage !== 'dormant')
const canQuote = computed(() => can(session.role, 'edit:quote'))
const canRecordWechat = computed(() => can(session.role, 'act:recordWechat'))
const canRecordVisit = computed(() => can(session.role, 'act:recordVisit'))
/**
 * 是否允许展示"约定量房"主按钮。
 * 业务口径：约定量房必须挂到具体房屋上，且这套房屋还没量过房。
 * - 不再用 customer.addr 判断：客户档案地址和房屋地址是两份数据，有客户地址不代表有房屋档案；
 * - 必须有 properties 数据（房屋档案）；
 * - 当前选中房屋尚未量房（latestMeasureAt 为空）。
 */
const canScheduleMeasure = computed(() => can(session.role, 'act:scheduleMeasure')
  && !!customer.value
  && properties.value.length > 0
  && !hasMeasureRecord.value
  && ['following', 'pendingMeasure'].includes(customer.value.stage)
  && (!customer.value.designer || isStoreManager.value || isFinance.value || session.role === 'boss' || isCustomerOwner.value || isAssignedDesigner.value))
const canRecordMeasure = computed(() => can(session.role, 'edit:design')
  && !!activeProperty.value && !activeProperty.value.latestMeasureAt)
const canAssignDesigner = computed(() => can(session.role, 'act:assignDesigner')
  && customer.value?.stage === 'pendingMeasure' && !!customer.value.measureAt)
/** 字段级变更/指定设计师入口：有 assignDesigner 权限即可，不受阶段限制（设计师离职、客户要求更换等场景）。 */
const canChangeDesigner = computed(() => can(session.role, 'act:assignDesigner'))
const canChangeOwner = computed(() => session.role === 'boss' || isStoreManager.value || isFinance.value)
const canDeleteCustomer = computed(() => session.role === 'boss')
const hasAddress = computed(() => !!customer.value?.addr?.trim())
const activeProperty = computed(() => properties.value.find((item) => item.id === activePropertyId.value)
  || properties.value[0] || null)
/** 当前选中房屋是否已量房（有 latestMeasureAt 即视为量过）。 */
const hasMeasureRecord = computed(() => !!activeProperty.value?.latestMeasureAt)
/**
 * 已约定的量房时间：仅当当前选中房屋尚未量房时才回显 customer.measureAt，
 * 否则房屋已经量完，再展示"约定时间"会误导。
 */
const scheduledAt = computed(() => {
  if (hasMeasureRecord.value) return ''
  return customer.value?.measureAt || ''
})
/**
 * 当前客户、当前房屋对应的项目。
 * 必须同时满足两个条件：
 *   1. project.customer.id === 当前客户 id（防御性校验，customerProjects 已按 customerId 拉取，这里双保险）；
 *   2. project.property.id === 当前选中的房屋 id。
 * 禁止使用 `|| customerProjects.value[0]` 兜底——历史上这个兜底会把 BOSS 视角下全公司项目列表
 * 的第一条（往往是别的客户，例如李明）错当成当前客户（例如跟进中的王武）的工地，
 * 导致详情页错误显示"查看工地"按钮，点击后跳转串号到他人工地。
 */
const project = computed(() => customerProjects.value.find(
  (item) => item.customer?.id === id.value && item.property?.id === activeProperty.value?.id
) ?? null)
const propertyQuotes = computed(() => activeProperty.value
  ? quotes.value.filter((item) => item.property?.id === activeProperty.value?.id)
  : [])
const confirmedQuote = computed(() => propertyQuotes.value.find((item) => item.status === 'converted')
  || propertyQuotes.value.find((item) => item.status === 'accepted')
  || null)
const activeQuote = computed(() => propertyQuotes.value.find((item) => !['rejected', 'superseded', 'accepted', 'converted'].includes(item.status)) || null)
const canEditPortrait = computed(() => ['boss', 'storeManager', 'finance', 'teamLeader', 'marketer', 'designer'].includes(session.role || ''))
function openPortraitEdit() { uni.navigateTo({ url: `${P.customerPortraitEdit}?customerId=${id.value}` }) }
function openTagManage() { uni.navigateTo({ url: `${P.customerTagManage}?customerId=${id.value}` }) }

const portraitFieldLabels: Array<[string, string]> = [
  ['decisionRole', '决策角色'], ['purpose', '装修动机'], ['houseCondition', '房屋现状'],
  ['startWindow', '计划开工'], ['style', '风格偏好'], ['eco', '环保要求'],
  ['household', '居住人口'], ['payment', '付款方式'], ['competitor', '竞品对比']
]
const portraitValueLabels: Record<string, Record<string, string>> = {
  decisionRole: { Self: '本人决策', Couple: '夫妻共同', Parents: '父母出资', Children: '子女代订', Unknown: '待确认' },
  purpose: { FirstHome: '自住首装', Improve: '改善', Wedding: '婚房', SchoolDistrict: '学区', Investment: '投资出租', Partial: '局部改造' },
  houseCondition: { Rough: '毛坯', Old: '旧房翻新', Refined: '精装改造', Pending: '待交付' },
  startWindow: { WithinOneMonth: '1个月内', OneToThreeMonths: '1-3个月', ThreeToSixMonths: '3-6个月', HalfYearPlus: '半年以上', Undecided: '待定' },
  style: { Modern: '现代简约', Luxury: '轻奢', NewChinese: '新中式', Cream: '奶油风', Wood: '原木', Industrial: '工业', Undecided: '待定' },
  eco: { Elder: '有老人', Infant: '有婴幼儿', Pregnant: '有孕妇', None: '无特殊要求' },
  household: { Single: '独居', Couple: '两口', ThreePlus: '三口及以上', ThreeGenerations: '三代同堂', Unknown: '待确认' },
  payment: { Full: '全款', Installment: '分期', Loan: '贷款', Unknown: '待确认' },
  competitor: { None: '未对比', ComparingOneTwo: '在对比1-2家', ComparingThreePlus: '在对比3家以上', ChosenOther: '已选定同行' }
}
const concernLabels: Record<string, string> = { Price: '价格', Duration: '工期', Quality: '质量', Eco: '环保', AfterSales: '售后' }

/** 客户标签：优先服务端，缺失时用本地事实兜底（与 Web 口径一致） */
const customerTagList = computed(() => {
  const tags = customer.value?.tags
  if (tags && tags.length) {
    return tags.map((tag) => ({ key: tag.key || `manual:${tag.id}`, label: tag.name, category: tag.category }))
  }
  const list: Array<{ key: string; label: string; category: string }> = []
  const current = customer.value
  if (!current) return list
  if (current.source) list.push({ key: `source:${current.source}`, label: CUSTOMER_SOURCE_META[current.source] || '其他', category: 'source' })
  if (current.wechatAdded) list.push({ key: 'wechat', label: '已加微信', category: 'behavior' })
  const visits = Number(current.visitCount || 0)
  if (visits >= 2) list.push({ key: 'visit:multi', label: '多次到店', category: 'behavior' })
  else if (visits === 1) list.push({ key: 'visit:once', label: '已到店', category: 'behavior' })
  if (current.measureAt || activeProperty.value?.latestMeasureAt) list.push({ key: 'measured', label: '已量房', category: 'behavior' })
  return list
})
const customerGrade = computed(() => customer.value?.grade)
const gradeText = computed(() => {
  const grade = customerGrade.value
  if (!grade) return ''
  return `评级 ${grade.level} · ${grade.score}`
})
const gradeDetail = computed(() => {
  const breakdown = customerGrade.value?.breakdown
  if (!breakdown?.length) return '根据客户跟进、到访、量房等信息自动评估'
  return breakdown.map((item) => `${item.label} ${item.score}/${item.weight || '-'}：${item.reason}`).join('\n')
})
const portraitItems = computed(() => {
  const portrait = customer.value?.portrait
  if (!portrait) return []
  const items = portraitFieldLabels
    .map(([key, label]) => ({ label, value: portraitValueLabels[key]?.[String((portrait as Record<string, unknown>)[key])] || '未填写' }))
    .filter((item) => item.value !== '未填写')
  const concerns = portrait.concerns || []
  if (concerns.length) items.push({ label: '主要顾虑', value: concerns.map((item) => concernLabels[item] || item).join('、') })
  return items
})

const marketingProgress = computed(() => {
  if (!customer.value) return '—'
  const map: Record<string, string> = {
    intention: '待首联',
    following: '跟进中',
    pendingMeasure: customer.value.designer ? '已指定设计师' : '待指定设计师',
    quote: '方案报价推进中',
    sign: '已签约',
    construction: '施工中',
    done: '已完工',
    lost: '已流失',
    dormant: '已休眠'
  }
  return map[customer.value.stage] || '—'
})
const salesStage = computed<SalesStageKey>(() => {
  if (!customer.value) return 'visit'
  if (project.value || confirmedQuote.value || activeQuote.value || ['quote', 'sign', 'construction', 'done'].includes(customer.value.stage)) return 'quote'
  // 历史坑 FIX-008：design 阶段必须以"当前选中房屋已量完房"为准，不能用客户级 customer.measureAt。
  // 多套房客户只要约定过一次量房，customer.measureAt 就永久有值，会导致所有房屋都被误判为 design 阶段，
  // 选中未量房房屋时主按钮错误显示"进入设计转化"，用户卡死无法进行下一步。
  if (customer.value.designer && activeProperty.value?.latestMeasureAt) return 'design'
  if (customer.value.measureAt || customer.value.stage === 'pendingMeasure') return 'measure'
  if (customer.value.stage === 'following') return 'follow'
  return 'visit'
})
const primaryAction = computed<PrimaryAction | null>(() => {
  if (customer.value?.stage === 'dormant') return null
  if (project.value) return { kind: 'project', label: '查看工地' }
  if (confirmedQuote.value || activeQuote.value) return { kind: 'quote', label: '查看报价流转' }
  if (isMarketer.value && (customer.value?.measureAt || activeProperty.value?.latestMeasureAt || customer.value?.designer)) {
    return { kind: 'viewFlow', label: '查看业务流转' }
  }
  if (salesStage.value === 'quote' && canQuote.value) return { kind: 'quote', label: '生成报价' }
  if (salesStage.value === 'design' && canQuote.value) return { kind: 'design', label: '进入设计转化' }
  if (salesStage.value === 'measure') {
    if (!customer.value?.measureAt && canScheduleMeasure.value) return { kind: 'scheduleMeasure', label: '约定量房' }
    if (customer.value?.measureAt && !customer.value.designer && canAssignDesigner.value) return { kind: 'assignDesigner', label: '指定设计师' }
    if (canRecordMeasure.value) return { kind: 'recordMeasure', label: '录入量房' }
  }
  if (salesStage.value === 'follow' && canFollow.value) {
    return canScheduleMeasure.value
      ? { kind: 'scheduleMeasure', label: '约定量房' }
      : { kind: 'follow', label: '写跟进' }
  }
  if (salesStage.value === 'visit' && canFollow.value) {
    return { kind: 'follow', label: '完成首次跟进' }
  }
  return null
})
const designerActions = computed(() => designers.value.map((item) => ({
  label: `${item.name}${item.store?.name ? ' · ' + item.store.name : ''}`
})))
const ownerActions = computed(() => owners.value.map((item) => ({
  label: `${item.name}${item.store?.name ? ' · ' + item.store.name : ''}`
})))

function formatDateTime(value?: string) {
  return value ? value.slice(0, 16).replace('T', ' ') : '—'
}

onLoad((query) => {
  id.value = query?.id || ''
  openDesignerOnLoad.value = query?.designer === 'change'
  if (!isLoggedIn()) {
    uni.reLaunch({ url: P.login })
    return
  }
  if (!id.value) {
    booted.value = true
    loadError.value = '客户信息不完整，请返回客户列表后重新打开'
  }
})
onShow(() => {
  if (id.value) void load()
})

async function onFollowImageError(item: CustomerFollow) {
  const urls = await followImageUrls(item, true)
  if (urls.length) item.imageUrls = urls
}

async function load() {
  loadError.value = ''
  sectionError.value = ''
  try {
    const detail = await crmApi.info(id.value)
    if (!detail) {
      customer.value = null
      loadError.value = '客户不存在或无权查看'
      return
    }
    customer.value = detail
    const [followResult, quoteResult, projectResult, propertyResult, designResult, contentTouchResult] = await Promise.allSettled([
      crmApi.follows(id.value),
      tradeApi.quotes({ customerId: id.value }),
      // 必须按当前客户拉项目：BOSS 视角下 project/project/page 默认返回全公司项目，
      // 不传 customerId 会把别人的项目混进 customerProjects，下游 project computed 再兜底取 [0]
      // 就会出现"跟进中客户显示查看工地、点击跳到别人工地"的串号问题。
      projectApi.list({ customerId: id.value }),
      propertyApi.list(id.value),
      designApi.schemes(id.value),
      leadTouchApi.list({ customerId: id.value })
    ])
    if (followResult.status === 'fulfilled') follows.value = followResult.value
    if (quoteResult.status === 'fulfilled') quotes.value = quoteResult.value
    if (projectResult.status === 'fulfilled') customerProjects.value = projectResult.value
    if (propertyResult.status === 'fulfilled') properties.value = propertyResult.value
    if (contentTouchResult.status === 'fulfilled') {
      contentTouches.value = contentTouchResult.value
      contentTouchError.value = ''
    } else {
      contentTouches.value = []
      contentTouchError.value = '内容归因暂不可确认'
    }
    if (designResult.status === 'fulfilled') {
      designs.value = designResult.value
      // 并行拉每套非归档方案的谈单材料数（N+1，方案数通常 1-3，可接受）
      const visibleDesigns = designs.value.filter((d) => d.status !== 'archived')
      const talkResults = await Promise.allSettled(
        visibleDesigns.map((d) => designApi.talks(d.id))
      )
      talkCount.value = talkResults.reduce((sum, r) =>
        r.status === 'fulfilled' ? sum + r.value.length : sum, 0)
    }
    const failed = [followResult, quoteResult, projectResult, propertyResult]
      .filter((item) => item.status === 'rejected')
    if (failed.length) sectionError.value = '部分关联数据加载失败，请重试'
    // 进入页面时优先把"有项目的那套房屋"作为选中房屋；customerProjects 已按 customerId 过滤，
    // 这里取到的 propertyId 一定属于当前客户。
    const defaultPropertyId = customerProjects.value.find((item) => item.customer?.id === id.value)?.property?.id
    const currentId = activePropertyId.value
    activePropertyId.value = properties.value.some((item) => item.id === currentId)
      ? currentId
      : defaultPropertyId || properties.value[0]?.id || ''
  } catch (error) {
    customer.value = null
    loadError.value = error instanceof Error ? error.message : '客户详情加载失败'
    toastError(error, '客户详情加载失败')
  } finally {
    booted.value = true
    if (openDesignerOnLoad.value) {
      openDesignerOnLoad.value = false
      if (canChangeDesigner.value) void assignDesigner()
    }
  }
}

function call() {
  if (!customer.value?.phone) return
  uni.makePhoneCall({ phoneNumber: customer.value.phone, fail: () => {} })
}
function copyPhone() {
  if (!customer.value?.phone) return
  uni.setClipboardData({
    data: customer.value.phone,
    success: () => uni.showToast({ title: '手机号已复制', icon: 'none' })
  })
}
function copyPropertyNo(value: string) {
  uni.setClipboardData({
    data: value,
    success: () => uni.showToast({ title: '房屋编号已复制', icon: 'none' })
  })
}
function follow() { uni.navigateTo({ url: `${P.customerFollow}?id=${id.value}` }) }
function openContentTouch(item: LeadTouch) {
  const contentId = item.employeeContent?.id
  if (contentId) uni.navigateTo({ url: `${P.employeeContentDetail}?contentId=${contentId}` })
}
function edit() { uni.navigateTo({ url: `${P.customerEdit}?id=${id.value}` }) }
function openDormantAction() {
  if (!customer.value || !canManageDormant.value) return
  if (customer.value.stage === 'dormant') {
    void confirm('恢复客户跟进', '恢复后客户将重新参与逾期、沉睡风险和工作台待办，是否继续？', '确认恢复')
      .then((ok) => { if (ok) void submitResume() })
    return
  }
  if (!canSetDormant.value) return
  dormantReason.value = ''
  dormantReasonText.value = ''
  dormantSheetOpen.value = true
}

function selectDormantReason(index: number) {
  const action = dormantReasonActions[index]
  if (!action) return
  dormantReason.value = action.value
  if (action.value === 'Other') {
    dormantTextOpen.value = true
    return
  }
  void submitDormant('')
}

async function submitDormant(reasonText: string) {
  if (!customer.value || !dormantReason.value) return
  if (dormantReason.value === 'Other' && !reasonText.trim()) {
    toast('请填写休眠原因')
    dormantTextOpen.value = true
    return
  }
  loading('保存中…')
  try {
    await crmApi.setDormant(customer.value.id, dormantReason.value, reasonText.trim() || undefined, stageApi(customer.value.stage))
    toast('已设为休眠客户', 'success')
    dormantTextOpen.value = false
    await load()
  } catch (error) {
    toastError(error, '休眠设置失败')
  } finally {
    hideLoading()
  }
}

async function submitResume() {
  if (!customer.value) return
  loading('恢复中…')
  try {
    await crmApi.resume(customer.value.id)
    toast('已恢复跟进', 'success')
    await load()
  } catch (error) {
    toastError(error, '恢复失败')
  } finally {
    hideLoading()
  }
}

function stageApi(stage: string): string {
  const map: Record<string, string> = {
    intention: 'New', following: 'Following', pendingMeasure: 'PendingMeasure', quote: 'Quoted',
    sign: 'Signed', construction: 'Serving', done: 'Finished', lost: 'Lost', dormant: 'Dormant'
  }
  return map[stage] || stage
}

function scheduleMeasure() {
  // 约定量房必须关联房屋：先有房屋档案（含详细地址）才能安排量房
  if (!properties.value.length) {
    void confirm('请先建立房屋档案', '约定量房需要关联具体房屋与详细地址，是否现在新增？', '新增房屋')
      .then((ok) => { if (ok) addProperty() })
    return
  }
  uni.navigateTo({ url: `${P.customerMeasure}?id=${id.value}&propertyId=${activeProperty.value?.id || ''}` })
}
function recordMeasure() { uni.navigateTo({ url: `${P.customerMeasureRecord}?customerId=${id.value}&propertyId=${activeProperty.value?.id || ''}` }) }
function toDesign() { uni.navigateTo({ url: `${P.designList}?customerId=${id.value}&propertyId=${activeProperty.value?.id || ''}` }) }
function toQuote() {
  if (confirmedQuote.value) { openQuote(confirmedQuote.value.id); return }
  if (activeQuote.value) { openQuote(activeQuote.value.id); return }
  if (!canQuote.value) return
  if (!hasAddress.value) { toast('请先补充房屋地址'); return }
  uni.navigateTo({ url: `${P.designList}?customerId=${id.value}&propertyId=${activeProperty.value?.id || ''}` })
}
function openQuote(quoteId: string) { uni.navigateTo({ url: `${P.quoteDetail}?id=${quoteId}` }) }
function openProject() { if (project.value) uni.navigateTo({ url: `${P.projectDetail}?id=${project.value.id}` }) }

async function runPrimaryAction() {
  const action = primaryAction.value
  if (!action) return
  if (action.kind === 'project') { openProject(); return }
  if (action.kind === 'quote') { toQuote(); return }
  if (action.kind === 'viewFlow') {
    uni.navigateTo({ url: `${P.customerFlow}?customerId=${id.value}&propertyId=${activeProperty.value?.id || ''}` })
    return
  }
  if (action.kind === 'design') { toDesign(); return }
  if (action.kind === 'follow') { follow(); return }
  if (action.kind === 'edit') { edit(); return }
  if (action.kind === 'scheduleMeasure') { scheduleMeasure(); return }
  if (action.kind === 'recordMeasure') { recordMeasure(); return }
  if (action.kind === 'assignDesigner') await assignDesigner()
}

function recordWechat() {
  if (!customer.value || !canRecordWechat.value) return
  uni.navigateTo({ url: `${P.customerWechatRecord}?customerId=${id.value}` })
}

async function recordVisit() {
  if (!customer.value || !canRecordVisit.value) return
  const nextCount = (customer.value.visitCount || 0) + 1
  const ok = await confirm('记录客户到店', `确认记录第 ${nextCount} 次到店？`, '记录到店')
  if (!ok) return
  loading('正在记录到店…')
  try {
    await crmApi.recordVisit(id.value)
    await load()
    toast(`已记录到店 ${customer.value?.visitCount || nextCount} 次`, 'success')
  } catch (error) {
    toastError(error, '到店记录失败')
  } finally {
    hideLoading()
  }
}

async function assignDesigner() {
  actionLoading.value = true
  try {
    if (!designers.value.length) {
      designers.value = (await identityApi.employees()).filter((item) => item.status === 'active')
    }
    if (!designers.value.length) {
      toast('当前范围暂无可指定人员')
      return
    }
    designerSheetOpen.value = true
  } catch (error) {
    toastError(error, '可指派人员加载失败')
  } finally {
    actionLoading.value = false
  }
}

async function assignOwner() {
  actionLoading.value = true
  try {
    const all = await identityApi.employees()
    const currentStoreId = session.emp?.store?.id
    owners.value = all.filter((item) => item.status === 'active'
      && (session.role === 'boss' || !currentStoreId || item.store?.id === currentStoreId))
    if (!owners.value.length) {
      toast('当前范围暂无可转交的客户负责人')
      return
    }
    ownerSheetOpen.value = true
  } catch (error) {
    toastError(error, '负责人列表加载失败')
  } finally {
    actionLoading.value = false
  }
}

async function onOwnerSelect(index: number) {
  const owner = owners.value[index]
  if (!owner || !customer.value) return
  loading('正在变更客户负责人…')
  try {
    customer.value = await crmApi.save({ id: id.value, owner })
    toast(`已变更客户负责人为 ${owner.name}`, 'success')
    await load()
  } catch (error) {
    toastError(error, '变更客户负责人失败')
  } finally {
    hideLoading()
  }
}

async function deleteCustomer() {
  if (!customer.value || !canDeleteCustomer.value) return
  const ok = await confirm(
    '删除客户',
    `确认删除 ${customer.value.name}（${customer.value.phone}）？仅无跟进、房屋、设计、报价、合同和项目事实的客户可以删除。`,
    '确认删除'
  )
  if (!ok) return
  loading('正在删除客户…')
  try {
    await crmApi.delete(id.value)
    toast('客户已删除', 'success')
    setTimeout(() => uni.navigateBack({ fail: () => uni.reLaunch({ url: P.customerList }) }), 400)
  } catch (error) {
    toastError(error, '客户删除失败')
  } finally {
    hideLoading()
  }
}

async function onDesignerSelect(index: number) {
  const designer = designers.value[index]
  if (!designer) return
  if (!activeProperty.value?.id) { toast('请先建立并选择装修房屋'); return }
  loading('正在更新负责设计师…')
  try {
    customer.value = await crmApi.handoff(id.value, designer.id, activeProperty.value.id)
    toast(`已更换负责设计师为 ${designer.name}`, 'success')
    await load()
  } catch (error) {
    toastError(error, '更换负责设计师失败')
  } finally {
    hideLoading()
  }
}

function addProperty() {
  if (!customer.value) return
  uni.navigateTo({ url: `${P.customerPropertyEdit}?customerId=${id.value}` })
}
/** 编辑房屋档案：跳到 property-edit 并带 propertyId，页面内部会走 update 分支。 */
function editProperty(property: Property) {
  uni.navigateTo({ url: `${P.customerPropertyEdit}?customerId=${id.value}&propertyId=${property.id}` })
}
/** 调整已约定的量房时间：measure 页 onLoad 会按 customer.measureAt 回填日期时间，保存即更新。 */
function rescheduleMeasure(property: Property) {
  uni.navigateTo({ url: `${P.customerMeasure}?id=${id.value}&propertyId=${property.id}` })
}
/** 查看量房记录：跳转到量房录入/详情页，页面内部按 propertyId 拉取已有量房数据回填。 */
function viewMeasure(property: Property) {
  uni.navigateTo({ url: `${P.customerMeasureRecord}?customerId=${id.value}&propertyId=${property.id}` })
}
</script>

<template>
  <view v-if="!customer && !booted" class="cd__loading"><JzSkeleton :rows="6" /></view>
  <view v-else-if="customer" class="cd">
    <view class="cd__head jz-card">
      <view class="cd__head-top">
        <JzAvatar :name="customer.name" :size="104" />
        <view class="cd__who">
          <view class="cd__identity">
            <text class="cd__name">{{ customer.name }}</text>
            <JzTag :text="CUSTOMER_STAGE_META[customer.stage].label" :color="CUSTOMER_STAGE_META[customer.stage].color" />
            <view v-if="customerGrade" class="cd__grade" :class="`cd__grade--${customerGrade.level.toLowerCase()}`">
              <text>{{ gradeText }}</text>
              <!-- FIX-006：评级依据入口从独立卡片改为 ? 图标，点击弹出浮层 -->
              <view v-if="customerGrade.breakdown?.length" class="cd__grade-help" @tap="showGradePopup = true">
                <JzIcon name="info" :size="24" color="currentColor" />
              </view>
            </view>
          </view>
          <view class="cd__contact">
            <JzIcon name="phone" :size="24" :color="TOKEN_COLOR.text3" />
            <!-- 空值统一为 —（§15.11），原"电话待补充"与客户信息区"—"写法不一致 -->
            <text>{{ customer.phone || '—' }}</text>
          </view>
          <view class="cd__tags">
            <text v-for="tag in customerTagList" :key="tag.key" class="cd__tag" :class="`cd__tag--${tag.category}`">{{ tag.label }}</text>
            <view v-if="canEditPortrait" class="cd__tag cd__tag--manage" @tap="openTagManage">
              <JzIcon name="plus" :size="20" :color="TOKEN_COLOR.primary" />
              <text>标签</text>
            </view>
          </view>
        </view>
      </view>
      <view class="cd__roles">
        <view class="cd__role" :class="{ 'cd__role--clickable': canChangeOwner }" @tap="canChangeOwner && assignOwner()">
          <text class="cd__role-label">客户负责人</text>
          <view class="cd__role-value-row">
            <JzEmployeeAvatar v-if="customer.owner" :src="customer.owner.avatarUrl || ''" :name="customer.owner.name" :role="customer.owner.role" :status="customer.owner.status" :size="52" />
            <text class="cd__role-value">{{ customer.owner?.name || '待分配' }}</text>
            <JzIcon v-if="canChangeOwner" name="arrow-right" :size="22" :color="TOKEN_COLOR.text3" />
          </view>
        </view>
        <view class="cd__role-divider" />
        <view class="cd__role" :class="{ 'cd__role--clickable': canChangeDesigner }" @tap="canChangeDesigner && assignDesigner()">
          <text class="cd__role-label">负责设计师</text>
          <view class="cd__role-value-row">
            <JzEmployeeAvatar v-if="customer.designer" :src="customer.designer.avatarUrl || ''" :name="customer.designer.name" :role="customer.designer.role" :status="customer.designer.status" :size="52" />
            <text class="cd__role-value">{{ customer.designer?.name || '待指派' }}</text>
            <JzIcon v-if="canChangeDesigner" name="arrow-right" :size="22" :color="TOKEN_COLOR.text3" />
          </view>
        </view>
      </view>
    </view>

    <view class="cd__contact-actions">
      <button class="jz-btn jz-btn--ghost jz-grow" @tap="call">
        <JzIcon name="phone" :size="28" :color="TOKEN_COLOR.primary" />
        <text>打电话</text>
      </button>
      <button class="jz-btn jz-btn--neutral jz-grow" @tap="copyPhone">
        <JzIcon name="copy" :size="28" :color="TOKEN_COLOR.text2" />
        <text>复制号码</text>
      </button>
    </view>

    <view v-if="canManageDormant && (customer.stage === 'dormant' || canSetDormant)" class="cd__contact-actions">
      <button class="jz-btn jz-btn--plain jz-btn--block" @tap="openDormantAction">
        {{ customer.stage === 'dormant' ? '恢复跟进' : '设为休眠客户' }}
      </button>
    </view>

    <SalesSteps
      :value="salesStage"
      :action-label="primaryAction?.label || ''"
      :action-loading="actionLoading"
      @action="runPrimaryAction"
    />

    <view v-if="sectionError" class="cd__inline-error jz-card" @tap="load">
      <JzIcon name="alert-circle" :size="30" :color="TOKEN_COLOR.danger" />
      <text>{{ sectionError }}</text>
      <text class="cd__inline-error-action">重试</text>
    </view>

    <view class="jz-section">
      <text class="jz-section__title">装修房屋（{{ properties.length }}）</text>
      <view class="cd__section-action" @tap="addProperty">
        <JzIcon name="plus" :size="22" :color="TOKEN_COLOR.primary" />
        <text>新增房屋</text>
      </view>
    </view>
    <scroll-view v-if="properties.length" scroll-x class="cd__properties" :show-scrollbar="false">
      <view class="cd__property-row">
        <HouseCard
          v-for="property in properties"
          :key="property.id"
          :property="property"
          :active="property.id === activeProperty?.id"
          :scheduled-at="property.id === activeProperty?.id ? scheduledAt : ''"
          @select="activePropertyId = $event.id"
          @copy="copyPropertyNo"
          @edit="editProperty"
          @reschedule="rescheduleMeasure"
          @viewMeasure="viewMeasure"
        />
      </view>
    </scroll-view>
    <view v-else class="jz-card cd__property-empty">
      <JzEmpty text="尚未建立房屋档案" sub="建立房屋后才能约定量房、设计和报价">
        <button class="jz-btn jz-btn--primary jz-btn--sm" @tap="addProperty">新增房屋</button>
      </JzEmpty>
    </view>

    <view class="jz-section">
      <text class="jz-section__title">客户信息</text>
      <view v-if="canFollow" class="cd__section-action" @tap="edit">
        <JzIcon name="edit" :size="22" :color="TOKEN_COLOR.primary" />
        <text>编辑资料</text>
      </view>
    </view>
    <view class="jz-card cd__info">
      <view class="cd__info-row"><text class="cd__info-label">来源</text><text class="cd__info-value">{{ CUSTOMER_SOURCE_META[customer.source] }}</text></view>
      <view class="cd__info-row"><text class="cd__info-label">房屋地址</text><text class="cd__info-value">{{ customer.addr || '—' }}</text></view>
      <view v-if="showMarketing" class="cd__info-row"><text class="cd__info-label">营销进度</text><text class="cd__info-value">{{ marketingProgress }}</text></view>
      <view class="cd__info-row"><text class="cd__info-label">意向小区</text><text class="cd__info-value">{{ customer.community || '—' }}</text></view>
      <view class="cd__info-row"><text class="cd__info-label">户型面积</text><text class="cd__info-value">{{ customer.area ? `${customer.area}㎡` : '—' }}</text></view>
      <view class="cd__info-row"><text class="cd__info-label">预算</text><text class="cd__info-value">{{ customer.budget ? `${customer.budget} 万` : '—' }}</text></view>
      <view class="cd__info-row"><text class="cd__info-label">备注</text><text class="cd__info-value">{{ customer.remark || '—' }}</text></view>
      <!-- GAP-1：原 SalesBoard 中的业务进度已由 SalesSteps 步骤条承载，这里仅下沉两个只读事实，不可点击、无 chevron -->
      <view class="cd__info-row"><text class="cd__info-label">谈单材料</text><text class="cd__info-value">{{ talkCount }} 份</text></view>
      <view class="cd__info-row"><text class="cd__info-label">转化项目</text><text class="cd__info-value">{{ project?.no || '—' }}</text></view>
    </view>

    <view class="jz-card cd__content-source">
      <view class="cd__section-head">
        <view><text class="cd__section-title">内容来源</text><text class="cd__content-source-sub">已关联到本客户的内容发布与归因员工</text></view>
      </view>
      <view v-if="contentTouches.length" class="cd__content-list">
        <view v-for="item in contentTouches.slice(0, 3)" :key="item.id" class="cd__content-item" @tap="openContentTouch(item)">
          <view class="cd__content-item-head">
            <text class="cd__content-item-title jz-ellipsis">{{ item.task?.title || item.employeeContent?.caption || '内容任务' }}</text>
            <JzTag :text="CONTENT_CONFIDENCE_META[item.confidence].label" :color="CONTENT_CONFIDENCE_META[item.confidence].color" />
          </view>
          <text class="cd__content-item-meta">{{ item.employee?.name || '—' }} · {{ CONTENT_ATTRIBUTION_META[item.attributionType] }} · {{ item.isPrimary ? '主归因' : '辅助触点' }}</text>
        </view>
        <text v-if="contentTouches.length > 3" class="cd__content-more">另有 {{ contentTouches.length - 3 }} 条触点，请在内容详情中查看。</text>
      </view>
      <text v-else class="cd__content-empty">{{ contentTouchError || '尚未关联内容来源；客户从短视频咨询进入后，可由内容详情登记归因。' }}</text>
    </view>

    <!-- FIX-006：客户画像从头部下方移到客户信息下方，符合"基础信息→画像→跟进"的阅读顺序 -->
    <view class="jz-card cd__portrait">
      <view class="cd__section-head">
        <text class="cd__section-title">客户画像</text>
        <view v-if="canEditPortrait" class="cd__section-action" @tap="openPortraitEdit">
          <JzIcon name="edit" :size="22" :color="TOKEN_COLOR.primary" />
          <text>{{ portraitItems.length ? '编辑画像' : '完善画像' }}</text>
        </view>
      </view>
      <view v-if="portraitItems.length" class="cd__portrait-grid">
        <view v-for="item in portraitItems" :key="item.label" class="cd__portrait-item">
          <text class="cd__portrait-label">{{ item.label }}</text>
          <text class="cd__portrait-value">{{ item.value }}</text>
        </view>
      </view>
      <text v-else class="cd__portrait-empty">尚未填写画像，补充决策角色、装修动机与工期后可提升跟进针对性。</text>
    </view>

    <view class="jz-section"><text class="jz-section__title">跟进记录</text></view>
    <view v-if="canRecordWechat || canRecordVisit" class="cd__follow-tools">
      <button v-if="canRecordWechat" class="jz-btn jz-btn--ghost cd__follow-tool" @tap="recordWechat">
        <JzIcon name="message" :size="28" :color="TOKEN_COLOR.primary" />
        <text>{{ customer.wechatAdded ? '更新微信' : '记录加微信' }}</text>
      </button>
      <button v-if="canRecordVisit" class="jz-btn jz-btn--neutral cd__follow-tool" @tap="recordVisit">
        <JzIcon name="check" :size="28" :color="TOKEN_COLOR.text2" />
        <text>记录到店 · {{ customer.visitCount || 0 }} 次</text>
      </button>
    </view>
    <view class="cd__follows">
      <view v-for="item in follows" :key="item.id" class="jz-card cd__follow">
        <view class="jz-between">
          <text class="cd__follow-way">{{ WAY_META[item.way] }}</text>
          <text class="cd__follow-time">{{ formatDateTime(item.createdAt) }}</text>
        </view>
        <text class="cd__follow-content">{{ item.content || '—' }}</text>
        <view v-if="item.imageUrls?.length" class="cd__follow-images">
          <image
            v-for="(url, index) in item.imageUrls"
            :key="url"
            class="cd__follow-image"
            :src="url"
            mode="aspectFill"
            @tap="previewFollowImage(item, index)"
            @error="onFollowImageError(item)"
          />
        </view>
        <text v-if="item.nextFollowAt" class="cd__follow-next">下次跟进：{{ item.nextFollowAt.slice(0, 10) }}</text>
      </view>
      <JzEmpty v-if="!follows.length" text="暂无跟进记录" sub="记录每次沟通，保持客户转化上下文" />
    </view>

    <view v-if="canDeleteCustomer" class="cd__danger-zone">
      <button class="jz-btn jz-btn--danger-ghost jz-btn--block" @tap="deleteCustomer">删除客户</button>
      <text>仅在客户没有跟进、房屋、设计、报价、合同和项目事实时可删除。</text>
    </view>

    <!-- FIX-006：评级依据浮层——点击头部评级旁的 ? 图标弹出，点击遮罩关闭 -->
    <view v-if="showGradePopup" class="cd__grade-mask" @tap="showGradePopup = false">
      <view class="cd__grade-popup" @tap.stop>
        <view class="cd__grade-popup-head">
          <text class="cd__grade-popup-title">评级依据</text>
          <text class="cd__grade-popup-sub">等级由系统根据以下维度自动计算</text>
        </view>
        <view class="cd__grade-popup-rows">
          <view v-for="item in customerGrade?.breakdown" :key="item.dimension" class="cd__grade-popup-row">
            <view class="cd__grade-popup-row-top">
              <text class="cd__grade-popup-row-label">{{ item.label }}</text>
              <text class="cd__grade-popup-row-score">{{ item.score }}/{{ item.weight || '-' }}</text>
            </view>
            <text class="cd__grade-popup-row-reason">{{ item.reason }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>

  <!--
    FIX-007：修复 v-else 链断裂 BUG——JzFloatAdd 曾插在主内容与错误态之间，
    导致 v-else-if="loadError" 和 v-else（客户不存在）错误挂到 JzFloatAdd 的 v-if 上。
    当主按钮本身是"写跟进"时（JzFloatAdd 不渲染），页面底部会误显示"客户不存在"。
    正确做法：错误/空态紧跟主内容的 v-else-if 链，JzFloatAdd 独立放在链外。
  -->
  <view v-else-if="loadError" class="cd__error">
    <JzIcon name="alert-circle" :size="72" :color="TOKEN_COLOR.danger" />
    <text class="cd__error-title">{{ loadError }}</text>
    <button class="jz-btn jz-btn--plain" @tap="load">重新加载</button>
  </view>
  <view v-else class="cd__error">
    <JzIcon name="inbox" :size="72" :color="TOKEN_COLOR.text4" />
    <text class="cd__error-title">客户不存在</text>
  </view>

  <!--
    右下角悬浮"写跟进"入口：与客户列表页"登记客户" FAB 同一交互样式。
    主按钮（SalesSteps 内）承担当前阶段唯一主 CTA（跟进阶段为"约定量房"），
    "写跟进"作为高频次级操作放在 FAB，避免底部固定栏和主 CTA 并列造成主次混淆。
    主按钮本身已是"写跟进"时（无地址、不能约定量房的纯跟进场景）不再重复展示 FAB。
  -->
  <JzFloatAdd
    v-if="customer && canFollow && primaryAction?.kind !== 'follow'"
    text="写跟进"
    icon="message"
    @tap="follow"
  />

  <JzActionSheet
    :visible="designerSheetOpen"
    title="选择负责设计师"
    :actions="designerActions"
    @select="onDesignerSelect"
    @update:visible="designerSheetOpen = $event"
  />

  <JzActionSheet
    :visible="dormantSheetOpen"
    title="选择休眠原因"
    :actions="dormantReasonActions"
    @select="selectDormantReason"
    @update:visible="dormantSheetOpen = $event"
  />

  <JzInputDialog
    v-model:visible="dormantTextOpen"
    v-model="dormantReasonText"
    title="填写休眠原因"
    label="其他原因"
    description="必须说明客户暂不推进的具体原因"
    placeholder="例如：客户计划明年再装修"
    multiline
    :maxlength="200"
    confirm-text="确认休眠"
    @confirm="submitDormant(dormantReasonText)"
  />

  <JzActionSheet
    :visible="ownerSheetOpen"
    title="选择客户负责人"
    :actions="ownerActions"
    @select="onOwnerSelect"
    @update:visible="ownerSheetOpen = $event"
  />
    <JzConfirmDialog />
</template>

<style lang="scss" scoped>
/* 底部留白：原底部固定栏已替换为右下角 FAB（JzFloatAdd），需要给 FAB 留出垂直空间，
   保证最后一条跟进记录可以滚动到 FAB 上方，不被遮挡。 */
.cd { padding-bottom: 260rpx; }
.cd__head { margin: 24rpx 24rpx 16rpx; padding: 32rpx; }
.cd__head-top { display: flex; align-items: center; }
.cd__who { flex: 1; min-width: 0; margin-left: 24rpx; }
.cd__grade { flex: 0 0 auto; display: inline-flex; align-items: center; white-space: nowrap; padding: 2rpx 14rpx; border-radius: 999rpx; font-size: 20rpx; font-weight: 700; }
.cd__grade--a { color: $jzb-primary-dark; background: $jzb-primary-lighter; }
.cd__grade--b { color: $jzb-info; background: $jzb-info-soft; }
.cd__grade--c { color: $jzb-text-3; background: $jzb-bg-page; }
/* FIX-006：评级标签内的 ? 图标 */
.cd__grade-help { display: flex; align-items: center; margin-left: 6rpx; opacity: 0.7; }
/* FIX-006：评级依据浮层 */
.cd__grade-mask { position: fixed; inset: 0; z-index: $jzb-z-popover; background: $jzb-bg-mask; display: flex; align-items: flex-end; }
.cd__grade-popup { width: 100%; padding: 40rpx 32rpx calc(40rpx + env(safe-area-inset-bottom)); background: $jzb-text-inverse; border-radius: 32rpx 32rpx 0 0; }
.cd__grade-popup-head { margin-bottom: 24rpx; }
.cd__grade-popup-title { display: block; font-size: 32rpx; font-weight: 700; color: $jzb-text-1; }
.cd__grade-popup-sub { display: block; margin-top: 6rpx; font-size: 22rpx; color: $jzb-text-3; }
.cd__grade-popup-rows { display: flex; flex-direction: column; gap: 20rpx; margin-bottom: 32rpx; }
.cd__grade-popup-row { padding: 20rpx; background: $jzb-bg-page; border-radius: 16rpx; }
.cd__grade-popup-row-top { display: flex; align-items: center; justify-content: space-between; }
.cd__grade-popup-row-label { font-size: 24rpx; font-weight: 600; color: $jzb-text-2; }
.cd__grade-popup-row-score { font-size: 24rpx; font-weight: 700; color: $jzb-primary-dark; }
.cd__grade-popup-row-reason { display: block; margin-top: 8rpx; font-size: 22rpx; color: $jzb-text-3; line-height: 1.5; }
.cd__tags { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 12rpx; }
.cd__tag { padding: 4rpx 14rpx; border-radius: 999rpx; font-size: 20rpx; }
.cd__tag--source { color: $jzb-primary-dark; background: $jzb-primary-lighter; }
.cd__tag--behavior { color: $jzb-info; background: $jzb-info-soft; }
.cd__tag--intent, .cd__tag--demand, .cd__tag--preference, .cd__tag--value { color: $jzb-purple; background: $jzb-purple-soft; }
.cd__tag--risk { color: $jzb-danger; background: $jzb-danger-soft; }
.cd__tag--manage { display: flex; align-items: center; gap: 4rpx; color: $jzb-primary-dark; background: transparent; border: 1rpx dashed $jzb-primary; }
.cd__section-action { display: flex; align-items: center; gap: 6rpx; color: $jzb-primary-dark; font-size: 22rpx; }
.cd__section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16rpx; }
.cd__section-title { color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.cd__section-more { color: $jzb-text-3; font-size: 20rpx; }
/* FIX-006：画像卡片与客户信息卡片对齐，加左右边距和上下间距 */
.cd__content-source { margin: 20rpx 24rpx; padding: 24rpx; }
.cd__content-source-sub { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: 20rpx; }
.cd__content-list { display: grid; gap: 12rpx; margin-top: 16rpx; }
.cd__content-item { padding: 18rpx; border: 1rpx solid $jzb-border-light; border-radius: 14rpx; background: $jzb-bg-page; }
.cd__content-item-head { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.cd__content-item-title { min-width: 0; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.cd__content-item-meta { display: block; margin-top: 10rpx; color: $jzb-text-3; font-size: 20rpx; }
.cd__content-more { display: block; color: $jzb-primary-dark; font-size: 20rpx; text-align: center; }
.cd__content-empty { display: block; margin-top: 14rpx; padding: 16rpx; color: $jzb-text-3; font-size: 22rpx; line-height: 1.6; background: $jzb-bg-page; border-radius: 12rpx; }
.cd__portrait { margin: 20rpx 24rpx; padding: 24rpx; }
.cd__grade-rows { margin-top: 16rpx; display: flex; flex-direction: column; gap: 12rpx; }
.cd__grade-row { display: flex; align-items: baseline; gap: 12rpx; }
.cd__grade-row-label { flex: 0 0 120rpx; color: $jzb-text-2; font-size: 22rpx; }
.cd__grade-row-score { flex: 0 0 90rpx; color: $jzb-primary-dark; font-size: 22rpx; font-weight: 700; }
.cd__grade-row-reason { flex: 1; color: $jzb-text-3; font-size: 20rpx; }
.cd__portrait-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12rpx; margin-top: 16rpx; }
.cd__portrait-item { padding: 14rpx; background: $jzb-bg-page; border-radius: 12rpx; }
.cd__portrait-label { display: block; color: $jzb-text-3; font-size: 20rpx; }
.cd__portrait-value { display: block; margin-top: 6rpx; color: $jzb-text-1; font-size: 24rpx; font-weight: 600; }
.cd__portrait-empty { display: block; margin-top: 14rpx; padding: 16rpx; color: $jzb-text-3; font-size: 22rpx; line-height: 1.6; background: $jzb-bg-page; border-radius: 12rpx; }
.cd__identity { display: flex; align-items: center; flex-wrap: wrap; gap: 8rpx; }
.cd__name { color: $jzb-text-1; font-size: $jzb-font-xl; font-weight: 700; }
.cd__contact { display: flex; align-items: center; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.cd__contact text { margin-left: 8rpx; }
.cd__roles { display: flex; align-items: center; margin-top: 24rpx; padding-top: 24rpx; border-top: 1rpx solid $jzb-border-light; }
.cd__role { flex: 1; min-width: 0; }
.cd__role--clickable:active { opacity: 0.6; }
.cd__role-label { display: block; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cd__role-value { display: block; margin-top: 8rpx; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 600; }
.cd__role-person { display: flex; align-items: center; gap: 10rpx; margin-top: 8rpx; }
.cd__role-person .cd__role-value { margin-top: 0; }
.cd__role-value-row { display: flex; align-items: center; gap: 8rpx; margin-top: 8rpx; }
.cd__role-value-row .cd__role-value { margin-top: 0; }
.cd__role-divider { width: 1rpx; height: 48rpx; margin: 0 24rpx; background: $jzb-border-light; }
.cd__contact-actions { display: flex; gap: 16rpx; margin: 0 24rpx 18rpx; }
.cd__contact-actions .jz-btn { margin: 0; }
.cd__loading { padding: 40rpx 28rpx 0; } .cd__properties { white-space: nowrap; padding: 0 24rpx 4rpx; } .cd__property-row { display: inline-flex; gap: 16rpx; }
.cd__property-empty { margin: 0 24rpx 18rpx; }
.cd__inline-error { margin: 0 24rpx 18rpx; padding: 22rpx 24rpx; display: flex; align-items: center; gap: 12rpx; color: $jzb-danger; font-size: $jzb-font-sm; }
.cd__inline-error-action { margin-left: auto; font-weight: 650; }
.cd__info { margin: 0 24rpx; padding: 8rpx 26rpx; }
.cd__info-row { display: flex; align-items: flex-start; padding: 20rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.cd__info-row:last-child { border-bottom: none; }
.cd__info-label { width: 160rpx; flex-shrink: 0; color: $jzb-text-3; font-size: $jzb-font-sm; }
.cd__info-value { flex: 1; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 500; line-height: 1.6; word-break: break-word; }
.cd__follow-tools { display: flex; gap: 16rpx; padding: 0 24rpx 8rpx; }
.cd__follow-tool { flex: 1; min-width: 0; margin: 0; font-size: $jzb-font-sm; }
.cd__follows { padding: 12rpx 24rpx 0; }
.cd__follow { padding: 24rpx; margin-bottom: 16rpx; }
.cd__follow-way { padding: 4rpx 16rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: $jzb-radius-pill; font-size: $jzb-font-sm; font-weight: 600; }
.cd__follow-time { color: $jzb-text-4; font-size: $jzb-font-xs; }
.cd__follow-content { display: block; margin-top: 14rpx; color: $jzb-text-1; font-size: $jzb-font-sm; line-height: 1.6; }
.cd__follow-images { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 14rpx; }
.cd__follow-image { width: 156rpx; height: 156rpx; border-radius: 12rpx; background: $jzb-bg-page; }
.cd__follow-next { display: block; margin-top: 12rpx; color: $jzb-warning; font-size: $jzb-font-xs; }
.cd__error { min-height: 70vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20rpx; padding: 40rpx; }
.cd__error-title { color: $jzb-text-2; font-size: $jzb-font-md; font-weight: 600; text-align: center; }
.cd__danger-zone { margin: 36rpx 24rpx 0; }
.cd__danger-zone text { display: block; margin-top: 12rpx; color: $jzb-text-3; text-align: center; font-size: 20rpx; }
</style>
