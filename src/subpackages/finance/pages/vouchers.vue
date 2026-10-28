<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { money } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import type { Voucher } from '@/domains/finance/model'
import { projectApi } from '@/domains/project/api'
import { identityApi } from '@/domains/identity/api'
import type { Employee } from '@/domains/identity/model'
import type { Project } from '@/domains/project/model'
import { isLoggedIn } from '@/domains/identity/session'
import { hideLoading, loading, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzSheet from '@/components/JzSheet.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'
import FinanceStoreScope from '@/components/FinanceStoreScope.vue'
import { useFinanceStoreScope } from '@/composables/useFinanceStoreScope'

type PeriodKey = 'all' | 'd3' | 'd7' | 'd15' | 'd30' | 'month' | 'lastMonth' | 'year' | 'custom'
type ProjectStatusFilter = 'all' | 'active' | 'done' | 'paused'
type TypeKey = 'all' | 'receipt' | 'payment'

/** 记住筛选维度：财务常按"本月 + 某项目"看账，每次重进都重置太费事。
 *  只记维度不记关键词——旧的搜索词会把列表清空，反而让人以为没有数据。 */
const FILTER_KEY = 'voucher_list_filter'

const keyword = ref('')
const typeFilter = ref<TypeKey>('all')
const period = ref<PeriodKey>('all')
const customMonth = ref('')
const projectId = ref('')
const projectName = ref('')
const items = ref<Voucher[]>([])
const loadingList = ref(false)
const loadError = ref('')
const busy = ref('')

const projectSheet = ref(false)
const projectKeyword = ref('')
const projectStatus = ref<ProjectStatusFilter>('all')
const projectDesignerId = ref('')
const sheetItems = ref<Project[]>([])
const sheetPage = ref(1)
const sheetTotal = ref(0)
const sheetHasMore = ref(false)
const sheetLoading = ref(false)
const sheetError = ref('')
const frequentProjects = ref<Project[]>([])
const designers = ref<Employee[]>([])

const hasKeyword = computed(() => keyword.value.trim().length > 0)
const hasFilter = computed(() => hasKeyword.value || typeFilter.value !== 'all' || period.value !== 'all'
  || Boolean(projectId.value) || Boolean(customMonth.value))
const isFirstUse = computed(() => !loadingList.value && !loadError.value && !items.value.length && !hasFilter.value)

const periodOptions: Array<{ label: string; value: PeriodKey }> = [
  { label: '全部', value: 'all' },
  { label: '近3天', value: 'd3' },
  { label: '近7天', value: 'd7' },
  { label: '近15天', value: 'd15' },
  { label: '近30天', value: 'd30' },
  { label: '本月', value: 'month' },
  { label: '上月', value: 'lastMonth' },
  { label: '今年', value: 'year' },
  { label: '选月份', value: 'custom' }
]
const projectStatusOptions: Array<{ label: string; value: ProjectStatusFilter }> = [
  { label: '全部', value: 'all' },
  { label: '在跑', value: 'active' },
  { label: '已完工', value: 'done' },
  { label: '暂停', value: 'paused' }
]
const ACTIVE_STATUSES: Project['status'][] = ['preparing', 'ongoing', 'accepting']
const DONE_STATUSES: Project['status'][] = ['finished', 'settled']
const STATUS_LABEL: Record<string, string> = {
  preparing: '待开工', ongoing: '施工中', accepting: '验收中',
  suspended: '暂停', finished: '已完工', settled: '已结算'
}
const typeOptions: Array<{ label: string; value: TypeKey }> = [
  { label: '全部', value: 'all' },
  { label: '收款', value: 'receipt' },
  { label: '付款', value: 'payment' }
]

/** 项目行副标题：编号 · 客户 · 设计师。 */
function projectMeta(item: Project) {
  return [item.no, item.customer?.name, item.designer?.name].filter(Boolean).join(' · ') || '—'
}

/** 已选项目展示名：优先用持久化的名称，避免重启后只剩"已选项目"。 */
const projectLabel = computed(() => (projectId.value ? (projectName.value || '已选项目') : '全部项目'))

/** 时间维度 → 服务端日期区间；"全部"不传区间。 */
const range = computed(() => {
  const now = new Date()
  const rollingDays: Partial<Record<PeriodKey, number>> = { d3: 3, d7: 7, d15: 15, d30: 30 }
  const days = rollingDays[period.value]
  if (days) return { start: dateBack(days - 1), end: dateOf(now) }
  if (period.value === 'month') return monthRange(now.getFullYear(), now.getMonth() + 1)
  if (period.value === 'lastMonth') {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return monthRange(prev.getFullYear(), prev.getMonth() + 1)
  }
  if (period.value === 'year') return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` }
  if (period.value === 'custom' && customMonth.value) {
    const [year, month] = customMonth.value.split('-').map(Number)
    if (year && month) return monthRange(year, month)
  }
  return { start: undefined as string | undefined, end: undefined as string | undefined }
})

const totals = ref({ count: 0, totalAmount: 0, receiptAmount: 0, paymentAmount: 0, monthlyAmounts: [] as Array<{ month: string; count: number; amount: number }> })

/** 列表按月份分组；组头金额取服务端全量月度汇总。 */
const monthAmounts = computed(() => new Map(totals.value.monthlyAmounts.map((item) => [item.month, item.amount])))
const groups = computed(() => {
  const map = new Map<string, Voucher[]>()
  items.value.forEach((item) => {
    const key = monthKeyOf(item)
    const list = map.get(key) || []
    list.push(item)
    map.set(key, list)
  })
  return [...map.entries()].map(([key, list]) => ({
    key,
    label: monthLabel(key),
    items: list,
    total: monthAmounts.value.get(key) || 0,
    totalCount: totals.value.monthlyAmounts.find((item) => item.month === key)?.count || list.length
  }))
})

/** 输入即搜：320ms 防抖；请求序号守卫防止旧响应覆盖新结果。 */
let searchTimer: ReturnType<typeof setTimeout> | undefined
let requestSeq = 0

onLoad(() => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  restoreFilter()
})
onShow(() => { if (isLoggedIn()) void load() })
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  const seq = ++requestSeq
  loadingList.value = true
  loadError.value = ''
  const params = {
    keyword: keyword.value.trim() || undefined,
    type: typeFilter.value === 'all' ? undefined : (typeFilter.value === 'receipt' ? 'Receipt' : 'Payment'),
    projectId: projectId.value || undefined,
    startDate: range.value.start,
    endDate: range.value.end
  }
  try {
    const [list, report] = await Promise.all([
      financeApi.vouchers(params),
      financeApi.voucherReport(params)
    ])
    if (seq !== requestSeq) return
    items.value = list
    totals.value = report
  } catch (error) {
    if (seq !== requestSeq) return
    loadError.value = error instanceof Error ? error.message : '凭证加载失败'
    toastError(error, '凭证加载失败')
  } finally {
    if (seq === requestSeq) loadingList.value = false
  }
}

/** 常用项目与设计师列表：只在进入页面时取一次。 */
async function bootSheetSources() {
  try {
    const [frequent, designerList] = await Promise.all([
      financeApi.frequentProjects(),
      identityApi.designers().catch(() => [] as Employee[])
    ])
    frequentProjects.value = frequent
    designers.value = designerList
  } catch {
    frequentProjects.value = []
  }
}

/** 当前状态分组对应的服务端状态集合。 */
function statusPayload() {
  if (projectStatus.value === 'active') return ACTIVE_STATUSES
  if (projectStatus.value === 'done') return DONE_STATUSES
  if (projectStatus.value === 'paused') return ['suspended' as Project['status']]
  return undefined
}

/** 服务端检索项目：关键词 + 状态分组 + 设计师，分页返回。 */
async function loadSheetProjects(reset = true) {
  if (reset) {
    sheetPage.value = 1
    sheetItems.value = []
    sheetHasMore.value = false
  }
  sheetLoading.value = true
  sheetError.value = ''
  try {
    const page = await projectApi.page({
      current: sheetPage.value,
      size: 20,
      keyword: projectKeyword.value,
      statuses: statusPayload(),
      designerId: projectDesignerId.value || undefined
    })
    sheetItems.value = reset ? page.list : [...sheetItems.value, ...page.list]
    sheetTotal.value = page.total ?? sheetItems.value.length
    sheetHasMore.value = page.hasMore
  } catch (error) {
    sheetError.value = error instanceof Error ? error.message : '项目加载失败'
  } finally {
    sheetLoading.value = false
  }
}

function loadMoreSheetProjects() {
  if (!sheetHasMore.value || sheetLoading.value) return
  sheetPage.value += 1
  void loadSheetProjects(false)
}

/** 弹层内筛选条件变化即重新检索（关键词防抖）。 */
let sheetTimer: ReturnType<typeof setTimeout> | undefined
function onSheetKeywordInput() {
  if (sheetTimer) clearTimeout(sheetTimer)
  sheetTimer = setTimeout(() => { void loadSheetProjects() }, 320)
}

function selectSheetStatus(value: ProjectStatusFilter) {
  projectStatus.value = value
  void loadSheetProjects()
}

function selectSheetDesigner(value: string) {
  projectDesignerId.value = value
  void loadSheetProjects()
}

function restoreFilter() {
  try {
    const raw = uni.getStorageSync(FILTER_KEY)
    if (!raw) return
    const saved = JSON.parse(String(raw)) as Partial<{ type: TypeKey; period: PeriodKey; month: string; projectId: string; projectName: string }>
    // 逐项校验枚举值，缓存被改坏时退回默认而不是让筛选项无选中
    if (saved.type === 'all' || saved.type === 'receipt' || saved.type === 'payment') typeFilter.value = saved.type
    if (saved.period === 'all' || saved.period === 'd3' || saved.period === 'd7' || saved.period === 'd15'
      || saved.period === 'd30' || saved.period === 'month' || saved.period === 'lastMonth'
      || saved.period === 'year' || saved.period === 'custom') period.value = saved.period
    if (saved.month) customMonth.value = saved.month
    if (saved.projectId) projectId.value = saved.projectId
    if (saved.projectName) projectName.value = saved.projectName
    // 自定义月份缺失时退回"全部"，避免筛选项看起来失效
    if (period.value === 'custom' && !customMonth.value) period.value = 'all'
  } catch {
    // 缓存损坏时按默认筛选
  }
}

function saveFilter() {
  try {
    uni.setStorageSync(FILTER_KEY, JSON.stringify({
      type: typeFilter.value,
      period: period.value,
      month: customMonth.value,
      projectId: projectId.value,
      projectName: projectName.value
    }))
  } catch {
    // 存储不可用时忽略，不影响筛选本身
  }
}

function onKeywordInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void load() }, 320)
}

function onSearchConfirm() {
  if (searchTimer) clearTimeout(searchTimer)
  void load()
}

function clearKeyword() {
  if (searchTimer) clearTimeout(searchTimer)
  keyword.value = ''
  void load()
}

function selectType(value: TypeKey) { typeFilter.value = value; saveFilter(); void load() }

function selectPeriod(value: PeriodKey) {
  period.value = value
  if (value !== 'custom') customMonth.value = ''
  saveFilter()
  void load()
}

function onCustomMonth(value: string) {
  customMonth.value = value || ''
  period.value = 'custom'
  saveFilter()
  void load()
}

function openProjectSheet() {
  projectKeyword.value = ''
  projectStatus.value = 'all'
  projectDesignerId.value = ''
  projectSheet.value = true
  void loadSheetProjects()
}

/** 选定项目：同时记住名称，重启后筛选卡仍能显示是哪个项目。 */
function selectProject(id: string, name = '') {
  projectId.value = id
  projectName.value = name
  projectSheet.value = false
  saveFilter()
  void load()
}

function resetFilters() {
  keyword.value = ''
  typeFilter.value = 'all'
  period.value = 'all'
  customMonth.value = ''
  projectId.value = ''
  projectName.value = ''
  saveFilter()
  void load()
}

function goLedger() { uni.navigateTo({ url: P.financeLedger }) }
function goTemplates() { uni.navigateTo({ url: P.financeVoucherTemplates }) }

async function open(item: Voucher) {
  if (!item.url) { uni.showToast({ title: '凭证地址已过期，请下拉刷新', icon: 'none' }); return }
  busy.value = item.id
  loading('打开凭证')
  try {
    await openPdf(item.url, item.fileName)
  } catch (error) {
    hideLoading()
    toastError(error, '凭证打开失败')
  } finally {
    hideLoading()
    busy.value = ''
  }
}

function pad(value: number) { return String(value).padStart(2, '0') }

function dateOf(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 含今天在内往前推 days 天的起始日期。 */
function dateBack(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return dateOf(date)
}

function monthRange(year: number, month: number) {
  const lastDay = new Date(year, month, 0).getDate()
  return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(lastDay)}` }
}

function monthKeyOf(item: Voucher) {
  const raw = String(item.generatedAt || '')
  return /^\d{4}-\d{2}/.test(raw) ? raw.slice(0, 7) : '未知月份'
}

function monthLabel(key: string) {
  if (key === '未知月份') return key
  const [year, month] = key.split('-')
  return `${year}年${Number(month)}月`
}

/** 下载后按业务文件名落盘再打开，转发或保存到手机时才不是随机临时名。 */
function openPdf(url: string, fileName?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    uni.downloadFile({
      url,
      success: (result) => {
        if (result.statusCode !== 200) { reject(new Error(`凭证下载失败(${result.statusCode})`)); return }
        const open = (filePath: string) => uni.openDocument({
          filePath, fileType: 'pdf', showMenu: true,
          success: () => resolve(),
          fail: (error) => reject(new Error(error.errMsg || '凭证打开失败'))
        })
        const safeName = safePdfName(fileName)
        const fs = uni.getFileSystemManager ? uni.getFileSystemManager() : undefined
        const userDataPath = (uni as unknown as { env?: { USER_DATA_PATH?: string } }).env?.USER_DATA_PATH
        if (!fs || !safeName || !userDataPath) { open(result.tempFilePath); return }
        const filePath = `${userDataPath}/${safeName}`
        try { fs.unlinkSync(filePath) } catch { /* 目标不存在则直接保存 */ }
        fs.saveFile({
          tempFilePath: result.tempFilePath, filePath,
          success: (saved) => open(saved.savedFilePath || result.tempFilePath),
          fail: () => open(result.tempFilePath)
        })
      },
      fail: (error) => reject(new Error(error.errMsg || '凭证下载失败'))
    })
  })
}

