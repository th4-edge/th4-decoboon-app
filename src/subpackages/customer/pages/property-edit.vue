<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { crmApi } from '@/domains/crm/api'
import { propertyApi } from '@/domains/property/api'
import type { Customer } from '@/domains/crm/model'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzSheet from '@/components/JzSheet.vue'

const customerId = ref('')
const propertyId = ref('')
const customer = ref<Customer | null>(null)
const community = ref('')
const building = ref('')
const roomNo = ref('')
const address = ref('')
const area = ref('')
const layout = ref('')
const remark = ref('')
const submitting = ref(false)
const layoutPickerOpen = ref(false)
const layoutDraft = ref('')

/** 常用户型预设，覆盖主流住宅格局，减少录入打字量 */
const LAYOUT_OPTIONS = [
  '一室一厅', '一室两厅',
  '两室一厅', '两室两厅', '两室三厅',
  '三室一厅', '三室两厅', '三室三厅',
  '四室两厅', '四室三厅',
  '五室两厅', '五室三厅',
  '复式', '别墅', 'LOFT'
]

function openLayoutPicker() {
  layoutDraft.value = layout.value
  layoutPickerOpen.value = true
}
function closeLayoutPicker() { layoutPickerOpen.value = false }
function selectLayoutOption(value: string) { layoutDraft.value = value }
function confirmLayout() {
  layout.value = layoutDraft.value.trim()
  layoutPickerOpen.value = false
}

/** 带 propertyId 进入即为编辑模式：加载已有房屋档案，保存调 update；否则为新增模式。 */
const isEdit = computed(() => !!propertyId.value)

onLoad(async (q) => {
  customerId.value = q?.customerId || ''
  propertyId.value = q?.propertyId || ''
  if (!customerId.value) {
    toast('缺少客户参数')
    return
  }
  try {
    const detail = await crmApi.info(customerId.value)
    customer.value = detail
    community.value = detail?.community || ''
    area.value = detail?.area ? String(detail.area) : ''
    // 编辑模式：拉取房屋档案回填表单，客户级 community/area 只作默认值兜底
    if (propertyId.value) {
      const p = await propertyApi.info(propertyId.value)
      community.value = p.community || community.value
      building.value = p.building || ''
      roomNo.value = p.roomNo || ''
      address.value = p.address || ''
      area.value = p.area ? String(p.area) : area.value
      layout.value = p.layout || ''
      remark.value = p.remark || ''
    }
  } catch (error) {
    toastError(error, '客户信息加载失败')
  }
})

