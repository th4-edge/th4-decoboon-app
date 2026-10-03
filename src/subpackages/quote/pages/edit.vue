<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import type { Customer } from '@/domains/crm/model'
import type { DesignScheme } from '@/domains/design/model'
import type { PackageTemplate } from '@/domains/pack/model'
import type { Project } from '@/domains/project/model'
import type { Property } from '@/domains/property/model'
import type { QuoteMode } from '@/domains/trade/model'
import { crmApi } from '@/domains/crm/api'
import { designApi, designMeta } from '@/domains/design/api'
import { packApi } from '@/domains/pack/api'
import { projectApi } from '@/domains/project/api'
import { propertyApi } from '@/domains/property/api'
import { tradeApi } from '@/domains/trade/api'
import { money } from '@/core/format'
import { toast, toastError, loading, hideLoading } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'
import JzEmpty from '@/components/JzEmpty.vue'

const customerId = ref('')
const propertyId = ref('')
const designId = ref('')
const templateId = ref('')
const packageArea = ref('')
const mode = ref<Exclude<QuoteMode, 'hybrid'>>('package')
const customers = ref<Customer[]>([])
const designs = ref<DesignScheme[]>([])
const templates = ref<PackageTemplate[]>([])
const properties = ref<Property[]>([])
const projects = ref<Project[]>([])
const customerQuotes = ref<Awaited<ReturnType<typeof tradeApi.quotes>>>([])
const discount = ref('100')
const submitting = ref(false)
const designContextLocked = ref(false)

const customer = computed(() => customers.value.find((item) => item.id === customerId.value))
const quotableDesigns = computed(() => designs.value.filter((item) => ['ready', 'presented', 'selected'].includes(item.status) && (item.spaces?.length || 0) > 0 && (item.items?.length || 0) > 0))
const design = computed(() => designs.value.find((item) => item.id === designId.value))
const property = computed(() => properties.value.find((item) => item.id === propertyId.value))
const designProperty = computed(() => design.value?.property || property.value || null)
const template = computed(() => templates.value.find((item) => item.id === templateId.value))
const itemCount = computed(() => design.value?.items?.length || 0)
const spaceCount = computed(() => design.value?.spaces?.length || 0)
const estimatedAmount = computed(() => (design.value?.items || []).reduce((sum, item) => sum + item.amount, 0))
const lockedProject = computed(() => projects.value.find((item) => item.customer?.id === customerId.value) || null)
const lockedQuote = computed(() => customerQuotes.value.find((item) => item.customer?.id === customerId.value && (item.status === 'accepted' || item.status === 'converted')) || null)
const locked = computed(() => !!lockedProject.value || !!lockedQuote.value)
const packageEstimate = computed(() => {
  if (!template.value || !packageArea.value) return 0
  return template.value.area > 0 ? template.value.price * Number(packageArea.value) / template.value.area : 0
})

onLoad((query) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  if (session.role === 'marketer') {
    const flowCustomerId = query?.customerId || ''
    if (flowCustomerId) {
      uni.redirectTo({ url: `${P.customerFlow}?customerId=${flowCustomerId}&propertyId=${query?.propertyId || ''}` })
      return
    }
    toast('业务员不参与方案报价，仅可查看业务流转')
    setTimeout(() => uni.navigateBack(), 300)
    return
  }
  customerId.value = query?.customerId || ''
  propertyId.value = query?.propertyId || ''
  designId.value = query?.designId || ''
  templateId.value = query?.templateId || ''
  designContextLocked.value = !!designId.value
  mode.value = query?.mode === 'custom' ? 'custom' : 'package'
  void load()
})

async function load() {
  try {
    customers.value = await crmApi.list()
    templates.value = await packApi.templates()
    projects.value = await projectApi.list()
    if (!customerId.value && customers.value.length === 1) customerId.value = customers.value[0].id
    if (mode.value === 'custom') await loadDesigns()
    if (customerId.value) {
      await loadCustomerQuoteState()
      await loadProperties()
    }
    if (templateId.value) {
      const idx = templates.value.findIndex((t) => t.id === templateId.value)
      if (idx >= 0) pickTemplate(idx)
    } else if (templates.value.length === 1) {
      pickTemplate(0)
    }
  } catch (error) {
    toastError(error, '设计报价基础数据加载失败')
  }
}