function safePdfName(fileName?: string): string {
  const safe = (fileName || '').replace(/[\\/:*?"<>|\s]/g, '').slice(0, 100)
  if (!safe) return ''
  return safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`
}

void bootSheetSources()
useFinanceStoreScope(() => load())
</script>

<template>
  <view class="fin-page">
    <JzPageHeader title="收付凭证" subtitle="按项目与月份查找，可打印归档" right-text="模板" @right="goTemplates" />
    <FinanceStoreScope />

    <view class="fin-body">
      <!-- 首次使用引导 -->
      <view v-if="isFirstUse" class="vc-guide">
        <text class="vc-guide__title">三步开出第一张凭证</text>
        <view class="vc-guide__step"><text class="vc-guide__no">1</text><text>在资金台账里选择收款或付款记录（可多选同类合并）</text></view>
        <view class="vc-guide__step"><text class="vc-guide__no">2</text><text>点"生成凭证"，系统按企业模板渲染 PDF</text></view>
        <view class="vc-guide__step"><text class="vc-guide__no">3</text><text>在这里查看、打印或转发归档</text></view>
        <view class="vc-guide__actions">
          <button class="vc-guide__btn vc-guide__btn--primary" @tap="goLedger">去资金台账出凭证</button>
          <button class="vc-guide__btn" @tap="goTemplates">看常用模板</button>
        </view>
      </view>

      <template v-else>
        <!-- 汇总 -->
        <view class="vc-summary">
          <view class="vc-summary__main">
            <text class="vc-summary__label">{{ hasFilter ? '筛选结果' : '全部凭证' }}</text>
            <text class="vc-summary__value">{{ money(totals.totalAmount) }}</text>
            <text class="vc-summary__sub">{{ totals.count }} 张凭证</text>
          </view>
          <view class="vc-summary__side">
            <view><text class="vc-summary__side-label">收款</text><text class="vc-summary__side-value">{{ money(totals.receiptAmount) }}</text></view>
            <view><text class="vc-summary__side-label">付款</text><text class="vc-summary__side-value">{{ money(totals.paymentAmount) }}</text></view>
          </view>
        </view>

        <!-- 搜索 -->
        <view class="vc__head">
          <view class="vc__search">
            <view class="vc__search-icon"><JzIcon name="search" :size="34" :color="TOKEN_COLOR.text3" /></view>
            <input
              v-model="keyword"
              placeholder="搜索凭证号 / 对方 / 项目"
              placeholder-class="vc__ph"
              confirm-type="search"
              @input="onKeywordInput"
              @confirm="onSearchConfirm"
            />
            <view v-if="hasKeyword" class="vc__clear" @tap="clearKeyword">
              <JzIcon name="close" :size="26" :color="TOKEN_COLOR.text3" />
            </view>
          </view>
        </view>

        <!-- 维度筛选：每个维度独立一行，避免挤在一行看不清 -->
        <view class="vc-filters">
          <view class="vc-filters__row">
            <text class="vc-filters__label">类型</text>
            <view class="vc-filters__chips">
              <view
                v-for="option in typeOptions"
                :key="option.value"
                class="vc-chip"
                :class="{ 'vc-chip--on': typeFilter === option.value }"
                @tap="selectType(option.value)"
              >{{ option.label }}</view>
            </view>
          </view>

          <view class="vc-filters__row">
            <text class="vc-filters__label">时间</text>
            <view class="vc-filters__chips">
              <view
                v-for="option in periodOptions"
                :key="option.value"
                class="vc-chip"
                :class="{ 'vc-chip--on': period === option.value }"
                @tap="selectPeriod(option.value)"
              >{{ option.label }}</view>
              <!-- 自定义年月随其他 chip 一起换行，避免挤出屏幕 -->
              <JzSelectField v-if="period === 'custom'" mode="date" fields="month" variant="boxed" :value="customMonth" :display="customMonth" placeholder="选择年月" @change="onCustomMonth" />
            </view>
          </view>

          <view class="vc-filters__row">
            <text class="vc-filters__label">项目</text>
            <view class="vc-project" @tap="openProjectSheet">
              <JzIcon name="briefcase" :size="26" :color="TOKEN_COLOR.text3" />
              <text class="vc-project__name">{{ projectLabel }}</text>
              <JzIcon name="chevron-down" :size="22" :color="TOKEN_COLOR.text4" />
            </view>
          </view>

          <view v-if="hasFilter" class="vc-filters__reset" @tap="resetFilters">
            <JzIcon name="refresh" :size="24" :color="TOKEN_COLOR.primary" /><text>重置筛选</text>
          </view>
        </view>

        <PageState v-if="loadError && !items.length" state="error" title="凭证加载失败" :subtitle="loadError" @retry="load" />
        <JzSkeleton v-else-if="loadingList && !items.length" :rows="4" />

        <!-- 按月份分组 -->
        <view v-for="group in groups" :key="group.key" class="vc-group">
          <view class="vc-group__head">
            <text class="vc-group__label">{{ group.label }}</text>
            <text class="vc-group__meta">{{ group.totalCount }} 张 · {{ money(group.total) }}</text>
          </view>
          <view v-for="item in group.items" :key="item.id" class="fin-card">
            <view class="fin-card__top">
              <view class="fin-card__title">
                {{ item.title }}
                <text class="fin-card__sub">{{ item.voucherNo }} · {{ item.generatedAt || '' }}</text>
              </view>
              <text class="fin-card__amount">{{ money(item.totalAmount) }}</text>
            </view>
            <view class="fin-card__facts">
              <view class="fin-fact"><JzIcon name="user" :size="22" :color="TOKEN_COLOR.text3" /><text>{{ item.partyName || item.worker?.name || '—' }}</text></view>
              <view class="fin-fact"><JzIcon name="briefcase" :size="22" :color="TOKEN_COLOR.text3" /><text>{{ item.project?.name || '企业通用' }}</text></view>
              <view class="fin-fact"><JzIcon name="file-text" :size="22" :color="TOKEN_COLOR.text3" /><text>{{ item.items.length }} 笔明细</text></view>
            </view>
            <view class="fin-card__foot">
              <text class="jz-caption">{{ item.amountWords }}</text>
              <text class="fin-card__link" @tap="open(item)">{{ busy === item.id ? '打开中…' : '查看 / 打印' }}</text>
            </view>
          </view>
        </view>

        <view v-if="!loadingList && !items.length" class="fin-empty">
          <JzEmpty
            v-if="hasFilter"
            text="没有匹配的凭证"
            sub="换个凭证号或对方，或调整月份与项目筛选"
          />
          <JzEmpty
            v-else
            text="暂无凭证"
            sub="在资金台账选择款项记录即可生成凭证"
          />
        </view>
      </template>
    </view>

    <!-- 项目选择弹层：项目多的时候用搜索 + 列表，而不是滚轮 -->
    <JzSheet :visible="projectSheet" title="选择项目" @close="projectSheet = false">
      <view class="ps">
        <view class="ps__search">
          <JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" />
          <input v-model="projectKeyword" class="ps__search-input" placeholder="搜索项目名 / 编号 / 客户 / 工地" @input="onSheetKeywordInput" />
          <text v-if="sheetLoading" class="ps__search-loading">检索中…</text>
        </view>

        <!-- 常用项目：按本企业凭证出单频次排序，没出过凭证时不显示 -->
        <view v-if="frequentProjects.length && !projectKeyword && projectStatus === 'all' && !projectDesignerId" class="ps__frequent">
          <text class="ps__flabel">常用</text>
          <view class="ps__chips">
            <view
              v-for="item in frequentProjects"
              :key="item.id"
              class="ps__chip"
              :class="{ 'ps__chip--on': projectId === item.id }"
              @tap="selectProject(item.id, item.name)"
            >{{ item.name }}</view>
          </view>
        </view>

        <view class="ps__filters">
          <view class="ps__frow">
            <text class="ps__flabel">状态</text>
            <view class="ps__chips">
              <view
                v-for="option in projectStatusOptions"
                :key="option.value"
                class="ps__chip"
                :class="{ 'ps__chip--on': projectStatus === option.value }"
                @tap="selectSheetStatus(option.value)"
              >{{ option.label }}</view>
            </view>
          </view>
          <view v-if="designers.length" class="ps__frow">
            <text class="ps__flabel">设计师</text>
            <view class="ps__chips">
              <view class="ps__chip" :class="{ 'ps__chip--on': !projectDesignerId }" @tap="selectSheetDesigner('')">全部</view>
              <view
                v-for="item in designers"
                :key="item.id"
                class="ps__chip ps__chip--person"
                :class="{ 'ps__chip--on': projectDesignerId === item.id }"
                @tap="selectSheetDesigner(item.id)"
              >
                <JzEmployeeAvatar :src="item.avatarUrl || ''" :name="item.name" :role="item.role" :status="item.status" :size="36" />
                <text>{{ item.name }}</text>
              </view>
            </view>
          </view>
        </view>

        <text class="ps__count">共 {{ sheetTotal }} 个项目</text>

        <scroll-view scroll-y class="ps__list" @scrolltolower="loadMoreSheetProjects">
          <view class="ps__item" :class="{ 'ps__item--on': !projectId }" @tap="selectProject('')">
            <view class="jz-grow"><text class="ps__name">全部项目</text><text class="ps__meta">不按项目筛选</text></view>
            <JzIcon v-if="!projectId" name="check" :size="28" :color="TOKEN_COLOR.primary" />
          </view>

          <view
            v-for="item in sheetItems"
            :key="item.id"
            class="ps__item"
            :class="{ 'ps__item--on': projectId === item.id }"
            @tap="selectProject(item.id, item.name)"
          >
            <JzEmployeeAvatar v-if="item.designer" :src="item.designer.avatarUrl || ''" :name="item.designer.name" :role="item.designer.role" :status="item.designer.status" :size="56" />
            <view class="jz-grow ps__item-main">
              <view class="ps__name-row">
                <text class="ps__name">{{ item.name }}</text>
                <text class="ps__tag" :class="ACTIVE_STATUSES.includes(item.status) ? 'ps__tag--on' : ''">{{ STATUS_LABEL[item.status] || item.status }}</text>
              </view>
              <text class="ps__meta">{{ projectMeta(item) }}</text>
            </view>
            <JzIcon v-if="projectId === item.id" name="check" :size="28" :color="TOKEN_COLOR.primary" />
          </view>

          <view v-if="sheetError" class="ps__state">
            <text>项目加载失败：{{ sheetError }}</text>
            <text class="ps__retry" @tap="loadSheetProjects()">重新加载</text>
          </view>
          <view v-else-if="sheetLoading && sheetItems.length" class="ps__state">加载中…</view>
          <view v-else-if="sheetHasMore" class="ps__state" @tap="loadMoreSheetProjects">加载更多</view>
          <JzEmpty v-else-if="!sheetItems.length && !sheetLoading" text="没有匹配的项目" sub="换个关键词，或调整状态与设计师" />
        </scroll-view>
      </view>
    </JzSheet>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';

.fin-card__link { color: $jzb-primary; font-size: $jzb-font-sm; }

.vc-guide { margin: 20rpx 0 8rpx; padding: 28rpx; background: $jzb-primary-lightest; border-radius: $jzb-radius; }
.vc-guide__title { display: block; margin-bottom: 16rpx; color: $jzb-primary-deep; font-size: $jzb-font-md; font-weight: 700; }
.vc-guide__step { display: flex; align-items: flex-start; gap: 12rpx; margin-bottom: 12rpx; color: $jzb-text-2; font-size: $jzb-font-sm; line-height: 1.6; }
.vc-guide__no {
  flex: none; width: 36rpx; height: 36rpx; margin-top: 4rpx; border-radius: 50%;
  background: $jzb-primary; color: #fff; font-size: 20rpx; text-align: center; line-height: 36rpx;
}
.vc-guide__actions { display: flex; gap: 16rpx; margin-top: 22rpx; }
.vc-guide__btn {
  flex: 1; height: 80rpx; line-height: 80rpx; border-radius: 999rpx; font-size: $jzb-font-sm;
  color: $jzb-primary-deep; background: $jzb-text-inverse; border: 1rpx solid rgba(22, 163, 148, .24);
}
.vc-guide__btn--primary { color: #fff; background: linear-gradient(135deg, $jzb-primary 0%, $jzb-primary-deep 100%); border-color: transparent; }

.vc-summary { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; margin: 20rpx 0 8rpx; padding: 28rpx; background: $jzb-bg-card; border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs; }
.vc-summary__label { display: block; color: $jzb-text-3; font-size: $jzb-font-xs; }
.vc-summary__value { display: block; margin-top: 6rpx; color: $jzb-text-1; font-size: 44rpx; font-weight: 750; }
.vc-summary__sub { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.vc-summary__side { flex: none; text-align: right; }
.vc-summary__side-label { display: block; color: $jzb-text-3; font-size: $jzb-font-xs; }
.vc-summary__side-value { display: block; margin: 4rpx 0 12rpx; color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 600; }

.vc__head { padding: 16rpx 0 8rpx; }
.vc__search { display: flex; align-items: center; height: 88rpx; padding: 0 24rpx; background: $jzb-text-inverse; border: 1rpx solid rgba(15, 23, 42, .045); border-radius: $jzb-radius-pill; box-shadow: $jzb-shadow-xs; }
.vc__search-icon { width: 40rpx; height: 40rpx; margin-right: 8rpx; display: flex; align-items: center; justify-content: center; }
.vc__search input { flex: 1; min-width: 0; font-size: $jzb-font; }
.vc__ph { color: $jzb-text-4; }
.vc__clear { width: 44rpx; height: 44rpx; margin-left: 8rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: $jzb-bg-page; }

.vc-filters { margin-top: 16rpx; padding: 24rpx 28rpx; background: $jzb-bg-card; border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs; }
.vc-filters__row { display: flex; align-items: flex-start; gap: 18rpx; padding: 12rpx 0; }
.vc-filters__row + .vc-filters__row { border-top: 1rpx solid $jzb-border-light; }
.vc-filters__label { flex: none; width: 72rpx; padding-top: 14rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.vc-filters__chips { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; gap: 12rpx; }
.vc-chip {
  display: inline-flex; align-items: center; gap: 6rpx; min-height: 60rpx; padding: 0 24rpx;
  color: $jzb-text-2; background: $jzb-bg-page; border: 1rpx solid transparent;
  border-radius: $jzb-radius-pill; font-size: $jzb-font-xs;
}
.vc-chip--on { color: $jzb-primary-deep; background: $jzb-primary-lighter; border-color: rgba(22, 163, 148, .24); font-weight: 650; }
.vc-chip--pick { color: $jzb-primary-dark; background: $jzb-text-inverse; border-color: $jzb-border-light; }
.vc-filters__reset {
  display: flex; align-items: center; justify-content: center; gap: 8rpx; margin-top: 16rpx;
  padding-top: 20rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-primary; font-size: $jzb-font-sm;
}

.vc-project {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 12rpx; min-height: 68rpx;
  padding: 0 22rpx; background: $jzb-bg-page; border-radius: $jzb-radius-sm;
}
.vc-project__name { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font-sm; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.vc-project__count { flex: none; color: $jzb-text-4; font-size: $jzb-font-xs; }

.vc-group { margin-top: 26rpx; }
.vc-group__head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 14rpx; }
.vc-group__label { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 650; }
.vc-group__meta { color: $jzb-text-3; font-size: $jzb-font-xs; }

.ps__search { display: flex; align-items: center; gap: 12rpx; height: 84rpx; padding: 0 24rpx; background: $jzb-bg-page; border-radius: $jzb-radius-sm; }
.ps__search-input { flex: 1; min-width: 0; font-size: $jzb-font-sm; }
.ps__frequent { display: flex; align-items: flex-start; gap: 14rpx; margin-top: 16rpx; }
.ps__search-loading { flex: none; color: $jzb-text-4; font-size: $jzb-font-xs; }
.ps__state { padding: 24rpx 0; text-align: center; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ps__retry { margin-left: 12rpx; color: $jzb-primary; }
.ps__filters { margin-top: 18rpx; }
.ps__frow { display: flex; align-items: flex-start; gap: 14rpx; padding: 8rpx 0; }
.ps__flabel { flex: none; width: 72rpx; padding-top: 12rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ps__chips { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; gap: 10rpx; }
.ps__chip {
.ps__chip--person { display: inline-flex; align-items: center; gap: 6rpx; padding-left: 6rpx; }
.ps__item-main { margin-left: 14rpx; }
  display: inline-flex; align-items: center; min-height: 56rpx; padding: 0 20rpx;
  color: $jzb-text-2; background: $jzb-bg-page; border: 1rpx solid transparent;
  border-radius: $jzb-radius-pill; font-size: $jzb-font-xs;
}
.ps__chip--on { color: $jzb-primary-deep; background: $jzb-primary-lighter; border-color: rgba(22, 163, 148, .24); font-weight: 650; }
.ps__count { display: block; margin-top: 10rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ps__list { max-height: 52vh; margin-top: 8rpx; }
.ps__name-row { display: flex; align-items: center; gap: 10rpx; }
.ps__tag {
  flex: none; padding: 2rpx 12rpx; border-radius: 999rpx; background: $jzb-bg-page;
  color: $jzb-text-3; font-size: 20rpx;
}
.ps__tag--on { background: $jzb-primary-lighter; color: $jzb-primary-deep; }
.ps__item { display: flex; align-items: center; gap: 16rpx; padding: 22rpx 8rpx; border-bottom: 1rpx solid $jzb-border-light; }
.ps__item--on .ps__name { color: $jzb-primary-deep; font-weight: 650; }
.ps__name { display: block; color: $jzb-text-1; font-size: $jzb-font; }
.ps__meta { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
</style>
