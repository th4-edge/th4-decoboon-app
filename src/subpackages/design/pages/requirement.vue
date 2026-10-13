<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
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
import JzSheet from '@/components/JzSheet.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

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
const filters: { key: Filter; label: string; count?: number; tone?: 'brand' | 'danger' | 'warning' }[] = [
  { key: 'all', label: '全部' },
  { key: 'demand', label: '诉求', count: demandCount.value, tone: 'brand' },
  { key: 'reject', label: '排斥点', count: rejectCount.value, tone: 'danger' },
  { key: 'high', label: '高优先', count: highCount.value, tone: 'warning' }
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
    uni.$emit('design-workbench:refresh')
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
    <view class="dr__header">
      <view class="dr__header-left">
        <text class="dr__title jz-clamp-1">{{ customer?.name || '客户' }}</text>
        <text class="dr__sub">记录客户偏好与排斥项</text>
      </view>
      <view class="dr__total">
        <text class="dr__total-num">{{ requirements.length }}</text>
        <text class="dr__total-label">条记录</text>
      </view>
    </view>

    <scroll-view scroll-x class="dr__tabs" :show-scrollbar="false">
      <view class="dr__tabs-row">
        <view v-for="item in filters" :key="item.key" class="dr__tab"
          :class="{
            'dr__tab--active': filter === item.key,
            'dr__tab--danger': item.tone === 'danger' && filter !== item.key,
            'dr__tab--warning': item.tone === 'warning' && filter !== item.key
          }"
          @tap="filter = item.key">
          {{ item.label }}<text v-if="item.count !== undefined" class="dr__tab-count">{{ item.count }}</text>
        </view>
      </view>
    </scroll-view>

    <JzSkeleton v-if="loadingData && !requirements.length" :rows="4" />
    <view v-else-if="filtered.length" class="dr__list">
      <view v-for="item in filtered" :key="item.id" class="dr__item" @tap="toggleItem(item.id)">
        <view class="dr__item-tags">
          <text class="dr__tag" :class="item.kind === 'reject' ? 'dr__tag--reject' : 'dr__tag--demand'">
            {{ designMeta.requirementKind[item.kind] === '客户诉求' ? '诉求' : '排斥点' }}
          </text>
          <text class="dr__tag" :class="{
            'dr__tag--high': item.priority === 'high',
            'dr__tag--medium': item.priority === 'medium',
            'dr__tag--low': item.priority === 'low'
          }">
            {{ designMeta.requirementPriority[item.priority] }}优先
          </text>
          <text class="dr__item-space">{{ item.spaceName || '不限区域' }}</text>
        </view>
        <text class="dr__item-title jz-clamp-2">{{ item.title }}</text>
        <text v-if="item.detail" class="dr__detail" :class="{ 'jz-clamp-2': !expandedItems[item.id] }">{{ item.detail }}</text>
      </view>
    </view>
    <view v-else class="dr__empty"><JzEmpty text="没有匹配的诉求" sub="切换筛选条件，或继续记录客户最新表达" /></view>

    <view class="dr__footer">
      <button class="jz-btn jz-btn--primary dr__submit" @tap="openForm"><JzIcon name="plus" :size="30" :color="TOKEN_COLOR.white" /><text>记录诉求</text></button>
      <view class="jz-tabbar-gap" />
    </view>

    <JzSheet :visible="formOpen" title="记录客户诉求" @close="formOpen = false">
      <view class="dr__editor">
        <text class="dr__sheet-sub">尽量保留客户原话，设计回应后续补充</text>
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
            <JzSelectField variant="boxed" :display="spaceLabel" :range="spaceOptions.map(i => i.label)" :index="Math.max(0, spaceOptions.findIndex(i => i.value === spaceType))" @change="spaceType = spaceOptions.find(i => i.label === $event)?.value || spaceType" />
            <input v-model="spaceName" class="jz-form-input" placeholder="客户叫法，如北卧" />
          </view>
          <text class="dr__field-label">诉求标题 *</text>
          <input v-model="title" class="jz-form-input" maxlength="128" placeholder="例：卫生间必须做干湿分离" />
          <text class="dr__field-label">客户原话 / 补充</text>
          <textarea v-model="detail" class="jz-form-textarea" maxlength="500" placeholder="记录客户为什么这样要求，后续谈单才能准确回应" />
          <text class="dr__field-label">沟通来源</text>
          <JzSelectField variant="boxed" :display="source" :range="['电话', '到店沟通', '量房现场', '微信', '视频会议']" :index="Math.max(0, ['电话', '到店沟通', '量房现场', '微信', '视频会议'].indexOf(source))" @change="source = $event" />
        </scroll-view>
        <view class="dr__sheet-foot">
          <button class="jz-btn jz-btn--neutral" :disabled="submitting" @tap="formOpen = false">取消</button>
          <button class="jz-btn jz-btn--primary jz-grow" :loading="submitting" :disabled="submitting" @tap="save">保存诉求</button>
        </view>
      </view>
    </JzSheet>
  </view>
