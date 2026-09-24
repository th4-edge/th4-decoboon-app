<script setup lang="ts">
import { TOKEN_COLOR, STATUS_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can, isCustomer } from '@/roles/permission'
import { ROLE_META } from '@/roles/catalog'
import type { Acceptance, AcceptanceRound, RectificationType } from '@/domains/acceptance/model'
import type { ProjectStage } from '@/domains/project/model'
import { ACCEPT_RESULT_META } from '@/domains/acceptance/meta'
import { projectApi } from '@/domains/project/api'
import { acceptanceApi, acceptanceRoundApi } from '@/domains/acceptance/api'
import { fileApi } from '@/domains/file/api'
import JzIcon from '@/components/JzIcon.vue'
import JzEmployeeAvatar from '@/components/JzEmployeeAvatar.vue'
import { toast, toastError, loading, hideLoading } from '@/composables/toast'
import JzTag from '@/components/JzTag.vue'

const stageId = ref('')
const stage = ref<ProjectStage | null>(null)
const acceptance = ref<Acceptance | null>(null)
const isCust = computed(() => isCustomer(session.role))

const result = ref<Acceptance['result']>('pass')
const content = ref('')
const images = ref<string[]>([])
const rejectOpen = ref(false)
const rejectIssuesText = ref('')
const rectificationType = ref<RectificationType>('construction')
const rectificationIssueImages = ref<string[]>([])
/** 整改闭环：append-only 轮次、本轮整改说明与整改后照片 */
const rounds = ref<AcceptanceRound[]>([])
const rectificationNote = ref('')
const rectificationImages = ref<string[]>([])
const isResubmit = computed(() => !!acceptance.value && acceptance.value.customerStatus === 'rejected')

onLoad((q) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  stageId.value = q?.stageId || ''
  load()
})
async function load() {
  try {
    stage.value = await projectApi.stage(stageId.value) || null
    acceptance.value = await acceptanceApi.ofStage(stageId.value) || null
    if (acceptance.value) {
      content.value = acceptance.value.content
      rounds.value = await acceptanceRoundApi.rounds(acceptance.value.id).catch(() => [])
    }
  } catch (error) {
    stage.value = null
    acceptance.value = null
    toastError(error, '验收单加载失败，请返回后重试')
  }
}

const waitingCustomer = computed(() => !!acceptance.value && acceptance.value.customerStatus === 'waiting' && isCust.value)
const canSubmit = computed(() => !isCust.value && can(session.role || 'boss', 'act:acceptRequest'))
const canResubmit = computed(() => canSubmit.value && !!acceptance.value && acceptance.value.customerStatus === 'rejected')
/** 内部查看既有验收单：待业主确认 / 已确认 / 已驳回 */
const showSummary = computed(() => !!acceptance.value && (!canSubmit.value || waitingCustomer.value || acceptance.value.customerStatus === 'confirmed'))
const summaryText = computed(() => {
  if (!acceptance.value) return ''
  const map: Record<string, string> = {
    waiting: isCust.value ? '业主确认页' : '已提交，等待业主确认',
    confirmed: '业主已确认，阶段将自动完结',
    rejected: '业主已驳回，请整改后重新提交'
  }
  return map[acceptance.value.customerStatus] || ''
})
const summaryTag = computed(() => {
  if (!acceptance.value) return { label: '', color: STATUS_COLOR.todo }
  const map: Record<string, { label: string; color: string }> = {
    waiting: { label: '待确认', color: STATUS_COLOR.pending },
    confirmed: { label: '已确认', color: STATUS_COLOR.done },
    rejected: { label: '整改中', color: STATUS_COLOR.blocked }
  }
  return map[acceptance.value.customerStatus]
})

