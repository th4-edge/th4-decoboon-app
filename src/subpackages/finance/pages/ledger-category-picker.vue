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

const direction = ref<LedgerDirection>('expense')
const selectedId = ref('')
const selectedName = ref('')
const selectedPath = ref('')
const legacyText = ref('')
const selectedDeleted = ref(false)
const keyword = ref('')
const categories = ref<LedgerCategory[]>([])
const loadingCategories = ref(false)
const loadError = ref('')
const collapsedIds = ref<string[]>([])
const sheet = ref(false)
const sheetMode = ref<'create' | 'edit'>('create')
const editingId = ref('')
const parentId = ref('')
const newName = ref('')
const saving = ref(false)

const canManage = computed(() => ['boss', 'finance'].includes(session.role || ''))
const roots = computed(() => categories.value.filter((item) => item.direction === direction.value))
const filteredRoots = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return roots.value
  return roots.value
    .map((root) => ({
      ...root,
      children: (root.children || []).filter((child) =>
        child.name.toLowerCase().includes(kw) || root.name.toLowerCase().includes(kw))
    }))
    .filter((root) => root.name.toLowerCase().includes(kw) || (root.children || []).length)
})
const totalChildCount = computed(() => roots.value.reduce((sum, root) => sum + (root.children || []).length, 0))
const filteredChildCount = computed(() => filteredRoots.value.reduce((sum, root) => sum + (root.children || []).length, 0))
const sheetTitle = computed(() => {
  if (sheetMode.value === 'edit') return '编辑业务分类'
  return parentId.value ? '新增二级分类' : '新增一级分类'
})
const sheetHint = computed(() => {
  if (sheetMode.value === 'edit') return '修改名称不会改动历史流水；标准二级分类的修改仅当前企业生效，不影响其他企业。'
  return parentId.value ? '新增在所选一级下的二级分类，保存后可直接用于记账。' : '一级分类用于分组；新增后建议继续补充二级分类。'
})
const sheetSubmitText = computed(() => sheetMode.value === 'edit' ? '保存修改' : '保存并选择')

function decodeQuery(value?: string) {
  if (!value) return ''
  try {
    return decodeURIComponent(String(value).replace(/\+/g, ' '))
  } catch {
    return String(value)
  }
}

function findCategory(id: string, list = roots.value): LedgerCategory | null {
  for (const root of list) {
    if (root.id === id) return root
    const child = (root.children || []).find((item) => item.id === id)
    if (child) return child
  }
  return null
}

function hasChildren(root: LedgerCategory) {
  return (root.children || []).length > 0
}

function containsSelected(root: LedgerCategory) {
  return selectedId.value === root.id || (root.children || []).some((child) => child.id === selectedId.value)
}

function categoryPath(id: string) {
  for (const root of roots.value) {
    if (root.id === id) return root.name
    const child = (root.children || []).find((item) => item.id === id)
    if (child) return `${root.name} / ${child.name}`
  }
  return selectedPath.value || selectedName.value
}

const currentCategory = computed(() => {
  if (selectedId.value) {
    const node = findCategory(selectedId.value)
    return {
      id: selectedId.value,
      name: node?.name || selectedName.value || '已选分类',
      path: node ? categoryPath(node.id) : selectedPath.value || selectedName.value,
      state: selectedDeleted.value ? 'deleted' : node ? 'active' : 'legacy'
    }
  }
  if (legacyText.value) {
    return { id: '', name: legacyText.value, path: '原录入文本（待关联）', state: 'legacyText' }
  }
  return null
})

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  if (query?.direction === 'income' || query?.direction === 'expense') direction.value = query.direction
  selectedId.value = decodeQuery(query?.selectedId)
  selectedName.value = decodeQuery(query?.selectedName)
  selectedPath.value = decodeQuery(query?.selectedPath)
  legacyText.value = decodeQuery(query?.legacyText)
  collapsedIds.value = []
  void load()
})

