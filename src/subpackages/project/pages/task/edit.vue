<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import type { Zone } from '@/domains/base/model'
import type { Employee } from '@/domains/identity/model'
import type { ProjectStage } from '@/domains/project/model'
import type { TaskPriority } from '@/domains/schedule/model'
import { identityApi } from '@/domains/identity/api'
import { baseApi } from '@/domains/base/api'
import { projectApi } from '@/domains/project/api'
import { scheduleApi } from '@/domains/schedule/api'
import { ROLE_META } from '@/roles/catalog'
import JzIcon from '@/components/JzIcon.vue'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import { toastError, toast, loading, hideLoading } from '@/composables/toast'

const id = ref('')
const projectId = ref('')
const stageId = ref('')
const name = ref('')
const content = ref('')
const ownerId = ref('')
const priority = ref<TaskPriority>('normal')
const plannedStart = ref('')
const plannedEnd = ref('')
const acceptStandard = ref('')
const remark = ref('')

const zoneId = ref('')
const quantity = ref('')
const unit = ref('')
const craft = ref('')
const spec = ref('')

const employees = ref<Employee[]>([])
const stages = ref<ProjectStage[]>([])
const zones = ref<Zone[]>([])
// 任务负责人候选：企业负责人 / 店长 / 项目经理 / 设计师 / 业务员（店长自 2026-09-23 起可操作施工任务）
const OWNER_ROLES = ['boss', 'storeManager', 'pm', 'designer', 'marketer']
const owners = computed(() => employees.value.filter((e) => OWNER_ROLES.includes(e.role)))
const stageLabel = computed(() => {
  const s = stages.value.find((x) => x.id === stageId.value)
  return s ? `${s.sort}. ${s.name}` : ''
})
const zoneLabel = computed(() => zones.value.find((z) => z.id === zoneId.value)?.name || '')
const ownerSelected = computed(() => owners.value.find((o) => o.id === ownerId.value))
const ownerLabel = computed(() => ownerSelected.value?.name || '')
/** 负责人下拉文案：岗位名缺失时回退角色短名，绝不再渲染 undefined。 */
function ownerDisplay(o: Employee) {
  return `${o.name}（${o.title || ROLE_META[o.role]?.short || o.role}）`
}
const PRIOS = [
  { key: 'low', label: '低' }, { key: 'normal', label: '中' }, { key: 'high', label: '高' }, { key: 'urgent', label: '紧急' }
] as const

onLoad((q) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  id.value = q?.id || ''
  projectId.value = q?.projectId || ''
  stageId.value = q?.stageId || ''
  // 新建任务必须从系统工艺任务库选择 CatalogItem，后端 Save 也会强制校验。
  // 历史入口只传 projectId/stageId，若继续停留在本页将因缺少 catalogId 保存失败（XA-20261004-001）。
  if (!id.value) {
    if (!projectId.value) {
      toast('缺少项目上下文，无法新建任务')
      setTimeout(() => uni.reLaunch({ url: P.home }), 500)
      return
    }
    const query = [`projectId=${projectId.value}`]
    if (stageId.value) query.push(`stageId=${stageId.value}`)
    uni.redirectTo({ url: `${P.projectPlanEdit}?${query.join('&')}` })
    return
  }
  // 加载失败时给出可读提示，避免未捕获异常直接抛到用户界面
  void load().catch((error) => toastError(error, '任务信息加载失败'))
})
async function load() {
  const [es, zn] = await Promise.all([identityApi.employees(), baseApi.zones()])
  employees.value = es
  zones.value = zn
  if (id.value) {
    const t = await scheduleApi.task(id.value)
    if (t) {
      uni.setNavigationBarTitle({ title: '编辑任务' })
      projectId.value = t.projectId; stageId.value = t.stageId
      name.value = t.name; content.value = t.content || ''
      ownerId.value = t.owner?.id || ''; priority.value = t.priority
      plannedStart.value = t.plannedStart || ''; plannedEnd.value = t.plannedEnd || ''
      acceptStandard.value = t.acceptStandard || ''; remark.value = t.remark || ''
      zoneId.value = t.zone?.id || ''; quantity.value = t.quantity !== undefined ? `${t.quantity}` : ''
      unit.value = t.unit || ''; craft.value = t.craft || ''; spec.value = t.spec || ''
    }
  } else {
    uni.setNavigationBarTitle({ title: '新建任务' })
  }
  if (projectId.value) stages.value = await projectApi.stages(projectId.value)
}

async function save() {
  if (!projectId.value) { toast('缺少项目'); return }
  if (!name.value.trim()) { toast('请填写任务名称'); return }
  loading('保存中…')
  try {
    await scheduleApi.saveTask({
    id: id.value || undefined,
      projectId: projectId.value,
      stageId: stageId.value || stages.value[0]?.id,
      name: name.value.trim(),
      content: content.value.trim() || undefined,
      zone: zones.value.find((z) => z.id === zoneId.value),
      quantity: quantity.value ? Number(quantity.value) : undefined,
      unit: unit.value.trim() || undefined,
      craft: craft.value.trim() || undefined,
      spec: spec.value.trim() || undefined,
      acceptStandard: acceptStandard.value.trim() || spec.value.trim() || undefined,
      owner: owners.value.find((e) => e.id === ownerId.value),
      creator: session.emp || undefined,
      priority: priority.value,
      plannedStart: plannedStart.value || undefined,
      plannedEnd: plannedEnd.value || undefined,
      remark: remark.value.trim() || undefined
    })
    hideLoading()
    toast('保存成功', 'success')
    setTimeout(() => uni.navigateBack(), 350)
  } catch (error) {
    hideLoading()
    toastError(error, '保存失败')
  }
}
</script>

