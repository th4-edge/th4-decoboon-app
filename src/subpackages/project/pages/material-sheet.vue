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
import FinanceStoreScope from '@/components/FinanceStoreScope.vue'
import { useFinanceStoreScope } from '@/composables/useFinanceStoreScope'

const projectId = ref('')
const projectName = ref('')
const isWorkbench = computed(() => !projectId.value)
const canCreate = computed(() => !!projectId.value && ['designer', 'boss', 'storeManager'].includes(String(session.role || '')))
const canViewSettlement = computed(() => ['finance', 'boss', 'storeManager'].includes(String(session.role || '')))
const canOrderSheet = computed(() => ['finance', 'boss', 'storeManager'].includes(String(session.role || '')))
const sheets = ref<MaterialOrderSheet[]>([])
const typeNames = ref<Record<string, string>>({})
const loading = ref(true)
const refreshing = ref(false)

/** 财务下单队列：已提交请购/核价中；旧直采路线已下线，统一从这里进入作业单下单。 */
const toOrder = computed(() => sheets.value.filter((item) => ['submitted', 'pricing'].includes(item.status)))
/** 设计师建单/测量阶段。 */
const drafting = computed(() => sheets.value.filter((item) => ['draft', 'measuring', 'measured'].includes(item.status)))
/** 已进入采购/到场/结算。 */
const advanced = computed(() => sheets.value.filter((item) =>
  !['draft', 'measuring', 'measured', 'submitted', 'pricing'].includes(item.status)))

onLoad((q) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  projectId.value = String(q?.projectId || '')
  projectName.value = decodeURIComponent(String(q?.projectName || ''))
})

onShow(() => { void load() })

async function load() {
  refreshing.value = true
  try {
    const [list] = await Promise.all([
      materialSheetApi.list(projectId.value ? { projectId: projectId.value } : {}),
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

function openOrder(sheet: MaterialOrderSheet) {
  uni.navigateTo({ url: `${P.materialSheetOrder}?sheetId=${sheet.id}` })
}

function openCreate() {
  if (!projectId.value) return
  uni.navigateTo({ url: `${P.materialSheetCreate}?projectId=${projectId.value}&projectName=${encodeURIComponent(projectName.value)}` })
}

function openSettlement() {
  uni.navigateTo({ url: P.financeMaterialSettlement })
}

function projectLine(sheet: MaterialOrderSheet) {
  return [sheet.projectName, sheet.propertyAddress].filter(Boolean).join(' · ')
}
useFinanceStoreScope(() => load())
</script>

<template>
  <view class="ms">
    <JzPageHeader :title="isWorkbench ? '主材下单工作台' : '主材下单'" :subtitle="isWorkbench ? '全公司待请购/待下单作业单；财务在 App 内直接下单与结算' : '按品类成单：设计师建单 → 项目经理测量确认 → 财务在 App 下单'" back />
    <FinanceStoreScope />

    <view v-if="loading" class="ms__hint">加载中…</view>
    <template v-else>
      <view v-if="!sheets.length" class="jz-card ms__empty-card">
        <JzEmpty :text="isWorkbench ? '当前没有待处理的主材作业单' : '还没有主材下单作业单'" :sub="isWorkbench ? '设计师提交请购后会进入财务下单队列' : '按品类新建：一张单对应一个厂家，含安装位置与测量、配送、安装时间'" />
      </view>

      <view v-if="toOrder.length" class="ms__section">
        <text class="ms__section-title">待财务下单</text>
        <view v-for="sheet in toOrder" :key="sheet.id" class="jz-card ms__item" @tap="openDetail(sheet)">
          <view class="ms__item-head">
            <text class="ms__item-title">{{ typeName(sheet.sheetType) }}</text>
            <view class="ms__item-tags">
              <JzTag v-if="sheet.priceState" :text="SHEET_PRICE_STATE_META[sheet.priceState].label" :color="SHEET_PRICE_STATE_META[sheet.priceState].color" />
              <JzTag :text="sheetStatusMeta(sheet.status).label" :color="sheetStatusMeta(sheet.status).color" />
            </view>
          </view>
          <view v-if="isWorkbench && projectLine(sheet)" class="ms__item-project">{{ projectLine(sheet) }}</view>
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
          <view v-if="canOrderSheet" class="ms__item-actions">
            <button class="jz-btn jz-btn--primary jz-btn--sm" @tap.stop="openOrder(sheet)">去下单</button>
          </view>
        </view>
      </view>

      <view v-if="drafting.length" class="ms__section">
        <text class="ms__section-title">建单/测量中</text>
        <view v-for="sheet in drafting" :key="sheet.id" class="jz-card ms__item" @tap="openDetail(sheet)">
          <view class="ms__item-head">
            <text class="ms__item-title">{{ typeName(sheet.sheetType) }}</text>
            <JzTag :text="sheetStatusMeta(sheet.status).label" :color="sheetStatusMeta(sheet.status).color" />
          </view>
          <view v-if="isWorkbench && projectLine(sheet)" class="ms__item-project">{{ projectLine(sheet) }}</view>
          <view class="ms__item-meta">
            <text class="ms__item-no">{{ sheet.no }}</text>
            <text class="ms__item-dot">·</text>
            <text>{{ sheet.items?.length || 0 }} 行</text>
            <text v-if="sheet.manufacturerName" class="ms__item-dot">·</text>
            <text v-if="sheet.manufacturerName">{{ sheet.manufacturerName }}</text>
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
          <view v-if="isWorkbench && projectLine(sheet)" class="ms__item-project">{{ projectLine(sheet) }}</view>
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
    <view v-else-if="isWorkbench && canViewSettlement" class="ms__footer">
      <button class="jz-btn jz-btn--ghost" @tap="openSettlement">打开主材结算</button>
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
.ms__item-project { margin-top: 8rpx; font-size: $jzb-font-xs; color: $jzb-text-2; }
.ms__item-actions { display: flex; justify-content: flex-end; margin-top: $jzb-space-3; }
.ms__item-no { font-variant-numeric: tabular-nums; }
.ms__item-dot { color: $jzb-text-4; }
.ms__item-times { display: flex; flex-wrap: wrap; gap: $jzb-space-3; margin-top: $jzb-space-3; font-size: $jzb-font-xs; color: $jzb-text-3; }
.ms__footer { position: sticky; bottom: 0; padding: $jzb-space-4 $jzb-page-pad; background: $jzb-bg-card; border-top: 1rpx solid $jzb-border-light; }
</style>
