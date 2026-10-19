<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { financeApi } from '@/domains/finance/api'
import { setLedgerCategoryPickerResult } from '@/domains/finance/ledger-category-picker'
import type { LedgerCategory, LedgerDirection } from '@/domains/finance/model'
import { isLoggedIn, session } from '@/domains/identity/session'
import { confirmDanger, hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzSheet from '@/components/JzSheet.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'

const direction = ref<LedgerDirection>('expense')
const selectedId = ref('')
const selectedName = ref('')
const selectedDeleted = ref(false)
const legacyText = ref('')
const keyword = ref('')
const categories = ref<LedgerCategory[]>([])
const loadingCategories = ref(false)
const loadError = ref('')
const sheet = ref(false)
const sheetMode = ref<'create' | 'edit'>('create')
const editingId = ref('')
const newName = ref('')
const newDescription = ref('')
const saving = ref(false)

const canManage = computed(() => ['boss', 'finance', 'storeManager'].includes(session.role || ''))
const canDelete = computed(() => canManage.value)
const items = computed(() => categories.value.filter((item) => item.direction === direction.value && item.active))
const filteredItems = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return items.value
  return items.value.filter((item) =>
    item.name.toLowerCase().includes(kw) || (item.description || '').toLowerCase().includes(kw))
})
const sheetTitle = computed(() => sheetMode.value === 'edit' ? '编辑业务分类' : '新增业务分类')
const sheetHint = computed(() => sheetMode.value === 'edit'
  ? '修改名称或说明不会改动历史流水；仅当前企业生效。'
  : '新增其他账务的一级分类，保存后可直接用于记账。')
const currentCategory = computed(() => {
  if (selectedId.value) {
    const item = categories.value.find((entry) => entry.id === selectedId.value)
    return {
      name: item?.name || selectedName.value || '已选分类',
      description: item?.description || '',
      state: selectedDeleted.value || !item ? 'legacy' : 'active'
    }
  }
  if (legacyText.value) return { name: legacyText.value, description: '', state: 'legacyText' }
  return null
})

function decodeQuery(value?: string) {
  if (!value) return ''
  try {
    return decodeURIComponent(String(value).replace(/\+/g, ' '))
  } catch {
    return String(value)
  }
}

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  if (query?.direction === 'income' || query?.direction === 'expense') direction.value = query.direction
  selectedId.value = decodeQuery(query?.selectedId)
  selectedName.value = decodeQuery(query?.selectedName)
  legacyText.value = decodeQuery(query?.legacyText)
  void load()
})

async function load() {
  loadingCategories.value = true
  loadError.value = ''
  try {
    categories.value = await financeApi.ledgerCategories()
    selectedDeleted.value = !!selectedId.value && !categories.value.some((item) => item.id === selectedId.value)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '业务分类加载失败'
    toastError(error, '业务分类加载失败')
  } finally {
    loadingCategories.value = false
  }
}

function choose(item: LedgerCategory) {
  setLedgerCategoryPickerResult({
    action: 'select',
    value: {
      id: item.id,
      name: item.name,
      description: item.description,
      path: item.name,
      direction: direction.value
    }
  })
  uni.navigateBack()
}

function clearCurrent() {
  setLedgerCategoryPickerResult({ action: 'clear' })
  uni.navigateBack()
}

function openCreate() {
  if (!canManage.value) return
  sheetMode.value = 'create'
  editingId.value = ''
  newName.value = ''
  newDescription.value = ''
  sheet.value = true
}

function openEdit(item: LedgerCategory) {
  if (!canManage.value) return
  sheetMode.value = 'edit'
  editingId.value = item.id
  newName.value = item.name
  newDescription.value = item.description || ''
  sheet.value = true
}

async function saveCategory() {
  if (!canManage.value || saving.value || !newName.value.trim() || !newDescription.value.trim()) return
  saving.value = true
  loading(sheetMode.value === 'edit' ? '保存分类中' : '新增分类中')
  try {
    if (sheetMode.value === 'edit') {
      await financeApi.updateLedgerCategory({
        id: editingId.value,
        name: newName.value.trim(),
        description: newDescription.value.trim(),
        active: true
      })
      hideLoading()
      sheet.value = false
      await load()
      toast('分类已更新', 'success')
    } else {
      const created = await financeApi.saveLedgerCategory({
        name: newName.value.trim(),
        description: newDescription.value.trim(),
        direction: direction.value
      })
      hideLoading()
      sheet.value = false
      await load()
      choose(created)
    }
  } catch (error) {
    hideLoading()
    toastError(error, sheetMode.value === 'edit' ? '分类更新失败' : '分类保存失败')
  } finally {
    saving.value = false
  }
}