const rectificationOwner = computed(() => acceptance.value?.projectManager || null)
const rectificationOwnerLabel = computed(() => {
  const owner = rectificationOwner.value
  return owner ? `${owner.name}（${owner.title || ROLE_META[owner.role]?.short || owner.role}）` : '项目未指定项目经理'
})
const RECTIFICATION_TYPES: Array<{ value: RectificationType; label: string; dueDays: number }> = [
  { value: 'construction', label: '施工整改', dueDays: 3 },
  { value: 'design', label: '设计整改', dueDays: 5 }
]
const rectificationTypeIndex = computed(() =>
  Math.max(0, RECTIFICATION_TYPES.findIndex((item) => item.value === rectificationType.value))
)
const rectificationTypeMeta = computed(() =>
  RECTIFICATION_TYPES[rectificationTypeIndex.value] || RECTIFICATION_TYPES[0]
)

function openReject() {
  rejectOpen.value = true
}
function closeReject() { rejectOpen.value = false }
function pickRectificationType(event: { detail: { value: string | number } }) {
  const option = RECTIFICATION_TYPES[Number(event.detail.value)]
  rectificationType.value = option?.value || 'construction'
}
function rejectIssues() {
  return rejectIssuesText.value.split(/[\n,，;；]/).map((item) => item.trim()).filter(Boolean)
}

async function confirm(pass: boolean) {
  if (!isCust.value || !acceptance.value) return
  const issues = rejectIssues()
  if (!pass && !issues.length) { toast('请填写需要整改的问题'); return }
  if (!pass && !rectificationOwner.value) { toast('当前项目未指定项目经理，无法提交整改要求'); return }
  loading('提交确认…')
  try {
    const uploadedIssueImages = pass ? [] : await Promise.all(rectificationIssueImages.value.map(async (path) => (
      fileApi.isManaged(path)
        ? fileApi.storagePath(path) || path
        : (await fileApi.upload('Acceptance', path, { projectId: stage.value?.projectId })).path
    )))
    await acceptanceApi.confirm(
      acceptance.value.id,
      pass,
      undefined,
      pass ? undefined : issues,
      pass ? undefined : rectificationType.value,
      pass ? undefined : uploadedIssueImages
    )
    hideLoading()
    toast(pass ? '验收已确认，阶段完成' : '已驳回，待整改后重新验收', 'success')
    setTimeout(() => uni.navigateBack(), 400)
  } catch (error) {
    hideLoading()
    toastError(error, '验收提交失败，请稍后重试')
  }
}

const ROUND_LABEL: Record<AcceptanceRound['result'], string> = {
  pending: '待业主确认', confirmed: '已确认', rejected: '整改中'
}
const ROUND_COLOR: Record<AcceptanceRound['result'], string> = {
  pending: STATUS_COLOR.pending, confirmed: STATUS_COLOR.done, rejected: STATUS_COLOR.blocked
}
function roundLabel(r: AcceptanceRound['result']) { return ROUND_LABEL[r] }
function roundColor(r: AcceptanceRound['result']) { return ROUND_COLOR[r] }
function previewRound(urls: string[], current: string) { uni.previewImage({ urls, current }) }

function chooseImage() {
  const remain = 9 - images.value.length
  if (remain <= 0) return
  uni.chooseImage({ count: remain, success: (res) => { images.value = [...images.value, ...res.tempFilePaths] } })
}
function removeImage(i: number) { images.value.splice(i, 1) }
function preview(i: number) { uni.previewImage({ urls: images.value, current: images.value[i] }) }
function previewFull(im: string) { uni.previewImage({ urls: acceptance.value?.images || [], current: im }) }
function chooseRectification() {
  const remain = 9 - rectificationImages.value.length
  if (remain <= 0) return
  uni.chooseImage({ count: remain, success: (res) => { rectificationImages.value = [...rectificationImages.value, ...res.tempFilePaths] } })
}
function removeRectification(i: number) { rectificationImages.value.splice(i, 1) }
function previewRectification(i: number) { uni.previewImage({ urls: rectificationImages.value, current: rectificationImages.value[i] }) }
function chooseRectificationIssueImage() {
  const remain = 9 - rectificationIssueImages.value.length
  if (remain <= 0) return
  uni.chooseImage({
    count: remain,
    success: (res) => { rectificationIssueImages.value = [...rectificationIssueImages.value, ...res.tempFilePaths] }
  })
}
function removeRectificationIssueImage(i: number) { rectificationIssueImages.value.splice(i, 1) }
function previewRectificationIssueImage(i: number) {
  uni.previewImage({ urls: rectificationIssueImages.value, current: rectificationIssueImages.value[i] })
}
function previewAcceptanceIssueImage(im: string) {
  uni.previewImage({ urls: acceptance.value?.rectificationIssueImages || [], current: im })
}
function resubmit() {
  content.value = '整改完成，重新提交验收。'
}

