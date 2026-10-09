<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import { employeeContentApi, leadTouchApi } from '@/domains/content/api'
import type {
  ContentAttributionConfidence,
  ContentAttributionType,
  EmployeeContent,
  LeadTouch
} from '@/domains/content/model'
import { consumeCustomerPickerResult, type CustomerSelection } from '@/domains/crm/customer-picker'
import { toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const contentId = ref('')
const content = ref<EmployeeContent | null>(null)
const history = ref<LeadTouch[]>([])
const loading = ref(true)
const loadError = ref('')
const busy = ref(false)
const customer = ref<CustomerSelection | null>(null)
const attributionType = ref<ContentAttributionType>('manual')
const confidence = ref<ContentAttributionConfidence>('medium')
const isPrimary = ref(true)
const evidence = ref('')

const attributionOptions: Array<{ value: ContentAttributionType; label: string }> = [
  { value: 'manual', label: '人工确认' },
  { value: 'platform', label: '平台回传' },
  { value: 'uniqueCode', label: '专属入口' },
  { value: 'selfReport', label: '客户自述' },
  { value: 'inference', label: '仅推断' }
]
const confidenceOptions: Array<{ value: ContentAttributionConfidence; label: string }> = [
  { value: 'high', label: '高置信' },
  { value: 'medium', label: '中置信' },
  { value: 'low', label: '低置信' }
]
const attributionLabel = computed(() => attributionOptions.find((item) => item.value === attributionType.value)?.label || '人工确认')
const confidenceLabel = computed(() => confidenceOptions.find((item) => item.value === confidence.value)?.label || '中置信')
const publication = computed(() => content.value?.latestPublication)
const canAttribute = computed(() => Boolean(content.value?.status === 'backfilled' && publication.value))
const confidenceColor = computed(() => confidence.value === 'high' ? TOKEN_COLOR.success : confidence.value === 'low' ? TOKEN_COLOR.text3 : TOKEN_COLOR.warning)

onLoad((query) => { contentId.value = query?.contentId || '' })
onShow(() => {
  const picked = consumeCustomerPickerResult()
  if (picked?.action === 'select') customer.value = picked.value
  if (picked?.action === 'clear') customer.value = null
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  void load()
})

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    if (contentId.value) {
      content.value = await employeeContentApi.info(contentId.value)
      history.value = await leadTouchApi.list({ contentId: contentId.value })
    } else {
      content.value = null
      history.value = await leadTouchApi.list({})
    }
  } catch (error) {
    content.value = null
    history.value = []
    loadError.value = error instanceof Error ? error.message : '内容线索暂不可确认'
    toastError(error, loadError.value)
  } finally {
    loading.value = false
  }
}

function pickCustomer() {
  const query = customer.value ? `?selectedId=${customer.value.id}&selectedName=${encodeURIComponent(customer.value.name)}` : ''
  uni.navigateTo({ url: `${P.customerPicker}${query}` })
}
function createCustomer() { uni.navigateTo({ url: P.customerEdit }) }
function openContent(item: LeadTouch) {
  const id = item.employeeContent?.id
  if (id) uni.navigateTo({ url: `${P.employeeContentDetail}?contentId=${id}` })
}
function openCustomer(item: LeadTouch) {
  if (item.customer?.id) uni.navigateTo({ url: `${P.customerDetail}?id=${item.customer.id}` })
}
async function submit() {
  if (busy.value) return
  if (!contentId.value || !content.value) { toast('请从已回填发布的内容进入'); return }
  if (!customer.value?.id) { toast('请选择归因客户'); return }
  if (!publication.value?.id) { toast('发布记录尚未回填，暂不能归因'); return }
  if (confidence.value === 'low' && isPrimary.value) { toast('低置信归因不能设为主归因'); return }
  busy.value = true
  try {
    await leadTouchApi.save({
      customerId: customer.value.id,
      contentId: contentId.value,
      publicationId: publication.value.id,
      attributionType: attributionType.value,
      confidence: confidence.value,
      isPrimary: isPrimary.value,
      evidence: evidence.value.trim() || undefined
    })
    toast('内容线索已登记', 'success')
    evidence.value = ''
    await load()
  } catch (error) {
    toastError(error, '内容线索登记失败')
  } finally {
    busy.value = false
  }
}
function timeText(value?: string) { return value ? value.slice(0, 16).replace('T', ' ') : '—' }
function copyPublicationLink() {
  if (!publication.value?.postUrl) return
  uni.setClipboardData({ data: publication.value.postUrl, success: () => toast('作品链接已复制', 'success') })
}
function togglePrimary(event: any) { isPrimary.value = Boolean(event?.detail?.value) }
const attributionLabelMap: Record<ContentAttributionType, string> = {
  platform: '平台回传', uniqueCode: '专属入口', manual: '人工确认', selfReport: '客户自述', inference: '仅推断'
}
const confidenceLabelMap: Record<ContentAttributionConfidence, string> = { high: '高置信', medium: '中置信', low: '低置信' }
const confidenceColorMap: Record<ContentAttributionConfidence, string> = {
  high: TOKEN_COLOR.success, medium: TOKEN_COLOR.warning, low: TOKEN_COLOR.text3
}
function attributionLabelOf(value: ContentAttributionType) { return attributionLabelMap[value] }
function confidenceLabelOf(value: ContentAttributionConfidence) { return confidenceLabelMap[value] }
function confidenceColorOf(value: ContentAttributionConfidence) { return confidenceColorMap[value] }
</script>

