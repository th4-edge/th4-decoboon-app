<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import type { CraftTask, Zone } from '@/domains/base/model'
import type { Project, ProjectStage } from '@/domains/project/model'
import type { Task } from '@/domains/schedule/model'
import { projectApi } from '@/domains/project/api'
import { baseApi } from '@/domains/base/api'
import { scheduleApi } from '@/domains/schedule/api'
import JzIcon from '@/components/JzIcon.vue'
import { toast, toastError, loading, hideLoading, confirm } from '@/composables/toast'

const projectId = ref('')
const project = ref<Project | null>(null)
const stages = ref<ProjectStage[]>([])
const zones = ref<Zone[]>([])
const allCraft = ref<CraftTask[]>([])
const existingTasks = ref<Task[]>([])
const keyword = ref('')

const stageId = ref('')
const zoneId = ref('')
const selected = ref<{ ct: CraftTask; zone: Zone; qty: number }[]>([])
const savedCount = ref(0)
const requestedStageId = ref('')

onLoad((q) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  projectId.value = q?.id || q?.projectId || ''
  requestedStageId.value = q?.stageId || ''
  load()
})
async function load() {
  const [p, st, zn, ct, tk] = await Promise.all([
    projectApi.info(projectId.value), projectApi.stages(projectId.value),
    baseApi.zones(), baseApi.craftCatalog(), scheduleApi.tasks(projectId.value).catch(() => [])
  ])
  project.value = p || null
  existingTasks.value = tk
  stages.value = [...st].sort((a, b) => a.sort - b.sort)
  zones.value = zn
  allCraft.value = ct
  const requested = stages.value.find((s) => s.id === requestedStageId.value)
  const first = requested || stages.value.find((s) => s.status === 'todo' || s.status === 'doing') || stages.value[0]
  stageId.value = first?.id || ''
  applyZone()
}

const stage = computed(() => stages.value.find((s) => s.id === stageId.value))
/**
 * 可选区域 = 系统空间枚举 ∪ 项目既有任务里的区域名。
 * 合同施工行带入的是自由文本区域（如「客餐厅」「主卧」），不在 SpaceType 枚举内；
 * 若只给枚举区域，设计师既看不到既有区域，也无法据此去重（BUG-ZONE-DICT-MISMATCH）。
 */
const zoneOptions = computed(() => {
  const list = zones.value.map((z) => ({ ...z }))
  const known = new Set(list.map((z) => z.name))
  for (const task of existingTasks.value) {
    const name = task.zone?.name || task.zone?.id
    if (name && !known.has(name)) {
      known.add(name)
      list.push({ id: name, name, sort: 900 })
    }
  }
  return list
})
/** 当前阶段可落位的区域（取该阶段工艺库覆盖的区域，保证可选项都有任务） */
const enumZoneIds = computed(() => new Set(zones.value.map((z) => z.id)))
const stageZones = computed(() => {
  const ids = new Set(allCraft.value
    .filter((c) => !c.defaultStageId || c.defaultStageId === stageId.value)
    .flatMap((c) => c.zoneIds))
  // 既有任务的区域名（非系统枚举）始终保留，保证可以选中并做去重
  return zoneOptions.value.filter((z) => ids.has(z.id) || !enumZoneIds.value.has(z.id))
})
function applyZone() {
  const zs = stageZones.value
  if (!zs.some((z) => z.id === zoneId.value)) zoneId.value = zs[0]?.id || ''
}
function onStage(i: number) {
  stageId.value = stages.value[i].id
  applyZone()
}
function onZone(i: number) {
  const zs = stageZones.value
  zoneId.value = zs[i]?.id || ''
}

/** 当前区域是否为系统空间枚举（自由文本区域不做工艺适用范围过滤，否则工艺库会整片为空） */
const isEnumZone = computed(() => zones.value.some((z) => z.id === zoneId.value))
const lib = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  return allCraft.value.filter((c) => {
    if (c.defaultStageId && c.defaultStageId !== stageId.value) return false
    if (zoneId.value && isEnumZone.value && !c.zoneIds.includes(zoneId.value)) return false
    if (k && !(c.name + c.code + c.craft + c.spec).toLowerCase().includes(k)) return false
    return true
  })
})
const zoneOf = (id: string) => zones.value.find((z) => z.id === id)

