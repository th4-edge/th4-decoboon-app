<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { materialAssistantApi } from '@/domains/material/api'
import type { MaterialAssistantAnswer, MaterialAssistantAnswerType } from '@/domains/material/model'
import { session } from '@/domains/identity/session'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzSheet from '@/components/JzSheet.vue'
import JzTag from '@/components/JzTag.vue'
import JzIcon from '@/components/JzIcon.vue'

type ContextType = 'project' | 'sheet' | 'purchase' | 'settlement' | 'general'

function displayText(value?: string): string {
  if (!value) return ''
  return value
    .replace(/priceState=Unpriced/g, '采购价未填')
    .replace(/costComplete=false/g, '成本未完整')
    .replace(/Selection 为空或不是 Selected/g, '尚未完成选材')
    .replace(/利润保持 null/g, '利润暂不显示')
    .replace(/利润：null（暂不确认）/g, '利润：暂不显示')
    .replace(/\bSelected\b/g, '已选材')
    .replace(/\bnull\b/g, '暂不显示')
}

const props = withDefaults(defineProps<{
  contextType?: ContextType
  projectId?: string
  sheetId?: string
  contextTitle?: string
  contextSubtitle?: string
}>(), {
  contextType: 'general',
  projectId: '',
  sheetId: '',
  contextTitle: '',
  contextSubtitle: ''
})

const CONTEXT_LABELS: Record<ContextType, string> = {
  project: '项目上下文',
  sheet: '作业单上下文',
  purchase: '采购上下文',
  settlement: '结算上下文',
  general: '材料规则'
}

const ANSWER_META: Record<MaterialAssistantAnswerType, { label: string; color: string }> = {
  EXPLANATION: { label: '规则', color: TOKEN_COLOR.primary },
  LIVE_DATA: { label: '当前情况', color: TOKEN_COLOR.success },
  PERMISSION_DENIED: { label: '无权限', color: TOKEN_COLOR.warning },
  REFUSAL: { label: '不支持', color: TOKEN_COLOR.danger },
  NO_EVIDENCE: { label: '暂不可确认', color: TOKEN_COLOR.text3 }
}

const visible = ref(false)
const question = ref('')
const loading = ref(false)
const suggestionsLoading = ref(false)
const error = ref('')
const answer = ref<MaterialAssistantAnswer | null>(null)
const suggestions = ref<string[]>([])
const boundProjectId = ref('')
const boundSheetId = ref('')
const manuallyCleared = ref(false)
const lastInput = ref<{ question: string; projectId?: string; sheetId?: string; requestId: string; idempotencyKey: string } | null>(null)

const allowedRoles = ['boss', 'storeManager', 'finance', 'designer', 'pm']
const available = computed(() => allowedRoles.includes(String(session.role || '')))
const contextLabel = computed(() => CONTEXT_LABELS[props.contextType] || CONTEXT_LABELS.general)
const bound = computed(() => Boolean(boundProjectId.value || boundSheetId.value))
const answerMeta = computed(() => answer.value ? ANSWER_META[answer.value.answerType] : null)
const canViewCost = computed(() => ['boss', 'storeManager', 'finance'].includes(String(session.role || '')))
const visibleCitations = computed(() => (answer.value?.citations || []).filter((citation) =>
  canViewCost.value || !/成本|定价|利润|priceState|costComplete/.test(`${citation.label || ''} ${citation.detail || ''}`)))
const displayAnswerText = computed(() => displayText(answer.value?.answer))
const canRestore = computed(() => Boolean(props.projectId || props.sheetId))
const contextTitleText = computed(() => {
  if (bound.value) return props.contextTitle || '当前业务对象'
  if (manuallyCleared.value) return '仅解释材料规则'
  return props.contextTitle || '仅解释材料规则'
})
const contextSubtitleText = computed(() => {
  if (bound.value) return props.contextSubtitle || contextLabel.value
  if (manuallyCleared.value || !props.contextTitle) return '未绑定业务单据，仅解释材料规则，不读取实时项目数据'
  return `${props.contextSubtitle || contextLabel.value} · 未绑定业务单据，仅解释材料规则`
})

