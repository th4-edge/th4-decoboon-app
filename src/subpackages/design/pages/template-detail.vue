<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { TOKEN_COLOR } from '@/styles/tokens'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { templateApi } from '@/domains/designtemplate/api'
import type { DesignTemplate, TemplateItem } from '@/domains/designtemplate/model'
import { TEMPLATE_SCOPE_LABELS, TEMPLATE_STATUS_LABELS } from '@/domains/designtemplate/model'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'

const templateId = ref('')
const customerId = ref('')
const propertyId = ref('')
const template = ref<DesignTemplate | null>(null)
const loadingTemplate = ref(false)
const loadError = ref('')
const instantiating = ref(false)
const authorized = ref(false)

const roomTypes = [
  { value: 'Bedroom', label: '卧室' },
  { value: 'LivingRoom', label: '客厅' },
  { value: 'DiningRoom', label: '餐厅' },
  { value: 'Kitchen', label: '厨房' },
  { value: 'Bathroom', label: '卫生间' },
  { value: 'Balcony', label: '阳台' }
]


const version = computed(() => template.value?.currentVersion)
const rooms = computed(() => template.value?.rooms || [])
const items = computed(() => template.value?.items || [])
const roomNames = computed(() => new Map(rooms.value.map((room) => [room.roomKey, room.name])))
const isManager = computed(() => session.role === 'boss' || session.role === 'storeManager')
const canMaintain = computed(() => {
  if (!template.value || !can(session.role, 'edit:design-template')) return false
  if (template.value.scope === 'Personal') return isManager.value || template.value.owner?.empId === session.emp?.id
  return isManager.value
})
const canEditDraft = computed(() => Boolean(version.value?.status === 'Draft' && canMaintain.value))
const canInstantiate = computed(() =>
  Boolean(template.value?.status === 'Published'
    && version.value?.status === 'Published'
    && propertyId.value
    && can(session.role, 'edit:design'))
)
const instantiateHint = computed(() => {
  if (!propertyId.value) return '请从客户房屋的设计方案页进入后使用模版'
  if (template.value?.status !== 'Published') return '仅已发布模版可以生成设计方案'
  if (version.value?.status !== 'Published') return '该模版当前存在草稿版本，暂不可直接实例化'
  if (!can(session.role, 'edit:design')) return '当前账号无权生成设计方案'
  return ''
})

function editTemplate(): void {
  if (!canEditDraft.value) return
  uni.navigateTo({ url: `${P.designTemplateEdit}?templateId=${encodeURIComponent(templateId.value)}` })
}

function roomTypeLabel(value?: string): string {
  return roomTypes.find((item) => item.value === value)?.label || value || '区域类型待确认'
}

function itemName(item: TemplateItem): string {
  return item.catalogItem?.name || '报价分项暂不可确认'
}

function roomName(item: TemplateItem): string {
  return item.roomKey ? roomNames.value.get(item.roomKey) || '区域暂不可确认' : '全屋'
}

function quantityText(item: TemplateItem): string {
  if (item.quantityFormula) return `公式 ${item.quantityFormula}`
  if (item.defaultQuantity == null) return '工程量待实测'
  return `默认工程量 ${item.defaultQuantity}${item.catalogItem?.unit || ''}`
}

function areaText(): string {
  const min = version.value?.areaMin
  const max = version.value?.areaMax
  if (min === undefined && max === undefined) return '面积不限'
  if (min !== undefined && max !== undefined) return `适用 ${min}–${max}㎡`
  return min !== undefined ? `适用 ≥${min}㎡` : `适用 ≤${max}㎡`
}

async function load(): Promise<void> {
  if (!templateId.value) return
  loadingTemplate.value = true
  loadError.value = ''
  try {
    template.value = await templateApi.info(templateId.value)
  } catch (error) {
    template.value = null
    loadError.value = error instanceof Error ? error.message : '方案模版暂不可确认'
    toastError(error, '方案模版暂不可确认')
  } finally {
    loadingTemplate.value = false
  }
}

