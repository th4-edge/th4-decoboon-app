<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { toast, toastError } from '@/composables/toast'
import { isLoggedIn, session } from '@/domains/identity/session'
import { planApi } from '@/domains/plan/api'
import type { ConstructionStageTemplate, PaymentPlanNodeTemplate, PaymentPlanTemplate } from '@/domains/plan/model'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

interface PaymentNodeForm extends PaymentPlanNodeTemplate {
  ratioPercent: number
}

const templateId = ref('')
const name = ref('')
const description = ref('')
const sort = ref(0)
const nodes = ref<PaymentNodeForm[]>([])
const stageOptions = ref<ConstructionStageTemplate[]>([])
const loading = ref(false)
const submitting = ref(false)

const typeOptions = [
  { value: 'First', label: '首期款' },
  { value: 'Progress', label: '进度款' },
  { value: 'Final', label: '尾款' },
  { value: 'Retention', label: '质保金' },
  { value: 'Other', label: '其他应收' }
]
const triggerOptions = [
  { value: 'ContractSigned', label: '合同签约' },
  { value: 'StageStarted', label: '阶段开工' },
  { value: 'StageDone', label: '阶段施工完成' },
  { value: 'StageAccepted', label: '阶段验收完成' },
  { value: 'ProjectFinished', label: '项目竣工' }
]
const ratioTotal = computed(() => nodes.value.reduce((sum, node) => sum + Number(node.ratioPercent || 0), 0))
const canSubmit = computed(() => name.value.trim().length > 0 && nodes.value.length > 0
  && nodes.value.every((node) => node.name.trim() && (!requiresStage(node.triggerType) || !!node.triggerStageCode))
  && Math.abs(ratioTotal.value - 100) < 0.001)
const pageTitle = computed(() => templateId.value ? '编辑付款计划' : '新建付款计划')

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  if (!['boss', 'storeManager'].includes(session.role || '')) { uni.reLaunch({ url: P.mine }); return }
  templateId.value = String(query?.id || '')
  void load()
})

async function load() {
  loading.value = true
  try {
    const [management, construction] = await Promise.all([
      planApi.paymentManagement(), planApi.constructionManagement()
    ])
    stageOptions.value = uniqueStages([
      ...construction.constructionPlans.flatMap((item) => item.stages)
    ])
    const current = templateId.value ? management.paymentPlans.find((item) => item.templateId === templateId.value) : undefined
    if (current && current.status !== 'draft') {
      toast('已启用或已停用的版本不可原地修改，请从列表创建下一版')
      setTimeout(() => uni.navigateBack(), 600)
      return
    }
    if (current) apply(current)
    else if (templateId.value) {
      toast('付款计划模板不存在', 'none')
      setTimeout(() => uni.navigateBack(), 500)
    } else {
      name.value = '企业付款计划'
      nodes.value = [newNode(1)]
    }
  } catch (error) {
    toastError(error, '付款计划模板加载失败')
  } finally {
    loading.value = false
  }
}

function apply(plan: PaymentPlanTemplate) {
  name.value = plan.name
  description.value = plan.description
  sort.value = plan.sort
  nodes.value = plan.nodes.map((node) => ({ ...node, ratioPercent: Number((node.ratio * 100).toFixed(2)) }))
}

function uniqueStages(stages: ConstructionStageTemplate[]) {
  const map = new Map<string, ConstructionStageTemplate>()
  stages.forEach((stage) => { if (stage.code && !map.has(stage.code)) map.set(stage.code, stage) })
  return [...map.values()]
}

function newNode(index: number): PaymentNodeForm {
  return {
    code: `PAY_NODE_${index}`,
    name: index === 1 ? '合同签约款' : `第${index}期款`,
    ratio: 0,
    ratioPercent: 0,
    type: index === 1 ? 'First' : 'Progress',
    triggerType: index === 1 ? 'ContractSigned' : 'StageAccepted',
    triggerStageCode: undefined,
    offsetDays: 0,
    sort: index
  }
}

function addNode() {
  nodes.value.push(newNode(nodes.value.length + 1))
}

function removeNode(index: number) {
  nodes.value.splice(index, 1)
  nodes.value.forEach((node, i) => { node.sort = i + 1 })
}

function typeLabel(value: string) {
  return typeOptions.find((item) => item.value === value)?.label || value
}

function triggerLabel(value: string) {
  return triggerOptions.find((item) => item.value === value)?.label || value
}

function stageLabel(code?: string) {
  return stageOptions.value.find((item) => item.code === code)?.name || code || '请选择阶段'
}

function requiresStage(type: string) {
  return ['StageStarted', 'StageDone', 'StageAccepted'].includes(type)
}

function payload() {
  return {
    templateId: templateId.value || undefined,
    name: name.value.trim(),
    description: description.value.trim(),
    sort: sort.value,
    nodes: nodes.value.map((node, index) => ({
      code: node.code,
      name: node.name.trim(),
      ratio: Number((Number(node.ratioPercent || 0) / 100).toFixed(4)),
      type: node.type,
      triggerType: node.triggerType,
      triggerStageCode: requiresStage(node.triggerType) ? node.triggerStageCode : undefined,
      offsetDays: Number(node.offsetDays || 0),
      sort: index + 1
    }))
  }
}