watch(() => [props.projectId, props.sheetId], () => {
  if (!manuallyCleared.value) syncContext()
})

function syncContext() {
  boundProjectId.value = props.projectId || ''
  boundSheetId.value = props.sheetId || ''
}

function open() {
  if (!available.value) return
  visible.value = true
  prepare()
}

function close() {
  visible.value = false
}

function prepare() {
  answer.value = null
  error.value = ''
  question.value = ''
  lastInput.value = null
  manuallyCleared.value = false
  syncContext()
  void loadSuggestions()
}

async function loadSuggestions() {
  suggestionsLoading.value = true
  try {
    const result = await materialAssistantApi.suggestions({
      projectId: boundProjectId.value || undefined,
      sheetId: boundSheetId.value || undefined,
      contextType: props.contextType
    })
    suggestions.value = result.suggestions
  } catch {
    suggestions.value = []
  } finally {
    suggestionsLoading.value = false
  }
}

function clearContext() {
  manuallyCleared.value = true
  boundProjectId.value = ''
  boundSheetId.value = ''
  answer.value = null
  error.value = ''
  void loadSuggestions()
}

function restoreContext() {
  manuallyCleared.value = false
  syncContext()
  answer.value = null
  error.value = ''
  void loadSuggestions()
}

async function ask(text?: string) {
  const value = String(text ?? question.value).trim()
  if (!value || loading.value) return
  question.value = value
  const input = {
    question: value,
    projectId: boundProjectId.value || undefined,
    sheetId: boundSheetId.value || undefined,
    requestId: `app-material-assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    idempotencyKey: `app-material-assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }
  lastInput.value = input
  loading.value = true
  error.value = ''
  try {
    const result = await materialAssistantApi.ask(input)
    answer.value = result
    if (result.suggestedQuestions.length) suggestions.value = result.suggestedQuestions
  } catch (askError) {
    answer.value = null
    error.value = askError instanceof Error ? askError.message : '材料助手暂不可确认，请稍后重试'
  } finally {
    loading.value = false
  }
}

function retry() {
  if (lastInput.value) void ask(lastInput.value.question)
}
</script>