async function loadDesigns() {
  if (!customerId.value) {
    designs.value = []
    designId.value = ''
    return
  }
  const summaries = await designApi.schemes(customerId.value)
  designs.value = await Promise.all(summaries.map((item) => designApi.scheme(item.id)))
  if (!designId.value || !quotableDesigns.value.some((item) => item.id === designId.value)) {
    designId.value = quotableDesigns.value[0]?.id || ''
  }
}

async function loadCustomerQuoteState() {
  customerQuotes.value = customerId.value ? await tradeApi.quotes({ customerId: customerId.value }) : []
}

async function loadProperties() {
  properties.value = customerId.value ? await propertyApi.list(customerId.value) : []
  if (!propertyId.value && properties.value.length === 1) {
    propertyId.value = properties.value[0].id
  }
  if (propertyId.value && !properties.value.some((item) => item.id === propertyId.value)) {
    propertyId.value = ''
  }
}

async function pickCustomer(index: number) {
  customerId.value = customers.value[index]?.id || ''
  designId.value = ''
  await loadCustomerQuoteState()
  await loadProperties()
  if (mode.value === 'custom') await loadDesigns()
}

function switchMode(value: Exclude<QuoteMode, 'hybrid'>) {
  if (designContextLocked.value && value !== 'custom') return
  mode.value = value
  if (value === 'custom' && customerId.value) void loadDesigns()
}

function pickTemplate(index: number) {
  templateId.value = templates.value[index]?.id || ''
  packageArea.value = templates.value[index]?.area ? String(templates.value[index].area) : ''
}

function openLockedProject() {
  if (lockedProject.value) uni.navigateTo({ url: `${P.projectDetail}?id=${lockedProject.value.id}` })
}
function openDesign() {
  if (!customerId.value) { toast('请先选择客户'); return }
  uni.navigateTo({ url: `${P.designList}?customerId=${customerId.value}` })
}
function openPackageManage() {
  uni.navigateTo({ url: P.packageManage })
}

