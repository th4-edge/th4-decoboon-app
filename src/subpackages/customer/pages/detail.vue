<script setup lang="ts">
import { computed, ref } from 'vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import type { Customer, CustomerFollow } from '@/domains/crm/model'
import type { Project } from '@/domains/project/model'
import type { Property } from '@/domains/property/model'
import type { Quote, QuoteStatus } from '@/domains/trade/model'
import type { Employee } from '@/domains/identity/model'
import { CUSTOMER_SOURCE_META, CUSTOMER_STAGE_META } from '@/domains/crm/meta'
import { crmApi } from '@/domains/crm/api'
import { identityApi } from '@/domains/identity/api'
import { projectApi } from '@/domains/project/api'
import { propertyApi } from '@/domains/property/api'
import { tradeApi } from '@/domains/trade/api'
import JzActionSheet from '@/components/JzActionSheet.vue'
import JzAvatar from '@/components/JzAvatar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzTag from '@/components/JzTag.vue'
import HouseCard from '@/subpackages/customer/components/HouseCard/HouseCard.vue'
import SalesSteps, { type SalesStageKey } from '@/subpackages/customer/components/SalesSteps/SalesSteps.vue'
import { confirm, hideLoading, loading, toast, toastError } from '@/composables/toast'

type PrimaryActionKind = 'follow' | 'scheduleMeasure' | 'assignDesigner' | 'recordMeasure' | 'design' | 'quote' | 'project' | 'edit'

interface PrimaryAction {
  kind: PrimaryActionKind
  label: string
}

const id = ref('')
const customer = ref<Customer | null>(null)
const follows = ref<CustomerFollow[]>([])
const quotes = ref<Quote[]>([])
const customerProjects = ref<Project[]>([])
const properties = ref<Property[]>([])
const activePropertyId = ref('')
const designers = ref<Employee[]>([])
const booted = ref(false)
const loadError = ref('')
const sectionError = ref('')
const actionLoading = ref(false)
const designerSheetOpen = ref(false)

const WAY_META: Record<CustomerFollow['way'], string> = {
  phone: '电话',
  visit: '到店/拜访',
  wechat: '微信',
  video: '视频',
  other: '其他'
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
const showMarketing = computed(() => isMarketer.value || isStoreManager.value || isTeamLeader.value)
const canFollow = computed(() => can(session.role, 'act:followCustomer'))
const canQuote = computed(() => can(session.role, 'edit:quote'))
const canRecordWechat = computed(() => can(session.role, 'act:recordWechat'))
const canRecordVisit = computed(() => can(session.role, 'act:recordVisit'))
const canScheduleMeasure = computed(() => can(session.role, 'act:scheduleMeasure')
  && hasAddress.value && !!customer.value
  && ['intention', 'following', 'pendingMeasure'].includes(customer.value.stage)
  && (!customer.value.designer || isStoreManager.value || session.role === 'boss'))
const canRecordMeasure = computed(() => can(session.role, 'edit:design')
  && !!activeProperty.value && !activeProperty.value.latestMeasureAt)
const canAssignDesigner = computed(() => can(session.role, 'act:assignDesigner')
  && customer.value?.stage === 'pendingMeasure' && !!customer.value.measureAt)
const hasAddress = computed(() => !!customer.value?.addr?.trim())
const activeProperty = computed(() => properties.value.find((item) => item.id === activePropertyId.value)
  || properties.value[0] || null)
const project = computed(() => customerProjects.value.find((item) => item.property?.id === activeProperty.value?.id)
  || customerProjects.value[0] || null)
const propertyQuotes = computed(() => activeProperty.value
  ? quotes.value.filter((item) => item.property?.id === activeProperty.value?.id)
  : [])
const confirmedQuote = computed(() => propertyQuotes.value.find((item) => item.status === 'converted')
  || propertyQuotes.value.find((item) => item.status === 'accepted')
  || null)
const activeQuote = computed(() => propertyQuotes.value.find((item) => !['rejected', 'superseded', 'accepted', 'converted'].includes(item.status)) || null)
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
    lost: '已流失'
  }
  return map[customer.value.stage] || '—'
})
const salesStage = computed<SalesStageKey>(() => {
  if (!customer.value) return 'visit'
  if (project.value || confirmedQuote.value || activeQuote.value || ['quote', 'sign', 'construction', 'done'].includes(customer.value.stage)) return 'quote'
  if (customer.value.designer && (customer.value.measureAt || activeProperty.value?.latestMeasureAt)) return 'design'
  if (customer.value.measureAt || customer.value.stage === 'pendingMeasure') return 'measure'
  if (customer.value.stage === 'following') return 'follow'
  return 'visit'
})
const primaryAction = computed<PrimaryAction | null>(() => {
  if (project.value) return { kind: 'project', label: '查看工地' }
  if (confirmedQuote.value || activeQuote.value) return { kind: 'quote', label: '查看报价' }
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
    return canScheduleMeasure.value
      ? { kind: 'scheduleMeasure', label: '约定量房' }
      : { kind: 'edit', label: '完善客户资料' }
  }
  return null
})
const designerActions = computed(() => designers.value.map((item) => ({
  label: `${item.name}${item.store?.name ? ' · ' + item.store.name : ''}`
})))

function formatDateTime(value?: string) {
  return value ? value.slice(0, 16).replace('T', ' ') : '—'
}

