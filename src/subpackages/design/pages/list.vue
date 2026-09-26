<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import type { Customer } from '@/domains/crm/model'
import type { DesignRequirement, DesignScheme, TalkPlan, DesignStatus } from '@/domains/design/model'
import type { Quote } from '@/domains/trade/model'
import type { Project } from '@/domains/project/model'
import type { Property } from '@/domains/property/model'
import { designApi, designMeta } from '@/domains/design/api'
import { crmApi } from '@/domains/crm/api'
import { propertyApi } from '@/domains/property/api'
import { tradeApi } from '@/domains/trade/api'
import { projectApi } from '@/domains/project/api'
import { money } from '@/core/format'
import { confirm, hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzFloatAdd from '@/components/JzFloatAdd.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'

const customerId = ref('')
const propertyId = ref('')
const customer = ref<Customer | null>(null)
const property = ref<Property | null>(null)
const requirements = ref<DesignRequirement[]>([])
const designs = ref<DesignScheme[]>([])
const quotes = ref<Quote[]>([])
const talks = ref<Record<string, TalkPlan>>({})
const project = ref<Project | null>(null)
const loadingData = ref(false)
const hasLoadedOnce = ref(false)
const loadError = ref('')
const copyingId = ref('')
const deletingId = ref('')
const focusDesign = ref(false)
let loadSeq = 0

const quotableDesigns = computed(() =>
  designs.value.filter((item) =>
    ['ready', 'presented', 'selected'].includes(item.status)
    && (item.spaces?.length || 0) > 0
    && (item.items?.length || 0) > 0
  )
)
const readyCount = computed(() => quotableDesigns.value.length)
const totalItems = computed(() => designs.value.reduce((sum, item) => sum + (item.items?.length || 0), 0))
const totalSpaces = computed(() => designs.value.reduce((sum, item) => sum + (item.spaces?.length || 0), 0))
const designQuotes = computed(() =>
  quotes.value.filter((item) => item.design?.id && item.status !== 'rejected' && item.status !== 'superseded')
)
const talkCount = computed(() => Object.keys(talks.value).length)
const canEdit = computed(() => can(session.role, 'edit:design'))
const canTalk = computed(() => can(session.role, 'act:talk'))
const canManageCatalog = computed(() => can(session.role, 'edit:catalog'))
const locked = computed(() =>
  !!project.value || quotes.value.some((item) => item.status === 'accepted' || item.status === 'converted')
)
const lockTitle = computed(() => project.value ? '该房屋已转为唯一施工项目' : '该房屋已有客户确认报价')
const lockTip = computed(() => project.value
  ? '设计方案和报价已锁定，后续调整必须通过合同变更单，不能再新建方案或报价。'
  : '客户已确认报价，当前房屋进入签约阶段，方案与报价暂不可继续编辑或新增。')

const highPriorityReqs = computed(() =>
  [...requirements.value]
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 } as const
      return rank[a.priority] - rank[b.priority]
    })
    .slice(0, 3)
)
const portraitSummary = computed(() => {
  const portrait = customer.value?.portrait
  if (!portrait) return { has: false, decisionRole: '', style: '', household: '' }
  const decisionRole = portrait.decisionRole
    ? ({ Self: '本人决策', Couple: '夫妻共同', Parents: '父母出资', Children: '子女代订', Unknown: '待确认' } as Record<string, string>)[portrait.decisionRole] || ''
    : ''
  const style = portrait.style
    ? ({ Modern: '现代简约', Luxury: '轻奢', NewChinese: '新中式', Cream: '奶油风', Wood: '原木', Industrial: '工业', Undecided: '待定' } as Record<string, string>)[portrait.style] || ''
    : ''
  const household = portrait.household
    ? ({ Single: '独居', Couple: '两口', ThreePlus: '三口及以上', ThreeGenerations: '三代同堂', Unknown: '待确认' } as Record<string, string>)[portrait.household] || ''
    : ''
  return { has: !!(decisionRole || style || household), decisionRole, style, household }
})