/**
 * 已下发识别：同一「项目 × 阶段 × 区域 × 工艺」只允许一条未取消任务。
 * 历史缺陷：重复下发会生成多条重复任务（BUG-TASK-DUPLICATE-DISPATCH），服务端已拦截，
 * 前端在此提前标记「已下发」并阻止重复选择。
 */
const dispatchedKeys = computed(() => new Set(
  existingTasks.value
    .filter((t) => t.status !== 'overdue' && t.catalogId)
    // 后端施工任务的 zone 存的是中文区域名（ProjectTask.resolveZone → SpaceType.name），
    // 因此这里统一用区域名做键，避免「LivingRoom」与「客厅」对不上导致已下发识别失效。
    .map((t) => `${t.stageId}|${t.zone?.name || t.zone?.id || ''}|${t.catalogId}`)
))
function isDispatched(ct: CraftTask) {
  const zoneName = zoneOf(zoneId.value)?.name || zoneId.value
  return dispatchedKeys.value.has(`${stageId.value}|${zoneName}|${ct.id}`)
}

function defaultQty(ct: CraftTask): number {
  const map: Record<string, number> = { '㎡': 20, 'm': 10, '个': 10, '点': 6, '樘': 2, '套': 1, '项': 1 }
  return map[ct.unit] || 1
}
function add(ct: CraftTask) {
  if (!zoneId.value) { toast('请先选择施工区域'); return }
  if (isDispatched(ct)) {
    toast('该工艺已在当前阶段·区域下发，请在原任务上调整数量'); return
  }
  if (selected.value.some((x) => x.ct.id === ct.id && x.zone.id === zoneId.value)) {
    toast('该区域下已选此工艺'); return
  }
  const zn = zones.value.find((z) => z.id === zoneId.value)!
  selected.value.push({ ct, zone: zn, qty: defaultQty(ct) })
}
function removeAt(i: number) { selected.value.splice(i, 1) }
function changeQty(i: number, delta: number) {
  const it = selected.value[i]
  it.qty = Math.max(0, it.qty + delta)
}
async function save() {
  if (!selected.value.length) { toast('请先选择施工任务'); return }
  const ok = await confirm('保存排期', `将为「${stage.value?.name}」添加 ${selected.value.length} 项施工任务，确认保存？`, '保存')
  if (!ok) return
  loading('保存排期中…')
  const failed: string[] = []
  for (const it of selected.value) {
    try {
      await scheduleApi.addTaskFromCatalog({
        projectId: projectId.value,
        stageId: stageId.value,
        zoneId: it.zone.id,
        catalogId: it.ct.id,
        quantity: it.qty,
        ownerId: session.emp?.id
      })
      existingTasks.value.push({
        id: '', projectId: projectId.value, stageId: stageId.value, catalogId: it.ct.id,
        name: it.ct.name, status: 'todo', zone: it.zone
      } as Task)
    } catch (error) {
      failed.push(`${it.ct.name}（${it.zone.name}）`)
      toastError(error, '下发失败')
    }
  }
  savedCount.value += selected.value.length - failed.length
  selected.value = []
  hideLoading()
  if (failed.length) {
    toast(`以下任务未下发：${failed.join('、')}`, 'none')
  } else {
    toast('排期已保存，任务已下发', 'success')
    setTimeout(() => uni.navigateBack(), 450)
  }
}
</script>

