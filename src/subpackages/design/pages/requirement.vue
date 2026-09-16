<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import type { Customer } from '@/domains/crm/model'
import type { DesignRequirement, RequirementCategory, RequirementKind, RequirementPriority, SpaceType } from '@/domains/design/model'
import { designApi, designMeta } from '@/domains/design/api'
import { crmApi } from '@/domains/crm/api'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzFloatAdd from '@/components/JzFloatAdd.vue'

type Filter = 'all' | 'demand' | 'reject' | 'high'
const customerId = ref('')
const propertyId = ref('')
const customer = ref<Customer | null>(null)
const requirements = ref<DesignRequirement[]>([])
const loadingData = ref(false)
const filter = ref<Filter>('all')
const formOpen = ref(false)
const kind = ref<RequirementKind>('demand')
const category = ref<RequirementCategory>('function')
const priority = ref<RequirementPriority>('high')
const spaceType = ref<SpaceType | ''>('')
const spaceName = ref('')
const title = ref('')
const detail = ref('')
const source = ref('到店沟通')
const submitting = ref(false)
const autoOpen = ref(false)
const expandedItems = ref<Record<string, boolean>>({})

const kindOptions: { value: RequirementKind; label: string }[] = [
  { value: 'demand', label: '客户诉求' },
  { value: 'reject', label: '客户排斥点' }
]
const categoryOptions: { value: RequirementCategory; label: string }[] = [
  { value: 'function', label: '功能' }, { value: 'style', label: '风格' },
  { value: 'material', label: '材料' }, { value: 'budget', label: '预算' },
  { value: 'schedule', label: '工期' }, { value: 'quality', label: '质量' },
  { value: 'other', label: '其他' }
]
const priorityOptions: { value: RequirementPriority; label: string }[] = [
  { value: 'high', label: '高' }, { value: 'medium', label: '中' }, { value: 'low', label: '低' }
]
const spaceOptions: { value: SpaceType; label: string }[] = [
  { value: 'livingRoom', label: '客餐厅' }, { value: 'bedroom', label: '卧室' },
  { value: 'kitchen', label: '厨房' }, { value: 'bathroom', label: '卫生间' },
  { value: 'balcony', label: '阳台' }, { value: 'diningRoom', label: '餐厅' }
]
const spaceLabel = computed(() => spaceOptions.find((item) => item.value === spaceType.value)?.label || '不限区域')
const demandCount = computed(() => requirements.value.filter((item) => item.kind === 'demand').length)
const rejectCount = computed(() => requirements.value.filter((item) => item.kind === 'reject').length)
const highCount = computed(() => requirements.value.filter((item) => item.priority === 'high').length)
const filtered = computed(() => requirements.value.filter((item) => {
  if (filter.value === 'demand') return item.kind === 'demand'
  if (filter.value === 'reject') return item.kind === 'reject'
  if (filter.value === 'high') return item.priority === 'high'
  return true
}))
const filters: { key: Filter; label: string; count?: number }[] = [
  { key: 'all', label: '全部' }, { key: 'demand', label: '诉求' },
  { key: 'reject', label: '排斥点' }, { key: 'high', label: '高优先' }
]

onLoad((query) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  customerId.value = query?.customerId || ''
  propertyId.value = query?.propertyId || ''
  autoOpen.value = query?.create === '1'
  if (!customerId.value) {
    toast('缺少客户信息')
    setTimeout(() => uni.navigateBack(), 500)
  }
})
onShow(() => { if (customerId.value) void load() })

async function load() {
  loadingData.value = true
  try {
    const [c, list] = await Promise.all([crmApi.info(customerId.value), designApi.requirements(customerId.value)])
    customer.value = c
    requirements.value = list
    if (autoOpen.value) {
      autoOpen.value = false
      openForm()
    }
  } catch (error) {
    toastError(error, '诉求加载失败')
  } finally {
    loadingData.value = false
  }
}

function toggleItem(id: string) {
  expandedItems.value[id] = !expandedItems.value[id]
}
function reset() {
  kind.value = 'demand'
  category.value = 'function'
  priority.value = 'high'
  spaceType.value = ''
  spaceName.value = ''
  title.value = ''
  detail.value = ''
  source.value = '到店沟通'
}
function openForm() {
  reset()
  formOpen.value = true
}
async function save() {
  if (!title.value.trim()) { toast('请填写诉求标题'); return }
  submitting.value = true
  loading('保存诉求…')
  try {
    await designApi.saveRequirement({
      customerId: customerId.value,
      propertyId: propertyId.value || undefined,
      type: spaceType.value || undefined,
      spaceName: spaceName.value.trim() || undefined,
      kind: kind.value,
      category: category.value,
      priority: priority.value,
      title: title.value.trim(),
      detail: detail.value.trim() || undefined,
      source: source.value
    })
    formOpen.value = false
    await load()
    toast('诉求已记录', 'success')
  } catch (error) {
    toastError(error, '诉求保存失败')
  } finally {
    hideLoading()
    submitting.value = false
  }
}
</script>