onLoad((query) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  customerId.value = query?.customerId || ''
  propertyId.value = query?.propertyId || ''
  focusDesign.value = query?.focusDesign === '1' || query?.focusDesign === 1
  if (!customerId.value) {
    toast('缺少客户信息')
    setTimeout(() => uni.navigateBack(), 500)
  }
})
onShow(() => { setTimeout(() => { if (customerId.value) void load() }, 0) })
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  const seq = ++loadSeq
  loadingData.value = true
  loadError.value = ''
  try {
    const results = await Promise.allSettled([
      crmApi.info(customerId.value),
      designApi.requirements(customerId.value, propertyId.value || undefined),
      designApi.schemes(customerId.value),
      tradeApi.quotes({ customerId: customerId.value }),
      projectApi.list(),
      propertyApi.list(customerId.value)
    ])
    if (seq !== loadSeq) return

    const [customerResult, requirementResult, schemeResult, quoteResult, projectResult, propertyResult] = results
    if (customerResult.status === 'rejected') throw customerResult.reason

    const failures: string[] = []
    customer.value = customerResult.value
    if (requirementResult.status === 'fulfilled') requirements.value = requirementResult.value
    else { requirements.value = []; failures.push('诉求') }
    if (quoteResult.status === 'fulfilled') {
      quotes.value = quoteResult.value.filter((item) => !propertyId.value || item.property?.id === propertyId.value)
    } else { quotes.value = []; failures.push('报价') }
    if (projectResult.status === 'fulfilled') {
      project.value = projectResult.value.find((item) => item.customer?.id === customerId.value
        && (!propertyId.value || item.property?.id === propertyId.value)) || null
    } else { project.value = null; failures.push('项目') }
    if (propertyResult.status === 'fulfilled') {
      property.value = propertyResult.value.find((item) => item.id === propertyId.value) || propertyResult.value[0] || null
    } else { property.value = null; failures.push('房屋') }

    if (schemeResult.status === 'fulfilled') {
      const activeSchemes = schemeResult.value.filter((item) => item.status !== 'archived'
        && (!propertyId.value || item.property?.id === propertyId.value))
      const detailResults = await Promise.allSettled(activeSchemes.map((item) => designApi.scheme(item.id)))
      if (seq !== loadSeq) return
      const details = detailResults.flatMap((item) => item.status === 'fulfilled' ? [item.value] : [])
      if (detailResults.some((item) => item.status === 'rejected')) failures.push('方案详情')
      designs.value = details
      const talkTargets = details.filter((item) =>
        ['ready', 'presented', 'selected'].includes(item.status) && (item.spaces?.length || 0) > 0
      )
      const talkPairs = await Promise.all(talkTargets.map(async (item) => [
        item.id, (await designApi.talks(item.id).catch(() => []))[0]
      ] as const))
      talks.value = Object.fromEntries(talkPairs.filter(([, talk]) => !!talk)) as Record<string, TalkPlan>
    } else {
      designs.value = []
      talks.value = {}
      failures.push('设计方案')
    }

    if (failures.length) loadError.value = `${failures.join('、')}加载失败，以下内容可能不完整`
    hasLoadedOnce.value = true
  } catch (error) {
    if (seq === loadSeq) {
      loadError.value = error instanceof Error ? error.message : '设计转化数据加载失败'
      toastError(error, '设计转化数据加载失败')
    }
  } finally {
    if (seq === loadSeq) loadingData.value = false
  }
}

function quoteOf(designId: string) {
  return quotes.value.find((quote) => quote.design?.id === designId && quote.status === 'converted')
    || quotes.value.find((quote) => quote.design?.id === designId && quote.status === 'accepted')
    || quotes.value.find((quote) => quote.design?.id === designId && quote.status !== 'rejected' && quote.status !== 'superseded') || null
}

interface DesignWithQuote {
  design: DesignScheme
  quote: Quote | null
}
/** design 与对应报价配对缓存，避免模板中重复遍历 quotes */
const designWithQuote = computed<DesignWithQuote[]>(() =>
  designs.value.map((design) => ({ design, quote: quoteOf(design.id) }))
)