<template>
  <view v-if="available" class="ma">
    <view class="ma__fab" hover-class="ma__fab--hover" @tap="open">
      <JzIcon name="message" :size="34" :color="TOKEN_COLOR.white" />
      <text>问材料</text>
    </view>

    <JzSheet :visible="visible" title="问材料" max-height="88vh" @close="close">
      <view class="ma__context" :class="{ 'ma__context--unbound': !bound }">
        <view class="ma__context-head">
          <JzTag :text="contextLabel" :color="TOKEN_COLOR.primary" />
          <JzTag text="只读" :color="TOKEN_COLOR.text3" />
          <text v-if="bound" class="ma__bound">已绑定</text>
          <text v-else class="ma__unbound">未绑定业务单据</text>
        </view>
        <text class="ma__context-title">{{ contextTitleText }}</text>
        <text class="ma__context-sub">{{ contextSubtitleText }}</text>
        <text v-if="bound" class="ma__context-action" @tap="clearContext">清除上下文</text>
        <text v-else-if="canRestore" class="ma__context-action" @tap="restoreContext">恢复当前页面上下文</text>
      </view>

      <scroll-view scroll-y class="ma__thread">
        <view v-if="loading" class="ma__hint">
          <view class="ma__dot"></view>
          <text>正在校核材料事实…</text>
        </view>

        <view v-else-if="error" class="ma__error">
          <text class="ma__error-title">材料助手暂不可确认</text>
          <text class="ma__error-text">{{ error }}</text>
          <button class="jz-btn jz-btn--ghost jz-btn--sm ma__retry" @tap="retry">重试</button>
        </view>

        <view v-else-if="answer" class="ma__answer">
          <view class="ma__answer-meta">
            <JzTag v-if="answerMeta" :text="answerMeta.label" :color="answerMeta.color" />
            <text v-if="answer.readOnly">只读</text>
          </view>
          <text class="ma__answer-text">{{ displayAnswerText }}</text>

          <view v-if="visibleCitations.length" class="ma__section">
            <text class="ma__section-title">依据</text>
            <view v-for="citation in visibleCitations" :key="`${citation.type}-${citation.id}`" class="ma__citation">
              <view class="ma__citation-body">
                <text class="ma__citation-label">{{ citation.label || citation.type }}</text>
                <text v-if="citation.detail" class="ma__citation-detail">{{ displayText(citation.detail) }}</text>
              </view>
            </view>
          </view>

          <view v-if="answer.nextActions.length" class="ma__section">
            <text class="ma__section-title">下一步</text>
            <view v-for="(action, index) in answer.nextActions" :key="action" class="ma__next">
              <text class="ma__next-index">{{ index + 1 }}</text>
              <text class="ma__next-text">{{ action }}</text>
            </view>
          </view>
        </view>

        <view v-else class="ma__intro">
          <text class="ma__intro-title">基于当前上下文问一个材料问题</text>
          <text class="ma__intro-text">回答基于当前页面材料和业务规则；依据不足或超出权限时会明确说明。</text>
        </view>
      </scroll-view>

      <view v-if="suggestions.length" class="ma__suggestions">
        <text class="ma__section-title">{{ answer ? '建议追问' : '可以这样问' }}</text>
        <view class="ma__chips">
          <view v-for="item in suggestions" :key="item" class="ma__chip" :class="{ 'ma__chip--disabled': loading }" @tap="ask(item)">{{ item }}</view>
        </view>
        <text v-if="suggestionsLoading" class="ma__suggestions-loading">正在加载建议问题…</text>
      </view>

      <view class="ma__composer">
        <textarea v-model="question" class="ma__input" maxlength="500" :disabled="loading" placeholder="例如：这个项目的材料为什么还没有闭环？" />
        <view class="ma__composer-foot">
          <text class="ma__composer-hint">单轮问答 · 只读</text>
          <button class="jz-btn jz-btn--primary jz-btn--sm" :disabled="!question.trim() || loading" @tap="ask()">发送</button>
        </view>
      </view>
      <text class="ma__boundary">助手只提供信息查询，不会审批、付款、删除或修改权限；金额和成本以当前业务记录为准。</text>
    </JzSheet>
  </view>
</template>

<style lang="scss" scoped>
.ma__fab {
  position: fixed;
  right: 24rpx;
  bottom: calc(40rpx + var(--window-bottom, 0px) + env(safe-area-inset-bottom));
  z-index: $jzb-z-fixed;
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 18rpx 28rpx;
  border-radius: $jzb-radius-pill;
  background: $jzb-primary;
  color: $jzb-text-inverse;
  font-size: $jzb-font-sm;
  font-weight: 650;
  box-shadow: 0 14rpx 34rpx rgba(11, 44, 41, 0.24);
}
.ma__fab--hover { background: $jzb-primary-dark; }

.ma__context {
  padding: 20rpx;
  border: 1rpx solid $jzb-primary-light;
  border-radius: $jzb-radius-md;
  background: $jzb-primary-lightest;
}
.ma__context--unbound {
  border-color: $jzb-warning-soft;
  background: $jzb-warning-soft;
}
.ma__context-head { display: flex; align-items: center; flex-wrap: wrap; gap: 10rpx; }
.ma__bound { font-size: $jzb-font-xs; font-weight: 600; color: $jzb-success; }
.ma__unbound { font-size: $jzb-font-xs; font-weight: 600; color: $jzb-warning; }
.ma__context-title { display: block; margin-top: 12rpx; font-size: $jzb-font-md; font-weight: 700; color: $jzb-text-1; }
.ma__context-sub { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; line-height: 1.6; color: $jzb-text-2; }
.ma__context-action { display: inline-block; margin-top: 10rpx; font-size: $jzb-font-xs; font-weight: 600; color: $jzb-primary-dark; }

.ma__thread { max-height: 46vh; margin-top: 16rpx; }

