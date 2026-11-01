<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import type { Customer } from '@/domains/crm/model'
import { crmApi } from '@/domains/crm/api'
import { propertyApi } from '@/domains/property/api'
import { consumePropertyPickerResult } from '@/domains/property/property-picker'
import type { Property } from '@/domains/property/model'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

const id = ref('')
const propertyId = ref('')
const customer = ref<Customer | null>(null)
const propertyPickerOpen = ref(false)
const properties = ref<Property[]>([])
const date = ref('')
const time = ref('')
const today = new Date()
const startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const maxDate = `${today.getFullYear() + 1}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const canSubmit = computed(() => !!date.value && !!time.value && !!currentProperty.value)
const currentProperty = computed(() => properties.value.find((item) => item.id === propertyId.value) || null)
const currentPropertyMeta = computed(() => {
  const p = currentProperty.value
  if (!p) return ''
  const area = p.area ? `${p.area}㎡` : '面积未填'
  const layout = p.layout || '户型未填'
  return `${area} · ${layout}`
})
const currentPropertyMeasured = computed(() => !!currentProperty.value?.latestMeasureAt)

onLoad(async (query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  id.value = query?.id || ''
  propertyId.value = query?.propertyId || ''
  if (!id.value) {
    toast('客户信息不完整，请返回客户列表后重新打开')
    setTimeout(() => uni.navigateBack(), 300)
    return
  }
  try {
    // 并行拉取客户信息和房屋列表，房屋列表用于回显当前选中房屋及多套房切换
    const [detail, list] = await Promise.all([
      crmApi.info(id.value),
      propertyApi.list(id.value)
    ])
    customer.value = detail || null
    properties.value = list
    const matched = list.some((property) => property.id === propertyId.value)
    propertyId.value = matched ? propertyId.value : (list.length === 1 ? list[0].id : '')
    if (propertyId.value) await loadScheduledForProperty()
  } catch (error) {
    toastError(error, '客户信息加载失败')
  }
})

async function loadScheduledForProperty() {
  date.value = ''
  time.value = ''
  if (!propertyId.value) return
  try {
    const measures = await propertyApi.measures(propertyId.value)
    const scheduled = measures.find((item) => item.status === 'scheduled') || measures[0]
    const scheduledAt = scheduled?.scheduledAt || scheduled?.measureTime
    if (scheduledAt) {
      date.value = scheduledAt.slice(0, 10)
      time.value = scheduledAt.slice(11, 16)
    }
  } catch {
    // 没有历史预约时保持空白，由用户重新选择。
  }
}

onShow(() => {
  if (!propertyPickerOpen.value) return
  propertyPickerOpen.value = false
  const result = consumePropertyPickerResult()
  if (!result) return
  if (result.action === 'clear') {
    propertyId.value = ''
    date.value = ''
    time.value = ''
    return
  }
  propertyId.value = result.value.id
  if (!properties.value.some((property) => property.id === propertyId.value)) {
    void propertyApi.list(id.value).then((list) => { properties.value = list })
  }
  void loadScheduledForProperty()
})

function openPropertyPicker() {
  if (!customer.value) return
  propertyPickerOpen.value = true
  const current = currentProperty.value
  const params = [
    `customerId=${encodeURIComponent(customer.value.id)}`,
    `customerName=${encodeURIComponent(customer.value.name || '')}`,
    `selectedId=${encodeURIComponent(propertyId.value || '')}`,
    `selectedName=${encodeURIComponent(current?.roomNo || current?.address || '')}`
  ]
  uni.navigateTo({ url: `${P.propertyPicker}?${params.join('&')}` })
}

async function save() {
  if (!propertyId.value) { toast('请先选择装修房屋'); return }
  if (!date.value || !time.value) { toast('请选择约定量房日期和时间'); return }
  const measureAt = `${date.value}T${time.value}:00`
  if (new Date(measureAt).getTime() <= Date.now()) { toast('约定量房时间必须晚于当前时间'); return }
  loading('正在记录量房约定…')
  try {
    await crmApi.measure(id.value, measureAt, propertyId.value)
    toast('已进入待量房', 'success')
    setTimeout(() => uni.navigateBack(), 400)
  } catch (error) {
    toastError(error, '约定量房失败')
  } finally {
    hideLoading()
  }
}
</script>

<template>
  <view class="cm">
    <view class="jz-card cm__intro">
      <view class="cm__icon"><JzIcon name="calendar" :size="42" :color="TOKEN_COLOR.primary" /></view>
      <view class="jz-grow">
        <text class="cm__title">约定客户量房时间</text>
        <text class="cm__sub">确认客户已同意量房后录入时间，客户将进入"待量房"，由团队负责人或店长指定设计师。</text>
      </view>
    </view>

    <!-- 当前约定量房的房屋：多套房时可切换，单套房时只读展示 -->
    <view class="jz-card cm__property">
      <view class="cm__property-head">
        <text class="cm__property-label">量房房屋</text>
        <view v-if="properties.length" class="cm__property-change" @tap="openPropertyPicker">
          <text>{{ currentProperty ? '更换房屋' : '选择房屋' }}</text>
          <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.primary" />
        </view>
        <text v-else class="cm__property-count">暂无房屋</text>
      </view>
      <view v-if="currentProperty" class="cm__property-body">
        <text class="cm__property-no">房号 {{ currentProperty.roomNo || '—' }}</text>
        <text class="cm__property-addr">{{ currentProperty.address || '尚未填写详细地址' }}</text>
        <text class="cm__property-meta">{{ currentPropertyMeta }}</text>
        <view v-if="currentPropertyMeasured" class="cm__property-warning">
          <JzIcon name="alert-circle" :size="22" :color="TOKEN_COLOR.warning" />
          <text>该房屋已有量房记录（{{ currentProperty.latestMeasureAt?.slice(0, 10) }}），再次约定将覆盖原约定时间</text>
        </view>
      </view>
      <view v-else-if="properties.length" class="cm__property-empty">
        <JzIcon name="home" :size="34" :color="TOKEN_COLOR.text3" />
        <text>请选择本次需要约定量房的具体房屋</text>
      </view>
      <view v-else class="cm__property-empty">
        <text>该客户尚未建立房屋档案</text>
      </view>
    </view>

    <view v-if="customer" class="jz-card cm__customer">
      <text class="cm__name">{{ customer.name }}</text>
      <text class="cm__meta">{{ customer.phone }} · {{ customer.community || '未填小区' }}</text>
    </view>

    <view class="jz-card cm__form">
      <view class="cm__row">
        <text class="cm__label">量房日期</text>
        <JzSelectField mode="date" variant="boxed" :value="date" :display="date" :start="startDate" :end="maxDate" placeholder="请选择日期" @change="date = $event" />
      </view>
      <view class="cm__row">
        <text class="cm__label">量房时间</text>
        <JzSelectField mode="time" variant="boxed" :value="time" :display="time" time-start="08:00" time-end="20:00" placeholder="请选择时间" @change="time = $event" />
      </view>
    </view>

    <view class="cm__tip">保存后客户阶段将变为"待量房"，流程状态不再允许从客户资料编辑中直接修改。</view>
    <view class="jz-actionbar">
      <view class="jz-actionbar__inner">
        <button class="jz-btn jz-btn--primary jz-grow" :disabled="!canSubmit" @tap="save">确认量房约定</button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.cm { min-height: 100vh; padding: 24rpx 24rpx 170rpx; background: $jzb-bg-page; }
.cm__intro { display: flex; align-items: center; padding: 26rpx; margin-bottom: 20rpx; }
.cm__icon { width: 82rpx; height: 82rpx; display: flex; align-items: center; justify-content: center; margin-right: 20rpx; border-radius: 24rpx; background: $jzb-primary-lightest; }
.cm__title { display: block; font-size: $jzb-font-md; font-weight: 700; }
.cm__sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }

.cm__property { padding: 24rpx; margin-bottom: 20rpx; }
.cm__property-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16rpx; }
.cm__property-label { color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 600; }
.cm__property-switch { display: inline-flex; align-items: center; gap: 4rpx; padding: 8rpx 20rpx; color: $jzb-primary-dark; background: $jzb-primary-lightest; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; font-weight: 600; }
.cm__property-count { color: $jzb-text-4; font-size: $jzb-font-xs; }
.cm__property-body { padding: 20rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; }
.cm__property-no { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.cm__property-addr { display: block; margin-top: 8rpx; color: $jzb-text-2; font-size: $jzb-font-sm; line-height: 1.5; }
.cm__property-meta { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cm__property-warning { display: flex; align-items: flex-start; gap: 8rpx; margin-top: 16rpx; padding: 16rpx; background: $jzb-warning-soft; border-radius: $jzb-radius-sm; }
.cm__property-warning text { flex: 1; color: $jzb-warning; font-size: $jzb-font-xs; line-height: 1.5; }
.cm__property-empty { padding: 32rpx 0; text-align: center; color: $jzb-text-4; font-size: $jzb-font-sm; }

.cm__customer { padding: 26rpx; margin-bottom: 20rpx; }
.cm__name { display: block; font-size: $jzb-font-lg; font-weight: 700; }
.cm__meta { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.cm__form { padding: 8rpx 28rpx; }
.cm__row { min-height: 100rpx; display: flex; align-items: center; border-bottom: 1rpx solid $jzb-border-light; }
.cm__row:last-child { border-bottom: none; }
.cm__label { width: 180rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.cm__value { color: $jzb-text-1; font-size: $jzb-font; }
.cm__value--empty { color: $jzb-text-4; }
.cm__tip { margin: 22rpx 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
</style>
