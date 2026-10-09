<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { materialSelectionApi, materialSelectionItemApi } from '@/domains/material/api'
import type { MaterialOrderStatus, MaterialSelectionItem } from '@/domains/material/model'
import { dateTimeValue } from '@/core/format'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import { STATUS_COLOR, TOKEN_COLOR } from '@/styles/tokens'
import { chooseImages } from '@/domains/file/choose-media'
import { fileApi } from '@/domains/file/api'
import JzTag from '@/components/JzTag.vue'
import JzIcon from '@/components/JzIcon.vue'
import PageState from '@/components/PageState/PageState.vue'

/** DEC-035：Designer/Boss/StoreManager/Finance 可维护主材选材；Pm/TeamLeader/Marketer 只读。 */
const EDIT_ROLES = ['boss', 'storeManager', 'designer', 'finance']
const MAX_PHOTOS = 9
const STATUS_META: Record<string, { label: string; color: string }> = {
  none: { label: '待选材', color: STATUS_COLOR.todo },
  selected: { label: '已选材', color: STATUS_COLOR.done }
}
const ORDER_META: Record<MaterialOrderStatus, { label: string; color: string }> = {
  none: { label: '未下单', color: STATUS_COLOR.todo },
  ready: { label: '待财务下单', color: STATUS_COLOR.pending },
  ordering: { label: '已请购', color: STATUS_COLOR.pending },
  partiallyOrdered: { label: '部分下单', color: STATUS_COLOR.pending },
  ordered: { label: '已下单', color: STATUS_COLOR.progress },
  partiallyArrived: { label: '部分到场', color: STATUS_COLOR.pending },
  arrived: { label: '已到场', color: STATUS_COLOR.done }
}
/** 选材可编辑的计划状态：未交付(none) 与 已交付待下单(ready)。 */
const EDITABLE_ORDER: MaterialOrderStatus[] = ['none', 'ready']

const projectId = ref('')
const propertyId = ref('')
const contractLineId = ref('')
const current = ref<MaterialSelectionItem | null>(null)
const loadingState = ref(true)
const saving = ref(false)
const uploading = ref(false)
const loadError = ref('')

const color = ref('')
const spec = ref('')
const brand = ref('')
const craft = ref('')
const remark = ref('')
const photos = ref<string[]>([])
const photoUrls = ref<Record<string, string>>({})

const role = computed(() => session.role || 'customer')
const canEdit = computed(() => EDIT_ROLES.includes(role.value as string))
const locked = computed(() => !!current.value && !EDITABLE_ORDER.includes(current.value.orderStatus))
const delivered = computed(() => current.value?.orderStatus === 'ready')
const canEditNow = computed(() => canEdit.value && !locked.value)
const statusMeta = computed(() => STATUS_META[current.value?.status || 'none'] || STATUS_META.none)
const orderMeta = computed(() => ORDER_META[current.value?.orderStatus || 'none'] || ORDER_META.none)
const photoPreviewUrls = computed(() => photos.value.map((path) => photoUrls.value[path] || path))

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
    void resolvePhotoUrls(item)
  } catch (error) {
    loadError.value = '主材分项暂不可确认，请下拉重试'
    toastError(error)
  } finally {
    loadingState.value = false
  }
}