async function submit() {
  const emp = session.emp
  if (!stage.value || !emp) return
  if (!content.value.trim()) { toast('请填写验收说明'); return }
  if (isResubmit.value && !rectificationNote.value.trim()) { toast('请填写整改说明，说明针对上一轮问题做了什么'); return }
  if (isResubmit.value && !rectificationImages.value.length) { toast('请上传整改后照片'); return }
  loading('提交验收…')
  try {
    const uploaded = await Promise.all(images.value.map(async (path) => (
      fileApi.isManaged(path)
        ? fileApi.storagePath(path) || path
        : (await fileApi.upload('Acceptance', path, { projectId: stage.value?.projectId })).path
    )))
    const uploadedRectification = await Promise.all(rectificationImages.value.map(async (path) => (
      fileApi.isManaged(path)
        ? fileApi.storagePath(path) || path
        : (await fileApi.upload('Acceptance', path, { projectId: stage.value?.projectId })).path
    )))
    await acceptanceApi.submit({
      stageId: stage.value.id,
      result: result.value,
      content: content.value.trim(),
      images: uploaded,
      submitBy: emp,
      rectificationNote: isResubmit.value ? rectificationNote.value.trim() : undefined,
      rectificationImages: isResubmit.value ? uploadedRectification : undefined
    })
    hideLoading()
    toast('已提交，等待业主确认', 'success')
    setTimeout(() => uni.navigateBack(), 400)
  } catch (error) {
    hideLoading()
    toast(error instanceof Error ? error.message : '验收提交失败，请重试')
  }
}
</script>