function openRequirement() {
  uni.navigateTo({ url: `${P.designRequirement}?customerId=${customerId.value}&propertyId=${propertyId.value}` })
}
function createScheme() {
  if (locked.value) { toast(lockTip.value); return }
  uni.navigateTo({ url: `${P.designScheme}?customerId=${customerId.value}&propertyId=${propertyId.value}` })
}
function editScheme(id: string) {
  uni.navigateTo({ url: `${P.designScheme}?customerId=${customerId.value}&propertyId=${propertyId.value}&designId=${id}` })
}
async function copyScheme(design: DesignScheme) {
  if (locked.value) { toast(lockTip.value); return }
  if (copyingId.value) return
  copyingId.value = design.id
  loading('复制设计方案…')
  try {
    const copied = await designApi.copyScheme(design.id, customerId.value, propertyId.value)
    await load()
    toast(`已复制为「${copied.name}」`, 'success')
    setTimeout(() => editScheme(copied.id), 350)
  } catch (error) {
    toastError(error, '复制设计方案失败')
  } finally {
    hideLoading()
    copyingId.value = ''
  }
}
async function deleteScheme(design: DesignScheme) {
  if (design.status !== 'draft') {
    toast('只有未完成的设计方案可以删除')
    return
  }
  if (deletingId.value) return
  const ok = await confirm('删除设计方案', `确认删除“${design.name}”？区域、分项和图片会一并删除。`, '删除')
  if (!ok) return
  deletingId.value = design.id
  loading('删除设计方案…')
  try {
    await designApi.deleteScheme(design.id)
    await load()
    toast('设计方案已删除', 'success')
  } catch (error) {
    toastError(error, '删除设计方案失败')
  } finally {
    hideLoading()
    deletingId.value = ''
  }
}
function openCatalogManage() { uni.navigateTo({ url: P.catalogManage }) }
function openQuote(id: string) { uni.navigateTo({ url: `${P.quoteDetail}?id=${id}` }) }
function openProject() {
  if (project.value) uni.navigateTo({ url: `${P.projectDetail}?id=${project.value.id}` })
}
function openTalk(id: string) { uni.navigateTo({ url: `${P.designTalk}?talkId=${id}` }) }
function openGeneration(design: DesignScheme) { uni.navigateTo({ url: `${P.designGeneration}?designId=${design.id}` }) }

async function generateQuote(design: DesignScheme) {
  if (locked.value) { toast(lockTip.value); return }
  if (design.status === 'draft') {
    loading('准备设计方案…')
    try {
      await designApi.buildScheme(design.id, 'ready')
      hideLoading()
    } catch (error) {
      hideLoading()
      toastError(error, '设计方案准备失败')
      return
    }
  }
  uni.navigateTo({
    url: `${P.quoteConfirm}?designId=${design.id}&customerId=${customerId.value}&propertyId=${propertyId.value}`
  })
}

async function generateTalk(design: DesignScheme) {
  loading('生成谈单PPT…')
  try {
    if (design.status === 'draft') await designApi.buildScheme(design.id, 'ready')
    const quote = quoteOf(design.id)
    const talk = await designApi.buildTalk(design.id, quote?.id)
    hideLoading()
    toast('谈单PPT已生成', 'success')
    setTimeout(() => openTalk(talk.id), 350)
  } catch (error) {
    hideLoading()
    toastError(error, '谈单PPT生成失败')
  }
}

function statusClass(status: DesignStatus) {
  const map: Record<DesignStatus, string> = {
    draft: 'dl__status--draft',
    ready: 'dl__status--ready',
    presented: 'dl__status--presented',
    selected: 'dl__status--selected',
    archived: 'dl__status--draft'
  }
  return map[status] || 'dl__status--draft'
}
</script>