<template>
  <view class="dr">
    <view class="dr__hero">
      <view class="jz-between">
        <view>
          <text class="dr__eyebrow">客户诉求库</text>
          <text class="dr__title jz-clamp-1">{{ customer?.name || '客户' }}</text>
        </view>
        <view class="dr__total"><text>{{ requirements.length }}</text><text>条记录</text></view>
      </view>
      <view class="dr__summary">
        <view><text>{{ demandCount }}</text><text>明确诉求</text></view>
        <view><text>{{ rejectCount }}</text><text>排斥点</text></view>
        <view><text>{{ highCount }}</text><text>高优先级</text></view>
      </view>
    </view>

    <scroll-view scroll-x class="jz-toolbar" :show-scrollbar="false">
      <view class="jz-toolbar__row">
        <view v-for="item in filters" :key="item.key" class="jz-toolbar__item" :class="{ 'jz-toolbar__item--active': filter === item.key }" @tap="filter = item.key">{{ item.label }}</view>
      </view>
    </scroll-view>

    <JzSkeleton v-if="loadingData && !requirements.length" :rows="4" />
    <view v-else-if="filtered.length" class="dr__list">
      <view v-for="item in filtered" :key="item.id" class="jz-card dr__item" @tap="toggleItem(item.id)">
        <view class="dr__item-main">
          <view class="dr__item-top">
            <text class="dr__kind" :class="{ 'dr__kind--reject': item.kind === 'reject' }">{{ designMeta.requirementKind[item.kind] }}</text>
            <text class="dr__priority" :class="`dr__priority--${item.priority}`">{{ designMeta.requirementPriority[item.priority] }}优先</text>
          </view>
          <text class="dr__item-title jz-clamp-2">{{ item.title }}</text>
          <view class="dr__meta"><JzIcon name="map-pin" :size="22" color="#778390" /><text>{{ item.spaceName || '全局诉求' }}</text><text>·</text><text>{{ item.source || '沟通记录' }}</text></view>
          <text v-if="item.detail" class="dr__detail" :class="{ 'jz-clamp-3': !expandedItems[item.id] }">{{ item.detail }}</text>
        </view>
        <view class="dr__arrow"><JzIcon :name="expandedItems[item.id] ? 'chevron-down' : 'chevron-right'" :size="26" color="#AEB8C2" /></view>
      </view>
    </view>
    <view v-else class="dr__empty jz-card"><JzEmpty text="没有匹配的诉求" sub="切换筛选条件，或继续记录客户最新表达" /></view>

    <JzFloatAdd text="记录诉求" @tap="openForm" />

    <view v-if="formOpen" class="dr__mask" @tap="formOpen = false">
      <view class="dr__sheet" @tap.stop>
        <view class="dr__sheet-head">
          <view><text class="dr__sheet-title jz-clamp-1">记录客户诉求</text><text class="dr__sheet-sub">尽量保留客户原话，设计回应后续补充</text></view>
          <view class="dr__close" @tap="formOpen = false"><JzIcon name="close" :size="30" color="#778390" /></view>
        </view>
        <scroll-view scroll-y class="dr__sheet-content">
          <text class="dr__field-label">诉求类型</text>
          <view class="jz-segment">
            <view v-for="item in kindOptions" :key="item.value" class="jz-segment__item" :class="{ 'jz-segment__item--active': kind === item.value }" @tap="kind = item.value">{{ item.label }}</view>
          </view>
          <text class="dr__field-label">诉求分类</text>
          <view class="jz-chip-row">
            <view v-for="item in categoryOptions" :key="item.value" class="jz-chip" :class="{ 'jz-chip--active': category === item.value }" @tap="category = item.value">{{ item.label }}</view>
          </view>
          <text class="dr__field-label">优先级</text>
          <view class="jz-segment">
            <view v-for="item in priorityOptions" :key="item.value" class="jz-segment__item" :class="{ 'jz-segment__item--active': priority === item.value }" @tap="priority = item.value">{{ item.label }}</view>
          </view>
          <text class="dr__field-label">关联区域</text>
          <view class="dr__area-row">
            <picker :range="spaceOptions.map(i => i.label)" @change="spaceType = spaceOptions[Number($event.detail.value)].value"><view class="jz-form-input dr__area-picker"><text>{{ spaceLabel }}</text><JzIcon name="chevron-down" :size="24" color="#778390" /></view></picker>
            <input v-model="spaceName" class="jz-form-input" placeholder="客户叫法，如北卧" />
          </view>
          <text class="dr__field-label">诉求标题 *</text>
          <input v-model="title" class="jz-form-input" maxlength="128" placeholder="例：卫生间必须做干湿分离" />
          <text class="dr__field-label">客户原话 / 补充</text>
          <textarea v-model="detail" class="jz-form-textarea" maxlength="500" placeholder="记录客户为什么这样要求，后续谈单才能准确回应" />
          <text class="dr__field-label">沟通来源</text>
          <picker :range="['电话', '到店沟通', '量房现场', '微信', '视频会议']" @change="source = ['电话', '到店沟通', '量房现场', '微信', '视频会议'][Number($event.detail.value)]">
            <view class="jz-form-input dr__source"><text>{{ source }}</text><JzIcon name="chevron-down" :size="24" color="#778390" /></view>
          </picker>
        </scroll-view>
        <view class="dr__sheet-foot">
          <button class="jz-btn jz-btn--neutral" @tap="formOpen = false">取消</button>
          <button class="jz-btn jz-btn--primary jz-grow" :loading="submitting" @tap="save">保存诉求</button>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.dr { min-height: 100vh; padding-bottom: 150rpx; background: $jzb-bg-page; width: 100%; overflow-x: hidden; }
