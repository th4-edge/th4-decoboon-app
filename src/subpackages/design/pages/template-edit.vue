<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { TOKEN_COLOR } from '@/styles/tokens'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import type { CatalogItem, CatalogType } from '@/domains/catalog/model'
import type { DesignTemplate, TemplateItem, TemplateRoom } from '@/domains/designtemplate/model'
import { TEMPLATE_SCOPE_LABELS, TEMPLATE_STATUS_LABELS } from '@/domains/designtemplate/model'
import { templateApi } from '@/domains/designtemplate/api'
import { confirm, hideLoading, loading, toast, toastError } from '@/composables/toast'
import CatalogPicker from '@/components/CatalogPicker.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'
import JzSheet from '@/components/JzSheet.vue'
import JzTag from '@/components/JzTag.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'

type TemplateScope = DesignTemplate['scope']

const templateId = ref('')
const template = ref<DesignTemplate | null>(null)
const rooms = ref<TemplateRoom[]>([])
const items = ref<TemplateItem[]>([])
const loadingPage = ref(false)
const loadError = ref('')
const savingBase = ref(false)
const savingRoom = ref(false)
const savingItem = ref(false)
const publishing = ref(false)
const createMode = ref(false)
const roomSheet = ref(false)
const itemSheet = ref(false)
const catalogOpen = ref(false)
const catalogType = ref<CatalogType>('construction')
const editingItemId = ref('')

const form = reactive({
  name: '',
  houseType: '',
  areaMin: '',
  areaMax: '',
  tags: '',
  scope: 'Personal' as TemplateScope,
  remark: ''
})

const roomForm = reactive({
  roomId: undefined as string | undefined,
  roomKey: '',
  name: '',
  roomType: 'Bedroom',
  referenceArea: '',
  referencePerimeter: '',
  count: '1',
  remark: ''
})

const itemForm = reactive({
  itemId: undefined as string | undefined,
  catalogItemId: '',
  name: '',
  unit: '',
  roomKey: '',
  quantityFormula: '',
  defaultQuantity: '',
  remark: ''
})

const roomTypes = [
  { value: 'Bedroom', label: '卧室' },
  { value: 'LivingRoom', label: '客厅' },
  { value: 'DiningRoom', label: '餐厅' },
  { value: 'Kitchen', label: '厨房' },
  { value: 'Bathroom', label: '卫生间' },
  { value: 'Balcony', label: '阳台' }
]

const version = computed(() => template.value?.currentVersion)
const versionId = computed(() => version.value?.versionId || '')
const isManager = computed(() => session.role === 'boss' || session.role === 'storeManager')
const canMaintain = computed(() => {
  if (!template.value || !can(session.role, 'edit:design-template')) return false
  if (template.value.scope === 'Personal') return isManager.value || template.value.owner?.empId === session.emp?.id
  return isManager.value
})
const canWrite = computed(() => Boolean(template.value && version.value?.status === 'Draft' && template.value.status !== 'Disabled' && canMaintain.value))
const scopeOptions = computed(() => isManager.value
  ? (['Personal', 'Store', 'Company'] as TemplateScope[])
  : (['Personal'] as TemplateScope[]))
const roomOptions = computed(() => rooms.value.map((room) => ({ key: room.roomKey, label: room.name })))
const pageTitle = computed(() => createMode.value ? '新建方案模版' : '编辑方案模版')
const pageSubtitle = computed(() => createMode.value ? '先填写模版基础信息，再配置区域与分项' : '只可编辑草稿版本；发布后不可直接修改')
const canPublish = computed(() => canWrite.value && rooms.value.length > 0 && items.value.length > 0)

function roomTypeLabel(value: string): string {
  return roomTypes.find((item) => item.value === value)?.label || value || '区域类型待确认'
}

function roomName(roomKey?: string): string {
  return rooms.value.find((room) => room.roomKey === roomKey)?.name || '综合项目'
}

function itemName(item: TemplateItem): string {
  return item.catalogItem?.name || '报价项目暂不可确认'
}

function itemUnit(item: TemplateItem): string {
  return item.catalogItem?.unit || ''
}

