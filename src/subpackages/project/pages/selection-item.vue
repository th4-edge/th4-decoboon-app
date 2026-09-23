<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { materialSelectionApi, materialSelectionItemApi } from '@/domains/material/api'
import type { MaterialOrderStatus, MaterialSelectionItem } from '@/domains/material/model'
import { dateTimeValue } from '@/core/format'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import { STATUS_COLOR } from '@/styles/tokens'
import JzTag from '@/components/JzTag.vue'
import JzIcon from '@/components/JzIcon.vue'
import PageState from '@/components/PageState/PageState.vue'

const EDIT_ROLES = ['boss', 'storeManager', 'teamLeader', 'designer', 'pm', 'finance']
const STATUS_META: Record<string, { label: string; color: string }> = {
  none: { label: '待选材', color: STATUS_COLOR.todo },
  draft: { label: '选材草稿', color: STATUS_COLOR.muted },
  pendingConfirm: { label: '待客户确认', color: STATUS_COLOR.pending },
  confirmed: { label: '已确认', color: STATUS_COLOR.done }
}
const ORDER_META: Record<MaterialOrderStatus, { label: string; color: string }> = {
  none: { label: '未下单', color: STATUS_COLOR.todo },
  ordering: { label: '已请购', color: STATUS_COLOR.pending },
  partiallyOrdered: { label: '部分下单', color: STATUS_COLOR.pending },
  ordered: { label: '已下单', color: STATUS_COLOR.progress },
  partiallyArrived: { label: '部分到场', color: STATUS_COLOR.pending },
  arrived: { label: '已到场', color: STATUS_COLOR.done }
}

const projectId = ref('')
const propertyId = ref('')
const contractLineId = ref('')
const current = ref<MaterialSelectionItem | null>(null)
const loadingState = ref(true)
const saving = ref(false)
const confirming = ref(false)
const loadError = ref('')
const confirmerName = ref('')

const color = ref('')
const spec = ref('')
const brand = ref('')
const craft = ref('')
const remark = ref('')

const role = computed(() => session.role || 'customer')
const canEdit = computed(() => EDIT_ROLES.includes(role.value as string))
const confirmed = computed(() => current.value?.status === 'confirmed')
// 与后端 MaterialSelectionContext.selectionLocked 同口径：只要进入采购就锁定选材
const locked = computed(() => !!current.value && current.value.orderStatus !== 'none')
const canEditNow = computed(() => canEdit.value && !locked.value)
const statusMeta = computed(() => STATUS_META[current.value?.status || 'none'] || STATUS_META.none)
const orderMeta = computed(() => ORDER_META[current.value?.orderStatus || 'none'] || ORDER_META.none)

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  projectId.value = query?.projectId || ''
  propertyId.value = query?.propertyId || ''
  contractLineId.value = query?.contractLineId || ''
})
onShow(() => { if (projectId.value && contractLineId.value) load() })
onPullDownRefresh(async () => { await load(); uni.stopPullDownRefresh() })

async function load() {
  loadingState.value = true
  loadError.value = ''
  try {
    const item = await materialSelectionItemApi.info(projectId.value, contractLineId.value)
    current.value = item
    propertyId.value = item.propertyId || propertyId.value
    hydrate(item)
  } catch (error) {
    loadError.value = '主材分项暂不可确认，请下拉重试'
    toastError(error)
  } finally {
    loadingState.value = false
  }
}

function hydrate(item: MaterialSelectionItem) {
  if (!item.selectionJson) return
  try {
    const parsed = JSON.parse(item.selectionJson) as Record<string, unknown>
    color.value = String(parsed.color ?? '')
    spec.value = String(parsed.spec ?? '')
    brand.value = String(parsed.brand ?? '')
    craft.value = String(parsed.craft ?? '')
    remark.value = String(parsed.remark ?? '')
  } catch {
    color.value = item.selectionText || ''
  }
}

