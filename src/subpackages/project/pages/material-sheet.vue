<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { materialSheetApi, materialSheetEnumsApi } from '@/domains/material/api'
import { SHEET_PRICE_STATE_META, sheetStatusMeta } from '@/domains/material/meta'
import type { MaterialOrderSheet } from '@/domains/material/model'
import { toastError } from '@/composables/toast'
import JzEmpty from '@/components/JzEmpty.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzTag from '@/components/JzTag.vue'

const projectId = ref('')
const projectName = ref('')
const canCreate = computed(() => ['designer', 'boss', 'storeManager'].includes(String(session.role || '')))
const sheets = ref<MaterialOrderSheet[]>([])
const typeNames = ref<Record<string, string>>({})
const loading = ref(true)
const refreshing = ref(false)

/** 待推进的作业单（填写中/待测量/待下单）优先展示。 */
const pending = computed(() => sheets.value.filter((item) =>
  ['draft', 'measuring', 'measured', 'submitted', 'pricing'].includes(item.status)))
const advanced = computed(() => sheets.value.filter((item) =>
  !['draft', 'measuring', 'measured', 'submitted', 'pricing'].includes(item.status)))

onLoad((q) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  projectId.value = String(q?.projectId || '')
  projectName.value = decodeURIComponent(String(q?.projectName || ''))
})

onShow(() => { void load() })

async function load() {
  if (!projectId.value) { loading.value = false; return }
  refreshing.value = true
  try {
    const [list] = await Promise.all([
      materialSheetApi.list({ projectId: projectId.value }),
      materialSheetEnumsApi.load()
        .then((enums) => {
          typeNames.value = Object.fromEntries(enums.sheetTypes.map((item) => [item.code, item.name]))
        })
        .catch(() => { /* 品类名缺失时回退展示编码，不阻断列表 */ })
    ])
    sheets.value = list
  } catch (error) {
    toastError(error, '作业单加载失败')
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function typeName(code: string) {
  return typeNames.value[code] || code
}

function openDetail(sheet: MaterialOrderSheet) {
  uni.navigateTo({ url: `${P.materialSheetDetail}?sheetId=${sheet.id}` })
}

function openCreate() {
  uni.navigateTo({ url: `${P.materialSheetCreate}?projectId=${projectId.value}&projectName=${encodeURIComponent(projectName.value)}` })
}
</script>

<template>
  <view class="ms">
    <JzPageHeader title="主材下单" subtitle="按品类成单：设计师建单 → 项目经理测量确认 → 财务下单" back />

    <view v-if="loading" class="ms__hint">加载中…</view>
    <template v-else>
      <view v-if="!sheets.length" class="jz-card ms__empty-card">
        <JzEmpty text="还没有主材下单作业单" sub="按品类新建：一张单对应一个厂家，含安装位置与测量、配送、安装时间" />
      </view>

      <view v-if="pending.length" class="ms__section">
        <text class="ms__section-title">待推进</text>
        <view v-for="sheet in pending" :key="sheet.id" class="jz-card ms__item" @tap="openDetail(sheet)">
          <view class="ms__item-head">
            <text class="ms__item-title">{{ typeName(sheet.sheetType) }}</text>
            <JzTag :text="sheetStatusMeta(sheet.status).label" :color="sheetStatusMeta(sheet.status).color" />
          </view>
          <view class="ms__item-meta">
            <text class="ms__item-no">{{ sheet.no }}</text>
            <text class="ms__item-dot">·</text>
            <text>{{ sheet.items?.length || 0 }} 行</text>
            <text v-if="sheet.manufacturerName" class="ms__item-dot">·</text>
            <text v-if="sheet.manufacturerName">{{ sheet.manufacturerName }}</text>
          </view>
          <view class="ms__item-times">
            <text>测量 {{ sheet.measureAt || '待确认' }}</text>
            <text>配送 {{ sheet.deliverAt || '待确认' }}</text>
            <text>安装 {{ sheet.installAt || '待确认' }}</text>
          </view>
        </view>
      </view>

      <view v-if="advanced.length" class="ms__section">
        <text class="ms__section-title">已进入采购</text>
        <view v-for="sheet in advanced" :key="sheet.id" class="jz-card ms__item" @tap="openDetail(sheet)">
          <view class="ms__item-head">
            <text class="ms__item-title">{{ typeName(sheet.sheetType) }}</text>
            <view class="ms__item-tags">
              <JzTag v-if="sheet.priceState" :text="SHEET_PRICE_STATE_META[sheet.priceState].label" :color="SHEET_PRICE_STATE_META[sheet.priceState].color" />
              <JzTag :text="sheetStatusMeta(sheet.status).label" :color="sheetStatusMeta(sheet.status).color" />
            </view>
          </view>
          <view class="ms__item-meta">
            <text class="ms__item-no">{{ sheet.no }}</text>
            <text class="ms__item-dot">·</text>
            <text>{{ sheet.items?.length || 0 }} 行</text>
          </view>
        </view>
      </view>
    </template>

    <view v-if="canCreate" class="ms__footer">
      <button class="jz-btn jz-btn--primary" @tap="openCreate">新建品类作业单</button>
    </view>
    <view class="jz-tabbar-gap" />
  </view>
</template>

<style lang="scss" scoped>
.ms { min-height: 100vh; background: $jzb-bg-page; }
.ms__hint { padding: $jzb-space-5 $jzb-page-pad; font-size: $jzb-font-sm; color: $jzb-text-3; }
.ms__empty-card { margin: $jzb-space-4 $jzb-page-pad; padding: $jzb-space-5; }
.ms__section { padding: $jzb-space-4 $jzb-page-pad 0; }
.ms__section-title { display: block; margin-bottom: $jzb-space-3; font-size: $jzb-font-sm; font-weight: 650; color: $jzb-text-2; }
.ms__item { margin-bottom: $jzb-space-3; padding: $jzb-space-4; }
.ms__item-head { display: flex; align-items: center; justify-content: space-between; gap: $jzb-space-3; }
.ms__item-title { font-size: $jzb-font-md; font-weight: 650; color: $jzb-text-1; }
.ms__item-tags { display: flex; align-items: center; gap: $jzb-space-2; }
.ms__item-meta { display: flex; align-items: center; gap: 8rpx; margin-top: $jzb-space-2; font-size: $jzb-font-xs; color: $jzb-text-3; }
.ms__item-no { font-variant-numeric: tabular-nums; }
.ms__item-dot { color: $jzb-text-4; }
.ms__item-times { display: flex; flex-wrap: wrap; gap: $jzb-space-3; margin-top: $jzb-space-3; font-size: $jzb-font-xs; color: $jzb-text-3; }
.ms__footer { position: sticky; bottom: 0; padding: $jzb-space-4 $jzb-page-pad; background: $jzb-bg-card; border-top: 1rpx solid $jzb-border-light; }
</style>
