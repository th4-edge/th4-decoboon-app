<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import { materialApi, materialSheetApi, materialSheetEnumsApi } from '@/domains/material/api'
import { SHEET_UNIT_OPTIONS } from '@/domains/material/model'
import type { MaterialPlan } from '@/domains/material/model'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzEmpty from '@/components/JzEmpty.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

interface DraftLine {
  materialPlanId: string
  name: string
  spaceName: string
  locationName: string
  brand: string
  model: string
  spec: string
  color: string
  size: string
  quantity: string
  unit: string
}

const projectId = ref('')
const projectName = ref('')
const sheetId = ref('')
const sheetTypes = ref<{ code: string; name: string }[]>([])
const typeIdx = ref(0)
const manufacturerName = ref('')
const groupChatAt = ref('')
const installAt = ref('')
const remark = ref('')
const plans = ref<MaterialPlan[]>([])
const lines = ref<DraftLine[]>([])
const loadingState = ref(true)
const saving = ref(false)

const editing = computed(() => !!sheetId.value)
const currentType = computed(() => sheetTypes.value[typeIdx.value])
const availablePlans = computed(() => {
  const chosen = new Set(lines.value.map((line) => line.materialPlanId))
  return plans.value.filter((plan) => !chosen.has(plan.id))
})

onLoad(async (q) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  projectId.value = String(q?.projectId || '')
  projectName.value = decodeURIComponent(String(q?.projectName || ''))
  sheetId.value = String(q?.sheetId || '')
  await load()
})

async function load() {
  loadingState.value = true
  try {
    const [enums, planList] = await Promise.all([
      materialSheetEnumsApi.load(),
      projectId.value ? materialApi.plans(projectId.value) : Promise.resolve([] as MaterialPlan[])
    ])
    sheetTypes.value = enums.sheetTypes
    // 建单页只需要选择器字段，避免把带合同/客户关联的完整计划树一次性 setData 到页面。
    plans.value = planList.map((plan) => ({
      id: plan.id,
      name: plan.name,
      brand: plan.brand,
      spec: plan.spec,
      quantity: plan.quantity,
      unit: plan.unit
    } as MaterialPlan))
    if (editing.value) {
      const sheet = await materialSheetApi.info(sheetId.value)
      projectId.value = sheet.projectId || projectId.value
      projectName.value = sheet.projectName || projectName.value
      typeIdx.value = Math.max(0, sheetTypes.value.findIndex((item) => item.code === sheet.sheetType))
      manufacturerName.value = sheet.manufacturerName || ''
      installAt.value = sheet.installAt || ''
      groupChatAt.value = sheet.groupChatAt || ''
      remark.value = sheet.remark || ''
      lines.value = sheet.items.map((item) => ({
        materialPlanId: item.materialPlanId,
        name: item.materialName || '材料',
        spaceName: item.spaceName || '',
        locationName: item.locationName || '',
        brand: item.brand || '',
        model: item.model || '',
        spec: item.spec || '',
        color: item.color || '',
        size: item.size || '',
        quantity: String(item.quantity || ''),
        unit: item.unit || 'Sheet'
      }))
    }
  } catch (error) {
    toastError(error, '建单资料加载失败')
  } finally {
    loadingState.value = false
  }
}

function pickType(name: string) {
  const index = sheetTypes.value.findIndex((item) => item.name === name)
  if (index >= 0) typeIdx.value = index
}

function addPlan(plan: MaterialPlan) {
  lines.value.push({
    materialPlanId: plan.id,
    name: plan.name,
    spaceName: '',
    locationName: '',
    brand: plan.brand || '',
    model: '',
    spec: plan.spec || '',
    color: '',
    size: '',
    quantity: String(plan.quantity || ''),
    unit: SHEET_UNIT_OPTIONS.find((item) => item.label === plan.unit)?.value || 'Sheet'
  })
}

function removeLine(index: number) {
  lines.value.splice(index, 1)
}

function pickUnit(line: DraftLine, label: string) {
  const option = SHEET_UNIT_OPTIONS.find((item) => item.label === label)
  if (option) line.unit = option.value
}

function unitLabel(value: string) {
  return SHEET_UNIT_OPTIONS.find((item) => item.value === value)?.label || value
}

