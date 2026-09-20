<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can, isCustomer } from '@/roles/permission'
import type { Acceptance } from '@/domains/acceptance/model'
import type { ProjectStage } from '@/domains/project/model'
import { ACCEPT_RESULT_META } from '@/domains/acceptance/meta'
import { projectApi } from '@/domains/project/api'
import { acceptanceApi } from '@/domains/acceptance/api'
import { fileApi } from '@/domains/file/api'
import JzIcon from '@/components/JzIcon.vue'
import { toast, toastError, loading, hideLoading } from '@/composables/toast'
import JzTag from '@/components/JzTag.vue'

const stageId = ref('')
const stage = ref<ProjectStage | null>(null)
const acceptance = ref<Acceptance | null>(null)
const isCust = computed(() => isCustomer(session.role))

const result = ref<Acceptance['result']>('pass')
const content = ref('')
const issuesText = ref('')
const images = ref<string[]>([])

onLoad((q) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  stageId.value = q?.stageId || ''
  load()
})
async function load() {
  try {
    stage.value = await projectApi.stage(stageId.value) || null
    acceptance.value = await acceptanceApi.ofStage(stageId.value) || null
    if (acceptance.value) content.value = acceptance.value.content
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
  if (!acceptance.value) return { label: '', color: '#86909C' }
  const map: Record<string, { label: string; color: string }> = {
    waiting: { label: '待确认', color: '#FF7D00' },
    confirmed: { label: '已确认', color: '#00B42A' },
    rejected: { label: '已驳回', color: '#F53F3F' }
  }
  return map[acceptance.value.customerStatus]
})

async function confirm(pass: boolean) {
  if (!isCust.value || !acceptance.value) return
  loading('提交确认…')
  try {
    await acceptanceApi.confirm(acceptance.value.id, pass)
    hideLoading()
    toast(pass ? '验收已确认，阶段完成' : '已驳回，待整改后重新验收', 'success')
    setTimeout(() => uni.navigateBack(), 400)
  } catch (error) {
    hideLoading()
    toastError(error, '验收提交失败，请稍后重试')
  }
}

function chooseImage() {
  const remain = 9 - images.value.length
  if (remain <= 0) return
  uni.chooseImage({ count: remain, success: (res) => { images.value = [...images.value, ...res.tempFilePaths] } })
}
function removeImage(i: number) { images.value.splice(i, 1) }
function preview(i: number) { uni.previewImage({ urls: images.value, current: images.value[i] }) }
function previewFull(im: string) { uni.previewImage({ urls: acceptance.value?.images || [], current: im }) }
function resubmit() {
  issuesText.value = ''
  content.value = '整改完成，重新提交验收。'
}

async function submit() {
  const emp = session.emp
  if (!stage.value || !emp) return
  if (!content.value.trim()) { toast('请填写验收说明'); return }
  loading('提交验收…')
  try {
    const uploaded = await Promise.all(images.value.map(async (path) => (
      fileApi.isManaged(path)
        ? fileApi.storagePath(path) || path
        : (await fileApi.upload('Acceptance', path, { projectId: stage.value?.projectId })).path
    )))
    await acceptanceApi.submit({
      stageId: stage.value.id,
      result: result.value,
      content: content.value.trim(),
      issues: issuesText.value.split(/[\n,，;；]/).map((s) => s.trim()).filter(Boolean),
      images: uploaded,
      submitBy: emp
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
        <JzTag :text="acceptance ? summaryTag.label : '待验收'" :color="acceptance ? summaryTag.color : '#FF7D00'" />
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
      <view v-if="acceptance.images && acceptance.images.length" class="ac__label">现场照片</view>
      <view v-if="acceptance.images && acceptance.images.length" class="ac__imgs">
        <image v-for="(im, i) in acceptance.images" :key="i" :src="im" mode="aspectFill" class="ac__img" @tap="previewFull(im)" />
      </view>
      <view class="ac__done-row"><text class="ac__done-label">提交人</text><text class="ac__done-val">{{ acceptance.submitBy?.name }}（{{ acceptance.submitBy?.title }}）</text></view>
      <view class="ac__done-row"><text class="ac__done-label">提交时间</text><text class="ac__done-val">{{ acceptance.createdAt }}</text></view>
      <view v-if="acceptance.confirmAt" class="ac__done-row"><text class="ac__done-label">业主确认</text><text class="ac__done-val">{{ acceptance.confirmAt }}</text></view>

      <!-- 业主确认大按钮 -->
      <view v-if="waitingCustomer" class="ac__confirm">
        <button class="jz-btn jz-btn--danger-ghost jz-grow" @tap="confirm(false)"><JzIcon name="close" :size="28" :color="TOKEN_COLOR.danger" /><text>有异议，驳回</text></button>
        <button class="jz-btn jz-btn--primary jz-grow" style="margin-left:20rpx;" @tap="confirm(true)"><JzIcon name="check" :size="30" :color="TOKEN_COLOR.white" :stroke-width="2.4" /><text>确认验收</text></button>
      </view>
      <text v-if="waitingCustomer" class="ac__tip">业主确认后，验收结果将同步给项目经理与企业负责人</text>
      <view v-else-if="acceptance.customerStatus === 'rejected' && canSubmit" class="ac__resubmit">
        <button class="jz-btn jz-btn--plain jz-btn--block ac__resubmit-btn" @tap="resubmit"><text>整改完成，重新提交验收</text><JzIcon name="chevron-down" :size="26" :color="TOKEN_COLOR.primary" /></button>
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
      <text class="ac__label">需整改项（选填，一行一项）</text>
      <textarea v-model="issuesText" class="ac__ta ac__ta--sm" placeholder="例：阳台地漏周边收口&#10;踢脚线缝隙打胶" maxlength="300" />
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
.ac__submit { margin-top: 30rpx; }
.ac__resubmit { margin-top: 26rpx; }
.ac__tip { display: block; margin-top: 16rpx; font-size: $jzb-font-xs; color: $jzb-text-3; text-align: center; }
.ac__done-row { display: flex; flex-direction: row; padding: 16rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.ac__done-label { width: 160rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.ac__done-val { flex: 1; color: $jzb-text-1; font-size: $jzb-font-sm; }
.ac__empty { text-align: center; color: $jzb-text-3; font-size: $jzb-font; padding: 30rpx 0; }
.ac__resubmit-btn { display: flex; align-items: center; justify-content: center; }
.ac__resubmit-btn text { margin-right: 6rpx; }
.ac__submit-btn { display: flex; align-items: center; justify-content: center; }
.ac__submit-btn text { margin-left: 8rpx; }
</style>