function hydrate(item: MaterialSelectionItem) {
  photos.value = Array.isArray(item.attachments) ? [...item.attachments] : []
  photoUrls.value = {}
  if (!item.selectionJson) {
    if (!item.selectionText) return
    color.value = item.selectionText
    return
  }
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

/** 已保存的选材图片是私有对象键，需按选材记录签发短期访问地址。 */
async function resolvePhotoUrls(item: MaterialSelectionItem) {
  if (!item.selectionId || !photos.value.length) return
  try {
    const urls = await fileApi.grant('MaterialSelection', item.selectionId, photos.value)
    const next: Record<string, string> = {}
    photos.value.forEach((path, index) => { next[path] = urls[index] || path })
    photoUrls.value = next
  } catch {
    // 签发失败时保留对象键，用户仍可重新选择照片后保存。
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

async function addPhotos() {
  if (!canEditNow.value || uploading.value) return
  const remain = MAX_PHOTOS - photos.value.length
  if (remain <= 0) { toast(`最多上传 ${MAX_PHOTOS} 张照片`); return }
  let picked: string[] = []
  try {
    picked = await chooseImages({ count: remain })
  } catch (error) {
    toastError(error)
    return
  }
  if (!picked.length) return
  uploading.value = true
  loading('上传中')
  try {
    for (const local of picked) {
      const uploaded = await fileApi.upload('MaterialSelection', local, { projectId: projectId.value })
      photos.value = [...photos.value, uploaded.path]
      photoUrls.value = { ...photoUrls.value, [uploaded.path]: uploaded.url }
    }
  } catch (error) {
    toastError(error)
  } finally {
    uploading.value = false
    hideLoading()
  }
}

function removePhoto(path: string) {
  if (!canEditNow.value) return
  photos.value = photos.value.filter((item) => item !== path)
  const rest = { ...photoUrls.value }
  delete rest[path]
  photoUrls.value = rest
}

function previewPhoto(path: string) {
  uni.previewImage({ urls: photoPreviewUrls.value, current: photoUrls.value[path] || path })
}

async function save(deliver: boolean) {
  if (!canEditNow.value || !current.value) return
  const content = resultText()
  if (!content) { toast('请至少填写一项选材结果'); return }
  saving.value = true
  loading(deliver ? '交付中' : '保存中')
  try {
    await materialSelectionApi.save({
      propertyId: propertyId.value,
      projectId: projectId.value,
      contractLineId: contractLineId.value,
      title: current.value.materialName,
      content,
      selectionJson: resultJson(),
      attachments: photos.value,
      deliver
    })
    toast(deliver ? '已交付财务下单' : '已保存选材')
    await load()
  } catch (error) {
    toastError(error)
  } finally {
    saving.value = false
    hideLoading()
  }
}

function goChange() {
  if (!projectId.value) { toast('缺少项目上下文，无法发起增减项'); return }
  const query = [`projectId=${projectId.value}`]
  if (current.value?.contractId) query.push(`contractId=${current.value.contractId}`)
  uni.navigateTo({ url: `${P.projectChangeCreate}?${query.join('&')}` })
}

function openMaterialPlan() {
  uni.navigateTo({ url: `${P.projectMaterialPlan}?projectId=${projectId.value}` })
}

function updatedText() {
  return dateTimeValue(current.value?.updatedAt) || '尚未更新'
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
          <textarea v-model="remark" class="msi__textarea" :disabled="!canEditNow" placeholder="记录与客户现场沟通确认的补充条件" />
        </view>

        <view class="msi__field">
          <view class="msi__photo-head">
            <text class="msi__label">现场照片（{{ photos.length }}/{{ MAX_PHOTOS }}）</text>
            <text class="msi__section-note">仅作留证，不参与金额与采购</text>
          </view>
          <view class="msi__photos">
            <view v-for="path in photos" :key="path" class="msi__photo">
              <image class="msi__photo-img" :src="photoUrls[path] || path" mode="aspectFill" @tap="previewPhoto(path)" />
              <view v-if="canEditNow" class="msi__photo-remove" @tap.stop="removePhoto(path)">
                <JzIcon name="close" :size="26" color="#FFFFFF" />
              </view>
            </view>
            <view v-if="canEditNow && photos.length < MAX_PHOTOS" class="msi__photo-add" @tap="addPhotos">
              <JzIcon name="camera" :size="46" :color="STATUS_COLOR.todo" />
              <text>上传照片</text>
            </view>
          </view>
        </view>

        <view v-if="locked" class="msi__warning">
          <text class="msi__warning-text">该分项已进入采购（{{ current.orderStatusName || orderMeta.label }}），不能再修改选材。</text>
          <text class="msi__warning-sub">如需更换材料，请发起增减项：变更确认后由财务调整采购或走退货冲减。</text>
        </view>
        <view v-else-if="delivered" class="msi__hint">
          已交付财务下单，等待财务确认；如需调整可在下单前修改后重新保存。
        </view>
        <view v-if="!canEdit" class="msi__hint">当前角色只能查看，不能维护主材选材。</view>

        <view class="msi__preview">
          <text class="msi__label">可读文本预览</text>
          <text class="msi__preview-text">{{ resultText() || current.selectionText || '填写后自动生成' }}</text>
        </view>
      </view>

      <view class="jz-card msi__section">
        <view class="msi__section-head">
          <text class="msi__section-title">材料下单</text>
          <view class="msi__head-right">
            <JzTag :text="current.orderStatusName || orderMeta.label" :color="orderMeta.color" />
            <view class="msi__head-action" @tap="openMaterialPlan">
              <text>材料计划</text>
              <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.primary" />
            </view>
          </view>
        </view>
        <text class="msi__hint">交付后由财务选供应商、价格与数量并下单；下单与到场状态由材料计划、采购单和到货记录派生，不在选材页手工修改。</text>
        <text class="msi__foot-time">最近更新：{{ updatedText() }}</text>
      </view>

      <view class="jz-actionbar">
        <view class="jz-actionbar__inner">
          <template v-if="canEditNow">
            <button class="jz-btn jz-btn--ghost" :disabled="saving || uploading" @tap="save(false)">
              <JzIcon name="check" :size="30" :color="TOKEN_COLOR.primary" />
              <text>保存</text>
            </button>
            <button class="jz-btn jz-btn--primary jz-grow" :disabled="saving || uploading" @tap="save(true)">
              <JzIcon name="send" :size="30" color="#FFFFFF" />
              <text>保存并交付</text>
            </button>
          </template>
          <template v-else-if="locked && canEdit">
            <button class="jz-btn jz-btn--ghost" @tap="openMaterialPlan">
              <JzIcon name="package" :size="30" :color="TOKEN_COLOR.primary" />
              <text>材料计划</text>
            </button>
            <button class="jz-btn jz-btn--primary jz-grow" @tap="goChange">
              <JzIcon name="edit" :size="30" color="#FFFFFF" />
              <text>去发起增减项</text>
            </button>
          </template>
          <button v-else class="jz-btn jz-btn--ghost jz-grow" @tap="openMaterialPlan">
            <JzIcon name="package" :size="30" :color="TOKEN_COLOR.primary" />
            <text>查看材料计划</text>
          </button>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.msi { padding: $jzb-space-4 $jzb-page-pad 220rpx; }
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
.msi__photo-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12rpx; }
.msi__photos { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12rpx; margin-top: 6rpx; }
.msi__photo, .msi__photo-add { position: relative; width: 100%; height: 150rpx; border-radius: $jzb-radius-sm; overflow: hidden; }
.msi__photo-img { display: block; width: 100%; height: 100%; }
.msi__photo-remove { position: absolute; top: 4rpx; right: 4rpx; display: flex; align-items: center; justify-content: center; width: 36rpx; height: 36rpx; border-radius: 50%; background: rgba(0,0,0,.5); }
.msi__photo-add { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6rpx; border: 1rpx dashed $jzb-border; background: $jzb-bg-page; color: $jzb-text-3; font-size: 20rpx; }
.msi__preview { margin-top: 18rpx; padding: 16rpx; border: 1rpx solid rgba(22,163,148,.16); border-radius: $jzb-radius-sm; background: $jzb-primary-lightest; }
.msi__preview-text { display: block; color: $jzb-primary-deep; font-size: $jzb-font-sm; line-height: 1.6; }
.msi__head-right { display: inline-flex; align-items: center; gap: 12rpx; flex-shrink: 0; }
.msi__head-action { display: inline-flex; align-items: center; gap: 2rpx; color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 600; }
.msi__foot-time { display: block; margin-top: 12rpx; color: $jzb-text-3; font-size: 20rpx; font-variant-numeric: tabular-nums; }
.msi__error { display: flex; align-items: center; gap: 10rpx; margin-bottom: 16rpx; padding: 16rpx 20rpx; border-radius: $jzb-radius-sm; color: #B42318; background: $jzb-danger-soft; font-size: $jzb-font-sm; }
.msi__error text:nth-child(2) { flex: 1; }
@media (min-width: 768px) { .msi { max-width: 760px; margin: 0 auto; } }
</style>