function itemQuantity(item: TemplateItem): string {
  if (item.quantityFormula) return item.quantityFormula
  if (item.defaultQuantity != null) return `固定 ${item.defaultQuantity}${itemUnit(item)}`
  return '待填写公式或固定数量'
}

function resetCreateForm(): void {
  form.name = ''
  form.houseType = ''
  form.areaMin = ''
  form.areaMax = ''
  form.tags = ''
  form.scope = 'Personal'
  form.remark = ''
}

async function createTemplate(): Promise<void> {
  if (!can(session.role, 'edit:design-template')) {
    toast('当前账号无权维护方案模版')
    return
  }
  if (!form.name.trim() || !form.houseType.trim()) {
    toast('请填写模版名称和房型')
    return
  }
  if (!scopeOptions.value.includes(form.scope)) {
    toast('当前角色不能创建该归属范围的模版')
    return
  }
  savingBase.value = true
  loading('正在创建模版草稿…')
  try {
    const created = await templateApi.save({
      name: form.name.trim(),
      houseType: form.houseType.trim(),
      areaMin: form.areaMin ? Number(form.areaMin) : undefined,
      areaMax: form.areaMax ? Number(form.areaMax) : undefined,
      tags: form.tags.trim() || undefined,
      scope: form.scope,
      remark: form.remark.trim() || undefined
    })
    templateId.value = created.templateId
    createMode.value = false
    await loadTemplate()
    toast('模版草稿已创建，请配置区域和分项', 'success')
  } catch (error) {
    toastError(error, '创建方案模版失败')
  } finally {
    hideLoading()
    savingBase.value = false
  }
}

async function loadTemplate(): Promise<void> {
  if (!templateId.value) return
  loadingPage.value = true
  loadError.value = ''
  try {
    const data = await templateApi.info(templateId.value)
    template.value = data
    rooms.value = [...(data.rooms || [])]
    items.value = [...(data.items || [])]
  } catch (error) {
    template.value = null
    loadError.value = error instanceof Error ? error.message : '方案模版暂不可确认'
    toastError(error, '方案模版加载失败')
  } finally {
    loadingPage.value = false
  }
}

function openCreateRoom(): void {
  if (!canWrite.value) return
  roomForm.roomId = undefined
  roomForm.roomKey = ''
  roomForm.name = ''
  roomForm.roomType = 'Bedroom'
  roomForm.referenceArea = ''
  roomForm.referencePerimeter = ''
  roomForm.count = '1'
  roomForm.remark = ''
  roomSheet.value = true
}

function openEditRoom(room: TemplateRoom): void {
  if (!canWrite.value) return
  roomForm.roomId = room.roomId
  roomForm.roomKey = room.roomKey
  roomForm.name = room.name
  roomForm.roomType = room.roomType || 'Bedroom'
  roomForm.referenceArea = room.referenceArea == null ? '' : String(room.referenceArea)
  roomForm.referencePerimeter = room.referencePerimeter == null ? '' : String(room.referencePerimeter)
  roomForm.count = room.count == null ? '1' : String(room.count)
  roomForm.remark = room.remark || ''
  roomSheet.value = true
}

async function submitRoom(): Promise<void> {
  if (!versionId.value || !roomForm.name.trim()) {
    toast('请填写区域名称')
    return
  }
  savingRoom.value = true
  try {
    await templateApi.saveRoom({
      versionId: versionId.value,
      roomId: roomForm.roomId,
      roomKey: roomForm.roomKey || `room-${Date.now()}`,
      name: roomForm.name.trim(),
      roomType: roomForm.roomType,
      referenceArea: roomForm.referenceArea ? Number(roomForm.referenceArea) : undefined,
      referencePerimeter: roomForm.referencePerimeter ? Number(roomForm.referencePerimeter) : undefined,
      count: roomForm.count ? Number(roomForm.count) : 1,
      sortNo: roomForm.roomId ? rooms.value.find((room) => room.roomId === roomForm.roomId)?.sortNo ?? rooms.value.length : rooms.value.length,
      remark: roomForm.remark.trim() || undefined
    })
    roomSheet.value = false
    await loadTemplate()
    toast('区域已保存', 'success')
  } catch (error) {
    toastError(error, '区域保存失败')
  } finally {
    savingRoom.value = false
  }
}

