<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import type { Customer } from '@/domains/crm/model'
import type { DesignScheme } from '@/domains/design/model'
import type { PackageTemplate } from '@/domains/pack/model'
import type { Project } from '@/domains/project/model'
import type { Property } from '@/domains/property/model'
import type { Quote, QuoteMode } from '@/domains/trade/model'
import { CUSTOMER_STAGE_META } from '@/domains/crm/meta'
import { crmApi } from '@/domains/crm/api'
import { designApi, designMeta } from '@/domains/design/api'
import { packApi } from '@/domains/pack/api'
import { projectApi } from '@/domains/project/api'
import { propertyApi } from '@/domains/property/api'
import { tradeApi } from '@/domains/trade/api'
import { consumeCustomerPickerResult } from '@/domains/crm/customer-picker'
import { consumePropertyPickerResult } from '@/domains/property/property-picker'
import { consumeDesignSchemePickerResult } from '@/domains/design/design-picker'
import { consumePackagePickerResult } from '@/domains/pack/package-picker'
import { money } from '@/core/format'
import { TOKEN_COLOR } from '@/styles/tokens'
import { toast, toastError, loading, hideLoading } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'
import JzEmpty from '@/components/JzEmpty.vue'

const customerId = ref('')
const propertyId = ref('')
const designId = ref('')
const templateId = ref('')
const packageArea = ref('')
const mode = ref<Exclude<QuoteMode, 'hybrid'>>('package')
const customer = ref<Customer | null>(null)
const property = ref<Property | null>(null)
const design = ref<DesignScheme | null>(null)
const template = ref<PackageTemplate | null>(null)
const customerProjects = ref<Project[]>([])
const customerQuotes = ref<Quote[]>([])
const discount = ref('100')
const submitting = ref(false)
const designContextLocked = ref(false)

const propertyLabel = computed(() => {
  const current = property.value
  if (!current) return ''
  return [current.community, current.building, current.roomNo].filter(Boolean).join('') || current.address || '房屋待完善'
})
const designProperty = computed(() => design.value?.property || property.value || null)
const itemCount = computed(() => design.value?.items?.length || 0)
const spaceCount = computed(() => design.value?.spaces?.length || 0)
const estimatedAmount = computed(() => (design.value?.items || []).reduce((sum, item) => sum + item.amount, 0))
const lockedProject = computed(() => customerProjects.value.find((item) => item.customer?.id === customerId.value) || null)
const lockedQuote = computed(() => customerQuotes.value.find((item) => item.customer?.id === customerId.value && (item.status === 'accepted' || item.status === 'converted')) || null)
const locked = computed(() => !!lockedProject.value || !!lockedQuote.value)
const packageEstimate = computed(() => {
  if (!template.value || !packageArea.value) return 0
  return template.value.area > 0 ? template.value.price * Number(packageArea.value) / template.value.area : 0
})
const customerMeta = computed(() => customer.value
  ? [customer.value.phone, customer.value.owner?.name || '未分配负责人', CUSTOMER_STAGE_META[customer.value.stage].label].filter(Boolean).join(' · ')
  : '按负责人、阶段和最近跟进选择')

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
  void restore()
})
onShow(() => { void consumePickerResults() })

async function restore() {
  try {
    if (designId.value) await loadDesign(designId.value)
    if (customerId.value) await loadCustomerContext()
    if (propertyId.value) await loadProperty(propertyId.value)
    if (templateId.value) await loadTemplate(templateId.value)
  } catch (error) {
    toastError(error, '设计报价基础数据加载失败')
  }
}
async function loadCustomerContext() {
  if (!customerId.value) {
    customer.value = null
    customerProjects.value = []
    customerQuotes.value = []
    return
  }
  const [info, projects, quotes] = await Promise.all([
    crmApi.info(customerId.value),
    projectApi.list({ customerId: customerId.value }),
    tradeApi.quotes({ customerId: customerId.value })
  ])
  customer.value = info
  customerProjects.value = projects
  customerQuotes.value = quotes
}
async function loadProperty(id: string) {
  property.value = id ? await propertyApi.info(id) : null
}
async function loadDesign(id: string) {
  const value = id ? await designApi.scheme(id) : null
  design.value = value
  if (value?.customer?.id) customerId.value = value.customer.id
  if (value?.property?.id) propertyId.value = value.property.id
  if (!property.value && propertyId.value) await loadProperty(propertyId.value)
}
async function loadTemplate(id: string) {
  const value = id ? await packApi.template(id) : null
  template.value = value
  if (value?.area) packageArea.value = String(value.area)
}