function resultJson() {
  const values: Record<string, string> = {}
  if (color.value.trim()) values.color = color.value.trim()
  if (spec.value.trim()) values.spec = spec.value.trim()
  if (brand.value.trim()) values.brand = brand.value.trim()
  if (craft.value.trim()) values.craft = craft.value.trim()
  if (remark.value.trim()) values.remark = remark.value.trim()
  return JSON.stringify(values)
}

function goChange() {
  if (!projectId.value) { toast('缺少项目上下文，无法发起增减项'); return }
  const query = [`projectId=${projectId.value}`]
  if (current.value?.contractId) query.push(`contractId=${current.value.contractId}`)
  uni.navigateTo({ url: `${P.projectChangeCreate}?${query.join('&')}` })
}

function resultText() {
  const parts = [
    color.value.trim() ? `颜色/花色：${color.value.trim()}` : '',
    spec.value.trim() ? `规格/型号：${spec.value.trim()}` : '',
    brand.value.trim() ? `品牌/系列：${brand.value.trim()}` : '',
    craft.value.trim() ? `工艺：${craft.value.trim()}` : '',
    remark.value.trim() ? `备注：${remark.value.trim()}` : ''
  ].filter(Boolean)
  return parts.join('；')
}

async function persist(status: 'draft' | 'pendingConfirm') {
  if (!canEditNow.value || !current.value) return
  const content = resultText()
  if (!content) { toast('请至少填写一项选材结果'); return }
  saving.value = true
  loading()
  try {
    const saved = await materialSelectionApi.save({
      propertyId: propertyId.value,
      projectId: projectId.value,
      contractLineId: contractLineId.value,
      title: current.value.materialName,
      content,
      selectionJson: resultJson(),
      status
    })
    toast(status === 'draft' ? '已保存选材草稿' : '已提交客户确认')
    await load()
  } catch (error) {
    toastError(error)
  } finally {
    saving.value = false
    hideLoading()
  }
}

async function confirm() {
  if (!current.value?.selectionId) { toast('请先保存选材结果'); return }
  if (!confirmerName.value.trim()) { toast('请填写客户确认人姓名'); return }
  confirming.value = true
  try {
    await materialSelectionApi.confirm(current.value.selectionId, confirmerName.value.trim())
    toast('已记录客户确认')
    await load()
  } catch (error) {
    toastError(error)
  } finally {
    confirming.value = false
  }
}

function openMaterialPlan() {
  uni.navigateTo({ url: `${P.projectMaterialPlan}?projectId=${projectId.value}` })
}
</script>

