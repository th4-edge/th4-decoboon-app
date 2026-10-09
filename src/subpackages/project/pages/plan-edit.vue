<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import type { Zone } from '@/domains/base/model'
import type { Project, ProjectStage } from '@/domains/project/model'
import type { Task } from '@/domains/schedule/model'
import { projectApi } from '@/domains/project/api'
import { baseApi } from '@/domains/base/api'
import { scheduleApi } from '@/domains/schedule/api'
import JzIcon from '@/components/JzIcon.vue'
import JzSheet from '@/components/JzSheet.vue'
import JzDateRangeField from '@/components/JzDateRangeField/JzDateRangeField.vue'
import { toast, toastError, loading, hideLoading } from '@/composables/toast'

const projectId = ref('')
const project = ref<Project | null>(null)
const stages = ref<ProjectStage[]>([])
const zones = ref<Zone[]>([])
const tasks = ref<Task[]>([])
const keyword = ref('')

const stageId = ref('')
const requestedStageId = ref('')

const editingId = ref('')
const editZoneId = ref('')
const editStart = ref('')
const editEnd = ref('')

onLoad((q) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  projectId.value = q?.id || q?.projectId || ''
  requestedStageId.value = q?.stageId || ''
  load()
})

async function load() {
  const [p, st, zn, tk] = await Promise.all([
    projectApi.info(projectId.value),
    projectApi.stages(projectId.value),
    baseApi.zones(),
    scheduleApi.tasks(projectId.value).catch(() => [])
  ])
  project.value = p || null
  stages.value = [...st].sort((a, b) => a.sort - b.sort)
  zones.value = zn
  tasks.value = tk
  const requested = stages.value.find((s) => s.id === requestedStageId.value)
  const first = requested || stages.value.find((s) => s.status === 'todo' || s.status === 'doing') || stages.value[0]
  stageId.value = first?.id || ''
}

const stage = computed(() => stages.value.find((s) => s.id === stageId.value))

/**
 * 可选区域 = 系统空间枚举 ∪ 项目既有任务里的区域名。
 * 合同施工行带入的是自由文本区域（如「客餐厅」「主卧」），不在 SpaceType 枚举内。
 */
const zoneOptions = computed(() => {
  const list = zones.value.map((z) => ({ ...z }))
  const known = new Set(list.map((z) => z.name))
  for (const task of tasks.value) {
    const name = task.zone?.name || task.zone?.id
    if (name && !known.has(name)) {
      known.add(name)
      list.push({ id: name, name, sort: 900 })
    }
  }
  return list
})

/** 当前阶段的施工任务：来源只能是本项目合同施工行或已生效增减项（服务端强校验）。 */
const stageTasks = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  return tasks.value
    .filter((t) => t.stageId === stageId.value)
    .filter((t) => !k || `${t.name} ${t.craft || ''} ${t.spec || ''} ${t.zone?.name || ''}`.toLowerCase().includes(k))
})

const pendingCount = computed(() => tasks.value.filter((t) => t.status === 'todo').length)

const editingTask = computed(() => tasks.value.find((t) => t.id === editingId.value) || null)
const invalidScheduleRange = computed(() => Boolean(editStart.value && editEnd.value && editEnd.value < editStart.value))

function onStage(i: number) {
  stageId.value = stages.value[i].id
  editingId.value = ''
}

function beginEdit(task: Task) {
  editingId.value = task.id
  editZoneId.value = task.zone?.name || task.zone?.id || ''
  editStart.value = task.plannedStart || stage.value?.plannedStart || ''
  editEnd.value = task.plannedEnd || stage.value?.plannedEnd || ''
}

function cancelEdit() {
  editingId.value = ''
}

