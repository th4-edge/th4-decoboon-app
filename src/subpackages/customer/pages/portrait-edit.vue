<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { crmApi } from '@/domains/crm/api'
import type { Customer } from '@/domains/crm/model'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

interface PortraitField {
  key: string
  label: string
  hint: string
  options: Array<{ value: string; label: string }>
}

const customerId = ref('')
const customer = ref<Customer | null>(null)
const submitting = ref(false)
const form = ref<Record<string, string>>({
  decisionRole: '', purpose: '', houseCondition: '', startWindow: '',
  style: '', eco: '', household: '', payment: '', competitor: ''
})
const concerns = ref<string[]>([])

const fields: PortraitField[] = [
  { key: 'decisionRole', label: '决策角色', hint: '决定谈谁、谈单策略', options: [
    { value: 'Self', label: '本人决策' }, { value: 'Couple', label: '夫妻共同' },
    { value: 'Parents', label: '父母出资' }, { value: 'Children', label: '子女代订' }, { value: 'Unknown', label: '待确认' }] },
  { key: 'purpose', label: '装修动机', hint: '决定推什么方案', options: [
    { value: 'FirstHome', label: '自住首装' }, { value: 'Improve', label: '改善' }, { value: 'Wedding', label: '婚房' },
    { value: 'SchoolDistrict', label: '学区' }, { value: 'Investment', label: '投资出租' }, { value: 'Partial', label: '局部改造' }] },
  { key: 'houseCondition', label: '房屋现状', hint: '决定工艺与工期', options: [
    { value: 'Rough', label: '毛坯' }, { value: 'Old', label: '旧房翻新' },
    { value: 'Refined', label: '精装改造' }, { value: 'Pending', label: '待交付' }] },
  { key: 'startWindow', label: '计划开工', hint: '决定跟进节奏与紧迫度', options: [
    { value: 'WithinOneMonth', label: '1个月内' }, { value: 'OneToThreeMonths', label: '1-3个月' },
    { value: 'ThreeToSixMonths', label: '3-6个月' }, { value: 'HalfYearPlus', label: '半年以上' }, { value: 'Undecided', label: '待定' }] },
  { key: 'style', label: '风格偏好', hint: '决定设计与主材', options: [
    { value: 'Modern', label: '现代简约' }, { value: 'Luxury', label: '轻奢' }, { value: 'NewChinese', label: '新中式' },
    { value: 'Cream', label: '奶油风' }, { value: 'Wood', label: '原木' }, { value: 'Industrial', label: '工业' }, { value: 'Undecided', label: '待定' }] },
  { key: 'eco', label: '环保要求', hint: '决定主材升级与话术', options: [
    { value: 'Elder', label: '有老人' }, { value: 'Infant', label: '有婴幼儿' },
    { value: 'Pregnant', label: '有孕妇' }, { value: 'None', label: '无特殊要求' }] },
  { key: 'household', label: '居住人口', hint: '决定空间规划', options: [
    { value: 'Single', label: '独居' }, { value: 'Couple', label: '两口' }, { value: 'ThreePlus', label: '三口及以上' },
    { value: 'ThreeGenerations', label: '三代同堂' }, { value: 'Unknown', label: '待确认' }] },
  { key: 'payment', label: '付款方式', hint: '决定成交与回款方案', options: [
    { value: 'Full', label: '全款' }, { value: 'Installment', label: '分期' }, { value: 'Loan', label: '贷款' }, { value: 'Unknown', label: '待确认' }] },
  { key: 'competitor', label: '竞品对比', hint: '决定竞争策略', options: [
    { value: 'None', label: '未对比' }, { value: 'ComparingOneTwo', label: '在对比1-2家' },
    { value: 'ComparingThreePlus', label: '在对比3家以上' }, { value: 'ChosenOther', label: '已选定同行' }] }
]
const concernOptions = [
  { value: 'Price', label: '价格' }, { value: 'Duration', label: '工期' }, { value: 'Quality', label: '质量' },
  { value: 'Eco', label: '环保' }, { value: 'AfterSales', label: '售后' }
]

function optionIndex(field: PortraitField) {
  const index = field.options.findIndex((item) => item.value === form.value[field.key])
  return index < 0 ? 0 : index
}
function optionLabel(field: PortraitField) {
  return field.options.find((item) => item.value === form.value[field.key])?.label || '未填写'
}
function onPick(key: string, label: string) {
  const field = fields.find((item) => item.key === key)
  if (!field) return
  form.value[key] = field.options.find((option) => option.label === label)?.value || ''
}
function toggleConcern(value: string) {
  const index = concerns.value.indexOf(value)
  if (index >= 0) concerns.value.splice(index, 1)
  else concerns.value.push(value)
}

const filledCount = computed(() => fields.filter((field) => form.value[field.key]).length + (concerns.value.length ? 1 : 0))