<template>
  <view class="te">
    <view class="jz-card te__card">
      <view class="te__row"><text class="te__label">任务名称 <text class="req">*</text></text><input v-model="name" placeholder="例：客厅吊顶龙骨安装" /></view>
      <view class="te__row te__row--col"><text class="te__label">施工工艺</text><textarea v-model="craft" class="te__ta" placeholder="从工艺库带入，或补充工艺说明" maxlength="200" /></view>
      <view class="te__row te__row--col"><text class="te__label">规格要求</text><textarea v-model="spec" class="te__ta" placeholder="验收规格/标准要求" maxlength="200" /></view>
      <view class="te__row"><text class="te__label">所属阶段</text>
        <picker :range="stages.map(s => s.sort + '. ' + s.name)" :value="Math.max(0, stages.findIndex(s => s.id === stageId))" @change="stageId = stages[Number($event.detail.value)].id">
          <view class="te__picker" :class="{ 'te__picker--empty': !stageLabel }"><text>{{ stageLabel || '选择阶段' }}</text><JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" /></view>
        </picker>
      </view>
      <view class="te__row"><text class="te__label">施工区域</text>
        <picker :range="zones.map(z => z.name)" @change="zoneId = zones[Number($event.detail.value)].id">
          <view class="te__picker" :class="{ 'te__picker--empty': !zoneLabel }"><text>{{ zoneLabel || '选择区域（客厅/厨房…）' }}</text><JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" /></view>
        </picker>
      </view>
      <view class="te__row"><text class="te__label">施工总量</text>
        <input v-model="quantity" type="digit" class="jz-grow te__qty" placeholder="数量" />
        <input v-model="unit" class="te__unit" placeholder="单位(㎡/m/项…)" />
      </view>
      <view class="te__row"><text class="te__label">负责人</text>
        <picker :range="owners.map(ownerDisplay)" @change="ownerId = owners[Number($event.detail.value)].id">
          <view class="te__picker" :class="{ 'te__picker--empty': !ownerLabel }">
            <JzEmployeeAvatar v-if="ownerSelected" :src="ownerSelected.avatarUrl || ''" :name="ownerSelected.name" :role="ownerSelected.role" :status="ownerSelected.status" :size="52" />
            <text>{{ ownerLabel || '选择负责人' }}</text>
            <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
          </view>
        </picker>
      </view>
      <view class="te__row"><text class="te__label">优先级</text>
        <view class="jz-row te__prios">
          <view v-for="p in PRIOS" :key="p.key" class="te__prio" :class="{ 'te__prio--on': priority === p.key }" @tap="priority = p.key">{{ p.label }}</view>
        </view>
      </view>
      <view class="te__row"><text class="te__label">开始日期</text>
        <picker mode="date" :value="plannedStart" @change="plannedStart = $event.detail.value"><view class="te__picker"><text>{{ plannedStart || '选择日期' }}</text><JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" /></view></picker>
      </view>
      <view class="te__row"><text class="te__label">截止日期</text>
        <picker mode="date" :value="plannedEnd" @change="plannedEnd = $event.detail.value"><view class="te__picker"><text>{{ plannedEnd || '选择日期' }}</text><JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" /></view></picker>
      </view>
      <view class="te__row te__row--col"><text class="te__label">备注</text><textarea v-model="remark" class="te__ta" maxlength="200" /></view>
    </view>
    <view class="jz-actionbar">
      <view class="jz-actionbar__inner">
        <button class="jz-btn jz-btn--primary jz-grow te__submit-btn" @tap="save"><JzIcon name="check-circle" :size="28" :color="TOKEN_COLOR.white" /><text>保存任务</text></button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.te { padding-bottom: 168rpx; }
.te__card { margin: 28rpx; padding: 0 28rpx; }
.te__row { display: flex; align-items: center; min-height: 104rpx; padding: 18rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.te__row--col { flex-direction: column; align-items: flex-start; }
.te__label { width: 170rpx; color: $jzb-text-2; font-size: $jzb-font-sm; flex-shrink: 0; }
.req { color: $jzb-danger; }
.te__row input { flex: 1; color: $jzb-text-1; font-size: $jzb-font; text-align: right; }
.te__ta { width: 100%; height: 150rpx; margin-top: 12rpx; padding: 18rpx 20rpx; color: $jzb-text-1; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; font-size: $jzb-font; }
.te__qty { max-width: 180rpx; }
.te__unit { max-width: 200rpx; text-align: right; }
/* picker 需撑满剩余宽度，内部 flex-end 才能让选中值靠右 */
.te__row picker { flex: 1; min-width: 0; }
.te__picker { display: flex; align-items: center; justify-content: flex-end; gap: 8rpx; color: $jzb-text-1; font-size: $jzb-font; }
.te__picker text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.te__picker--empty { color: $jzb-text-4; }
.te__prios { margin-left: auto; }
.te__prio { min-height: 60rpx; padding: 0 24rpx; margin-left: 12rpx; display: inline-flex; align-items: center; background: $jzb-bg-hover; border: 1rpx solid transparent; border-radius: $jzb-radius-pill; font-size: $jzb-font-sm; color: $jzb-text-2; }
.te__prio--on { color: $jzb-primary-dark; background: $jzb-primary-lighter; border-color: rgba(22,163,148,.18); font-weight: 650; }
.te__submit-btn { display: flex; align-items: center; justify-content: center; }
.te__submit-btn text { margin-left: 8rpx; }
</style>