onLoad((query) => {
  id.value = query?.id || ''
  if (!isLoggedIn()) {
    uni.reLaunch({ url: P.login })
    return
  }
  if (!id.value) {
    booted.value = true
    loadError.value = '缺少客户参数'
  }
})
onShow(() => {
  if (id.value) void load()
})

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
    const [followResult, quoteResult, projectResult, propertyResult] = await Promise.allSettled([
      crmApi.follows(id.value),
      tradeApi.quotes({ customerId: id.value }),
      projectApi.list(),
      propertyApi.list(id.value)
    ])
    if (followResult.status === 'fulfilled') follows.value = followResult.value
    if (quoteResult.status === 'fulfilled') quotes.value = quoteResult.value
    if (projectResult.status === 'fulfilled') customerProjects.value = projectResult.value
    if (propertyResult.status === 'fulfilled') properties.value = propertyResult.value
    const failed = [followResult, quoteResult, projectResult, propertyResult]
      .filter((item) => item.status === 'rejected')
    if (failed.length) sectionError.value = '部分关联数据加载失败，请重试'
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
function edit() { uni.navigateTo({ url: `${P.customerEdit}?id=${id.value}` }) }
function scheduleMeasure() {
  // 约定量房必须关联房屋：先有房屋档案（含详细地址）才能安排量房
  if (!properties.value.length) {
    uni.showModal({
      title: '请先建立房屋档案',
      content: '约定量房需要关联具体房屋与详细地址，是否现在新增？',
      confirmText: '新增房屋',
      cancelText: '暂不新增',
      success: (res) => { if (res.confirm) addProperty() }
    })
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
    if (!designers.value.length) designers.value = await identityApi.designers()
    if (!designers.value.length) {
      toast('当前范围暂无可指定设计师')
      return
    }
    designerSheetOpen.value = true
  } catch (error) {
    toastError(error, '设计师列表加载失败')
  } finally {
    actionLoading.value = false
  }
}

async function onDesignerSelect(index: number) {
  const designer = designers.value[index]
  if (!designer) return
  loading('正在指定设计师…')
  try {
    customer.value = await crmApi.handoff(id.value, designer.id, activeProperty.value?.id)
    toast(`已指定${designer.name}`, 'success')
    await load()
  } catch (error) {
    toastError(error, '指定设计师失败')
  } finally {
    hideLoading()
  }
}

function addProperty() {
  if (!customer.value) return
  uni.navigateTo({ url: `${P.customerPropertyEdit}?customerId=${id.value}` })
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
          </view>
          <view class="cd__contact">
            <JzIcon name="phone" :size="24" color="#778390" />
            <text>{{ customer.phone || '电话待补充' }}</text>
          </view>
        </view>
      </view>
      <view class="cd__roles">
        <view class="cd__role">
          <text class="cd__role-label">负责顾问</text>
          <text class="cd__role-value">{{ customer.owner?.name || '—' }}</text>
        </view>
        <view class="cd__role-divider" />
        <view class="cd__role">
          <text class="cd__role-label">接手设计师</text>
          <text class="cd__role-value">{{ customer.designer?.name || '—' }}</text>
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
      <view class="jz-section__more" @tap="addProperty">
        <JzIcon name="plus" :size="24" :color="TOKEN_COLOR.text3" />
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
          @select="activePropertyId = $event.id"
          @copy="copyPropertyNo"
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
      <view v-if="canFollow" class="jz-section__more" @tap="edit">
        <JzIcon name="edit" :size="24" :color="TOKEN_COLOR.text3" />
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
        <text v-if="item.nextFollowAt" class="cd__follow-next">下次跟进：{{ item.nextFollowAt.slice(0, 10) }}</text>
      </view>
      <JzEmpty v-if="!follows.length" text="暂无跟进记录" sub="记录每次沟通，保持客户转化上下文" />
    </view>

    <view v-if="canFollow && primaryAction?.kind !== 'follow'" class="jz-actionbar">
      <view class="jz-actionbar__inner">
        <button class="jz-btn jz-btn--neutral jz-grow" @tap="follow">
          <JzIcon name="message" :size="28" :color="TOKEN_COLOR.text2" />
          <text>写跟进</text>
        </button>
      </view>
    </view>
  </view>
  <view v-else-if="loadError" class="cd__error">
    <JzIcon name="alert-circle" :size="72" :color="TOKEN_COLOR.danger" />
    <text class="cd__error-title">{{ loadError }}</text>
    <button class="jz-btn jz-btn--plain" @tap="load">重新加载</button>
  </view>
  <view v-else class="cd__error">
    <JzIcon name="inbox" :size="72" :color="TOKEN_COLOR.text4" />
    <text class="cd__error-title">客户不存在</text>
  </view>

  <JzActionSheet
    :visible="designerSheetOpen"
    title="选择设计师"
    :actions="designerActions"
    @select="onDesignerSelect"
    @update:visible="designerSheetOpen = $event"
  />
</template>

<style lang="scss" scoped>
.cd { padding-bottom: 160rpx; }
.cd__head { margin: 24rpx 24rpx 16rpx; padding: 32rpx; }
.cd__head-top { display: flex; align-items: center; }
.cd__who { flex: 1; min-width: 0; margin-left: 24rpx; }
.cd__identity { display: flex; align-items: center; flex-wrap: wrap; gap: 8rpx; }
.cd__name { color: $jzb-text-1; font-size: $jzb-font-xl; font-weight: 700; }
.cd__contact { display: flex; align-items: center; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.cd__contact text { margin-left: 8rpx; }
.cd__roles { display: flex; align-items: center; margin-top: 24rpx; padding-top: 24rpx; border-top: 1rpx solid $jzb-border-light; }
.cd__role { flex: 1; min-width: 0; }
.cd__role-label { display: block; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cd__role-value { display: block; margin-top: 8rpx; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 600; }
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
.cd__follow-next { display: block; margin-top: 12rpx; color: $jzb-warning; font-size: $jzb-font-xs; }
.cd__error { min-height: 70vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20rpx; padding: 40rpx; }
.cd__error-title { color: $jzb-text-2; font-size: $jzb-font-md; font-weight: 600; text-align: center; }
</style>
