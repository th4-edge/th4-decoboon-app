<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { session } from '@/domains/identity/session'
import type { Employee } from '@/domains/identity/model'
import { identityApi } from '@/domains/identity/api'
import type { CustomerBatchItem, CustomerBatchPreview } from '@/domains/crm/model'
import { crmApi } from '@/domains/crm/api'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'
import { confirm, hideLoading, loading, toast, toastError } from '@/composables/toast'

const OWNER_ROLES = ['boss', 'storeManager', 'teamLeader', 'marketer']
const text = ref('')
const owners = ref<Employee[]>([])
const ownerIndex = ref(0)
const preview = ref<CustomerBatchPreview | null>(null)
const parsing = ref(false)
const submitting = ref(false)

const isManager = computed(() => session.role === 'boss' || session.role === 'storeManager')
const owner = computed(() => owners.value[ownerIndex.value] || null)
const ownerLabel = computed(() => owner.value
  ? `${owner.value.name} · ${owner.value.store?.name || '当前门店'}`
  : '暂无可交付人员')

onLoad(async () => {
  if (!isManager.value) {
    toast('仅企业负责人或店长可以批量录入客户')
    setTimeout(() => uni.navigateBack(), 500)
    return
  }
  try {
    const all = await identityApi.employees()
    const currentStoreId = session.emp?.store?.id
    owners.value = all.filter((item) => item.status === 'active'
      && OWNER_ROLES.includes(item.role)
      && (session.role === 'boss' || !currentStoreId || item.store?.id === currentStoreId))
    ownerIndex.value = 0
  } catch (error) {
    toastError(error, '负责人列表加载失败')
  }
})

function onOwnerChange(event: { detail: { value: string } }) {
  ownerIndex.value = Number(event.detail.value || 0)
  preview.value = null
}

async function parse() {
  if (!text.value.trim()) {
    toast('请先粘贴或输入手机号')
    return
  }
  parsing.value = true
  try {
    preview.value = await crmApi.batchPreview(text.value)
    if (preview.value.total === 0) toast('没有识别到手机号')
  } catch (error) {
    toastError(error, '手机号解析失败')
  } finally {
    parsing.value = false
  }
}

async function submit() {
  if (!owner.value) {
    toast('请选择交付的客户负责人')
    return
  }
  if (!preview.value) {
    toast('请先解析手机号并确认结果')
    return
  }
  if (preview.value.validCount <= 0) {
    toast('当前没有可新增的有效手机号')
    return
  }
  const ok = await confirm(
    '确认批量录入',
    `将新增 ${preview.value.validCount} 位客户，并交付给 ${owner.value.name} 进行营销。是否继续？`,
    '确认录入'
  )
  if (!ok) return
  submitting.value = true
  loading('正在批量录入…')
  try {
    preview.value = await crmApi.batchSave(text.value, owner.value.id)
    toast(`已新增 ${preview.value.createdCount} 位客户`, 'success')
    await new Promise((resolve) => setTimeout(resolve, 500))
    uni.navigateBack({ fail: () => uni.reLaunch({ url: P.customerList }) })
  } catch (error) {
    toastError(error, '批量录入失败')
  } finally {
    hideLoading()
    submitting.value = false
  }
}

function statusLabel(item: CustomerBatchItem) {
  if (item.status === 'valid') return '可新增'
  if (item.status === 'created') return '已新增'
  if (item.status === 'duplicate') return '已存在'
  return '号码无效'
}

function statusColor(item: CustomerBatchItem) {
  if (item.status === 'valid' || item.status === 'created') return TOKEN_COLOR.success
  if (item.status === 'duplicate') return TOKEN_COLOR.warning
  return TOKEN_COLOR.danger
}
</script>