onLoad(async (query) => {
  customerId.value = query?.customerId || ''
  if (!customerId.value) { toast('客户信息不完整，请返回客户列表后重新打开'); return }
  try {
    const detail = await crmApi.info(customerId.value)
    customer.value = detail
    const portrait = detail?.portrait
    if (portrait) {
      form.value = {
        decisionRole: portrait.decisionRole || '', purpose: portrait.purpose || '',
        houseCondition: portrait.houseCondition || '', startWindow: portrait.startWindow || '',
        style: portrait.style || '', eco: portrait.eco || '', household: portrait.household || '',
        payment: portrait.payment || '', competitor: portrait.competitor || ''
      }
      concerns.value = [...(portrait.concerns || [])]
    }
  } catch (error) {
    toastError(error, '客户画像加载失败')
  }
})

async function save() {
  if (submitting.value) return
  submitting.value = true
  loading('正在保存…')
  try {
    const original = (customer.value?.portrait || {}) as Record<string, unknown>
    const payload: Record<string, unknown> = { concerns: concerns.value }
    const clearFields: string[] = []
    fields.forEach((field) => {
      if (form.value[field.key]) payload[field.key] = form.value[field.key]
      else if (original[field.key]) clearFields.push(field.key)
    })
    if (!concerns.value.length && Array.isArray(original.concerns) && original.concerns.length) clearFields.push('concerns')
    if (clearFields.length) payload.clearFields = clearFields
    await crmApi.savePortrait(customerId.value, payload)
    toast('客户画像已保存', 'success')
    setTimeout(() => uni.navigateBack(), 500)
  } catch (error) {
    toastError(error, '客户画像保存失败')
  } finally {
    hideLoading()
    submitting.value = false
  }
}
</script>

<template>
  <view class="pe">
    <JzPageHeader title="客户画像" subtitle="十项客户偏好可按需填写；未填写不影响后续业务办理" />

    <view class="pe__customer jz-card">
      <JzIcon name="user" :size="30" :color="TOKEN_COLOR.primary" />
      <text class="pe__customer-name">{{ customer?.name || '客户' }}</text>
      <text class="pe__customer-sub">已填写 {{ filledCount }}/10 项</text>
    </view>

    <view class="pe__form jz-card">
      <view v-for="field in fields" :key="field.key" class="pe__field">
        <view class="pe__field-head">
          <text class="pe__label">{{ field.label }}</text>
          <text class="pe__hint">{{ field.hint }}</text>
        </view>
        <JzSelectField variant="boxed" :display="form[field.key] ? optionLabel(field) : ''" :range="field.options.map(o => o.label)" :index="optionIndex(field)" placeholder="请选择" @change="onPick(field.key, $event)" />
      </view>

      <view class="pe__field">
        <view class="pe__field-head">
          <text class="pe__label">主要顾虑</text>
          <text class="pe__hint">可多选，决定异议处理话术</text>
        </view>
        <view class="pe__chips">
          <text
            v-for="item in concernOptions"
            :key="item.value"
            class="pe__chip"
            :class="{ 'pe__chip--active': concerns.includes(item.value) }"
            @tap="toggleConcern(item.value)"
          >{{ item.label }}</text>
        </view>
      </view>

      <view class="pe__tip">
        <JzIcon name="info" :size="24" :color="TOKEN_COLOR.text3" />
        <text>清空选择后保存即视为清除该画像项。</text>
      </view>
    </view>

    <button class="jz-btn jz-btn--primary pe__submit" :disabled="submitting" @tap="save">保存画像</button>
    <view class="jz-tabbar-gap" />
  </view>
</template>

<style lang="scss" scoped>
.pe { min-height: 100vh; padding: 24rpx; background: $jzb-bg-page; }
.pe__customer { display: flex; align-items: center; gap: 14rpx; padding: 24rpx; }
.pe__customer-name { color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 700; }
.pe__customer-sub { margin-left: auto; color: $jzb-text-3; font-size: 22rpx; }
.pe__form { margin-top: 20rpx; padding: 24rpx; }
.pe__field { padding: 18rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.pe__field:last-of-type { border-bottom: 0; }
.pe__field-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12rpx; }
.pe__label { color: $jzb-text-1; font-size: 26rpx; font-weight: 600; }
.pe__hint { color: $jzb-text-3; font-size: 20rpx; }
.pe__picker { display: flex; align-items: center; justify-content: space-between; margin-top: 12rpx; padding: 18rpx 20rpx; color: $jzb-text-1; background: $jzb-bg-page; border-radius: 12rpx; font-size: 24rpx; }
.pe__picker--empty { color: $jzb-text-3; }
.pe__chips { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 12rpx; }
.pe__chip { padding: 10rpx 22rpx; color: $jzb-text-2; background: $jzb-bg-page; border: 1rpx solid $jzb-border-light; border-radius: 999rpx; font-size: 22rpx; }
.pe__chip--active { color: $jzb-primary-dark; background: $jzb-primary-lighter; border-color: $jzb-primary; font-weight: 600; }
.pe__tip { display: flex; align-items: flex-start; gap: 10rpx; margin-top: 20rpx; padding: 16rpx; color: $jzb-text-3; background: $jzb-bg-page; border-radius: 12rpx; font-size: 20rpx; line-height: 1.6; }
/* FIX-008：保存画像按钮占满整行，符合移动端表单主操作按钮规范 */
.pe__submit { width: 100%; margin-top: 28rpx; }
</style>