async function removeRoom(room: TemplateRoom): Promise<void> {
  if (!room.roomId || !canWrite.value) return
  const ok = await confirm('删除区域', `确认删除“${room.name}”？如果已有分项引用该区域，系统会阻止删除。`, '删除')
  if (!ok) return
  loading('正在删除区域…')
  try {
    await templateApi.deleteRoom({ roomId: room.roomId })
    await loadTemplate()
    toast('区域已删除', 'success')
  } catch (error) {
    toastError(error, '区域删除失败，请先解除分项引用')
  } finally {
    hideLoading()
  }
}

function openCatalog(): void {
  if (!canWrite.value) return
  catalogOpen.value = true
}

function chooseCatalog(item: CatalogItem): void {
  editingItemId.value = ''
  itemForm.itemId = undefined
  itemForm.catalogItemId = item.id
  itemForm.name = item.name
  itemForm.unit = item.unit
  itemForm.roomKey = ''
  itemForm.quantityFormula = ''
  itemForm.defaultQuantity = ''
  itemForm.remark = ''
  itemSheet.value = true
}

function openEditItem(item: TemplateItem): void {
  if (!canWrite.value) return
  editingItemId.value = item.itemId
  itemForm.itemId = item.itemId
  itemForm.catalogItemId = item.catalogItem?.itemId || ''
  itemForm.name = itemName(item)
  itemForm.unit = itemUnit(item)
  itemForm.roomKey = item.roomKey || ''
  itemForm.quantityFormula = item.quantityFormula || ''
  itemForm.defaultQuantity = item.defaultQuantity == null ? '' : String(item.defaultQuantity)
  itemForm.remark = item.remark || ''
  itemSheet.value = true
}

async function submitItem(): Promise<void> {
  if (!versionId.value || !itemForm.catalogItemId) {
    toast('请先选择报价分项')
    return
  }
  const formula = itemForm.quantityFormula.trim()
  const defaultQuantity = itemForm.defaultQuantity.trim()
  if (!formula && (!defaultQuantity || Number(defaultQuantity) <= 0)) {
    toast('请填写工程量公式或大于 0 的固定数量')
    return
  }
  savingItem.value = true
  try {
    await templateApi.batchSaveItems({
      versionId: versionId.value,
      items: [{
        itemId: itemForm.itemId,
        roomKey: itemForm.roomKey || undefined,
        catalogItemId: itemForm.catalogItemId,
        quantityFormula: formula || undefined,
        defaultQuantity: formula ? undefined : Number(defaultQuantity),
        sortNo: itemForm.itemId ? items.value.findIndex((item) => item.itemId === itemForm.itemId) : items.value.length,
        remark: itemForm.remark.trim() || undefined
      }]
    })
    itemSheet.value = false
    await loadTemplate()
    toast('分项已保存', 'success')
  } catch (error) {
    toastError(error, '分项保存失败，请检查公式和单位')
  } finally {
    savingItem.value = false
  }
}

async function removeItem(item: TemplateItem): Promise<void> {
  if (!canWrite.value) return
  const ok = await confirm('删除分项', `确认删除“${itemName(item)}”？`, '删除')
  if (!ok) return
  loading('正在删除分项…')
  try {
    await templateApi.batchSaveItems({ versionId: versionId.value, deletedItemIds: [item.itemId], items: [] })
    await loadTemplate()
    toast('分项已删除', 'success')
  } catch (error) {
    toastError(error, '分项删除失败')
  } finally {
    hideLoading()
  }
}

async function publish(): Promise<void> {
  if (!canPublish.value || !templateId.value) return
  const ok = await confirm('发布方案模版', '发布后当前版本不可修改，后续修改会生成新版本。历史报价不受影响。', '发布')
  if (!ok) return
  publishing.value = true
  loading('正在校验并发布模版…')
  try {
    await templateApi.publish(templateId.value)
    await loadTemplate()
    toast('方案模版已发布', 'success')
  } catch (error) {
    toastError(error, '发布失败，请检查区域、公式和单位')
  } finally {
    hideLoading()
    publishing.value = false
  }
}