async function save(submitAfterSave: boolean) {
  if (saving.value) return
  const type = currentType.value
  if (!type) { toast('请选择品类'); return }
  if (!lines.value.length) { toast('请至少选择一条材料'); return }
  for (const line of lines.value) {
    if (!line.locationName.trim()) { toast(`「${line.name}」请填写安装位置`); return }
    if (Number(line.quantity || 0) <= 0) { toast(`「${line.name}」数量必须大于 0`); return }
  }
  saving.value = true
  loading(submitAfterSave ? '保存并提交请购…' : '保存作业单…')
  try {
    const payload = {
      projectId: projectId.value,
      sheetType: type.code,
      manufacturerName: manufacturerName.value.trim() || undefined,
      groupChatAt: groupChatAt.value || undefined,
      installAt: installAt.value || undefined,
      remark: remark.value.trim() || undefined,
      items: lines.value.map((line) => ({
        materialPlanId: line.materialPlanId,
        locationName: line.locationName.trim(),
        spaceName: line.spaceName || undefined,
        materialName: line.name,
        brand: line.brand || undefined,
        model: line.model.trim() || undefined,
        spec: line.spec || undefined,
        color: line.color.trim() || undefined,
        size: line.size.trim() || undefined,
        quantity: Number(line.quantity || 0),
        unit: line.unit
      }))
    }
    const sheet = editing.value
      ? await materialSheetApi.update({ sheetId: sheetId.value, ...payload })
      : await materialSheetApi.save(payload)
    if (submitAfterSave) {
      await materialSheetApi.submit(sheet.id)
      toast('已提交请购，等待材料员/财务下单', 'success')
    } else {
      toast('已保存作业单', 'success')
    }
    setTimeout(() => {
      uni.redirectTo({ url: `${P.materialSheetDetail}?sheetId=${sheet.id}` })
    }, 400)
  } catch (error) {
    toastError(error, submitAfterSave ? '提交失败' : '保存失败')
  } finally {
    hideLoading()
    saving.value = false
  }
}
</script>

<template>
  <view class="msc">
    <JzPageHeader :title="editing ? '编辑作业单' : '新建作业单'" subtitle="一个品类一张单；材料只能来自合同选材或增减项" back />
    <view v-if="loadingState" class="msc__hint">加载中…</view>
    <template v-else>
      <view class="jz-card msc__guide">
        <view class="msc__guide-row">
          <JzIcon name="package" :size="28" :color="TOKEN_COLOR.primary" />
          <view class="jz-grow"><text class="msc__guide-title">材料行只能来自材料计划</text><text class="msc__guide-text">先完成选材确认；合同外或标配外主材必须先走增减项，不能在本单直接新增。</text></view>
        </view>
        <view class="msc__guide-row">
          <JzIcon name="ruler" :size="28" :color="TOKEN_COLOR.primary" />
          <view class="jz-grow"><text class="msc__guide-title">现场字段按品类模板显示</text><text class="msc__guide-text">测量、配送、安装等字段由当前品类模板决定；标 * 的必填项缺失时不能提交请购。</text></view>
        </view>
        <view class="msc__guide-row">
          <JzIcon name="wallet" :size="28" :color="TOKEN_COLOR.primary" />
          <view class="jz-grow"><text class="msc__guide-title">作业单不承载价格</text><text class="msc__guide-text">价格、供应商和账期由财务在采购单侧决定；未定价下单会形成暂估应付，成本保持不完整。</text></view>
        </view>
      </view>

      <view class="jz-card msc__card">
        <view class="msc__field">
          <text class="msc__label">品类</text>
          <JzSelectField
            variant="boxed"
            :display="currentType?.name || ''"
            :range="sheetTypes.map(item => item.name)"
            :index="typeIdx"
            placeholder="请选择品类"
            :disabled="editing"
            @change="pickType"
          />
        </view>
        <view class="msc__field">
          <text class="msc__label">厂家</text>
          <input v-model="manufacturerName" class="msc__input" placeholder="如：诗尔曼 / 志邦（可后补）" placeholder-class="jz-number-placeholder" />
        </view>
        <view class="msc__field">
          <text class="msc__label">拉群时间</text>
          <JzSelectField mode="date" variant="boxed" :value="groupChatAt" :display="groupChatAt" placeholder="选择日期（可不填）" @change="groupChatAt = $event" />
        </view>
        <view class="msc__field">
          <text class="msc__label">安装时间</text>
          <JzSelectField mode="date" variant="boxed" :value="installAt" :display="installAt" placeholder="选择日期（可不填）" @change="installAt = $event" />
        </view>
        <view class="msc__field msc__field--column">
          <text class="msc__label">备注</text>
          <textarea v-model="remark" class="msc__textarea" placeholder="现场补充条件，如：未加损耗 / 含退补货" />
        </view>
      </view>

      <view class="msc__section">
        <text class="msc__section-title">已选材料（{{ lines.length }} 行）</text>
        <JzEmpty v-if="!lines.length" text="还没有选择材料" sub="从下方「合同主材」中勾选，将自动带出空间与参考规格" />
        <view v-for="(line, index) in lines" :key="line.materialPlanId" class="jz-card msc__line">
          <view class="msc__line-head">
            <text class="msc__line-name jz-clamp-2">{{ line.name }}</text>
            <text class="msc__line-remove" @tap="removeLine(index)">移除</text>
          </view>
          <view class="msc__line-grid">
            <input v-model="line.locationName" class="msc__input" placeholder="安装位置（如：客厅地砖）" />
            <input v-model="line.model" class="msc__input" placeholder="型号" />
            <input v-model="line.color" class="msc__input" placeholder="颜色/花色" />
            <input v-model="line.size" class="msc__input" placeholder="尺寸（如：800*800）" />
            <view class="msc__line-qty">
              <input v-model="line.quantity" class="msc__input jz-numeric-input" type="digit" placeholder="数量" placeholder-class="jz-number-placeholder" placeholder-style="text-align: right" />
              <JzSelectField
                variant="boxed"
                :display="unitLabel(line.unit)"
                :range="SHEET_UNIT_OPTIONS.map(item => item.label)"
                :index="Math.max(0, SHEET_UNIT_OPTIONS.findIndex(item => item.value === line.unit))"
                @change="pickUnit(line, $event)"
              />
            </view>
          </view>
        </view>
      </view>

      <view v-if="availablePlans.length" class="msc__section">
        <text class="msc__section-title">合同主材（可加入）</text>
        <view v-for="plan in availablePlans" :key="plan.id" class="jz-card msc__plan" @tap="addPlan(plan)">
          <view class="msc__plan-head">
            <text class="msc__plan-name jz-clamp-2">{{ plan.name }}</text>
            <text class="msc__plan-add">加入</text>
          </view>
          <view class="msc__plan-meta">
            <text v-if="plan.brand">{{ plan.brand }}</text>
            <text v-if="plan.spec">{{ plan.spec }}</text>
            <text>{{ plan.quantity }}{{ plan.unit }}</text>
          </view>
        </view>
      </view>

      <view class="msc__footer">
        <button class="jz-btn jz-btn--ghost" :disabled="saving" @tap="save(false)">保存草稿</button>
        <button class="jz-btn jz-btn--primary" :disabled="saving" @tap="save(true)">保存并提交请购</button>
      </view>
    </template>
    <view class="jz-tabbar-gap" />
  </view>