<template>
  <view class="ac" v-if="stage">
    <view class="jz-card ac__head">
      <view class="jz-between">
        <text class="ac__title">{{ stage.sort }}. {{ stage.name }} · 验收</text>
        <JzTag :text="acceptance ? summaryTag.label : '待验收'" :color="acceptance ? summaryTag.color : STATUS_COLOR.pending" />
      </view>
      <text class="ac__sub">验收通过后，阶段自动完结并进入下一阶段（同频闭环）</text>
    </view>

    <!-- ① 验收单汇总（含业主确认拍板） -->
    <view v-if="acceptance" class="jz-card ac__card">
      <text class="ac__status">{{ summaryText }}</text>
      <text class="ac__label">验收结论</text>
      <text class="ac__pass-text">{{ ACCEPT_RESULT_META[acceptance.result].label }}</text>
      <text class="ac__label">验收说明</text>
      <text class="ac__content">{{ acceptance.content }}</text>
      <text v-if="acceptance.issues && acceptance.issues.length" class="ac__label">整改项</text>
      <text v-for="(it, i) in acceptance.issues" :key="i" class="ac__issue">· {{ it }}</text>
      <view v-if="acceptance.rectificationTypeName" class="ac__done-row"><text class="ac__done-label">整改类型</text><text class="ac__done-val">{{ acceptance.rectificationTypeName }}<text v-if="acceptance.rectificationDueDate"> · 截止 {{ acceptance.rectificationDueDate }}</text></text></view>
      <view v-if="acceptance.rectificationIssueImages && acceptance.rectificationIssueImages.length" class="ac__round-block">
        <text class="ac__round-label">整改问题图片</text>
        <view class="ac__imgs">
          <image v-for="(im, i) in acceptance.rectificationIssueImages" :key="`issue-${i}`" :src="im" mode="aspectFill" class="ac__img ac__img--sm" @tap="previewAcceptanceIssueImage(im)" />
        </view>
      </view>
      <view v-if="acceptance.images && acceptance.images.length" class="ac__label">现场照片</view>
      <view v-if="acceptance.images && acceptance.images.length" class="ac__imgs">
        <image v-for="(im, i) in acceptance.images" :key="i" :src="im" mode="aspectFill" class="ac__img" @tap="previewFull(im)" />
      </view>
      <view class="ac__done-row">
        <text class="ac__done-label">提交人</text>
        <view v-if="acceptance.submitBy" class="ac__person">
          <JzEmployeeAvatar :src="acceptance.submitBy.avatarUrl || ''" :name="acceptance.submitBy.name" :role="acceptance.submitBy.role" :status="acceptance.submitBy.status" :size="44" />
          <text class="ac__done-val">{{ acceptance.submitBy.name }}（{{ acceptance.submitBy.title || '-' }}）</text>
        </view>
        <text v-else class="ac__done-val">-</text>
      </view>
      <view class="ac__done-row"><text class="ac__done-label">提交时间</text><text class="ac__done-val">{{ acceptance.createdAt }}</text></view>
      <view v-if="acceptance.confirmAt" class="ac__done-row"><text class="ac__done-label">业主确认</text><text class="ac__done-val">{{ acceptance.confirmAt }}</text></view>

      <!-- 业主确认大按钮 -->
      <view v-if="waitingCustomer && !rejectOpen" class="ac__confirm">
        <button class="jz-btn jz-btn--danger-ghost jz-grow" @tap="openReject"><JzIcon name="close" :size="28" :color="TOKEN_COLOR.danger" /><text>有异议，驳回</text></button>
        <button class="jz-btn jz-btn--primary jz-grow" style="margin-left:20rpx;" @tap="confirm(true)"><JzIcon name="check" :size="30" :color="TOKEN_COLOR.white" :stroke-width="2.4" /><text>确认验收</text></button>
      </view>
      <view v-if="waitingCustomer && rejectOpen" class="ac__reject-form">
        <text class="ac__reject-title">登记整改要求</text>
        <text class="ac__label">问题清单 <text class="req">*</text></text>
        <textarea v-model="rejectIssuesText" class="ac__ta ac__ta--sm" placeholder="一行一项，例：阳台地漏周边收口不严" maxlength="500" />
        <text class="ac__label">整改责任人</text>
        <view class="ac__picker ac__picker--readonly" :class="{ 'ac__picker--missing': !rectificationOwner }">
          <text>{{ rectificationOwnerLabel }}</text>
        </view>
        <text class="ac__label">整改类型 <text class="req">*</text></text>
        <picker :range="RECTIFICATION_TYPES.map(item => `${item.label}（${item.dueDays}天）`)" :value="rectificationTypeIndex" @change="pickRectificationType">
          <view class="ac__picker">
            <text>{{ rectificationTypeMeta.label }}（{{ rectificationTypeMeta.dueDays }}天）</text>
            <JzIcon name="chevron-down" :size="26" :color="TOKEN_COLOR.text3" />
          </view>
        </picker>
        <text class="ac__auto-hint">截止日期由系统按整改类型自动设置，当前预计 {{ rectificationTypeMeta.dueDays }} 天，业主和业务人员不可修改。</text>
        <text class="ac__label">整改问题图片（{{ rectificationIssueImages.length }}/9）</text>
        <view class="ac__imgs">
          <view v-for="(im, i) in rectificationIssueImages" :key="`issue-${i}`" class="ac__img ac__img--rel">
            <image :src="im" mode="aspectFill" @tap="previewRectificationIssueImage(i)" />
            <view class="ac__del" @tap.stop="removeRectificationIssueImage(i)"><JzIcon name="close" :size="22" :color="TOKEN_COLOR.white" :stroke-width="2.4" /></view>
          </view>
          <view v-if="rectificationIssueImages.length < 9" class="ac__img ac__add" @tap="chooseRectificationIssueImage">
            <JzIcon name="plus" :size="42" :color="TOKEN_COLOR.text3" />
          </view>
        </view>
        <view class="ac__reject-actions">
          <button class="jz-btn jz-btn--plain jz-grow" @tap="closeReject">取消</button>
          <button class="jz-btn jz-btn--danger-ghost jz-grow" style="margin-left:20rpx;" @tap="confirm(false)">提交驳回</button>
        </view>
      </view>
      <text v-if="waitingCustomer && !rejectOpen" class="ac__tip">业主确认后，验收结果将同步给项目经理与企业负责人</text>
      <view v-else-if="acceptance.customerStatus === 'rejected' && canSubmit" class="ac__resubmit">
        <button class="jz-btn jz-btn--plain jz-btn--block ac__resubmit-btn" @tap="resubmit"><text>整改完成，重新提交验收</text><JzIcon name="chevron-down" :size="26" :color="TOKEN_COLOR.primary" /></button>
      </view>
    </view>

    <!-- ①.5 轮次时间线（append-only：历史结论保留，不覆盖） -->
    <view v-if="rounds.length" class="jz-card ac__card">
      <text class="ac__form-title">验收与整改记录（{{ rounds.length }} 轮）</text>
      <text class="ac__sub">同一阶段复用同一张验收单；每轮结论保留并追加，历史不可修改。</text>
      <view v-for="r in rounds" :key="r.id" class="ac__round">
        <view class="jz-between">
          <text class="ac__round-no">第 {{ r.roundNo }} 轮</text>
          <JzTag :text="roundLabel(r.result)" :color="roundColor(r.result)" />
        </view>
        <view class="ac__round-submitter">
          <JzEmployeeAvatar v-if="r.submitBy" :src="r.submitBy.avatarUrl || ''" :name="r.submitBy.name" :role="r.submitBy.role" :status="r.submitBy.status" :size="40" />
          <text class="ac__round-meta">{{ r.submitBy?.name || '—' }} · {{ r.submittedAt || '—' }}</text>
        </view>
        <view v-if="r.rectificationNote" class="ac__round-block">
          <text class="ac__round-label">整改说明</text>
          <text class="ac__round-text">{{ r.rectificationNote }}</text>
        </view>
        <view v-if="r.rectificationEvidence && r.rectificationEvidence.length" class="ac__round-block">
          <text class="ac__round-label">整改后照片</text>
          <view class="ac__imgs">
            <image v-for="(im, i) in r.rectificationEvidence" :key="i" :src="im" mode="aspectFill" class="ac__img ac__img--sm" @tap="previewRound(r.rectificationEvidence || [], im)" />
          </view>
        </view>
        <view v-if="r.issues && r.issues.length" class="ac__round-block">
          <text class="ac__round-label">本轮问题</text>
          <text v-for="(it, i) in r.issues" :key="i" class="ac__issue">· {{ it }}</text>
        </view>
        <view v-if="r.rectificationIssueImages && r.rectificationIssueImages.length" class="ac__round-block">
          <text class="ac__round-label">整改问题图片</text>
          <view class="ac__imgs">
            <image v-for="(im, i) in r.rectificationIssueImages" :key="i" :src="im" mode="aspectFill" class="ac__img ac__img--sm" @tap="previewRound(r.rectificationIssueImages || [], im)" />
          </view>
        </view>
        <text v-if="r.conclusion" class="ac__round-text">{{ r.conclusion }}</text>
        <view v-if="r.confirmedAt" class="ac__done-row"><text class="ac__done-label">结论时间</text><text class="ac__done-val">{{ r.confirmedAt }}</text></view>
        <view v-if="r.rectificationOwner" class="ac__done-row">
          <text class="ac__done-label">整改责任人</text>
          <view class="ac__person">
            <JzEmployeeAvatar :src="r.rectificationOwner.avatarUrl || ''" :name="r.rectificationOwner.name" :role="r.rectificationOwner.role" :status="r.rectificationOwner.status" :size="44" />
            <text class="ac__done-val">{{ r.rectificationOwner.name }}<text v-if="r.rectificationTypeName"> · {{ r.rectificationTypeName }}</text><text v-if="r.rectificationDueDate"> · 截止 {{ r.rectificationDueDate }}</text></text>
          </view>
        </view>
      </view>
    </view>

    <!-- ② 提交/重新提交表单 -->
    <view v-if="canSubmit && (!acceptance || acceptance.customerStatus === 'rejected')" class="jz-card ac__card">
      <text class="ac__form-title">{{ acceptance ? '重新提交验收' : '提交阶段验收' }}</text>
      <text class="ac__label">验收结论</text>
      <view class="jz-row ac__results">
        <view v-for="r in (['pass', 'rectify', 'reject'] as const)" :key="r" class="ac__result" :class="{ 'ac__result--on': result === r }" @tap="result = r">
          {{ ACCEPT_RESULT_META[r].label }}
        </view>
      </view>
      <text class="ac__label">验收说明 <text class="req">*</text></text>
      <textarea v-model="content" class="ac__ta" placeholder="描述验收范围、自检结果、数据（如空鼓率、闭水时长）" maxlength="500" />
      <template v-if="acceptance && acceptance.customerStatus === 'rejected'">
        <text class="ac__label">整改说明 <text class="req">*</text></text>
        <textarea v-model="rectificationNote" class="ac__ta ac__ta--sm" placeholder="说明针对上一轮问题做了什么整改，例：阳台地漏周边重新收口并做闭水试验" maxlength="500" />
        <text class="ac__label">整改后照片 <text class="req">*</text>（{{ rectificationImages.length }}/9）</text>
        <view class="ac__imgs">
          <view v-for="(im, i) in rectificationImages" :key="'r' + i" class="ac__img ac__img--rel">
            <image :src="im" mode="aspectFill" @tap="previewRectification(i)" />
            <view class="ac__del" @tap.stop="removeRectification(i)"><JzIcon name="close" :size="22" :color="TOKEN_COLOR.white" :stroke-width="2.4" /></view>
          </view>
          <view v-if="rectificationImages.length < 9" class="ac__img ac__add" @tap="chooseRectification"><JzIcon name="plus" :size="42" :color="TOKEN_COLOR.text3" /></view>
        </view>
      </template>
      <text class="ac__label">现场照片</text>
      <view class="ac__imgs">
        <view v-for="(im, i) in images" :key="i" class="ac__img ac__img--rel">
          <image :src="im" mode="aspectFill" @tap="preview(i)" />
          <view class="ac__del" @tap.stop="removeImage(i)"><JzIcon name="close" :size="22" :color="TOKEN_COLOR.white" :stroke-width="2.4" /></view>
        </view>
        <view v-if="images.length < 9" class="ac__img ac__add" @tap="chooseImage"><JzIcon name="plus" :size="42" :color="TOKEN_COLOR.text3" /></view>
      </view>
      <view class="ac__submit">
        <button class="jz-btn jz-btn--primary jz-btn--block ac__submit-btn" @tap="submit"><JzIcon name="check-circle" :size="28" :color="TOKEN_COLOR.white" /><text>提交验收（等待业主确认）</text></button>
      </view>
    </view>

    <view v-if="!acceptance && !canSubmit" class="jz-card ac__card"><text class="ac__empty">当前身份无验收操作权限</text></view>
  </view>