<template>
  <view class="dl">
    <view v-if="loadError" class="jz-card dl__load-error">
      <JzIcon name="alert-circle" :size="30" :color="TOKEN_COLOR.danger" />
      <view class="jz-grow">
        <text class="dl__load-error-title">部分数据加载失败</text>
        <text class="dl__load-error-text">{{ loadError }}</text>
      </view>
      <button class="jz-btn jz-btn--ghost jz-btn--sm" @tap="load">重试</button>
    </view>

    <view class="dl__customer-bar">
      <text class="dl__customer-bar-name">{{ customer?.name || '客户' }}</text>
      <text class="dl__customer-bar-phone">{{ customer?.phone || '—' }}</text>
      <text v-if="customer?.grade" class="dl__customer-bar-grade">{{ customer.grade.level }}级</text>
      <view class="dl__customer-bar-owner">
        <JzEmployeeAvatar v-if="customer?.owner" :src="customer.owner.avatarUrl || ''" :name="customer.owner.name" :role="customer.owner.role" :status="customer.owner.status" :size="40" />
        <text>顾问 {{ customer?.owner?.name || '待分配' }}</text>
      </view>
    </view>
    <view class="jz-card dl__property">
      <view class="dl__property-icon"><JzIcon name="home" :size="34" :color="TOKEN_COLOR.primary" /></view>
      <view class="jz-grow">
        <text class="dl__property-addr jz-clamp-1">{{ property?.address || customer?.addr || '房屋地址待补充' }}</text>
        <text class="dl__property-meta">{{ property?.layout || '户型—' }} · {{ property?.area || customer?.area || 0 }}㎡ · 量房 {{ property?.latestMeasureAt ? property.latestMeasureAt.slice(0, 10) : '—' }}</text>
      </view>
      <text class="dl__property-tag" :class="{ 'dl__property-tag--done': property?.latestMeasureAt }">{{ property?.latestMeasureAt ? '已量房' : '待量房' }}</text>
    </view>

    <view v-if="locked" class="jz-card dl__lock">
      <view class="dl__lock-icon"><JzIcon name="shield-check" :size="34" :color="TOKEN_COLOR.primary" /></view>
      <view class="jz-grow">
        <text class="dl__lock-title">{{ lockTitle }}</text>
        <text class="dl__lock-tip">{{ lockTip }}</text>
      </view>
      <button v-if="project" class="jz-btn jz-btn--primary jz-btn--sm" @tap.stop="openProject">
        <JzIcon name="truck" :size="28" :color="TOKEN_COLOR.white" /><text>查看项目</text>
      </button>
    </view>

    <view class="jz-section">
      <text class="jz-section__title">设计 Briefs</text>
      <text class="jz-section__more" @tap="openRequirement">全部诉求（{{ requirements.length }}）</text>
    </view>
    <view class="jz-card dl__briefs">
      <view v-if="highPriorityReqs.length" class="dl__brief-list">
        <view v-for="item in highPriorityReqs" :key="item.id" class="dl__brief-item">
          <text class="dl__brief-tag" :class="item.kind === 'reject' ? 'dl__brief-tag--reject' : 'dl__brief-tag--demand'">{{ item.kind === 'reject' ? '排斥' : '诉求' }}</text>
          <text class="dl__brief-title jz-clamp-2">{{ item.title }}</text>
          <text v-if="item.spaceName" class="dl__brief-space">{{ item.spaceName }}</text>
        </view>
      </view>
      <view v-if="portraitSummary.has" class="dl__brief-portrait">
        <text v-if="portraitSummary.decisionRole" class="dl__brief-portrait-item">决策：{{ portraitSummary.decisionRole }}</text>
        <text v-if="portraitSummary.style" class="dl__brief-portrait-item">风格：{{ portraitSummary.style }}</text>
        <text v-if="portraitSummary.household" class="dl__brief-portrait-item">人口：{{ portraitSummary.household }}</text>
      </view>
      <view v-if="!highPriorityReqs.length && !portraitSummary.has" class="dl__brief-empty">
        <text>暂无设计 briefs，先记录客户诉求和画像</text>
        <button class="jz-btn jz-btn--ghost jz-btn--sm" @tap="openRequirement">记录诉求</button>
      </view>
    </view>

    <view v-if="focusDesign && designs.length" class="jz-card dl__ai-focus"><JzIcon name="star" :size="30" :color="TOKEN_COLOR.primary" /><view><text>请选择要生成效果图的设计方案</text><text>从方案卡片点击“AI 生成”继续</text></view></view>
    <view class="jz-section">
      <text class="jz-section__title">设计方案（{{ designs.length }}）</text>
    </view>
    <JzSkeleton v-if="loadingData && !designs.length" :rows="3" />
    <view v-if="designs.length" class="dl__list">
      <view
        v-for="item in designWithQuote"
        :key="item.design.id"
        class="jz-card dl__scheme"
        :class="{ 'dl__scheme--selected': item.design.status === 'selected' }"
        @tap="editScheme(item.design.id)"
      >
        <view class="dl__scheme-body">
          <view class="dl__scheme-head">
            <text class="dl__scheme-name jz-clamp-1">{{ item.design.name }}</text>
            <text class="dl__status" :class="statusClass(item.design.status)">{{ designMeta.designStatus[item.design.status] }}</text>
          </view>
          <view class="dl__scheme-meta">
            <text class="dl__scheme-no">NO.{{ item.design.no }} · V{{ item.design.version }}</text>
            <view class="dl__scheme-owner">
              <JzEmployeeAvatar v-if="item.design.owner" :src="item.design.owner.avatarUrl || ''" :name="item.design.owner.name" :role="item.design.owner.role" :status="item.design.owner.status" :size="40" />
              <text class="dl__scheme-desc">{{ item.design.style || '风格待定' }} · {{ item.design.owner?.name || '设计师待定' }}</text>
            </view>
          </view>
          <view class="dl__scheme-price-row">
            <view class="dl__scheme-price">
              <text v-if="item.quote" class="dl__scheme-price-value">{{ money(item.quote.amount) }}</text>
              <text v-else class="dl__scheme-price-empty">待报价</text>
            </view>
            <view v-if="canEdit && !locked" class="dl__scheme-actions">
              <button
                class="dl__copy-btn"
                @tap.stop="openGeneration(item.design)"
              >
                <JzIcon name="star" :size="20" :color="TOKEN_COLOR.primary" />
                <text>AI 生成</text>
              </button>
              <button
                class="dl__copy-btn"
                :disabled="!!copyingId"
                @tap.stop="copyScheme(item.design)"
              >
                <JzIcon name="copy" :size="20" :color="TOKEN_COLOR.primary" />
                <text>{{ copyingId === item.design.id ? '复制中' : '复制' }}</text>
              </button>
              <button
                v-if="item.design.status === 'draft'"
                class="dl__delete-btn"
                :disabled="!!deletingId"
                @tap.stop="deleteScheme(item.design)"
              >
                <JzIcon name="trash" :size="20" :color="TOKEN_COLOR.danger" />
                <text>{{ deletingId === item.design.id ? '删除中' : '删除' }}</text>
              </button>
            </view>
          </view>
          <view class="dl__scheme-stats">
            <view class="dl__scheme-stat">
              <JzIcon name="home" :size="24" :color="TOKEN_COLOR.text3" />
              <text class="dl__scheme-stat-value">{{ item.design.spaces?.length || 0 }}</text>
              <text class="dl__scheme-stat-label">区域</text>
            </view>
            <view class="dl__scheme-stat">
              <JzIcon name="folder" :size="24" :color="TOKEN_COLOR.text3" />
              <text class="dl__scheme-stat-value">{{ item.design.items?.length || 0 }}</text>
              <text class="dl__scheme-stat-label">分项</text>
            </view>
            <JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text4" class="dl__scheme-chevron" />
          </view>
        </view>
      </view>
    </view>
    <view v-else class="jz-card">
      <JzEmpty text="还没有设计方案" sub="量房后建立方案，开始区域划分和分项选择">
        <button v-if="canEdit && !locked" class="jz-btn jz-btn--primary jz-btn--sm" @tap="createScheme">新建设计方案</button>
      </JzEmpty>
    </view>

    <JzFloatAdd v-if="canEdit && !locked && designs.length" text="新建方案" @tap="createScheme" />
  </view>