<template>
  <view class="clt">
    <JzPageHeader :title="contentId ? '内容线索归因' : '内容线索'" subtitle="把咨询客户关联到已发布内容和归因员工" />
    <PageState v-if="loading && !content && !history.length" state="loading" :rows="4" />
    <PageState v-else-if="loadError && !content && !history.length" state="error" :title="loadError" @retry="load" />
    <template v-else>
      <view v-if="content" class="clt__context jz-card">
        <view class="jz-between"><text class="clt__context-title jz-ellipsis">{{ content.task?.title || '内容任务' }}</text><JzTag v-if="canAttribute" text="已回填发布" :color="TOKEN_COLOR.success" /><JzTag v-else text="待发布回填" :color="TOKEN_COLOR.warning" /></view>
        <text class="clt__context-sub">{{ content.caption || '未填写发布文案' }}</text>
        <text class="clt__context-meta">归因员工：{{ content.employee?.name || '—' }}</text>
        <text v-if="publication?.postUrl" class="clt__context-link" @tap.stop="copyPublicationLink">复制已回填作品链接</text>
      </view>

      <view v-if="content && !canAttribute" class="clt__warning jz-card">
        <JzIcon name="alert-circle" :size="36" :color="TOKEN_COLOR.warning" />
        <view><text class="clt__warning-title">先完成发布回填</text><text class="clt__warning-sub">只有保存了作品链接或截图的发布事实，才能进入有效内容线索统计。</text></view>
      </view>

      <view v-if="canAttribute" class="clt__form jz-card">
        <text class="clt__section">客户</text>
        <view v-if="customer" class="clt__customer" @tap="pickCustomer">
          <view class="clt__customer-icon"><JzIcon name="user" :size="34" :color="TOKEN_COLOR.primary" /></view>
          <view class="clt__customer-copy"><text class="clt__customer-name">{{ customer.name }}</text><text class="clt__customer-meta">{{ [customer.phone, customer.stage, customer.community || customer.addr].filter(Boolean).join(' · ') }}</text></view>
          <JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text3" />
        </view>
        <view v-else class="clt__customer-empty">
          <text>选择已有客户，避免重复建档。</text>
          <view class="clt__customer-actions"><button class="jz-btn jz-btn--primary jz-btn--sm" @tap="pickCustomer">选择客户</button><button class="jz-btn jz-btn--secondary jz-btn--sm" @tap="createCustomer">登记新客户</button></view>
        </view>

        <text class="clt__section">归因依据</text>
        <view class="clt__row"><text class="clt__label">归因方式</text><JzSelectField :display="attributionLabel" :range="attributionOptions.map((item) => item.label)" :index="attributionOptions.findIndex((item) => item.value === attributionType)" @change="attributionType = attributionOptions.find((item) => item.label === $event)?.value || 'manual'" /></view>
        <view class="clt__row"><text class="clt__label">归因置信度</text><JzSelectField :display="confidenceLabel" :range="confidenceOptions.map((item) => item.label)" :index="confidenceOptions.findIndex((item) => item.value === confidence)" @change="confidence = confidenceOptions.find((item) => item.label === $event)?.value || 'medium'" /></view>
        <view class="clt__row"><text class="clt__label">设为主归因</text><switch :checked="isPrimary" :color="TOKEN_COLOR.primary" @change="togglePrimary" /></view>
        <textarea v-model="evidence" class="clt__textarea" maxlength="500" placeholder="填写客户说法、平台回传、专属入口或人工核对证据" />

        <view class="clt__preview">
          <text class="clt__preview-title">统计预览</text>
          <view class="clt__preview-row"><text>当前口径</text><text>{{ isPrimary ? '主归因' : '辅助触点' }}</text></view>
          <view class="clt__preview-row"><text>置信度</text><JzTag :text="confidenceLabel" :color="confidenceColor" /></view>
          <text class="clt__preview-note">{{ isPrimary && confidence !== 'low' ? '保存后会进入有效内容线索统计，并进入现有客户跟进主链。' : '该记录只作辅助分析，不计入有效内容线索主指标。' }}</text>
        </view>
        <button class="jz-btn jz-btn--primary jz-btn--block" :loading="busy" @tap="submit">确认登记内容线索</button>
      </view>

      <view class="clt__section-head"><text class="clt__section-title">归因记录</text><text class="clt__section-count">{{ history.length }} 条</text></view>
      <view v-if="history.length" class="clt__history">
        <view v-for="item in history" :key="item.id" class="clt__item jz-card">
          <view class="jz-between">
            <text class="clt__item-name" @tap="openCustomer(item)">{{ item.customer?.name || '客户' }}</text>
            <JzTag :text="confidenceLabelOf(item.confidence)" :color="confidenceColorOf(item.confidence)" />
          </view>
          <text class="clt__item-content" @tap="openContent(item)">{{ item.task?.title || item.employeeContent?.caption || '内容任务' }}</text>
          <view class="clt__item-foot"><text>{{ item.isPrimary ? '主归因' : '辅助触点' }} · {{ attributionLabelOf(item.attributionType) }}</text><text>{{ timeText(item.touchedAt) }}</text></view>
        </view>
      </view>
      <view v-else class="clt__empty jz-card"><text>还没有内容线索归因</text><text>从已回填发布的员工作品进入，选择客户并保存归因依据。</text></view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.clt { min-height: 100vh; padding: 24rpx; background: $jzb-bg-page; }