async function load() {
  loadingCategories.value = true
  loadError.value = ''
  try {
    categories.value = await financeApi.ledgerCategories()
    selectedDeleted.value = !!selectedId.value && !findCategory(selectedId.value)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '业务分类加载失败'
    toastError(error, '业务分类加载失败')
  } finally {
    loadingCategories.value = false
  }
}

function isCollapsed(id: string) {
  return !keyword.value.trim() && collapsedIds.value.includes(id)
}

function toggleCollapse(id: string) {
  if (collapsedIds.value.includes(id)) {
    collapsedIds.value = collapsedIds.value.filter((item) => item !== id)
  } else {
    collapsedIds.value = [...collapsedIds.value, id]
  }
}

function choose(root: LedgerCategory, child?: LedgerCategory) {
  if (!child && hasChildren(root)) {
    if (isCollapsed(root.id)) toggleCollapse(root.id)
    return
  }
  const node = child || root
  setLedgerCategoryPickerResult({
    action: 'select',
    value: {
      id: node.id,
      name: node.name,
      path: child ? `${root.name} / ${child.name}` : root.name,
      direction: direction.value
    }
  })
  uni.navigateBack()
}

function clearCurrent() {
  setLedgerCategoryPickerResult({ action: 'clear' })
  uni.navigateBack()
}

function openCreate(parent?: LedgerCategory) {
  if (!canManage.value) return
  sheetMode.value = 'create'
  editingId.value = ''
  parentId.value = parent?.id || ''
  newName.value = ''
  sheet.value = true
}

function openEdit(item: LedgerCategory, child = false) {
  if (!canManage.value || (!child && item.builtIn)) return
  sheetMode.value = 'edit'
  editingId.value = item.id
  parentId.value = ''
  newName.value = item.name
  sheet.value = true
}

async function saveCategory() {
  if (!canManage.value || saving.value || !newName.value.trim()) return
  saving.value = true
  loading(sheetMode.value === 'edit' ? '保存分类中' : '新增分类中')
  try {
    if (sheetMode.value === 'edit') {
      await financeApi.updateLedgerCategory({ id: editingId.value, name: newName.value.trim(), active: true })
      hideLoading()
      sheet.value = false
      await load()
      if (selectedId.value === editingId.value) {
        selectedName.value = newName.value.trim()
        selectedPath.value = categoryPath(editingId.value)
      }
      toast('分类已更新', 'success')
    } else {
      const created = await financeApi.saveLedgerCategory({
        name: newName.value.trim(),
        direction: direction.value,
        parentId: parentId.value || undefined
      })
      hideLoading()
      sheet.value = false
      await load()
      const parent = parentId.value ? roots.value.find((item) => item.id === parentId.value) : undefined
      choose(parent || created, parent ? created : undefined)
    }
  } catch (error) {
    hideLoading()
    toastError(error, sheetMode.value === 'edit' ? '分类更新失败' : '分类保存失败')
  } finally {
    saving.value = false
  }
}

async function removeCategory(item: LedgerCategory, child = false) {
  if (!canManage.value || (!child && item.builtIn)) return
  const impact = hasChildren(item)
    ? '该一级分类及其二级分类将停止使用；'
    : child && item.builtIn
      ? '该标准二级分类将按企业停用；'
      : ''
  const ok = await confirmDanger('删除业务分类', `${impact}已录入流水不会删除，历史记录继续显示；新记账将不能再选择该分类。`, '确认删除')
  if (!ok) return
  loading('删除分类中')
  try {
    await financeApi.deleteLedgerCategory(item.id)
    hideLoading()
    if (selectedId.value && selectedId.value === item.id) {
      selectedName.value = item.name
      selectedPath.value = categoryPath(item.id)
    }
    await load()
    toast('分类已删除', 'success')
  } catch (error) {
    hideLoading()
    toastError(error, '分类删除失败')
  }
}
</script>