async function removeCategory(item: LedgerCategory) {
  if (!canDelete.value) return
  const ok = await confirmDanger('停用业务分类', '停用后历史流水继续保留；新记账将不能再选择该分类。', '确认停用')
  if (!ok) return
  loading('停用分类中')
  try {
    await financeApi.deleteLedgerCategory(item.id)
    hideLoading()
    await load()
    toast('分类已停用', 'success')
  } catch (error) {
    hideLoading()
    toastError(error, '分类停用失败')
  }
}
</script>

<template>
  <view class="fin-page lc-page">
    <JzPageHeader title="选择业务分类" :subtitle="direction === 'income' ? '其他收入类' : '其他支出类'" :right-text="canManage ? '新增' : ''" back @right="openCreate" />

    <view class="lc-body">
      <view v-if="currentCategory" class="lc-current" :class="{ 'lc-current--muted': currentCategory.state !== 'active' }">
        <view class="lc-current__icon">
          <JzIcon :name="currentCategory.state === 'active' ? 'check-circle' : 'file-text'" :size="30" :color="currentCategory.state === 'active' ? TOKEN_COLOR.primary : TOKEN_COLOR.text3" />
        </view>
        <view class="lc-current__main">
          <text class="lc-current__eyebrow">当前分类</text>
          <text class="lc-current__name">{{ currentCategory.name }}</text>
          <text v-if="currentCategory.description" class="lc-current__description">{{ currentCategory.description }}</text>
        </view>
        <text class="lc-current__clear" @tap.stop="clearCurrent">清除</text>
      </view>

      <view class="lc-notice">
        <JzIcon name="info" :size="24" :color="TOKEN_COLOR.primary" />
        <text>手工记账只登记应收应付闭环之外、日常不常见或个性化的其他账务；分类只有一级。</text>
      </view>

      <view class="lc-search">
        <JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" />
        <input v-model="keyword" placeholder="搜索分类名称或说明" confirm-type="search" />
        <text v-if="keyword" class="lc-search__clear" @tap="keyword = ''">清除</text>
      </view>

      <PageState v-if="loadError && !categories.length" state="error" title="分类加载失败" :subtitle="loadError" @retry="load" />
      <JzSkeleton v-else-if="loadingCategories && !categories.length" :rows="4" />
      <view v-else class="lc-list">
        <view v-for="item in filteredItems" :key="item.id" class="lc-item" :class="{ 'lc-item--on': selectedId === item.id }" @tap="choose(item)">
          <view class="lc-item__main">
            <view class="lc-item__title">
              <text class="lc-node-name">{{ item.name }}</text>
              <text v-if="item.builtIn" class="lc-badge">标准</text>
              <text v-else class="lc-badge lc-badge--custom">自定义</text>
              <text v-if="selectedId === item.id" class="lc-badge lc-badge--active">已选</text>
            </view>
            <text v-if="item.description" class="lc-item__description">{{ item.description }}</text>
          </view>
          <view v-if="canManage" class="lc-item__actions">
            <view class="lc-icon-btn" @tap.stop="openEdit(item)"><JzIcon name="edit" :size="22" :color="TOKEN_COLOR.primary" /></view>
            <view v-if="canDelete" class="lc-icon-btn lc-icon-btn--danger" @tap.stop="removeCategory(item)"><JzIcon name="trash" :size="22" :color="TOKEN_COLOR.danger" /></view>
          </view>
        </view>
        <JzEmpty v-if="!filteredItems.length" text="没有匹配的分类" :sub="canManage ? '可以新增其他账务的一级分类' : '请联系负责人维护分类'" />
      </view>
    </view>

    <JzSheet :visible="sheet" :title="sheetTitle" @close="sheet = false">
      <view class="lc-form">
        <view class="lc-form__block">
          <text class="lc-form__label">分类名称</text>
          <input v-model="newName" maxlength="64" placeholder="如 银行手续费、临时保洁、股东借款" />
        </view>
        <view class="lc-form__block">
          <text class="lc-form__label">分类说明</text>
          <textarea v-model="newDescription" maxlength="500" auto-height placeholder="说明适用场景、举例和禁止用途" />
        </view>
        <view class="lc-form__hint">{{ sheetHint }}</view>
        <button class="jz-btn jz-btn--primary jz-btn--block" :disabled="saving || !newName.trim() || !newDescription.trim()" @tap="saveCategory">{{ saving ? '保存中…' : '保存' }}</button>
      </view>
    </JzSheet>
  </view>
    <JzConfirmDialog />
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';