async function consumePickerResults() {
  try {
    await consumePickerResultsUnsafe()
  } catch (error) {
    toastError(error, '选择器结果读取失败')
  }
}
async function consumePickerResultsUnsafe() {
  const customerResult = consumeCustomerPickerResult()
  if (customerResult) {
    if (customerResult.action === 'clear') {
      customerId.value = ''
      customer.value = null
    } else {
      customerId.value = customerResult.value.id
      await loadCustomerContext()
    }
    propertyId.value = ''
    property.value = null
    designId.value = ''
    design.value = null
    templateId.value = ''
    template.value = null
    packageArea.value = ''
    return
  }

  const propertyResult = consumePropertyPickerResult()
  if (propertyResult) {
    if (propertyResult.action === 'clear' || propertyResult.value.customerId !== customerId.value) {
      propertyId.value = ''
      property.value = null
    } else {
      propertyId.value = propertyResult.value.id
      await loadProperty(propertyId.value)
    }
    return
  }

  const designResult = consumeDesignSchemePickerResult()
  if (designResult) {
    if (designResult.action === 'clear') {
      designId.value = ''
      design.value = null
      return
    }
    if (!designResult.value.quotable) {
      toast('该方案不满足报价条件')
      return
    }
    designId.value = designResult.value.id
    await loadDesign(designId.value)
    templateId.value = ''
    template.value = null
    packageArea.value = ''
    return
  }

  const packageResult = consumePackagePickerResult()
  if (packageResult) {
    if (packageResult.action === 'clear') {
      templateId.value = ''
      template.value = null
      packageArea.value = ''
      return
    }
    templateId.value = packageResult.value.id
    await loadTemplate(templateId.value)
    designId.value = ''
    design.value = null
  }
}