</template>

<style lang="scss" scoped>
.msc { min-height: 100vh; background: $jzb-bg-page; }
.msc__hint { padding: $jzb-space-5 $jzb-page-pad; font-size: $jzb-font-sm; color: $jzb-text-3; }
.msc__card { display: flex; flex-direction: column; gap: $jzb-space-4; margin: $jzb-space-4 $jzb-page-pad; padding: $jzb-space-5; }
.msc__guide { display: flex; flex-direction: column; gap: 18rpx; margin: $jzb-space-4 $jzb-page-pad 0; padding: $jzb-space-4; }
.msc__guide-row { display: flex; align-items: flex-start; gap: 14rpx; }
.msc__guide-title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.msc__guide-text { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.55; }
.msc__field { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; }
.msc__field--column { flex-direction: column; align-items: stretch; gap: $jzb-space-2; }
.msc__label { font-size: $jzb-font-sm; color: $jzb-text-2; }
.msc__input { flex: 1; min-width: 0; height: 68rpx; padding: 0 $jzb-space-3; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; font-size: $jzb-font-sm; }
.msc__textarea { width: 100%; height: 120rpx; min-height: 120rpx; padding: $jzb-space-2 $jzb-space-3; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; font-size: $jzb-font-sm; line-height: 1.5; }
.msc__section { padding: 0 $jzb-page-pad; }
.msc__section-title { display: block; margin: $jzb-space-3 0; font-size: $jzb-font-sm; font-weight: 650; color: $jzb-text-2; }
.msc__line { margin-bottom: $jzb-space-3; padding: $jzb-space-4; }
.msc__line-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $jzb-space-3; }
.msc__line-name { flex: 1; min-width: 0; font-size: $jzb-font-sm; font-weight: 650; }
.msc__line-remove { font-size: $jzb-font-xs; color: $jzb-text-3; }
.msc__line-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $jzb-space-2; margin-top: $jzb-space-3; }
.msc__line-grid > .msc__input:first-child { grid-column: 1 / -1; }
.msc__line-qty { display: flex; align-items: center; gap: 8rpx; min-width: 0; }
.msc__plan { margin-bottom: $jzb-space-3; padding: $jzb-space-4; }
.msc__plan-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $jzb-space-3; }
.msc__plan-name { flex: 1; min-width: 0; font-size: $jzb-font-sm; font-weight: 600; }
.msc__plan-add { font-size: $jzb-font-xs; color: $jzb-primary; }
.msc__plan-meta { display: flex; flex-wrap: wrap; gap: $jzb-space-3; margin-top: $jzb-space-2; font-size: $jzb-font-xs; color: $jzb-text-3; }
.msc__footer { position: sticky; bottom: 0; display: flex; align-items: center; gap: $jzb-space-3; padding: $jzb-space-4 $jzb-page-pad; background: $jzb-bg-card; border-top: 1rpx solid $jzb-border-light; }
.msc__footer .jz-btn { flex: 1; }
</style>