.ma__hint, .ma__intro, .ma__error {
  padding: 22rpx;
  border: 1rpx dashed $jzb-border;
  border-radius: $jzb-radius-md;
  background: $jzb-bg-hover;
}
.ma__hint { display: flex; align-items: center; gap: 12rpx; font-size: $jzb-font-sm; color: $jzb-text-2; }
.ma__dot { width: 16rpx; height: 16rpx; border-radius: 50%; background: $jzb-primary; animation: ma-pulse 0.9s ease-in-out infinite alternate; }
@keyframes ma-pulse { from { opacity: 0.35; } to { opacity: 1; } }
.ma__intro-title { display: block; font-size: $jzb-font-sm; font-weight: 650; color: $jzb-text-1; }
.ma__intro-text { display: block; margin-top: 8rpx; font-size: $jzb-font-xs; line-height: 1.7; color: $jzb-text-2; }
.ma__error { border-color: $jzb-danger-soft; background: $jzb-danger-soft; }
.ma__error-title { display: block; font-size: $jzb-font-sm; font-weight: 650; color: $jzb-danger; }
.ma__error-text { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; line-height: 1.6; color: $jzb-text-2; }
.ma__retry { margin-top: 14rpx; }

.ma__answer { padding: 22rpx; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-md; background: $jzb-bg-card; }
.ma__answer-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 12rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.ma__answer-text { display: block; margin-top: 14rpx; font-size: $jzb-font-sm; line-height: 1.75; color: $jzb-text-1; white-space: pre-wrap; word-break: break-word; }
.ma__section { margin-top: 20rpx; padding-top: 16rpx; border-top: 1rpx solid $jzb-border-light; }
.ma__section-title { display: block; margin-bottom: 10rpx; font-size: $jzb-font-xs; font-weight: 650; color: $jzb-text-2; }
.ma__citation { display: flex; align-items: flex-start; gap: 12rpx; padding: 10rpx 0; border-bottom: 1rpx dashed $jzb-border-light; }
.ma__citation:last-child { border-bottom: none; }
.ma__citation-id { flex: none; padding: 2rpx 8rpx; border-radius: 6rpx; background: $jzb-bg-hover; font-size: 20rpx; color: $jzb-text-3; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.ma__citation-body { flex: 1; min-width: 0; }
.ma__citation-label { display: block; font-size: $jzb-font-xs; font-weight: 600; color: $jzb-text-1; }
.ma__citation-detail { display: block; margin-top: 2rpx; font-size: $jzb-font-xs; line-height: 1.55; color: $jzb-text-2; }
.ma__tool { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; padding: 8rpx 0; }
.ma__tool-name { flex: 1; min-width: 0; font-size: $jzb-font-xs; color: $jzb-text-2; word-break: break-all; }
.ma__next { display: flex; align-items: flex-start; gap: 10rpx; padding: 6rpx 0; }
.ma__next-index { flex: none; width: 32rpx; height: 32rpx; line-height: 32rpx; text-align: center; border-radius: 50%; background: $jzb-primary-lighter; font-size: 20rpx; font-weight: 700; color: $jzb-primary-dark; }
.ma__next-text { flex: 1; min-width: 0; font-size: $jzb-font-xs; line-height: 1.6; color: $jzb-text-2; }

.ma__suggestions { margin-top: 18rpx; }
.ma__chips { display: flex; flex-wrap: wrap; gap: 10rpx; }
.ma__chip { padding: 10rpx 18rpx; border: 1rpx solid $jzb-primary-light; border-radius: $jzb-radius-pill; background: $jzb-primary-lightest; font-size: $jzb-font-xs; line-height: 1.45; color: $jzb-primary-dark; }
.ma__chip--disabled { opacity: 0.5; }
.ma__suggestions-loading { display: block; margin-top: 8rpx; font-size: 20rpx; color: $jzb-text-3; }

.ma__composer { position: sticky; bottom: 0; margin-top: 18rpx; padding-top: 12rpx; background: $jzb-bg-card; }
.ma__input { width: 100%; min-height: 120rpx; padding: 16rpx; box-sizing: border-box; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-md; background: $jzb-bg-hover; font-size: $jzb-font-sm; line-height: 1.6; color: $jzb-text-1; }
.ma__composer-foot { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin-top: 10rpx; }
.ma__composer-hint { font-size: 20rpx; color: $jzb-text-3; }
.ma__boundary { display: block; margin-top: 10rpx; font-size: 20rpx; line-height: 1.5; color: $jzb-text-3; }
</style>