.clt__context, .clt__warning, .clt__form { padding: 26rpx; margin-bottom: 18rpx; }
.clt__context-title { min-width: 0; font-size: $jzb-font-md; font-weight: 750; }
.clt__context-sub { display: block; margin-top: 12rpx; color: $jzb-text-2; font-size: $jzb-font-xs; line-height: 1.6; }
.clt__context-meta { display: block; margin-top: 12rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.clt__context-link { display: block; margin-top: 12rpx; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 650; }
.clt__warning { display: flex; align-items: flex-start; gap: 16rpx; background: $jzb-warning-soft; }
.clt__warning-title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 750; }
.clt__warning-sub { display: block; margin-top: 6rpx; color: $jzb-text-2; font-size: $jzb-font-xs; line-height: 1.6; }
.clt__section { display: block; margin: 22rpx 0 10rpx; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 750; }
.clt__section:first-child { margin-top: 0; }
.clt__customer { display: flex; align-items: center; gap: 14rpx; padding: 18rpx; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; }
.clt__customer-icon { width: 62rpx; height: 62rpx; flex: none; display: grid; place-items: center; border-radius: 18rpx; background: $jzb-primary-lighter; }
.clt__customer-copy { flex: 1; min-width: 0; }
.clt__customer-name { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.clt__customer-meta { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: 20rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.clt__customer-empty { padding: 24rpx; border: 1rpx dashed $jzb-border; border-radius: $jzb-radius-sm; color: $jzb-text-3; font-size: $jzb-font-xs; text-align: center; }
.clt__customer-actions { display: flex; justify-content: center; gap: 14rpx; margin-top: 18rpx; }
.clt__row { min-height: 88rpx; display: flex; align-items: center; gap: 16rpx; border-bottom: 1rpx solid $jzb-border-light; }
.clt__label { flex: none; width: 180rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.clt__row :deep(.jz-select-field) { flex: 1; justify-content: flex-end; }
.clt__textarea { width: 100%; height: 180rpx; box-sizing: border-box; margin-top: 18rpx; padding: 20rpx; color: $jzb-text-1; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; }
.clt__preview { margin: 22rpx 0; padding: 20rpx; background: $jzb-primary-lightest; border-radius: $jzb-radius-sm; }
.clt__preview-title { display: block; margin-bottom: 10rpx; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.clt__preview-row { display: flex; align-items: center; justify-content: space-between; min-height: 52rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.clt__preview-row text:last-child { color: $jzb-text-1; font-weight: 650; }
.clt__preview-note { display: block; margin-top: 10rpx; color: $jzb-text-3; font-size: 20rpx; line-height: 1.55; }
.clt__section-head { display: flex; align-items: baseline; justify-content: space-between; margin: 26rpx 4rpx 14rpx; }
.clt__section-title { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 750; }
.clt__section-count { color: $jzb-text-3; font-size: $jzb-font-xs; }
.clt__history { display: grid; gap: 14rpx; }
.clt__item { padding: 24rpx; }
.clt__item-name { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 750; }
.clt__item-content { display: block; margin-top: 12rpx; color: $jzb-text-2; font-size: $jzb-font-xs; line-height: 1.6; }
.clt__item-foot { display: flex; justify-content: space-between; gap: 12rpx; margin-top: 16rpx; padding-top: 14rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-text-3; font-size: 20rpx; }
.clt__empty { padding: 60rpx 24rpx; display: flex; flex-direction: column; align-items: center; gap: 8rpx; color: $jzb-text-3; font-size: $jzb-font-sm; text-align: center; }
.clt__empty text:last-child { color: $jzb-text-4; font-size: $jzb-font-xs; line-height: 1.55; }
</style>
