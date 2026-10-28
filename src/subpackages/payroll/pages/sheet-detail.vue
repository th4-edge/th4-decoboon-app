<script setup lang="ts">
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { P } from '@/config'
import { money } from '@/core/format'
import { payrollApi } from '@/domains/payroll/api'
import type { PayrollItem, PayrollSheet } from '@/domains/payroll/model'
import { PAYROLL_ITEM_STATUS_META, PAYROLL_SHEET_STATUS_META } from '@/domains/payroll/meta'
import { session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { confirmAction, confirmDanger, hideLoading, loading as showLoading, promptText, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import JzTag from '@/components/JzTag.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'

type BlockerAction = 'attendance' | 'commission' | 'rebuild' | 'items'

interface Blocker { key: string; text: string; action?: BlockerAction }

const sheetId = ref('')
const sheet = ref<PayrollSheet | null>(null)
const items = ref<PayrollItem[]>([])
const loading = ref(false)
const confirming = ref(false)
const deleting = ref(false)
const submittingReview = ref(false)
const returningDraft = ref(false)
const canSubmitReview = ref(can(session.role, 'edit:payroll'))
const canReturn = ref(can(session.role, 'confirm:payroll'))
const canConfirm = ref(can(session.role, 'confirm:payroll'))

/** DEC-046/BR-038：确认前必须逐项校验，阻断时给出可执行的下一步。 */
const blockers = computed<Blocker[]>(() => {
  const current = sheet.value
  if (!current) return []
  const list: Blocker[] = []
  if (!items.value.length) list.push({ key: 'items', text: '该月没有工资项：请检查薪酬方案生效期，或重新生成工资单草稿', action: 'rebuild' })
  if (!current.attendanceComplete) list.push({ key: 'attendance', text: '考勤未确认：确认全部员工月度考勤后才能确认工资单', action: 'attendance' })
  if (items.value.some((item) => item.netAmount < 0)) list.push({ key: 'negative', text: '存在实发为负的工资项：需人工处理后才能确认', action: 'items' })
  return list
})

/** DEC-047 / BR-039：提成与工资解耦，提成未结清只提示、不阻断。 */
const hints = computed<{ key: string; text: string; action?: BlockerAction }[]>(() => {
  const current = sheet.value
  if (!current || current.commissionComplete) return []
  return [{
    key: 'commission',
    text: '本月存在未结清的提成；提成与工资独立结算、独立发放，不影响本次工资确认',
    action: 'commission'
  }]
})

const editableStatus = computed(() => sheet.value?.status === 'draft' || sheet.value?.status === 'pending')
const showBlockers = computed(() => editableStatus.value && blockers.value.length > 0)
const confirmDisabled = computed(() => confirming.value || blockers.value.length > 0)

onLoad((query) => { sheetId.value = query?.sheetId || ''; void refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

async function refresh() {
  if (!sheetId.value) return
  loading.value = true
  try {
    sheet.value = await payrollApi.sheetInfo(sheetId.value)
    items.value = await payrollApi.itemPage({ sheetId: sheetId.value }, 1, 200)
  } catch (error) { toastError(error, '工资单详情加载失败') }
  finally { loading.value = false }
}

async function removeDraft() {
  if (!sheet.value || session.role !== 'boss' || sheet.value.status !== 'draft' || deleting.value) return
  const confirmed = await confirmDanger('删除工资单草稿', `确认删除 ${sheet.value?.period} 工资单草稿？删除后可以重新生成，已确认或已发放工资单不可删除。`, '删除')
  if (!confirmed) return
  deleting.value = true
  showLoading('删除中')
  try {
    await payrollApi.deleteSheet(sheet.value.id)
    hideLoading()
    toast('工资单草稿已删除', 'success')
    setTimeout(() => uni.navigateBack(), 400)
  } catch (error) {
    hideLoading()
    toastError(error, '工资单草稿删除失败')
  } finally {
    deleting.value = false
  }
}

function goAttendance() {
  const month = sheet.value?.period || ''
  uni.navigateTo({ url: `${P.payrollAttendanceList}?month=${encodeURIComponent(month)}` })
}

function goCommission() { uni.navigateTo({ url: P.payrollCommissionList }) }

function goRebuild() {
  const period = sheet.value?.period || ''
  uni.navigateTo({ url: `${P.payrollSheetList}?period=${encodeURIComponent(period)}` })
}

function resolveBlocker(action?: BlockerAction) {
  if (action === 'attendance') return goAttendance()
  if (action === 'commission') return goCommission()
  if (action === 'rebuild') return goRebuild()
}

async function submitReview() {
  if (!sheet.value || !canSubmitReview.value || submittingReview.value || sheet.value.status !== 'draft') return
  if (blockers.value.length) { toast(blockers.value[0].text); return }
  const ok = await confirmAction({
    title: '提交工资单复核',
    content: `提交 ${sheet.value.period} 工资单后进入待确认；BOSS 可直接确认或退回草稿。`,
    confirmText: '提交复核'
  })
  if (!ok) return
  submittingReview.value = true
  showLoading('提交中')
  try {
    sheet.value = await payrollApi.submitSheetReview(sheet.value.id)
    hideLoading()
    toast('工资单已提交复核', 'success')
  } catch (error) {
    hideLoading()
    toastError(error, '提交复核失败')
  } finally { submittingReview.value = false }
}

async function returnToDraft() {
  if (!sheet.value || !canReturn.value || returningDraft.value || sheet.value.status !== 'pending') return
  const reason = await promptText('退回工资单', '请输入退回原因', '退回后工资单恢复为草稿，可继续修正。')
  if (reason === null) return
  if (!reason.trim()) { toast('退回原因不能为空'); return }
  returningDraft.value = true
  showLoading('退回中')
  try {
    sheet.value = await payrollApi.returnSheetToDraft(sheet.value.id, reason.trim())
    hideLoading()
    toast('工资单已退回草稿', 'success')
  } catch (error) {
    hideLoading()
    toastError(error, '退回工资单失败')
  } finally { returningDraft.value = false }
}

async function confirmSheet() {
  if (!sheet.value || !canConfirm.value || confirming.value || !editableStatus.value) return
  if (blockers.value.length) { toast(blockers.value[0].text); return }
  const ok = await confirmAction({
    title: '确认工资单',
    content: `确认 ${sheet.value.period} 工资单？确认后系统将按实发生成员工工资应付并计入项目/企业成本；工资条在发放完成后才对员工可见。`,
    confirmText: '确认'
  })
  if (!ok) return
  confirming.value = true
  showLoading('确认中')
  try {
    sheet.value = await payrollApi.confirmSheet(sheet.value.id)
    items.value = await payrollApi.itemPage({ sheetId: sheetId.value }, 1, 200)
    hideLoading()
    toast('工资单已确认：应付已生成，工资条待发放后可见', 'success')
  } catch (error) {
    hideLoading()
    toastError(error, '工资单确认失败')
  } finally { confirming.value = false }
}
</script>

<template>
  <view class="pay-page">
    <JzPageHeader :title="sheet ? `${sheet.period} 工资单` : '工资单详情'" subtitle="确认后按实发工资生成应付并计成本" />
    <JzSkeleton v-if="loading && !sheet" :rows="6" />
    <view v-if="sheet" class="pay-body">
      <view class="detail-hero">
        <view><text class="detail-hero__label">实发合计</text><text class="detail-hero__value">{{ money(sheet.totalNetAmount) }}</text></view>
        <JzTag :text="PAYROLL_SHEET_STATUS_META[sheet.status].label" :color="PAYROLL_SHEET_STATUS_META[sheet.status].color" />
      </view>
      <view class="detail-facts jz-card">
        <view><text>应发合计</text><text>{{ money(sheet.totalGrossAmount) }}</text></view>
        <view><text>扣款合计</text><text>{{ money(sheet.totalDeductionAmount) }}</text></view>
        <view><text>考勤</text><text>{{ sheet.attendanceComplete ? '已完整' : '未完整' }}</text></view>
        <view><text>提成</text><text>{{ sheet.commissionComplete ? '已结清' : '有未结清' }}</text></view>
      </view>
      <view v-if="sheet.remark" class="hint-card jz-card return-reason">
        <JzIcon name="info" :size="28" :color="TOKEN_COLOR.warning" />
        <text class="hint-card__text">{{ sheet.remark }}</text>
      </view>
      <view v-if="hints.length" class="hint-card jz-card">
        <view v-for="hint in hints" :key="hint.key" class="hint-card__row">
          <JzIcon name="info" :size="28" :color="TOKEN_COLOR.text3" />
          <text class="hint-card__text">{{ hint.text }}</text>
          <text v-if="hint.action" class="hint-card__action" @tap="resolveBlocker(hint.action)">去查看</text>
        </view>
      </view>
      <view v-if="showBlockers" class="blocker-card jz-card">
        <text class="blocker-card__title">确认前需先处理</text>
        <view v-for="blocker in blockers" :key="blocker.key" class="blocker-card__row">
          <JzIcon name="alert-circle" :size="28" :color="TOKEN_COLOR.warning" />
          <text class="blocker-card__text">{{ blocker.text }}</text>
          <text v-if="blocker.action" class="blocker-card__action" @tap="resolveBlocker(blocker.action)">去处理</text>
        </view>
      </view>
      <view class="jz-section"><text class="jz-section__title">员工工资项</text><text class="jz-section__more">{{ items.length }} 条</text></view>
      <view v-for="item in items" :key="item.id" class="item-card jz-card">
        <view class="item-card__top"><text class="item-card__name">{{ item.employee.name }}</text><JzTag :text="PAYROLL_ITEM_STATUS_META[item.status].label" :color="PAYROLL_ITEM_STATUS_META[item.status].color" /></view>
        <view class="item-card__attribution"><text>{{ item.project?.name || '企业费用' }}</text></view>
        <view class="item-card__section-title">收入明细</view>
        <view class="item-card__rows">
          <view><text>基本工资</text><text>{{ money(item.baseSalaryAmount) }}</text></view>
          <view><text>提成</text><text>{{ money(item.commissionAmount) }}</text></view>
          <view><text>奖金</text><text>{{ money(item.bonusAmount) }}</text></view>
          <view><text>补贴</text><text>{{ money(item.allowanceAmount) }}</text></view>
          <view class="item-card__subtotal"><text>应发</text><text>{{ money(item.grossAmount) }}</text></view>
        </view>
        <view class="item-card__section-title">扣款明细</view>
        <view class="item-card__rows">
          <view><text>考勤扣款</text><text>{{ money(item.attendanceDeduction) }}</text></view>
          <view><text>社保</text><text>{{ money(item.socialInsuranceAmount) }}</text></view>
          <view><text>个税</text><text>{{ money(item.taxAmount) }}</text></view>
          <view><text>其他扣款</text><text>{{ money(item.otherDeduction) }}</text></view>
          <view class="item-card__subtotal"><text>扣款合计</text><text>{{ money(item.deductionAmount) }}</text></view>
        </view>
        <view class="item-card__net"><text>实发工资</text><text>{{ money(item.netAmount) }}</text></view>
      </view>
      <JzEmpty v-if="!items.length" text="暂无工资项" sub="先生成工资单草稿并补齐考勤、提成和归属" />
      <button v-if="session.role === 'boss' && sheet.status === 'draft'" class="jz-btn jz-btn--danger jz-btn--block" :disabled="deleting" @tap="removeDraft">删除草稿</button>
      <button v-if="canSubmitReview && sheet.status === 'draft'" class="jz-btn jz-btn--ghost jz-btn--block" :disabled="submittingReview || blockers.length > 0" @tap="submitReview">{{ blockers.length ? '请先处理阻断项' : '提交复核' }}</button>
      <button v-if="canReturn && sheet.status === 'pending'" class="jz-btn jz-btn--ghost jz-btn--block" :disabled="returningDraft" @tap="returnToDraft">退回草稿</button>
      <button v-if="canConfirm && editableStatus" class="jz-btn jz-btn--primary jz-btn--block" :disabled="confirmDisabled" @tap="confirmSheet">{{ confirmDisabled && !confirming ? '请先处理阻断项' : '确认工资单' }}</button>
    </view>
  </view>
    <JzConfirmDialog />
</template>

<style lang="scss" scoped>
.pay-page { min-height: 100vh; background: $jzb-bg-page; }
.pay-body { padding: 24rpx $jzb-page-pad 56rpx; }
.detail-hero { display: flex; align-items: center; justify-content: space-between; padding: 34rpx 32rpx; border-radius: $jzb-radius-xl; background: linear-gradient(135deg, $jzb-primary-dark, $jzb-primary); color: #fff; }
.detail-hero__label { display: block; font-size: $jzb-font-sm; opacity: .84; }
.detail-hero__value { display: block; margin-top: 10rpx; font-size: 52rpx; font-weight: 750; }
.detail-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 24rpx; margin-top: 22rpx; padding: 28rpx; }
.detail-facts view { display: flex; justify-content: space-between; color: $jzb-text-3; font-size: $jzb-font-sm; }
.detail-facts view text:last-child { color: $jzb-text-1; font-weight: 650; }
.item-card { padding: 26rpx; margin-bottom: 18rpx; }
.item-card__top { display: flex; justify-content: space-between; align-items: center; }
.item-card__name { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.item-card__attribution { margin-top: 12rpx; color: $jzb-text-3; font-size: 22rpx; }
.item-card__section-title { margin-top: 24rpx; padding-top: 20rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 700; }
.item-card__rows { margin-top: 12rpx; }
.item-card__rows view { display: flex; justify-content: space-between; gap: 20rpx; padding: 9rpx 0; color: $jzb-text-3; font-size: 22rpx; }
.item-card__rows view text:last-child { color: $jzb-text-1; font-weight: 600; }
.item-card__rows .item-card__subtotal { margin-top: 6rpx; padding-top: 14rpx; border-top: 1rpx dashed $jzb-border-light; color: $jzb-text-2; font-weight: 700; }
.item-card__rows .item-card__subtotal text:last-child { color: $jzb-text-1; }
.item-card__net { display: flex; align-items: center; justify-content: space-between; margin-top: 20rpx; padding: 18rpx 20rpx; border-radius: $jzb-radius-md; background: $jzb-primary-lightest; color: $jzb-primary-deep; font-size: $jzb-font-md; font-weight: 750; }
.hint-card { margin-top: 22rpx; padding: 22rpx 28rpx; background: $jzb-bg-page; }
.hint-card__row { display: flex; align-items: flex-start; gap: 12rpx; }
.hint-card__text { flex: 1; min-width: 0; color: $jzb-text-2; font-size: 22rpx; line-height: 1.5; }
.hint-card__action { flex: none; color: $jzb-primary; font-size: 22rpx; font-weight: 650; }
.return-reason { display: flex; align-items: center; gap: 12rpx; border-left: 8rpx solid $jzb-warning; }
.blocker-card { margin-top: 22rpx; padding: 26rpx 28rpx; border-left: 8rpx solid $jzb-warning; }
.blocker-card__title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 700; }
.blocker-card__row { display: flex; align-items: center; gap: 12rpx; margin-top: 18rpx; }
.blocker-card__text { flex: 1; min-width: 0; color: $jzb-text-2; font-size: 22rpx; line-height: 1.5; }
.blocker-card__action { flex: none; color: $jzb-primary; font-size: 22rpx; font-weight: 650; }
button { margin-top: 28rpx; }
</style>
