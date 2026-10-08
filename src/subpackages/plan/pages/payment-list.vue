<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { confirm, toast, toastError } from '@/composables/toast'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { planApi } from '@/domains/plan/api'
import type { PaymentPlanTemplate } from '@/domains/plan/model'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzTag from '@/components/JzTag.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const plans = ref<PaymentPlanTemplate[]>([])
const loading = ref(false)
const loadError = ref('')
const customPlans = computed(() => plans.value.filter((item) => item.source === 'company'))
const baselinePlans = computed(() => plans.value.filter((item) => item.source === 'baseline'))
const canEdit = computed(() => can(session.role, 'edit:payment-plan-template'))

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => {
  if (!isLoggedIn()) return
  if (!can(session.role, 'view:payment-plan-template')) { uni.reLaunch({ url: P.mine }); return }
  void load()
})
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    plans.value = (await planApi.paymentManagement()).paymentPlans
  } catch (error) {
    plans.value = []
    loadError.value = error instanceof Error ? error.message : '付款计划模板加载失败'
  } finally {
    loading.value = false
  }
}

function statusText(plan: PaymentPlanTemplate) {
  if (plan.status === 'draft') return '草稿'
  if (plan.status === 'disabled') return '已停用'
  return '已启用'
}

function statusColor(plan: PaymentPlanTemplate) {
  if (plan.status === 'draft') return TOKEN_COLOR.warning
  if (plan.status === 'disabled') return TOKEN_COLOR.text3
  return TOKEN_COLOR.success
}

function createBlank() {
  if (!canEdit.value) return
  uni.navigateTo({ url: P.paymentPlanTemplateEdit })
}

function edit(plan: PaymentPlanTemplate) {
  if (!canEdit.value || !plan.templateId) return
  uni.navigateTo({ url: `${P.paymentPlanTemplateEdit}?id=${plan.templateId}` })
}

async function copyBaseline(plan: PaymentPlanTemplate) {
  if (!canEdit.value) return
  try {
    const created = await planApi.savePayment({
      sourceBaselineCode: plan.code,
      name: `${plan.name}（企业版）`,
      description: plan.description,
      nodes: []
    })
    toast('已复制为企业模板', 'success')
    if (created.templateId) edit(created)
    else await load()
  } catch (error) {
    toastError(error, '复制模板失败')
  }
}

async function publish(plan: PaymentPlanTemplate) {
  if (!canEdit.value || !plan.templateId) return
  try {
    await planApi.publishPayment(plan.templateId)
    toast('模板已启用', 'success')
    await load()
  } catch (error) {
    toastError(error, '启用模板失败')
  }
}

async function disable(plan: PaymentPlanTemplate) {
  if (!canEdit.value || !plan.templateId) return
  if (!await confirm('停用付款计划', `确认停用“${plan.name}”？历史合同不受影响。`, '停用')) return
  try {
    await planApi.disablePayment(plan.templateId)
    toast('模板已停用', 'success')
    await load()
  } catch (error) {
    toastError(error, '停用模板失败')
  }
}

async function setDefault(plan: PaymentPlanTemplate) {
  if (!canEdit.value || !plan.templateId) return
  try {
    await planApi.defaultPayment(plan.templateId)
    toast('已设为默认付款计划', 'success')
    await load()
  } catch (error) {
    toastError(error, '设置默认模板失败')
  }
}

</script>