async function saveEdit(task: Task) {
  if (!editZoneId.value) { toast('请选择施工区域'); return }
  if (!editStart.value || !editEnd.value) { toast('请选择计划起止日期'); return }
  if (editEnd.value < editStart.value) { toast('计划完工不能早于计划开工'); return }
  loading('保存排期中…')
  try {
    const zone = zoneOptions.value.find((z) => z.id === editZoneId.value || z.name === editZoneId.value)
    await scheduleApi.saveTask({
      id: task.id,
      projectId: projectId.value,
      stageId: stageId.value,
      zone: zone ? { ...zone, name: zone.name } : { id: editZoneId.value, name: editZoneId.value, sort: 0 },
      plannedStart: editStart.value,
      plannedEnd: editEnd.value
    })
    hideLoading()
    toast('排期已保存', 'success')
    editingId.value = ''
    await refresh()
  } catch (error) {
    hideLoading()
    toastError(error, '保存失败')
  }
}

async function refresh() {
  tasks.value = await scheduleApi.tasks(projectId.value).catch(() => tasks.value)
}
</script>

<template>
  <view class="pe" v-if="project">
    <view class="pe__ctx jz-card">
      <view class="jz-between">
        <text class="pe__ctx-name">{{ project.name }}</text>
        <text class="pe__ctx-tip">签约后 · 施工任务排期</text>
      </view>
      <text class="pe__ctx-sub">本项目施工任务来自合同施工行与已生效增减项。排期只调整施工阶段、区域与计划起止；数量与金额以合同为准，变更请走增减项。</text>
    </view>

    <scroll-view scroll-x class="pe__chips" :show-scrollbar="false">
      <view class="pe__chips-row">
        <view v-for="s in stages" :key="s.id" class="pe__chip" :class="{ 'pe__chip--on': stageId === s.id }" @tap="onStage(stages.indexOf(s))">
          <text class="pe__chip-name">{{ s.name }}</text>
          <text class="pe__chip-date">{{ (s.plannedStart || '').slice(5) }}~{{ (s.plannedEnd || '').slice(5) }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="pe__search jz-card">
      <view class="pe__search-icon"><JzIcon name="search" :size="32" :color="TOKEN_COLOR.text3" /></view>
      <input v-model="keyword" placeholder="搜索任务名称/工艺/区域" />
    </view>

    <view class="jz-section">
      <text class="jz-section__title">本项目施工任务（{{ stageTasks.length }}）</text>
      <text class="jz-section__more">待排期 {{ pendingCount }} 项</text>
    </view>

    <view class="pe__lib">
      <view v-for="task in stageTasks" :key="task.id" class="jz-card pe__lib-item">
        <view class="jz-between">
          <view class="jz-grow">
            <view class="jz-row">
              <text class="pe__lib-name">{{ task.name }}</text>
              <text v-if="task.conceal" class="pe__lib-conceal">需隐蔽验收</text>
            </view>
            <text class="pe__lib-craft">区域：{{ task.zone?.name || task.zone?.id || '未指定' }} · 数量：{{ task.quantity ?? '-' }} {{ task.unit || '' }}</text>
            <text class="pe__lib-spec">计划：{{ task.plannedStart || '未排' }} ~ {{ task.plannedEnd || '未排' }}</text>
          </view>
          <view class="pe__add" @tap="beginEdit(task)">
            <JzIcon name="edit" :size="24" :color="TOKEN_COLOR.primary" />
            <text>调整</text>
          </view>
        </view>

      </view>
      <view v-if="!stageTasks.length" class="jz-card">
        <view class="pe__empty">本阶段暂无施工任务。任务只能来自本项目报价/合同施工行或已生效增减项，请检查报价/合同或发起增减项。</view>
      </view>
    </view>

    <JzSheet :visible="Boolean(editingTask)" title="调整施工排期" @close="cancelEdit">
      <view v-if="editingTask" class="pe__sheet">
        <view class="pe__sheet-task">
          <view class="jz-between">
            <text class="pe__sheet-task-name">{{ editingTask.name }}</text>
            <text v-if="editingTask.conceal" class="pe__sheet-conceal">隐蔽验收</text>
          </view>
          <text class="pe__sheet-task-meta">{{ stage?.name || '当前阶段' }} · 合同数量 {{ editingTask.quantity ?? '-' }} {{ editingTask.unit || '' }}</text>
        </view>

        <view class="pe__sheet-block">
          <view class="pe__sheet-block-head">
            <text class="pe__sheet-block-title">施工区域</text>
            <text class="pe__sheet-block-tip">按现场施工归属选择</text>
          </view>
          <view class="pe__zone-grid">
            <view
              v-for="z in zoneOptions"
              :key="z.id"
              class="pe__zone"
              :class="{ 'pe__zone--on': editZoneId === z.id || editZoneId === z.name }"
              @tap="editZoneId = z.id"
            >{{ z.name }}</view>
          </view>
        </view>

        <view class="pe__sheet-block">
          <JzDateRangeField
            v-model:start="editStart"
            v-model:end="editEnd"
            start-label="计划开工"
            end-label="计划完工"
            :max="stage?.plannedEnd || ''"
          />
        </view>

        <view class="pe__sheet-note">
          <JzIcon name="info" :size="28" :color="TOKEN_COLOR.text3" />
          <text>只调整施工阶段、区域和计划起止；合同数量与金额不变。</text>
        </view>

        <view class="pe__sheet-actions">
          <button class="jz-btn jz-btn--plain jz-grow" @tap="cancelEdit">取消</button>
          <button class="jz-btn jz-btn--primary jz-grow" :disabled="invalidScheduleRange" @tap="saveEdit(editingTask)">保存排期</button>
        </view>
      </view>
    </JzSheet>
  </view>
</template>

<style lang="scss" scoped>
.pe { padding-bottom: 180rpx; }
.pe__ctx { margin: 24rpx; padding: 26rpx; }
.pe__ctx-name { font-size: $jzb-font-lg; font-weight: 700; }
.pe__ctx-tip { font-size: $jzb-font-xs; color: $jzb-primary-dark; background: $jzb-primary-lighter; padding: 4rpx 16rpx; border-radius: $jzb-radius-pill; }
.pe__ctx-sub { display: block; margin-top: 12rpx; font-size: $jzb-font-sm; color: $jzb-text-3; line-height: 1.6; }
.pe__chips { width: 100%; white-space: nowrap; background: $jzb-text-inverse; box-shadow: $jzb-shadow-xs; }
.pe__chips-row { display: inline-flex; padding: 16rpx $jzb-page-pad; }
.pe__chip { display: inline-flex; flex-direction: column; align-items: center; padding: 12rpx 24rpx; margin-right: 12rpx; background: $jzb-bg-page; border-radius: $jzb-radius; }
.pe__chip--on { background: $jzb-primary; }
.pe__chip--on .pe__chip-name, .pe__chip--on .pe__chip-date { color: $jzb-text-inverse; }
.pe__chip-name { font-size: $jzb-font-sm; font-weight: 600; color: $jzb-text-1; }
.pe__chip-date { font-size: 18rpx; color: $jzb-text-3; margin-top: 2rpx; }
.pe__zone-row { display: flex; flex-direction: row; align-items: center; margin: 20rpx $jzb-page-pad 0; }
.pe__zone-label { font-size: $jzb-font-sm; color: $jzb-text-3; margin-right: 16rpx; flex-shrink: 0; }
.pe__zones { flex: 1; white-space: nowrap; }
.pe__zones-row { display: inline-flex; }
.pe__zone { padding: 8rpx 22rpx; margin-right: 12rpx; background: $jzb-text-inverse; border: 1rpx solid $jzb-border; border-radius: $jzb-radius-pill; font-size: $jzb-font-sm; color: $jzb-text-2; }
.pe__zone--on { background: $jzb-primary-lighter; border-color: $jzb-primary; color: $jzb-primary-dark; font-weight: 600; }
.pe__search { margin: 16rpx $jzb-page-pad; display: flex; flex-direction: row; align-items: center; padding: 0 24rpx; height: 72rpx; }
.pe__search-icon { font-size: 28rpx; margin-right: 12rpx; opacity: 0.6; }
.pe__search input { flex: 1; font-size: $jzb-font; }
.pe__lib { padding: 0 $jzb-page-pad; }
.pe__lib-item { padding: 22rpx 24rpx; margin-bottom: 16rpx; }
.pe__lib-code { font-size: $jzb-font-xs; color: $jzb-text-inverse; background: $jzb-primary; border-radius: 6rpx; padding: 2rpx 10rpx; margin-right: 12rpx; }
.pe__lib-name { font-size: $jzb-font-md; font-weight: 600; }
.pe__lib-conceal { font-size: 18rpx; color: $jzb-warning; border: 1rpx solid rgba(255,125,0,0.5); border-radius: $jzb-radius-pill; padding: 0 10rpx; margin-left: 12rpx; }
.pe__add--dispatched { color: $jzb-text-4; background: $jzb-bg-page; }
.pe__add--dispatched text { color: $jzb-text-4; }
.pe__add { background: $jzb-primary-lighter; color: $jzb-primary-dark; font-size: $jzb-font-sm; font-weight: 600; padding: 8rpx 22rpx; border-radius: $jzb-radius-pill; }
.pe__lib-craft, .pe__lib-spec { display: block; margin-top: 10rpx; font-size: $jzb-font-xs; color: $jzb-text-2; line-height: 1.6; }
.pe__lib-foot { margin-top: 12rpx; }
.pe__lib-meta { font-size: 18rpx; color: $jzb-text-4; }
.pe__empty { text-align: center; color: $jzb-text-3; padding: 40rpx 0; font-size: $jzb-font-sm; }
.pe__basket-card { margin: 0 $jzb-page-pad; padding: 6rpx 24rpx; }
.pe__basket-row { display: flex; flex-direction: row; align-items: center; padding: 20rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.pe__basket-name { font-size: $jzb-font; font-weight: 600; }
.pe__basket-zone { font-size: $jzb-font-xs; color: $jzb-text-3; margin-left: 14rpx; }
.pe__basket-unit { display: block; margin-top: 4rpx; font-size: $jzb-font-xs; color: $jzb-text-4; }
.pe__stepper { display: flex; flex-direction: row; align-items: center; margin-left: 16rpx; }
.pe__step-btn { width: 48rpx; height: 48rpx; border: 1rpx solid $jzb-border; border-radius: 12rpx; display: flex; align-items: center; justify-content: center; }
.pe__step-val { min-width: 56rpx; text-align: center; font-weight: 700; }
.pe__basket-del { display: flex; align-items: center; justify-content: center; margin-left: 12rpx; padding: 6rpx; }
.pe__save-tip { font-size: $jzb-font-sm; color: $jzb-text-3; white-space: nowrap; }
.pe__saved-tip { text-align: center; color: $jzb-success; font-size: $jzb-font-xs; padding: 12rpx 0 30rpx; }

.pe__sheet { display: flex; flex-direction: column; gap: 26rpx; padding-bottom: 8rpx; }
.pe__sheet-task { padding: 22rpx 24rpx; background: $jzb-primary-lighter; border-radius: $jzb-radius; }
.pe__sheet-task-name { font-size: $jzb-font-lg; font-weight: 700; color: $jzb-text-1; }
.pe__sheet-task-meta { display: block; margin-top: 10rpx; font-size: $jzb-font-sm; color: $jzb-text-2; line-height: 1.5; }
.pe__sheet-conceal { flex-shrink: 0; margin-left: 16rpx; padding: 4rpx 12rpx; color: $jzb-warning; background: $jzb-warning-soft; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; }
.pe__sheet-block { padding: 0 2rpx; }
.pe__sheet-block-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16rpx; }
.pe__sheet-block-title { font-size: $jzb-font-md; font-weight: 700; color: $jzb-text-1; }
.pe__sheet-block-tip { font-size: $jzb-font-xs; color: $jzb-text-3; }
.pe__zone-grid { display: flex; flex-wrap: wrap; gap: 12rpx; }
.pe__zone-grid .pe__zone { margin: 0; padding: 12rpx 22rpx; }
.pe__sheet-note { display: flex; align-items: flex-start; gap: 10rpx; padding: 18rpx 20rpx; background: $jzb-bg-page; border-radius: $jzb-radius-sm; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.pe__sheet-actions { position: sticky; bottom: 0; display: flex; gap: 16rpx; padding-top: 14rpx; background: $jzb-bg-card; }
</style>