<template>
  <view class="msi">
    <PageState v-if="loadingState && !current" state="loading" :rows="5" />
    <PageState v-else-if="loadError && !current" state="error" :title="loadError" @retry="load" />

    <template v-else-if="current">
      <view class="jz-card msi__hero">
        <view class="msi__hero-head">
          <view class="jz-grow">
            <text class="msi__title">{{ current.materialName }}</text>
            <text class="msi__sub">{{ current.spaceName || '未分空间' }} · {{ current.projectName }}</text>
          </view>
          <view class="msi__status">
            <JzTag :text="current.statusName || statusMeta.label" :color="statusMeta.color" />
            <JzTag :text="current.orderStatusName || orderMeta.label" :color="orderMeta.color" />
          </view>
        </view>
        <text class="msi__address">{{ current.propertyAddress || '房屋地址待完善' }}</text>
      </view>

      <view v-if="loadError" class="msi__error" @tap="load">
        <JzIcon name="alert-circle" :size="30" :color="STATUS_COLOR.blocked" />
        <text>{{ loadError }}</text>
      </view>

      <view class="jz-card msi__section">
        <view class="msi__section-head">
          <text class="msi__section-title">合同要求</text>
          <text class="msi__section-note">{{ current.contractNo || '合同待完善' }}</text>
        </view>
        <view class="msi__requirements">
          <view><text>分类</text><strong>{{ current.category || '主材' }}</strong></view>
          <view><text>品牌</text><strong>{{ current.brand || '合同范围' }}</strong></view>
          <view><text>规格</text><strong>{{ current.spec || '按现场确认' }}</strong></view>
          <view><text>数量</text><strong>{{ current.quantity ?? '-' }} {{ current.unit || '' }}</strong></view>
        </view>
      </view>

      <view class="jz-card msi__section">
        <view class="msi__section-head">
          <text class="msi__section-title">选材结果</text>
          <text v-if="current.version" class="msi__section-note">v{{ current.version }}</text>
        </view>

        <view class="msi__field">
          <text class="msi__label">颜色 / 花色</text>
          <input v-model="color" class="msi__input" :disabled="!canEditNow" placeholder="如：黄绿色、暖灰石纹" />
        </view>
        <view class="msi__field">
          <text class="msi__label">规格 / 型号</text>
          <input v-model="spec" class="msi__input" :disabled="!canEditNow" placeholder="如：800×800、M8802" />
        </view>
        <view class="msi__field">
          <text class="msi__label">品牌 / 系列</text>
          <input v-model="brand" class="msi__input" :disabled="!canEditNow" placeholder="如：马可波罗、合同范围内" />
        </view>
        <view class="msi__field">
          <text class="msi__label">工艺 / 材质</text>
          <input v-model="craft" class="msi__input" :disabled="!canEditNow" placeholder="如：哑光、柔光防滑" />
        </view>
        <view class="msi__field">
          <text class="msi__label">现场备注</text>
          <textarea v-model="remark" class="msi__textarea" :disabled="!canEditNow" placeholder="记录客户现场确认的补充条件" />
        </view>

        <view v-if="locked" class="msi__warning">
          <text class="msi__warning-text">该分项已进入采购（{{ current.orderStatusName || orderMeta.label }}），不能再修改选材。</text>
          <text class="msi__warning-sub">如需更换材料，请发起增减项：变更确认后由财务调整采购或走退货冲减。</text>
          <button v-if="canEdit" class="jz-btn jz-btn--ghost jz-btn--sm msi__change-btn" @tap="goChange">去发起增减项</button>
        </view>
        <view v-else-if="confirmed" class="msi__hint">
          该分项已客户确认。修改后保存会形成新版本，旧确认记录继续保留。
        </view>
        <view v-if="!canEdit" class="msi__hint">当前角色只能查看，不能修改客户选材事实。</view>

        <view class="msi__preview">
          <text class="msi__label">可读文本预览</text>
          <text class="msi__preview-text">{{ resultText() || current.selectionText || '填写后自动生成' }}</text>
        </view>

        <view v-if="canEditNow" class="msi__actions">
          <button class="jz-btn jz-btn--ghost" :disabled="saving" @tap="persist('draft')">保存草稿</button>
          <button class="jz-btn jz-btn--primary" :disabled="saving" @tap="persist('pendingConfirm')">提交客户确认</button>
        </view>
      </view>

      <view v-if="current.selectionId" class="jz-card msi__section">
        <view class="msi__section-head">
          <text class="msi__section-title">客户确认</text>
          <JzTag :text="current.statusName || statusMeta.label" :color="statusMeta.color" />
        </view>
        <template v-if="current.status === 'confirmed'">
          <view class="msi__confirmed">
            <JzIcon name="check-circle" :size="40" :color="STATUS_COLOR.done" />
            <view>
              <text class="msi__confirmed-title">已由 {{ current.confirmerName || '客户' }} 确认</text>
              <text class="msi__confirmed-time">{{ dateTimeValue(current.confirmedAt) || '—' }}</text>
            </view>
          </view>
        </template>
        <template v-else-if="canEditNow">
          <input v-model="confirmerName" class="msi__input" placeholder="客户确认人姓名" />
          <button class="jz-btn jz-btn--primary msi__confirm-btn" :disabled="confirming" @tap="confirm">客户已确认</button>
        </template>
      </view>

      <view class="jz-card msi__section">
        <view class="msi__section-head">
          <text class="msi__section-title">材料下单</text>
          <JzTag :text="current.orderStatusName || orderMeta.label" :color="orderMeta.color" />
        </view>
        <text class="msi__hint">下单与到场状态由项目材料计划、采购单和到货记录派生，不在选材页手工修改。</text>
        <button v-if="confirmed" class="jz-btn jz-btn--ghost msi__confirm-btn" @tap="openMaterialPlan">查看材料计划</button>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.msi { padding: $jzb-space-4 $jzb-page-pad 44rpx; }