onLoad((query) => {
  if (!isLoggedIn()) {
    uni.reLaunch({ url: P.login })
    return
  }
  if (!can(session.role, 'edit:design-template')) {
    toast('当前账号无权维护方案模版')
    return
  }
  templateId.value = String(query?.templateId || '')
  createMode.value = !templateId.value || query?.mode === 'create'
  resetCreateForm()
  if (!createMode.value) void loadTemplate()
})
</script>

<template>
  <view class="tpe">
    <JzPageHeader :title="pageTitle" :subtitle="pageSubtitle" back />
    <PageState v-if="loadingPage && !template" state="loading" title="正在读取方案模版" />
    <PageState v-else-if="loadError && !template" state="error" title="方案模版暂不可确认" :subtitle="loadError" @retry="loadTemplate" />

    <view v-else-if="createMode" class="tpe__body">
      <view class="jz-card tpe__form-card">
        <text class="tpe__section-title">模版基础信息</text>
        <text class="tpe__hint">模版只沉淀区域和分项公式，不承载价格；发布后不可直接修改。</text>
        <label class="tpe__field"><text>模版名称 *</text><input v-model="form.name" maxlength="128" placeholder="例如：三室两厅基础施工模版" /></label>
        <label class="tpe__field"><text>房型 *</text><input v-model="form.houseType" maxlength="64" placeholder="例如：三室两厅一厨两卫" /></label>
        <view class="tpe__field-row">
          <label class="tpe__field"><text>最小面积（㎡）</text><input v-model="form.areaMin" type="digit" placeholder="可选" /></label>
          <label class="tpe__field"><text>最大面积（㎡）</text><input v-model="form.areaMax" type="digit" placeholder="可选" /></label>
        </view>
        <label class="tpe__field"><text>标签</text><input v-model="form.tags" maxlength="256" placeholder="用逗号分隔，例如：刚需,半包" /></label>
        <view class="tpe__field">
          <text>归属范围 *</text>
          <view class="tpe__chips">
            <view v-for="scope in scopeOptions" :key="scope" class="tpe__chip" :class="{ 'tpe__chip--on': form.scope === scope }" @tap="form.scope = scope">{{ TEMPLATE_SCOPE_LABELS[scope] }}</view>
          </view>
        </view>
        <label class="tpe__field"><text>备注</text><textarea v-model="form.remark" maxlength="256" placeholder="可选" auto-height /></label>
        <button class="jz-btn jz-btn--primary jz-btn--block" :loading="savingBase" @tap="createTemplate">创建草稿</button>
      </view>
    </view>

    <view v-else-if="template" class="tpe__body">
      <view class="jz-card tpe__hero">
        <view class="jz-grow">
          <text class="tpe__hero-name">{{ version?.name || '方案模版' }}</text>
          <text class="tpe__hero-meta">{{ version?.houseType || '房型暂不可确认' }} · V{{ version?.version || '—' }} · {{ TEMPLATE_SCOPE_LABELS[template.scope] || '范围待确认' }}</text>
          <JzTag :text="TEMPLATE_STATUS_LABELS[version?.status || template.status] || '状态待确认'" :color="version?.status === 'Draft' ? TOKEN_COLOR.warning : TOKEN_COLOR.success" />
        </view>
        <JzIcon name="file-text" :size="42" :color="TOKEN_COLOR.primary" />
      </view>

      <view v-if="!canWrite" class="jz-card tpe__notice">
        <JzIcon name="info" :size="28" :color="TOKEN_COLOR.primary" />
        <text>当前版本不可直接编辑。已发布模版需要生成新版本后再修改；停用模版需复制后使用。</text>
      </view>

      <template v-if="canWrite">
        <view class="jz-section"><text class="jz-section__title">区域骨架</text><text class="jz-section__more" @tap="openCreateRoom">+ 添加区域</text></view>
        <view v-if="!rooms.length" class="jz-card tpe__empty">至少添加一个区域后才能发布模版。</view>
        <view v-else class="tpe__list">
          <view v-for="room in rooms" :key="room.roomKey" class="jz-card tpe__row">
            <view class="jz-grow"><text class="tpe__row-title">{{ room.name }}</text><text class="tpe__row-sub">{{ roomTypeLabel(room.roomType) }} · 参考 {{ room.referenceArea ?? '待补' }}㎡ / {{ room.referencePerimeter ?? '待补' }}m</text></view>
            <text class="tpe__row-action" @tap.stop="openEditRoom(room)">编辑</text>
            <text class="tpe__row-danger" @tap.stop="removeRoom(room)">删除</text>
          </view>
        </view>

        <view class="jz-section"><text class="jz-section__title">报价分项与公式</text><text class="jz-section__more" @tap="openCatalog">+ 添加分项</text></view>
        <view v-if="!items.length" class="jz-card tpe__empty">至少添加一个分项后才能发布模版。</view>
        <view v-else class="tpe__list">
          <view v-for="item in items" :key="item.itemId" class="jz-card tpe__row">
            <view class="jz-grow"><text class="tpe__row-title">{{ itemName(item) }}</text><text class="tpe__row-sub">{{ roomName(item.roomKey) }} · {{ itemUnit(item) }} · {{ itemQuantity(item) }}</text></view>
            <text class="tpe__row-action" @tap.stop="openEditItem(item)">编辑</text>
            <text class="tpe__row-danger" @tap.stop="removeItem(item)">删除</text>
          </view>
        </view>

        <view class="tpe__publish">
          <button class="jz-btn jz-btn--primary jz-btn--block" :disabled="!canPublish || publishing" :loading="publishing" @tap="publish">发布方案模版</button>
          <text v-if="!rooms.length || !items.length" class="tpe__publish-hint">发布前至少需要一个区域和一个分项。</text>
        </view>
      </template>
    </view>

    <JzSheet :visible="roomSheet" :title="roomForm.roomId ? '编辑区域' : '添加区域'" @close="roomSheet = false">
      <view class="tpe__sheet">
        <label class="tpe__field"><text>区域名称 *</text><input v-model="roomForm.name" maxlength="64" placeholder="例如：主卧" /></label>
        <view class="tpe__field"><text>区域类型</text><view class="tpe__chips"><view v-for="type in roomTypes" :key="type.value" class="tpe__chip" :class="{ 'tpe__chip--on': roomForm.roomType === type.value }" @tap="roomForm.roomType = type.value">{{ type.label }}</view></view></view>
        <view class="tpe__field-row">
          <label class="tpe__field"><text>参考面积 A（㎡）</text><input v-model="roomForm.referenceArea" type="digit" placeholder="可选" /></label>
          <label class="tpe__field"><text>参考周长 P（m）</text><input v-model="roomForm.referencePerimeter" type="digit" placeholder="可选" /></label>
        </view>
        <label class="tpe__field"><text>同型数量 N</text><input v-model="roomForm.count" type="number" placeholder="默认 1" /></label>
        <label class="tpe__field"><text>备注</text><input v-model="roomForm.remark" maxlength="256" placeholder="可选" /></label>
        <view class="tpe__sheet-actions"><button class="jz-btn jz-btn--plain" @tap="roomSheet = false">取消</button><button class="jz-btn jz-btn--primary" :loading="savingRoom" @tap="submitRoom">保存区域</button></view>
      </view>
    </JzSheet>

    <JzSheet :visible="itemSheet" :title="itemForm.itemId ? '编辑分项' : '添加分项'" @close="itemSheet = false">
      <view class="tpe__sheet">
        <view class="jz-card tpe__selected"><text class="tpe__row-title">{{ itemForm.name }}</text><text class="tpe__row-sub">单位 {{ itemForm.unit || '待确认' }} · 归属区域 {{ roomName(itemForm.roomKey) }}</text></view>
        <view class="tpe__field"><text>归属区域</text><view class="tpe__chips"><view class="tpe__chip" :class="{ 'tpe__chip--on': !itemForm.roomKey }" @tap="itemForm.roomKey = ''">综合项目</view><view v-for="room in roomOptions" :key="room.key" class="tpe__chip" :class="{ 'tpe__chip--on': itemForm.roomKey === room.key }" @tap="itemForm.roomKey = room.key">{{ room.label }}</view></view></view>
        <label class="tpe__field"><text>工程量公式</text><input v-model="itemForm.quantityFormula" placeholder="例如：=A，留空则填写固定数量" /></label>
        <label class="tpe__field"><text>固定数量</text><input v-model="itemForm.defaultQuantity" type="digit" placeholder="无公式时必填，且大于 0" /></label>
        <label class="tpe__field"><text>备注</text><input v-model="itemForm.remark" maxlength="256" placeholder="可选" /></label>
        <text class="tpe__hint">请按区域变量填写公式；系统会自动检查公式是否适用于该分项。模版不保存价格。</text>
        <view class="tpe__sheet-actions"><button class="jz-btn jz-btn--plain" @tap="itemSheet = false">取消</button><button class="jz-btn jz-btn--primary" :loading="savingItem" @tap="submitItem">保存分项</button></view>
      </view>
    </JzSheet>

    <CatalogPicker :visible="catalogOpen" :type="catalogType" title="选择报价分项" :multiple="false" @update:visible="catalogOpen = $event" @select="chooseCatalog" />
    <JzConfirmDialog />
  </view>
