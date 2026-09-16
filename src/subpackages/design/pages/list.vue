<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import type { Customer } from '@/domains/crm/model'
import type { DesignRequirement, DesignScheme, TalkPlan } from '@/domains/design/model'
import type { Quote } from '@/domains/trade/model'
import type { Project } from '@/domains/project/model'
import { designApi, designMeta } from '@/domains/design/api'
import { crmApi } from '@/domains/crm/api'
import { tradeApi } from '@/domains/trade/api'
import { projectApi } from '@/domains/project/api'
import { money } from '@/core/format'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'
import JzIconButton from '@/components/JzIconButton.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzFloatAdd from '@/components/JzFloatAdd.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'

const customerId = ref('')
const propertyId = ref('')
const customer = ref<Customer | null>(null)
const requirements = ref<DesignRequirement[]>([])
const designs = ref<DesignScheme[]>([])
const quotes = ref<Quote[]>([])
const talks = ref<Record<string, TalkPlan>>({})
const project = ref<Project | null>(null)
const loadingData = ref(false)
const hasLoadedOnce = ref(false)
let loadSeq = 0

const quotableDesigns = computed(() => designs.value.filter((item) => ['ready', 'presented', 'selected'].includes(item.status) && (item.spaces?.length || 0) > 0 && (item.items?.length || 0) > 0))
const readyCount = computed(() => quotableDesigns.value.length)
const totalItems = computed(() => designs.value.reduce((sum, item) => sum + (item.items?.length || 0), 0))
const totalSpaces = computed(() => designs.value.reduce((sum, item) => sum + (item.spaces?.length || 0), 0))
const designQuotes = computed(() => quotes.value.filter((item) => item.design?.id && item.status !== 'rejected' && item.status !== 'superseded'))
const talkCount = computed(() => Object.keys(talks.value).length)
const canEdit = computed(() => can(session.role, 'edit:design'))
const canTalk = computed(() => can(session.role, 'act:talk'))
const canManageCatalog = computed(() => can(session.role, 'edit:catalog'))
const locked = computed(() => !!project.value || quotes.value.some((item) => item.status === 'accepted' || item.status === 'converted'))
const lockTitle = computed(() => project.value ? '该房屋已转为唯一施工项目' : '该房屋已有客户确认报价')
const lockTip = computed(() => project.value ? '设计方案和报价已锁定，后续调整必须通过合同变更单，不能再新建方案或报价。' : '客户已确认报价，当前房屋进入签约阶段，方案与报价暂不可继续编辑或新增。')

onLoad((query) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  customerId.value = query?.customerId || ''
  propertyId.value = query?.propertyId || ''
  if (!customerId.value) {
    toast('缺少客户信息')
    setTimeout(() => uni.navigateBack(), 500)
  }
})
onShow(() => {
  setTimeout(() => { if (customerId.value) void load() }, 0)
})
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  const seq = ++loadSeq
  loadingData.value = true
  try {
    const [c, reqs, schemes, quoteList, projects] = await Promise.all([
      crmApi.info(customerId.value),
      designApi.requirements(customerId.value),
      designApi.schemes(customerId.value),
      tradeApi.quotes({ customerId: customerId.value }),
      projectApi.list()
    ])
    const details = await Promise.all(schemes.map((item) => designApi.scheme(item.id)))
    const visibleDesigns = details.filter((item) => item.status !== 'archived')
    const talkPairs = await Promise.all(visibleDesigns.map(async (item) => [
      item.id, (await designApi.talks(item.id))[0]
    ] as const))
    if (seq !== loadSeq) return
    customer.value = c
    requirements.value = reqs
    quotes.value = quoteList
    project.value = projects.find((item) => item.customer?.id === customerId.value) || null
    designs.value = visibleDesigns
    talks.value = Object.fromEntries(talkPairs.filter(([, talk]) => !!talk)) as Record<string, TalkPlan>
    hasLoadedOnce.value = true
  } catch (error) {
    if (seq === loadSeq) toastError(error, '设计转化数据加载失败')
  } finally {
    if (seq === loadSeq) loadingData.value = false
  }
}

function quoteOf(designId: string) {
  return quotes.value.find((quote) => quote.design?.id === designId && quote.status === 'converted')
    || quotes.value.find((quote) => quote.design?.id === designId && quote.status === 'accepted')
    || quotes.value.find((quote) => quote.design?.id === designId && quote.status !== 'rejected' && quote.status !== 'superseded') || null
}

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
function openCatalogManage() {
  uni.navigateTo({ url: P.catalogManage })
}
function openQuote(id: string) {
  uni.navigateTo({ url: `${P.quoteDetail}?id=${id}` })
}
function openProject() {
  if (project.value) uni.navigateTo({ url: `${P.projectDetail}?id=${project.value.id}` })
}
function openTalk(id: string) {
  uni.navigateTo({ url: `${P.designTalk}?talkId=${id}` })
}

