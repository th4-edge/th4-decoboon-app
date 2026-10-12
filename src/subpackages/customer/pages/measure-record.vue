<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import type { Customer } from '@/domains/crm/model'
import type { MeasureRegion, Property, SpaceTypeName } from '@/domains/property/model'
import { crmApi } from '@/domains/crm/api'
import { measureRegionApi, propertyApi, SPACE_TYPE_LABEL, SPACE_TYPE_OPTIONS } from '@/domains/property/api'
import { fileApi } from '@/domains/file/api'
import { chooseImages } from '@/domains/file/choose-media'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzIcon from '@/components/JzIcon.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

const MAX_PHOTOS = 9

const customerId = ref('')
const propertyId = ref('')
const customer = ref<Customer | null>(null)
const property = ref<Property | null>(null)
const measureDate = ref(new Date().toISOString().slice(0, 10))
const measureTime = ref(new Date().toTimeString().slice(0, 5))
/** 现场照片：元素为临时路径（未上传）或托管 URL（回显） */
const sitePhotos = ref<string[]>([])
const submitting = ref(false)

/**
 * 量房原始区域（DEC-069）：量房测的是房屋原始结构，原始区域挂在量房单下；
 * 量房完成后**冻结**（需修正必须重新量房/复尺），设计方案只继承作起点、二者不联动。
 */
interface RegionDraft {
  key: string
  regionId: string
  type: SpaceTypeName
  name: string
  area: string
  perimeter: string
}

const MEASURE_REGION_TYPES = SPACE_TYPE_OPTIONS.map((value) => SPACE_TYPE_LABEL[value])
let regionSeq = 0
const regionDrafts = ref<RegionDraft[]>([])
const existingRegions = ref<MeasureRegion[]>([])
/** 最近一次量房是否已完成（已完成 = 原始结构冻结，只读回显）。 */
const measureFrozen = ref(false)

function regionTypeIndex(draft: RegionDraft): number {
  const index = SPACE_TYPE_OPTIONS.indexOf(draft.type)
  return index < 0 ? 0 : index
}

function onRegionTypeChange(draft: RegionDraft, label: string): void {
  const index = MEASURE_REGION_TYPES.indexOf(label)
  if (index >= 0) draft.type = SPACE_TYPE_OPTIONS[index]
}

function addRegion(): void {
  regionSeq += 1
  regionDrafts.value.push({
    key: `region-${regionSeq}`,
    regionId: '',
    type: 'bedroom',
    name: '',
    area: '',
    perimeter: ''
  })
}

function removeRegion(index: number): void {
  regionDrafts.value.splice(index, 1)
}

const subtitle = computed(() => property.value
  ? `${property.value.address} · ${property.value.area || 0}㎡`
  : customer.value?.addr || '正在加载房屋信息')

onLoad(async (query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  customerId.value = query?.customerId || query?.id || ''
  propertyId.value = query?.propertyId || ''
  if (!propertyId.value) {
    toast('请先从客户详情选择要量房的房屋')
    return
  }
  try {
    const [customerInfo, propertyInfo, measures] = await Promise.all([
      customerId.value ? crmApi.info(customerId.value) : Promise.resolve(null),
      propertyApi.info(propertyId.value),
      propertyApi.measures(propertyId.value)
    ])
    customer.value = customerInfo
    property.value = propertyInfo
    const latest = measures[0]
    if (latest) {
      sitePhotos.value = Array.isArray(latest.sitePhotos) ? [...latest.sitePhotos] : []
      const scheduledAt = latest.scheduledAt || latest.measureTime
      if (scheduledAt) {
        measureDate.value = scheduledAt.slice(0, 10)
        measureTime.value = scheduledAt.slice(11, 16)
      }
      measureFrozen.value = latest.status === 'completed'
      try {
        existingRegions.value = await measureRegionApi.list(latest.id)
        if (!measureFrozen.value) {
          // 量房未完成：已录原始区域回填为可编辑草稿（带 regionId，保存时原地更新）
          regionDrafts.value = existingRegions.value.map((region) => {
            regionSeq += 1
            return {
              key: `region-${regionSeq}`,
              regionId: region.id,
              type: region.type,
              name: region.name,
              area: region.area == null ? '' : String(region.area),
              perimeter: region.perimeter == null ? '' : String(region.perimeter)
            }
          })
        }
      } catch (error) {
        toastError(error, '量房原始区域加载失败')
      }
    }
  } catch (error) {
    toastError(error, '量房资料加载失败')
  }
})