</template>

<style lang="scss" scoped>
.dl { min-height: 100vh; padding-bottom: 60rpx; background: $jzb-bg-page; width: 100%; overflow-x: hidden; }
.dl__load-error { margin: 20rpx 24rpx; padding: 22rpx 24rpx; display: flex; flex-direction: row; align-items: center; gap: 16rpx; border-color: $jzb-danger-soft; }
.dl__load-error-title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.dl__load-error-text { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }

/* 客户信息条 */
.dl__customer-bar {
  margin: 24rpx 24rpx 16rpx;
  padding: 16rpx 24rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  background: $jzb-bg-card;
  border-radius: $jzb-radius;
  box-shadow: $jzb-shadow-xs;
}
.dl__customer-bar-name {
  color: $jzb-text-1;
  font-size: $jzb-font;
  font-weight: 700;
}
.dl__customer-bar-phone {
  color: $jzb-text-2;
  font-size: $jzb-font-sm;
  font-variant-numeric: tabular-nums;
}
.dl__customer-bar-grade {
  flex-shrink: 0;
  padding: 8rpx 16rpx;
  color: $jzb-warning;
  background: $jzb-warning-soft;
  border-radius: $jzb-radius-xs;
  font-size: $jzb-font-xs;
  font-weight: 600;
}
.dl__customer-bar-owner {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  margin-left: auto;
  color: $jzb-text-3;
  font-size: $jzb-font-xs;
}