.dr__hero { margin: $jzb-page-gap $jzb-page-pad; padding: 34rpx 30rpx; color: #fff; background: linear-gradient(135deg, $jzb-purple, $jzb-primary); border-radius: $jzb-radius-lg; box-shadow: $jzb-shadow-card; }
.dr__eyebrow { display: block; font-size: $jzb-font-sm; opacity: .78; }
.dr__title { display: block; margin-top: 8rpx; font-size: 46rpx; font-weight: 750; line-height: 1.3; }
.dr__total { min-width: 116rpx; padding: 16rpx; text-align: center; background: rgba(255,255,255,.14); border-radius: 18rpx; }
.dr__total text { display: block; }
.dr__total text:first-child { font-size: $jzb-font-xl; font-weight: 750; }
.dr__total text:last-child { margin-top: 3rpx; font-size: $jzb-font-xs; opacity: .78; }
.dr__summary { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 28rpx; padding-top: 22rpx; border-top: 1rpx solid rgba(255,255,255,.16); text-align: center; }
.dr__summary text { display: block; }
.dr__summary text:first-child { font-size: $jzb-font-lg; font-weight: 700; }
.dr__summary text:last-child { margin-top: 5rpx; font-size: $jzb-font-xs; opacity: .76; }
.dr__list { padding: 0 $jzb-page-pad; }
.dr__item { padding: 26rpx; margin-bottom: 16rpx; display: flex; align-items: center; transition: transform $jzb-duration-fast $jzb-ease-out; }
.dr__item:active { transform: scale(0.99); background: $jzb-bg-hover; }
.dr__item-main { flex: 1; min-width: 0; }
.dr__item-top { display: flex; align-items: center; gap: 12rpx; }
.dr__kind { padding: 5rpx 13rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; }
.dr__kind--reject { color: $jzb-danger; background: $jzb-danger-soft; }
.dr__priority { padding: 5rpx 13rpx; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; }
.dr__priority--high { color: $jzb-danger; background: $jzb-danger-soft; }
.dr__priority--medium { color: $jzb-warning; background: $jzb-warning-soft; }
.dr__priority--low { color: $jzb-text-3; background: $jzb-bg-hover; }
.dr__item-title { display: block; margin-top: 16rpx; font-size: $jzb-font-md; font-weight: 700; line-height: 1.45; word-break: break-word; }
.dr__meta { display: flex; align-items: center; gap: 6rpx; margin-top: 10rpx; color: $jzb-text-3; font-size: $jzb-font-xs; min-width: 0; }
.dr__meta text { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.dr__detail { display: block; margin-top: 14rpx; padding: 16rpx 18rpx; color: $jzb-text-2; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; line-height: 1.6; word-break: break-word; overflow-wrap: anywhere; }
.dr__arrow { margin-left: 12rpx; }
.dr__empty { margin: 0 $jzb-page-pad; }
.dr__mask { position: fixed; inset: 0; z-index: 100; display: flex; align-items: flex-end; background: rgba(15,23,42,.48); }
.dr__sheet { width: 100%; height: 88vh; display: flex; flex-direction: column; background: #fff; border-radius: 32rpx 32rpx 0 0; }
.dr__sheet-head { padding: 30rpx $jzb-page-pad 22rpx; display: flex; justify-content: space-between; border-bottom: 1rpx solid $jzb-border-light; }
.dr__sheet-title { display: block; font-size: $jzb-font-xl; font-weight: 750; line-height: 1.35; }
.dr__sheet-sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.45; }
.dr__close { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; background: $jzb-bg-hover; border-radius: 50%; }
.dr__sheet-content { flex: 1; min-height: 0; height: 0; padding: 8rpx $jzb-page-pad 30rpx; overflow: hidden; }
.dr__field-label { display: block; margin: 26rpx 0 12rpx; color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 650; }
.dr__area-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14rpx; }
.dr__area-row input { min-width: 0; }
.dr__area-picker { justify-content: space-between; }
.dr__source { justify-content: space-between; }
.dr__sheet-foot { padding: 16rpx $jzb-page-pad calc(16rpx + #{$jzb-safe-bottom}); display: flex; gap: 14rpx; border-top: 1rpx solid $jzb-border-light; box-shadow: 0 -10rpx 30rpx rgba(15,23,42,.05); }
.dr__sheet-foot .jz-btn { min-height: 88rpx; white-space: nowrap; }
@media (min-width: 768px) { .dr__mask, .dr__sheet { left: 50%; right: auto; width: 560px; transform: translateX(-50%); } }
</style>