</template>

<style lang="scss" scoped>
.tpe { min-height: 100vh; padding-bottom: 80rpx; background: $jzb-bg-page; }
.tpe__body { padding: 20rpx 24rpx 0; }
.tpe__form-card, .tpe__hero { padding: 26rpx; }
.tpe__section-title { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.tpe__hint { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.55; }
.tpe__field { display: block; margin-top: 22rpx; }
.tpe__field > text { display: block; margin-bottom: 10rpx; color: $jzb-text-2; font-size: $jzb-font-xs; font-weight: 620; }
.tpe__field input, .tpe__field textarea { box-sizing: border-box; width: 100%; min-height: 78rpx; padding: 0 20rpx; color: $jzb-text-1; background: $jzb-bg-hover; border: 1rpx solid transparent; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; }
.tpe__field textarea { min-height: 140rpx; padding-top: 18rpx; line-height: 1.55; }
.tpe__field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; }
.tpe__chips { display: flex; flex-wrap: wrap; gap: 10rpx; }
.tpe__chip { padding: 10rpx 18rpx; border-radius: $jzb-radius-pill; background: $jzb-bg-hover; color: $jzb-text-2; font-size: $jzb-font-xs; }
.tpe__chip--on { color: $jzb-primary-dark; background: $jzb-primary-lightest; font-weight: 650; }
.tpe__hero { display: flex; align-items: flex-start; gap: 16rpx; background: $jzb-primary-lightest; }
.tpe__hero-name { display: block; color: $jzb-text-1; font-size: $jzb-font-xl; font-weight: 750; }
.tpe__hero-meta { display: block; margin: 7rpx 0 14rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.tpe__notice { margin-top: 18rpx; padding: 22rpx; display: flex; align-items: flex-start; gap: 10rpx; color: $jzb-text-2; font-size: $jzb-font-xs; line-height: 1.55; }
.tpe__list { display: flex; flex-direction: column; gap: 14rpx; }
.tpe__row { padding: 22rpx; display: flex; align-items: center; gap: 14rpx; }
.tpe__row-title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 680; }
.tpe__row-sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.tpe__row-action { flex: none; color: $jzb-primary-dark; font-size: $jzb-font-xs; }
.tpe__row-danger { flex: none; color: $jzb-danger; font-size: $jzb-font-xs; }
.tpe__empty { padding: 24rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.55; }
.tpe__publish { margin-top: 30rpx; }
.tpe__publish-hint { display: block; margin-top: 10rpx; color: $jzb-text-3; font-size: $jzb-font-xs; text-align: center; }
.tpe__sheet { padding-bottom: 20rpx; }
.tpe__sheet-actions { display: flex; gap: 16rpx; margin-top: 28rpx; }
.tpe__sheet-actions .jz-btn { flex: 1; }
.tpe__selected { margin-top: 16rpx; padding: 18rpx; background: $jzb-primary-lightest; }
</style>