async function generateQuote(design: DesignScheme) {
  if (locked.value) { toast(lockTip.value); return }
  loading('生成设计报价…')
  try {
    if (design.status === 'draft') {
      await designApi.buildScheme(design.id, 'ready')
    }
    const quote = await tradeApi.createQuote({ designId: design.id, customerId: customerId.value })
    hideLoading()
    toast('设计报价已生成', 'success')
    setTimeout(() => openQuote(quote.id), 350)
  } catch (error) {
    hideLoading()
    toastError(error, '设计报价生成失败')
  }
}

async function generateTalk(design: DesignScheme) {
  loading('生成谈单PPT…')
  try {
    if (design.status === 'draft') {
      await designApi.buildScheme(design.id, 'ready')
    }
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
</script>

<template>
  <view class="dl">
    <view class="dl__hero">
      <view class="jz-between">
        <view>
          <text class="dl__hero-label">设计转化闭环</text>
          <text class="dl__hero-name jz-clamp-2">{{ customer?.name || '客户' }}</text>
        </view>
        <text class="dl__hero-area">{{ customer?.area || 0 }}㎡</text>
      </view>
      <view class="dl__steps">
        <view class="dl__step" :class="{ 'dl__step--on': requirements.length > 0 }"><text class="dl__step-no">1</text><view><text class="dl__step-name">客户诉求</text><text class="dl__step-value">{{ hasLoadedOnce ? requirements.length + ' 条' : '加载中' }}</text></view></view>
        <view class="dl__step" :class="{ 'dl__step--on': readyCount >= 2 }"><text class="dl__step-no">2</text><view><text class="dl__step-name">设计方案</text><text class="dl__step-value">{{ hasLoadedOnce ? `${readyCount}/2 套` : '加载中' }}</text></view></view>
        <view class="dl__step" :class="{ 'dl__step--on': totalSpaces > 0 && totalItems > 0 }"><text class="dl__step-no">3</text><view><text class="dl__step-name">区域分项</text><text class="dl__step-value">{{ hasLoadedOnce ? `${totalSpaces}/${totalItems}` : '加载中' }}</text></view></view>
        <view class="dl__step" :class="{ 'dl__step--on': designQuotes.length > 0 }"><text class="dl__step-no">4</text><view><text class="dl__step-name">设计报价</text><text class="dl__step-value">{{ hasLoadedOnce ? designQuotes.length + ' 份' : '加载中' }}</text></view></view>
        <view class="dl__step" :class="{ 'dl__step--on': talkCount > 0 }"><text class="dl__step-no">5</text><view><text class="dl__step-name">谈单 PPT</text><text class="dl__step-value">{{ hasLoadedOnce ? talkCount + ' 份' : '加载中' }}</text></view></view>
      </view>
    </view>

    <view v-if="locked" class="jz-card dl__lock">
      <view class="dl__lock-icon"><JzIcon name="shield-check" :size="34" color="#6958C8" /></view>
      <view class="jz-grow">
        <text class="dl__lock-title">{{ lockTitle }}</text>
        <text class="dl__lock-tip">{{ lockTip }}</text>
      </view>
      <button v-if="project" class="jz-btn jz-btn--primary jz-btn--sm" @tap.stop="openProject"><JzIcon name="truck" :size="28" color="#fff" /><text>查看项目</text></button>
    </view>

    <view class="dl__quick">
      <view class="jz-card dl__quick-item" @tap="openRequirement"><view class="dl__quick-icon dl__quick-icon--purple"><JzIcon name="message" :size="38" color="#6958C8" /></view><view class="jz-grow"><text class="dl__quick-title jz-clamp-1">记录客户诉求</text><text class="dl__quick-sub">要求、偏好、排斥点</text></view><text class="dl__quick-count">{{ requirements.length }}</text></view>
      <view class="jz-card dl__quick-item" @tap="locked ? openProject() : createScheme()"><view class="dl__quick-icon"><JzIcon name="edit" :size="38" color="#16A394" /></view><view class="jz-grow"><text class="dl__quick-title jz-clamp-1">新建设计方案</text><text class="dl__quick-sub">区域、尺寸、施工、主材</text></view><text class="dl__quick-count">{{ designs.length }}</text></view>
    </view>

    <view v-if="canManageCatalog" class="jz-card dl__catalog-entry" @tap="openCatalogManage">
      <view class="dl__quick-icon"><JzIcon name="package" :size="38" color="#E67E22" /></view>
      <view class="jz-grow"><text class="dl__quick-title">报价项目库维护</text><text class="dl__quick-sub">施工、主材、软装、电器、综合的价格、规格、公式和工艺统一维护</text></view>
      <JzIcon name="chevron-right" :size="28" color="#AEB8C2" />
    </view>

    <view class="jz-section"><text class="jz-section__title">设计方案（{{ designs.length }}）</text><text class="jz-section__more">至少 2 套可谈单</text></view>
    <JzSkeleton v-if="loadingData && !designs.length" :rows="3" />
    <view v-if="designs.length" class="dl__list">
      <view v-for="design in designs" :key="design.id" class="jz-card dl__scheme">
        <view class="jz-between" @tap="editScheme(design.id)">
          <view class="jz-grow">
            <view class="jz-row"><text class="dl__scheme-name jz-clamp-1">{{ design.name }}</text><text class="dl__status">{{ designMeta.designStatus[design.status] }}</text></view>
            <text class="dl__scheme-sub">V{{ design.version }} · {{ design.style || '风格待定' }} · {{ design.area || 0 }}㎡ · {{ design.owner?.name || '设计师待定' }}</text>
          </view>
          <JzIcon name="chevron-right" :size="28" color="#AEB8C2" />
        </view>
        <view class="dl__metrics">
          <view><text>{{ design.spaces?.length || 0 }}</text><text>区域</text></view>
          <view><text>{{ design.items?.length || 0 }}</text><text>分项</text></view>
          <view><text>{{ money(quoteOf(design.id)?.amount || 0) }}</text><text>设计报价</text></view>
        </view>
        <view class="dl__actions">
          <view class="dl__actions-row">
            <JzIconButton v-if="canEdit && !locked" name="edit" @tap="editScheme(design.id)" />
            <button v-if="quoteOf(design.id)" class="jz-btn jz-btn--text" @tap.stop="openQuote(quoteOf(design.id)!.id)"><JzIcon name="file-text" :size="28" color="#465260" /><text>查看报价</text></button>
            <button v-if="canTalk" class="jz-btn jz-btn--text" @tap.stop="talks[design.id] ? openTalk(talks[design.id].id) : generateTalk(design)"><JzIcon name="doc" :size="28" color="#465260" /><text>{{ talks[design.id] ? '谈单PPT' : '生成谈单PPT' }}</text></button>
          </view>
          <button v-if="canEdit && !locked" class="jz-btn jz-btn--primary jz-btn--sm" @tap.stop="generateQuote(design)"><JzIcon name="calculator" :size="28" color="#fff" /><text>{{ quoteOf(design.id) ? '重新报价' : '生成报价' }}</text></button>
        </view>
      </view>
    </view>
    <view v-else class="jz-card"><JzEmpty text="还没有设计方案" sub="量房后至少建立两套方案，才能进入谈单" /></view>

    <view class="jz-section"><text class="jz-section__title">客户诉求摘要</text></view>
    <view v-if="requirements.length" class="jz-card dl__requirements">
      <view v-for="item in requirements.slice(0, 5)" :key="item.id" class="dl__requirement">
        <text class="dl__req-kind">{{ designMeta.requirementKind[item.kind] }}</text>
        <view class="jz-grow"><text class="dl__req-title jz-clamp-2">{{ item.title }}</text><text class="dl__req-meta">{{ item.spaceName || '全局诉求' }} · {{ designMeta.requirementPriority[item.priority] }}优先</text></view>
      </view>
    </view>
    <view v-else class="jz-card"><JzEmpty text="还没有诉求点" sub="先记录客户要求和排斥项，再开始设计" /></view>

    <JzFloatAdd v-if="canEdit && !locked" text="新建方案" @tap="createScheme" />
  </view>
</template>

<style lang="scss" scoped>
.dl { min-height: 100vh; padding-bottom: 150rpx; background: $jzb-bg-page; width: 100%; overflow-x: hidden; }
.dl__hero { margin: 24rpx; padding: 32rpx 30rpx; color: #fff; background: linear-gradient(135deg, $jzb-purple, $jzb-primary); border-radius: $jzb-radius-lg; box-shadow: $jzb-shadow-card; }
.dl__hero-label { display: block; font-size: $jzb-font-sm; opacity: .82; }
.dl__hero-name { display: block; margin-top: 8rpx; font-size: 48rpx; font-weight: 750; line-height: 1.3; }
.dl__hero-area { font-size: $jzb-font-lg; font-weight: 700; }
.dl__steps { display: flex; gap: 12rpx; margin-top: 28rpx; overflow-x: auto; padding-bottom: 4rpx; }
.dl__step { flex: 0 0 196rpx; min-height: 106rpx; padding: 16rpx 14rpx; display: flex; align-items: center; background: rgba(255,255,255,.13); border: 1rpx solid rgba(255,255,255,.12); border-radius: 16rpx; }
.dl__step-no { width: 42rpx; height: 42rpx; margin-right: 10rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(255,255,255,.16); font-size: 22rpx; font-weight: 700; }
.dl__step-name, .dl__step-value { display: block; }
.dl__step-name { font-size: $jzb-font-xs; opacity: .82; }
.dl__step-value { margin-top: 4rpx; font-size: $jzb-font-sm; font-weight: 700; }
.dl__step--on { background: rgba(255,255,255,.28); border-color: rgba(255,255,255,.3); }
.dl__lock { margin: 0 24rpx 18rpx; padding: 24rpx; display: flex; align-items: center; gap: 18rpx; border: 1rpx solid $jzb-purple-soft; background: $jzb-purple-soft; }
.dl__lock-icon { width: 72rpx; height: 72rpx; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 22rpx; background: #fff; }
.dl__lock-title { display: block; font-size: $jzb-font; font-weight: 750; }
.dl__lock-tip { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.dl__lock .jz-btn { flex-shrink: 0; }
.dl__quick { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; padding: 0 24rpx; }
.dl__quick-item { min-height: 160rpx; padding: 26rpx; display: flex; align-items: center; transition: transform $jzb-duration-fast $jzb-ease-out; }
.dl__quick-item:active { transform: scale(0.988); background: $jzb-bg-hover; }
.dl__quick-icon { width: 72rpx; height: 72rpx; margin-right: 18rpx; display: flex; align-items: center; justify-content: center; background: $jzb-primary-lighter; border-radius: 22rpx; }
.dl__quick-icon--purple { background: $jzb-purple-soft; }
.dl__quick-title { display: block; font-size: $jzb-font-md; font-weight: 700; line-height: 1.4; }
.dl__quick-sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.45; }
.dl__quick-item .jz-grow { min-width: 0; }
.dl__quick-count { color: $jzb-primary-dark; font-size: $jzb-font-xl; font-weight: 750; }
.dl__catalog-entry { margin: 16rpx 24rpx 0; padding: 24rpx 26rpx; display: flex; align-items: center; }
.dl__catalog-entry .jz-grow { min-width: 0; }
.dl__list { padding: 0 24rpx; }
.dl__scheme { padding: 26rpx; margin-bottom: 18rpx; transition: transform $jzb-duration-fast $jzb-ease-out; }
.dl__scheme:active { transform: scale(0.99); }
.dl__scheme > .jz-between .jz-grow { min-width: 0; }
.dl__scheme-name { max-width: 430rpx; font-size: $jzb-font-lg; font-weight: 700; line-height: 1.4; }
.dl__status { margin-left: 14rpx; flex-shrink: 0; padding: 5rpx 12rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: $jzb-radius-pill; font-size: 20rpx; }
.dl__scheme-sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.5; }
.dl__actions .jz-btn { white-space: nowrap; }
.dl__metrics { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 22rpx; padding: 22rpx 0; text-align: center; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; }
.dl__metrics text { display: block; }
.dl__metrics text:first-child { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 750; word-break: break-all; }
.dl__metrics text:last-child { margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.dl__actions { display: flex; flex-direction: column; gap: 12rpx; margin-top: 22rpx; }
.dl__actions-row { display: flex; align-items: center; gap: 8rpx; }
.dl__actions .jz-btn--primary { width: 100%; }
.dl__requirements { padding: 0 26rpx; }
.dl__requirement { display: flex; align-items: center; min-height: 96rpx; border-bottom: 1rpx solid $jzb-border-light; }
.dl__requirement:last-child { border-bottom: none; }
.dl__req-kind { margin-right: 14rpx; padding: 5rpx 10rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: 8rpx; font-size: 20rpx; }
.dl__req-title { display: block; font-size: $jzb-font; font-weight: 650; line-height: 1.45; }
.dl__req-meta { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.dl__requirement .jz-grow { min-width: 0; }
</style>