async function instantiate(): Promise<void> {
  if (!canInstantiate.value || !template.value || instantiating.value) return
  instantiating.value = true
  loading('正在按模版生成设计方案…')
  try {
    const created = await templateApi.instantiate({
      templateId: template.value.templateId,
      propertyId: propertyId.value,
      name: version.value?.name ? `${version.value.name}方案` : undefined
    })
    hideLoading()
    toast('设计方案已生成', 'success')
    const query = [
      `designId=${encodeURIComponent(created.designId)}`,
      customerId.value ? `customerId=${encodeURIComponent(customerId.value)}` : '',
      propertyId.value ? `propertyId=${encodeURIComponent(propertyId.value)}` : ''
    ].filter(Boolean).join('&')
    setTimeout(() => uni.redirectTo({ url: `${P.designScheme}?${query}` }), 250)
  } catch (error) {
    hideLoading()
    toastError(error, '生成设计方案失败')
  } finally {
    instantiating.value = false
  }
}

onLoad((query) => {
  if (!isLoggedIn()) {
    uni.reLaunch({ url: P.login })
    return
  }
  if (!can(session.role, 'view:design-template')) {
    toast('当前账号无权查看方案模版')
    return
  }
  authorized.value = true
  templateId.value = String(query?.templateId || '')
  customerId.value = String(query?.customerId || '')
  propertyId.value = String(query?.propertyId || '')
  void load()
})
</script>

<template>
  <view v-if="authorized" class="tpd">
    <JzPageHeader
      title="方案模版详情"
      subtitle="区域骨架 · 分项公式 · 不含价格"
      back
      :right-text="canEditDraft ? '编辑' : ''"
      @right="editTemplate"
    />
    <PageState v-if="loadingTemplate && !template" state="loading" title="正在读取方案模版" />
    <PageState v-else-if="loadError && !template" state="error" title="方案模版暂不可确认" :subtitle="loadError" @retry="load" />
    <template v-else-if="template">
      <view class="jz-card tpd__hero">
        <view class="tpd__hero-main">
          <text class="tpd__eyebrow">方案模版 · V{{ version?.version || '—' }}</text>
          <text class="tpd__name">{{ version?.name || '方案模版' }}</text>
          <text class="tpd__meta">{{ version?.houseType || '房型暂不可确认' }} · {{ areaText() }}</text>
          <view class="tpd__badges">
            <JzTag :text="TEMPLATE_SCOPE_LABELS[template.scope] || '范围待确认'" :color="TOKEN_COLOR.primary" />
            <JzTag :text="TEMPLATE_STATUS_LABELS[version?.status || template.status] || '状态待确认'" :color="version?.status === 'Published' ? TOKEN_COLOR.success : TOKEN_COLOR.warning" />
          </view>
        </view>
        <JzIcon name="file-text" :size="44" :color="TOKEN_COLOR.primary" />
      </view>

      <view v-if="version?.tags" class="tpd__tags">
        <text v-for="tag in version.tags.split(',').map((item) => item.trim()).filter(Boolean)" :key="tag" class="tpd__tag">{{ tag }}</text>
      </view>

      <view class="jz-section"><text class="jz-section__title">区域骨架</text><text class="jz-section__more">{{ rooms.length }} 个区域</text></view>
      <JzSkeleton v-if="loadingTemplate && !rooms.length" :rows="2" compact />
      <view v-else-if="!rooms.length" class="jz-card tpd__empty">当前版本尚未维护区域骨架。</view>
      <view v-else class="tpd__rooms">
        <view v-for="room in rooms" :key="room.roomKey" class="jz-card tpd__room">
          <view class="tpd__room-head">
            <text class="tpd__room-name">{{ room.name }}</text>
            <JzTag :text="roomTypeLabel(room.roomType)" :color="TOKEN_COLOR.text3" />
          </view>
          <text class="tpd__room-meta">{{ room.count == null ? '数量待确认' : `${room.count} 个空间单位` }} · 模版参考尺寸不进入正式金额</text>
          <text v-if="room.referenceArea != null || room.referencePerimeter != null" class="tpd__room-reference">
            参考 {{ room.referenceArea != null ? `${room.referenceArea}㎡` : '面积待确认' }} · {{ room.referencePerimeter != null ? `周长 ${room.referencePerimeter}m` : '周长待确认' }}（需实测确认）
          </text>
        </view>
      </view>

      <view class="jz-section"><text class="jz-section__title">分项与公式</text><text class="jz-section__more">{{ items.length }} 个分项</text></view>
      <view v-if="!items.length" class="jz-card tpd__empty">当前版本尚未维护分项。</view>
      <view v-else class="tpd__items">
        <view v-for="item in items" :key="item.itemId" class="jz-card tpd__item">
          <view class="tpd__item-head">
            <text class="tpd__item-name">{{ itemName(item) }}</text>
            <JzTag :text="roomName(item)" :color="TOKEN_COLOR.primary" />
          </view>
          <text class="tpd__item-meta">{{ item.quantityFormula ? '由服务端按模版公式求值' : '实例化后需按实测工程量确认' }}</text>
          <text class="tpd__item-formula">{{ quantityText(item) }}</text>
          <text v-if="item.remark" class="tpd__item-remark">{{ item.remark }}</text>
        </view>
      </view>

      <view class="tpd__notice">
        <JzIcon name="info" :size="26" :color="TOKEN_COLOR.primary" />
        <text>模版只沉淀区域、分项和工程量公式，不承载价格、成本或房屋实测事实。实例化后请在方案中录入实测面积与周长。</text>
      </view>

      <view class="tpd__footer">
        <button v-if="canInstantiate" class="jz-btn jz-btn--primary jz-btn--block" :loading="instantiating" @tap="instantiate">
          <JzIcon name="plus" :size="28" :color="TOKEN_COLOR.white" /><text>生成设计方案</text>
        </button>
        <text v-else class="tpd__hint">{{ instantiateHint || '暂不可生成设计方案' }}</text>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.tpd { min-height: 100vh; padding-bottom: calc(160rpx + env(safe-area-inset-bottom)); background: $jzb-bg-page; }