<template>
  <view class="fin-page lc-page">
    <JzPageHeader title="选择业务分类" :subtitle="direction === 'income' ? '收入分类' : '支出分类'" :right-text="canManage ? '新增' : ''" back @right="openCreate()" />

    <view class="lc-body">
      <view v-if="currentCategory" class="lc-current" :class="{ 'lc-current--muted': currentCategory.state !== 'active' }">
        <view class="lc-current__icon">
          <JzIcon :name="currentCategory.state === 'active' ? 'check-circle' : currentCategory.state === 'deleted' ? 'close' : 'file-text'" :size="30" :color="currentCategory.state === 'active' ? TOKEN_COLOR.primary : TOKEN_COLOR.text3" />
        </view>
        <view class="lc-current__main">
          <view class="lc-current__title-row">
            <text class="lc-current__eyebrow">当前分类</text>
            <text v-if="currentCategory.state === 'active'" class="lc-badge lc-badge--active">已选</text>
            <text v-else-if="currentCategory.state === 'deleted'" class="lc-badge lc-badge--muted">已停用</text>
            <text v-else class="lc-badge lc-badge--legacy">历史文本</text>
          </view>
          <text class="lc-current__name">{{ currentCategory.name }}</text>
          <text class="lc-current__path">{{ currentCategory.path }}</text>
        </view>
        <text class="lc-current__clear" @tap.stop="clearCurrent">清除</text>
      </view>

      <view v-if="currentCategory && currentCategory.state === 'legacyText'" class="lc-notice lc-notice--legacy">
        <JzIcon name="info" :size="24" :color="TOKEN_COLOR.warning" />
        <text>这是升级前录入的文本分类，现为「待关联」。请选择标准二级分类完成结构化关联，原文本仅作参考。</text>
      </view>
      <view v-else-if="currentCategory && currentCategory.state === 'deleted'" class="lc-notice lc-notice--muted">
        <JzIcon name="info" :size="24" :color="TOKEN_COLOR.text3" />
        <text>该分类已停用，历史流水仍保留原分类；新记账请选择其他可用分类。</text>
      </view>

      <view class="lc-search">
        <JzIcon name="search" :size="30" :color="TOKEN_COLOR.text4" />
        <input v-model="keyword" placeholder="搜索一级或二级分类" confirm-type="search" />
        <text v-if="keyword" class="lc-search__clear" @tap="keyword = ''">清除</text>
      </view>

      <view class="lc-toolbar">
        <text v-if="keyword">找到 {{ filteredRoots.length }} 个一级 · {{ filteredChildCount }} 个二级分类</text>
        <text v-else>共 {{ roots.length }} 个一级 · {{ totalChildCount }} 个二级分类</text>
      </view>

      <view class="lc-guide">
        <JzIcon name="info" :size="24" :color="TOKEN_COLOR.primary" />
        <text>点击一级分组展开二级，选择二级分类完成归类{{ canManage ? '；自定义分类支持新增、编辑和删除' : '' }}</text>
      </view>

      <PageState v-if="loadError && !categories.length" state="error" title="分类加载失败" :subtitle="loadError" @retry="load" />
      <JzSkeleton v-else-if="loadingCategories && !categories.length" :rows="4" />
      <template v-else>
        <view v-for="root in filteredRoots" :key="root.id" class="lc-group" :class="{ 'lc-group--selected': containsSelected(root) }">
          <view class="lc-group__head">
            <view class="lc-root-icon" :class="{ 'lc-root-icon--on': selectedId === root.id }">
              <JzIcon :name="selectedId === root.id ? 'check' : 'folder'" :size="28" :color="selectedId === root.id ? TOKEN_COLOR.white : TOKEN_COLOR.primary" />
            </view>
            <view class="lc-group__identity" @tap="choose(root)">
              <view class="lc-root-title">
                <text class="lc-node-name">{{ root.name }}</text>
                <text v-if="root.builtIn" class="lc-badge">标准</text>
                <text v-else class="lc-badge lc-badge--custom">自定义</text>
              </view>
              <text class="lc-root-meta">{{ hasChildren(root) ? `${(root.children || []).length} 个二级分类` : '可直接选择' }}</text>
            </view>
            <view v-if="canManage" class="lc-group__manage">
              <view class="lc-icon-btn" @tap.stop="openCreate(root)"><JzIcon name="plus" :size="24" :color="TOKEN_COLOR.primary" /></view>
              <template v-if="!root.builtIn">
                <view class="lc-icon-btn" @tap.stop="openEdit(root)"><JzIcon name="edit" :size="23" :color="TOKEN_COLOR.primary" /></view>
                <view class="lc-icon-btn lc-icon-btn--danger" @tap.stop="removeCategory(root)"><JzIcon name="trash" :size="23" :color="TOKEN_COLOR.danger" /></view>
              </template>
            </view>
            <view v-if="hasChildren(root)" class="lc-group__toggle" @tap.stop="toggleCollapse(root.id)">
              <JzIcon :name="isCollapsed(root.id) ? 'chevron-right' : 'chevron-down'" :size="25" :color="TOKEN_COLOR.text3" />
            </view>
          </view>

          <view v-if="hasChildren(root) && !isCollapsed(root.id)" class="lc-children">
            <view
              v-for="child in root.children"
              :key="child.id"
              class="lc-child"
              :class="{ 'lc-child--on': selectedId === child.id }"
              @tap="choose(root, child)"
            >
              <view class="lc-child__rail"></view>
              <view class="lc-child__dot"></view>
              <view class="lc-child__main">
                <view class="lc-child__title">
                  <text class="lc-node-name">{{ child.name }}</text>
                  <text v-if="child.builtIn" class="lc-badge lc-badge--system">标准</text>
                  <text v-else class="lc-badge lc-badge--custom">自定义</text>
                  <text v-if="selectedId === child.id" class="lc-badge lc-badge--active">已选</text>
                </view>
              </view>
              <view v-if="canManage" class="lc-child__actions">
                <view class="lc-icon-btn lc-icon-btn--small" @tap.stop="openEdit(child, true)"><JzIcon name="edit" :size="22" :color="TOKEN_COLOR.primary" /></view>
                <view class="lc-icon-btn lc-icon-btn--small lc-icon-btn--danger" @tap.stop="removeCategory(child, true)"><JzIcon name="trash" :size="22" :color="TOKEN_COLOR.danger" /></view>
              </view>
              <JzIcon v-else-if="selectedId === child.id" name="check" :size="26" :color="TOKEN_COLOR.primary" />
            </view>
          </view>
          <view v-else-if="hasChildren(root)" class="lc-group__folded" @tap="toggleCollapse(root.id)">
            <text>{{ (root.children || []).length }} 个二级分类已收起</text>
            <JzIcon name="chevron-down" :size="23" :color="TOKEN_COLOR.text3" />
          </view>
        </view>

        <JzEmpty v-if="!filteredRoots.length" text="没有匹配的分类" :sub="keyword ? '可以调整关键词，或新增企业自定义分类' : '可以新增一级分类开始整理业务'" />
      </template>
    </view>

    <JzSheet :visible="sheet" :title="sheetTitle" @close="sheet = false">
      <view class="lc-form">
        <view v-if="sheetMode === 'create'" class="lc-form__block">
          <text class="lc-form__label">新增到</text>
          <scroll-view scroll-x class="lc-form__scroll" :show-scrollbar="false">
            <view class="lc-form__chips">
              <view class="lc-form__chip" :class="{ 'lc-form__chip--on': !parentId }" @tap="parentId = ''">作为一级分类</view>
              <view v-for="root in roots" :key="root.id" class="lc-form__chip" :class="{ 'lc-form__chip--on': parentId === root.id }" @tap="parentId = root.id">{{ root.name }} 下</view>
            </view>
          </scroll-view>
          <text class="lc-form__meta">{{ parentId ? '将在所选一级分类下新增二级分类' : '将新增一个可直接选择的一级分类' }}</text>
        </view>
        <view class="lc-form__block">
          <text class="lc-form__label">分类名称</text>
          <input v-model="newName" maxlength="64" placeholder="如 展会费用" />
        </view>
        <view class="lc-form__hint">{{ sheetHint }}</view>
        <button class="jz-btn jz-btn--primary jz-btn--block" :disabled="saving || !newName.trim()" @tap="saveCategory">{{ saving ? '保存中…' : sheetSubmitText }}</button>
      </view>
    </JzSheet>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';

