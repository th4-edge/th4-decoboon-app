<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { confirm, toast, toastError } from '@/composables/toast'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { planApi } from '@/domains/plan/api'
import type { ConstructionPlanTemplate } from '@/domains/plan/model'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzTag from '@/components/JzTag.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'

const plans = ref<ConstructionPlanTemplate[]>([])
const loading = ref(false)
const loadError = ref('')
const customPlans = computed(() => plans.value.filter((item) => item.source === 'company'))
const baselinePlans = computed(() => plans.value.filter((item) => item.source === 'baseline'))
const canEdit = computed(() => can(session.role, 'edit:construction-plan-template'))

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => {
  if (!isLoggedIn()) return
  if (!can(session.role, 'view:construction-plan-template')) { uni.reLaunch({ url: P.mine }); return }
  void load()
})
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    plans.value = (await planApi.constructionManagement()).constructionPlans
  } catch (error) {
    plans.value = []
    loadError.value = error instanceof Error ? error.message : '施工计划模板加载失败'
  } finally {
    loading.value = false
  }
}

function statusText(plan: ConstructionPlanTemplate) {
  if (plan.status === 'draft') return '草稿'
  if (plan.status === 'disabled') return '已停用'
  return '已启用'
}

function statusColor(plan: ConstructionPlanTemplate) {
  if (plan.status === 'draft') return TOKEN_COLOR.warning
  if (plan.status === 'disabled') return TOKEN_COLOR.text3
  return TOKEN_COLOR.success
}

function createBlank() { uni.navigateTo({ url: P.constructionPlanTemplateEdit }) }
function edit(plan: ConstructionPlanTemplate) {
  if (!canEdit.value || !plan.templateId) return
  uni.navigateTo({ url: `${P.constructionPlanTemplateEdit}?id=${plan.templateId}` })
}

async function copyBaseline(plan: ConstructionPlanTemplate) {
  if (!canEdit.value) return
  try {
    const created = await planApi.saveConstruction({
      sourceBaselineCode: plan.code,
      name: `${plan.name}（企业版）`,
      description: plan.description,
      stages: []
    })
    toast('已复制为企业模板', 'success')
    if (created.templateId) edit(created)
    else await load()
  } catch (error) {
    toastError(error, '复制模板失败')
  }
}

async function publish(plan: ConstructionPlanTemplate) {
  if (!canEdit.value || !plan.templateId) return
  try {
    await planApi.publishConstruction(plan.templateId)
    toast('模板已启用', 'success')
    await load()
  } catch (error) {
    toastError(error, '启用模板失败')
  }
}

async function disable(plan: ConstructionPlanTemplate) {
  if (!canEdit.value || !plan.templateId) return
  if (!await confirm('停用施工计划', `确认停用“${plan.name}”？历史合同不受影响。`, '停用')) return
  try {
    await planApi.disableConstruction(plan.templateId)
    toast('模板已停用', 'success')
    await load()
  } catch (error) {
    toastError(error, '停用模板失败')
  }
}

async function setDefault(plan: ConstructionPlanTemplate) {
  if (!canEdit.value || !plan.templateId) return
  try {
    await planApi.defaultConstruction(plan.templateId)
    toast('已设为默认施工计划', 'success')
    await load()
  } catch (error) {
    toastError(error, '设置默认模板失败')
  }
}
</script>