.msi__hero, .msi__section { padding: 26rpx 24rpx; margin-bottom: $jzb-page-gap; }
.msi__hero-head, .msi__section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; }
.msi__title { display: block; color: $jzb-text-1; font-size: 38rpx; font-weight: 750; }
.msi__sub { display: block; margin-top: 7rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.msi__status { display: flex; flex-direction: column; align-items: flex-end; gap: 8rpx; flex-shrink: 0; }
.msi__address { display: block; margin-top: 18rpx; padding-top: 16rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-text-2; font-size: $jzb-font-sm; }
.msi__section-title { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.msi__section-note { color: $jzb-text-3; font-size: $jzb-font-xs; }
.msi__requirements { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12rpx; margin-top: 18rpx; }
.msi__requirements view { padding: 14rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-page; }
.msi__requirements text { display: block; color: $jzb-text-3; font-size: 20rpx; }
.msi__requirements strong { display: block; margin-top: 4rpx; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.msi__field { margin-top: 18rpx; }
.msi__label { display: block; margin-bottom: 8rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.msi__input, .msi__textarea { width: 100%; box-sizing: border-box; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; color: $jzb-text-1; background: $jzb-bg-page; font-size: $jzb-font-sm; }
.msi__input { height: 80rpx; padding: 0 18rpx; }
.msi__textarea { min-height: 160rpx; padding: 16rpx 18rpx; line-height: 1.6; }
.msi__warning, .msi__hint { display: block; margin-top: 16rpx; padding: 14rpx 16rpx; border-radius: $jzb-radius-sm; color: #9A5B00; background: $jzb-warning-soft; font-size: $jzb-font-xs; line-height: 1.55; }
.msi__hint { color: $jzb-text-2; background: $jzb-bg-page; }
.msi__warning-text { display: block; font-weight: 600; }
.msi__warning-sub { display: block; margin-top: 6rpx; color: #9A5B00; opacity: .9; }
.msi__change-btn { margin-top: 14rpx; }
.msi__preview { margin-top: 18rpx; padding: 16rpx; border: 1rpx solid rgba(22,163,148,.16); border-radius: $jzb-radius-sm; background: $jzb-primary-lightest; }
.msi__preview-text { display: block; color: $jzb-primary-deep; font-size: $jzb-font-sm; line-height: 1.6; }
.msi__actions { display: flex; gap: 12rpx; margin-top: 22rpx; }
.msi__actions button { flex: 1; margin: 0; }
.msi__confirmed { display: flex; align-items: center; gap: 14rpx; margin-top: 18rpx; }
.msi__confirmed-title { display: block; color: $jzb-success; font-size: $jzb-font-md; font-weight: 700; }
.msi__confirmed-time { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.msi__confirm-btn { margin-top: 18rpx; }
.msi__error { display: flex; align-items: center; gap: 10rpx; margin-bottom: 16rpx; padding: 16rpx 20rpx; border-radius: $jzb-radius-sm; color: #B42318; background: $jzb-danger-soft; font-size: $jzb-font-sm; }
.msi__error text:nth-child(2) { flex: 1; }
@media (min-width: 768px) { .msi { max-width: 760px; margin: 0 auto; } }
</style>