async function choosePhotos() {
  const remain = MAX_PHOTOS - sitePhotos.value.length
  if (remain <= 0) { toast(`最多 ${MAX_PHOTOS} 张`); return }
  try {
    const paths = await chooseImages({ count: remain })
    sitePhotos.value = [...sitePhotos.value, ...paths]
  } catch (error) {
    toast(error instanceof Error ? error.message : '照片选择失败，请重试')
  }
}
function removePhoto(index: number) {
  sitePhotos.value.splice(index, 1)
}
function previewPhoto(index: number) {
  uni.previewImage({ current: sitePhotos.value[index], urls: sitePhotos.value })
}

/**
 * 判断路径是否需要上传。
 * - 签名 URL（https://.../companies/... 或 /file/private/download?path=...）→ 已托管，用 storagePath 恢复存储键
 * - 托管路径（upload/、companies/、system/ 开头）→ 已托管，用 storagePath 恢复
 * - 其他（wxfile://、blob:、/tmp/ 等临时路径）→ 需要上传
 * 历史坑：回显的签名 URL 被 fileApi.isManaged 误判为未托管，导致每次保存都重新上传已有照片。
 */
function needsUpload(path: string): boolean {
  if (path.includes('/file/private/download')) return false
  if (/^https?:\/\//i.test(path) && (path.includes('/companies/') || path.includes('/system/'))) return false
  return !fileApi.isManaged(path)
}

async function save() {
  if (!propertyId.value || !property.value || submitting.value) return
  if (!measureDate.value || !measureTime.value) { toast('请选择实际量房日期和时间'); return }
  submitting.value = true
  loading('正在保存量房数据…')
  try {
    // 批量处理：临时路径上传，签名 URL/托管路径恢复存储键
    const uploadedPaths = await Promise.all(sitePhotos.value.map(async (path) => {
      if (!needsUpload(path)) return fileApi.storagePath(path) || path
      return (await fileApi.upload('Measure', path)).path
    }))
    const drafts = regionDrafts.value.filter((draft) => draft.name.trim())
    const invalid = drafts.find((draft) =>
      (draft.area !== '' && Number(draft.area) <= 0) || (draft.perimeter !== '' && Number(draft.perimeter) <= 0))
    if (invalid) {
      hideLoading()
      toast(`${invalid.name} 的实测面积/周长必须大于 0，留空表示未录入`)
      return
    }
    const measureAt = `${measureDate.value}T${measureTime.value}:00`
    const payload = {
      propertyId: propertyId.value,
      measureTime: measureAt,
      completedAt: measureAt,
      sitePhotos: uploadedPaths
    }
    // DEC-069：原始区域只能在量房完成前录入（完成后冻结），因此带原始区域时分三步保存：
    // ① 先落量房单为「量房中」→ ② 逐条落原始区域 → ③ 再登记量房完成。
    const measure = await propertyApi.saveMeasure({ ...payload, status: drafts.length ? 'scheduled' : 'completed' })
    if (drafts.length && measure?.id) {
      for (const draft of drafts) {
        await measureRegionApi.save({
          measureId: measure.id,
          regionId: draft.regionId || undefined,
          type: draft.type,
          name: draft.name.trim(),
          area: draft.area === '' ? undefined : Number(draft.area),
          perimeter: draft.perimeter === '' ? undefined : Number(draft.perimeter)
        })
      }
      await propertyApi.saveMeasure({ ...payload, status: 'completed' })
    }
    hideLoading()
    toast(drafts.length
      ? `量房记录已保存，并登记 ${drafts.length} 个原始区域（量房已完成，原始结构冻结）`
      : '量房记录已保存，房屋进入已量房状态', 'success')
    setTimeout(() => uni.navigateBack(), 450)
  } catch (error) {
    hideLoading()
    toastError(error, '量房记录保存失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="mr">
    <view class="jz-card mr__hero">
      <view class="mr__icon"><JzIcon name="clipboard" :size="42" :color="TOKEN_COLOR.primary" /></view>
      <view class="jz-grow">
        <text class="mr__title">登记量房记录</text>
        <text class="mr__sub">{{ subtitle }}</text>
      </view>
    </view>

    <view class="jz-card mr__form">
      <text class="mr__group">量房事实</text>
      <view class="mr__row">
        <text class="mr__label">量房日期</text>
        <JzSelectField mode="date" variant="boxed" :value="measureDate" :display="measureDate" placeholder="请选择日期" @change="measureDate = $event" />
      </view>
      <view class="mr__row">
        <text class="mr__label">量房时间</text>
        <JzSelectField mode="time" variant="boxed" :value="measureTime" :display="measureTime" placeholder="请选择时间" @change="measureTime = $event" />
      </view>

      <text class="mr__group mr__group--gap">现场照片（{{ sitePhotos.length }}/{{ MAX_PHOTOS }}）</text>
      <view class="mr__photos">
        <view v-for="(photo, index) in sitePhotos" :key="index" class="mr__photo">
          <image :src="photo" mode="aspectFill" @tap="previewPhoto(index)" />
          <view class="mr__photo-del" @tap.stop="removePhoto(index)">
            <JzIcon name="close" :size="22" :color="TOKEN_COLOR.white" :stroke-width="2.4" />
          </view>
        </view>
        <view v-if="sitePhotos.length < MAX_PHOTOS" class="mr__photo mr__photo--add" @tap="choosePhotos">
          <JzIcon name="camera" :size="36" :color="TOKEN_COLOR.text3" />
          <text class="mr__add-text">拍照/相册</text>
        </view>
      </view>

      <text class="mr__group mr__group--gap">原始区域实测（原始结构）</text>
      <text class="mr__hint">
        量房测的是房屋原始结构。原始区域面积/周长按 CAD 计算结果录入；保存后量房完成即冻结，
        需要修正必须重新量房（复尺）。新建方案会继承它作结构起点，之后可在方案内改造，二者不联动（DEC-069）。
      </text>
      <view v-if="existingRegions.length" class="mr__regions">
        <view v-for="region in existingRegions" :key="region.id" class="mr__region-chip">
          <text class="mr__region-chip-name">{{ region.name }} · {{ SPACE_TYPE_LABEL[region.type] }}</text>
          <text class="mr__region-chip-value">{{ region.area == null ? '未录入' : region.area }}㎡ / {{ region.perimeter == null ? '未录入' : region.perimeter }}m</text>
        </view>
      </view>
      <template v-if="!measureFrozen">
        <view v-for="(draft, index) in regionDrafts" :key="draft.key" class="mr__region-row">
          <view class="mr__region-cell mr__region-cell--type">
            <JzSelectField
              mode="selector"
              variant="boxed"
              :display="SPACE_TYPE_LABEL[draft.type]"
              :range="MEASURE_REGION_TYPES"
              :index="regionTypeIndex(draft)"
              @change="onRegionTypeChange(draft, $event)"
            />
          </view>
          <input v-model="draft.name" class="jz-form-input mr__region-cell" placeholder="区域名称" />
          <input
            v-model="draft.area"
            type="digit"
            class="jz-form-input mr__region-cell jz-numeric-input"
            placeholder="面积㎡"
            placeholder-class="jz-number-placeholder"
            placeholder-style="text-align: left"
          />
          <input
            v-model="draft.perimeter"
            type="digit"
            class="jz-form-input mr__region-cell jz-numeric-input"
            placeholder="周长m"
            placeholder-class="jz-number-placeholder"
            placeholder-style="text-align: left"
          />
          <view class="mr__region-del" @tap.stop="removeRegion(index)">
            <JzIcon name="trash" :size="24" :color="TOKEN_COLOR.danger" />
          </view>
        </view>
        <view class="jz-btn jz-btn--plain jz-btn--sm mr__region-add" @tap="addRegion">
          <JzIcon name="plus" :size="22" :color="TOKEN_COLOR.primary" />
          <text>添加原始区域</text>
        </view>
      </template>
      <view v-else class="mr__freeze">
        <JzIcon name="info" :size="26" :color="TOKEN_COLOR.text3" />
        <text>该量房已完成，原始结构已冻结、不可再修改；如需修正请重新登记一次量房（复尺）。</text>
      </view>

      <view class="mr__notice">
        <JzIcon name="info" :size="26" :color="TOKEN_COLOR.text3" />
        <text>量房记录留「谁在什么时候完成了量房」与「房屋原始结构的逐区域实测」两项事实：原始区域在本页录入、量房完成后冻结；客户诉求与设计结论仍在「方案设计」中沉淀。</text>
      </view>
    </view>

    <view class="jz-actionbar"><view class="jz-actionbar__inner"><button class="jz-btn jz-btn--primary jz-grow" :loading="submitting" @tap="save">保存量房记录</button></view></view>
  </view>
</template>

<style lang="scss" scoped>
.mr { min-height: 100vh; padding: 24rpx 24rpx 170rpx; background: $jzb-bg-page; }
.mr__hero { display: flex; align-items: center; padding: 28rpx; margin-bottom: 20rpx; }
.mr__icon { width: 82rpx; height: 82rpx; display: flex; align-items: center; justify-content: center; margin-right: 20rpx; background: $jzb-primary-lightest; border-radius: 24rpx; }
.mr__title { display: block; font-size: $jzb-font-lg; font-weight: 750; }
.mr__sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.5; }
.mr__form { padding: 28rpx; }
.mr__group { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.mr__group--gap { margin-top: 34rpx; }
.mr__required { color: $jzb-danger; font-size: $jzb-font-xs; }
.mr__row { display: flex; align-items: center; min-height: 92rpx; border-bottom: 1rpx solid $jzb-border-light; }
.mr__label { width: 170rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.mr__value { color: $jzb-text-1; font-size: $jzb-font; }
.mr__notice { display: flex; align-items: flex-start; gap: 12rpx; margin-top: 20rpx; padding: 20rpx; color: $jzb-text-3; background: $jzb-bg-hover; border-radius: $jzb-radius; font-size: $jzb-font-xs; line-height: 1.65; }
.mr__hint { display: block; margin-top: 10rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.mr__regions { display: flex; flex-direction: row; flex-wrap: wrap; gap: 12rpx; margin-top: 16rpx; }
.mr__region-chip { display: flex; flex-direction: column; padding: 12rpx 18rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; }
.mr__region-chip-name { color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.mr__region-chip-value { margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.mr__region-row { display: flex; flex-direction: row; align-items: center; gap: 10rpx; margin-top: 16rpx; }
.mr__region-cell { flex: 1; min-width: 0; }
.mr__region-cell--type { flex: 0 0 190rpx; }
.mr__region-del { width: 56rpx; height: 56rpx; display: flex; align-items: center; justify-content: center; }
.mr__region-add { margin-top: 16rpx; }
.mr__freeze { display: flex; align-items: flex-start; gap: 12rpx; margin-top: 16rpx; padding: 20rpx; color: $jzb-text-3; background: $jzb-bg-hover; border-radius: $jzb-radius; font-size: $jzb-font-xs; line-height: 1.65; }
.mr__photos { display: flex; flex-direction: row; flex-wrap: wrap; margin-top: 14rpx; }
.mr__photo { width: 196rpx; height: 196rpx; border-radius: $jzb-radius-sm; margin: 0 12rpx 12rpx 0; position: relative; overflow: hidden; }
.mr__photo image { width: 100%; height: 100%; }
.mr__photo-del { position: absolute; top: 0; right: 0; width: 44rpx; height: 44rpx; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.58); border-bottom-left-radius: 12rpx; }
.mr__photo--add { border: 2rpx dashed $jzb-text-4; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.mr__add-text { font-size: $jzb-font-xs; color: $jzb-text-3; margin-top: 6rpx; }
</style>