<template>
  <view class="cb">
    <JzPageHeader title="批量录入客户" subtitle="粘贴手机号，解析确认后交付业务员营销" back />

    <view class="cb__body">
      <view class="jz-card cb__owner">
        <view class="cb__owner-head">
          <view>
            <text class="cb__owner-label">交付客户负责人</text>
            <text class="cb__owner-tip">新增客户将进入该负责人的客户列表</text>
          </view>
          <JzIcon name="users" :size="34" :color="TOKEN_COLOR.primary" />
        </view>
        <picker
          :range="owners"
          range-key="name"
          :value="ownerIndex"
          :disabled="!owners.length"
          @change="onOwnerChange"
        >
          <view class="cb__picker">
            <text :class="{ 'cb__picker--empty': !owner }">{{ ownerLabel }}</text>
            <JzIcon name="chevron-down" :size="26" :color="TOKEN_COLOR.text3" />
          </view>
        </picker>
        <text v-if="!owners.length" class="cb__owner-empty">当前门店暂无可用业务员、团队负责人或店长</text>
      </view>

      <view class="jz-card cb__input-card">
        <view class="cb__input-head">
          <text class="cb__section-title">粘贴手机号</text>
          <text class="cb__input-count">单次最多 200 个</text>
        </view>
        <textarea
          v-model="text"
          class="cb__textarea"
          maxlength="20000"
          auto-height
          :disabled="submitting"
          placeholder="支持逗号、顿号、分号、空格、换行、斜杠、竖线等分隔，例如：&#10;13800138000，13900139000&#10;13700137000 / 13600136000"
          placeholder-class="cb__placeholder"
        />
        <button class="jz-btn jz-btn--primary jz-btn--block" :loading="parsing" :disabled="submitting" @tap="parse">
          智能解析并预览
        </button>
      </view>

      <template v-if="preview">
        <view class="cb__stats">
          <view class="jz-card cb__stat">
            <text class="cb__stat-num">{{ preview.total }}</text>
            <text class="cb__stat-label">识别号码</text>
          </view>
          <view class="jz-card cb__stat cb__stat--ok">
            <text class="cb__stat-num">{{ preview.validCount }}</text>
            <text class="cb__stat-label">可新增</text>
          </view>
          <view class="jz-card cb__stat cb__stat--warn">
            <text class="cb__stat-num">{{ preview.duplicateCount }}</text>
            <text class="cb__stat-label">已存在</text>
          </view>
          <view class="jz-card cb__stat cb__stat--danger">
            <text class="cb__stat-num">{{ preview.invalidCount }}</text>
            <text class="cb__stat-label">无效</text>
          </view>
        </view>

        <view class="cb__result-head">
          <text class="cb__section-title">解析明细</text>
          <text class="cb__result-tip">确认无误后再录入</text>
        </view>
        <view class="jz-card cb__items">
          <view v-for="(item, index) in preview.items" :key="`${item.input}-${index}`" class="cb__item">
            <view class="jz-grow">
              <text class="cb__phone">{{ item.phone || item.input || '空号码' }}</text>
              <text v-if="item.reason" class="cb__reason">{{ item.reason }}</text>
            </view>
            <text class="cb__status" :style="{ color: statusColor(item) }">{{ statusLabel(item) }}</text>
          </view>
        </view>

        <button
          class="jz-btn jz-btn--primary jz-btn--block cb__submit"
          :loading="submitting"
          :disabled="!preview.validCount || !owner"
          @tap="submit"
        >
          确认新增 {{ preview.validCount }} 位客户
        </button>
        <text class="cb__submit-tip">重复号码和无效号码不会写入客户库。</text>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.cb { min-height: 100vh; background: $jzb-bg-page; }
.cb__body { padding: 24rpx 28rpx calc(60rpx + env(safe-area-inset-bottom)); }
.cb__owner { padding: 26rpx; margin-bottom: 20rpx; }
.cb__owner-head { display: flex; align-items: center; justify-content: space-between; }
.cb__owner-label { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.cb__owner-tip { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cb__picker { display: flex; align-items: center; justify-content: space-between; min-height: 82rpx; margin-top: 20rpx; padding: 0 22rpx; color: $jzb-text-1; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; }
.cb__picker--empty { color: $jzb-text-4; }
.cb__owner-empty { display: block; margin-top: 14rpx; color: $jzb-warning; font-size: $jzb-font-xs; }
.cb__input-card { padding: 26rpx; }
.cb__input-head, .cb__result-head { display: flex; align-items: baseline; justify-content: space-between; }
.cb__section-title { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.cb__input-count, .cb__result-tip { color: $jzb-text-3; font-size: $jzb-font-xs; }
.cb__textarea { width: 100%; min-height: 220rpx; margin: 20rpx 0 24rpx; padding: 22rpx; box-sizing: border-box; color: $jzb-text-1; background: $jzb-bg-hover; border-radius: $jzb-radius-md; font-size: $jzb-font-sm; line-height: 1.7; }
.cb__placeholder { color: $jzb-text-4; }
.cb__stats { display: flex; justify-content: space-between; gap: 12rpx; margin-top: 22rpx; }
.cb__stat { flex: 1; min-width: 0; padding: 20rpx 6rpx; text-align: center; }
.cb__stat-num { display: block; color: $jzb-text-1; font-size: 38rpx; font-weight: 760; }
.cb__stat-label { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: 20rpx; }
.cb__stat--ok .cb__stat-num { color: $jzb-success; }
.cb__stat--warn .cb__stat-num { color: $jzb-warning; }
.cb__stat--danger .cb__stat-num { color: $jzb-danger; }
.cb__result-head { margin: 30rpx 4rpx 14rpx; }
.cb__items { padding: 0 24rpx; }
.cb__item { display: flex; align-items: center; gap: 16rpx; min-height: 92rpx; border-bottom: 1rpx solid $jzb-border-light; }
.cb__item:last-child { border-bottom: 0; }
.cb__phone { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.cb__reason { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: 20rpx; }
.cb__status { flex-shrink: 0; font-size: $jzb-font-xs; font-weight: 650; }
.cb__submit { margin-top: 28rpx; }
.cb__submit-tip { display: block; margin-top: 14rpx; color: $jzb-text-3; text-align: center; font-size: 20rpx; }
</style>
