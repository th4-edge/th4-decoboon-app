<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { isLoggedIn, session } from '@/domains/identity/session'
import { materialCategoryApi } from '@/domains/material/api'
import type { MaterialCategory } from '@/domains/material/model'
import { P } from '@/config'
import { toast, toastError } from '@/composables/toast'
import JzEmpty from '@/components/JzEmpty.vue'
import JzFloatAdd from '@/components/JzFloatAdd.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSheet from '@/components/JzSheet.vue'
import JzTag from '@/components/JzTag.vue'
import PageState from '@/components/PageState/PageState.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const categories = ref<MaterialCategory[]>([])
const loadingState = ref(true)
const loadError = ref('')
const saving = ref(false)
const editorOpen = ref(false)
const editingId = ref('')
const name = ref('')
const lossRate = ref('')

const canEdit = computed(() => ['boss', 'storeManager', 'finance'].includes((session.role || '') as string))

onShow(() => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  void load()
})
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  loadingState.value = true
  loadError.value = ''
  try {
    categories.value = await materialCategoryApi.list()
  } catch (error) {
    categories.value = []
    loadError.value = error instanceof Error ? error.message : '主材分类暂不可确认'
  } finally {
    loadingState.value = false
  }
}

function resetForm() {
  editingId.value = ''
  name.value = ''
  lossRate.value = ''
}

function openCreate() {
  if (!canEdit.value) return
  resetForm()
  editorOpen.value = true
}

function openEdit(item: MaterialCategory) {
  if (!canEdit.value) return
  editingId.value = item.id
  name.value = item.name
  lossRate.value = String(item.defaultLossRate ?? 0)
  editorOpen.value = true
}

function closeEditor() {
  if (saving.value) return
  editorOpen.value = false
  resetForm()
}

async function save() {
  if (!canEdit.value) return
  const normalized = name.value.trim()
  if (!normalized) { toast('请填写分类名称'); return }
  const rate = Number(lossRate.value || 0)
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) { toast('损耗率需在 0～100 之间'); return }
  if (saving.value) return
  saving.value = true
  try {
    await materialCategoryApi.save({ name: normalized, defaultLossRate: rate, active: true })
    toast('主材分类已保存', 'success')
    editorOpen.value = false
    resetForm()
    await load()
  } catch (error) {
    toastError(error, '主材分类保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <view class="mc">
    <JzPageHeader title="主材分类与损耗" subtitle="损耗率按分类设置，材料计划行自动继承（默认 0，不预置行业比例）"  back />
    <PageState v-if="loadingState && !categories.length && !loadError" state="loading" :rows="4" />
    <PageState v-else-if="loadError && !categories.length" state="error" title="主材分类暂不可确认" :subtitle="loadError" @retry="load" />
    <template v-else>
      <view class="mc__body">
        <JzEmpty v-if="!categories.length" text="暂无主材分类" sub="新增分类并设置损耗率后，材料计划行会自动继承" />
        <view v-for="item in categories" :key="item.id" class="jz-card mc__item">
          <view class="mc__item-head">
            <text class="mc__item-name jz-clamp-1">{{ item.name }}</text>
            <JzTag :text="`损耗 ${item.defaultLossRate ?? 0}%`" :color="item.defaultLossRate ? TOKEN_COLOR.warning : TOKEN_COLOR.text3" size="sm" />
          </view>
          <view v-if="item.remark" class="mc__item-remark jz-clamp-1">{{ item.remark }}</view>
          <view v-if="canEdit" class="mc__item-actions">
            <button class="jz-btn jz-btn--ghost jz-btn--sm" @tap="openEdit(item)"><JzIcon name="edit" :size="22" :color="TOKEN_COLOR.primary" /><text>修改</text></button>
          </view>
        </view>
      </view>
    </template>

    <JzFloatAdd v-if="canEdit" text="新增分类" @tap="openCreate" />

    <JzSheet :visible="editorOpen" :title="editingId ? '编辑分类' : '新增分类'" @close="closeEditor">
      <view class="mc__editor">
        <view class="mc__editor-field">
          <text class="mc__editor-label">分类名称 *</text>
          <input v-model="name" class="mc__input" placeholder="分类名称，如 瓷砖 / 地板 / 木门" />
        </view>
        <view class="mc__editor-field">
          <text class="mc__editor-label">默认损耗率 *</text>
          <input v-model="lossRate" class="mc__input jz-numeric-input" type="digit" placeholder="如 8 表示 8%" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
          <text class="mc__editor-tip">材料计划行自动继承该比例，默认 0；不预置行业比例。</text>
        </view>
        <view class="mc__editor-actions">
          <button class="jz-btn jz-btn--neutral jz-grow" :disabled="saving" @tap="closeEditor">取消</button>
          <button class="jz-btn jz-btn--primary jz-grow" :loading="saving" :disabled="saving" @tap="save">保存分类</button>
        </view>
      </view>
    </JzSheet>

    <view class="jz-tabbar-gap" />
  </view>
</template>

<style lang="scss" scoped>
.mc { min-height: 100vh; background: $jzb-bg-page; }
.mc__editor { display: flex; flex-direction: column; gap: $jzb-space-5; }
.mc__editor-field { display: flex; flex-direction: column; gap: $jzb-space-2; }
.mc__editor-label { color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 650; }
.mc__editor-tip { color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.mc__editor-actions { display: flex; gap: $jzb-space-3; margin-top: $jzb-space-1; }
.mc__input { height: 80rpx; padding: 0 $jzb-space-4; box-sizing: border-box; border: 1rpx solid transparent; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; font-size: $jzb-font-sm; color: $jzb-text-1; }
.mc__body { padding: 0 $jzb-page-pad; }
.mc__item { margin-bottom: $jzb-space-4; padding: $jzb-space-5; }
.mc__item-head { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; }
.mc__item-name { flex: 1; min-width: 0; font-size: $jzb-font-sm; font-weight: 650; }
.mc__item-remark { display: block; margin-top: 8rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.mc__item-actions { margin-top: $jzb-space-3; }
</style>