</template>

<style lang="scss" scoped>
.ac { padding: 24rpx; }
.ac__head { padding: 28rpx; margin-bottom: 20rpx; }
.ac__title { font-size: $jzb-font-lg; font-weight: 700; flex: 1; margin-right: 12rpx; }
.ac__sub { display: block; margin-top: 8rpx; font-size: $jzb-font-xs; color: $jzb-text-3; line-height: 1.6; }
.ac__card { padding: 28rpx; margin-bottom: 20rpx; }
.ac__status { font-size: $jzb-font-sm; font-weight: 600; color: $jzb-warning; background: $jzb-warning-soft; border-radius: $jzb-radius-sm; padding: 12rpx 18rpx; display: block; }
.ac__form-title { font-size: $jzb-font-lg; font-weight: 700; }
.ac__label { display: block; font-size: $jzb-font-sm; color: $jzb-text-3; margin: 18rpx 0 10rpx; }
.ac__pass-text { font-size: 40rpx; font-weight: 700; color: $jzb-success; }
.ac__content { font-size: $jzb-font; color: $jzb-text-1; line-height: 1.7; }
.ac__issue { font-size: $jzb-font-sm; color: $jzb-warning; line-height: 1.9; }
.ac__results { flex-wrap: wrap; }
.ac__result { padding: 12rpx 26rpx; margin: 0 16rpx 12rpx 0; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; font-size: $jzb-font-sm; color: $jzb-text-2; }
.ac__result--on { background: $jzb-primary; color: $jzb-text-inverse; }
.req { color: $jzb-danger; }
.ac__ta { width: 100%; height: 220rpx; background: $jzb-bg-hover; border-radius: $jzb-radius; padding: 18rpx; box-sizing: border-box; font-size: $jzb-font; }
.ac__ta--sm { height: 140rpx; }
.ac__imgs { display: flex; flex-direction: row; flex-wrap: wrap; }
.ac__img { width: 196rpx; height: 196rpx; border-radius: $jzb-radius-sm; margin: 0 12rpx 12rpx 0; background: $jzb-bg-hover; }
.ac__img image { width: 100%; height: 100%; border-radius: inherit; }
.ac__img--rel { position: relative; overflow: hidden; }
.ac__del { position: absolute; right: 0; top: 0; width: 44rpx; height: 44rpx; display: flex; align-items: center; justify-content: center; background: rgba(15,23,42,.58); border-bottom-left-radius: 12rpx; }
.ac__add { border: 2rpx dashed $jzb-text-4; display: flex; align-items: center; justify-content: center; font-size: 60rpx; color: $jzb-text-3; }
.ac__confirm { display: flex; flex-direction: row; margin-top: 30rpx; }
.ac__reject-form { margin-top: 28rpx; padding-top: 24rpx; border-top: 1rpx solid $jzb-border-light; }
.ac__reject-title { display: block; font-size: $jzb-font; font-weight: 700; color: $jzb-text-1; }
.ac__picker { min-height: 84rpx; padding: 0 20rpx; display: flex; align-items: center; justify-content: space-between; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; color: $jzb-text-1; font-size: $jzb-font-sm; }
.ac__picker--readonly { justify-content: flex-start; color: $jzb-text-2; }
.ac__picker--missing { color: $jzb-danger; }
.ac__auto-hint { display: block; margin-top: 10rpx; font-size: $jzb-font-xs; color: $jzb-text-3; line-height: 1.6; }
.ac__placeholder { color: $jzb-text-3; }
.ac__reject-actions { display: flex; flex-direction: row; margin-top: 30rpx; }
.ac__submit { margin-top: 30rpx; }
.ac__resubmit { margin-top: 26rpx; }
.ac__tip { display: block; margin-top: 16rpx; font-size: $jzb-font-xs; color: $jzb-text-3; text-align: center; }
.ac__done-row { display: flex; flex-direction: row; padding: 16rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.ac__done-label { width: 160rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.ac__done-val { flex: 1; color: $jzb-text-1; font-size: $jzb-font-sm; }
.ac__empty { text-align: center; color: $jzb-text-3; font-size: $jzb-font; padding: 30rpx 0; }
.ac__resubmit-btn { display: flex; align-items: center; justify-content: center; }
.ac__resubmit-btn text { margin-right: 6rpx; }
.ac__round { margin-top: 22rpx; padding-top: 20rpx; border-top: 1rpx solid $jzb-border-light; }
.ac__round-no { font-size: $jzb-font-sm; font-weight: 700; }
.ac__person { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: flex-end; gap: 10rpx; text-align: right; }
.ac__round-submitter { display: flex; align-items: center; gap: 10rpx; margin-top: 6rpx; }
.ac__round-submitter .ac__round-meta { margin-top: 0; }
.ac__round-meta { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.ac__round-block { margin-top: 12rpx; }
.ac__round-label { display: block; font-size: $jzb-font-xs; color: $jzb-text-3; margin-bottom: 6rpx; }
.ac__round-text { display: block; margin-top: 8rpx; font-size: $jzb-font-sm; color: $jzb-text-1; line-height: 1.7; }
.ac__img--sm { width: 140rpx; height: 140rpx; }
.ac__submit-btn { display: flex; align-items: center; justify-content: center; }
.ac__submit-btn text { margin-left: 8rpx; }
</style>