.tpd__hero { margin: 20rpx 24rpx 0; padding: 26rpx; display: flex; align-items: flex-start; justify-content: space-between; gap: 20rpx; background: $jzb-primary-lightest; }
.tpd__hero-main text { display: block; }
.tpd__eyebrow { color: $jzb-primary-dark; font-size: $jzb-font-xs; font-weight: 700; letter-spacing: .06em; }
.tpd__name { margin-top: 8rpx; color: $jzb-text-1; font-size: $jzb-font-xl; font-weight: 760; }
.tpd__meta { margin-top: 7rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.tpd__badges { display: flex; gap: 10rpx; margin-top: 14rpx; }
.tpd__tags { display: flex; flex-wrap: wrap; gap: 10rpx; padding: 16rpx 24rpx 0; }
.tpd__tag { padding: 8rpx 16rpx; border-radius: $jzb-radius-pill; background: $jzb-bg-card; color: $jzb-text-2; font-size: $jzb-font-xs; }
.tpd__rooms, .tpd__items { padding: 0 24rpx; display: flex; flex-direction: column; gap: 14rpx; }
.tpd__room, .tpd__item { padding: 22rpx; }
.tpd__room-head, .tpd__item-head { display: flex; align-items: center; justify-content: space-between; gap: 14rpx; }
.tpd__room-name, .tpd__item-name { color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 680; }
.tpd__room-meta, .tpd__item-meta, .tpd__item-remark { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.55; }
.tpd__room-reference { display: block; margin-top: 8rpx; color: $jzb-warning; font-size: $jzb-font-xs; line-height: 1.55; }
.tpd__item-formula { display: block; margin-top: 10rpx; padding: 12rpx 14rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; color: $jzb-text-1; font-size: $jzb-font-xs; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; }
.tpd__empty { margin: 0 24rpx; padding: 26rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.tpd__notice { display: flex; align-items: flex-start; gap: 10rpx; margin: 22rpx 24rpx 0; padding: 18rpx 20rpx; border-radius: $jzb-radius-md; background: $jzb-primary-lightest; color: $jzb-text-2; font-size: $jzb-font-xs; line-height: 1.55; }
.tpd__footer { position: fixed; left: 0; right: 0; bottom: 0; padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom)); background: rgba(255,255,255,.97); border-top: 1rpx solid $jzb-border-light; box-shadow: 0 -8rpx 32rpx rgba(15, 23, 42, .06); }
.tpd__hint { display: block; padding: 18rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.55; text-align: center; }
</style>
