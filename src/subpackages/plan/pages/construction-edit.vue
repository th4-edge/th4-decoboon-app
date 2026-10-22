<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { toast, toastError } from '@/composables/toast'
import { isLoggedIn, session } from '@/domains/identity/session'
import { planApi } from '@/domains/plan/api'
import type { ConstructionPlanTemplate, ConstructionStageTemplate } from '@/domains/plan/model'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

const templateId = ref('')
const name = ref('')
const description = ref('')
const sort = ref(0)
const stages = ref<ConstructionStageTemplate[]>([])
const loading = ref(false)
const submitting = ref(false)

const acceptanceOptions = [
  { value: 'None', label: '无需验收' },
  { value: 'ConstructionDone', label: '施工完成' },
  { value: 'AcceptanceDone', label: '验收完成' }
]
const totalDays = computed(() => stages.value.reduce((sum, stage) => sum + Number(stage.defaultDays || 0), 0))
const canSubmit = computed(() => name.value.trim().length > 0 && stages.value.length > 0
  && stages.value.every((stage) => stage.name.trim() && stage.code.trim() && Number(stage.defaultDays) > 0)
  && new Set(stages.value.map((stage) => stage.code.trim())).size === stages.value.length)
const pageTitle = computed(() => templateId.value ? '编辑施工计划' : '新建施工计划')

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  if (session.role !== 'boss') { uni.reLaunch({ url: P.mine }); return }
  templateId.value = String(query?.id || '')
  void load()
})

async function load() {
  loading.value = true
  try {
    const catalog = await planApi.constructionManagement()
    let current = templateId.value ? catalog.constructionPlans.find((item) => item.templateId === templateId.value) : undefined
    // 历史坑：管理页与合同目录可能取到不同模板来源，编辑页需回退全量目录，避免误报“模板不存在”。
    if (!current && templateId.value) {
      const fallback = await planApi.catalog()
      current = fallback.constructionPlans.find((item) => item.templateId === templateId.value)
    }
    if (current) apply(current)
    else if (templateId.value) {
      toast('施工计划模板不存在', 'none')
      setTimeout(() => uni.navigateBack(), 500)
    } else {
      name.value = '企业施工计划'
      stages.value = [newStage(1)]
    }
  } catch (error) {
    toastError(error, '施工计划模板加载失败')
  } finally {
    loading.value = false
  }
}

function apply(plan: ConstructionPlanTemplate) {
  name.value = plan.name
  description.value = plan.description
  sort.value = plan.sort
  stages.value = plan.stages.map((stage) => ({ ...stage }))
}

function newStage(index: number): ConstructionStageTemplate {
  return {
    code: `STAGE_${index}`,
    name: `阶段${index}`,
    defaultDays: 1,
    acceptanceMode: index === 1 ? 'None' : 'ConstructionDone',
    sort: index,
    description: ''
  }
}

function addStage() { stages.value.push(newStage(stages.value.length + 1)) }
function removeStage(index: number) {
  stages.value.splice(index, 1)
  stages.value.forEach((stage, i) => { stage.sort = i + 1 })
}

function acceptanceLabel(value: string) {
  return acceptanceOptions.find((item) => item.value === value)?.label || value
}

function payload() {
  return {
    templateId: templateId.value || undefined,
    name: name.value.trim(),
    description: description.value.trim(),
    sort: sort.value,
    stages: stages.value.map((stage, index) => ({
      code: stage.code || `STAGE_${index + 1}`,
      name: stage.name.trim(),
      defaultDays: Number(stage.defaultDays || 1),
      acceptanceMode: stage.acceptanceMode,
      sort: index + 1,
      description: stage.description?.trim() || undefined
    }))
  }
}