.lc-page { padding-bottom: calc(48rpx + #{$jzb-safe-bottom}); }
.lc-body { padding: 16rpx $jzb-page-pad 0; }

.lc-current {
  position: relative; display: flex; align-items: center; gap: 16rpx; margin-bottom: 18rpx; padding: 22rpx 20rpx 22rpx 24rpx;
  background: linear-gradient(135deg, $jzb-primary-lightest 0%, $jzb-bg-card 76%);
  border: 1rpx solid rgba(22, 163, 148, .2); border-left: 6rpx solid $jzb-primary; border-radius: $jzb-radius;
  box-shadow: $jzb-shadow-xs;
}
.lc-current--muted { background: $jzb-bg-card; border-color: $jzb-border-light; border-left-color: $jzb-text-4; }
.lc-current__icon { width: 64rpx; height: 64rpx; flex: none; display: flex; align-items: center; justify-content: center; background: $jzb-text-inverse; border-radius: $jzb-radius-sm; }
.lc-current__main { flex: 1; min-width: 0; }
.lc-current__title-row { display: flex; align-items: center; gap: 8rpx; }
.lc-current__eyebrow { color: $jzb-primary-deep; font-size: $jzb-font-xs; }
.lc-current__name { display: block; margin-top: 5rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 720; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.lc-current__path { display: block; margin-top: 5rpx; color: $jzb-text-3; font-size: $jzb-font-xs; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.lc-current__clear { flex: none; align-self: flex-start; padding: 8rpx 4rpx 8rpx 12rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }

.lc-notice { display: flex; align-items: flex-start; gap: 8rpx; margin: -4rpx 0 18rpx; padding: 16rpx 20rpx; border-radius: $jzb-radius-sm; font-size: $jzb-font-xs; line-height: 1.55; }
.lc-notice--legacy { color: $jzb-warning; background: $jzb-warning-soft; }
.lc-notice--muted { color: $jzb-text-3; background: $jzb-bg-hover; }

.lc-search { display: flex; align-items: center; gap: 14rpx; height: 84rpx; padding: 0 22rpx; background: $jzb-bg-card; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; box-shadow: $jzb-shadow-xs; }
.lc-search input { flex: 1; min-width: 0; font-size: $jzb-font-sm; }
.lc-search__clear { flex: none; padding: 12rpx 0 12rpx 12rpx; color: $jzb-primary; font-size: $jzb-font-xs; }

.lc-toolbar { display: flex; align-items: center; justify-content: space-between; min-height: 64rpx; padding: 0 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.lc-guide { display: flex; align-items: flex-start; gap: 8rpx; padding: 14rpx 18rpx; color: $jzb-text-3; background: $jzb-primary-lighter; border-radius: $jzb-radius-sm; font-size: 21rpx; line-height: 1.5; }

.lc-group { margin-top: 18rpx; background: $jzb-bg-card; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs; overflow: hidden; }
.lc-group--selected { border-color: rgba(22, 163, 148, .3); box-shadow: 0 0 0 3rpx rgba(22, 163, 148, .06), $jzb-shadow-xs; }
.lc-group__head { display: flex; align-items: center; min-height: 94rpx; padding: 16rpx 16rpx 16rpx 20rpx; background: linear-gradient(90deg, $jzb-primary-lightest 0%, $jzb-bg-card 78%); }
.lc-root-icon { width: 54rpx; height: 54rpx; flex: none; display: flex; align-items: center; justify-content: center; background: $jzb-text-inverse; border: 1rpx solid rgba(22, 163, 148, .16); border-radius: $jzb-radius-sm; }
.lc-root-icon--on { background: $jzb-primary; border-color: $jzb-primary; }
.lc-group__identity { flex: 1; min-width: 0; margin-left: 14rpx; padding: 4rpx 0; }
.lc-root-title { display: flex; align-items: center; gap: 8rpx; min-width: 0; }
.lc-node-name { min-width: 0; color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.lc-root-meta { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }

.lc-group__manage { flex: none; display: flex; align-items: center; gap: 6rpx; margin-left: 8rpx; }
.lc-icon-btn { width: 50rpx; height: 50rpx; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, .9); border: 1rpx solid $jzb-border-light; border-radius: 14rpx; }
.lc-icon-btn--small { width: 44rpx; height: 44rpx; border-radius: 12rpx; }
.lc-icon-btn--danger { border-color: rgba(229, 72, 77, .16); }
.lc-group__toggle { width: 48rpx; height: 54rpx; flex: none; display: flex; align-items: center; justify-content: center; }

.lc-children { position: relative; padding: 4rpx 20rpx 16rpx 26rpx; border-top: 1rpx solid $jzb-border-light; }
.lc-child { position: relative; display: flex; align-items: center; gap: 12rpx; min-height: 72rpx; padding: 8rpx 8rpx 8rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.lc-child:last-child { border-bottom: none; }
.lc-child__rail { position: absolute; left: 8rpx; top: -5rpx; bottom: -5rpx; width: 2rpx; background: $jzb-border; }
.lc-child:first-child .lc-child__rail { top: 36rpx; }
.lc-child:last-child .lc-child__rail { bottom: 36rpx; }
.lc-child__dot { position: relative; z-index: 1; width: 12rpx; height: 12rpx; flex: none; margin-left: 3rpx; background: $jzb-bg-card; border: 3rpx solid $jzb-primary-light; border-radius: 50%; }
.lc-child__main { flex: 1; min-width: 0; }
.lc-child__title { display: flex; align-items: center; gap: 8rpx; min-width: 0; }
.lc-child__actions { flex: none; display: flex; gap: 6rpx; }
.lc-child--on { margin: 0 -8rpx; padding-right: 16rpx; padding-left: 8rpx; background: $jzb-primary-lightest; border-radius: $jzb-radius-sm; }
.lc-child--on .lc-node-name { color: $jzb-primary-deep; }
.lc-group__folded { display: flex; align-items: center; justify-content: center; gap: 8rpx; min-height: 64rpx; color: $jzb-text-3; border-top: 1rpx solid $jzb-border-light; font-size: $jzb-font-xs; }

.lc-badge { flex: none; padding: 2rpx 10rpx; border-radius: $jzb-radius-pill; color: $jzb-primary-deep; background: $jzb-primary-lighter; font-size: 19rpx; line-height: 1.7; }
.lc-badge--system { color: $jzb-text-3; background: $jzb-bg-hover; }
.lc-badge--custom { color: $jzb-role-finance; background: $jzb-primary-lightest; }
.lc-badge--muted { color: $jzb-text-3; background: $jzb-bg-page; }
.lc-badge--legacy { color: $jzb-warning; background: $jzb-warning-soft; }
.lc-badge--active { color: $jzb-primary-deep; background: $jzb-primary-lighter; }

.lc-form__block { padding: 22rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.lc-form__label { display: block; margin-bottom: 14rpx; color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 600; }
.lc-form__block input { width: 100%; min-height: 54rpx; color: $jzb-text-1; font-size: $jzb-font; }
.lc-form__scroll { width: 100%; white-space: nowrap; }
.lc-form__chips { display: inline-flex; gap: 14rpx; }
.lc-form__chip { display: inline-flex; align-items: center; min-height: 60rpx; padding: 0 20rpx; color: $jzb-text-2; background: $jzb-bg-page; border: 1rpx solid transparent; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; }
.lc-form__chip--on { color: $jzb-primary-deep; background: $jzb-primary-lighter; border-color: rgba(22, 163, 148, .18); font-weight: 650; }
.lc-form__meta { display: block; margin-top: 12rpx; color: $jzb-text-3; font-size: 21rpx; }
.lc-form__hint { margin: 20rpx 0; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
</style>