async function save() {
  if (mode.value === 'custom' && design.value) {
    customerId.value = design.value.customer?.id || customerId.value
    propertyId.value = design.value.property?.id || propertyId.value
  }
  if (!customerId.value) { toast('请选择客户'); return }
  if (locked.value) { toast('该房屋已有客户确认报价或唯一项目，请通过合同变更单调整'); return }
  if (mode.value === 'package' && !propertyId.value) { toast('请选择客户房屋'); return }
  const rate = Number(discount.value || 100) / 100
  if (rate <= 0 || rate > 1) { toast('请输入 1-100 的折扣'); return }
  if (mode.value === 'custom' && !designId.value) { toast('请选择已完成的方案'); return }
  if (mode.value === 'package' && !templateId.value) { toast('请选择套餐模板'); return }
  if (mode.value === 'package' && (!packageArea.value || Number(packageArea.value) <= 0)) { toast('请输入有效计价面积'); return }
  submitting.value = true
  loading(mode.value === 'package' ? '按套餐规则汇算报价…' : '按区域分项汇算报价…')
  try {
    const quote = await tradeApi.createQuote({
      customerId: customerId.value,
      propertyId: mode.value === 'package' ? propertyId.value : undefined,
      designId: mode.value === 'custom' ? designId.value : undefined,
      templateId: mode.value === 'package' ? templateId.value : undefined,
      mode: mode.value,
      area: mode.value === 'package' ? Number(packageArea.value) : undefined,
      discount: rate,
      empId: session.role === 'boss' ? session.emp?.id : undefined
    })
    hideLoading()
    toast(`报价 ¥${money(quote.amount, false)} 已生成`, 'success')
    setTimeout(() => uni.redirectTo({ url: `${P.quoteDetail}?id=${quote.id}` }), 400)
  } catch (error) {
    hideLoading()
    toastError(error, '报价创建失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="qe">
    <view class="qe__steps"><text>诉求</text><text>方案</text><text>区域分项</text><text class="qe__step-on">设计报价</text><text>谈单PPT</text></view>
    <view class="qe__context jz-card">
      <view class="qe__icon"><JzIcon name="file-text" :size="40" :color="TOKEN_COLOR.purple" /></view>
      <view class="jz-grow">
        <text class="qe__title jz-clamp-2">{{ mode === 'package' ? '套餐报价' : '自定义报价' }}</text>
        <text class="qe__sub jz-clamp-3">{{ mode === 'package' ? '按套餐模板和实际面积快速生成基础报价，后续可继续做升级、扣减和增项。' : '按设计方案中的区域、施工和主材分项逐项汇算，适合按实际尺寸定制报价。' }}</text>
      </view>
    </view>

    <view v-if="locked" class="jz-card qe__lock">
      <JzIcon name="shield-check" :size="34" :color="TOKEN_COLOR.purple" />
      <view class="jz-grow">
        <text class="qe__lock-title">该房屋报价已锁定</text>
        <text class="qe__lock-tip">{{ lockedProject ? `已生成唯一项目 ${lockedProject.no}` : `报价 ${lockedQuote?.no} 已客户确认` }}，不能再生成第二份确认报价或第二项目；调整请发起合同变更单。</text>
      </view>
      <button v-if="lockedProject" class="jz-btn jz-btn--primary jz-btn--sm" @tap="openLockedProject">查看项目</button>
    </view>

    <view class="jz-card qe__form">
      <text class="qe__label">报价路线 <text class="req">*</text></text>
      <view class="jz-segment qe__mode">
        <view v-if="!designContextLocked" class="jz-segment__item" :class="{ 'jz-segment__item--active': mode === 'package' }" @tap="switchMode('package')">套餐报价</view>
        <view class="jz-segment__item" :class="{ 'jz-segment__item--active': mode === 'custom' }" @tap="switchMode('custom')">自定义报价</view>
      </view>

      <template v-if="designContextLocked">
        <view class="qe__context-readonly">
          <view><text>客户</text><text>{{ design?.customer?.name || customer?.name || '—' }}</text></view>
          <view><text>房屋</text><text>{{ designProperty?.address || designProperty?.community || property?.address || '—' }}</text></view>
          <view><text>设计方案</text><text>{{ design?.name || '—' }}</text></view>
        </view>
      </template>
      <template v-else>
        <text class="qe__label">客户 <text class="req">*</text></text>
        <picker :range="customers.map(item => `${item.name}（${item.community || '未填小区'}）`)" @change="pickCustomer(Number($event.detail.value))">
          <view class="qe__picker">
            <text :class="{ 'qe__placeholder': !customerId }">{{ customer ? `${customer.name} · ${customer.phone}` : '选择客户' }}</text>
            <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
          </view>
        </picker>
      </template>

      <template v-if="mode === 'custom'">
        <template v-if="!designContextLocked">
          <view class="qe__label-row"><text class="qe__label">设计方案 <text class="req">*</text></text><text class="qe__link" @tap="openDesign">去设计转化</text></view>
          <picker :range="quotableDesigns.map(item => `${item.name}（${designMeta.designStatus[item.status]}）`)" @change="designId = quotableDesigns[Number($event.detail.value)]?.id || ''">
            <view class="qe__picker">
              <text class="jz-clamp-1" :class="{ 'qe__placeholder': !designId }">{{ design ? design.name : '选择设计方案' }}</text>
              <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
            </view>
          </picker>
        </template>
      </template>
      <template v-else>
        <text class="qe__label">客户房屋 <text class="req">*</text></text>
        <picker :range="properties.map(item => `${item.community || item.address || '未填地址'}（${item.area || 0}㎡）`)" @change="propertyId = properties[Number($event.detail.value)]?.id || ''">
          <view class="qe__picker">
            <text class="jz-clamp-1" :class="{ 'qe__placeholder': !propertyId }">{{ property ? `${property.community || property.address} · ${property.area || 0}㎡` : '选择客户房屋' }}</text>
            <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
          </view>
        </picker>
        <view class="qe__label-row"><text class="qe__label">套餐模板 <text class="req">*</text></text><text v-if="session.role === 'boss'" class="qe__link" @tap="openPackageManage">管理套餐</text></view>
        <picker :range="templates.map(item => `${item.name}（${item.area}㎡ / ${money(item.price)}）`)" @change="pickTemplate(Number($event.detail.value))">
          <view class="qe__picker">
            <text class="jz-clamp-1" :class="{ 'qe__placeholder': !templateId }">{{ template ? template.name : '选择套餐模板' }}</text>
            <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
          </view>
        </picker>
        <text class="qe__label">计价面积（㎡）<text class="req">*</text></text>
        <input v-model="packageArea" type="digit" class="qe__input" placeholder="请输入实际计价面积" />
      </template>

      <text class="qe__label">整体折扣（%）</text>
      <input v-model="discount" type="number" class="qe__input" placeholder="100 表示不打折" />

      <view v-if="mode === 'custom' && design" class="qe__design">
        <view class="qe__design-head"><text class="jz-clamp-2">{{ design.name }}</text><text>{{ designMeta.designStatus[design.status] }}</text></view>
        <view class="qe__design-metrics">
          <view><text>{{ spaceCount }}</text><text>区域</text></view>
          <view><text>{{ itemCount }}</text><text>施工/材料分项</text></view>
          <view><text>{{ design.area }}㎡</text><text>方案面积</text></view>
        </view>
        <view class="qe__estimate"><text>折前分项合计</text><text>{{ money(estimatedAmount) }}</text></view>
        <view class="qe__formula"><JzIcon name="info" :size="24" :color="TOKEN_COLOR.primary" /><text>报价总额 = 分项合计 × 折扣 + 5% 税金，金额由系统自动计算。</text></view>
      </view>
      <view v-else-if="mode === 'package' && template" class="qe__design">
        <view class="qe__design-head"><text class="jz-clamp-2">{{ template.name }}</text><text>{{ mode === 'package' ? '套餐' : '报价' }}</text></view>
        <view class="qe__design-metrics">
          <view><text>{{ template.area }}</text><text>标准面积㎡</text></view>
          <view><text>{{ money(template.price) }}</text><text>套餐价</text></view>
          <view><text>{{ packageArea || 0 }}㎡</text><text>计价面积</text></view>
        </view>
        <view class="qe__estimate"><text>套餐折算金额</text><text>{{ money(packageEstimate) }}</text></view>
        <view class="qe__formula"><JzIcon name="info" :size="24" :color="TOKEN_COLOR.primary" /><text>套餐金额 = 套餐价 × 实际面积 ÷ 标准面积，再计算折扣和税金。</text></view>
      </view>
      <JzEmpty v-else-if="customerId && mode === 'custom'" :text="designs.length ? `已有 ${designs.length} 套方案，但仅 ${quotableDesigns.length} 套满足报价条件` : '该客户暂无可报价方案'" sub="可报价方案必须已完成区域尺寸和施工/主材分项；套餐报价不受此限制" />
      <JzEmpty v-else-if="mode === 'package' && !templates.length" text="暂无可用套餐模板" sub="企业负责人维护套餐模板后即可生成套餐报价" />
    </view>

    <view class="qe__tip">报价生成后会冻结项目、数量、价格、成本和公式。套餐扣减、升级、替换和自定义增项将在报价详情中形成独立报价行。</view>
    <view class="jz-actionbar"><view class="jz-actionbar__inner"><button v-if="mode === 'custom'" class="jz-btn jz-btn--neutral jz-btn--sm" @tap="openDesign">方案管理</button><button class="jz-btn jz-btn--primary jz-grow" :disabled="locked" :loading="submitting" @tap="save">{{ locked ? '报价已锁定' : `生成${mode === 'package' ? '套餐' : '自定义'}报价` }}</button></view></view>
  </view>
</template>

<style lang="scss" scoped>
.qe { min-height: 100vh; padding: 24rpx 24rpx 170rpx; background: $jzb-bg-page; width: 100%; overflow-x: hidden; }
.qe__steps { margin: 20rpx 0 18rpx; display: grid; grid-template-columns: repeat(5, 1fr); gap: 8rpx; }
.qe__steps text { padding: 12rpx 2rpx; color: $jzb-text-3; background: $jzb-text-inverse; border-radius: $jzb-radius-xs; text-align: center; font-size: $jzb-font-xs; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.qe__step-on { color: $jzb-text-inverse !important; background: $jzb-primary !important; font-weight: 650; }
.qe__lock { margin-bottom: 18rpx; padding: 24rpx; display: flex; align-items: center; gap: 16rpx; border: 1rpx solid rgba(105,88,200,.16); background: $jzb-purple-soft; }
.qe__lock-title { display: block; font-size: $jzb-font; font-weight: 750; }
.qe__lock-tip { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.qe__context { display: flex; align-items: center; padding: 26rpx; margin-bottom: 20rpx; }
.qe__icon { width: 80rpx; height: 80rpx; margin-right: 20rpx; display: flex; align-items: center; justify-content: center; border-radius: 24rpx; background: $jzb-purple-soft; }
.qe__title { display: block; font-size: $jzb-font-md; font-weight: 700; line-height: 1.4; }
.qe__sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.55; }
.qe__form { padding: 10rpx 28rpx 28rpx; }
.qe__label { display: block; margin: 24rpx 0 12rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.qe__label-row { display: flex; justify-content: space-between; align-items: center; }
.qe__link { color: $jzb-primary-dark; font-size: $jzb-font-xs; }
.req { color: $jzb-danger; }
.qe__picker, .qe__input { min-width: 0; min-height: 90rpx; padding: 0 22rpx; display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; color: $jzb-text-1; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; font-size: $jzb-font; }
.qe__picker > text { flex: 1; min-width: 0; margin-right: 12rpx; }
.qe__placeholder { color: $jzb-text-4; }
.qe__design { margin-top: 26rpx; padding: 24rpx; background: $jzb-primary-lightest; border-radius: $jzb-radius; }
.qe__design-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12rpx; color: $jzb-primary-dark; font-size: $jzb-font; font-weight: 700; }
.qe__design-head text:first-child { flex: 1; min-width: 0; line-height: 1.45; }
.qe__design-head text:last-child { flex-shrink: 0; white-space: nowrap; }
.qe__design-metrics { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 22rpx; padding: 18rpx 0; text-align: center; border-top: 1rpx solid rgba(14,138,125,.12); border-bottom: 1rpx solid rgba(14,138,125,.12); }
.qe__design-metrics text { display: block; }
.qe__design-metrics text:first-child { font-size: $jzb-font-md; font-weight: 750; }
.qe__design-metrics text:last-child { margin-top: 4rpx; color: $jzb-text-3; font-size: 20rpx; }
.qe__estimate { display: flex; justify-content: space-between; margin-top: 20rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.qe__estimate text:last-child { color: $jzb-primary-dark; font-size: $jzb-font-lg; font-weight: 750; }
.qe__formula { display: flex; gap: 8rpx; margin-top: 18rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.qe__mode { margin-bottom: 8rpx; }
.qe__context-readonly { margin-top: 18rpx; padding: 18rpx 22rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; }
.qe__context-readonly > view { display: flex; justify-content: space-between; gap: 18rpx; padding: 10rpx 0; font-size: $jzb-font-sm; }
.qe__context-readonly > view text:first-child { color: $jzb-text-3; flex-shrink: 0; }
.qe__context-readonly > view text:last-child { color: $jzb-text-1; font-weight: 600; text-align: right; }
.qe__tip { margin: 22rpx 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
</style>