async function save(publish = false) {
  if (!canSubmit.value) {
    toast('请补齐模板名称和施工阶段', 'none')
    return
  }
  submitting.value = true
  try {
    const result = templateId.value
      ? await planApi.updateConstruction(payload())
      : await planApi.saveConstruction(payload())
    templateId.value = result.templateId || templateId.value
    if (publish && templateId.value) await planApi.publishConstruction(templateId.value)
    toast(publish ? '模板已保存并启用' : '模板已保存', 'success')
    setTimeout(() => uni.navigateBack(), 500)
  } catch (error) {
    toastError(error, '保存施工计划失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="cpe">
    <JzPageHeader :title="pageTitle" subtitle="阶段和工期内置于项目，历史合同记录不受影响" />
    <view class="cpe__body">
      <view class="cpe__card jz-card">
        <text class="cpe__section-title">模板信息</text>
        <view class="cpe__field"><text>模板名称</text><input v-model="name" maxlength="128" placeholder="例如：企业标准八阶段" /></view>
        <view class="cpe__field cpe__field--textarea"><text>说明</text><textarea v-model="description" maxlength="512" auto-height placeholder="描述适用项目或施工组织方式" /></view>
        <view class="cpe__field"><text>排序</text><input v-model.number="sort" type="number" placeholder="0" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" /></view>
      </view>

      <view class="cpe__summary jz-card"><text>标准总工期</text><text>{{ totalDays }} 天</text></view>
      <view class="cpe__section-head"><text>施工阶段</text><button class="jz-btn jz-btn--plain jz-btn--sm" @tap="addStage">添加阶段</button></view>
      <view v-for="(stage, index) in stages" :key="stage.code" class="cpe__card cpe__stage jz-card">
        <view class="cpe__stage-head"><text>第 {{ index + 1 }} 阶段</text><view class="cpe__remove" @tap="removeStage(index)"><JzIcon name="trash" :size="28" :color="TOKEN_COLOR.danger" /></view></view>
        <view class="cpe__field"><text>阶段名称</text><input v-model="stage.name" maxlength="128" placeholder="例如：水电施工" /></view>
        <view class="cpe__field"><text>阶段编码</text><input v-model="stage.code" maxlength="64" placeholder="例如：WATER_ELECTRIC" /></view>
        <view class="cpe__grid">
          <view class="cpe__field"><text>标准工期</text><input v-model.number="stage.defaultDays" type="number" placeholder="1" class="jz-numeric-input" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" /><text class="cpe__unit">天</text></view>
          <view class="cpe__field"><text>验收方式</text><JzSelectField variant="plain" :display="acceptanceLabel(stage.acceptanceMode)" :range="acceptanceOptions.map(i => i.label)" :index="Math.max(0, acceptanceOptions.findIndex(i => i.value === stage.acceptanceMode))" @change="stage.acceptanceMode = acceptanceOptions.find(i => i.label === $event)?.value || stage.acceptanceMode" /></view>
        </view>
        <view class="cpe__field cpe__field--textarea"><text>阶段说明</text><textarea v-model="stage.description" maxlength="512" auto-height placeholder="说明施工范围和完成条件" /></view>
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
.cpe { min-height: 100vh; padding-bottom: 170rpx; background: $jzb-bg-page; }
.cpe__body { padding: 20rpx $jzb-page-pad 30rpx; }
.cpe__card { padding: 24rpx; margin-bottom: 18rpx; }
.cpe__section-title { display: block; margin-bottom: 20rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.cpe__section-head { display: flex; align-items: center; justify-content: space-between; margin: 28rpx 4rpx 14rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.cpe__field { position: relative; display: flex; align-items: center; min-height: 84rpx; border-bottom: 1rpx solid $jzb-border-light; }
.cpe__field:last-child { border-bottom: none; }
.cpe__field > text:first-child { width: 170rpx; flex-shrink: 0; color: $jzb-text-2; font-size: $jzb-font-sm; }
.cpe__field input, .cpe__field picker, .cpe__field > view { flex: 1; color: $jzb-text-1; font-size: $jzb-font-sm; }
.cpe__field--textarea { align-items: flex-start; padding: 20rpx 0; }
.cpe__field--textarea textarea { flex: 1; min-height: 90rpx; color: $jzb-text-1; font-size: $jzb-font-sm; }
.cpe__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18rpx; }
.cpe__grid .cpe__field { border-bottom: none; }
.cpe__field input { flex: 1; min-width: 0; text-align: right; }
.cpe__unit { position: absolute; right: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cpe__summary { display: flex; align-items: center; justify-content: space-between; padding: 22rpx 24rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.cpe__summary text:last-child { color: $jzb-primary-dark; font-size: $jzb-font-lg; font-weight: 750; }
.cpe__stage-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10rpx; color: $jzb-text-1; font-weight: 700; }
.cpe__remove { padding: 8rpx; }
</style>