<template>
  <view class="cpt">
    <JzPageHeader title="施工计划模板" subtitle="企业自定义施工阶段、工期和验收方式" :right-text="canEdit ? '新建' : ''" :right-icon="canEdit ? 'plus' : undefined" @right="createBlank" />

    <view class="cpt__notice jz-card">
      <JzIcon name="info" :size="34" :color="TOKEN_COLOR.primary" />
      <text>企业模板启用后才能用于新合同。合同生效时按模板生成项目阶段，项目后续调整不会反向修改模板。</text>
    </view>

    <JzSkeleton v-if="loading && !plans.length" :rows="4" />
    <view v-else-if="loadError" class="cpt__state jz-card">
      <JzEmpty text="施工计划模板加载失败" :sub="loadError"><button class="jz-btn jz-btn--plain jz-btn--sm" @tap="load">重新加载</button></JzEmpty>
    </view>
    <template v-else>
      <view class="cpt__section">
        <view class="cpt__section-title"><text>企业自定义</text><text>{{ customPlans.length }} 套</text></view>
        <view v-if="customPlans.length" class="cpt__list">
          <view v-for="plan in customPlans" :key="plan.templateId" class="cpt__card jz-card">
            <view class="cpt__head">
              <view class="jz-grow">
                <view class="cpt__name-row"><text class="cpt__name">{{ plan.name }}</text><JzTag v-if="plan.defaultPlan" text="默认" :color="TOKEN_COLOR.primary" /><JzTag :text="statusText(plan)" :color="statusColor(plan)" /></view>
                <text class="cpt__meta">v{{ plan.version }} · {{ plan.stages.length }} 个阶段 · {{ plan.totalDays }} 天</text>
              </view>
              <JzIcon v-if="canEdit" name="chevron-right" :size="28" :color="TOKEN_COLOR.text4" @tap="edit(plan)" />
            </view>
            <text class="cpt__desc">{{ plan.description || '暂无说明' }}</text>
            <view class="cpt__preview"><text v-for="stage in plan.stages" :key="stage.code">{{ stage.name }} {{ stage.defaultDays }}天</text></view>
            <view v-if="canEdit" class="cpt__actions">
              <button class="jz-btn jz-btn--plain jz-btn--sm" @tap.stop="edit(plan)">编辑</button>
              <button v-if="plan.status !== 'enabled'" class="jz-btn jz-btn--plain jz-btn--sm" @tap.stop="publish(plan)">启用</button>
              <button v-if="plan.status === 'enabled' && !plan.defaultPlan" class="jz-btn jz-btn--plain jz-btn--sm" @tap.stop="setDefault(plan)">设为默认</button>
              <button v-if="plan.status === 'enabled'" class="jz-btn jz-btn--plain jz-btn--sm cpt__danger" @tap.stop="disable(plan)">停用</button>
            </view>
          </view>
        </view>
        <view v-else class="cpt__state jz-card"><JzEmpty text="还没有企业施工计划" sub="从平台基线复制后即可调整阶段和工期" /></view>
      </view>

      <view class="cpt__section cpt__section--baseline">
        <view class="cpt__section-title"><text>平台基线</text><text>{{ baselinePlans.length }} 套</text></view>
        <view class="cpt__list">
          <view v-for="plan in baselinePlans" :key="plan.code" class="cpt__card jz-card">
            <view class="cpt__head">
              <view class="jz-grow">
                <view class="cpt__name-row"><text class="cpt__name">{{ plan.name }}</text><JzTag text="平台" :color="TOKEN_COLOR.text3" /></view>
                <text class="cpt__meta">v{{ plan.version }} · {{ plan.stages.length }} 个阶段 · {{ plan.totalDays }} 天</text>
              </view>
            </view>
            <text class="cpt__desc">{{ plan.description }}</text>
            <view class="cpt__preview"><text v-for="stage in plan.stages" :key="stage.code">{{ stage.name }} {{ stage.defaultDays }}天</text></view>
            <view v-if="canEdit" class="cpt__actions"><button class="jz-btn jz-btn--primary jz-btn--sm" @tap.stop="copyBaseline(plan)">复制为企业模板</button></view>
          </view>
        </view>
      </view>
    </template>
  </view>
    <JzConfirmDialog />
</template>

<style lang="scss" scoped>
.cpt { min-height: 100vh; background: $jzb-bg-page; padding-bottom: 40rpx; }
.cpt__notice { display: flex; align-items: flex-start; gap: 14rpx; margin: 20rpx $jzb-page-pad; padding: 22rpx 24rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.cpt__section { margin-top: 30rpx; }
.cpt__section-title { display: flex; justify-content: space-between; margin: 0 $jzb-page-pad 14rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.cpt__section-title text:last-child { color: $jzb-text-3; font-size: $jzb-font-xs; font-weight: 400; }
.cpt__list { padding: 0 $jzb-page-pad; }
.cpt__card { margin-bottom: 16rpx; padding: 24rpx; }
.cpt__head { display: flex; align-items: center; }
.cpt__name-row { display: flex; align-items: center; gap: 8rpx; }
.cpt__name { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.cpt__meta { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cpt__desc { display: block; margin-top: 14rpx; color: $jzb-text-2; font-size: $jzb-font-sm; line-height: 1.55; }
.cpt__preview { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 16rpx; }
.cpt__preview text { padding: 8rpx 14rpx; border-radius: $jzb-radius-pill; color: $jzb-primary-dark; background: $jzb-primary-lightest; font-size: $jzb-font-xs; }
.cpt__actions { display: flex; justify-content: flex-end; gap: 10rpx; margin-top: 18rpx; padding-top: 16rpx; border-top: 1rpx solid $jzb-border-light; }
.cpt__danger { color: $jzb-danger; }
.cpt__state { margin: 0 $jzb-page-pad; }
.cpt__section--baseline .cpt__card { background: linear-gradient(145deg, #FFFFFF, #F8FAFB); }
</style>