</template>

<style lang="scss" scoped>
.dr { min-height: 100vh; padding-bottom: 120rpx; background: $jzb-bg-page; width: 100%; overflow-x: hidden; }

/* 头部 */
.dr__header { display: flex; justify-content: space-between; align-items: flex-end; padding: $jzb-space-4 $jzb-page-pad $jzb-space-1; }
.dr__title { display: block; color: $jzb-text-1; font-size: $jzb-font-xl; font-weight: 700; }
.dr__sub { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.dr__total { text-align: right; }
.dr__total-num { display: block; color: $jzb-text-1; font-size: $jzb-font-xxl; font-weight: 700; }
.dr__total-label { display: block; color: $jzb-text-3; font-size: $jzb-font-xs; }

/* 筛选 tab */
.dr__tabs { padding: 0 $jzb-page-pad $jzb-space-3; white-space: nowrap; }
.dr__tabs-row { display: inline-flex; gap: $jzb-space-1; }
.dr__tab { display: inline-flex; align-items: center; padding: $jzb-space-1 $jzb-space-3; background: $jzb-bg-card; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-pill; color: $jzb-text-2; font-size: $jzb-font-xs; }
.dr__tab--active { background: $jzb-primary-dark; border-color: $jzb-primary-dark; color: $jzb-text-inverse; }
.dr__tab--danger { color: $jzb-danger; border-color: $jzb-danger-soft; }
.dr__tab--warning { color: $jzb-warning; border-color: $jzb-warning-soft; }
.dr__tab-count { margin-left: 6rpx; font-size: $jzb-font-xs; opacity: .8; }

/* 诉求列表卡片 */
.dr__list { padding: 0 $jzb-page-pad; }
.dr__item { padding: $jzb-space-4; margin-bottom: $jzb-space-3; background: $jzb-bg-card; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius; }
.dr__item:active { background: $jzb-bg-page; }
.dr__item-tags { display: flex; align-items: center; gap: $jzb-space-1; }
.dr__tag { padding: 2rpx $jzb-space-1; border-radius: $jzb-radius-xs; font-size: $jzb-font-xs; }
.dr__tag--demand { color: $jzb-primary-dark; background: $jzb-primary-lighter; }
.dr__tag--reject { color: $jzb-danger; background: $jzb-danger-soft; }
.dr__tag--high { color: $jzb-danger; background: $jzb-danger-soft; }
.dr__tag--medium { color: $jzb-warning; background: $jzb-warning-soft; }
.dr__tag--low { color: $jzb-text-3; background: $jzb-bg-page; }
.dr__item-space { margin-left: auto; color: $jzb-text-3; font-size: $jzb-font-xs; }
.dr__item-title { display: block; margin-top: $jzb-space-3; color: $jzb-text-1; font-size: $jzb-font; font-weight: 650; line-height: 1.45; word-break: break-word; }
.dr__detail { display: block; margin-top: $jzb-space-3; color: $jzb-text-2; font-size: $jzb-font-xs; line-height: 1.6; word-break: break-word; overflow-wrap: anywhere; }

.dr__empty { margin: 0 $jzb-page-pad; }

/* 底部固定主按钮 */
.dr__footer { position: fixed; left: 0; right: 0; bottom: 0; padding: $jzb-space-3 $jzb-page-pad calc(#{$jzb-space-3} + #{$jzb-safe-bottom}); background: $jzb-bg-card; border-top: 1rpx solid $jzb-border-light; }
.dr__submit { width: 100%; }

/* 弹出表单 */
.dr__editor { display: flex; flex-direction: column; height: calc(70vh - 32rpx); }
.dr__sheet-sub { display: block; margin-bottom: $jzb-space-2; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.45; }
.dr__sheet-content { flex: 1; min-height: 0; padding: $jzb-space-1 0 $jzb-space-4; }
.dr__field-label { display: block; margin: $jzb-space-5 0 $jzb-space-3; color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 650; }
/* input 直接使用 jz-form-input 时补充宽度和盒模型 */
.dr__sheet-content input.jz-form-input {
  width: 100%;
  box-sizing: border-box;
  display: block;
}
.dr__area-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: $jzb-space-3; }
.dr__area-row input { min-width: 0; }
.dr__area-picker { justify-content: space-between; }
.dr__source { justify-content: space-between; }
.dr__sheet-foot { flex-shrink: 0; padding-top: $jzb-space-3; display: flex; gap: $jzb-space-3; border-top: 1rpx solid $jzb-border-light; box-shadow: 0 -10rpx 30rpx rgba(15,23,42,.05); }
.dr__sheet-foot .jz-btn { min-height: 88rpx; white-space: nowrap; }

</style>