.dl__property { margin: 0 24rpx 16rpx; padding: 24rpx; display: flex; align-items: center; gap: 16rpx; }
.dl__property-icon { width: 72rpx; height: 72rpx; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: $jzb-primary-lighter; border-radius: $jzb-radius-sm; }
.dl__property-addr { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.dl__property-meta { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.dl__property-tag { flex-shrink: 0; padding: 8rpx 16rpx; color: $jzb-warning; background: $jzb-warning-soft; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; font-weight: 600; }
.dl__property-tag--done { color: $jzb-primary-dark; background: $jzb-primary-lighter; }

.dl__lock { margin: 0 24rpx 16rpx; padding: 24rpx; display: flex; align-items: center; gap: 16rpx; border: 1rpx solid $jzb-primary-lighter; background: $jzb-primary-lightest; }
.dl__lock-icon { width: 72rpx; height: 72rpx; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: $jzb-radius-sm; background: $jzb-bg-card; }
.dl__lock-title { display: block; font-size: $jzb-font; font-weight: 700; color: $jzb-text-1; }
.dl__lock-tip { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.dl__lock .jz-btn { flex-shrink: 0; }

.dl__briefs { margin: 0 24rpx; padding: 24rpx; }
.dl__brief-list { display: flex; flex-direction: column; gap: 16rpx; }
.dl__brief-item { display: flex; align-items: flex-start; gap: 16rpx; }
.dl__brief-tag {
  flex-shrink: 0;
  padding: 8rpx 16rpx;
  border-radius: $jzb-radius-xs;
  font-size: $jzb-font-xs;
  font-weight: 600;
  line-height: 1.4;
}
.dl__brief-tag--demand { color: $jzb-primary-dark; background: $jzb-primary-lighter; }
.dl__brief-tag--reject { color: $jzb-danger; background: $jzb-danger-soft; }
.dl__brief-title { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 500; line-height: 1.5; }
.dl__brief-space { flex-shrink: 0; color: $jzb-text-4; font-size: $jzb-font-xs; }
.dl__brief-portrait { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 16rpx; padding-top: 16rpx; border-top: 1rpx solid $jzb-border-light; }
.dl__brief-portrait-item { padding: 8rpx 16rpx; color: $jzb-text-2; background: $jzb-bg-page; border-radius: $jzb-radius-xs; font-size: $jzb-font-xs; }
.dl__brief-empty { display: flex; flex-direction: column; align-items: center; gap: 16rpx; padding: 16rpx 0; color: $jzb-text-3; font-size: $jzb-font-xs; }

.dl__list { padding: 0 24rpx; }

.dl__ai-focus { margin: 20rpx 24rpx 0; padding: 20rpx 24rpx; display: flex; gap: 14rpx; align-items: center; color: $jzb-text-2; font-size: $jzb-font-sm; }
.dl__ai-focus view { flex: 1; min-width: 0; }
.dl__ai-focus text { display: block; }
.dl__ai-focus text:last-child { margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.dl__scheme {
  position: relative;
  padding: 24rpx;
  margin-bottom: 16rpx;
  overflow: hidden;
}
.dl__scheme:active { background: $jzb-bg-hover; }

/* 已选中方案：左侧色条 + 背景微染 */
.dl__scheme--selected { background: $jzb-primary-lightest; }
.dl__scheme--selected::before {
  content: '';
  position: absolute;
  left: 0;
  top: 24rpx;
  bottom: 24rpx;
  width: 6rpx;
  border-radius: 0 4rpx 4rpx 0;
  background: $jzb-primary;
}

/* 信息区 */
.dl__scheme-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* 标题行 */
.dl__scheme-head {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
}
.dl__scheme-name {
  flex: 1;
  min-width: 0;
  color: $jzb-text-1;
  font-size: $jzb-font-md;
  font-weight: 700;
  line-height: 1.4;
}

/* 编号 + 风格/设计师 */
.dl__scheme-meta {
  margin-top: 8rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.dl__scheme-no {
  color: $jzb-text-3;
  font-size: $jzb-font-xs;
  font-variant-numeric: tabular-nums;
}
.dl__scheme-owner { display: flex; align-items: center; gap: 10rpx; }
.dl__scheme-desc {
  color: $jzb-text-2;
  font-size: $jzb-font-sm;
}

/* 状态标签 */
.dl__status {
  flex-shrink: 0;
  padding: 8rpx 16rpx;
  border-radius: $jzb-radius-pill;
  font-size: $jzb-font-xs;
  font-weight: 600;
  line-height: 1.4;
}
.dl__status--draft { color: $jzb-text-3; background: $jzb-bg-page; }
.dl__status--ready { color: $jzb-primary-dark; background: $jzb-primary-lighter; }
.dl__status--presented { color: $jzb-info; background: $jzb-info-soft; }
.dl__status--selected { color: $jzb-primary-dark; background: $jzb-primary-lighter; }

/* 价格行 */
.dl__scheme-price-row {
  margin-top: 16rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.dl__scheme-price {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
}
.dl__scheme-price-value {
  color: $jzb-primary-dark;
  font-size: $jzb-font-lg;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.dl__scheme-price-empty {
  color: $jzb-text-4;
  font-size: $jzb-font-sm;
}
.dl__scheme-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.dl__copy-btn {
  flex-shrink: 0;
  min-height: 48rpx;
  padding: 0 16rpx;
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  color: $jzb-primary-dark;
  background: $jzb-primary-lighter;
  border: 0;
  border-radius: $jzb-radius-pill;
  font-size: $jzb-font-xs;
  font-weight: 600;
}
.dl__copy-btn[disabled] { opacity: .55; }
.dl__delete-btn {
  flex-shrink: 0;
  min-height: 48rpx;
  padding: 0 16rpx;
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  color: $jzb-danger;
  background: $jzb-danger-soft;
  border: 0;
  border-radius: $jzb-radius-pill;
  font-size: $jzb-font-xs;
  font-weight: 600;
}
.dl__delete-btn[disabled] { opacity: .55; }

/* 底部指标栏 */
.dl__scheme-stats {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid $jzb-border-light;
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.dl__scheme-stat {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.dl__scheme-stat-value {
  color: $jzb-text-1;
  font-size: $jzb-font-sm;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.dl__scheme-stat-label {
  color: $jzb-text-3;
  font-size: $jzb-font-xs;
}
.dl__scheme-chevron { flex-shrink: 0; }
</style>