async function save(publish = false) {
  if (!canSubmit.value) {
    toast(Math.abs(ratioTotal.value - 100) < 0.001 ? '请补齐模板名称和节点' : '收款比例合计必须为100%', 'none')
    return
  }
  submitting.value = true
  try {
    const result = templateId.value
      ? await planApi.updatePayment(payload())
      : await planApi.savePayment(payload())
    templateId.value = result.templateId || templateId.value
    if (publish && templateId.value) await planApi.publishPayment(templateId.value)
    toast(publish ? '模板已保存并启用' : '模板已保存', 'success')
    setTimeout(() => uni.navigateBack(), 500)
  } catch (error) {
    toastError(error, '保存付款计划失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="ppe">
    <JzPageHeader :title="pageTitle" subtitle="节点比例合计必须为100%，新版本仅影响后续合同" />
    <view class="ppe__body">
      <view class="ppe__card jz-card">
        <text class="ppe__section-title">模板信息</text>
        <view class="ppe__field"><text>模板名称</text><input v-model="name" maxlength="128" placeholder="例如：企业标准收款" /></view>
        <view class="ppe__field ppe__field--textarea"><text>说明</text><textarea v-model="description" maxlength="512" auto-height placeholder="描述适用项目或收款规则" /></view>
        <view class="ppe__field"><text>排序</text><input v-model.number="sort" type="number" placeholder="0" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: right" /></view>
      </view>

      <view class="ppe__summary jz-card" :class="{ 'ppe__summary--error': Math.abs(ratioTotal - 100) >= 0.001 }">
        <text>当前比例合计</text><text>{{ ratioTotal.toFixed(2) }}%</text>
      </view>

      <view class="ppe__section-head"><text>收款节点</text><button class="jz-btn jz-btn--plain jz-btn--sm" @tap="addNode">添加节点</button></view>
      <view v-for="(node, index) in nodes" :key="node.code" class="ppe__card ppe__node jz-card">
        <view class="ppe__node-head"><text>第 {{ index + 1 }} 期</text><view class="ppe__remove" @tap="removeNode(index)"><JzIcon name="trash" :size="28" :color="TOKEN_COLOR.danger" /></view></view>
        <view class="ppe__field"><text>节点名称</text><input v-model="node.name" maxlength="128" placeholder="例如：水电验收款" /></view>
        <view class="ppe__grid">
          <view class="ppe__field"><text>收款比例</text><input v-model.number="node.ratioPercent" type="digit" placeholder="30" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: right" /><text class="ppe__unit">%</text></view>
          <view class="ppe__field"><text>应收类型</text><JzSelectField variant="plain" :display="typeLabel(node.type)" :range="typeOptions.map(i => i.label)" :index="Math.max(0, typeOptions.findIndex(i => i.value === node.type))" @change="node.type = typeOptions.find(i => i.label === $event)?.value || node.type" /></view>
        </view>
        <view class="ppe__field"><text>触发条件</text><JzSelectField variant="plain" :display="triggerLabel(node.triggerType)" :range="triggerOptions.map(i => i.label)" :index="Math.max(0, triggerOptions.findIndex(i => i.value === node.triggerType))" @change="node.triggerType = triggerOptions.find(i => i.label === $event)?.value || node.triggerType" /></view>
        <view v-if="requiresStage(node.triggerType)" class="ppe__field"><text>触发阶段</text><JzSelectField variant="plain" :display="stageLabel(node.triggerStageCode)" :range="stageOptions.map(i => i.name)" :index="Math.max(0, stageOptions.findIndex(i => i.code === node.triggerStageCode))" @change="node.triggerStageCode = stageOptions.find(i => i.name === $event)?.code" /></view>
        <view class="ppe__field"><text>偏移天数</text><input v-model.number="node.offsetDays" type="number" placeholder="0" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: right" /></view>
      </view>
    </view>

    <view class="jz-actionbar">
      <view class="jz-actionbar__inner">
        <button class="jz-btn jz-btn--plain jz-grow" :disabled="submitting" @tap="save(false)">保存</button>
        <button class="jz-btn jz-btn--primary jz-grow" :loading="submitting" @tap="save(true)">保存并启用</button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.ppe { min-height: 100vh; padding-bottom: 170rpx; background: $jzb-bg-page; }
.ppe__body { padding: 20rpx $jzb-page-pad 30rpx; }
.ppe__card { padding: 24rpx; margin-bottom: 18rpx; }
.ppe__section-title { display: block; margin-bottom: 20rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.ppe__section-head { display: flex; align-items: center; justify-content: space-between; margin: 28rpx 4rpx 14rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.ppe__field { position: relative; display: flex; align-items: center; min-height: 84rpx; border-bottom: 1rpx solid $jzb-border-light; }
.ppe__field:last-child { border-bottom: none; }
.ppe__field > text:first-child { width: 170rpx; flex-shrink: 0; color: $jzb-text-2; font-size: $jzb-font-sm; }
.ppe__field input, .ppe__field picker, .ppe__field > view { flex: 1; color: $jzb-text-1; font-size: $jzb-font-sm; }
.ppe__field--textarea { align-items: flex-start; padding: 20rpx 0; }
.ppe__field--textarea textarea { flex: 1; min-height: 90rpx; color: $jzb-text-1; font-size: $jzb-font-sm; }
.ppe__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18rpx; }
.ppe__grid .ppe__field { border-bottom: none; }
.ppe__field input { flex: 1; min-width: 0; text-align: right; }
.ppe__unit { position: absolute; right: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.ppe__summary { display: flex; align-items: center; justify-content: space-between; padding: 22rpx 24rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.ppe__summary text:last-child { color: $jzb-success; font-size: $jzb-font-lg; font-weight: 750; }
.ppe__summary--error text:last-child { color: $jzb-danger; }
.ppe__node-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10rpx; color: $jzb-text-1; font-weight: 700; }
.ppe__remove { padding: 8rpx; }
</style>