async function save() {
  if (!address.value.trim()) {
    toast('请填写房屋详细地址')
    return
  }
  if (submitting.value) return
  submitting.value = true
  loading('保存中…')
  try {
    if (isEdit.value) {
      await propertyApi.update({
        id: propertyId.value,
        community: community.value.trim(),
        building: building.value.trim(),
        roomNo: roomNo.value.trim(),
        address: address.value.trim(),
        area: area.value ? Number(area.value) : undefined,
        layout: layout.value.trim(),
        remark: remark.value.trim()
      })
    } else {
      await propertyApi.save({
        customerId: customerId.value,
        community: community.value.trim(),
        building: building.value.trim(),
        roomNo: roomNo.value.trim(),
        address: address.value.trim(),
        area: area.value ? Number(area.value) : undefined,
        layout: layout.value.trim(),
        remark: remark.value.trim()
      })
    }
    // 历史坑：App 端 uni.showToast 不会自动关闭 uni.showLoading，
    // 必须先 hideLoading 再 toast，否则成功提示会被 loading 遮罩吞没，用户体感"保存无反应"。
    hideLoading()
    toast(isEdit.value ? '房屋已更新' : '房屋已创建', 'success')
    setTimeout(() => uni.navigateBack(), 500)
  } catch (error) {
    hideLoading()
    toastError(error, isEdit.value ? '房屋更新失败' : '房屋创建失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="pe">
    <JzPageHeader :title="isEdit ? '编辑房屋' : '新增房屋'" :subtitle="isEdit ? '修改房屋地址、面积、户型等档案信息' : '建立房屋档案后可约定量房、设计与报价'" />

    <view class="pe__customer jz-card">
      <view class="pe__customer-row">
        <JzIcon name="user" :size="30" :color="TOKEN_COLOR.primary" />
        <text class="pe__customer-name">{{ customer?.name || '客户' }}</text>
        <text class="pe__customer-phone">{{ customer?.phone || '—' }}</text>
      </view>
      <text class="pe__customer-sub">为该客户创建一套装修房屋，需先补充详细地址</text>
    </view>

    <view class="pe__form jz-card">
      <view class="pe__field pe__field--col">
        <text class="pe__label">房屋详细地址 <text class="pe__req">*</text></text>
        <input v-model="address" class="pe__input pe__input--block" maxlength="200" placeholder="例：合肥市蜀山区长江西路123号5栋1801" />
      </view>
      <view class="pe__field">
        <text class="pe__label">意向小区</text>
        <input v-model="community" class="pe__input" maxlength="60" placeholder="例：江南新苑" />
      </view>
      <view class="pe__field">
        <text class="pe__label">楼栋</text>
        <input v-model="building" class="pe__input" maxlength="40" placeholder="例：5栋" />
      </view>
      <view class="pe__field">
        <text class="pe__label">房号</text>
        <input v-model="roomNo" class="pe__input" maxlength="40" placeholder="例：1801" />
      </view>
      <view class="pe__field">
        <text class="pe__label">面积(㎡)</text>
        <input v-model="area" class="pe__input jz-numeric-input" type="digit" placeholder="例：118" placeholder-class="jz-number-placeholder" placeholder-style="text-align: left" />
      </view>
      <view class="pe__field" @tap="openLayoutPicker">
        <text class="pe__label">户型</text>
        <view class="pe__input pe__input--picker">
          <text :class="{ 'pe__placeholder': !layout }">{{ layout || '请选择或输入户型' }}</text>
          <JzIcon name="arrow-down" :size="24" :color="TOKEN_COLOR.text3" />
        </view>
      </view>
      <view class="pe__field pe__field--col">
        <text class="pe__label">备注</text>
        <input v-model="remark" class="pe__input pe__input--block" maxlength="200" placeholder="房屋特殊说明、钥匙交接等" />
      </view>
    </view>

    <JzSheet :visible="layoutPickerOpen" title="选择户型" @close="closeLayoutPicker">
      <view class="pe__editor">
        <view class="pe__sheet-body">
          <input v-model="layoutDraft" class="pe__sheet-input" maxlength="60" placeholder="可直接输入自定义户型" />
          <text class="pe__sheet-label">常用户型</text>
          <view class="pe__layout-options">
            <view v-for="item in LAYOUT_OPTIONS" :key="item" class="pe__layout-option" :class="{ 'pe__layout-option--on': layoutDraft === item }" @tap="selectLayoutOption(item)">{{ item }}</view>
          </view>
        </view>
        <view class="pe__sheet-actions">
          <button class="jz-btn jz-btn--neutral jz-grow" @tap="closeLayoutPicker">取消</button>
          <button class="jz-btn jz-btn--primary jz-grow" @tap="confirmLayout">确定</button>
        </view>
      </view>
    </JzSheet>

    <view class="jz-actionbar">
      <view class="jz-actionbar__inner">
        <button class="jz-btn jz-btn--primary jz-grow" :disabled="submitting" @tap="save">保存房屋</button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.pe { padding-bottom: 168rpx; }
.pe__customer { margin: 24rpx $jzb-page-pad 0; padding: 24rpx; }
.pe__customer-row { display: flex; align-items: center; gap: 8rpx; }
.pe__customer-name { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.pe__customer-phone { margin-left: auto; color: $jzb-text-3; font-size: $jzb-font-sm; }
.pe__customer-sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }

.pe__form { margin: 24rpx $jzb-page-pad 0; padding: 0 24rpx; }
.pe__field { display: flex; align-items: center; min-height: 104rpx; padding: 16rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.pe__field:last-child { border-bottom: none; }
.pe__field--col { flex-direction: column; align-items: stretch; padding: 24rpx 0; }
.pe__label { width: 176rpx; flex-shrink: 0; color: $jzb-text-2; font-size: $jzb-font-sm; }
.pe__field--col .pe__label { width: auto; }
.pe__req { color: $jzb-danger; }
.pe__input { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font; text-align: right; }
.pe__input--block { flex: none; width: 100%; margin-top: 12rpx; text-align: left; }
.pe__input--picker { display: flex; align-items: center; justify-content: flex-end; gap: 8rpx; }
.pe__placeholder { color: $jzb-text-4; }
.pe__editor { display: flex; flex-direction: column; }
.pe__sheet-body { padding: 0 0 18rpx; box-sizing: border-box; }
.pe__sheet-input { width: 100%; min-height: 80rpx; padding: 0 24rpx; box-sizing: border-box; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; color: $jzb-text-1; }
.pe__sheet-label { display: block; margin: 24rpx 0 16rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.pe__layout-options { display: flex; flex-wrap: wrap; gap: 12rpx; }
.pe__layout-option { min-height: 64rpx; padding: 0 24rpx; display: flex; align-items: center; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; color: $jzb-text-2; font-size: $jzb-font-sm; }
.pe__layout-option--on { color: $jzb-primary-dark; background: $jzb-primary-lightest; font-weight: 650; }
.pe__sheet-actions { flex-shrink: 0; padding-top: 16rpx; display: flex; gap: 14rpx; border-top: 1rpx solid $jzb-border-light; }
</style>