function switchMode(value: Exclude<QuoteMode, 'hybrid'>) {
  if (designContextLocked.value && value !== 'custom') return
  mode.value = value
  if (value === 'package') {
    designId.value = ''
    design.value = null
  } else {
    templateId.value = ''
    template.value = null
    packageArea.value = ''
  }
}
function queryString(params: Record<string, string | undefined>) {
  return Object.entries(params)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
}
function openCustomerPicker() {
  if (designContextLocked.value) return
  uni.navigateTo({ url: `${P.customerPicker}?${queryString({
    selectedId: customerId.value || undefined,
    selectedName: customer.value?.name,
    selectedMeta: customer.value ? customerMeta.value : undefined
  })}` })
}
function openPropertyPicker() {
  if (designContextLocked.value) return
  if (!customerId.value) { toast('请先选择客户'); return }
  uni.navigateTo({ url: `${P.propertyPicker}?${queryString({
    customerId: customerId.value,
    customerName: customer.value?.name,
    selectedId: propertyId.value || undefined,
    selectedName: propertyLabel.value || undefined
  })}` })
}
function openDesignPicker() {
  if (designContextLocked.value) return
  if (!customerId.value) { toast('请先选择客户'); return }
  uni.navigateTo({ url: `${P.designSchemePicker}?${queryString({
    customerId: customerId.value,
    propertyId: propertyId.value || undefined,
    selectedId: designId.value || undefined,
    selectedName: design.value?.name
  })}` })
}
function openPackagePicker() {
  uni.navigateTo({ url: `${P.packagePicker}?${queryString({
    selectedId: templateId.value || undefined,
    selectedName: template.value?.name
  })}` })
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
  if (mode.value === 'custom' && !designId.value) { toast('请选择已完成方案'); return }
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
    uni.redirectTo({ url: `${P.quoteDetail}?id=${quote.id}` })
  } catch (error) {
    hideLoading()
    toastError(error, '生成报价失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="qe">
    <view class="qe__steps">
      <text class="qe__step-on">1 选客户</text><text :class="{ 'qe__step-on': propertyId || designId }">2 选房屋/方案</text><text :class="{ 'qe__step-on': templateId || designId }">3 选套餐</text><text :class="{ 'qe__step-on': packageArea || designId }">4 计价</text><text>5 生成</text>
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

      <text class="qe__label">客户 <text class="req">*</text></text>
      <view class="qe__biz-card" :class="{ 'qe__biz-card--empty': !customer }" @tap="openCustomerPicker">
        <view class="qe__biz-icon"><JzIcon name="user" :size="34" :color="TOKEN_COLOR.primary" /></view>
        <view class="qe__biz-main">
          <text class="qe__biz-name">{{ customer?.name || '选择客户' }}</text>
          <text class="qe__biz-meta">{{ customer ? customerMeta : '按负责人、阶段和最近跟进选择' }}</text>
        </view>
        <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
      </view>

      <template v-if="mode === 'custom'">
        <view class="qe__label-row"><text class="qe__label">设计方案 <text class="req">*</text></text><text v-if="!designContextLocked" class="qe__link" @tap="openDesign">去设计转化</text></view>
        <view class="qe__biz-card" :class="{ 'qe__biz-card--empty': !design }" @tap="openDesignPicker">
          <view class="qe__biz-icon qe__biz-icon--purple"><JzIcon name="edit" :size="34" :color="TOKEN_COLOR.purple" /></view>
          <view class="qe__biz-main">
            <text class="qe__biz-name">{{ design?.name || '选择设计方案' }}</text>
            <text class="qe__biz-meta">{{ design ? [designMeta.designStatus[design.status], `V${design.version}`, `${spaceCount}个区域`, `${itemCount}个分项`].join(' · ') : '只展示达到可报价条件的方案' }}</text>
          </view>
          <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
        </view>
      </template>

      <template v-else>
        <text class="qe__label">客户房屋 <text class="req">*</text></text>
        <view class="qe__biz-card" :class="{ 'qe__biz-card--empty': !property }" @tap="openPropertyPicker">
          <view class="qe__biz-icon"><JzIcon name="home" :size="34" :color="TOKEN_COLOR.primary" /></view>
          <view class="qe__biz-main">
            <text class="qe__biz-name">{{ propertyLabel || '选择客户房屋' }}</text>
            <text class="qe__biz-meta">{{ property ? [property.address, `${property.area || 0}㎡`, property.layout].filter(Boolean).join(' · ') : '请选择客户名下的房屋' }}</text>
          </view>
          <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
        </view>

        <view class="qe__label-row"><text class="qe__label">套餐模板 <text class="req">*</text></text><text v-if="session.role === 'boss'" class="qe__link" @tap="openPackageManage">管理套餐</text></view>
        <view class="qe__biz-card" :class="{ 'qe__biz-card--empty': !template }" @tap="openPackagePicker">
          <view class="qe__biz-icon qe__biz-icon--warning"><JzIcon name="package" :size="34" :color="TOKEN_COLOR.warning" /></view>
          <view class="qe__biz-main">
            <text class="qe__biz-name">{{ template?.name || '选择套餐模板' }}</text>
            <text class="qe__biz-meta">{{ template ? `标准${template.area}㎡ · ${money(template.price)} · 折扣${Math.round((template.discount || 1) * 100)}%` : '按面积段、套餐内容和价格比较' }}</text>
          </view>
          <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
        </view>
        <text class="qe__label">计价面积（㎡）<text class="req">*</text></text>
        <input v-model="packageArea" type="digit" class="qe__input jz-numeric-input" placeholder="请输入实际计价面积" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
      </template>

      <text class="qe__label">整体折扣（%）</text>
      <input v-model="discount" type="number" class="qe__input jz-numeric-input" placeholder="100 表示不打折" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />

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
        <view class="qe__design-head"><text class="jz-clamp-2">{{ template.name }}</text><text>套餐</text></view>
        <view class="qe__design-metrics">
          <view><text>{{ template.area }}</text><text>标准面积㎡</text></view>
          <view><text>{{ money(template.price) }}</text><text>套餐价</text></view>
          <view><text>{{ packageArea || 0 }}㎡</text><text>计价面积</text></view>
        </view>
        <view class="qe__estimate"><text>套餐折算金额</text><text>{{ money(packageEstimate) }}</text></view>
        <view class="qe__formula"><JzIcon name="info" :size="24" :color="TOKEN_COLOR.primary" /><text>套餐金额 = 套餐价 × 实际面积 ÷ 标准面积，再计算折扣和税金。</text></view>
      </view>
      <JzEmpty v-else-if="customerId && mode === 'custom'" text="该客户暂无可报价方案" sub="可报价方案必须已完成区域尺寸和施工/主材分项" />
      <JzEmpty v-else-if="mode === 'package' && !templateId" text="请选择套餐模板" sub="点击上方套餐卡，按面积段和套餐内容选择" />
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
.qe__form { padding: 10rpx 28rpx 28rpx; }
.qe__label { display: block; margin: 24rpx 0 12rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.qe__label-row { display: flex; justify-content: space-between; align-items: center; }
.qe__link { color: $jzb-primary-dark; font-size: $jzb-font-xs; }
.req { color: $jzb-danger; }
.qe__input { min-width: 0; min-height: 90rpx; padding: 0 22rpx; display: flex; align-items: center; box-sizing: border-box; color: $jzb-text-1; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; font-size: $jzb-font; }
.qe__biz-card { display: flex; align-items: center; gap: 18rpx; min-height: 112rpx; padding: 20rpx 22rpx; background: $jzb-bg-card; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius; }
.qe__biz-card--empty { background: $jzb-bg-hover; border-style: dashed; }
.qe__biz-icon { width: 72rpx; height: 72rpx; flex: none; display: flex; align-items: center; justify-content: center; background: $jzb-primary-lighter; border-radius: 24rpx; }
.qe__biz-icon--purple { background: $jzb-purple-soft; }
.qe__biz-icon--warning { background: $jzb-warning-soft; }
.qe__biz-main { flex: 1; min-width: 0; }
.qe__biz-name { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.qe__biz-meta { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.45; }
.qe__mode { margin-bottom: 8rpx; }
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
.qe__tip { margin: 22rpx 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
</style>