<template>
  <view class="pe" v-if="project">
    <!-- 计划上下文 -->
    <view class="pe__ctx jz-card">
      <view class="jz-between">
        <text class="pe__ctx-name">{{ project.name }}</text>
        <text class="pe__ctx-tip">签约后 · 设计师排期</text>
      </view>
      <text class="pe__ctx-sub">从系统工艺库选择施工任务，任务将落位到「阶段 × 区域」，驱动项目经理按节点推进。</text>
    </view>

    <!-- 阶段 -->
    <scroll-view scroll-x class="pe__chips" :show-scrollbar="false">
      <view class="pe__chips-row">
        <view v-for="s in stages" :key="s.id" class="pe__chip" :class="{ 'pe__chip--on': stageId === s.id }" @tap="onStage(stages.indexOf(s))">
          <text class="pe__chip-name">{{ s.name }}</text>
          <text class="pe__chip-date">{{ (s.plannedStart || '').slice(5) }}~{{ (s.plannedEnd || '').slice(5) }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- 区域 -->
    <view class="pe__zone-row">
      <text class="pe__zone-label">施工区域</text>
      <scroll-view scroll-x class="pe__zones" :show-scrollbar="false">
        <view class="pe__zones-row">
          <view v-for="z in stageZones" :key="z.id" class="pe__zone" :class="{ 'pe__zone--on': zoneId === z.id }" @tap="onZone(stageZones.indexOf(z))">
            {{ z.name }}
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 搜索 + 工艺库 -->
    <view class="pe__search jz-card">
      <view class="pe__search-icon"><JzIcon name="search" :size="32" :color="TOKEN_COLOR.text3" /></view>
      <input v-model="keyword" placeholder="搜索工艺名称/规格/工艺说明" />
    </view>

    <view class="jz-section"><text class="jz-section__title">工艺任务库（{{ lib.length }}）</text><text class="jz-section__more">系统内置 · 设计师选择</text></view>
    <view class="pe__lib">
      <view v-for="ct in lib" :key="ct.id" class="jz-card pe__lib-item">
        <view class="jz-between">
          <view class="jz-row">
            <text class="pe__lib-code">{{ ct.code }}</text>
            <text class="pe__lib-name">{{ ct.name }}</text>
            <text v-if="ct.conceal" class="pe__lib-conceal">需隐蔽验收</text>
          </view>
          <view class="pe__add" :class="{ 'pe__add--dispatched': isDispatched(ct) }" @tap="add(ct)">
            <JzIcon v-if="!isDispatched(ct)" name="plus" :size="24" :color="TOKEN_COLOR.primary" />
            <text>{{ isDispatched(ct) ? '已下发' : '选择' }}</text>
          </view>
        </view>
        <text class="pe__lib-craft">工艺：{{ ct.craft }}</text>
        <text class="pe__lib-spec">规格：{{ ct.spec }}</text>
        <view class="jz-between pe__lib-foot">
          <text class="pe__lib-meta">计量单位 {{ ct.unit }} · 适用：{{ ct.zoneIds.map((z) => zoneOf(z)?.name).join('、') }}</text>
        </view>
      </view>
      <view v-if="!lib.length" class="jz-card"><view class="pe__empty">该阶段/区域暂无匹配工艺，可切换区域或搜索</view></view>
    </view>

    <!-- 已选清单（待保存） -->
    <view v-if="selected.length" class="pe__basket">
      <view class="jz-section"><text class="jz-section__title">已选（{{ selected.length }}）· 待保存</text></view>
      <view class="jz-card pe__basket-card">
        <view v-for="(it, i) in selected" :key="i" class="pe__basket-row">
          <view class="jz-grow">
            <view class="jz-row">
              <text class="pe__basket-name">{{ it.ct.name }}</text>
              <text class="pe__basket-zone">{{ it.zone.name }}</text>
            </view>
            <text class="pe__basket-unit">单位：{{ it.ct.unit }}</text>
          </view>
          <view class="pe__stepper">
            <view class="pe__step-btn" @tap="changeQty(i, -1)"><JzIcon name="minus" :size="26" :color="TOKEN_COLOR.text1" /></view>
            <text class="pe__step-val">{{ it.qty }}</text>
            <view class="pe__step-btn" @tap="changeQty(i, 1)"><JzIcon name="plus" :size="26" :color="TOKEN_COLOR.text1" /></view>
          </view>
          <view class="pe__basket-del" @tap="removeAt(i)"><JzIcon name="close" :size="24" :color="TOKEN_COLOR.text4" /></view>
        </view>
      </view>
      <view class="jz-actionbar">
        <view class="jz-actionbar__inner">
          <text class="pe__save-tip">已选 {{ selected.length }} 项 · 共 {{ selected.reduce((a, b) => a + b.qty, 0) }} {{ selected[0]?.ct.unit || '项' }}</text>
          <button class="jz-btn jz-btn--primary jz-grow" @tap="save">保存并下发任务</button>
        </view>
      </view>
    </view>
    <view v-if="savedCount" class="pe__saved-tip"><JzIcon name="check-circle" :size="28" :color="TOKEN_COLOR.success" /><text>本次已保存 {{ savedCount }} 项任务（已进入计划）</text></view>
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
</style>