<template>
  <view class="ppt">
    <JzPageHeader title="付款计划模板" subtitle="企业自定义合同收款节点，历史合同快照不受影响" :right-text="canEdit ? '新建' : ''" :right-icon="canEdit ? 'plus' : undefined" @right="createBlank" />

    <view class="ppt__notice jz-card">
      <JzIcon name="info" :size="34" :color="TOKEN_COLOR.primary" />
      <text>平台基线可直接复制。企业模板启用后才能用于新合同，合同签约时会冻结当前版本。</text>
    </view>

    <JzSkeleton v-if="loading && !plans.length" :rows="4" />
    <view v-else-if="loadError" class="ppt__state jz-card">
      <JzEmpty text="付款计划模板加载失败" :sub="loadError"><button class="jz-btn jz-btn--plain jz-btn--sm" @tap="load">重新加载</button></JzEmpty>
    </view>
    <template v-else>
      <view class="ppt__section">
        <view class="ppt__section-title"><text>企业自定义</text><text>{{ customPlans.length }} 套</text></view>
        <view v-if="customPlans.length" class="ppt__list">
          <view v-for="plan in customPlans" :key="plan.templateId" class="ppt__card jz-card">
            <view class="ppt__head">
              <view class="jz-grow">
                <view class="ppt__name-row"><text class="ppt__name">{{ plan.name }}</text><JzTag v-if="plan.defaultPlan" text="默认" :color="TOKEN_COLOR.primary" /><JzTag :text="statusText(plan)" :color="statusColor(plan)" /></view>
                <text class="ppt__meta">v{{ plan.version }} · {{ plan.nodes.length }} 个收款节点</text>
              </view>
              <JzIcon v-if="canEdit" name="chevron-right" :size="28" :color="TOKEN_COLOR.text4" @tap="edit(plan)" />
            </view>
            <text class="ppt__desc">{{ plan.description || '暂无说明' }}</text>
            <view class="ppt__preview"><text v-for="node in plan.nodes" :key="node.code">{{ node.name }} {{ Math.round(node.ratio * 100) }}%</text></view>
            <view v-if="canEdit" class="ppt__actions">
              <button class="jz-btn jz-btn--plain jz-btn--sm" @tap.stop="edit(plan)">编辑</button>
              <button v-if="plan.status !== 'enabled'" class="jz-btn jz-btn--plain jz-btn--sm" @tap.stop="publish(plan)">启用</button>
              <button v-if="plan.status === 'enabled' && !plan.defaultPlan" class="jz-btn jz-btn--plain jz-btn--sm" @tap.stop="setDefault(plan)">设为默认</button>
              <button v-if="plan.status === 'enabled'" class="jz-btn jz-btn--plain jz-btn--sm ppt__danger" @tap.stop="disable(plan)">停用</button>
            </view>
          </view>
        </view>
        <view v-else class="ppt__state jz-card"><JzEmpty text="还没有企业付款计划" sub="从平台基线复制后即可调整比例和触发条件" /></view>
      </view>

      <view class="ppt__section ppt__section--baseline">
        <view class="ppt__section-title"><text>平台基线</text><text>{{ baselinePlans.length }} 套</text></view>
        <view class="ppt__list">
          <view v-for="plan in baselinePlans" :key="plan.code" class="ppt__card jz-card">
            <view class="ppt__head">
              <view class="jz-grow">
                <view class="ppt__name-row"><text class="ppt__name">{{ plan.name }}</text><JzTag text="平台" :color="TOKEN_COLOR.text3" /></view>
                <text class="ppt__meta">v{{ plan.version }} · {{ plan.nodes.length }} 个收款节点</text>
              </view>
            </view>
            <text class="ppt__desc">{{ plan.description }}</text>
            <view class="ppt__preview"><text v-for="node in plan.nodes" :key="node.code">{{ node.name }} {{ Math.round(node.ratio * 100) }}%</text></view>
            <view v-if="canEdit" class="ppt__actions"><button class="jz-btn jz-btn--primary jz-btn--sm" @tap.stop="copyBaseline(plan)">复制为企业模板</button></view>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.ppt { min-height: 100vh; background: $jzb-bg-page; padding-bottom: 40rpx; }
.ppt__notice { display: flex; align-items: flex-start; gap: 14rpx; margin: 20rpx $jzb-page-pad; padding: 22rpx 24rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.ppt__section { margin-top: 30rpx; }
.ppt__section-title { display: flex; justify-content: space-between; margin: 0 $jzb-page-pad 14rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.ppt__section-title text:last-child { color: $jzb-text-3; font-size: $jzb-font-xs; font-weight: 400; }
.ppt__list { padding: 0 $jzb-page-pad; }
.ppt__card { margin-bottom: 16rpx; padding: 24rpx; }
.ppt__head { display: flex; align-items: center; }
.ppt__name-row { display: flex; align-items: center; gap: 8rpx; }
.ppt__name { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.ppt__meta { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ppt__desc { display: block; margin-top: 14rpx; color: $jzb-text-2; font-size: $jzb-font-sm; line-height: 1.55; }
.ppt__preview { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 16rpx; }
.ppt__preview text { padding: 8rpx 14rpx; border-radius: $jzb-radius-pill; color: $jzb-primary-dark; background: $jzb-primary-lightest; font-size: $jzb-font-xs; }
.ppt__actions { display: flex; justify-content: flex-end; gap: 10rpx; margin-top: 18rpx; padding-top: 16rpx; border-top: 1rpx solid $jzb-border-light; }
.ppt__danger { color: $jzb-danger; }
.ppt__state { margin: 0 $jzb-page-pad; }
.ppt__section--baseline .ppt__card { background: linear-gradient(145deg, #FFFFFF, #F8FAFB); }
</style>