.lc-page { padding-bottom: calc(48rpx + #{$jzb-safe-bottom}); }
.lc-body { padding: 16rpx $jzb-page-pad 0; }
.lc-current { display: flex; align-items: center; padding: 22rpx; background: $jzb-primary-lightest; border: 1rpx solid rgba(22, 163, 148, .18); border-radius: $jzb-radius; }
.lc-current--muted { background: $jzb-bg-page; border-color: $jzb-border; }
.lc-current__icon { width: 54rpx; height: 54rpx; display: flex; align-items: center; justify-content: center; background: $jzb-bg-card; border-radius: 50%; }
.lc-current__main { flex: 1; min-width: 0; margin-left: 16rpx; }
.lc-current__eyebrow { display: block; color: $jzb-text-3; font-size: $jzb-font-xs; }
.lc-current__name { display: block; margin-top: 4rpx; color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.lc-current__description { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: 22rpx; line-height: 1.5; }
.lc-current__clear { flex: none; margin-left: 18rpx; color: $jzb-primary; font-size: $jzb-font-xs; }
.lc-notice { display: flex; align-items: flex-start; gap: 8rpx; margin-top: 18rpx; padding: 16rpx 18rpx; color: $jzb-text-3; background: $jzb-primary-lighter; border-radius: $jzb-radius-sm; font-size: 22rpx; line-height: 1.5; }
.lc-search { display: flex; align-items: center; gap: 12rpx; min-height: 76rpx; margin-top: 18rpx; padding: 0 20rpx; background: $jzb-bg-card; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius; }
.lc-search input { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font-sm; }
.lc-search__clear { color: $jzb-primary; font-size: $jzb-font-xs; }
.lc-list { margin-top: 16rpx; }
.lc-item { display: flex; align-items: flex-start; gap: 16rpx; margin-bottom: 14rpx; padding: 22rpx; background: $jzb-bg-card; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs; }
.lc-item--on { border-color: rgba(22, 163, 148, .3); background: $jzb-primary-lightest; }
.lc-item__main { flex: 1; min-width: 0; }
.lc-item__title { display: flex; align-items: center; flex-wrap: wrap; gap: 8rpx; }
.lc-node-name { color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.lc-item__description { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: 22rpx; line-height: 1.5; }
.lc-item__actions { display: flex; gap: 8rpx; flex: none; }
.lc-icon-btn { width: 48rpx; height: 48rpx; display: flex; align-items: center; justify-content: center; background: $jzb-bg-page; border: 1rpx solid $jzb-border-light; border-radius: 14rpx; }
.lc-icon-btn--danger { border-color: rgba(229, 72, 77, .16); }
.lc-badge { flex: none; padding: 2rpx 10rpx; border-radius: $jzb-radius-pill; color: $jzb-text-3; background: $jzb-bg-hover; font-size: 19rpx; line-height: 1.7; }
.lc-badge--custom { color: $jzb-role-finance; background: $jzb-primary-lightest; }
.lc-badge--active { color: $jzb-primary-deep; background: $jzb-primary-lighter; }
.lc-form__block { padding: 22rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.lc-form__label { display: block; margin-bottom: 14rpx; color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 600; }
.lc-form__block input, .lc-form__block textarea { width: 100%; min-height: 54rpx; color: $jzb-text-1; font-size: $jzb-font; }
.lc-form__hint { padding: 18rpx 0; color: $jzb-text-3; font-size: 21rpx; line-height: 1.5; }
</style>
